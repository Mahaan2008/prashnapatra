/* Turns a question into HTML (text, options, match table, sub-questions, figure).
   Used by the question bank, the form preview and (later) the printed paper. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../core/schema'));
  else { root.QPG = root.QPG || {}; root.QPG.questionHtml = factory(root.QPG.schema); }
})(typeof self !== 'undefined' ? self : this, function (schema) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function text(s) { return esc(s).replace(/\n/g, '<br>'); }

  /** Approximate printed width of a string, in characters. */
  function visualLength(s) {
    return String(s || '')
      .replace(/\$\$?([^$]*)\$\$?/g, function (m, tex) {
        var t = tex.replace(/\\(frac|dfrac)\{([^}]*)\}\{([^}]*)\}/g, function (x, f, a, b) { return a.length > b.length ? a : b; })
          .replace(/\\[a-zA-Z]+/g, 'x').replace(/[{}^_\s]/g, '');
        return new Array(t.length + 1).join('x');
      })
      .replace(/[઼ા-્ૢૣ]/g, '') // Gujarati vowel signs take no extra width
      .length;
  }

  /** 4 across for short options, 2×2 for medium, one per line for long ones. */
  function optionColumns(options) {
    var max = 0;
    (options || []).forEach(function (o) { max = Math.max(max, visualLength(o)); });
    if (max <= 12) return 4;
    if (max <= 30) return 2;
    return 1;
  }

  function optionsHtml(options, cls) {
    var cols = optionColumns(options);
    return '<ol class="qh-opts cols-' + cols + (cls ? ' ' + cls : '') + '">' +
      options.map(function (o, i) {
        return '<li><span class="qh-ol">(' + schema.OPTION_LETTERS[i] + ')</span> <span class="qh-ot">' + text(o) + '</span></li>';
      }).join('') + '</ol>';
  }

  function matchHtml(q) {
    var n = Math.max(q.matchLeft.length, q.matchRight.length);
    var rows = '';
    for (var i = 0; i < n; i++) {
      var l = q.matchLeft[i], r = q.matchRight[i];
      rows += '<tr><td class="qh-mn">' + (l ? '(' + (i + 1) + ')' : '') + '</td><td>' + text(l || '') + '</td>' +
        '<td class="qh-mn">' + (r ? '(' + String.fromCharCode(97 + i) + ')' : '') + '</td><td>' + text(r || '') + '</td></tr>';
    }
    return '<table class="qh-match"><thead><tr><th colspan="2">કૉલમ – I</th><th colspan="2">કૉલમ – II</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /**
   * opts: { showAnswer: bool }
   */
  function render(q, opts) {
    opts = opts || {};
    var h = '<div class="qh">';
    if (q.type === 'assertion_reason') {
      h += '<div class="qh-text"><div class="qh-ar"><b>વિધાન (A) :</b> ' + text(q.assertion) + '</div>' +
        '<div class="qh-ar"><b>કારણ (R) :</b> ' + text(q.reason) + '</div></div>';
    } else if (q.text) {
      h += '<div class="qh-text">' + text(q.text) + '</div>';
    }
    if (q.image) h += '<figure class="qh-fig"><img src="' + esc(q.image) + '" alt="આકૃતિ"></figure>';

    if (q.type === 'mcq' && q.options && q.options.length) h += optionsHtml(q.options);
    if (q.type === 'assertion_reason') h += optionsHtml(schema.AR_OPTIONS, 'qh-opts-ar');
    if (q.type === 'match_columns' && (q.matchLeft.length || q.matchRight.length)) h += matchHtml(q);
    if (q.type === 'case_based' && q.subparts && q.subparts.length) {
      h += '<ol class="qh-sub">' + q.subparts.filter(function (p) { return p.text; }).map(function (p, i) {
        return '<li><span class="qh-sn">(' + (i + 1) + ')</span><div>' + text(p.text) +
          (p.options && p.options.length ? optionsHtml(p.options) : '') + '</div></li>';
      }).join('') + '</ol>';
    }
    if (opts.showAnswer && (q.answer || q.solution)) {
      h += '<div class="qh-ans">';
      if (q.answer) h += '<div><b>જવાબ :</b> ' + text(q.answer) + '</div>';
      if (q.solution) h += '<div class="qh-sol"><b>ઉકેલ :</b> ' + text(q.solution) + '</div>';
      h += '</div>';
    }
    return h + '</div>';
  }

  return { render: render, esc: esc, text: text, optionColumns: optionColumns, visualLength: visualLength };
});
