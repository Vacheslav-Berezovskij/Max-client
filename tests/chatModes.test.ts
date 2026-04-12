import test from 'node:test';
import assert from 'node:assert/strict';
import { processIncoming, processOutgoing, setMode } from '../src/chatModes.ts';
import { isEncryptedMessage } from '../src/messageProtocol.ts';

test('OFF mode passthrough for outgoing and incoming', () => {
  setMode('chat-off', 'OFF');

  const out = processOutgoing('hello off', 'chat-off');
  const incoming = processIncoming('plain incoming', 'chat-off');

  assert.equal(out, 'hello off');
  assert.equal(incoming, 'plain incoming');
});

test('READ mode only decrypts incoming when possible', () => {
  setMode('chat-read', 'READ');

  const outbound = processOutgoing('do not encrypt', 'chat-read');
  assert.equal(outbound, 'do not encrypt');

  setMode('chat-secure-source', 'SECURE');
  const encrypted = processOutgoing('decrypt me', 'chat-secure-source');
  assert.equal(isEncryptedMessage(encrypted), true);

  const readIncoming = processIncoming(encrypted, 'chat-read');
  assert.equal(readIncoming, 'decrypt me');

  const readPlainIncoming = processIncoming('normal text', 'chat-read');
  assert.equal(readPlainIncoming, 'normal text');
});

test('SECURE mode encrypts outgoing and decrypts incoming', () => {
  setMode('chat-secure', 'SECURE');

  const outgoing = processOutgoing('secret text', 'chat-secure');
  assert.equal(isEncryptedMessage(outgoing), true);

  const incoming = processIncoming(outgoing, 'chat-secure');
  assert.equal(incoming, 'secret text');
});

test('malformed encrypted payload in READ/SECURE returns original text', () => {
  const malformed = '[MAXSEC]%%%invalid%%%';

  setMode('chat-read-malformed', 'READ');
  assert.equal(processIncoming(malformed, 'chat-read-malformed'), malformed);

  setMode('chat-secure-malformed', 'SECURE');
  assert.equal(processIncoming(malformed, 'chat-secure-malformed'), malformed);
});
