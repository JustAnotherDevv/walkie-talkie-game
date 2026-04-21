#!/usr/bin/env bash
# Invoke Blender headlessly to convert the Factory Modular Kit FBX to a
# Draco-compressed GLB under public/models/. Works on macOS out of the box;
# override BLENDER to point at a different binary if needed.
set -euo pipefail

cd "$(dirname "$0")/.."

BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"

if [[ ! -x "$BLENDER" ]]; then
  echo "Blender binary not found at $BLENDER" >&2
  echo "Override by setting BLENDER=/path/to/blender" >&2
  exit 1
fi

mkdir -p public/models

"$BLENDER" --background --python scripts/convert-factory-kit.py

echo "Wrote public/models/factory_kit.glb"
ls -lh public/models/factory_kit.glb
