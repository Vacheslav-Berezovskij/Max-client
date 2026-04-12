import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthenticatedHandshakeMachine, InMemoryPeerStore } from '../src/authenticatedHandshake.ts';

test('first contact stores peer as unverified after authenticated handshake', async () => {
  const alice = await AuthenticatedHandshakeMachine.create('alice');
  const bobStore = new InMemoryPeerStore();
  const bob = await AuthenticatedHandshakeMachine.create('bob', bobStore);

  const hello = await alice.initiateHandshake();
  const result = await bob.receiveHandshake(hello);

  assert.ok(result.sessionKey);
  assert.equal(bob.state, 'established_unverified');

  const peer = bob.getPeer('alice');
  assert.ok(peer);
  assert.equal(peer?.verificationStatus, 'unverified');
});

test('manual fingerprint verification upgrades status to verified', async () => {
  const alice = await AuthenticatedHandshakeMachine.create('alice');
  const bob = await AuthenticatedHandshakeMachine.create('bob');

  const hello = await alice.initiateHandshake();
  await bob.receiveHandshake(hello);

  bob.markPeerVerified('alice');

  assert.equal(bob.state, 'established_verified');
  assert.equal(bob.getPeer('alice')?.verificationStatus, 'verified');
});

test('identity key change triggers KEY CHANGED warning', async () => {
  const aliceV1 = await AuthenticatedHandshakeMachine.create('alice');
  const sharedStore = new InMemoryPeerStore();
  const bob = await AuthenticatedHandshakeMachine.create('bob', sharedStore);

  const firstHello = await aliceV1.initiateHandshake();
  await bob.receiveHandshake(firstHello);

  const aliceV2 = await AuthenticatedHandshakeMachine.create('alice');
  const secondHello = await aliceV2.initiateHandshake();

  const res = await bob.receiveHandshake(secondHello);

  assert.equal(res.sessionKey, null);
  assert.equal(bob.state, 'key_changed');
  assert.equal(bob.warning, 'KEY CHANGED');
});
