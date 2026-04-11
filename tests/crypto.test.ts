import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptMessage,
  deriveSharedSecret,
  encryptMessage,
  exportPublicKey,
  generateIdentityKeyPair,
  generateSessionKey,
  importPublicKey,
} from '../src/crypto.ts';

test('encrypts and decrypts with a generated session key', async () => {
  const key = await generateSessionKey();
  const message = 'hello max secure world';

  const encrypted = await encryptMessage(message, key);
  const decrypted = await decryptMessage(encrypted, key);

  assert.equal(decrypted, message);
});

test('fails to decrypt with the wrong key', async () => {
  const correctKey = await generateSessionKey();
  const wrongKey = await generateSessionKey();

  const encrypted = await encryptMessage('secret', correctKey);

  await assert.rejects(() => decryptMessage(encrypted, wrongKey));
});

test('derives matching shared keys for both peers', async () => {
  const alice = await generateIdentityKeyPair();
  const bob = await generateIdentityKeyPair();

  const bobPubExported = await exportPublicKey(bob.publicKey);
  const alicePubExported = await exportPublicKey(alice.publicKey);

  const bobPubImported = await importPublicKey(bobPubExported);
  const alicePubImported = await importPublicKey(alicePubExported);

  const salt = new Uint8Array(32);

  const aliceShared = await deriveSharedSecret(alice.privateKey, bobPubImported, salt);
  const bobShared = await deriveSharedSecret(bob.privateKey, alicePubImported, salt);

  const encrypted = await encryptMessage('shared-secret-message', aliceShared);
  const decrypted = await decryptMessage(encrypted, bobShared);

  assert.equal(decrypted, 'shared-secret-message');
});
