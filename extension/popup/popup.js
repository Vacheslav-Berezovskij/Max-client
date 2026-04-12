import { loadSettings, saveSettings } from '../src/state.js';

const mode = document.getElementById('mode');
const enabled = document.getElementById('enabled');
const save = document.getElementById('save');
const openManual = document.getElementById('openManual');
const status = document.getElementById('status');

function normalizeMode(value) {
  const v = String(value || '').toUpperCase();
  if (v === 'ENCRYPTED') return 'SECURE';
  if (v === 'PLAINTEXT') return 'OFF';
  return v === 'READ' || v === 'SECURE' || v === 'OFF' ? v : 'OFF';
}

async function init() {
  const settings = await loadSettings();
  mode.value = normalizeMode(settings.defaultMode);
  enabled.checked = settings.enabled;
}

save.addEventListener('click', async () => {
  await saveSettings({
    enabled: enabled.checked,
    defaultMode: normalizeMode(mode.value),
  });
  status.textContent = 'Сохранено';
  setTimeout(() => (status.textContent = ''), 1200);
});

openManual.addEventListener('click', async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL('manual/manual.html') });
});

void init();
