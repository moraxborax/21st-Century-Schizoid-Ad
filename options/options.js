// 21st Century Schizoid Ad - Options (无 AI)

const DEFAULT_SETTINGS = {
  enabled: true,
  adTypeHandling: {
    hard_ad: 'skip',
    soft_ad: 'ask',
    sponsor_segment: 'ask',
    product_showcase: 'ignore',
    self_promo: 'ignore'
  },
  minContentValue: 0.3
};

const SELECT_IDS = ['hard_ad', 'soft_ad', 'sponsor_segment', 'product_showcase', 'self_promo'];

const handlingOptions = [
  { value: 'skip', label: '跳过 (skip)' },
  { value: 'ask', label: '询问 (ask)' },
  { value: 'ignore', label: '忽略 (ignore)' }
];

function qs(id) { return document.getElementById(id); }

function initSelects() {
  for (const id of SELECT_IDS) {
    const sel = qs(id);
    sel.innerHTML = '';
    for (const opt of handlingOptions) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      sel.appendChild(o);
    }
  }
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(null);
  const settings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    adTypeHandling: {
      ...DEFAULT_SETTINGS.adTypeHandling,
      ...(stored && stored.adTypeHandling ? stored.adTypeHandling : {})
    }
  };
  applyToUI(settings);
}

function applyToUI(settings) {
  qs('enabled').checked = !!settings.enabled;
  qs('minContentValue').value = Number(settings.minContentValue ?? DEFAULT_SETTINGS.minContentValue);
  for (const id of SELECT_IDS) {
    const val = settings.adTypeHandling[id] || DEFAULT_SETTINGS.adTypeHandling[id] || 'ask';
    qs(id).value = val;
  }
}

function collectFromUI() {
  const obj = {
    enabled: qs('enabled').checked,
    minContentValue: Number(qs('minContentValue').value),
    adTypeHandling: {}
  };
  for (const id of SELECT_IDS) {
    obj.adTypeHandling[id] = qs(id).value;
  }
  return obj;
}

async function onSave() {
  const data = collectFromUI();
  await chrome.storage.sync.set(data);
  showStatus('已保存');
}

async function onReset() {
  await chrome.storage.sync.set(DEFAULT_SETTINGS);
  applyToUI(DEFAULT_SETTINGS);
  showStatus('已恢复默认');
}

let statusTimer = null;
function showStatus(text) {
  const el = qs('status');
  if (!el) return;
  el.textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (el.textContent = ''), 1200);
}

async function main() {
  initSelects();
  await loadSettings();
  qs('save').addEventListener('click', onSave);
  qs('reset').addEventListener('click', onReset);
}

document.addEventListener('DOMContentLoaded', main);
