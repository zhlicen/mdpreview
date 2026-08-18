// 页面文案 i18n：跟随浏览器语言（zh* → 中文，其余 → 英文）。
// manifest 名称/描述的本地化走 _locales + chrome.i18n，与此处各自独立。

const DICT = {
  en: {
    appName: 'mdpreview',
    pageTitle: 'mdpreview',
    switchDir: 'Change folder',
    settings: 'Settings',
    filter: 'Filter files…',
    pickFolder: 'Choose folder…',
    welcomeDesc: 'Pick a local folder to browse and render its Markdown / Mermaid documents in the browser. The folder is remembered for next time.',
    pickFromLeft: '← Pick a document from the left',
    noDirSelected: 'No folder selected',
    restoring: 'Restoring folder, loading…',
    filesCount: '{n} files',
    treeLoading: 'Scanning folder…',
    cannotRead: 'Cannot read: ',
    readFailed: 'Read failed: ',
    pickFailed: 'Failed to pick folder: ',
    accessDeniedTitle: 'Cannot access folder',
    accessDeniedMsg: 'Folder permission was denied. Please choose the folder again.',
    treeFailed: 'Failed to read folder: ',
    notLocalTitle: 'Cannot preview',
    notLocalMsg: 'Only local folder preview is supported. Open a local folder in the address bar (file://…), then click the extension icon or right-click and choose "md preview" — or pick a folder directly below.',
    fileAccessHint: 'Tip: if the address bar already shows a local folder, enable "Allow access to file URLs" in the extension settings.',
    openExtSettings: 'Open extension settings',
    noFilesTitle: 'Nothing to show',
    noFilesMsg: 'No displayable files (per your extension settings) under "{dir}". Adjust the file extensions in Settings, or switch folder.',
    frontmatter: 'Frontmatter',
    mermaidSrc: 'Mermaid source',
    themeAuto: 'Theme: follow browser',
    themeLight: 'Theme: light',
    themeDark: 'Theme: dark',
    optTitle: 'mdpreview · Settings',
    optHeading: 'mdpreview · Settings',
    secExt: 'Visible file extensions',
    docExtLabel: 'Documents',
    imgExtLabel: 'Images',
    hintSep: 'Comma separated, without the leading dot.',
    hideEmpty: 'Hide empty folders (folders with no visible files)',
    optThemeAuto: 'Follow browser',
    optThemeLight: 'Light',
    optThemeDark: 'Dark',
    save: 'Save',
    savedMsg: 'Saved. The viewer refreshes automatically.',
    envWarn: 'This is not the extension page (no extension environment), so local files cannot be read. Close this tab and open mdpreview from the Chrome toolbar.',
    extAllEmpty: 'Keep at least one extension — otherwise the file tree would be empty and nothing would save.',
  },
  zh: {
    appName: 'mdpreview',
    pageTitle: 'mdpreview',
    switchDir: '切换目录',
    settings: '设置',
    filter: '过滤文件…',
    pickFolder: '选择文件夹…',
    welcomeDesc: '点击下方按钮选择一个本地文件夹，即可在浏览器中浏览并渲染其中的 Markdown / Mermaid 文档。首次选择后目录会在下次打开时自动恢复。',
    pickFromLeft: '← 从左边选一个文档',
    noDirSelected: '未选择目录',
    restoring: '已恢复目录，加载中…',
    filesCount: '{n} 个文件',
    treeLoading: '正在扫描目录…',
    cannotRead: '无法读取: ',
    readFailed: '读取失败: ',
    pickFailed: '选择目录失败: ',
    accessDeniedTitle: '无法访问目录',
    accessDeniedMsg: '目录访问权限已被拒绝，请重新选择目录。',
    treeFailed: '读取目录失败: ',
    notLocalTitle: '无法预览',
    notLocalMsg: '只支持本地目录预览。请先在地址栏打开本地目录（file:// 开头），再点击扩展图标或右键选择「md preview」；也可以直接在下方选择文件夹。',
    fileAccessHint: '提示：如果当前地址栏已经是本地目录，请在扩展设置中开启「允许访问文件网址」。',
    openExtSettings: '打开扩展设置',
    noFilesTitle: '没有可显示的文件',
    noFilesMsg: '「{dir}」下没有符合设置（可在设置中调整后缀）的可显示文件，或目录为空。',
    frontmatter: '文档元数据 (frontmatter)',
    mermaidSrc: 'Mermaid 源码',
    themeAuto: '主题：跟随浏览器',
    themeLight: '主题：浅色',
    themeDark: '主题：深色',
    optTitle: 'mdpreview · 设置',
    optHeading: 'mdpreview · 设置',
    secExt: '显示的文件后缀',
    docExtLabel: '文档类后缀',
    imgExtLabel: '图片类后缀',
    hintSep: '用英文逗号分隔，不含点号。',
    hideEmpty: '隐藏空目录（目录下没有可显示的文件时，整个目录不显示）',
    optThemeAuto: '跟随浏览器',
    optThemeLight: '浅色',
    optThemeDark: '深色',
    save: '保存',
    savedMsg: '已保存。预览页会自动刷新文件树。',
    envWarn: '⚠ 此页面不是扩展页面，无法读取本地文件。请关闭本页，从 Chrome 工具栏点击 mdpreview 图标打开。',
    extAllEmpty: '至少保留一种后缀，否则文件树为空，本次未保存。',
  },
};

const lang = (function detect() {
  const langs = (typeof navigator !== 'undefined' && navigator.languages) ||
    (typeof navigator !== 'undefined' && navigator.language ? [navigator.language] : ['en']);
  return langs.some((l) => String(l).toLowerCase().indexOf('zh') === 0) ? 'zh' : 'en';
})();

export function t(key, params) {
  let s = DICT[lang][key] != null ? DICT[lang][key] : (DICT.en[key] != null ? DICT.en[key] : key);
  if (params) {
    for (const k in params) s = s.split('{' + k + '}').join(params[k]);
  }
  return s;
}
