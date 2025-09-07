(() => {
  const els = {
    toggle: document.getElementById('toggle-enabled'),
    threshold: document.getElementById('threshold'),
    thresholdDisplay: document.getElementById('threshold-display'),
    openOptions: document.getElementById('open-options'),
    reloadTab: document.getElementById('reload-tab'),
  };

  function fmt(v) {
    return (Math.round(v * 100) / 100).toFixed(2);
  }

  async function loadSettings() {
    try {
      const stored = await chrome.storage.sync.get(null);
      const enabled = stored.enabled !== undefined ? stored.enabled : true;
      const minContentValue = typeof stored.minContentValue === 'number' ? stored.minContentValue : 0.3;

      els.toggle.checked = !!enabled;
      els.threshold.value = String(minContentValue);
      els.thresholdDisplay.textContent = fmt(minContentValue);
    } catch (e) {
      console.warn('popup: load settings failed', e);
    }
  }

  async function save(partial) {
    try {
      await chrome.storage.sync.set(partial);
    } catch (e) {
      console.warn('popup: save failed', e);
    }
  }

  function wireEvents() {
    els.toggle.addEventListener('change', () => {
      save({ enabled: els.toggle.checked });
    });

    els.threshold.addEventListener('input', () => {
      const v = Number(els.threshold.value);
      els.thresholdDisplay.textContent = fmt(v);
    });
    els.threshold.addEventListener('change', () => {
      const v = Number(els.threshold.value);
      save({ minContentValue: v });
    });

    els.openOptions.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open('options/options.html', '_blank');
      }
    });

    els.reloadTab.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) chrome.tabs.reload(tab.id);
      } catch (e) {
        console.warn('popup: reload failed', e);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    wireEvents();
    await loadSettings();
  });
})();
