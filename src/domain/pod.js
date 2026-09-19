// Electronic proof of delivery: pure record helpers shared by every capture UI.
// Photos are downscaled JPEG data URLs captured in-app; signatures are small PNG
// data URLs. Everything rides on the parcel object, so it persists locally and
// syncs inside the existing parcel payload (no new backend surface).

export const POD_PHOTO_MAX_LENGTH = 160000;      // ~120 KB data-URL budget per photo
export const POD_SIGNATURE_MAX_LENGTH = 60000;   // signature canvases are far smaller

function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildPod({ photo = '', signature = '', lat = null, lng = null, at = new Date().toISOString(), by = '' } = {}) {
  return {
    photo: String(photo || ''),
    signature: String(signature || ''),
    lat: finiteOrNull(lat),
    lng: finiteOrNull(lng),
    at: String(at || ''),
    by: String(by || ''),
  };
}

export function podIssues(pod) {
  if (!pod || typeof pod !== 'object') return ['No proof of delivery recorded'];
  const issues = [];
  if (pod.photo && String(pod.photo).length > POD_PHOTO_MAX_LENGTH) issues.push('Photo exceeds the size budget');
  if (pod.signature && String(pod.signature).length > POD_SIGNATURE_MAX_LENGTH) issues.push('Signature exceeds the size budget');
  if (!pod.photo && !pod.signature && pod.lat == null) issues.push('POD has no photo, signature or position');
  return issues;
}

export function podIsUsable(pod) {
  return podIssues(pod).length === 0;
}

export function podGpsLink(pod) {
  if (pod?.lat == null || pod?.lng == null) return '';
  return `https://www.openstreetmap.org/?mlat=${pod.lat}&mlon=${pod.lng}#map=18/${pod.lat}/${pod.lng}`;
}

export function describePod(pod) {
  if (!pod) return 'No proof of delivery';
  const parts = [];
  if (pod.photo) parts.push('photo');
  if (pod.signature) parts.push('signature');
  if (pod.lat != null && pod.lng != null) parts.push('GPS');
  return `${parts.length ? parts.join(' + ') : 'empty'}${pod.at ? ` · ${pod.at}` : ''}${pod.by ? ` · ${pod.by}` : ''}`;
}
