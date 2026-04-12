import { DOM_SELECTORS, queryFirst } from './domSelectors';
import { decryptFromTransport, encryptForTransport } from './transform';
import { loadSettings, saveSettings, type ComposeMode } from './state';
import { isEncryptedMessage } from '../../src/messageProtocol';

const EXTENSION_TAG = 'maxsec-extension';

let currentMode: ComposeMode = 'plaintext';
let extensionEnabled = true;

function injectPageScript(): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('dist/injected.js');
  script.async = false;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function getComposer(): HTMLElement | null {
  return queryFirst(DOM_SELECTORS.composer);
}

function getSendButton(): HTMLButtonElement | null {
  const node = queryFirst(DOM_SELECTORS.sendButton);
  return node instanceof HTMLButtonElement ? node : null;
}

function getComposerText(composer: HTMLElement): string {
  if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) return composer.value;
  return composer.textContent ?? '';
}

function setComposerText(composer: HTMLElement, nextValue: string): void {
  if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
    composer.value = nextValue;
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  const primarySelector = DOM_SELECTORS.composer[0];
  window.dispatchEvent(
    new CustomEvent('MAXSEC_SET_COMPOSER', {
      detail: { selector: primarySelector, value: nextValue },
    }),
  );
}

function showBanner(message: string): void {
  let banner = document.getElementById('maxsec-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'maxsec-banner';
    banner.style.cssText =
      'position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#1f2937;color:#fff;padding:8px 12px;border-radius:8px;font:12px/1.4 sans-serif;';
    document.body.appendChild(banner);
  }
  banner.textContent = message;
  setTimeout(() => banner?.remove(), 5000);
}

async function onBeforeSend(): Promise<void> {
  if (!extensionEnabled || currentMode === 'plaintext') return;

  const composer = getComposer();
  if (!composer) {
    showBanner('MAXSEC: composer not found. Sending plaintext.');
    return;
  }

  const original = getComposerText(composer).trim();
  if (!original) return;

  try {
    const transformed = await encryptForTransport(original, { sender: 'local-user' });
    setComposerText(composer, transformed);
  } catch {
    // Safe fallback: do not block sending and keep plaintext untouched.
    showBanner('MAXSEC: encryption failed. Message left in plaintext.');
  }
}

function markDecrypted(node: HTMLElement, text: string): void {
  if (node.dataset.maxsecProcessed === '1') return;
  node.dataset.maxsecProcessed = '1';

  const badge = document.createElement('span');
  badge.textContent = ' 🔐';
  badge.style.opacity = '0.8';

  node.textContent = text;
  node.appendChild(badge);
}

async function processIncomingMessageNode(messageNode: HTMLElement): Promise<void> {
  if (messageNode.dataset.maxsecScan === '1') return;
  messageNode.dataset.maxsecScan = '1';

  const textNode = queryFirst(DOM_SELECTORS.messageText, messageNode) ?? messageNode;
  const raw = textNode.textContent?.trim() ?? '';

  if (!raw || !isEncryptedMessage(raw)) return;

  const decrypted = await decryptFromTransport(raw);
  if (!decrypted) {
    messageNode.dataset.maxsecError = 'decrypt-failed';
    return;
  }

  markDecrypted(textNode, decrypted);
}

async function scanIncomingMessages(): Promise<void> {
  const seen = new Set<HTMLElement>();
  for (const selector of DOM_SELECTORS.messageItem) {
    const nodes = document.querySelectorAll<HTMLElement>(selector);
    nodes.forEach((n) => seen.add(n));
  }

  await Promise.all(Array.from(seen).map((node) => processIncomingMessageNode(node)));
}

function ensureToggleUI(): void {
  if (document.getElementById('maxsec-toggle')) return;

  const composer = getComposer();
  if (!composer || !composer.parentElement) return;

  const wrap = document.createElement('div');
  wrap.id = 'maxsec-toggle';
  wrap.setAttribute(EXTENSION_TAG, '1');
  wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin:4px 0;font:12px sans-serif;';

  const label = document.createElement('label');
  label.textContent = 'MAXSEC';

  const select = document.createElement('select');
  select.innerHTML = '<option value="plaintext">Plaintext</option><option value="encrypted">Encrypted</option>';
  select.value = currentMode;
  select.addEventListener('change', async () => {
    currentMode = select.value as ComposeMode;
    const settings = await loadSettings();
    await saveSettings({ ...settings, defaultMode: currentMode });
  });

  wrap.append(label, select);
  composer.parentElement.insertBefore(wrap, composer);
}

function setupSendInterception(): void {
  document.addEventListener(
    'click',
    async (event) => {
      const target = event.target as HTMLElement | null;
      const sendButton = getSendButton();
      if (!target || !sendButton) return;

      if (target === sendButton || sendButton.contains(target)) {
        await onBeforeSend();
      }
    },
    true,
  );
}

function setupDomObserver(): void {
  const observer = new MutationObserver(() => {
    try {
      ensureToggleUI();
      void scanIncomingMessages();
    } catch {
      showBanner('MAXSEC: UI changed, running in passive mode.');
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

async function bootstrap(): Promise<void> {
  injectPageScript();

  const settings = await loadSettings();
  extensionEnabled = settings.enabled;
  currentMode = settings.defaultMode;

  if (!extensionEnabled) return;

  ensureToggleUI();
  setupSendInterception();
  setupDomObserver();
  await scanIncomingMessages();
}

void bootstrap();
