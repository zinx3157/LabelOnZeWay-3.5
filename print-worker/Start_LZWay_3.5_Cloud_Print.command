#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
CONFIG="cloud-print-worker.json"
if [ ! -f "$CONFIG" ]; then
  cp cloud-print-worker.example.json "$CONFIG"
  echo "Created $CONFIG. Fill workspace_id and email, then run again."
  exit 1
fi
if [ -z "${LZWAY_CLOUD_PASSWORD:-}" ]; then
  echo "Set LZWAY_CLOUD_PASSWORD before starting the print worker."
  exit 1
fi
exec python3 lzway_cloud_print_worker.py --config "$CONFIG"
