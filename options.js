// 选项页逻辑：读写 chrome.storage.local 中的文件后缀配置。
// extConfig 格式: { doc: ['md','mmd'], img: [...], hideEmptyDirs: bool }
// 'other' 后缀（默认 json）由 fs.js 内置，不再暴露设置。
import { t } from './i18n.js';
import { initTheme } from './theme.js';

const DEFAULTS = {
  doc:  ['md', 'mmd'],
  img:  ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'],
  hideEmptyDirs: true,
};

const $doc  = document.getElementById('docExt');
const $img  = document.getElementById('imgExt');
const $hide = document.getElementById('hideEmptyDirs');
const $msg  = document.getElementById('msg');

// 静态文案（data-i18n 属性）+ 标题
document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
document.title = t('optTitle');

// 主题初始化（跟随系统/存储，保证设置页本身主题正确）
await initTheme();

// 读取并填充表单
chrome.storage.local.get('extConfig', (data) => {
  const cfg = data.extConfig || DEFAULTS;
  $doc.value  = (cfg.doc  || DEFAULTS.doc).join(',');
  $img.value  = (cfg.img  || DEFAULTS.img).join(',');
  $hide.checked = cfg.hideEmptyDirs !== false;
});

// 保存（不写 other，fs.js 会回退内置默认）
document.getElementById('saveBtn').addEventListener('click', () => {
  const parse = (s) => s.split(',').map(s => s.trim().toLowerCase().replace(/^\./, '')).filter(Boolean);
  const cfg = {
    doc:  parse($doc.value),
    img:  parse($img.value),
    hideEmptyDirs: $hide.checked,
  };
  if (!cfg.doc.length && !cfg.img.length) {
    $msg.textContent = t('extAllEmpty');
    return;
  }
  chrome.storage.local.set({ extConfig: cfg }, () => {
    $msg.textContent = t('savedMsg');
    setTimeout(() => { $msg.textContent = ''; }, 3000);
  });
});
