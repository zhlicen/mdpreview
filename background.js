// 点击工具栏图标 / 页面右键菜单「md preview」→ 检测当前标签页地址栏：
//   file:// 本地目录 → 预览页直接打开该目录（免选择器）
//   其他页面       → 预览页提示只支持本地目录预览
import { parseFileUrl } from './urlutil.js';

const VIEWER_URL = chrome.runtime.getURL('viewer.html');

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'mdpreview-open',
      // __MSG_...__ 只在 manifest 里生效，运行时 API 要用 chrome.i18n.getMessage
      title: chrome.i18n.getMessage('ctxMenuTitle') || 'md preview',
      contexts: ['page'],
    });
  });
});

// 复用已打开的预览标签页（改 URL 触发重新加载），否则新建
async function openViewer(search) {
  const url = VIEWER_URL + search;
  const [tab] = await chrome.tabs.query({ url: VIEWER_URL + '*' });
  if (tab) await chrome.tabs.update(tab.id, { url, active: true });
  else await chrome.tabs.create({ url });
}

async function onInvoke(tab) {
  const raw = (tab && (tab.url || tab.pendingUrl)) || '';

  // 已经在预览页上点击：仅聚焦，不打断当前状态
  if (raw.indexOf(VIEWER_URL) === 0) {
    const [viewer] = await chrome.tabs.query({ url: VIEWER_URL + '*' });
    if (viewer) { await chrome.tabs.update(viewer.id, { active: true }); return; }
  }

  const parsed = parseFileUrl(raw);
  if (parsed) {
    let q = '?dir=' + encodeURIComponent(parsed.dir);
    if (parsed.select) q += '&select=' + encodeURIComponent(parsed.select);
    await openViewer(q);
  } else {
    await openViewer('?err=notlocal');
  }
}

chrome.action.onClicked.addListener(onInvoke);
chrome.contextMenus.onClicked.addListener((info, tab) => onInvoke(tab));
