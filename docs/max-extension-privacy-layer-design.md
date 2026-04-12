# MAX Web Client Privacy Layer (Browser Extension) — Design (No Backend)

## 1) Threat Model

### 1.1 Assets to protect
- **Message confidentiality** for opted-in encrypted messages.
- **Message integrity/authenticity** (detect tampering and impersonation).
- **Forward secrecy** for future compromise resilience.
- **User key material** stored in-browser.
- **Compatibility** with regular MAX plaintext chats.

### 1.2 Trust boundaries
- **Trusted (conditionally):** local extension code, local browser key store, user’s explicit verification actions.
- **Untrusted:** MAX servers/network path, any intermediate transport, chat history storage at MAX, malicious clients that do not run the extension.
- **Partially trusted:** webpage DOM and frontend runtime (subject to change; must not be sole source of truth).

### 1.3 Adversaries
- Passive network observer.
- MAX platform operator or compromised server reading stored content.
- Active MITM altering message text in transit/storage.
- Malicious chat participant pretending to be another user.
- Malware/compromised browser profile stealing local keys.
- Replay attacker re-posting old encrypted payloads.

### 1.4 Out of scope / accepted risk
- Endpoint compromise (keylogger/malware) on either user’s device.
- Coercion/social engineering.
- Full metadata privacy (who talks to whom, timestamps, message sizes).
- Perfect deniability.

### 1.5 Security goals
- E2EE for extension-formatted messages only.
- Cryptographic authentication of encrypted payloads.
- Per-conversation session keys with ratcheting or per-message nonce discipline.
- Backward-compatible rendering: non-extension users still see harmless text blobs.

### 1.6 Non-goals (MVP)
- Multi-device seamless sync without backend.
- Group post-compromise healing at Signal-level sophistication.
- Contact discovery outside existing MAX chat identities.

---

## 2) Module Breakdown (Modular + Testable)

### 2.1 `manifest/permissions` module
- Minimal permissions: activeTab, storage, scripting, contextMenus (optional), clipboardWrite (optional).
- Host permission limited to official MAX web domains.
- Explicit CSP and isolated worlds.

**Tests:** permission regression snapshot; manifest lint.

### 2.2 `dom-adapter` module
- Provides a stable abstraction over volatile MAX DOM.
- Uses layered selectors + semantic heuristics + MutationObserver.
- Exposes high-level events:
  - `onComposerReady`, `onMessageListUpdate`, `onSendTriggered`.
- Avoids hard-coding brittle selector chains where possible.

**Tests:** fixture-based DOM contract tests (multiple HTML snapshots).

### 2.3 `transport-bridge` module
- Maps extension actions onto normal MAX client actions:
  - Reads visible incoming message text.
  - Intercepts outgoing send intent before DOM submit finalization.
- Never uses private MAX APIs; only user-equivalent UI operations.

**Tests:** simulated send/read flow with mocked DOM adapter.

### 2.4 `message-format` module
- Defines encrypted envelope format embedded inside plaintext-safe marker.
- Example framing (conceptual):
  - Prefix: `[[MAX-E2EE:v1]]`
  - Payload: base64url(protobuf/json-canonical envelope)
- Envelope fields:
  - protocol version
  - conversation fingerprint
  - sender key id
  - ephemeral pubkey / ratchet header
  - nonce
  - ciphertext
  - auth tag
  - signature/MAC metadata

**Tests:** parser/serializer roundtrip, malformed input fuzz tests.

### 2.5 `crypto-engine` module
- WebCrypto-based primitives (no custom crypto):
  - X25519 (or P-256 fallback depending browser support) for key agreement.
  - HKDF for key derivation.
  - AES-GCM for message encryption.
  - Ed25519/ECDSA signatures for identity/authentication.
- Nonce management + replay window cache.
- Zeroization best-effort for transient material.

**Tests:** KAT-style vectors, deterministic harness for KDF/envelope integrity.

### 2.6 `identity-keyring` module
- Creates/stores long-term identity keypair locally.
- Stores per-peer verified identity fingerprints.
- Exposes verify workflow (QR/string compare).
- Uses `chrome.storage.local` + optional passphrase wrapping via PBKDF2/Argon2-wasm (if chosen).

**Tests:** migration tests, key import/export tests, tamper detection.

### 2.7 `session-manager` module
- Maintains per-chat cryptographic session state.
- Handles initial handshake and session re-establishment.
- Tracks message counters, replay protection, key rotation epochs.

**Tests:** state machine tests for out-of-order, replay, reset.

### 2.8 `handshake-protocol` module
- In-band key exchange via normal chat messages.
- Supports:
  - Hello (capability + identity key)
  - Verify (fingerprint confirmation status)
  - Session-init (ephemeral key agreement)
- Idempotent and retry-safe.

**Tests:** protocol transcript tests, downgrade-attack checks.

### 2.9 `rendering-layer` module
- Rewrites visible encrypted blobs into decrypted bubbles in-page overlay.
- Keeps original plaintext message accessible (view raw).
- Clear badge states: `Encrypted`, `Unverified`, `Failed to decrypt`, `Plaintext`.

**Tests:** UI state snapshots, accessibility labels.

### 2.10 `compose-layer` module
- Adds encrypt-toggle per message (default configurable).
- Sends plaintext unchanged when toggle off.
- Sends formatted encrypted envelope when toggle on + session ready.

**Tests:** toggle behavior and coexistence tests.

### 2.11 `telemetry-local` module (no server)
- Local-only diagnostics ring buffer (for user troubleshooting).
- Exportable JSON by user action.

**Tests:** redaction tests ensure no plaintext leakage in logs.

---

## 3) Message Flow Diagrams (Text)

### 3.1 Capability discovery + handshake (1:1)
1. Alice opens chat with Bob (extension installed both sides).
2. Alice extension detects no secure session.
3. Alice sends plaintext control message `[[MAX-E2EE:v1:HELLO]]` containing public identity key + capabilities.
4. Bob extension parses HELLO, stores pending peer identity (unverified), replies with HELLO.
5. Alice/Bob each send SESSION_INIT with ephemeral key material.
6. Both derive shared root key via ECDH + HKDF.
7. Session marked `unverified-secure` until fingerprint verification.
8. Users optionally verify fingerprints out-of-band; state becomes `verified-secure`.

### 3.2 Sending encrypted message
1. User types normal message, toggles **Encrypt ON**.
2. Compose-layer requests `session-manager.encrypt(plaintext)`.
3. Session-manager gets sending chain key, derives message key/nonce.
4. Crypto-engine encrypts with AES-GCM; message-format builds envelope.
5. Transport-bridge submits envelope text through ordinary MAX composer/send button.
6. MAX delivers/stores as ordinary text.
7. Receiver extension detects envelope marker, verifies/decrypts, renders plaintext overlay.

### 3.3 Receiving mixed plaintext + encrypted messages
1. Message list update arrives from DOM adapter.
2. For each bubble:
   - If marker absent → render unchanged plaintext.
   - If marker present → parse and decrypt; replace/overlay with decrypted view.
3. On failure, show non-destructive status with “View raw payload”.

### 3.4 Non-extension participant in same chat
1. Alice sends encrypted envelope.
2. Charlie (no extension) sees marker+payload text blob.
3. No breakage to chat transport; ordinary plaintext from Charlie remains readable by all.

---

## 4) Failure Modes and Fallback Behavior

### 4.1 DOM breakage after MAX UI update
- **Symptom:** cannot find composer or message bubbles reliably.
- **Fallback:** extension enters passive-safe mode:
  - no interception/modification of outgoing messages,
  - plaintext chat unaffected,
  - user banner: “Privacy layer temporarily incompatible with current MAX UI.”
- **Recovery:** selector strategy update in extension release.

### 4.2 Handshake never completes
- **Symptom:** peer doesn’t respond with capability/session init (no extension or offline).
- **Fallback:** send plaintext as normal unless user enforces “encrypt-only” per message.
- **UX:** clear state chip: `No secure peer detected`.

### 4.3 Key mismatch / possible impersonation
- **Symptom:** identity key changes unexpectedly.
- **Fallback:** quarantine session, block automatic decrypt trust, show warning requiring user decision.
- **UX options:** trust new key, compare fingerprints, or stay plaintext.

### 4.4 Decryption failure (corrupt/tampered payload)
- **Symptom:** MAC/auth failure.
- **Fallback:** do not display forged plaintext; show “Failed to decrypt/authenticate.”
- **Preserve:** raw payload copy for debugging.

### 4.5 Replay attack detected
- **Symptom:** duplicate message counter/nonce in replay window.
- **Fallback:** mark as replay, suppress duplicate decrypted rendering.

### 4.6 Local key loss (browser reset)
- **Symptom:** cannot decrypt old messages; identity appears new.
- **Fallback:** re-onboard with explicit “new device/keys” notice; optional local key backup import for recovery.

### 4.7 Performance degradation in large chats
- **Symptom:** heavy MutationObserver events.
- **Fallback:** incremental parsing, idle-callback batching, cap historical reprocessing.

---

## 5) MVP Implementation Order

### Phase 0 — Foundations
1. Define envelope spec (`message-format`) + versioning policy.
2. Implement crypto-engine wrappers over WebCrypto.
3. Implement keyring with local identity generation and fingerprint display.

### Phase 1 — DOM resilience skeleton
4. Build dom-adapter contract with test fixtures for multiple UI variants.
5. Add transport-bridge for send/read without private APIs.

### Phase 2 — Basic secure 1:1 messaging
6. Implement HELLO + SESSION_INIT handshake (unverified mode).
7. Implement session-manager (single chain, replay cache).
8. Wire compose-layer encrypt toggle and rendering-layer decryption.
9. Ensure plaintext/encrypted coexistence in same thread.

### Phase 3 — Verification + safety UX
10. Add fingerprint verification flow and trust states.
11. Add error banners, fallback-safe passive mode, raw payload viewer.

### Phase 4 — Hardening + tests
12. Add protocol transcript tests and malformed payload fuzzing.
13. Add DOM contract regression suite from captured MAX snapshots.
14. Add performance profiling and observer throttling.

### Phase 5 — Optional post-MVP
15. Better ratchet design (double ratchet), group chat semantics, key backup/import UX.

---

## Design Notes for Constraints Compliance
- **No servers / no backend:** all key exchange and encrypted payloads are in-band chat messages.
- **Peer-to-peer only between extension users:** secure features activate only when both sides participate.
- **Plaintext compatibility preserved:** messages without markers pass through unchanged.
- **Encrypted + plaintext coexistence:** per-message toggle and robust parser distinguish both.
- **No private MAX APIs:** integration only through DOM/user-equivalent interactions.
- **DOM change tolerance:** adapter abstraction + fixture tests + passive-safe fallback.
- **Modular/testable:** each subsystem has explicit interface and dedicated test strategy.
