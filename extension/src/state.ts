export type ComposeMode = 'OFF' | 'READ' | 'SECURE';

export type ExtensionSettings = {
  defaultMode: ComposeMode;
  enabled: boolean;
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  defaultMode: 'OFF',
  enabled: true,
};

function normalizeMode(value: string): ComposeMode {
  const v = String(value || '').toUpperCase();
  if (v === 'ENCRYPTED') return 'SECURE';
  if (v === 'PLAINTEXT') return 'OFF';
  if (v === 'READ' || v === 'SECURE' || v === 'OFF') return v;
  return 'OFF';
}

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.sync.get(['maxsecSettings']);
  const merged = { ...DEFAULT_SETTINGS, ...(stored.maxsecSettings ?? {}) };
  return { ...merged, defaultMode: normalizeMode(merged.defaultMode) };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.sync.set({
    maxsecSettings: {
      ...settings,
      defaultMode: normalizeMode(settings.defaultMode),
    },
  });
}
