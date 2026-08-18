// 主题管理：'auto'（跟随浏览器/系统）| 'light' | 'dark'，存 chrome.storage.local。
// CSS 按 <html data-theme="dark|light"> 切换；auto 模式监听系统主题变化。

const THEME_KEY = 'theme';
const mq = window.matchMedia('(prefers-color-scheme: dark)');
let current = 'auto';

function storageOk() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

function resolve(mode) {
  return mode === 'light' || mode === 'dark' ? mode : (mq.matches ? 'dark' : 'light');
}

export function applyTheme(mode) {
  if (mode === 'light' || mode === 'dark') current = mode; else current = 'auto';
  document.documentElement.dataset.theme = resolve(current);
}

export function getTheme() {
  if (!storageOk()) return Promise.resolve('auto');
  return new Promise((res) => chrome.storage.local.get(THEME_KEY, (d) => res(d[THEME_KEY] || 'auto')));
}

export function setTheme(mode) {
  applyTheme(mode);
  if (storageOk()) chrome.storage.local.set({ [THEME_KEY]: current });
  return current;
}

// 工具栏按钮循环切换：auto → light → dark → auto
export function cycleTheme() {
  const order = ['auto', 'light', 'dark'];
  return setTheme(order[(order.indexOf(current) + 1) % order.length]);
}

// 页面启动时调用：应用存储的主题，并监听后续变化
export async function initTheme() {
  current = await getTheme();
  applyTheme(current);
  mq.addEventListener('change', () => applyTheme(current));
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[THEME_KEY]) applyTheme(changes[THEME_KEY].newValue || 'auto');
    });
  }
  return current;
}
