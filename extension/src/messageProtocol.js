export const MAXSEC_PREFIX = '[MAXSEC]';

function encodeBase64Utf8(input) {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function decodeBase64Utf8(input) {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function isEncryptedMessage(message) {
  return typeof message === 'string' && message.startsWith(MAXSEC_PREFIX);
}

export function validateMessageSchema(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['payload must be an object'] };
  }

  if (!Number.isInteger(payload.version) || payload.version < 1) errors.push('version must be an integer >= 1');

  for (const field of ['type', 'sender', 'nonce', 'ciphertext']) {
    if (typeof payload[field] !== 'string' || payload[field].length === 0) {
      errors.push(`${field} must be a non-empty string`);
    }
  }

  if (typeof payload.timestamp !== 'number' || !Number.isFinite(payload.timestamp) || payload.timestamp <= 0) {
    errors.push('timestamp must be a positive number');
  }

  return { valid: errors.length === 0, errors };
}

export function encodeMessage(input) {
  if (typeof input === 'string') return input;

  const validation = validateMessageSchema(input);
  if (!validation.valid) throw new Error(`Invalid encrypted message schema: ${validation.errors.join('; ')}`);

  return `${MAXSEC_PREFIX}${encodeBase64Utf8(JSON.stringify(input))}`;
}

export function decodeMessage(message) {
  if (!isEncryptedMessage(message)) return { kind: 'plaintext', plaintext: message };

  const payload = message.slice(MAXSEC_PREFIX.length);
  if (!payload) return { kind: 'malformed', reason: 'missing base64 payload' };

  let parsed;
  try {
    parsed = JSON.parse(decodeBase64Utf8(payload));
  } catch {
    return { kind: 'malformed', reason: 'invalid base64 or JSON payload' };
  }

  const validation = validateMessageSchema(parsed);
  if (!validation.valid) return { kind: 'malformed', reason: validation.errors.join('; ') };

  return { kind: 'encrypted', envelope: parsed };
}
