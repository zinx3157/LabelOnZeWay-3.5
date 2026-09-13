export function field(label, name, value = '', options = {}) {
  const wrap = document.createElement('label');
  wrap.className = 'field';
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement(options.multiline ? 'textarea' : 'input');
  input.name = name;
  input.value = value ?? '';
  if (!options.multiline) input.type = options.type || 'text';
  if (options.inputmode) input.inputMode = options.inputmode;
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.min != null) input.min = String(options.min);
  wrap.append(span, input);
  return { wrap, input };
}

export function action(label, kind = 'secondary') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `button button-${kind}`;
  button.textContent = label;
  return button;
}
