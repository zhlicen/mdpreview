// urlutil 纯函数验证：file:// URL ↔ 路径互转。
// 用法: node tools/test-urlutil.mjs
import { fileUrl, parseFileUrl } from '../urlutil.js';

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log('PASS: ' + name);
  else { failed++; console.log('FAIL: ' + name + (extra ? ' → ' + extra : '')); }
}

// ---------- parseFileUrl ----------
check('目录 URL（尾斜杠）',
  JSON.stringify(parseFileUrl('file:///C:/zhou/dir/')) === JSON.stringify({ dir: 'C:/zhou/dir', select: null }),
  JSON.stringify(parseFileUrl('file:///C:/zhou/dir/')));

check('文件 URL → 父目录 + select',
  JSON.stringify(parseFileUrl('file:///C:/zhou/dir/readme.md')) === JSON.stringify({ dir: 'C:/zhou/dir', select: 'readme.md' }),
  JSON.stringify(parseFileUrl('file:///C:/zhou/dir/readme.md')));

check('编码中文目录',
  parseFileUrl('file:///C:/%E6%B5%8B%E8%AF%95/')?.dir === 'C:/测试',
  JSON.stringify(parseFileUrl('file:///C:/%E6%B5%8B%E8%AF%95/')));

check('编码中文文件',
  parseFileUrl('file:///C:/%E6%B5%8B%E8%AF%95/%E7%AC%94%E8%AE%B0.md')?.select === '笔记.md',
  JSON.stringify(parseFileUrl('file:///C:/%E6%B5%8B%E8%AF%95/%E7%AC%94%E8%AE%B0.md')));

check('反斜杠路径归一化',
  parseFileUrl('file:///C:/a%5Cb/')?.dir === 'C:/a/b',
  JSON.stringify(parseFileUrl('file:///C:/a%5Cb/')));

check('https 页面 → null', parseFileUrl('https://example.com/') === null);
check('chrome-extension 页面 → null', parseFileUrl('chrome-extension://abc/viewer.html') === null);
check('空值 → null', parseFileUrl('') === null && parseFileUrl(null) === null);
check('根路径 file:/// → null', parseFileUrl('file:///') === null);
check('盘符根 file:///C:/ → 保留', parseFileUrl('file:///C:/')?.dir === 'C:');

// ---------- fileUrl ----------
check('基本拼接',
  fileUrl('C:/zhou', 'docs/a.md') === 'file:///C:/zhou/docs/a.md',
  fileUrl('C:/zhou', 'docs/a.md'));

check('反斜杠 basePath 归一化',
  fileUrl('C:\\zhou\\d', '') === 'file:///C:/zhou/d',
  fileUrl('C:\\zhou\\d', ''));

check('中文与空格逐段编码',
  fileUrl('C:/测试', 'a b.md') === 'file:///C:/%E6%B5%8B%E8%AF%95/a%20b.md',
  fileUrl('C:/测试', 'a b.md'));

check('与 parseFileUrl 往返一致',
  fileUrl(parseFileUrl('file:///C:/%E6%96%87%E6%A1%A3/readme.md').dir, 'readme.md') === 'file:///C:/%E6%96%87%E6%A1%A3/readme.md');

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
