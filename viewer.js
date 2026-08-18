// 预览页逻辑。两种数据源：
//   'handle' —— File System Access API（「选择文件夹…」进入，句柄可持久化）
//   'url'    —— 地址栏 file:// 目录直开（?dir=C:/…，fetch 目录列表）
import { pickDir, restoreDir, requestAccess, forgetDir, listFiles, readFile, getExtConfig, buildTreeFromUrl, readFileFromUrl } from './fs.js';
import { t } from './i18n.js';
import { initTheme, cycleTheme } from './theme.js';

var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
// mermaid 初始化失败（如 CSP 限制）不拖死整页，仅失去图表渲染
try { mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default', securityLevel: 'loose' }); }
catch (e) { console.warn('mermaid init failed:', e); }
try { marked.setOptions({ gfm: true, breaks: false }); }
catch (e) { console.warn('marked init failed:', e); }

var treeEl = document.getElementById('tree');
var treeLoading = document.getElementById('treeLoading');
var docEl = document.getElementById('doc');
var crumb = document.getElementById('crumbPath');
var filterEl = document.getElementById('filter');
var countEl = document.getElementById('count');
var rootHandle = null;   // 当前目录句柄（handle 模式）
var current = null;      // 当前打开的文件（相对路径）
var currentDoc = null;   // 当前文档描述（img 时为 blob）
var fileCount = 0;
var extCfg = null;       // 后缀配置缓存
var mode = 'handle';     // 'handle' | 'url'
var urlBase = null;      // url 模式的目录路径（如 'C:/docs'）
var pendingSelect = null;// url 模式打开后要自动选中的文件
var params = new URLSearchParams(location.search);

document.getElementById('pickBtn').addEventListener('click', onPick);
document.getElementById('switchDirBtn').addEventListener('click', function () {
  onPick();
});
document.getElementById('settingsBtn').addEventListener('click', function () {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage)
    chrome.runtime.openOptionsPage();
});
var themeBtn = document.getElementById('themeBtn');
themeBtn.addEventListener('click', function () { updateThemeBtn(cycleTheme()); });

// ---------- 静态 UI 文案 / 主题图标 ----------
function updateThemeBtn(mode) {
  themeBtn.textContent = mode === 'light' ? '☀' : mode === 'dark' ? '🌙' : '🌓';
  themeBtn.title = mode === 'light' ? t('themeLight') : mode === 'dark' ? t('themeDark') : t('themeAuto');
}
function applyStaticTexts() {
  var ver = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
    ? ' v' + chrome.runtime.getManifest().version : '';
  document.getElementById('sideTitle').textContent = t('appName') + ver;
  document.getElementById('switchDirBtn').textContent = t('switchDir');
  document.getElementById('settingsBtn').title = t('settings');
  filterEl.placeholder = t('filter');
  document.getElementById('treeLoadingText').textContent = t('treeLoading');
  var h2 = docEl.querySelector('.welcome h2');
  var p = docEl.querySelector('.welcome p');
  var b = docEl.querySelector('.welcome .btn');
  if (h2) h2.textContent = t('appName');
  if (p) p.textContent = t('welcomeDesc');
  if (b) b.textContent = t('pickFolder');
}

// 环境自检：非扩展页面（被当成普通网页打开时）给出醒目提示，避免误判
function checkEnv() {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    var w = document.getElementById('envWarn');
    if (w) {
      w.style.display = 'block';
      w.textContent = t('envWarn');
    }
  }
}

// ---------- 路径工具 ----------
function dirOf(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
function resolveRel(base, rel) {
  if (rel.indexOf('/') === 0) return rel.slice(1);
  var parts = (base ? base.split('/') : []).concat(rel.split('/'));
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var s = parts[i];
    if (s === '' || s === '.') continue;
    if (s === '..') out.pop(); else out.push(s);
  }
  return out.join('/');
}

// ---------- 文件树 ----------
function renderTree(nodes, parent, depth) {
  nodes.forEach(function (n) {
    var el = document.createElement('div');
    if (n.type === 'dir') {
      el.className = 'node dir';
      el.textContent = '▾ ' + n.name;
      el.dataset.name = n.name;
      parent.appendChild(el);
      var kids = document.createElement('div');
      kids.className = 'kids';
      parent.appendChild(kids);
      renderTree(n.children, kids, depth + 1);
      el.onclick = function () {
        var hid = kids.classList.toggle('hidden');
        el.textContent = (hid ? '▸ ' : '▾ ') + n.name;
      };
      if (depth >= 0) { kids.classList.add('hidden'); el.textContent = '▸ ' + n.name; }
    } else {
      fileCount++;
      el.className = 'node file';
      el.textContent = (n.ext === '.mmd' ? '◆ ' : n.ext === '.json' ? '{} ' : '') + n.name;
      el.dataset.path = n.path;
      el.dataset.name = n.name;
      el.onclick = function () { location.hash = '#' + n.path; };
      parent.appendChild(el);
    }
  });
}

function loadTree() {
  treeLoading.classList.add('show');
  var p = (mode === 'url')
    ? buildTreeFromUrl(urlBase, extCfg)
    : listFiles(rootHandle);
  return p.then(function (d) {
      treeLoading.classList.remove('show');
      treeEl.innerHTML = ''; fileCount = 0;
      renderTree(d, treeEl, 0);
      countEl.textContent = t('filesCount', { n: fileCount });
      if (!fileCount) {
        docEl.innerHTML = '<div class="empty welcome"><h2>' + esc(t('noFilesTitle')) + '</h2><p>' +
          esc(t('noFilesMsg', { dir: (mode === 'url' ? urlBase : (rootHandle ? rootHandle.name : '')) })) + '</p></div>';
      }
      applyFilter();
      highlight();
    }).catch(function (e) {
      treeLoading.classList.remove('show');
      throw e; // 交给 initPage catch 处理
    });
}

// 重新加载后缀配置并刷新树（设置页修改后调用）
async function reloadConfig() {
  extCfg = await getExtConfig();
  if (mode === 'url' || rootHandle) loadTree();
}

function applyFilter() {
  var q = filterEl.value.trim().toLowerCase();
  var files = treeEl.querySelectorAll('.node.file');
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    f.classList.toggle('fhide', !!q && f.dataset.name.toLowerCase().indexOf(q) < 0);
  }
  // 自底向上：目录下没有可见文件时，把目录标签和子节点容器一起藏掉
  var kids = treeEl.querySelectorAll('.kids');
  for (var j = kids.length - 1; j >= 0; j--) {
    var k = kids[j];
    var empty = !k.querySelector('.node.file:not(.fhide)') && !k.querySelector('.kids:not(.fhide)');
    var hide = !!q && empty;
    k.classList.toggle('fhide', hide);
    var label = k.previousElementSibling;
    if (label && label.classList.contains('dir')) label.classList.toggle('fhide', hide);
  }
  if (q) {
    for (var m = 0; m < kids.length; m++) kids[m].classList.remove('hidden');
  }
}

function highlight() {
  var all = treeEl.querySelectorAll('.node.file');
  for (var i = 0; i < all.length; i++)
    all[i].classList.toggle('sel', all[i].dataset.path === current);
}

// ---------- 渲染 ----------
function splitFrontmatter(text) {
  if (text.slice(0, 4) !== '---' + String.fromCharCode(10)) return { fm: null, body: text };
  var end = text.indexOf(String.fromCharCode(10) + '---', 3);
  if (end < 0) return { fm: null, body: text };
  var nl = text.indexOf(String.fromCharCode(10), end + 1);
  return { fm: text.slice(4, end), body: nl < 0 ? '' : text.slice(nl + 1) };
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMermaidBlocks(root) {
  if (typeof mermaid === 'undefined' || !mermaid.run) return;
  var codes = root.querySelectorAll('code.language-mermaid');
  for (var i = 0; i < codes.length; i++) {
    var pre = codes[i].parentNode;
    var div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = codes[i].textContent;
    pre.parentNode.replaceChild(div, pre);
  }
  var nodes = root.querySelectorAll('.mermaid');
  if (nodes.length) {
    mermaid.run({ nodes: nodes }).catch(function (e) { console.warn('mermaid:', e); });
  }
}

// 站内链接 → hash；外部/资源链接 → 新标签页打开
function rewriteLinks(root, basePath) {
  var as = root.querySelectorAll('a[href]');
  for (var i = 0; i < as.length; i++) {
    (function (a) {
      var href = a.getAttribute('href');
      if (!href || href.indexOf('#') === 0) return;
      var frag = '', hi = href.indexOf('#');
      if (hi > -1) { frag = href.slice(hi + 1); href = href.slice(0, hi); }
      if (href === '') { a.setAttribute('href', '#' + frag); return; }
      if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener'; return; }
      var full = resolveRel(dirOf(basePath), href);
      var ext = (full.indexOf('.') > -1 ? '.' + full.slice(full.lastIndexOf('.') + 1).toLowerCase() : '');
      if (extCfg.doc.has(ext) || extCfg.img.has(ext)) {
        a.setAttribute('href', '#' + full);
      } else {
        a.setAttribute('href', full);
        a.target = '_blank';
      }
    })(as[i]);
  }
}

function showImage(doc) {
  const url = URL.createObjectURL(doc.blob);
  currentDoc = { url: url };
  docEl.innerHTML = '<div style="text-align:center"><img src="' + url + '" alt="' + esc(doc.path) + '"></div>';
}

function showDoc(d) {
  currentDoc = d;
  var html = '', fmHtml = '';
  if (d.kind === 'md') {
    var sp = splitFrontmatter(d.content);
    if (sp.fm) fmHtml = '<details class="fm"><summary>' + esc(t('frontmatter')) + '</summary><pre>' + esc(sp.fm) + '</pre></details>';
    html = marked.parse(sp.body);
  } else if (d.kind === 'mmd') {
    html = '<div class="mermaid">' + esc(d.content) + '</div>' +
      '<details class="fm"><summary>' + esc(t('mermaidSrc')) + '</summary><pre>' + esc(d.content) + '</pre></details>';
  } else if (d.kind === 'json') {
    var pretty = d.content;
    try { pretty = JSON.stringify(JSON.parse(d.content), null, 2); } catch (e) { }
    html = '<pre>' + esc(pretty) + '</pre>';
  } else {
    html = '<pre>' + esc(d.content) + '</pre>';
  }
  docEl.innerHTML = fmHtml + html;
  rewriteLinks(docEl, d.path);
  renderMermaidBlocks(docEl);
  docEl.parentNode.scrollTop = 0;
}

// ---------- 路由 ----------
function route() {
  var h = decodeURIComponent(location.hash.slice(1));
  if (!h) { clearDoc(); return; }
  current = h; highlight();
  var prefix = (mode === 'url') ? urlBase + '/' : (rootHandle ? rootHandle.name + '/' : '');
  crumb.textContent = prefix + h;
  var read = (mode === 'url') ? readFileFromUrl(urlBase, h) : readFile(rootHandle, h);
  read
    .then(function (d) {
      if (!d) { docEl.innerHTML = '<div class="err">' + esc(t('cannotRead') + h) + '</div>'; return; }
      if (d.kind === 'img') showImage(d); else showDoc(d);
    })
    .catch(function (e) {
      docEl.innerHTML = '<div class="err">' + esc(t('readFailed') + e.message) + '</div>';
    });
}

function clearDoc(msg) {
  if (!msg) msg = t('pickFromLeft');
  docEl.innerHTML = '<div class="empty">' + msg + '</div>';
  current = null; currentDoc = null; highlight();
  crumb.textContent = t('noDirSelected');
}

// ---------- 目录切换 ----------
function onPick() {
  pickDir(true)
    .then(function (h) {
      if (!h) return;
      rootHandle = h;
      mode = 'handle'; urlBase = null; pendingSelect = null;
      initPage();
    })
    .catch(function (e) {
      if (e && e.name === 'AbortError') return; // 用户取消
      docEl.innerHTML = '<div class="err">' + esc(t('pickFailed') + e.message) + '</div>';
    });
}

// 「只支持本地目录预览」提示视图（图标点在非 file:// 页面时）
function showNotLocal() {
  docEl.innerHTML =
    '<div class="empty welcome"><h2>' + esc(t('notLocalTitle')) + '</h2>' +
    '<p>' + esc(t('notLocalMsg')) + '</p>' +
    '<p style="font-size:12.5px">' + esc(t('fileAccessHint')) + '</p>' +
    '<div style="margin-top:10px"><button class="btn" id="pickBtn3">' + esc(t('pickFolder')) + '</button>' +
    ' <button class="btn" id="extSettingsBtn2" style="border-color:var(--accent);color:var(--accent)">' + esc(t('openExtSettings')) + '</button></div></div>';
  var b3 = document.getElementById('pickBtn3');
  if (b3) b3.addEventListener('click', onPick);
  var s2 = document.getElementById('extSettingsBtn2');
  if (s2) s2.addEventListener('click', function () {
    var id = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) || '';
    var url = 'chrome://extensions' + (id ? '?id=' + id : '');
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url: url });
  });
}

function enterError(msg, extra) {
  var buttons = '<button class="btn" id="pickBtn2">' + esc(t('pickFolder')) + '</button>';
  if (extra) buttons += ' <button class="btn" id="extSettingsBtn" style="border-color:var(--accent);color:var(--accent)">' + esc(t('openExtSettings')) + '</button>';
  docEl.innerHTML = '<div class="empty welcome"><h2>' + esc(t('accessDeniedTitle')) + '</h2><p>' + msg + '</p>' +
    '<div style="margin-top:10px">' + buttons + '</div></div>';
  document.getElementById('pickBtn2').addEventListener('click', onPick);
  var settingsBtn = document.getElementById('extSettingsBtn');
  if (settingsBtn) settingsBtn.addEventListener('click', function () {
    // 打开 chrome://extensions 并定位到当前扩展
    var id = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) || '';
    var url = 'chrome://extensions' + (id ? '?id=' + id : '');
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url: url });
  });
}

function initPage() {
  var title = (mode === 'url') ? urlBase : (rootHandle ? rootHandle.name : '');
  document.title = t('pageTitle') + ' · ' + title;
  clearDoc();
  loadTree()
    .then(function () {
      if (pendingSelect) {          // 地址栏指向的是文件：打开所在目录并选中它
        location.hash = '#' + pendingSelect;
        pendingSelect = null;
        return;
      }
      var h0 = decodeURIComponent(location.hash.slice(1));
      if (h0) location.hash = '#' + h0; // 触发重新加载新目录下的同名文件
    })
    .catch(function (e) {
      if (e && e.name === 'NotAllowedError') {
        enterError(esc(t('accessDeniedMsg')));
      } else if (mode === 'url') {
        // url 模式根因基本是 file:// 访问被拦；附真实原因和目标地址便于排查
        enterError(esc(t('fileAccessHint') + '\n[' + (e && e.message ? e.message : e) + '] ' +
          'URL: ' + (urlBase ? 'file:///' + urlBase : '')), true);
      } else {
        enterError(esc(t('treeFailed') + (e && e.message ? e.message : e)));
      }
    });
}

// ---------- 事件 ----------
window.addEventListener('hashchange', route);
filterEl.addEventListener('input', applyFilter);

// 设置页修改后缀时自动刷新文件树（非扩展环境下没有 chrome.storage，跳过）
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(function (changes) {
    if (changes.extConfig) reloadConfig();
  });
}

var drag = document.getElementById('drag'), side = document.getElementById('side'), dragging = false;
drag.addEventListener('mousedown', function () { dragging = true; document.body.style.userSelect = 'none'; });
window.addEventListener('mousemove', function (e) {
  if (!dragging) return;
  var w = Math.max(220, Math.min(e.clientX, window.innerWidth * 0.6));
  side.style.width = w + 'px';
});
window.addEventListener('mouseup', function () { dragging = false; document.body.style.userSelect = ''; });

// ---------- 启动 ----------
(async function init() {
  try {
    applyStaticTexts();
    checkEnv();
    updateThemeBtn(await initTheme());
    extCfg = await getExtConfig();

    if (params.get('err') === 'notlocal') {
      showNotLocal();                       // 图标点在非本地目录页：仅提示
      return;
    }
    var dirParam = params.get('dir');
    if (dirParam) {                         // 地址栏 file:// 目录直开
      mode = 'url'; urlBase = dirParam; pendingSelect = params.get('select');
      crumb.textContent = t('restoring');
      initPage();
      return;
    }
    restoreDir().then(function (h) {        // 直接打开预览页：恢复上次选过的目录
      if (h) {
        rootHandle = h;
        crumb.textContent = t('restoring');
        initPage();
      } else {
        // 没有可恢复的目录，停留在欢迎页
      }
    });
  } catch (e) {
    docEl.innerHTML = '<div class="err" style="margin:40px auto;max-width:640px">初始化失败: ' +
      esc((e && (e.stack || e.message)) || String(e)) + '</div>';
  }
})();
