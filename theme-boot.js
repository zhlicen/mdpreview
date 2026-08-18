// 防闪白：在首帧绘制前按系统主题设置 data-theme。
// 必须是外部文件（MV3 禁止内联 script），且用普通同步脚本在 <head> 里加载。
// theme.js 稍后按存储的设置校正（auto/light/dark）。
if (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = 'dark';
