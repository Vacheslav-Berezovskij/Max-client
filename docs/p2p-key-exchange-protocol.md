# MAX P2P In-Band Key Exchange Protocol (No Server)

This protocol runs entirely over ordinary MAX chat messages, using structured plaintext envelopes that extension users can parse.

---

## 1) Step-by-step handshake protocol

Notation:
- `IK`: long-term Identity Key (ECDH P-256 keypair)
- `EK`: ephemeral handshake key (ECDH P-256 keypair)
- `FP(IK)`: short fingerprint of identity public key
- `SID`: session identifier (derived)
- `K_root`: root session key material from ECDH + HKDF

### States
- `PLAINTEXT_ONLY`
- `HANDSHAKE_PENDING`
- `UNVERIFIED_SECURE`
- `VERIFIED_SECURE`
- `KEY_MISMATCH_BLOCKED`

### A. First contact
1. **Alice** (initiator) generates `EK_A` and sends `HELLO` in chat.
2. **Bob** receives `HELLO`:
   - if first contact, create/ensure own `IK_B`, generate `EK_B`.
   - send `HELLO_ACK` with `IK_B_pub`, `EK_B_pub`, `FP(IK_B)`.
3. Alice receives `HELLO_ACK` and computes candidate shared secret from `EK_A_priv` + `EK_B_pub`.
4. Alice sends `KEY_CONFIRM` proving possession of same derived secret (HMAC over transcript).
5. Bob validates `KEY_CONFIRM`, replies `KEY_CONFIRM_ACK`.
6. Both sides move to `UNVERIFIED_SECURE` and can encrypt.
7. UI requires manual identity fingerprint comparison before moving to `VERIFIED_SECURE`.

### B. Identity verification (manual MITM reduction)
8. Users compare displayed identity fingerprints out-of-band (voice, in-person, another trusted channel).
9. User explicitly taps **Mark Verified** only if fingerprints match.
10. Verified mapping is pinned: `chatId -> peer IK fingerprint`.

### C. Rekeying (same identity)
11. Either side sends `REKEY_INIT` with new ephemeral key `EK'_pub` and rekey counter.
12. Peer replies `REKEY_ACK` with its own ephemeral key.
13. Both derive fresh `K_root'` and send `REKEY_CONFIRM` MAC over rekey transcript.
14. On success, session keys rotate and old sending key is retired.

### D. Identity key rotation (new long-term key)
15. Rotating user sends `IDENTITY_ROTATE_ANNOUNCE` signed by old IK (if still available) and containing new IK public key + fingerprint.
16. Receiver marks conversation `KEY_MISMATCH_BLOCKED` until user confirms new identity.
17. Chat remains plaintext-only or warning-only until explicit acceptance.
18. After acceptance, run full handshake again with new IK.

### E. Key mismatch behavior (mandatory safety)
- If pinned fingerprint != received fingerprint:
  - set state `KEY_MISMATCH_BLOCKED`
  - disable encryption send path for that chat
  - show persistent warning: “Peer key changed. Verification required.”
  - **Never** auto-trust or silently overwrite pinned key.

---

## 2) Message types and payloads

Envelope format over chat text:

`[[MAX-E2EE:v1:<TYPE>]]<base64(json)>`

Common fields in all payloads:
- `v`: protocol version (`1`)
- `type`: message type
- `chatId`: local conversation binding identifier
- `msgId`: unique random id
- `ts`: unix milliseconds

### 2.1 HELLO
```json
{
  "v": 1,
  "type": "HELLO",
  "chatId": "chat-123",
  "msgId": "...",
  "ts": 1770000000000,
  "identityPub": "BASE64_SPKI_ECDH_P256",
  "identityFp": "ABCD-EFGH-IJKL-MNOP-QRST-UVWX",
  "ephemeralPub": "BASE64_SPKI_ECDH_P256",
  "capabilities": ["aes-gcm-256", "hkdf-sha256", "p256"]
}
```

### 2.2 HELLO_ACK
```json
{
  "v": 1,
  "type": "HELLO_ACK",
  "chatId": "chat-123",
  "msgId": "...",
  "ts": 1770000000100,
  "replyTo": "HELLO_MSG_ID",
  "identityPub": "...",
  "identityFp": "...",
  "ephemeralPub": "...",
  "selected": {"aead": "aes-gcm-256", "kdf": "hkdf-sha256", "curve": "p256"}
}
```

### 2.3 KEY_CONFIRM
```json
{
  "v": 1,
  "type": "KEY_CONFIRM",
  "chatId": "chat-123",
  "msgId": "...",
  "ts": 1770000000200,
  "replyTo": "HELLO_ACK_MSG_ID",
  "transcriptHash": "BASE64_SHA256",
  "proof": "BASE64_HMAC(K_confirm, transcriptHash)"
}
```

### 2.4 KEY_CONFIRM_ACK
```json
{
  "v": 1,
  "type": "KEY_CONFIRM_ACK",
  "chatId": "chat-123",
  "msgId": "...",
  "ts": 1770000000300,
  "replyTo": "KEY_CONFIRM_MSG_ID",
  "proof": "BASE64_HMAC(K_confirm, transcriptHash || 'ack')"
}
```

### 2.5 REKEY_INIT / REKEY_ACK / REKEY_CONFIRM
- `REKEY_INIT`: `{ rekeyId, epoch, newEphemeralPub }`
- `REKEY_ACK`: `{ rekeyId, epoch, newEphemeralPub }`
- `REKEY_CONFIRM`: `{ rekeyId, epoch, proof }`

### 2.6 IDENTITY_ROTATE_ANNOUNCE
```json
{
  "v": 1,
  "type": "IDENTITY_ROTATE_ANNOUNCE",
  "chatId": "chat-123",
  "msgId": "...",
  "ts": 1770000000400,
  "oldIdentityFp": "...",
  "newIdentityPub": "BASE64_SPKI_ECDH_P256",
  "newIdentityFp": "...",
  "rotationCounter": 4,
  "oldKeySignature": "BASE64_SIG_OVER(newIdentityPub,rotationCounter,ts)"
}
```

---

## 3) Fingerprint display format (manual verification)

Recommended display:
- 24 Base32 chars from `SHA-256(identityPubSpki)` truncated to 120 bits
- grouped in 6 blocks of 4 chars for readability

Format:

`ABCD-EFGH-IJKL-MNOP-QRST-UVWX`

Rules:
- Show local + peer fingerprints side-by-side.
- Use monospace font.
- Add “copy” and “read aloud” helpers.
- Verification action must require explicit user click.

---

## 4) TypeScript pseudocode

```ts
type HandshakeState =
  | 'PLAINTEXT_ONLY'
  | 'HANDSHAKE_PENDING'
  | 'UNVERIFIED_SECURE'
  | 'VERIFIED_SECURE'
  | 'KEY_MISMATCH_BLOCKED';

interface ChatSecurityState {
  chatId: string;
  state: HandshakeState;
  pinnedPeerFingerprint?: string;
  peerIdentityPub?: CryptoKey;
  localIdentity: CryptoKeyPair;
  pendingEphemeral?: CryptoKeyPair;
  sessionKey?: CryptoKey; // AES-GCM key from deriveSharedSecret + HKDF
  epoch: number;
}

async function initiateHandshake(ctx: ChatSecurityState) {
  ctx.pendingEphemeral = await generateIdentityKeyPair(); // ephemeral ECDH
  const identityPub = await exportPublicKey(ctx.localIdentity.publicKey);
  const ephemeralPub = await exportPublicKey(ctx.pendingEphemeral.publicKey);
  const identityFp = fingerprint(identityPub);

  sendChatEnvelope('HELLO', {
    identityPub,
    identityFp,
    ephemeralPub,
    capabilities: ['aes-gcm-256', 'hkdf-sha256', 'p256'],
  });

  ctx.state = 'HANDSHAKE_PENDING';
}

async function respondHandshake(ctx: ChatSecurityState, hello: any) {
  const receivedFp = hello.identityFp as string;

  if (ctx.pinnedPeerFingerprint && ctx.pinnedPeerFingerprint !== receivedFp) {
    ctx.state = 'KEY_MISMATCH_BLOCKED';
    showWarning('Peer key changed. Verification required. Encryption disabled.');
    return;
  }

  ctx.peerIdentityPub = await importPublicKey(hello.identityPub);

  const myEph = await generateIdentityKeyPair();
  ctx.pendingEphemeral = myEph;

  sendChatEnvelope('HELLO_ACK', {
    replyTo: hello.msgId,
    identityPub: await exportPublicKey(ctx.localIdentity.publicKey),
    identityFp: fingerprint(await exportPublicKey(ctx.localIdentity.publicKey)),
    ephemeralPub: await exportPublicKey(myEph.publicKey),
    selected: { aead: 'aes-gcm-256', kdf: 'hkdf-sha256', curve: 'p256' },
  });

  const peerEph = await importPublicKey(hello.ephemeralPub);
  ctx.sessionKey = await deriveSharedSecret(myEph.privateKey, peerEph);
  ctx.state = 'HANDSHAKE_PENDING';
}

async function confirmHandshake(ctx: ChatSecurityState, helloAck: any) {
  const receivedFp = helloAck.identityFp as string;

  if (ctx.pinnedPeerFingerprint && ctx.pinnedPeerFingerprint !== receivedFp) {
    ctx.state = 'KEY_MISMATCH_BLOCKED';
    showWarning('Identity mismatch detected. Staying plaintext until user confirms.');
    return;
  }

  const peerEph = await importPublicKey(helloAck.ephemeralPub);
  if (!ctx.pendingEphemeral) throw new Error('No pending ephemeral key');

  ctx.sessionKey = await deriveSharedSecret(ctx.pendingEphemeral.privateKey, peerEph);

  const th = transcriptHash(/* HELLO + HELLO_ACK canonical bytes */);
  const proof = await hmacProof(ctx.sessionKey, th);

  sendChatEnvelope('KEY_CONFIRM', { replyTo: helloAck.msgId, transcriptHash: th, proof });
  ctx.state = 'UNVERIFIED_SECURE';
  showVerifyPrompt(receivedFp); // manual compare required
}

async function rotateKeys(ctx: ChatSecurityState) {
  if (ctx.state === 'KEY_MISMATCH_BLOCKED') {
    showWarning('Cannot rotate while key mismatch is unresolved.');
    return;
  }

  const rekeyEphemeral = await generateIdentityKeyPair();
  const rekeyId = crypto.randomUUID();
  const epoch = ctx.epoch + 1;

  sendChatEnvelope('REKEY_INIT', {
    rekeyId,
    epoch,
    newEphemeralPub: await exportPublicKey(rekeyEphemeral.publicKey),
  });

  // on REKEY_ACK from peer:
  // derive new session key from rekeyEphemeral.private + peerRekeyPub
  // send REKEY_CONFIRM proof
  // commit ctx.sessionKey + ctx.epoch only after proof validated
}
```

Safety requirements in code paths:
- On mismatch: set `KEY_MISMATCH_BLOCKED`, keep plaintext available, disable encrypted send.
- Only move to `VERIFIED_SECURE` after explicit user verification action.
- Never replace pinned fingerprint without user approval.
