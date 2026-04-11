export type ComposeMode = 'plaintext' | 'encrypted';

export type ExtensionSettings = {
  defaultMode: ComposeMode;
  enabled: boolean;
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  defaultMode: 'plaintext',
  enabled: true,
};

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.sync.get(['maxsecSettings']);
  return { ...DEFAULT_SETTINGS, ...(stored.maxsecSettings ?? {}) };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.sync.set({ maxsecSettings: settings });
}
