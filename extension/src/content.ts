import { DOM_SELECTORS, queryFirst } from './domSelectors';
import { decryptFromTransport, encryptForTransport } from './transform';
import { loadSettings, saveSettings } from './state';
import { isEncryptedMessage } from './messageProtocol';
import { createOverlay, injectOverlayStyles, updateOverlay, type OverlayMode, type OverlayVerificationStatus } from './overlay';

let currentMode: OverlayMode = 'OFF';
let extensionEnabled = true;
let verificationStatus: OverlayVerificationStatus = 'unverified';
let fingerprint = 'UNVERIFIED-PEER';
let warning = '';

function injectPageScript(): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/injected.js');
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
  window.dispatchEvent(new CustomEvent('MAXSEC_SET_COMPOSER', { detail: { selector: primarySelector, value: nextValue } }));
}

function showKeyChangedWarning(): void {
  warning = 'KEY CHANGED';
  verificationStatus = 'unverified';
  updateOverlay({ mode: currentMode, fingerprint, verificationStatus, warning });
}

async function onBeforeSend(): Promise<void> {
  if (!extensionEnabled || currentMode !== 'SECURE') return;

  const composer = getComposer();
  if (!composer) return;

  const original = getComposerText(composer).trim();
  if (!original) return;

  try {
    const transformed = await encryptForTransport(original, { sender: 'local-user' });
    setComposerText(composer, transformed);
  } catch {
    // fail open
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

  if (!raw) return;

  if (raw.includes('KEY CHANGED')) {
    showKeyChangedWarning();
    return;
  }

  if (!isEncryptedMessage(raw)) return;
  if (currentMode === 'OFF') return;

  const decrypted = await decryptFromTransport(raw);
  if (!decrypted) return;

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

function setupSendInterception(): void {
  document.addEventListener(
    'click',
    async (event) => {
      const target = event.target as HTMLElement | null;
      const sendButton = getSendButton();
      if (!target || !sendButton) return;
      if (target === sendButton || sendButton.contains(target)) await onBeforeSend();
    },
    true,
  );

  document.addEventListener(
    'keydown',
    async (event) => {
      if (event.key !== 'Enter' || event.shiftKey) return;
      const composer = getComposer();
      const target = event.target as HTMLElement | null;
      if (!composer || !target) return;
      if (target === composer || composer.contains(target)) {
        await onBeforeSend();
      }
    },
    true,
  );
}

function ensureOverlay(): void {
  injectOverlayStyles();
  createOverlay({
    mode: currentMode,
    fingerprint,
    verificationStatus,
    onModeChange: async (nextMode) => {
      currentMode = nextMode;
      const settings = await loadSettings();
      await saveSettings({ ...settings, defaultMode: nextMode });
      updateOverlay({ mode: currentMode, fingerprint, verificationStatus, warning });
    },
    onVerify: () => {
      verificationStatus = 'verified';
      warning = '';
      updateOverlay({ mode: currentMode, fingerprint, verificationStatus, warning });
    },
  });

  updateOverlay({ mode: currentMode, fingerprint, verificationStatus, warning });
}

function setupDomObserver(): void {
  const observer = new MutationObserver(() => {
    try {
      ensureOverlay();
      void scanIncomingMessages();
    } catch {
      // passive fallback
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
  currentMode = settings.defaultMode ?? 'OFF';

  if (!extensionEnabled) return;

  ensureOverlay();
  setupSendInterception();
  setupDomObserver();
  await scanIncomingMessages();
}

void bootstrap();
