#!/bin/bash
# Download LatentSync weights for GPU lip-sync inference.
# Run this once inside the backend container or on the host before using docker-compose.gpu.yml.
set -e

MODEL_DIR="${LIPSYNC_MODEL_PATH:-/models/lipsync}"

if [ -d "$MODEL_DIR/.git" ]; then
  echo "LatentSync already cloned at $MODEL_DIR, pulling latest…"
  git -C "$MODEL_DIR" pull
else
  echo "Cloning LatentSync into $MODEL_DIR…"
  git clone https://github.com/bytedance/LatentSync "$MODEL_DIR"
fi

cd "$MODEL_DIR"
pip install -r requirements.txt
python scripts/download_weights.py
echo "LatentSync ready at $MODEL_DIR"
