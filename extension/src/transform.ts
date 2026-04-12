import { decodeMessage, encodeMessage, type EncryptedEnvelope } from '../../src/messageProtocol';

export type TransformContext = {
  sender: string;
};

export async function encryptForTransport(plaintext: string, ctx: TransformContext): Promise<string> {
  const envelope: EncryptedEnvelope = {
    version: 1,
    type: 'encrypted',
    sender: ctx.sender,
    timestamp: Date.now(),
    nonce: crypto.randomUUID(),
    ciphertext: btoa(plaintext),
  };

  return encodeMessage(envelope);
}

export async function decryptFromTransport(input: string): Promise<string | null> {
  const decoded = decodeMessage(input);
  if (decoded.kind !== 'encrypted') return null;

  try {
    return atob(decoded.envelope.ciphertext);
  } catch {
    return null;
  }
}
