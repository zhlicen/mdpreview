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
