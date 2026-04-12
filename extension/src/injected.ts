// Runs in page context to reliably update React/SPA-controlled inputs.

function setComposerValue(target: HTMLElement, value: string): void {
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

window.addEventListener('MAXSEC_SET_COMPOSER', (ev: Event) => {
  const custom = ev as CustomEvent<{ selector: string; value: string }>;
  const detail = custom.detail;
  if (!detail?.selector) return;

  const target = document.querySelector(detail.selector);
  if (!(target instanceof HTMLElement)) return;

  setComposerValue(target, detail.value);
});
