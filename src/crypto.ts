export type IdentityKeyPair = CryptoKeyPair;

const ECDH_CURVE = 'P-256';
const AES_ALGO = 'AES-GCM';
const AES_LENGTH = 256;
const IV_LENGTH_BYTES = 12;

function getCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error('Web Crypto API is not available in this environment');
  }
  return c;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function generateIdentityKeyPair(): Promise<IdentityKeyPair> {
  return getCrypto().subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: ECDH_CURVE,
    },
    true,
    ['deriveBits'],
  );
}

export async function generateSessionKey(): Promise<CryptoKey> {
  return getCrypto().subtle.generateKey(
    {
      name: AES_ALGO,
      length: AES_LENGTH,
    },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const spki = await getCrypto().subtle.exportKey('spki', publicKey);
  return bytesToBase64(new Uint8Array(spki));
}

export async function importPublicKey(spkiBase64: string): Promise<CryptoKey> {
  const spki = base64ToBytes(spkiBase64);
  return getCrypto().subtle.importKey(
    'spki',
    spki,
    {
      name: 'ECDH',
      namedCurve: ECDH_CURVE,
    },
    true,
    [],
  );
}

/**
 * Derives a shared AES-GCM key from an ECDH key agreement using HKDF.
 */
export async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  salt?: Uint8Array,
  info: string = 'max-chat-session-v1',
): Promise<CryptoKey> {
  const sharedBits = await getCrypto().subtle.deriveBits(
    {
      name: 'ECDH',
      public: publicKey,
    },
    privateKey,
    256,
  );

  const hkdfKey = await getCrypto().subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  const keySalt = salt ?? new Uint8Array(32);

  return getCrypto().subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: keySalt,
      info: new TextEncoder().encode(info),
    },
    hkdfKey,
    {
      name: AES_ALGO,
      length: AES_LENGTH,
    },
    false,
    ['encrypt', 'decrypt'],
  );
}

export type EncryptedMessage = {
  iv: string;
  ciphertext: string;
};

export async function encryptMessage(plaintext: string, key: CryptoKey): Promise<EncryptedMessage> {
  const iv = getCrypto().getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await getCrypto().subtle.encrypt(
    {
      name: AES_ALGO,
      iv,
    },
    key,
    encoded,
  );

  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptMessage(payload: EncryptedMessage, key: CryptoKey): Promise<string> {
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);

  const plaintext = await getCrypto().subtle.decrypt(
    {
      name: AES_ALGO,
      iv,
    },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plaintext);
}
