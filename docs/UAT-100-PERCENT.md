# LabelOnZeWay 3.5 — UAT Acceptance Matrix

Automated acceptance is recorded only where exercised on the exact release code. Physical hardware/device checks remain manual gates.

## Automated PASS
- [x] Standalone boot, single router/state layer, reload persistence and architecture guard
- [x] Customer create/reuse/edit, multi-select cleanup, previous-shipment notice and XSS-safe rendering
- [x] Label create/edit, identity preservation, Collect calculation and date-based Pick ID
- [x] OCR parser, Madagascar mobile prefixes, address-noise filters and confirm/edit/skip review workflow
- [x] Manifest rendering, bulk selection and all parcel status transitions
- [x] Status persistence after reload
- [x] Batch dispatch and ESC/POS output generation
- [x] Public read-only tracking, invalid ID and archived tracking behavior
- [x] Anonymous cross-device-style public tracking lookup against Supabase sentinel
- [x] Archive selected/search/restore and reload persistence
- [x] Reconciliation separates merchandise Collect and Delivery Revenue
- [x] JSON backup corruption rejection and backup/restore parity
- [x] Claims Vault create/resolve/reload persistence
- [x] Profile switch data isolation and selected company/profile display
- [x] Safe local profile deletion with protected ps_default fallback
- [x] Supabase schema alignment, RLS-safe RPC contract, active/archive/claims/settings sync contract
- [x] Sync conflict detection prevents silent overwrite of newer local records
- [x] Explicit conflict recovery: Keep local / Push or Use cloud / forced pull
- [x] Root-scope service worker install, offline reload and reconnect acceptance
- [x] PWA cache advanced to shell-v7
- [x] Unified cloud/Mac bridge print adapters, 2.5.4 route fallback and retry contract
- [x] Automated desktop, iPhone portrait/landscape and Android portrait/landscape Chromium matrix
- [x] CI and full browser regression PASS on exact commit before this documentation-only update

## Physical / external gates still required
- [ ] Real Supabase sign-in/session lifecycle with the operator account
- [ ] Authenticated two-device Push/Pull round-trip with real operator data
- [ ] Real iPhone PWA install, camera, PDF/native share, WhatsApp and SMS handoff
- [ ] Real Android PWA install, camera and native share/handoff
- [ ] Representative real-photo OCR accuracy acceptance
- [ ] Mac bridge health from the actual Mac
- [ ] POS80C/OCPP80S physical print at 192.168.100.73:9100
- [ ] 72 mm paper fit, content, multiple consecutive labels, feed and cut
- [ ] Printer disconnect/recovery using the physical printer
- [ ] Physical Mac/iPhone/Android visual acceptance
- [ ] GitHub Pages repository-level enablement (current GitHub integration lacks administration permission)

## Release rule
Production approval requires all machine-testable gates green on one exact code commit plus physical execution of the remaining device/equipment gates. LabelOnZeWay 2.5.4 remains untouched and available as rollback until explicit 3.5 production approval.
