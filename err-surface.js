// 全局错误面板：任何脚本异常/未处理的 Promise 拒绝都画到页面上，
// 保证预览页永远不会"静默空白"。必须是外部文件（MV3 禁止内联 script）。
(function () {
  function paint(title, detail) {
    function draw() {
      var doc = document.getElementById('doc');
      if (!doc) return;
      var box = document.createElement('div');
      box.className = 'err';
      box.style.margin = '40px auto';
      box.style.maxWidth = '640px';
      box.textContent = title + '\n\n' + detail;
      doc.innerHTML = '';
      doc.appendChild(box);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', draw);
    else draw();
  }
  window.addEventListener('error', function (e) {
    paint('页面脚本错误 / Script error',
      (e.message || '') + '\n' + (e.filename || '') + ':' + (e.lineno || '') + '\n\n请刷新扩展(chrome://extensions ⟳)后重试；仍出现请把以上信息反馈。');
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    paint('异步操作失败 / Async error',
      ((r && (r.stack || r.message)) || String(r)) + '\n\n请把以上信息反馈。');
  });
})();
