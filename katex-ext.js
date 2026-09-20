// marked 数学公式扩展：$$ 块级 + $ 行内，交给 KaTeX 渲染。
// 供 viewer.js 使用，测试页可直接 import。
// 注意：KaTeX 必须是已加载的全局对象，通过参数传入。

export function katexExtensions(katex) {
  const render = (tex, displayMode) =>
    katex.renderToString(tex, { displayMode: displayMode, throwOnError: false, strict: false });

  return [
    {
      name: 'katexBlock',
      level: 'block',
      start(src) { const i = src.indexOf('$$'); return i < 0 ? undefined : i; },
      tokenizer(src) {
        // $$ ... $$ 独占若干行（或单行）
        const m = /^\$\$([\s\S]+?)\$\$[ \t]*(?:\n|$)/.exec(src);
        if (m) return { type: 'katexBlock', raw: m[0], text: m[1].trim() };
      },
      renderer(token) {
        return '<div class="katex-block">' + render(token.text, true) + '</div>\n';
      },
    },
    {
      name: 'katexInline',
      level: 'inline',
      start(src) { const i = src.indexOf('$'); return i < 0 ? undefined : i; },
      tokenizer(src) {
        // 段落内的 $$...$$ 也按块级公式渲染
        let m = /^\$\$([\s\S]+?)\$\$/.exec(src);
        if (m) return { type: 'katexInline', raw: m[0], text: m[1].trim(), display: true };
        // 行内 $...$：首字符非空白、末字符非空白、闭合 $ 后不接数字（防 "$100" 误判）、不跨行
        m = /^\$(?!\s)((?:\\\$|[^$\n])+?)(?<!\s)\$(?!\d)/.exec(src);
        if (m) return { type: 'katexInline', raw: m[0], text: m[1] };
      },
      renderer(token) {
        return render(token.text, !!token.display);
      },
    },
  ];
}
