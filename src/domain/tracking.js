export function makeTrackingToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (value) => value.toString(36).padStart(2, '0')).join('');
  return `trk_${token}`;
}

export function trackingMilestone(status) {
  const map = {
    ready: 'Ready for Dispatch',
    dispatch: 'Dispatched',
    'in-transit': 'In Transit',
    delivery: 'Out for Delivery',
    delivered: 'Delivered',
    exception: 'Exception',
  };
  return map[status] || 'Processing';
}
