import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from './fixtures/maxDom.fixture.json' with { type: 'json' };
import { MockChatDom, MockUserClient } from './helpers/mockMaxHarness.ts';

test('fixture loads with expected shape', () => {
  assert.equal(typeof fixture.selectors.composer, 'string');
  assert.equal(fixture.users.length, 2);
});

test('e2e plaintext send/receive between two users', () => {
  const alice = new MockUserClient('alice', 'FP-ALICE-1111', new MockChatDom(true));
  const bob = new MockUserClient('bob', 'FP-BOB-2222', new MockChatDom(true));

  alice.compose('hello bob', false);
  alice.sendTo(bob);

  const received = bob.readLatest();
  assert.ok(received);
  assert.equal(received?.decrypted, 'hello bob');
  assert.equal(received?.encrypted, false);
});

test('e2e encrypted send/receive after handshake success', () => {
  const alice = new MockUserClient('alice', 'FP-ALICE-1111', new MockChatDom(true));
  const bob = new MockUserClient('bob', 'FP-BOB-2222', new MockChatDom(true));

  alice.initiateHandshake(bob);
  bob.respondHandshake(alice);
  alice.verifyPeer();
  bob.verifyPeer();

  alice.compose('secret message', true);
  alice.sendTo(bob);

  const received = bob.readLatest();
  assert.ok(received);
  assert.equal(received?.decrypted, 'secret message');
  assert.equal(received?.encrypted, true);
});

test('handshake failure on fingerprint mismatch blocks encryption', () => {
  const alice = new MockUserClient('alice', 'FP-ALICE-1111', new MockChatDom(true));
  const bob = new MockUserClient('bob', 'FP-BOB-OLD', new MockChatDom(true));

  alice.pinnedFingerprint = 'FP-BOB-PINNED';
  alice.initiateHandshake(bob);

  assert.equal(alice.state, 'blocked');
  assert.ok(alice.warnings.includes('Peer key mismatch'));

  alice.compose('fallback plaintext', true);
  alice.sendTo(bob);
  const received = bob.readLatest();
  assert.equal(received?.encrypted, false);
  assert.equal(received?.decrypted, 'fallback plaintext');
});

test('DOM selector breakage falls back without crashing', () => {
  const alice = new MockUserClient('alice', 'FP-ALICE-1111', new MockChatDom(false));
  const bob = new MockUserClient('bob', 'FP-BOB-2222', new MockChatDom(true));

  alice.compose('message during dom drift', true);
  alice.sendTo(bob);

  assert.ok(alice.warnings.some((w) => w.includes('DOM selectors unavailable')));
  const received = bob.readLatest();
  assert.equal(received?.decrypted, 'message during dom drift');
  assert.equal(received?.encrypted, false);
});
