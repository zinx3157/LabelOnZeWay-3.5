import { t } from '../domain/i18n.js?v=47';

export function heading(title, description, trailing = null) {
  const wrap = document.createElement('div');
  wrap.className = 'screen-heading';
  const copy = document.createElement('div');
  const h1 = document.createElement('h1');
  h1.textContent = t(title);
  const p = document.createElement('p');
  p.textContent = t(description);
  copy.append(h1, p);
  wrap.append(copy);
  if (trailing) wrap.append(trailing);
  return wrap;
}

export function textStack(lines) {
  const wrap = document.createElement('div');
  lines.forEach(([tag, value, className]) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value ?? '';
    wrap.append(node);
  });
  return wrap;
}
