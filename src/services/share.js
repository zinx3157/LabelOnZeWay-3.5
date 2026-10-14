import { savedLabelData } from '../domain/label-copy.js?v=52';
import { labelEscPos, bytesToBase64 } from '../domain/escpos.js?v=52';
import { labelPdfBytes } from '../domain/pdf.js?v=52';

function trackingUrl(token) {
  const url = new URL(location.href);
  url.searchParams.set('track', token);
  url.hash = '#/tracking';
  return url.toString();
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

export function createShareService() {
  async function shareParcel(parcel, brand = 'LZWay') {
    if (!parcel?.trackingToken) throw new Error('Tracking token is missing');
    const file = new File([labelPdfBytes(parcel, brand)], `${parcel.pickId || 'label'}.pdf`, { type: 'application/pdf' });
    const secureLink = trackingUrl(parcel.trackingToken);
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title: `${brand} ${parcel.pickId || ''}`.trim(), text: `Track shipment: ${secureLink}`, files: [file] });
      return { mode: 'native', secureLink, fileName: file.name };
    }
    downloadFile(file);
    try { await navigator.clipboard.writeText(secureLink); } catch {}
    return { mode: 'download', secureLink, fileName: file.name };
  }

  function downloadLabelCopy(parcel){const file=new File([labelPdfBytes(savedLabelData(parcel))],`${parcel.pickId||'label'}-copy.pdf`,{type:'application/pdf'});downloadFile(file);return{fileName:file.name};}
  async function reprintLabelCopy(parcel,print){const data=(parcel.labelCopy?.addressLayoutVersion===2?parcel.labelCopy.escposBase64:null)||bytesToBase64(labelEscPos(savedLabelData(parcel),{trackingUrl:trackingUrl(parcel.trackingToken)}));return print.printWithRetry({data,labels:1},{attempts:1});}
  return { shareParcel, trackingUrl,downloadLabelCopy,reprintLabelCopy };
}
