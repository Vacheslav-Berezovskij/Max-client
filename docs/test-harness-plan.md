# MAXSEC Extension Test Harness Plan

## Scope
1. Unit tests
   - Crypto primitives (`src/crypto.ts`)
   - Protocol parsing/encoding (`src/messageProtocol.ts`)
2. Integration/end-to-end tests (mock DOM + two peers)
   - Plaintext send/receive
   - Encrypted send/receive
   - Handshake success path
   - Handshake failure path (key mismatch)
   - Selector breakage / DOM drift fallback

## Test matrix
- **DOM availability**
  - Selectors valid
  - Selectors broken (composer/send/message nodes missing)
- **Security state**
  - No handshake
  - Handshake established
  - Handshake mismatch/blocked
- **Message mode**
  - Plaintext
  - Encrypted

## Assertions
- Plaintext passes through unchanged.
- Encrypted payloads are prefixed and decodable.
- Key mismatch prevents secure mode and falls back to plaintext warning path.
- Broken selectors do not crash flow and do not block normal plaintext messaging.
- Unit tests continue validating malformed protocol parsing and crypto failure on wrong key.
