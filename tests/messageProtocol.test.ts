import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAXSEC_PREFIX,
  decodeMessage,
  encodeMessage,
  isEncryptedMessage,
  validateMessageSchema,
} from '../src/messageProtocol.ts';

test('encodeMessage leaves plaintext unchanged', () => {
  const plaintext = 'hello in plaintext';
  assert.equal(encodeMessage(plaintext), plaintext);
});

test('encode/decode encrypted message round trip', () => {
  const envelope = {
    version: 1,
    type: 'encrypted',
    sender: 'alice',
    timestamp: Date.now(),
    nonce: 'abc123',
    ciphertext: 'deadbeef',
    futureField: { ok: true },
  };

  const encoded = encodeMessage(envelope);
  assert.equal(encoded.startsWith(MAXSEC_PREFIX), true);
  assert.equal(isEncryptedMessage(encoded), true);

  const decoded = decodeMessage(encoded);
  assert.equal(decoded.kind, 'encrypted');
  if (decoded.kind === 'encrypted') {
    assert.deepEqual(decoded.envelope, envelope);
  }
});

test('isEncryptedMessage detects prefix only', () => {
  assert.equal(isEncryptedMessage('[MAXSEC]abc'), true);
  assert.equal(isEncryptedMessage('normal message'), false);
});

test('decodeMessage handles malformed prefixed payload safely', () => {
  const decoded = decodeMessage('[MAXSEC]not-valid-base64:::');
  assert.equal(decoded.kind, 'malformed');
});

test('validateMessageSchema rejects missing required fields', () => {
  const invalid = {
    version: 1,
    type: 'encrypted',
    sender: 'alice',
  };

  const result = validateMessageSchema(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test('decodeMessage returns plaintext variant for non-prefixed messages', () => {
  const decoded = decodeMessage('just a normal chat message');
  assert.deepEqual(decoded, { kind: 'plaintext', plaintext: 'just a normal chat message' });
});
