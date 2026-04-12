import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/state';

const enabled = document.getElementById('enabled') as HTMLInputElement;
const defaultMode = document.getElementById('defaultMode') as HTMLSelectElement;
const status = document.getElementById('status') as HTMLParagraphElement;
const save = document.getElementById('save') as HTMLButtonElement;

async function init(): Promise<void> {
  const settings = await loadSettings();
  enabled.checked = settings.enabled;
  defaultMode.value = settings.defaultMode;
}

save.addEventListener('click', async () => {
  await saveSettings({
    enabled: enabled.checked,
    defaultMode: (defaultMode.value as 'plaintext' | 'encrypted') ?? DEFAULT_SETTINGS.defaultMode,
  });

  status.textContent = 'Saved';
  setTimeout(() => {
    status.textContent = '';
  }, 1200);
});

void init();
