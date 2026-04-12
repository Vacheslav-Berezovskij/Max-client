import { loadSettings } from '../src/state.js';
import { decryptText, encryptText, getOrCreateIdentityFingerprint } from '../src/cryptoLocal.js';

const plaintextEl = document.getElementById('plaintext');
const ciphertextEl = document.getElementById('ciphertext');
const modeEl = document.getElementById('mode');
const verifyStatusEl = document.getElementById('verifyStatus');
const fingerprintEl = document.getElementById('fingerprint');
const statusEl = document.getElementById('status');

function setStatus(text) {
  statusEl.textContent = text;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus('Copied');
  } catch {
    setStatus('Copy failed');
  }
}

async function initMeta() {
  const settings = await loadSettings();
  modeEl.textContent = settings.defaultMode;

  const stored = await chrome.storage.local.get(['maxsecVerifyStatus']);
  verifyStatusEl.textContent = stored.maxsecVerifyStatus ?? 'unverified';

  fingerprintEl.textContent = await getOrCreateIdentityFingerprint();
}

document.getElementById('encrypt').addEventListener('click', async () => {
  try {
    const plaintext = plaintextEl.value;
    const payload = await encryptText(plaintext);
    ciphertextEl.value = JSON.stringify(payload, null, 2);
    setStatus('Encrypted locally');
  } catch {
    setStatus('Encryption failed');
  }
});

document.getElementById('decrypt').addEventListener('click', async () => {
  try {
    const payload = JSON.parse(ciphertextEl.value);
    const plaintext = await decryptText(payload);
    plaintextEl.value = plaintext;
    setStatus('Decrypted locally');
  } catch {
    setStatus('Decryption failed');
  }
});

document.getElementById('copyCipher').addEventListener('click', async () => {
  await copyText(ciphertextEl.value);
});

document.getElementById('copyPlain').addEventListener('click', async () => {
  await copyText(plaintextEl.value);
});

void initMeta();
