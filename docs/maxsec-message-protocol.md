# MAXSEC Versioned Message Protocol

## Goals
- Plaintext messages remain unchanged.
- Encrypted messages are clearly recognizable in chat.
- Payload is JSON serialized then base64 encoded.
- Protocol supports forward compatibility by allowing unknown fields.

## Wire Format

### Plaintext
- Any message not beginning with `[MAXSEC]` is treated as plaintext and must be rendered unchanged.

### Encrypted
```
[MAXSEC]<base64(json-envelope)>
```

## JSON Envelope (v1)
Required fields:
- `version` (number, integer >= 1)
- `type` (string, non-empty)
- `sender` (string, non-empty sender identity)
- `timestamp` (number, unix ms, positive)
- `nonce` (string, non-empty)
- `ciphertext` (string, non-empty)

Optional / forward-compatible fields:
- Any additional keys are allowed and should be ignored if unknown.

Example:
```json
{
  "version": 1,
  "type": "encrypted",
  "sender": "alice:device-1",
  "timestamp": 1770000000000,
  "nonce": "b64nonce",
  "ciphertext": "b64ciphertext",
  "aad": "optional"
}
```

## Robustness Rules
- Parsing code must never throw on untrusted input during decode.
- Invalid prefixed payloads are classified as malformed.
- Invalid schema returns validation errors.
- Unsupported versions are still parseable if schema is valid; higher-level logic may decide handling.
