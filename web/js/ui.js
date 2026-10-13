// Small DOM helpers: element builder, modal panel, toasts.

/**
 * h('div', {class: 'x', onclick: fn}, child, 'text', [more]) -> HTMLElement
 * Strings are inserted as text (never as HTML) unless passed through html().
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    if (c instanceof Node) el.appendChild(c);
    else if (c && c.__html != null) {
      const t = document.createElement('template');
      t.innerHTML = c.__html;
      el.appendChild(t.content);
    } else el.appendChild(document.createTextNode(String(c)));
  }
}

/** Mark a trusted, developer-authored HTML string (e.g. generated SVG) for insertion. */
export function html(str) { return { __html: str }; }

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export const $ = (sel, root = document) => root.querySelector(sel);

// ---------- modal panel ----------
let modalStack = [];

export function isModalOpen() { return modalStack.length > 0; }

/**
 * Open a modal panel. Returns {body, close, setTitle}. `onClose` runs when the panel closes.
 * Options: {title, subtitle, wide, closable (default true), onClose}
 */
export function openModal({ title, subtitle, wide = false, closable = true, onClose, className = '' } = {}) {
  const root = document.getElementById('modal-root');
  const lastFocus = document.activeElement;
  const titleEl = h('h2', { id: `modal-title-${modalStack.length}` }, title || '');
  const sub = h('p', { class: 'modal-sub' }, subtitle || '');
  const closeBtn = closable ? h('button', { class: 'icon-btn modal-close', 'aria-label': 'Close panel', title: 'Close (Esc)' }, '✕') : null;
  const body = h('div', { class: 'modal-body' });
  const dialog = h('div', { class: `modal ${wide ? 'wide' : ''} ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleEl.id },
    h('header', { class: 'modal-head' }, h('div', null, titleEl, subtitle ? sub : null), closeBtn),
    body);
  const overlay = h('div', { class: 'overlay' }, dialog);
  root.appendChild(overlay);
  const entry = {
    body, overlay, closable,
    close() {
      if (!overlay.isConnected) return;
      overlay.remove();
      modalStack = modalStack.filter((m) => m !== entry);
      if (onClose) onClose();
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    },
    setTitle(t) { titleEl.textContent = t; },
  };
  if (closeBtn) closeBtn.addEventListener('click', () => entry.close());
  modalStack.push(entry);
  setTimeout(() => (dialog.querySelector('button:not(.modal-close), input, select') || closeBtn || dialog).focus(), 30);
  return entry;
}

export function closeTopModal() {
  const top = modalStack[modalStack.length - 1];
  if (top && top.closable) { top.close(); return true; }
  return false;
}

export function closeAllModals() { [...modalStack].reverse().forEach((m) => m.close()); }

// ---------- toasts ----------
export function toast(message, kind = 'info', ms = 3200) {
  const root = document.getElementById('toast-root');
  const t = h('div', { class: `toast ${kind}`, role: 'status' }, message);
  root.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms);
}

export function fmt(n, dp = 1) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function fmtInt(n) { return Math.round(n).toLocaleString(); }

export function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Append children (nested arrays are flattened; null/false skipped). Returns the element. */
export function put(el, ...children) { append(el, children); return el; }
