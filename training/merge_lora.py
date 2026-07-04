#!/usr/bin/env python
"""
Merge LoRA adapters into the base (optionally DAPT) model to produce a plain HF model.

Usage:
  python apps/koryxa/training/merge_lora.py \
    --base_model apps/koryxa/training/models/chatlaya-dapt \
    --lora_dir apps/koryxa/training/models/chatlaya-lora \
    --output_dir apps/koryxa/training/models/chatlaya-merged

Requirements:
  pip install transformers peft
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base_model", default="apps/koryxa/training/models/chatlaya-dapt")
    ap.add_argument("--lora_dir", default="apps/koryxa/training/models/chatlaya-lora")
    ap.add_argument("--output_dir", default="apps/koryxa/training/models/chatlaya-merged")
    args = ap.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    # Load base (DAPT or hub)
    base = args.base_model if Path(args.base_model).exists() else "HuggingFaceTB/SmolLM-360M-Instruct"
    model = AutoModelForCausalLM.from_pretrained(base, torch_dtype=torch.float32)
    model = PeftModel.from_pretrained(model, args.lora_dir)

    # Merge LoRA weights and unload PEFT layers
    model = model.merge_and_unload()

    tokenizer = AutoTokenizer.from_pretrained(base, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)

    # Print size summary
    total = 0
    for root, _, files in os.walk(args.output_dir):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    print("\n=== Merge Completed ===")
    print(f"Merged model saved to: {args.output_dir}  (size: {total/1024/1024:.1f} MB)")
    print("Next: run export_gguf.sh (or .ps1) to convert to GGUF and quantize.")


if __name__ == "__main__":
    main()
