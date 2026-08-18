# mdpreview

直接在 Chrome 浏览器里预览本地 Markdown 文件——无需服务器、无需构建、无需联网。

[English](./README.md) · 中文

## 功能

- **两种打开方式**：在地址栏打开 `file://` 目录时点击工具栏图标自动检测并直开，或手动选择文件夹（File System Access API，授权后自动恢复）。
- **左侧文件树**：可折叠目录结构，支持文件后缀过滤；没有可显示文件的目录可自动隐藏；搜索过滤时未匹配的文件夹同步隐藏。
- **Markdown 渲染**：表格、代码块、引用、图片等，基于 [marked](https://github.com/markedjs/marked)（已内置）。
- **Mermaid 图表**：Markdown 中的 `` ```mermaid `` 代码块和独立 `.mmd` 文件直接渲染。
- **Frontmatter**：YAML 前置信息折叠成可展开的元数据面板。
- **站内链接**：文档内的 `.md` 相对链接在扩展内直接跳转。
- **右键菜单**：任意页面右键选择「md preview」打开预览。
- **中英文界面**：自动跟随浏览器语言（中文环境显示中文，其余显示英文）。
- **主题切换**：跟随系统 / 浅色 / 深色，在预览页工具栏一键切换。
- **完全离线**：marked 和 mermaid 均已内置，断网也能用。

## 安装

1. 克隆或下载本仓库。
2. Chrome 地址栏输入 `chrome://extensions`，回车。
3. 打开右上角的「**开发者模式**」开关。
4. 点击「**加载已解压的扩展程序**」，选择 `extension/` 文件夹。
5. 工具栏出现蓝色箭头图标——点击即可使用。

### 开启「允许访问文件网址」（可选，地址栏自动检测需要）

要使用**地址栏自动检测**功能（在 `file://` 页面点击图标直接预览），需要额外授权：

1. `chrome://extensions` → 找到 **mdpreview** → 点「详情」
2. 找到「**网站访问权限**」区域
3. 开启「**允许访问文件网址**」

不开也能用——只是「地址栏直开」不可用，仍可通过「选择文件夹…」手动选择。

## 使用

| 入口 | 效果 |
|---|---|
| **工具栏图标 / 右键「md preview」** | 当前标签页是 `file://` 目录 → 直接打开预览；否则显示提示页和文件夹选择按钮。 |
| **「选择文件夹…」按钮** | 打开系统文件夹选择器，选过的目录会保存在 IndexedDB 中，下次打开自动恢复。 |

### 设置

在预览页 header 点 ⚙ 按钮，或右键扩展图标 →「选项」。

- **文档类后缀**：按 Markdown 渲染的文件（默认 `md, mmd`）。
- **图片类后缀**：显示在文件树中并可内联渲染（默认 `png, jpg, jpeg, gif, svg, webp`）。
- **隐藏空目录**：没有可显示文件的目录直接不出现（默认开启）。

`.json` 后缀始终默认包含，不在设置中暴露。

## 权限说明

| 权限 | 用途 |
|---|---|
| `storage` | 保存后缀配置和主题偏好。 |
| `contextMenus` | 添加页面右键菜单「md preview」。 |
| `file:///*` | 读取 `file://` 目录列表和文件内容（仅在开启「允许访问文件网址」后生效）。 |

手动「选择文件夹」走浏览器原生 [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)，仅访问用户明确选择的目录。

## 项目结构

```
extension/
  manifest.json          # Chrome MV3 清单
  background.js          # Service Worker：工具栏点击 + 右键菜单路由
  viewer.html/js         # 预览主页面（文件树 + 文档渲染区）
  fs.js                  # 文件访问：File System Access API + file:// XHR 双后端
  urlutil.js             # file:// URL ↔ 本地路径互转工具函数
  i18n.js                # 中英文文案字典 + 语言检测
  theme.js               # 主题管理（自动 / 浅色 / 深色）
  theme-boot.js          # 首帧防闪白（同步加载，MV3 合规）
  err-surface.js         # 全局错误面板（页面永远不会静默空白）
  options.html/js        # 设置页面
  _locales/en/           # Chrome i18n 消息（英文）
  _locales/zh_CN/        # Chrome i18n 消息（中文）
  lib/marked.min.js      # 内置 marked（Markdown 解析器）
  lib/mermaid.min.js     # 内置 Mermaid（图表渲染器）
  icons/                 # 扩展图标（16/32/48/128）
  tools/                 # 构建脚本（图标生成、测试）
```

## 开发

运行测试套件（Node 22+）：

```bash
cd extension
node tools/test-buildtree.mjs      # 文件树 + 读取逻辑
node tools/test-urlutil.mjs        # URL ↔ 路径转换
node tools/test-parselisting.mjs   # Chrome 目录列表解析
```

重新生成图标（修改设计后）：

```bash
node tools/make-icons.mjs
```

## 许可证

MIT
