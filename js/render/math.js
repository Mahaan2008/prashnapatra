/* Renders $…$ and $$…$$ maths inside an element with KaTeX (bundled offline). */
(function (root) {
  'use strict';
  var QPG = root.QPG = root.QPG || {};

  var OPTIONS = {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false }
    ],
    throwOnError: false,
    strict: false,
    trust: false,
    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option', 'input']
  };

  QPG.math = {
    available: function () { return typeof root.renderMathInElement === 'function'; },
    render: function (el) {
      if (!el || !QPG.math.available()) return;
      try { root.renderMathInElement(el, OPTIONS); } catch (e) { /* keep raw text visible */ }
    },
    /** List of maths snippets in a string that KaTeX cannot parse. */
    errors: function (s) {
      if (typeof root.katex === 'undefined') return [];
      var out = [];
      String(s || '').replace(/\$\$([\s\S]*?)\$\$|\$([^$]+)\$/g, function (m, d, i) {
        var tex = d != null ? d : i;
        try { root.katex.renderToString(tex, { throwOnError: true, strict: false, displayMode: d != null }); }
        catch (e) { out.push({ tex: tex, msg: String(e.message || e).replace(/^KaTeX parse error:\s*/, '') }); }
        return m;
      });
      return out;
    }
  };
})(typeof self !== 'undefined' ? self : this);
