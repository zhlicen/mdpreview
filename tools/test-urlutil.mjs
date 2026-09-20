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


// ---------- 文档内相对引用（图片/链接路径） ----------
import { dirOf, resolveRel, resolveDocRef } from '../urlutil.js';

check('dirOf 取目录', dirOf('docs/a/b.md') === 'docs/a' && dirOf('a.md') === '');
check('resolveRel 同级', resolveRel('docs', './pic.png') === 'docs/pic.png');
check('resolveRel 上一级', resolveRel('docs/sub', '../img/x.png') === 'docs/img/x.png');
check('resolveRel 根相对', resolveRel('docs', '/top.png') === 'top.png');

check('图片：./ 前缀', resolveDocRef('docs/readme.md', './test-image.png') === 'docs/test-image.png',
  String(resolveDocRef('docs/readme.md', './test-image.png')));
check('图片：根目录文档', resolveDocRef('渲染测试.md', './test-image.png') === 'test-image.png',
  String(resolveDocRef('渲染测试.md', './test-image.png')));
check('图片：中文路径编码', resolveDocRef('测试/a.md', './图片.png') === '测试/图片.png');
check('图片：百分号编码', resolveDocRef('docs/a.md', './my%20image.png') === 'docs/my image.png');
check('图片：带查询串/锚点', resolveDocRef('docs/a.md', './p.png?v=2#x') === 'docs/p.png');
check('图片：http 外链不处理', resolveDocRef('docs/a.md', 'https://x.com/a.png') === null);
check('图片：data URI 不处理', resolveDocRef('docs/a.md', 'data:image/png;base64,AAA') === null);
check('图片：file: 协议不处理', resolveDocRef('docs/a.md', 'file:///C:/a.png') === null);
check('图片：空引用返回 null', resolveDocRef('docs/a.md', '') === null);

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
