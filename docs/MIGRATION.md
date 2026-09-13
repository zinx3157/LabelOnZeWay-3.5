# LabelOnZeWay 3.5 — Migration Contract

## Baseline
LabelOnZeWay 2.5.4 remains in the separate `zinx3157/FBP` repository as the protected production/reference baseline. Version 3.5 is rebuilt independently in this repository.

## KEEP — operational capabilities
- Authentication and user session
- Company/profile/workspace context
- Customer/address book management
- Customer autocomplete and contact extraction
- Label creation, editing, saving and label preview
- Photo/OCR-assisted address and phone extraction
- Date-based Pick ID behavior
- Quantity, unit price and Collect calculation
- Batch operations
- Manifest workflow and status management
- Bulk parcel selection/status updates
- Tracking and public read-only tracking
- Archive and in-app archive access
- Reconciliation and financial totals
- Backup/restore where applicable
- Supabase cloud persistence/synchronization
- Online/offline and sync-conflict awareness
- PDF/share/WhatsApp/SMS integration points
- Cloud print
- Mac bridge / direct ESC/POS POS80C printing
- PWA/iPhone, Android and Mac deployment targets

## REBUILD — do not copy implementation
- Application bootstrap
- Navigation/router
- Application state/store
- Responsive layout
- Design system
- Customer workflow UI
- Label workflow UI
- Manifest UI/data presentation
- Batch UI
- Reconciliation calculations/view
- Auth/session lifecycle
- Cloud sync lifecycle
- Print lifecycle and adapters
- Offline queue
- Error/retry handling
- Automated QA and release pipeline

## DROP — legacy implementation patterns
- Runtime fetching/writing of an older application HTML
- Overlay/hotfix architecture
- Multiple competing navigation controllers
- Multiple independent `currentView` states
- Capture-phase click interception used to repair navigation
- MutationObserver-based UI repair loops
- Arbitrary timer/retry sequences used to repair rendering
- Inline `!important` state manipulation
- Duplicate desktop/mobile business logic
- Multiple final/fix/hotfix design variants
- Obsolete UAT design patches and temporary trigger files
- Visible Qwen UI

## Compatibility rule
No legacy source file is migrated merely because it exists. A capability is migrated only after its behavior, data contract and acceptance test are defined.

## Production safety
No 3.5 development commit is to modify the `zinx3157/FBP` repository. Version 2.5.4 remains available until 3.5 passes regression/UAT and is explicitly approved as its replacement.
