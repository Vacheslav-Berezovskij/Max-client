# MAXSEC Extension Local Storage Design

## Goals and constraints
- No server-side key sync.
- Private keys remain on-device unless user explicitly exports backup.
- Multiple devices are treated as separate cryptographic devices.
- Handle logout/reinstall with explicit recovery UX.
- Optional passphrase lock for local-at-rest protection.

---

## 1) Storage model

## 1.1 Entity model
- **Profile**: one logical MAX account context inside browser extension.
- **Device Identity**: per-browser-install long-term identity keypair.
- **Peer Trust Record**: pinned fingerprints per contact per device.
- **Session State**: per-chat ratchet/session material.
- **Backup Metadata**: export version, creation time, KDF parameters.

### 1.2 Key principle for multi-device users
A MAX user on phone and laptop is represented as **distinct cryptographic devices**:
- `alice#deviceA`, `alice#deviceB` each with different identity keys.
- Peer trust is pinned to device fingerprint, not only username.
- New device appears as unverified until explicitly trusted.

---

## 2) What goes where

## 2.1 IndexedDB (durable structured secure state)
Use IndexedDB for all durable cryptographic state and large structured data.

Stores:
1. `identities`
   - `profileId`
   - `deviceId`
   - `identityPublicKeySpki`
   - `identityPrivateKeyWrapped` (if passphrase-lock enabled)
   - `identityPrivateKeyRaw` (only if lock disabled; still local only)
   - `createdAt`, `rotatedAt`, `status`
2. `peer_devices`
   - `profileId`
   - `peerUserId`
   - `peerDeviceId`
   - `peerIdentityPublicKeySpki`
   - `fingerprint`
   - `trustState` (`unverified` | `verified` | `revoked`)
   - `firstSeenAt`, `verifiedAt`
3. `sessions`
   - `profileId`
   - `chatId`
   - `peerDeviceId`
   - `sessionEpoch`
   - `rootKeyWrapped`
   - `sendChainState`, `recvChainState`
   - `lastActivityAt`
4. `replay_cache`
   - `profileId`
   - `chatId`
   - `messageNonceOrCounter`
   - `seenAt`
5. `backup_meta`
   - last export timestamp
   - export format version
   - kdf params used in latest backup

Why IndexedDB:
- async, large quota, structured transactions, better for protocol state than `localStorage`.

## 2.2 sessionStorage (ephemeral unlocked secrets)
Use `sessionStorage` for process-lifetime unlock context only.

Stores:
- `unlockToken` (random handle, not raw key)
- `unlockedProfileIds`
- lock deadline/TTL metadata

Notes:
- Never store long-term private keys directly in `sessionStorage`.
- Clear on tab close/crash restore boundary.

## 2.3 chrome.storage.local (extension preferences + non-secret UX state)
Use `chrome.storage.local` for extension settings and non-secret UX state.

Stores:
- extension enabled flag
- default plaintext/encrypted compose mode
- lock timeout preference
- “show fingerprints as words/base32” preference
- migration/version flags

Do **not** store plaintext private keys here.

---

## 3) Key backup/export format

Format: `MAXSEC-BACKUP-v1` (single JSON blob, then encrypted).

Top-level (before encryption):
```json
{
  "format": "MAXSEC-BACKUP-v1",
  "createdAt": 1770000000000,
  "profileId": "max:user:123",
  "deviceId": "device-laptop-01",
  "crypto": {
    "kdf": "Argon2id",
    "kdfParams": { "memKiB": 65536, "iters": 3, "parallelism": 1, "saltB64": "..." },
    "aead": "AES-256-GCM",
    "nonceB64": "..."
  },
  "ciphertextB64": "...",
  "aad": {
    "format": "MAXSEC-BACKUP-v1",
    "profileId": "max:user:123",
    "deviceId": "device-laptop-01"
  }
}
```

Encrypted payload (inside ciphertext) contains:
- identity private key (pkcs8/raw export)
- identity public key
- peer trust records
- optional active session snapshots (recommended: optional; can re-handshake)
- rotation counters and protocol version

Export rules:
- Export requires unlocked state + explicit user action.
- Always passphrase-protected backup; no plaintext export option.
- Include checksum/version for forward compatibility.

---

## 4) Recovery flow after reinstall

Scenario: extension removed/reinstalled or browser profile reset.

1. Fresh install detects no identity record in IndexedDB.
2. Show choice:
   - `Create new device identity`
   - `Restore from backup`
3. If restore:
   - user selects backup file.
   - parse outer JSON, verify `format` and required fields.
   - derive backup key from passphrase + KDF params.
   - decrypt/verify AEAD tag.
   - import keys and trust records into IndexedDB transaction.
4. Mark recovered device with same `deviceId` if user wants continuity; otherwise mint new `deviceId` and keep restored keypair.
5. On first chat open, extension sends device-introduction message if peers lack this device mapping.
6. If restore fails (wrong passphrase/corrupt file), keep extension in plaintext mode; do not create partial identity state.

---

## 5) Lock/unlock flow (optional passphrase locking)

## 5.1 Initial enable lock
1. User enables “Lock keys with passphrase”.
2. Extension derives KEK from passphrase (Argon2id recommended, PBKDF2 fallback).
3. Private keys/session root keys are wrapped with KEK and persisted in IndexedDB.
4. In-memory working keys cleared after wrap.

## 5.2 Unlock
1. User enters passphrase.
2. Derive KEK with stored KDF params.
3. Unwrap identity private key into memory (non-exportable CryptoKey where possible).
4. Save only unlock handle/TTL in `sessionStorage`.
5. Mark state `unlocked` for current browser session.

## 5.3 Auto-lock
- Trigger on:
  - timeout inactivity,
  - browser/tab close,
  - explicit lock button,
  - MAX logout event.
- Auto-lock clears in-memory keys, session handles, and ephemeral derived keys.

## 5.4 Wrong passphrase and safety
- On unwrap failure: keep locked state, increment local failure counter, introduce exponential backoff.
- Never silently downgrade to unprotected storage.

---

## 6) Logout handling

When MAX logout is detected:
- Keep durable encrypted key material in IndexedDB by default (user-selectable).
- Immediately clear:
  - in-memory keys,
  - sessionStorage unlock handles,
  - active decrypted session cache.
- Require explicit unlock on next MAX login.
- Optional “wipe local keys on logout” toggle for high-security users.

---

## 7) Data lifecycle policies

- Replay cache TTL: e.g., 30 days rolling cleanup.
- Inactive session snapshots: prune after configurable age (e.g., 90 days).
- Revoked peer devices retained for audit but blocked for encryption.
- Backup metadata retained locally without secret material.

---

## 8) Failure-safe defaults

- If storage read/write fails: fallback to plaintext and show warning.
- If schema migration fails: enter read-only safe mode, preserve raw DB until successful migration.
- If key mismatch after restore: require manual re-verification; never auto-trust.
