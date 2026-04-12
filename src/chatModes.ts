import { decodeMessage, encodeMessage, isEncryptedMessage, type EncryptedEnvelope } from './messageProtocol.ts';

export type ChatMode = 'OFF' | 'READ' | 'SECURE';

const modeByChatId = new Map<string, ChatMode>();
let activeChatId: string | null = null;

function resolveMode(chatId?: string): ChatMode {
  const key = chatId ?? activeChatId;
  if (!key) return 'OFF';
  return modeByChatId.get(key) ?? 'OFF';
}

function tryDecrypt(text: string): string {
  if (!isEncryptedMessage(text)) return text;

  const decoded = decodeMessage(text);
  if (decoded.kind !== 'encrypted') return text;

  try {
    return atob(decoded.envelope.ciphertext);
  } catch {
    return text;
  }
}

function encrypt(text: string, sender = 'local-user'): string {
  const envelope: EncryptedEnvelope = {
    version: 1,
    type: 'encrypted',
    sender,
    timestamp: Date.now(),
    nonce: crypto.randomUUID(),
    ciphertext: btoa(text),
  };

  return encodeMessage(envelope);
}

/**
 * Sets mode for a specific chat and makes it the active chat context.
 */
export function setMode(chatId: string, mode: ChatMode): void {
  modeByChatId.set(chatId, mode);
  activeChatId = chatId;
}

/**
 * Process outgoing text using the active chat mode (or provided chatId mode).
 */
export function processOutgoing(text: string, chatId?: string): string {
  const mode = resolveMode(chatId);

  if (mode === 'OFF' || mode === 'READ') {
    return text;
  }

  if (!text.trim()) return text;

  try {
    return encrypt(text);
  } catch {
    return text;
  }
}

/**
 * Process incoming text using the active chat mode (or provided chatId mode).
 */
export function processIncoming(text: string, chatId?: string): string {
  const mode = resolveMode(chatId);

  if (mode === 'OFF') {
    return text;
  }

  return tryDecrypt(text);
}
