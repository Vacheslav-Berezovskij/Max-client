import { decodeMessage, encodeMessage } from './messageProtocol.js';

export async function encryptForTransport(plaintext, ctx) {
  const envelope = {
    version: 1,
    type: 'encrypted',
    sender: ctx.sender,
    timestamp: Date.now(),
    nonce: crypto.randomUUID(),
    ciphertext: btoa(plaintext)
  };

  return encodeMessage(envelope);
}

export async function decryptFromTransport(input) {
  const decoded = decodeMessage(input);
  if (decoded.kind !== 'encrypted') return null;
  try {
    return atob(decoded.envelope.ciphertext);
  } catch {
    return null;
  }
}
