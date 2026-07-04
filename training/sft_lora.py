#!/usr/bin/env python
"""
Supervised Fine-Tuning (SFT) with LoRA adapters on French Q/R pairs.

Input: JSONL at apps/koryxa/training/data/sft_qa/train.jsonl where each line has either:
  {"instruction": "...", "input": "...", "output": "..."}
  or {"question": "...", "answer": "..."}

Usage:
  python apps/koryxa/training/sft_lora.py \
    --base_model apps/koryxa/training/models/chatlaya-dapt \
    --train_file apps/koryxa/training/data/sft_qa/train.jsonl \
    --output_dir apps/koryxa/training/models/chatlaya-lora

Requirements:
  pip install transformers accelerate peft trl datasets sentencepiece
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Dict

import datasets as hfds
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

BASE_MODEL = os.environ.get("BASE_MODEL", "HuggingFaceTB/SmolLM-360M-Instruct")
MAX_LEN = int(os.environ.get("MAX_SEQ_LEN", "1024"))


def detect_precision() -> Dict[str, bool]:
    if not torch.cuda.is_available():
        return {"bf16": False, "fp16": False}
    try:
        bf16_ok = torch.cuda.is_bf16_supported()
    except Exception:
        bf16_ok = False
    return {"bf16": bf16_ok, "fp16": not bf16_ok}


PROMPT_TMPL = (
    "Vous êtes CHATLAYA, un copilote francophone utile et factuel.\n"
    "Instruction: {instruction}\n"
    "Contexte: {input}\n"
    "Réponse:"
)


def build_prompt(ex: Dict[str, str]) -> str:
    if "instruction" in ex:
        instruction = ex.get("instruction", "")
        context = ex.get("input", "")
        target = ex.get("output", "")
    else:
        instruction = ex.get("question", "")
        context = ""
        target = ex.get("answer", "")
    prompt = PROMPT_TMPL.format(instruction=instruction, input=context)
    return prompt + " " + (target or "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base_model", default=BASE_MODEL)
    ap.add_argument("--train_file", required=True)
    ap.add_argument("--output_dir", default="apps/koryxa/training/models/chatlaya-lora")
    ap.add_argument("--epochs", type=int, default=1)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--batch_size", type=int, default=1)
    ap.add_argument("--grad_accum", type=int, default=16)
    ap.add_argument("--lora_r", type=int, default=16)
    ap.add_argument("--lora_alpha", type=int, default=32)
    ap.add_argument("--lora_dropout", type=float, default=0.05)
    args = ap.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    tokenizer = AutoTokenizer.from_pretrained(args.base_model, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    data = hfds.load_dataset("json", data_files={"train": args.train_file})["train"]
    data = data.map(lambda ex: {"text": build_prompt(ex)})

    model = AutoModelForCausalLM.from_pretrained(args.base_model)
    model = prepare_model_for_kbit_training(model)

    lcfg = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=args.lora_dropout,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
    )
    model = get_peft_model(model, lcfg)

    prec = detect_precision()
    targs = TrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        logging_steps=20,
        save_steps=200,
        save_total_limit=2,
        fp16=prec["fp16"],
        bf16=prec["bf16"],
        optim="adamw_torch",
        report_to=["none"],
    )

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=data,
        dataset_text_field="text",
        max_seq_length=MAX_LEN,
        packing=False,
        args=targs,
    )

    trainer.train()
    # Save only LoRA adapters
    model.save_pretrained(args.output_dir)
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

    print("\n=== SFT LoRA Completed ===")
    print(f"Base model: {args.base_model}")
    print(f"Adapters output: {args.output_dir} (size: {dir_size(args.output_dir)})")
    print("Next: run merge_lora.py to merge adapters into base (DAPT). Then export_gguf.sh for quantization.")


if __name__ == "__main__":
    main()
