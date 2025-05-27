#!/bin/bash
set -e

if [ -z "$VOICE" ]; then
  echo "Error: VOICE is not set"
  exit 1
fi

if [ -z "$TEXT" ]; then
  echo "Error: TEXT is not set"
  exit 1
fi

echo "Generating speech for voice: $VOICE"

python3 /app/generate.py "$TEXT" "$VOICE"

echo "Synthesis complete"
