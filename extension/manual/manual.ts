import { loadSettings } from '../src/state';
import { decryptText, encryptText, getOrCreateIdentityFingerprint } from '../src/cryptoLocal';

const plaintextEl = document.getElementById('plaintext') as HTMLTextAreaElement;
const ciphertextEl = document.getElementById('ciphertext') as HTMLTextAreaElement;
const modeEl = document.getElementById('mode') as HTMLElement;
const verifyStatusEl = document.getElementById('verifyStatus') as HTMLElement;
const fingerprintEl = document.getElementById('fingerprint') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;

function setStatus(text: string): void {
  statusEl.textContent = text;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    setStatus('Copied');
  } catch {
    setStatus('Copy failed');
  }
}

async function initMeta(): Promise<void> {
  const settings = await loadSettings();
  modeEl.textContent = settings.defaultMode;

  const stored = await chrome.storage.local.get(['maxsecVerifyStatus']);
  verifyStatusEl.textContent = stored.maxsecVerifyStatus ?? 'unverified';

  fingerprintEl.textContent = await getOrCreateIdentityFingerprint();
}

document.getElementById('encrypt')?.addEventListener('click', async () => {
  try {
    const plaintext = plaintextEl.value;
    const payload = await encryptText(plaintext);
    ciphertextEl.value = JSON.stringify(payload, null, 2);
    setStatus('Encrypted locally');
  } catch {
    setStatus('Encryption failed');
  }
});

document.getElementById('decrypt')?.addEventListener('click', async () => {
  try {
    const payload = JSON.parse(ciphertextEl.value) as { iv: string; ciphertext: string };
    const plaintext = await decryptText(payload);
    plaintextEl.value = plaintext;
    setStatus('Decrypted locally');
  } catch {
    setStatus('Decryption failed');
  }
});

document.getElementById('copyCipher')?.addEventListener('click', async () => {
  await copyText(ciphertextEl.value);
});

document.getElementById('copyPlain')?.addEventListener('click', async () => {
  await copyText(plaintextEl.value);
});

void initMeta();
