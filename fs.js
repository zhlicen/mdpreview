// 本地目录访问封装：基于 File System Access API。
// 目录句柄可持久化（首次授权后，以后打开预览页无需重新选择目录）。
//
// 常用文件系统操作依赖用户手势（showDirectoryPicker / requestPermission），
// 所以「选择目录」「换一个目录」「重新授权」三个入口都挂在按钮上。
//
// 另有一条 file:// 直开通道（buildTreeFromUrl / readFileFromUrl）：
// 由地址栏 file:// 目录触发，用 fetch 读目录列表和文件内容，
// 需要 host_permissions file:///* 且用户开启「允许访问文件网址」。
import { fileUrl } from './urlutil.js';

// 存储：IndexedDB（chunked 上限比 localStorage 大得多，也可以存句柄）
const DB_NAME = 'mdviewer-fs';
const DB_VERSION = 1;
const STORE = 'kv';
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function kvGet(key) {
  const db = await idb();
  return new Promise((resolve) => {
    const r = db.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(undefined);
  });
}
async function kvSet(key, value) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------- 目录选择与持久化 ----------------

// 让用户选一个目录（必须在用户手势里调用）。
// persist: 是否把句柄存到 IndexedDB 供下次自动恢复。
// 返回 dirHandle，未选择时返回 null。
export async function pickDir(persist = true) {
  const handle = await window.showDirectoryPicker({ mode: 'read' });
  if (!handle) return null;
  if (persist) await kvSet('dir', handle);
  return handle;
}

// 恢复上次持久化的目录。Chrome 会校验目录句柄是否仍可用；
// 如果被撤销了权限会抛异常，需要用户重新选择。
export async function restoreDir() {
  let handle;
  try {
    handle = await kvGet('dir');
  } catch (e) {
    return null;
  }
  if (!handle) return null;
  try {
    const state = await handle.queryPermission({ mode: 'read' });
    if (state !== 'granted') {
      // queryPermission 已降权为 onlyOnGesture。直接尝试读一点内容验证可用性。
      const it = handle.entries();
      const r = await it.next();
      if (r.done) return handle; // 空目录
    }
    return handle;
  } catch (e) {
    await kvSet('dir', undefined); // 句柄已失效，清掉
    return null;
  }
}

// 重新申请权限（某些浏览器对持久化句柄会在会话间降权）。
export async function requestAccess(handle) {
  const state = await handle.queryPermission({ mode: 'read' });
  if (state === 'granted') return true;
  const res = await handle.requestPermission({ mode: 'read' });
  return res === 'granted';
}

export async function forgetDir() {
  await kvSet('dir', undefined);
}

// ---------------- 文件系统浏览 ----------------

// 默认后缀（首次安装或 storage 为空时使用）
const DEFAULT_EXT_CONFIG = {
  doc:   ['md', 'mmd'],
  img:   ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'],
  other: [],
  hideEmptyDirs: true,
};

// 从 storage 读取后缀配置，返回 { doc:Set, img:Set, other:Set, hideEmptyDirs:bool }
// 非 extension 环境（chrome.storage 不存在，比如直接当网页打开）回退默认值。
export async function getExtConfig() {
  const toCfg = (raw) => {
    const c = raw || DEFAULT_EXT_CONFIG;
    const toSet = (arr) => new Set((arr || []).map((s) => '.' + String(s).replace(/^\./, '').toLowerCase()));
    const cfg = {
      doc:   toSet(c.doc   || DEFAULT_EXT_CONFIG.doc),
      img:   toSet(c.img   || DEFAULT_EXT_CONFIG.img),
      other: toSet(c.other || DEFAULT_EXT_CONFIG.other),
      hideEmptyDirs: c.hideEmptyDirs !== false,
    };
    // 三项全空会直接导致文件树为空，回退默认配置
    if (!cfg.doc.size && !cfg.img.size && !cfg.other.size) return toCfg(DEFAULT_EXT_CONFIG);
    return cfg;
  };
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return toCfg(DEFAULT_EXT_CONFIG);
  }
  return new Promise((resolve) => {
    chrome.storage.local.get('extConfig', (data) => resolve(toCfg(data.extConfig)));
  });
}

// 递归扫描目录，返回与服务器版一致的 {type,name,path,children} 树。
// extCfg: 由 getExtConfig() 返回的 { doc, img, other } Set 对象。
export async function buildTree(root, extCfg) {
  async function walk(dir, rel) {
    const dirs = [];
    const files = [];
    for await (const e of dir.entries()) {
      const name = e[0];
      if (name.startsWith('.')) continue; // 隐藏文件/目录
      const abs = e[1];
      if (abs.kind === 'directory') {
        const children = await walk(abs, rel + name + '/');
        // 隐藏空目录：子树里没有可显示文件时不保留该目录
        if (children.length || !extCfg.hideEmptyDirs) {
          dirs.push({ type: 'dir', name, path: (rel + name).split('\\').join('/'), children });
        }
      } else {
        const ext = (name.slice(name.lastIndexOf('.')).toLowerCase());
        const keep = extCfg.doc.has(ext) || extCfg.img.has(ext) || extCfg.other.has(ext);
        if (keep) {
          files.push({ type: 'file', name, ext, path: (rel + name).split('\\').join('/') });
        }
      }
    }
    const order = (a, b) => a.name.localeCompare(b.name, 'zh');
    return [...dirs.sort(order), ...files.sort(order)];
  }
  return walk(root, '');
}

// 读取目录树。walk 中如果有权限失效会抛异常；不会吞，交给调用方提示重新授权。
export async function listFiles(root) {
  const extCfg = await getExtConfig();
  return buildTree(root, extCfg);
}

// 按 '/' 分隔路径取文件句柄：前面各段走目录，最后一段走 getFileHandle。
// 取不到返回 null（不会抛）。
export async function getFileHandle(root, rel) {
  const parts = String(rel).split('/').filter((s) => s !== '' && s !== '.');
  if (!parts.length) return null;
  const fileName = parts.pop();
  let cur = root;
  for (const part of parts) {
    if (cur.kind !== 'directory') return null;
    cur = await cur.getDirectoryHandle(part, { create: false }).catch(() => null);
    if (!cur) return null;
  }
  return cur.getFileHandle(fileName, { create: false }).catch(() => null);
}

// 读文件；图片类返回 blob，其余返回文本。
export async function readFile(root, rel) {
  const handle = await getFileHandle(root, rel);
  if (!handle) return null;
  const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase();
  const extCfg = await getExtConfig();
  if (extCfg.img.has(ext)) {
    const file = await handle.getFile();
    return { path: rel, kind: 'img', blob: file };
  }
  const file = await handle.getFile();
  const content = await file.text();
  const kind = ext === '.mmd' ? 'mmd'
    : extCfg.doc.has(ext) ? 'md'
    : ext === '.json' ? 'json'
    : 'text';
  return { path: rel, kind, content, size: file.size, mtime: file.lastModified };
}

// ---------------- file:// 直开通道 ----------------

// XHR 读取 file://：fetch() 对 file:// 即使扩展页也会被拦，
// XHR 是扩展读本地文件的成熟路径（需「允许访问文件网址」）。
function xhrFile(url, type) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    if (type) xhr.responseType = type;
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) resolve(type ? xhr.response : xhr.responseText);
      else reject(new Error('HTTP ' + xhr.status));
    };
    xhr.onerror = () => reject(new Error('xhr error (file access denied or missing)'));
    xhr.send();
  });
}

// 解析 Chrome 的 file:// 目录列表页，返回子项 [{name, isDir}]。
// Chrome 的列表页不是静态 HTML：条目由 addRow("name","url",isdir,...) 脚本调用生成，
// DOMParser 不会执行脚本，所以必须从原始 HTML 里直接提取 addRow 参数。
export function parseListing(html) {
  const out = [];
  const re = /addRow\("([^"]*)"\s*,\s*"([^"]*)"\s*,\s*([01])\s*,/g;
  let m;
  while ((m = re.exec(html))) {
    const name = m[1], isDir = m[3] === '1';
    if (!name || name === '.' || name === '..' || name.startsWith('.')) continue; // 隐藏项
    out.push({ name, isDir });
  }
  if (out.length) return out; // 正常拿到 addRow 数据
  // 兜底：某些环境下拿到的是渲染后的 HTML（<a> 锚点 + 绝对路径）
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || '';
    if (!href || href[0] === '#' || href[0] === '?') continue; // 排序链接等
    if (href.startsWith('../') || href.indexOf('/..') > -1) continue; // 父目录
    let name;
    try { name = decodeURIComponent(href); } catch (e) { name = href; }
    const isDir = name.endsWith('/');
    if (isDir) name = name.slice(0, -1);
    const i = name.lastIndexOf('/');   // 绝对路径（/C:/.../name）取最后一段
    if (i > -1) name = name.slice(i + 1);
    if (!name || name === '.' || name === '..' || name.startsWith('.')) continue;
    out.push({ name, isDir });
  }
  return out;
}

// 与 buildTree 相同的过滤规则，数据源换成 XHR 目录列表。
// 需要「允许访问文件网址」，失败时抛异常由调用方提示。
export async function buildTreeFromUrl(basePath, extCfg) {
  async function walk(rel) {
    const html = await xhrFile(fileUrl(basePath, rel) + '/'); // 目录请求带尾斜杠
    // 被拦截的 file:// 请求有时不触发 onerror，而是 onload + 空响应，
    // 会把权限问题误报成「没有可显示的文件」。目录列表必然是 HTML，
    // 拿不到 HTML 一律视为无权限/不可读。
    if (!html || html.indexOf('<') === -1) {
      throw new Error('directory listing unavailable (likely file access denied)');
    }
    const entries = parseListing(html);
    const dirs = [], files = [];
    for (const e of entries) {
      if (e.isDir) {
        const children = await walk(rel + e.name + '/');
        if (children.length || !extCfg.hideEmptyDirs) {
          dirs.push({ type: 'dir', name: e.name, path: rel + e.name, children });
        }
      } else {
        const ext = e.name.indexOf('.') > -1 ? e.name.slice(e.name.lastIndexOf('.')).toLowerCase() : '';
        if (extCfg.doc.has(ext) || extCfg.img.has(ext) || extCfg.other.has(ext)) {
          files.push({ type: 'file', name: e.name, ext, path: rel + e.name });
        }
      }
    }
    const order = (a, b) => a.name.localeCompare(b.name, 'zh');
    return [...dirs.sort(order), ...files.sort(order)];
  }
  return walk('');
}

export async function readFileFromUrl(basePath, rel) {
  const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase();
  const extCfg = await getExtConfig();
  if (extCfg.img.has(ext)) {
    const blob = await xhrFile(fileUrl(basePath, rel), 'blob');
    return { path: rel, kind: 'img', blob };
  }
  const content = await xhrFile(fileUrl(basePath, rel));
  const kind = ext === '.mmd' ? 'mmd'
    : extCfg.doc.has(ext) ? 'md'
    : ext === '.json' ? 'json'
    : 'text';
  return { path: rel, kind, content };
}
