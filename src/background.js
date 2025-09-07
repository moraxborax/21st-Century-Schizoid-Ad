// 21st Century Schizoid Ad - Background (MV3)
// 初始化默认设置（无 AI）

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

chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    const stored = await chrome.storage.sync.get(null);
    const merged = structuredClone(DEFAULT_SETTINGS);

    // 仅填充缺省项，不覆盖用户已有配置
    if (stored && typeof stored === 'object') {
      if (typeof stored.enabled === 'boolean') merged.enabled = stored.enabled;
      if (typeof stored.minContentValue === 'number') merged.minContentValue = stored.minContentValue;
      merged.adTypeHandling = Object.assign({}, DEFAULT_SETTINGS.adTypeHandling, stored.adTypeHandling || {});
    }

    await chrome.storage.sync.set(merged);
  } catch (e) {
    console.warn('Init settings failed:', e);
  }
});
