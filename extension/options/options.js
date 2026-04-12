import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/state.js';

const enabled = document.getElementById('enabled');
const defaultMode = document.getElementById('defaultMode');
const status = document.getElementById('status');
const save = document.getElementById('save');

async function init() {
  const settings = await loadSettings();
  enabled.checked = settings.enabled;
  defaultMode.value = settings.defaultMode;
}

save.addEventListener('click', async () => {
  await saveSettings({
    enabled: enabled.checked,
    defaultMode: defaultMode.value || DEFAULT_SETTINGS.defaultMode,
  });

  status.textContent = 'Saved';
  setTimeout(() => {
    status.textContent = '';
  }, 1200);
});

void init();
