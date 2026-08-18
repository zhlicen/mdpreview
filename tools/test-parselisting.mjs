// parseListing 验证：用真实 Chrome 目录列表 HTML（含 addRow 脚本 + 渲染后锚点）。
// 用法: node tools/test-parselisting.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseListing } from '../fs.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, 'fixture-listing.html'), 'utf8');

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log('PASS: ' + name);
  else { failed++; console.log('FAIL: ' + name + (extra ? ' → ' + extra : '')); }
}

const entries = parseListing(html);
const names = entries.map(e => e.name);
const dirs = entries.filter(e => e.isDir).map(e => e.name);

check('解析出非空条目', entries.length > 5, JSON.stringify(entries.slice(0, 3)));
check('目录项识别正确', dirs.includes('dwd') && dirs.includes('node_modules') && dirs.includes('outputs'),
  JSON.stringify(dirs.slice(0, 8)));
check('文件项识别正确', names.includes('DESIGN-docwiki.md') && names.includes('UPDATE.md'),
  JSON.stringify(names));
check('隐藏项（.claude 等）被过滤', !names.includes('.claude') && !names.includes('.wiki-src'),
  JSON.stringify(names));
check('父目录/伪条目不存在', !names.includes('..') && !names.includes('') && !names.some(n => n.includes('/..')));

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
