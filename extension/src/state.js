export const DEFAULT_SETTINGS = {
  defaultMode: 'OFF',
  enabled: true
};

function normalizeMode(value) {
  const v = String(value || '').toUpperCase();
  if (v === 'ENCRYPTED') return 'SECURE';
  if (v === 'PLAINTEXT') return 'OFF';
  return v === 'OFF' || v === 'READ' || v === 'SECURE' ? v : 'OFF';
}

export async function loadSettings() {
  const stored = await chrome.storage.sync.get(['maxsecSettings']);
  const merged = { ...DEFAULT_SETTINGS, ...(stored.maxsecSettings ?? {}) };
  return { ...merged, defaultMode: normalizeMode(merged.defaultMode) };
}

export async function saveSettings(settings) {
  await chrome.storage.sync.set({
    maxsecSettings: {
      ...settings,
      defaultMode: normalizeMode(settings.defaultMode),
    },
  });
}
