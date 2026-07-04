KORYXA — SmolLM Fine-tuning
============================

Objectif
--------
Continued pretraining (DAPT) + SFT LoRA sur vos données, fusion des poids puis export GGUF (q4_k_m) pour déploiement CPU.

Pré-requis
----------
- Python 3.10+ et pip
- `pip install transformers datasets accelerate sentencepiece peft trl`
- GPU recommandé (bf16 si dispo), sinon CPU (lent).

Arborescence
------------
- `data/dapt_corpus/` — textes .txt/.json/.jsonl
- `data/sft_qa/train.jsonl` — Q/R (instruction/input/output ou question/answer)
- `models/` — sorties DAPT, LoRA, merged, gguf

Étapes
------
1) DAPT (continued pretraining)
```
python apps/koryxa/training/dapt_causal_lm.py \
  --data_dir apps/koryxa/training/data/dapt_corpus \
  --output_dir apps/koryxa/training/models/chatlaya-dapt
```

2) SFT LoRA
```
python apps/koryxa/training/sft_lora.py \
  --base_model apps/koryxa/training/models/chatlaya-dapt \
  --train_file apps/koryxa/training/data/sft_qa/train.jsonl \
  --output_dir apps/koryxa/training/models/chatlaya-lora
```

3) Fusion des poids (LoRA + base/DAPT)
```
python apps/koryxa/training/merge_lora.py \
  --base_model apps/koryxa/training/models/chatlaya-dapt \
  --lora_dir apps/koryxa/training/models/chatlaya-lora \
  --output_dir apps/koryxa/training/models/chatlaya-merged
```

4) Export GGUF + quantification (q4_k_m)
```
# Linux/macOS
bash apps/koryxa/training/export_gguf.sh /path/to/llama.cpp \
  apps/koryxa/training/models/chatlaya-merged \
  apps/koryxa/training/models/gguf

# Windows PowerShell
pwsh -File apps/koryxa/training/export_gguf.ps1 -LlamaCppDir C:\path\to\llama.cpp \
  -SrcDir apps/koryxa/training/models/chatlaya-merged \
  -OutDir apps/koryxa/training/models/gguf
```

Conseils
--------
- Séquence max: 1024 (adapter MAX_SEQ_LEN au besoin).
- bf16 si GPU le supporte, sinon fp16, sinon float32.
- Ajustez `lora_r`, `lora_alpha`, `lr`, `grad_accum` selon la VRAM.

Déploiement llama.cpp (optionnel)
---------------------------------
- Utilisez le fichier GGUF `chatlaya-merged-q4_k_m.gguf`.
- Démarrez un serveur compatible (llama.cpp server ou binding Python) et pointez les endpoints dessus.


