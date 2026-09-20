// file:// URL 与本地路径互转的纯函数（background.js 与 fs.js 共用，Node 可测）。

// basePath 'C:/docs' + rel 'a/b.md' → 'file:///C:/docs/a/b.md'（逐段编码；冒号在路径段合法，保留）
export function fileUrl(basePath, rel = '') {
  const segs = String(basePath || '').split(/[\\/]/)
    .concat(String(rel || '').split('/'))
    .filter((s) => s !== '' && s !== '.');
  return 'file:///' + segs.map((s) => encodeURIComponent(s).replace(/%3A/gi, ':')).join('/');
}

// 'file:///C:/docs/' → {dir:'C:/docs'}；'file:///C:/docs/a.md' → {dir:'C:/docs', select:'a.md'}
// 非 file:// 页面、根路径等无法预览的情况返回 null。
export function parseFileUrl(rawUrl) {
  if (!rawUrl || rawUrl.indexOf('file:///') !== 0) return null;
  let path = rawUrl.slice(8).split('#')[0].split('?')[0];
  if (!path || path === '/') return null;
  let dir, select = null;
  if (path.endsWith('/')) {
    dir = path.slice(0, -1);
  } else {
    const i = path.lastIndexOf('/');
    dir = path.slice(0, i);
    select = path.slice(i + 1);
    if (!dir || !select) return null;
  }
  try {
    dir = decodeURIComponent(dir);
    if (select) select = decodeURIComponent(select);
  } catch (e) {
    return null;
  }
  if (!dir) return null;
  return { dir: dir.split('\\').join('/'), select };
}

// ---------------- 文档内相对引用路径 ----------------

// 取所在目录：'a/b/c.md' → 'a/b'；无目录返回 ''
export function dirOf(p) {
  const i = String(p).lastIndexOf('/');
  return i < 0 ? '' : String(p).slice(0, i);
}

// 相对路径解析：resolveRel('a/b', '../x/y.md') → 'x/y.md'
// 以 '/' 开头视为根相对（去掉前导斜杠）
export function resolveRel(base, rel) {
  if (String(rel).indexOf('/') === 0) return String(rel).slice(1);
  const parts = (base ? String(base).split('/') : []).concat(String(rel).split('/'));
  const out = [];
  for (const s of parts) {
    if (s === '' || s === '.') continue;
    if (s === '..') out.pop(); else out.push(s);
  }
  return out.join('/');
}

// 解析 Markdown 里的引用（图片/链接）：以文档路径为基准，返回绝对（相对根）路径。
// 处理 ./ ../、百分号编码、# 锚点与 ? 查询参数。无法解析时返回 null。
export function resolveDocRef(docPath, ref) {
  if (!ref) return null;
  const s = String(ref);
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.indexOf('//') === 0) return null; // http:, data:, file: 等
  let clean = s.split('#')[0].split('?')[0];
  if (!clean) return null;
  let decoded = clean;
  try { decoded = decodeURIComponent(clean); } catch (e) { /* 保留原文 */ }
  return resolveRel(dirOf(docPath), decoded);
}
