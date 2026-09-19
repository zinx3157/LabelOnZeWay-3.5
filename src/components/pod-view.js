// Proof-of-delivery UI pieces shared by tracking, claims and archive.
// Capture is fully local: photo is downscaled in-canvas to protect the
// localStorage budget, signature is a pointer-drawn canvas, GPS is opt-in.
import { buildPod, describePod, podGpsLink, podIssues, POD_PHOTO_MAX_LENGTH } from '../domain/pod.js';
import { action } from './form.js';

export function podViewer(pod) {
  const wrap = document.createElement('div');
  wrap.className = 'pod-viewer';
  if (!pod) {
    const none = document.createElement('small');
    none.className = 'pod-meta';
    none.textContent = 'No proof of delivery captured.';
    wrap.append(none);
    return wrap;
  }
  const thumbs = document.createElement('div');
  thumbs.className = 'pod-thumbs';
  if (pod.photo) {
    const photo = document.createElement('img');
    photo.className = 'pod-thumb';
    photo.src = pod.photo;
    photo.alt = 'Delivery photo';
    thumbs.append(photo);
  }
  if (pod.signature) {
    const signature = document.createElement('img');
    signature.className = 'pod-thumb';
    signature.src = pod.signature;
    signature.alt = 'Customer signature';
    thumbs.append(signature);
  }
  if (thumbs.childElementCount) wrap.append(thumbs);
  const meta = document.createElement('div');
  meta.className = 'pod-meta';
  meta.textContent = describePod(pod);
  wrap.append(meta);
  const issues = podIssues(pod);
  if (issues.length) {
    const warn = document.createElement('small');
    warn.className = 'pod-meta';
    warn.textContent = issues.join(' · ');
    wrap.append(warn);
  }
  const link = podGpsLink(pod);
  if (link) {
    const anchor = document.createElement('a');
    anchor.href = link;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = 'View delivery location';
    wrap.append(anchor);
  }
  return wrap;
}

async function fileToCompressedDataUrl(file, maxSide = 480, quality = 0.5) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the photo'));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const scale = Math.min(1, maxSide / Math.max(image.width || 1, image.height || 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((image.width || 1) * scale));
  canvas.height = Math.max(1, Math.round((image.height || 1) * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  const compressed = canvas.toDataURL('image/jpeg', quality);
  if (compressed.length > POD_PHOTO_MAX_LENGTH) return canvas.toDataURL('image/jpeg', 0.35);
  return compressed;
}

export function createPodCapture({ onSave }) {
  const wrap = document.createElement('div');
  wrap.className = 'pod-panel workspace-card';
  const title = document.createElement('h2');
  title.textContent = 'Capture proof of delivery';
  const status = document.createElement('p');
  status.className = 'pod-meta';
  status.textContent = 'Add at least one of: photo, signature or GPS position.';

  let photo = '';
  let lat = null;
  let lng = null;
  let inked = false;

  const photoInput = document.createElement('input');
  photoInput.type = 'file';
  photoInput.accept = 'image/*';
  photoInput.setAttribute('capture', 'environment');
  photoInput.setAttribute('aria-label', 'Delivery photo');
  const photoPreview = document.createElement('img');
  photoPreview.className = 'pod-thumb';
  photoPreview.alt = 'Delivery photo preview';
  photoPreview.hidden = true;
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    try {
      photo = await fileToCompressedDataUrl(file);
      photoPreview.src = photo;
      photoPreview.hidden = false;
      status.textContent = `Photo ready (${Math.round(photo.length / 1024)} KB).`;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      photoInput.value = '';
    }
  });

  const pad = document.createElement('canvas');
  pad.className = 'pod-signature';
  pad.width = 320;
  pad.height = 120;
  pad.setAttribute('aria-label', 'Customer signature pad');
  const ctx = pad.getContext('2d');
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#101828';
  let drawing = false;
  const point = (event) => {
    const rect = pad.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (pad.width / rect.width), y: (event.clientY - rect.top) * (pad.height / rect.height) };
  };
  pad.addEventListener('pointerdown', (event) => {
    drawing = true;
    inked = true;
    pad.setPointerCapture(event.pointerId);
    const start = point(event);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
  });
  pad.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    const next = point(event);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
  });
  pad.addEventListener('pointerup', () => { drawing = false; });
  pad.addEventListener('pointercancel', () => { drawing = false; });
  const clearPad = action('Clear signature');
  clearPad.addEventListener('click', () => {
    ctx.clearRect(0, 0, pad.width, pad.height);
    inked = false;
  });

  const gpsLine = document.createElement('p');
  gpsLine.className = 'pod-meta';
  gpsLine.textContent = 'GPS: not captured';
  const gps = action('Capture GPS position');
  gps.addEventListener('click', () => {
    if (!navigator.geolocation) {
      gpsLine.textContent = 'GPS: unavailable on this device';
      return;
    }
    gpsLine.textContent = 'GPS: locating…';
    navigator.geolocation.getCurrentPosition(
      (position) => {
        lat = position.coords.latitude;
        lng = position.coords.longitude;
        gpsLine.textContent = `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      },
      (error) => { gpsLine.textContent = `GPS error: ${error.message}`; },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });

  const save = action('Save POD', 'primary');
  save.addEventListener('click', () => {
    const signature = inked ? pad.toDataURL('image/png') : '';
    const pod = buildPod({ photo, signature, lat, lng, by: '' });
    const issues = podIssues(pod);
    if (issues.length) {
      status.textContent = issues.join(' · ');
      return;
    }
    onSave(pod);
  });

  const controls = document.createElement('div');
  controls.className = 'button-row';
  controls.append(gps, clearPad, save);
  wrap.append(title, status, photoInput, photoPreview, pad, gpsLine, controls);
  return { wrap };
}
