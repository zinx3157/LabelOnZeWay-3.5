# LZWay 3.5

LZWay 3.5 is an offline-first logistics operations workspace: label creation with OCR-assisted address
capture, manifests, batch dispatch, thermal (ESC/POS) and cloud printing, public shipment tracking,
reconciliation, claims and stock management.

Published previously under the LabelOnZeWay brand. Local data from that brand (storage key
`labelonzeway.3.5.state.v1`) is migrated automatically on first run and mirrored until 3.6 so a
rollback build keeps working.

- Develop: `python3 -m http.server 4173` then open `http://127.0.0.1:4173/?test=1`
- Test: `npm test` (structure + architecture guards + unit tests); browser suites in `tests/` need Playwright
- Docs: `docs/MIGRATION.md` (keep/rebuild/drop contract), `docs/PRINTING.md`, `docs/UAT-100-PERCENT.md`,
  `docs/migrations/` (Supabase schema changes)
- Cloud print worker: `print-worker/Start_LZWay_3.5_Cloud_Print.command` (requires `LZWAY_CLOUD_PASSWORD`)
