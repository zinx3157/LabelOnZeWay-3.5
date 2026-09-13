# LabelOnZeWay 3.5 — 100% UAT Acceptance Matrix

This document is the release gate. LabelOnZeWay 3.5 is not production-approved until every mandatory item is PASS. Automated checks cover deterministic software behavior; hardware and physical-device checks require real equipment/device execution and must be recorded honestly.

## A. Application startup and navigation
- [x] Standalone boot with no dependency on LabelOnZeWay 2.5.4
- [x] One application router/state layer
- [x] Desktop navigation loop
- [x] Mobile navigation loop
- [x] Repeated route switching without state corruption
- [x] Reload restores a valid application state
- [x] No legacy document.write / runtime HTML injection
- [x] No innerHTML assignments in application source

## B. Customer / Address Book
- [x] Create customer
- [x] Reuse saved customer
- [x] Customer data renders as text, not executable markup
- [x] Phone/address fields supported
- [x] OCR-assisted contact extraction service present
- [x] Madagascar mobile prefixes supported: 032/033/034/035/037/038/039
- [x] Address-noise filtering rules covered by automated tests
- [ ] Edit saved customer — full UI acceptance
- [ ] Multi-select customer deletion / address-book cleanup — full UI acceptance
- [ ] Existing-customer previous-shipment notice — full UI acceptance

## C. New Label workflow
- [x] Customer -> Parcel -> Review workflow
- [x] Quantity input
- [x] Unit price input
- [x] Collect = quantity × unit price
- [x] Date-based Pick ID generation
- [x] Label save
- [x] Label preview
- [x] Saved parcel appears in operational state
- [x] Malicious customer text cannot execute markup
- [ ] Edit previously created label from UI — full acceptance
- [ ] Confirm delivered/printed prior-shipment warning workflow
- [ ] Native PDF/share attachment flow on real iPhone

## D. OCR / Photo capture
- [x] OCR module is lazy-loaded
- [x] Contact parser automated tests
- [x] Madagascar phone-prefix parser tests
- [x] Noise-word filtering tests
- [ ] Real iPhone camera capture test
- [ ] Real Android camera capture test
- [ ] Real photograph OCR accuracy acceptance with representative address samples
- [ ] OCR overlay / confirm-edit-skip UX acceptance

## E. Manifest
- [x] Manifest displays saved parcels
- [x] Bulk parcel selection/status update logic
- [x] Shared financial model with Reconciliation
- [x] Browser regression exercises Manifest
- [ ] Compact mode visual acceptance
- [ ] Edit-All mode visual acceptance
- [ ] Mac/tablet/iPhone/Android responsive column acceptance
- [ ] 80 mm / 72 mm thermal manifest print acceptance
- [ ] A4 manifest output acceptance
- [ ] Close/Archive operational acceptance

## F. Batch
- [x] Ready parcel count
- [x] Dispatch-ready bulk action
- [x] Shared status model with Manifest
- [ ] Batch print/output acceptance
- [ ] Batch reopen/recovery acceptance

## G. Parcel status lifecycle
- [x] Ready
- [x] Dispatch
- [x] Status update domain model
- [ ] In Transit full UI acceptance
- [ ] Delivery full UI acceptance
- [ ] Exception full UI acceptance
- [ ] Multi-select status update acceptance across all statuses
- [ ] Status persistence after reload

## H. Tracking
- [x] Tracking module present
- [x] Saved parcel can be resolved in app
- [x] Browser smoke coverage
- [ ] Public read-only tracking URL acceptance
- [ ] Invalid tracking ID behavior
- [ ] Archived parcel tracking behavior
- [ ] Cross-device tracking validation

## I. Messaging
- [x] WhatsApp action present
- [x] SMS action present
- [x] Customer-reminder integration point present
- [ ] Real iPhone WhatsApp handoff
- [ ] Real Android WhatsApp handoff
- [ ] Real SMS handoff
- [ ] Malagasy/French status-message content acceptance

## J. Archive
- [x] Archive exists inside app
- [x] Browser route smoke coverage
- [ ] Archive selected parcels
- [ ] Restore/reopen archived record if supported
- [ ] Archived data persists after reload/cloud round-trip
- [ ] Archive search/filter acceptance

## K. Reconciliation / Finance
- [x] One reconciliation calculation model
- [x] Parcel count
- [x] Quantity total
- [x] Total Collect
- [x] Delivered Collect
- [x] Outstanding Collect
- [x] Automated regression coverage
- [ ] Representative production-like manifest financial reconciliation
- [ ] Export/reopen totals match exactly

## L. Dashboard / Reports
- [x] Dashboard metrics implemented
- [x] CSV manifest export implemented
- [x] JSON backup implemented
- [x] Validated JSON restore implemented
- [ ] CSV opens correctly in Numbers/Excel with representative data
- [ ] Backup -> clear/reload -> restore -> parity validation
- [ ] Reports visual/financial acceptance

## M. Profiles / Company / Workspace
- [x] Workspace/profile selector implemented
- [x] Supabase workspace discovery implemented
- [ ] Selected company/profile displays correctly throughout app
- [ ] Profile switch preserves/separates intended data
- [ ] Delegation/role behavior acceptance if enabled

## N. Authentication
- [x] Supabase auth service implemented
- [x] Explicit session lifecycle
- [x] Sign-out control
- [ ] Real sign-in with production/UAT user
- [ ] Bad-password behavior
- [ ] Expired-session behavior
- [ ] Reload with active session
- [ ] Sign-out clears protected cloud state

## O. Cloud Sync / Supabase
- [x] Current Supabase schema inspected
- [x] Required sync fields aligned, including modified_at/device_id
- [x] RLS-safe write path uses apply_sync_changes RPC
- [x] Pull/Push controls implemented
- [ ] Real user: create local record -> Push -> verify Supabase
- [ ] Second browser/device -> Pull -> identical record
- [ ] Modify on device A -> sync -> device B parity
- [ ] Offline create -> reconnect -> successful sync
- [ ] Sync conflict indicator/recovery acceptance
- [ ] Archive and status changes round-trip correctly

## P. Offline / PWA
- [x] Web app manifest implemented
- [x] Service worker implemented
- [ ] Install as PWA on real iPhone
- [ ] Launch from iPhone Home Screen
- [ ] Install/launch on real Android
- [ ] Offline startup with previously cached app
- [ ] Offline operational queue acceptance
- [ ] Reconnect and sync acceptance
- [ ] iPhone portrait/landscape physical-device acceptance
- [ ] Android portrait/landscape physical-device acceptance

## Q. Printing
- [x] Unified print service architecture
- [x] Cloud Print adapter
- [x] Mac bridge/POS80C adapter
- [x] ESC/POS label payload generation
- [x] Failed-job/retry model foundation
- [ ] Bridge health from real Mac
- [ ] Real POS80C print on 192.168.100.73:9100
- [ ] Correct 72 mm printable width
- [ ] Correct customer/address/Pick ID/Collect content
- [ ] Multiple consecutive labels
- [ ] Printer cut behavior
- [ ] Printer unavailable -> clear failure status
- [ ] Retry after printer recovery
- [ ] Cloud Print end-to-end real job acceptance

## R. Responsive / Browser Matrix
- [x] Automated desktop Chromium regression
- [x] Automated phone-sized Chromium regression
- [x] Repeated navigation loops
- [x] Core workflow loop
- [ ] Physical Mac Chrome/Safari visual acceptance
- [ ] Physical iPhone Safari/PWA visual acceptance
- [ ] Physical Android Chrome/PWA visual acceptance
- [ ] Landscape on physical iPhone
- [ ] Landscape on physical Android
- [ ] No overlap, clipped controls, inaccessible buttons or unwanted white backgrounds

## S. Security / Reliability
- [x] No innerHTML assignments in application source
- [x] Customer text XSS regression
- [x] Architecture guard rejects legacy repair patterns
- [x] Domain tests pass
- [x] Chromium regression passes
- [ ] Auth/session edge-case acceptance
- [ ] Failed network request recovery
- [ ] Failed cloud sync recovery
- [ ] Failed print recovery
- [ ] Backup corruption rejection

## T. Deployment
- [x] Independent GitHub repository
- [x] CI workflow
- [x] Browser regression workflow
- [x] Pages deployment workflow prepared
- [ ] GitHub Pages enabled at repository/account level
- [ ] Public UAT URL live
- [ ] UAT URL tested on Mac/iPhone/Android
- [ ] Final UAT build tagged/frozen

## Release rule
Production approval requires:
1. Every automated mandatory item green on one exact commit.
2. Every hardware/device mandatory item manually executed on the actual target device/equipment and recorded PASS.
3. No Severity-1 or Severity-2 defect open.
4. 2.5.4 remains available as rollback until explicit 3.5 production approval.

## Current interpretation
Automated software testing can reach 100% of the machine-testable acceptance matrix. It cannot honestly certify physical POS80C output/cutting, iOS/Android device behavior, camera OCR quality, WhatsApp/SMS handoff, or live cross-device cloud behavior without executing those real environments.
