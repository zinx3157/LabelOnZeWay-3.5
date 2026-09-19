// UI language layer. English is the source language; Malagasy strings are
// looked up by exact source text so call sites stay untouched. Unknown
// strings pass through unchanged, so new screens degrade gracefully to
// English until a translation is added.

const MG = {
  // Navigation
  'Home': 'Fandraisana',
  'New Label': 'Etiketa vaovao',
  'Manifest': 'Lisitra fanaterana',
  'Batch': 'Andiany',
  'Tracking': 'Fanarahana',
  'Customers': 'Mpanjifa',
  'Stock': 'Tahiry',
  'Run Sheet': 'Lalana androany',
  'Archive': 'Arsiva',
  'Claims': 'Fitarainana',
  'Reconciliation': 'Fampifanandraisana',
  'Reports': 'Tatitra',
  'Notify': 'Fampandrenesana',
  'Settlements': 'Fandoavam-bola',
  'Sync Center': 'Foibe fampifanarahana',
  'Profiles': 'Profily',
  'Settings': 'Fandrindrana',
  // Topbar chrome
  'Online': 'Ampifandray',
  'Offline': 'Tsy ampifandray',
  'Light mode': 'Endrika mazava',
  'Dark mode': 'Endrika maizina',
  // Dashboard and stock metrics
  'Active parcels': 'Entana mavitrika',
  'Ready': 'Vondy',
  'In transit': 'Eny an-dalana',
  'Out for delivery': 'Efa alefa',
  'Delivered': 'Vita nalefa',
  'Exceptions': 'Olana',
  'Outstanding Collect': 'Vola mbola andrasana',
  'SKUs': 'SKU',
  'Units on hand': 'Singa eo an-tanana',
  'Low / out': 'Kely / lany',
  'Stock value': 'Vidin-tahiry',
  'Network': 'Aterineto',
  'Sync': 'Fampifanarahana',
  'Open claims': 'Fitarainana misokatra',
  'Stock overview': 'Topimaso tahiry',
  'System readiness': 'Fahavonjana rafitra',
  'Last 7 days': '7 andro farany',
  'Recent movements': 'Hetsika farany',
  // Screen headings and descriptions
  'Operations Dashboard': 'Tabilao fampandehanana',
  'Parcels, collections, stock and system readiness.': 'Entana, fandoavam-bola, tahiry ary fahavonjana ny rafitra.',
  'Prepare and print ready parcels for dispatch.': 'Amboary sy printy ny entana vondy halefa.',
  'Unified operational manifest with bulk status updates.': 'Lisitra fampandehanana iray misy fanavaozana toe-javatra faobe.',
  'Parcel status and customer communication.': 'Toe-javatra entana sy fifandraisana amin\'ny mpanjifa.',
  'Shipment Tracking': 'Fanarahana entana',
  'Read-only shipment status.': 'Toe-javatra entana vakiana ihany.',
  'Select delivered parcels to archive, search history, and restore when needed.': 'Safidio ny entana vita hotahirizina, karohy ny tantara, averina raha ilaina.',
  'Claims Vault': 'Tahirim-pitarainana',
  'Parcel-linked claims, incidents and resolutions.': 'Fitarainana mifandray amin\'ny entana, olana ary vahaolana.',
  'Merchandise Collect and delivery revenue remain separate.': 'Mifanitsy tsara ny vola entana sy ny vola fanaterana.',
  'Exports, backup, recovery and activity audit.': 'Export, backup, famerenana ary fanaraha-maso hetsika.',
  'Company profiles, cloud account, workspace sync and printer status.': 'Profily orinasa, kaonty cloud, fampifanarahana ary toe-pirinty.',
  'Company identity, manifest delivery settings and isolated operational data.': 'Mombamomba orinasa, firindrana manifesty ary angona fampandehanana misaraka.',
  'Stock Management': 'Fitantanana tahiry',
  'Inventory, replenishment and stock movements.': 'Tahiry, famenoana ary fihetsiky ny tahiry.',
  "Today's delivery run: stops in route order with one-tap status.": 'Lalana fanaterana androany: fijanonana araky ny lalana, tsindry iray ny toe-javatra.',
  'Customer Notifications': 'Fampandrenesana mpanjifa',
  'WhatsApp reminders driven by parcel status and aging. Templates sync with the profile.': 'Fampahatsiahivana WhatsApp avy amin\'ny toe-javatra entana. Ny modele dia araka ny profily.',
  'COD Settlements': 'Fandoavam-bola COD',
  'Count courier cash against expected collections, print the sheet, keep the books straight.': 'Isaina ny vola azon\'ny mpitatitra ampitahaina amin\'ny andrasana, printy ny taratasy, marina ny kaonty.',
  'Outbox, conflict review and the devices sharing this workspace.': 'Boaty halefa, fandinihana fifanipohana ary fitaovana mipetraka amin\'ity toerana ity.',
};

let lang = 'en';

export function setLang(next) {
  lang = next === 'mg' ? 'mg' : 'en';
  return lang;
}

export function getLang() {
  return lang;
}

export function t(text) {
  const source = String(text ?? '');
  if (lang !== 'mg') return source;
  return Object.prototype.hasOwnProperty.call(MG, source) ? MG[source] : source;
}

export const TRANSLATED_KEYS = Object.keys(MG);
