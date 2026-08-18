// 主题管理：light / dark，存 chrome.storage.local。
// 默认跟随系统主题；用户切换后记住选择。

const THEME_KEY = 'theme';
const mq = window.matchMedia('(prefers-color-scheme: dark)');
let current = mq.matches ? 'dark' : 'light';

function storageOk() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

export function applyTheme(mode) {
  current = (mode === 'light' || mode === 'dark') ? mode : (mq.matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = current;
}

export function getTheme() {
  if (!storageOk()) return Promise.resolve(null);
  return new Promise((res) => chrome.storage.local.get(THEME_KEY, (d) => res(d[THEME_KEY] || null)));
}

export function setTheme(mode) {
  applyTheme(mode);
  if (storageOk()) chrome.storage.local.set({ [THEME_KEY]: current });
  return current;
}

// 工具栏按钮：light ↔ dark 切换
export function toggleTheme() {
  return setTheme(current === 'dark' ? 'light' : 'dark');
}

// 页面启动时调用：读取存储（有则用，无则跟随系统），并监听后续变化
export async function initTheme() {
  const saved = await getTheme();
  applyTheme(saved); // saved 为 null 时回退系统主题
  mq.addEventListener('change', () => {
    // 系统主题变化时，仅在无用户保存的偏好时跟随
    if (!storageOk()) { applyTheme(mq.matches ? 'dark' : 'light'); }
    else chrome.storage.local.get(THEME_KEY, (d) => {
      if (!d[THEME_KEY]) applyTheme(mq.matches ? 'dark' : 'light');
    });
  });
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[THEME_KEY]) applyTheme(changes[THEME_KEY].newValue);
    });
  }
  return current;
}
