function setComposerValue(target, value) {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    target.value = value;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  if (target.isContentEditable) {
    target.textContent = value;
    target.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
  }
}

window.addEventListener('MAXSEC_SET_COMPOSER', (ev) => {
  const detail = ev.detail;
  if (!detail?.selector) return;
  const target = document.querySelector(detail.selector);
  if (!(target instanceof HTMLElement)) return;
  setComposerValue(target, detail.value);
});
