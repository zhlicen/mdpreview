// buildTree + readFile + 空目录/后缀过滤 验证：模拟真实 FileSystemDirectoryHandle。
// 用法: node tools/test-buildtree.mjs
import { buildTree, getExtConfig, readFile } from '../fs.js';

// 可切换的 storage mock（模拟 chrome.storage.local）
let stored = {};
globalThis.chrome = {
  storage: {
    local: {
      get: (key, cb) => cb(stored),
    },
  },
};

// 模拟文件句柄
function file(name, content = '') {
  return {
    kind: 'file',
    async getFile() {
      return new File([content], name, { type: 'text/plain' });
    },
  };
}
// 模拟目录句柄：entries() 异步迭代 + getDirectoryHandle/getFileHandle
function dir(children) {
  return {
    kind: 'directory',
    async *entries() {
      for (const [name, handle] of Object.entries(children)) yield [name, handle];
    },
    getDirectoryHandle: async (name) => {
      const h = children[name];
      if (!h || h.kind !== 'directory') throw new Error('NotFoundError');
      return h;
    },
    getFileHandle: async (name) => {
      const h = children[name];
      if (!h || h.kind !== 'file') throw new Error('NotFoundError');
      return h;
    },
  };
}

const mockRoot = dir({
  'docs': dir({
    'a.md': file('a.md', '# hello'),
    'b.mmd': file('b.mmd', 'graph TD; A-->B'),
    'img': dir({
      'pic.png': file('pic.png', 'binary'),
    }),
    'data.json': file('data.json', '{"x":1}'),
  }),
  'note.md': file('note.md', '# root note'),
  'onlyjs': dir({ 'app2.js': file('app2.js', 'console.log(1)') }), // 只有被过滤的文件
  'reallyempty': dir({}),                                          // 真空目录
  'app.js': file('app.js', 'console.log(1)'),
});

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log('PASS: ' + name);
  else { failed++; console.log('FAIL: ' + name + (extra ? ' → ' + extra : '')); }
}
function flatten(tree) {
  const out = [];
  (function walk(nodes) {
    for (const n of nodes) {
      if (n.type === 'dir') { out.push(n.path + '/'); walk(n.children); }
      else out.push(n.path);
    }
  })(tree);
  return out;
}

// ---------- 默认配置 + 隐藏空目录 ----------
stored = {};
let cfg = await getExtConfig();
check('默认 hideEmptyDirs = true', cfg.hideEmptyDirs === true);

let tree = await buildTree(mockRoot, cfg);
let flat = flatten(tree);
check('默认：空目录与纯 js 目录被隐藏',
  JSON.stringify(flat) === JSON.stringify([
    'docs/', 'docs/img/', 'docs/img/pic.png', 'docs/a.md', 'docs/b.mmd', 'docs/data.json', 'note.md',
  ]), JSON.stringify(flat));

// ---------- hideEmptyDirs = false ----------
stored = { extConfig: { hideEmptyDirs: false } };
cfg = await getExtConfig();
check('读取 hideEmptyDirs = false', cfg.hideEmptyDirs === false);

tree = await buildTree(mockRoot, cfg);
flat = flatten(tree);
check('关闭后：空目录保留（文件仍按后缀过滤）',
  flat.includes('onlyjs/') && flat.includes('reallyempty/') && !flat.includes('onlyjs/app2.js'),
  JSON.stringify(flat));

// ---------- 自定义后缀过滤生效 ----------
stored = { extConfig: { doc: ['md'], img: [], other: [], hideEmptyDirs: true } };
cfg = await getExtConfig();
tree = await buildTree(mockRoot, cfg);
flat = flatten(tree);
check('自定义配置（只留 md）：mmd/json/图片全部滤掉',
  JSON.stringify(flat) === JSON.stringify(['docs/', 'docs/a.md', 'note.md']),
  JSON.stringify(flat));

// ---------- readFile ----------
stored = {};
const cases = [
  ['docs/a.md', 'md', '# hello'],
  ['note.md', 'md', '# root note'],
  ['docs/b.mmd', 'mmd', 'graph TD; A-->B'],
  ['docs/data.json', 'json', '{"x":1}'],
];
for (const [path, wantKind, wantContent] of cases) {
  const d = await readFile(mockRoot, path);
  check(`readFile(${path})`, !!d && d.kind === wantKind && d.content === wantContent,
    d ? `kind=${d.kind} content=${JSON.stringify(d.content)}` : '返回 null');
}

const img = await readFile(mockRoot, 'docs/img/pic.png');
check('readFile(嵌套图片) 返回 blob', !!img && img.kind === 'img' && img.blob instanceof File,
  img ? `kind=${img.kind}` : '返回 null');
check('readFile(不存在的文件) 返回 null', (await readFile(mockRoot, 'docs/nope.md')) === null);
check('readFile(传了目录路径) 返回 null', (await readFile(mockRoot, 'docs')) === null);

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
