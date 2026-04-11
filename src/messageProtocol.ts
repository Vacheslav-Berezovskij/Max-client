export const MAXSEC_PREFIX = '[MAXSEC]';
export const MAXSEC_CURRENT_VERSION = 1;

export interface EncryptedEnvelope {
  version: number;
  type: string;
  sender: string;
  timestamp: number;
  nonce: string;
  ciphertext: string;
  [key: string]: unknown;
}

export type SchemaValidationResult = {
  valid: boolean;
  errors: string[];
};

export type DecodedMessage =
  | { kind: 'plaintext'; plaintext: string }
  | { kind: 'encrypted'; envelope: EncryptedEnvelope }
  | { kind: 'malformed'; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function encodeBase64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function decodeBase64Utf8(input: string): string {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Returns true only for messages carrying the MAXSEC encrypted prefix.
 */
export function isEncryptedMessage(message: string): boolean {
  return typeof message === 'string' && message.startsWith(MAXSEC_PREFIX);
}

/**
 * Validates the required encrypted envelope schema.
 * Additional fields are allowed for forward compatibility.
 */
export function validateMessageSchema(payload: unknown): SchemaValidationResult {
  const errors: string[] = [];

  if (!isRecord(payload)) {
    return { valid: false, errors: ['payload must be an object'] };
  }

  const requiredStringFields: Array<keyof EncryptedEnvelope> = ['type', 'sender', 'nonce', 'ciphertext'];

  if (!Number.isInteger(payload.version) || (payload.version as number) < 1) {
    errors.push('version must be an integer >= 1');
  }

  for (const field of requiredStringFields) {
    if (typeof payload[field] !== 'string' || (payload[field] as string).length === 0) {
      errors.push(`${String(field)} must be a non-empty string`);
    }
  }

  if (typeof payload.timestamp !== 'number' || !Number.isFinite(payload.timestamp) || payload.timestamp <= 0) {
    errors.push('timestamp must be a positive number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Encodes plaintext unchanged, or encrypted envelope with MAXSEC prefix.
 */
export function encodeMessage(input: string | EncryptedEnvelope): string {
  if (typeof input === 'string') {
    return input;
  }

  const validation = validateMessageSchema(input);
  if (!validation.valid) {
    throw new Error(`Invalid encrypted message schema: ${validation.errors.join('; ')}`);
  }

  const json = JSON.stringify(input);
  const base64 = encodeBase64Utf8(json);
  return `${MAXSEC_PREFIX}${base64}`;
}

/**
 * Decodes a message into plaintext/encrypted/malformed variants.
 * Never throws for malformed external input.
 */
export function decodeMessage(message: string): DecodedMessage {
  if (!isEncryptedMessage(message)) {
    return { kind: 'plaintext', plaintext: message };
  }

  const encodedPayload = message.slice(MAXSEC_PREFIX.length);
  if (encodedPayload.length === 0) {
    return { kind: 'malformed', reason: 'missing base64 payload' };
  }

  let parsed: unknown;
  try {
    const json = decodeBase64Utf8(encodedPayload);
    parsed = JSON.parse(json);
  } catch {
    return { kind: 'malformed', reason: 'invalid base64 or JSON payload' };
  }

  const validation = validateMessageSchema(parsed);
  if (!validation.valid) {
    return { kind: 'malformed', reason: validation.errors.join('; ') };
  }

  return { kind: 'encrypted', envelope: parsed as EncryptedEnvelope };
}
