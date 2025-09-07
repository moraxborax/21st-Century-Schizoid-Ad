// 21st Century Schizoid Ad - Content Script (Bilibili)
// 仅使用社区 JSON（Epitaph），不包含任何 AI 能力

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

const state = {
  config: { ...DEFAULT_SETTINGS },
  video: null,
  bvid: null,
  currentPart: '1',
  currentSegments: [],
  activeSegment: null,
  lastSkippedStart: null,
  noticeEl: null,
  url: location.href,
};

// 入口
init();

async function init() {
  await loadConfig();
  setupStorageListener();
  setupUrlWatcher();
  await bootForCurrentPage();
}

async function bootForCurrentPage() {
  state.bvid = getBvidFromUrl();
  state.currentPart = getCurrentP();
  if (!state.bvid) return;

  await ensureVideoReady();
  await loadEpitaphData(state.bvid);
  attachVideoListeners();
  ensureNoticeEl();
}

function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    let needRefresh = false;
    if (changes.enabled) state.config.enabled = changes.enabled.newValue;
    if (changes.minContentValue) state.config.minContentValue = changes.minContentValue.newValue;
    if (changes.adTypeHandling) state.config.adTypeHandling = {
      ...state.config.adTypeHandling,
      ...changes.adTypeHandling.newValue
    };
    if (!state.config.enabled) hideNotice();
  });
}

function setupUrlWatcher() {
  setInterval(async () => {
    if (state.url !== location.href) {
      state.url = location.href;
      // URL 变化，重新加载
      cleanupVideoListeners();
      state.video = null;
      state.currentSegments = [];
      state.activeSegment = null;
      hideNotice();
      await bootForCurrentPage();
    }
  }, 800);
}

async function loadConfig() {
  try {
    const stored = await chrome.storage.sync.get(null);
    state.config = {
      ...DEFAULT_SETTINGS,
      ...stored,
      adTypeHandling: {
        ...DEFAULT_SETTINGS.adTypeHandling,
        ...(stored && stored.adTypeHandling ? stored.adTypeHandling : {})
      }
    };
  } catch (e) {
    console.warn('Load settings failed, fallback to default:', e);
    state.config = { ...DEFAULT_SETTINGS };
  }
}

async function ensureVideoReady() {
  return new Promise((resolve) => {
    const tryFind = () => {
      const v = document.querySelector('video');
      if (v) {
        state.video = v;
        resolve();
      } else {
        setTimeout(tryFind, 400);
      }
    };
    tryFind();
  });
}

function attachVideoListeners() {
  if (!state.video) return;
  state.video.addEventListener('timeupdate', onTimeUpdate);
  state.video.addEventListener('seeking', onSeeking);
}

function cleanupVideoListeners() {
  if (!state.video) return;
  state.video.removeEventListener('timeupdate', onTimeUpdate);
  state.video.removeEventListener('seeking', onSeeking);
}

async function loadEpitaphData(bvid) {
  try {
    const indexUrl = chrome.runtime.getURL('epitaph/index.json');
    const idxRes = await fetch(indexUrl);
    if (!idxRes.ok) throw new Error(`index.json HTTP ${idxRes.status}`);
    const indexData = await idxRes.json();

    const videoInfo = Array.isArray(indexData.videos)
      ? indexData.videos.find(v => v.bvid === bvid)
      : null;
    if (!videoInfo) {
      console.info(`[Epitaph] ${bvid} 未在索引中`);
      return;
    }

    const dataUrl = chrome.runtime.getURL(`epitaph/${bvid}/${bvid}.json`);
    const dataRes = await fetch(dataUrl);
    if (!dataRes.ok) throw new Error(`${bvid}.json HTTP ${dataRes.status}`);
    const videoData = await dataRes.json();

    const p = state.currentPart;
    const list = (videoData.parts && videoData.parts[p]) || [];
    state.currentSegments = list.filter(s =>
      typeof s.start === 'number' && typeof s.end === 'number' && s.end > s.start
    );

    console.log(`[Epitaph] Loaded segments:`, state.currentSegments);
  } catch (e) {
    console.error('[Epitaph] 加载数据失败:', e);
  }
}

function onTimeUpdate() {
  if (!state.config.enabled) return;
  if (!state.video || state.currentSegments.length === 0) return;

  const t = state.video.currentTime;
  const seg = state.currentSegments.find(s => t >= s.start && t < s.end);

  if (seg) {
    if (!state.activeSegment || state.activeSegment.start !== seg.start) {
      state.activeSegment = seg;
      onEnterSegment(seg);
    }
  } else if (state.activeSegment) {
    onExitSegment(state.activeSegment);
    state.activeSegment = null;
  }
}

function onSeeking() {
  if (state.activeSegment) {
    onExitSegment(state.activeSegment);
    state.activeSegment = null;
  }
}

function onEnterSegment(seg) {
  const handling = getEffectiveHandling(seg);
  if (handling === 'ignore') {
    hideNotice();
    return;
  }
  if (handling === 'skip') {
    // 防止重复跳转
    if (state.lastSkippedStart !== seg.start) {
      state.lastSkippedStart = seg.start;
      skipTo(seg.end);
    }
    hideNotice();
    return;
  }
  // ask
  showNotice(seg);
}

function onExitSegment(seg) {
  hideNotice();
}

function getEffectiveHandling(seg) {
  // 若内容价值低于阈值，则无条件 skip
  const threshold = typeof state.config.minContentValue === 'number' ? state.config.minContentValue : 0.3;
  if (typeof seg.content_value === 'number' && seg.content_value < threshold) {
    return 'skip';
  }
  const byType = (state.config.adTypeHandling && state.config.adTypeHandling[seg.type]) || 'ask';
  return byType;
}

function skipTo(endTime) {
  if (!state.video) return;
  try {
    state.video.currentTime = endTime;
  } catch (e) {
    console.warn('Skip failed:', e);
  }
}

function ensureNoticeEl() {
  if (state.noticeEl && document.body.contains(state.noticeEl)) return;
  const el = document.createElement('div');
  el.id = 'schizoid-ad-notice';
  el.style.display = 'none';
  el.innerHTML = `
    <div class="schizoid-ad-card">
      <span class="schizoid-ad-text">前方有广告。要跳过吗？</span>
      <button class="schizoid-ad-btn" type="button">跳过广告</button>
    </div>
  `;
  document.body.appendChild(el);
  const btn = el.querySelector('.schizoid-ad-btn');
  btn.addEventListener('click', () => {
    if (state.activeSegment) skipTo(state.activeSegment.end);
    hideNotice();
  });
  state.noticeEl = el;
}

function showNotice(seg) {
  ensureNoticeEl();
  if (!state.noticeEl) return;
  state.noticeEl.style.display = 'block';
}

function hideNotice() {
  if (!state.noticeEl) return;
  state.noticeEl.style.display = 'none';
}

function getBvidFromUrl() {
  const m = location.href.match(/bilibili\.com\/video\/(BV\w+)/i);
  return m ? m[1] : null;
}

function getCurrentP() {
  const m = location.search.match(/[?&]p=(\d+)/);
  return m ? m[1] : '1';
}
