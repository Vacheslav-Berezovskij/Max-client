const STORAGE_KEY = 'maxsecManualSessionKeyJwk';
const IDENTITY_KEY = 'maxsecManualIdentityJwk';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getOrCreateSessionKey(): Promise<CryptoKey> {
  const stored = await chrome.storage.local.get([STORAGE_KEY]);
  if (stored[STORAGE_KEY]) {
    return crypto.subtle.importKey('jwk', stored[STORAGE_KEY], { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const jwk = await crypto.subtle.exportKey('jwk', key);
  await chrome.storage.local.set({ [STORAGE_KEY]: jwk });
  return key;
}

export async function encryptText(plaintext: string): Promise<{ iv: string; ciphertext: string }> {
  const key = await getOrCreateSessionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptText(payload: { iv: string; ciphertext: string }): Promise<string> {
  const key = await getOrCreateSessionKey();
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}

export async function getOrCreateIdentityFingerprint(): Promise<string> {
  const stored = await chrome.storage.local.get([IDENTITY_KEY]);
  let pubJwk = stored[IDENTITY_KEY]?.public;
  let privateJwk = stored[IDENTITY_KEY]?.private;

  if (!pubJwk || !privateJwk) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    pubJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    await chrome.storage.local.set({ [IDENTITY_KEY]: { public: pubJwk, private: privateJwk } });
  }

  const publicKey = await crypto.subtle.importKey('jwk', pubJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  const digest = await crypto.subtle.digest('SHA-256', spki);
  return bytesToHex(new Uint8Array(digest));
}
