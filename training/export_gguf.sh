#!/usr/bin/env bash
set -euo pipefail

# Convert merged HF model to GGUF and quantize for CPU inference (llama.cpp)
# Requirements:
#   - git clone https://github.com/ggerganov/llama.cpp
#   - Python deps for convert: pip install -r llama.cpp/requirements.txt
# Usage:
#   bash apps/koryxa/training/export_gguf.sh /path/to/llama.cpp \
#        apps/koryxa/training/models/smollm-merged apps/koryxa/training/models/gguf

LLAMA_CPP_DIR=${1:-"./llama.cpp"}
SRC_DIR=${2:-"apps/koryxa/training/models/smollm-merged"}
OUT_DIR=${3:-"apps/koryxa/training/models/gguf"}

mkdir -p "$OUT_DIR"

echo "[1/3] Converting HF -> GGUF"
python3 "$LLAMA_CPP_DIR"/convert_hf_to_gguf.py \
  --outfile "$OUT_DIR/smollm-merged-fp16.gguf" \
  --outtype f16 \
  "$SRC_DIR"

echo "[2/3] Building llama.cpp quantize (if not built)"
if [ ! -x "$LLAMA_CPP_DIR/quantize" ]; then
  make -C "$LLAMA_CPP_DIR" quantize
fi

echo "[3/3] Quantizing to q4_k_m (CPU-friendly)"
"$LLAMA_CPP_DIR"/quantize \
  "$OUT_DIR/smollm-merged-fp16.gguf" \
  "$OUT_DIR/smollm-merged-q4_k_m.gguf" \
  q4_k_m

echo "\n=== Export Completed ==="
du -h "$OUT_DIR" || true
echo "Next: load the q4_k_m GGUF with llama.cpp or another compatible runtime."
