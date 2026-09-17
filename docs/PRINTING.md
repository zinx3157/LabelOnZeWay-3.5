# LZWay 3.5 Printing

One print service owns all print submission.

## Adapters
1. Cloud Print: authenticated insert into `cloud_print_jobs`.
2. Mac/POS80C bridge: POST to `/api/print` with base64 ESC/POS payload.

## Defaults
- Bridge: `http://192.168.100.14:8765`
- POS80C: `192.168.100.73:9100`

Printer/network settings remain local and are not synchronized to Supabase.

## Automatic mode
If a signed-in workspace exists, Cloud Print is tried first. If cloud submission fails, the local Mac bridge is attempted. Without a signed-in workspace, the bridge is used directly.

There is no UI monkey-patching and no AirPrint dependency in this service.
