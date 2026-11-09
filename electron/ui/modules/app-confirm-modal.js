// app-confirm-modal.js
// A small in-app yes/no question that hands back a Promise.
//
// It replaces the browser's confirm(): a native confirm()/alert() can open BEHIND the app window and the app then
// looks frozen (the owner has seen this). This one lives inside the page, so it can never hide.
//
// The answer is true ONLY for an explicit "yes". Cancel, Escape, a click on the dark backdrop, a newer question
// replacing this one, or a missing document all answer false - so nothing is installed or changed by accident.
// Text is always set with textContent (a program name with markup stays plain text).

const OVERLAY_ID = 'appConfirmOverlay';
const OVERLAY_STYLE = 'position:fixed;inset:0;z-index:100300;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;padding:20px;';
const CARD_STYLE = 'width:min(460px,94vw);background:#1e293b;border:1px solid #334155;border-radius:14px;padding:22px 24px;box-shadow:0 20px 60px rgba(0,0,0,.5);';
const TITLE_STYLE = 'color:#f1f5f9;font-size:16px;font-weight:800;';
const MESSAGE_STYLE = 'margin:10px 0 0;color:#e2e8f0;font-size:14px;line-height:1.6;';
const DETAIL_STYLE = 'margin:8px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;';
const ACTIONS_STYLE = 'display:flex;justify-content:flex-end;gap:10px;margin-top:20px;';
const NO_STYLE = 'padding:10px 18px;border-radius:10px;border:1px solid #475569;background:transparent;color:#cbd5e1;font-size:13px;font-weight:700;cursor:pointer;';
const YES_STYLE = 'padding:10px 20px;border-radius:10px;border:0;background:linear-gradient(135deg,#93c5fd,#38bdf8);color:#082f49;font-size:13px;font-weight:800;cursor:pointer;';

/** The question that is on screen right now (at most one). */
let open = null;

function textElement(doc, tag, id, style, text) {
  const el = doc.createElement(tag);
  el.id = id;
  el.style.cssText = style;
  el.textContent = text;
  return el;
}

function button(doc, id, style, label) {
  const el = textElement(doc, 'button', id, style, label);
  el.type = 'button';
  return el;
}

/**
 * Asks a yes/no question inside the app.
 * @param {object} opts
 * @param {string} [opts.title]         short heading
 * @param {string} opts.message         the question itself
 * @param {string} [opts.detail]        one short line of what will happen (left out when empty)
 * @param {string} [opts.confirmLabel]  label of the yes button
 * @param {string} [opts.cancelLabel]   label of the no button
 * @param {Document} [opts.doc]         page to draw in (tests pass a fake)
 * @returns {Promise<boolean>} true only for an explicit yes
 */
export function askAppConfirm({
  title = '확인',
  message = '',
  detail = '',
  confirmLabel = '예',
  cancelLabel = '아니요',
  doc = globalThis.document,
} = {}) {
  return new Promise((resolve) => {
    if (!doc || !doc.body || typeof doc.createElement !== 'function') {
      resolve(false);
      return;
    }
    // A newer question wins: the older one is answered "no" and removed, so only one modal is ever on screen.
    if (open) open.settle(false);

    const overlay = doc.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = OVERLAY_STYLE;

    const card = doc.createElement('div');
    card.style.cssText = CARD_STYLE;
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.appendChild(textElement(doc, 'div', 'appConfirmTitle', TITLE_STYLE, String(title)));
    card.appendChild(textElement(doc, 'p', 'appConfirmMessage', MESSAGE_STYLE, String(message)));
    if (detail) card.appendChild(textElement(doc, 'p', 'appConfirmDetail', DETAIL_STYLE, String(detail)));

    const actions = doc.createElement('div');
    actions.style.cssText = ACTIONS_STYLE;
    const no = button(doc, 'appConfirmNo', NO_STYLE, String(cancelLabel));
    const yes = button(doc, 'appConfirmYes', YES_STYLE, String(confirmLabel));
    actions.appendChild(no);
    actions.appendChild(yes);
    card.appendChild(actions);
    overlay.appendChild(card);

    let done = false;
    const onKey = (event) => {
      if (event && event.key === 'Escape') {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        settle(false);
      }
    };
    const settle = (answer) => {
      if (done) return;
      done = true;
      doc.removeEventListener('keydown', onKey, true);
      overlay.remove();
      if (open && open.settle === settle) open = null;
      resolve(answer === true);
    };

    yes.addEventListener('click', () => settle(true));
    no.addEventListener('click', () => settle(false));
    // Only a click on the backdrop itself closes it (a click inside the card does not).
    overlay.addEventListener('click', (event) => { if (event && event.target === overlay) settle(false); });
    doc.addEventListener('keydown', onKey, true);

    open = { settle };
    doc.body.appendChild(overlay);
    if (typeof yes.focus === 'function') yes.focus();
  });
}
