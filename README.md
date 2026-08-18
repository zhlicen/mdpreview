# mdpreview

Preview local Markdown files directly in your Chrome browser — no server, no build step, no internet required.

## Features

- **Two ways to open a folder**: click the toolbar icon while viewing a `file://` directory in the address bar (auto-detected), or pick a folder manually via the File System Access API (persists across sessions).
- **File tree**: collapsible directory tree with configurable file extension filters; folders with no displayable files can be hidden automatically; search-as-you-type hides unmatched folders.
- **Markdown rendering**: tables, code blocks, blockquotes, images — powered by [marked](https://github.com/markedjs/marked) (bundled).
- **Mermaid diagrams**: inline `` ```mermaid `` code blocks and standalone `.mmd` files rendered directly.
- **Frontmatter**: YAML frontmatter folded into a collapsible metadata panel.
- **Internal links**: relative `.md` links within documents navigate inside the extension.
- **Right-click context menu**: "md preview" on any page to open the previewer.
- **I18n**: English and Chinese UI, auto-detected from browser language.
- **Theme**: system / light / dark, toggled from the toolbar.
- **Fully offline**: all libraries are bundled in the extension.

## Installation

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `extension/` folder.
5. A blue arrow icon appears in the toolbar — click it to open the preview page.

### Enable "Allow access to file URLs" (optional, for address-bar detection)

To use the **auto-detect** feature (clicking the icon while on a `file://` page), you need to grant file access:

1. Go to `chrome://extensions` → find **mdpreview** → click **Details**.
2. Under **Site access** (or **Permissions**), enable **Allow access to file URLs**.

Without this, the "manual folder picker" still works — only the address-bar detection is unavailable.

## Usage

| Entry point | What happens |
|---|---|
| **Toolbar icon / right-click "md preview"** | If the current tab is a `file://` directory, opens it directly. Otherwise shows a prompt with a folder picker button. |
| **"Choose folder…" button** | Opens a native folder picker. The chosen folder is remembered (IndexedDB) and auto-restored on next visit. |

### Settings

Open via the ⚙ button in the preview page header, or right-click the extension icon → **Options**.

- **Document extensions**: files rendered as Markdown (default: `md, mmd`).
- **Image extensions**: shown in the file tree and rendered inline (default: `png, jpg, jpeg, gif, svg, webp`).
- **Hide empty folders**: directories with no displayable files are hidden (default: on).

The `.json` extension is always included by default and is not configurable from the settings page.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save extension settings and theme preference. |
| `contextMenus` | Add the "md preview" right-click menu item. |
| `file:///*` | Read directory listings and files from `file://` URLs (only used when "Allow access to file URLs" is enabled). |

The manual folder picker uses the browser-native [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) — it only accesses folders you explicitly select.

## Project structure

```
extension/
  manifest.json          # Chrome MV3 manifest
  background.js          # Service worker: action + context menu routing
  viewer.html/js         # Main preview page (file tree + document pane)
  fs.js                  # File access: File System Access API + file:// XHR backends
  urlutil.js             # file:// URL ↔ local path conversion utilities
  i18n.js                # English / Chinese dictionaries + language detection
  theme.js               # Theme management (auto / light / dark)
  theme-boot.js          # Pre-paint theme flash prevention
  err-surface.js         # Global error surface (never silently blank)
  options.html/js        # Settings page
  _locales/en/           # Chrome i18n messages (English)
  _locales/zh_CN/        # Chrome i18n messages (Chinese)
  lib/marked.min.js      # Bundled marked (Markdown parser)
  lib/mermaid.min.js     # Bundled Mermaid (diagram renderer)
  icons/                 # Extension icons (16/32/48/128)
  tools/                 # Build scripts (icon generation, tests)
```

## Development

Run the test suite (Node 22+):

```bash
cd extension
node tools/test-buildtree.mjs      # File tree + read logic
node tools/test-urlutil.mjs        # URL ↔ path conversion
node tools/test-parselisting.mjs   # Chrome directory listing parser
```

Regenerate icons after modifying the design:

```bash
node tools/make-icons.mjs
```

## License

MIT
