# MAX Extension DOM Hook + Error Strategy

## DOM hook strategy
- Use layered selectors for composer/send button/message nodes.
- Attach a capture-phase click listener for send button interception.
- Use `MutationObserver` to:
  - re-attach toggle UI when MAX re-renders composer,
  - scan new incoming messages,
  - degrade safely when selector matching fails.
- Inject a small page-context script for React/contenteditable-safe value updates.

## Fallback and error handling
- If composer/send controls are not found, show lightweight banner and do not block chat send.
- If encryption fails, keep original plaintext message untouched.
- If decryption fails, leave message as-is (raw payload visible) and mark with internal error state.
- On broad DOM incompatibility, run in passive mode and avoid mutating UI beyond warning banner.
- Never call undocumented MAX backend APIs; only interact with rendered DOM and user-equivalent events.

## Normal-use safety
- Plaintext mode is always available.
- Toggle defaults to user setting from extension storage.
- Extension can be fully disabled from options.
