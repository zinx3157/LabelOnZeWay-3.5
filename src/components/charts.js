// Dependency-free inline SVG charts. Nodes are built with createElementNS
// (no markup strings) so the architecture guard stays happy and the service
// worker can cache them like any other shell file.

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(name, attrs = {}, text = null) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== null && text !== '') node.textContent = String(text);
  return node;
}

// series: [{ label, value }] — vertical bars with value + tick labels.
export function barChart(series = [], { label = '', format = (value) => String(value) } = {}) {
  const width = 320;
  const height = 150;
  const pad = 8;
  const bottom = 24;
  const max = Math.max(1, ...series.map((item) => Number(item.value) || 0));
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart-svg', role: 'img', 'aria-label': label || 'Bar chart' });
  const slot = (width - pad * 2) / Math.max(1, series.length);
  series.forEach((item, index) => {
    const value = Number(item.value) || 0;
    const barHeight = Math.round((height - bottom - pad) * (value / max));
    const x = Math.round(pad + index * slot + slot * 0.18);
    const y = height - bottom - barHeight;
    svg.append(svgEl('rect', { x, y, width: Math.max(6, Math.round(slot * 0.64)), height: Math.max(2, barHeight), rx: 3, class: 'chart-bar' }));
    svg.append(svgEl('text', { x: Math.round(pad + index * slot + slot / 2), y: height - bottom + 14, 'text-anchor': 'middle', class: 'chart-tick' }, item.label));
    if (value > 0) svg.append(svgEl('text', { x: Math.round(pad + index * slot + slot / 2), y: Math.max(pad + 6, y - 4), 'text-anchor': 'middle', class: 'chart-value' }, format(value)));
  });
  return svg;
}

// values: [number] — compact trend line for money series.
export function sparkline(values = [], { label = '' } = {}) {
  const width = 320;
  const height = 64;
  const pad = 6;
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = pad + (width - pad * 2) * (values.length > 1 ? index / (values.length - 1) : 0.5);
    const y = height - pad - (height - pad * 2) * ((Number(value) || 0) - min) / span;
    return `${Math.round(x)},${Math.round(y)}`;
  }).join(' ');
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart-svg chart-spark', role: 'img', 'aria-label': label || 'Trend line' });
  svg.append(svgEl('polyline', { points, class: 'chart-line', fill: 'none' }));
  values.forEach((value, index) => {
    const [x, y] = points.split(' ')[index].split(',');
    svg.append(svgEl('circle', { cx: x, cy: y, r: 2.5, class: 'chart-dot' }));
  });
  return svg;
}
