#!/usr/bin/env python
"""
Domain-Adaptive Pre-Training (DAPT) for SmolLM-360M-Instruct on French corpus.

Usage (Linux/Mac):
  python apps/koryxa/training/dapt_causal_lm.py \
    --data_dir apps/koryxa/training/data/dapt_corpus \
    --output_dir apps/koryxa/training/models/chatlaya-dapt

Usage (Windows PowerShell):
  python .\apps\koryxa\training\dapt_causal_lm.py \
    --data_dir .\apps\koryxa\training\data\dapt_corpus \
    --output_dir .\apps\koryxa\training\models\chatlaya-dapt

Requirements:
  pip install transformers datasets accelerate sentencepiece
"""
from __future__ import annotations

import argparse
import os
import math
import json
from pathlib import Path
from typing import Dict, List

import torch
from datasets import load_dataset, Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
)


BASE_MODEL = os.environ.get("BASE_MODEL", "HuggingFaceTB/SmolLM-360M-Instruct")
MAX_LEN = int(os.environ.get("MAX_SEQ_LEN", "1024"))


def detect_precision() -> Dict[str, bool]:
    if not torch.cuda.is_available():
        return {"bf16": False, "fp16": False}
    # Prefer bf16 on modern GPUs; fallback to fp16
    try:
        major, minor = torch.cuda.get_device_capability()
        bf16_ok = torch.cuda.is_bf16_supported() or major >= 8
    except Exception:
        bf16_ok = False
    return {"bf16": bf16_ok, "fp16": not bf16_ok}


def build_dataset_from_dir(data_dir: str) -> Dataset:
    # Accept multiple files (txt/json/jsonl). For json/jsonl, use `text` field fallback.
    data_dir = str(Path(data_dir))
    if not Path(data_dir).exists():
        raise FileNotFoundError(f"data_dir not found: {data_dir}")

    files = []
    for ext in ("*.txt", "*.jsonl", "*.json"):
        files.extend([str(p) for p in Path(data_dir).glob(ext)])
    if not files:
        raise FileNotFoundError(f"No corpus files found in {data_dir} (*.txt|*.jsonl|*.json)")

    # If all txt, we can load as 'text' dataset; for json* build manually
    if all(p.endswith(".txt") for p in files):
        ds = load_dataset("text", data_files={"train": files})["train"]
    else:
        texts: List[str] = []
        for fp in files:
            if fp.endswith(".txt"):
                texts.append(Path(fp).read_text(encoding="utf-8", errors="ignore"))
            else:
                # one json object per line OR a whole json list
                raw = Path(fp).read_text(encoding="utf-8", errors="ignore").strip()
                if not raw:
                    continue
                if "\n{" in raw or raw.startswith("{") and "\n" in raw:
                    # jsonl-like
                    for line in raw.splitlines():
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            obj = json.loads(line)
                            txt = obj.get("text") or obj.get("body") or ""
                            if txt:
                                texts.append(str(txt))
                        except Exception:
                            continue
                else:
                    try:
                        obj = json.loads(raw)
                        if isinstance(obj, list):
                            for item in obj:
                                txt = item.get("text") if isinstance(item, dict) else None
                                if txt:
                                    texts.append(str(txt))
                        elif isinstance(obj, dict):
                            txt = obj.get("text") or obj.get("body")
                            if txt:
                                texts.append(str(txt))
                    except Exception:
                        pass
        ds = Dataset.from_dict({"text": texts})

    return ds


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base_model", default=BASE_MODEL)
    ap.add_argument("--data_dir", required=True)
    ap.add_argument("--output_dir", default="apps/koryxa/training/models/chatlaya-dapt")
    ap.add_argument("--epochs", type=int, default=1)
    ap.add_argument("--lr", type=float, default=2e-5)
    ap.add_argument("--batch_size", type=int, default=1)
    ap.add_argument("--grad_accum", type=int, default=16)
    ap.add_argument("--max_len", type=int, default=MAX_LEN)
    args = ap.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    tokenizer = AutoTokenizer.from_pretrained(args.base_model, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    ds = build_dataset_from_dir(args.data_dir)

    def tok(batch):
        return tokenizer(batch["text"], truncation=True, max_length=args.max_len, return_special_tokens_mask=False)

    tokenized = ds.map(tok, batched=True, remove_columns=ds.column_names)

    # Group texts into blocks of max_len for causal LM
    def group_texts(examples: Dict[str, List[List[int]]]):
        # Concatenate all tokens
        concatenated = {k: sum(examples[k], []) for k in examples.keys()}
        total_len = len(concatenated[list(examples.keys())[0]])
        total_len = (total_len // args.max_len) * args.max_len
        result = {
            k: [t[i : i + args.max_len] for i in range(0, total_len, args.max_len)] for k, t in concatenated.items()
        }
        result["labels"] = result["input_ids"].copy()
        return result

    lm_dataset = tokenized.map(group_texts, batched=True)

    collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

    prec = detect_precision()
    training_args = TrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        fp16=prec["fp16"],
        bf16=prec["bf16"],
        logging_steps=20,
        save_steps=1000,
        save_total_limit=2,
        report_to=["none"],
        optim="adamw_torch",
    )

    model = AutoModelForCausalLM.from_pretrained(args.base_model)

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=lm_dataset,
        data_collator=collator,
    )

    trainer.train()
    trainer.save_model(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)

    # Summary
    def dir_size(p: str) -> str:
        total = 0
        for root, _, files in os.walk(p):
            for f in files:
                try:
                    total += os.path.getsize(os.path.join(root, f))
                except OSError:
                    pass
        mb = total / (1024 * 1024)
        return f"{mb:.1f} MB"

    print("\n=== DAPT Completed ===")
    print(f"Base model: {args.base_model}")
    print(f"Output: {args.output_dir} (size: {dir_size(args.output_dir)})")
    print("Next: run sft_lora.py, then merge_lora.py, then export_gguf.sh for quantization.")


if __name__ == "__main__":
    main()
