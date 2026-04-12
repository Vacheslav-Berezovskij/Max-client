export type OverlayVerificationStatus = 'verified' | 'unverified';
export type OverlayMode = 'OFF' | 'READ' | 'SECURE';

const PANEL_ID = 'maxsec-floating-panel';
const STYLE_ID = 'maxsec-floating-panel-style';

type CreateOverlayParams = {
  mode: OverlayMode;
  fingerprint: string;
  verificationStatus: OverlayVerificationStatus;
  onModeChange: (mode: OverlayMode) => void;
  onVerify: () => void;
};

type UpdateOverlayParams = {
  mode: OverlayMode;
  fingerprint: string;
  verificationStatus: OverlayVerificationStatus;
  warning: string;
};

export function injectOverlayStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${PANEL_ID} {
      position: fixed;
      right: 16px;
      bottom: 72px;
      z-index: 2147483646;
      width: 260px;
      padding: 10px;
      border-radius: 10px;
      background: rgba(17, 24, 39, 0.95);
      color: #f9fafb;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
      font: 12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      border: 1px solid rgba(255,255,255,0.12);
      backdrop-filter: blur(4px);
    }
    #${PANEL_ID} * { box-sizing: border-box; }
    #${PANEL_ID} .maxsec-title { font-weight: 700; margin-bottom: 8px; }
    #${PANEL_ID} .maxsec-row { margin-bottom: 8px; }
    #${PANEL_ID} .maxsec-label { opacity: 0.75; display:block; margin-bottom: 4px; }
    #${PANEL_ID} .maxsec-mode {
      width: 100%; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2);
      background: #111827; color: #fff; padding: 6px;
    }
    #${PANEL_ID} .maxsec-fingerprint {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
      word-break: break-all; background: rgba(255,255,255,0.06); padding: 6px; border-radius: 6px;
    }
    #${PANEL_ID} .maxsec-status { font-weight: 600; }
    #${PANEL_ID} .maxsec-status.verified { color: #34d399; }
    #${PANEL_ID} .maxsec-status.unverified { color: #fbbf24; }
    #${PANEL_ID} .maxsec-warning { color: #fca5a5; min-height: 16px; }
    #${PANEL_ID} .maxsec-verify {
      width: 100%; border: none; border-radius: 6px; padding: 7px;
      cursor: pointer; background: #2563eb; color: white; font-weight: 600;
    }
    #${PANEL_ID} .maxsec-verify:disabled { opacity: 0.6; cursor: default; }
  `;

  document.head.appendChild(style);
}

export function createOverlay(params: CreateOverlayParams): HTMLElement {
  const existing = document.getElementById(PANEL_ID);
  if (existing) return existing;

  const panel = document.createElement('aside');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="maxsec-title">MAXSEC Overlay</div>
    <div class="maxsec-row">
      <label class="maxsec-label" for="maxsec-mode-select">Mode</label>
      <select id="maxsec-mode-select" class="maxsec-mode">
        <option value="OFF">OFF</option>
        <option value="READ">READ</option>
        <option value="SECURE">SECURE</option>
      </select>
    </div>
    <div class="maxsec-row">
      <span class="maxsec-label">Fingerprint</span>
      <div id="maxsec-fingerprint" class="maxsec-fingerprint"></div>
    </div>
    <div class="maxsec-row">
      <span class="maxsec-label">Verification</span>
      <div id="maxsec-status" class="maxsec-status"></div>
    </div>
    <div id="maxsec-warning" class="maxsec-warning"></div>
    <button id="maxsec-verify" class="maxsec-verify" type="button">Verify</button>
  `;

  document.body.appendChild(panel);

  const modeSelect = panel.querySelector('#maxsec-mode-select') as HTMLSelectElement | null;
  const verifyButton = panel.querySelector('#maxsec-verify') as HTMLButtonElement | null;

  if (modeSelect) {
    modeSelect.value = params.mode;
    modeSelect.addEventListener('change', () => params.onModeChange(modeSelect.value as OverlayMode));
  }

  verifyButton?.addEventListener('click', () => params.onVerify());

  updateOverlay({
    mode: params.mode,
    fingerprint: params.fingerprint,
    verificationStatus: params.verificationStatus,
    warning: '',
  });

  return panel;
}

export function updateOverlay(params: UpdateOverlayParams): void {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  const modeSelect = panel.querySelector('#maxsec-mode-select') as HTMLSelectElement | null;
  const fp = panel.querySelector('#maxsec-fingerprint') as HTMLElement | null;
  const status = panel.querySelector('#maxsec-status') as HTMLElement | null;
  const warn = panel.querySelector('#maxsec-warning') as HTMLElement | null;
  const verifyButton = panel.querySelector('#maxsec-verify') as HTMLButtonElement | null;

  if (modeSelect) modeSelect.value = params.mode;
  if (fp) fp.textContent = params.fingerprint || '—';

  if (status) {
    status.textContent = params.verificationStatus === 'verified' ? 'Verified' : 'Unverified';
    status.className = `maxsec-status ${params.verificationStatus}`;
  }

  if (warn) warn.textContent = params.warning;
  if (verifyButton) verifyButton.disabled = params.verificationStatus === 'verified';
}
