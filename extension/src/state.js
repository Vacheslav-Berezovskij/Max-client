export const DEFAULT_SETTINGS = {
  defaultMode: 'plaintext',
  enabled: true
};

export async function loadSettings() {
  const stored = await chrome.storage.sync.get(['maxsecSettings']);
  return { ...DEFAULT_SETTINGS, ...(stored.maxsecSettings ?? {}) };
}

export async function saveSettings(settings) {
  await chrome.storage.sync.set({ maxsecSettings: settings });
}
