/* Word equations (Office Math, OMML) → LaTeX for KaTeX. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.QPG = root.QPG || {}; root.QPG.omml = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function ln(n) { return n.localName || String(n.nodeName).split(':').pop(); }
  function kids(el, name) {
    var out = [];
    if (!el) return out;
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && (!name || ln(n) === name)) out.push(n);
    return out;
  }
  function kid(el, name) { return kids(el, name)[0] || null; }
  function val(el) {
    if (!el) return null;
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if ((a.localName || a.name.split(':').pop()) === 'val') return a.value;
    }
    return null;
  }
  function prop(el, propName, name) { return val(kid(kid(el, propName), name)); }

  var GREEK = {
    'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\varepsilon', 'ϵ': '\\epsilon', 'ζ': '\\zeta', 'η': '\\eta',
    'θ': '\\theta', 'ϑ': '\\vartheta', 'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu', 'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi',
    'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon', 'φ': '\\phi', 'ϕ': '\\phi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
    'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda', 'Ξ': '\\Xi', 'Π': '\\Pi', 'Σ': '\\Sigma', 'Φ': '\\Phi', 'Ψ': '\\Psi', 'Ω': '\\Omega'
  };
  var SYMBOLS = {
    '×': '\\times', '·': '\\cdot', '⋅': '\\cdot', '÷': '\\div', '±': '\\pm', '∓': '\\mp', '≤': '\\le', '≥': '\\ge', '≠': '\\ne',
    '≈': '\\approx', '≡': '\\equiv', '∝': '\\propto', '∞': '\\infty', '→': '\\to', '←': '\\leftarrow', '↔': '\\leftrightarrow',
    '⇒': '\\Rightarrow', '⟹': '\\Rightarrow', '⇔': '\\Leftrightarrow', '∈': '\\in', '∉': '\\notin', '⊂': '\\subset', '⊆': '\\subseteq',
    '⊃': '\\supset', '∪': '\\cup', '∩': '\\cap', '∅': '\\phi', '∀': '\\forall', '∃': '\\exists', '∴': '\\therefore', '∵': '\\because',
    '∠': '\\angle', '∂': '\\partial', '∇': '\\nabla', '°': '^{\\circ}', '′': "'", '″': "''", '−': '-', '∗': '*', '…': '\\dots',
    '⋯': '\\cdots', '⊥': '\\perp', '∥': '\\parallel', '∘': '\\circ', '⟨': '\\langle', '⟩': '\\rangle', 'ℝ': '\\mathbb{R}',
    'ℕ': '\\mathbb{N}', 'ℤ': '\\mathbb{Z}', 'ℚ': '\\mathbb{Q}', 'ℂ': '\\mathbb{C}', '⊗': '\\otimes', '⊕': '\\oplus', '∑': '\\sum',
    '∏': '\\prod', '∫': '\\int', '∮': '\\oint', '√': '\\surd', '%': '\\%', '#': '\\#', '$': '\\$', '{': '\\{', '}': '\\}', '_': '\\_',
    '\\': '\\backslash ', '~': '\\sim', '∼': '\\sim', '⃗': '', '‖': '\\|', '∣': '|', 'ℏ': '\\hbar', 'ℓ': '\\ell'
  };
  var FUNCS = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'exp', 'lim', 'max', 'min', 'sinh', 'cosh', 'tanh', 'det', 'arg', 'gcd'];

  /* Mathematical italic/bold letters (𝑥, 𝐱 …) back to plain letters. */
  function plainLetter(cp) {
    var ranges = [[0x1D400, 'A'], [0x1D41A, 'a'], [0x1D434, 'A'], [0x1D44E, 'a'], [0x1D468, 'A'], [0x1D482, 'a'],
      [0x1D49C, 'A'], [0x1D4B6, 'a'], [0x1D5A0, 'A'], [0x1D5BA, 'a'], [0x1D670, 'A'], [0x1D68A, 'a']];
    if (cp === 0x210E) return 'h';
    for (var i = 0; i < ranges.length; i++) {
      var start = ranges[i][0];
      if (cp >= start && cp < start + 26) return String.fromCharCode(ranges[i][1].charCodeAt(0) + cp - start);
    }
    if (cp >= 0x1D6FC && cp <= 0x1D714) return String.fromCodePoint(0x03B1 + cp - 0x1D6FC); // italic Greek small
    if (cp >= 0x1D6E2 && cp <= 0x1D6FA) return String.fromCodePoint(0x0391 + cp - 0x1D6E2); // italic Greek capital
    if (cp >= 0x1D7CE && cp <= 0x1D7FF) return String.fromCharCode(48 + (cp - 0x1D7CE) % 10);
    return null;
  }

  var GUJ = /[\u0A80-\u0AFF]/;

  /** Text of one math run → LaTeX. */
  function runText(t, plain) {
    var out = '', textBuf = '';
    var flushText = function () { if (textBuf) { out += '\\text{' + textBuf + '}'; textBuf = ''; } };
    Array.from(t).forEach(function (ch) {
      var cp = ch.codePointAt(0);
      if (GUJ.test(ch) || (textBuf && (ch === ' ' || /[\u0A80-\u0AFF\u200C\u200D]/.test(ch)))) { textBuf += ch; return; }
      flushText();
      var p = plainLetter(cp);
      if (p) ch = p;
      if (GREEK[ch]) { out += GREEK[ch] + ' '; return; }
      if (SYMBOLS[ch] != null) { out += SYMBOLS[ch] + (SYMBOLS[ch].charAt(0) === '\\' && /[a-z]$/i.test(SYMBOLS[ch]) ? ' ' : ''); return; }
      out += ch;
    });
    flushText();
    if (plain && /^[A-Za-z]{2,}$/.test(out) && FUNCS.indexOf(out) < 0) return '\\mathrm{' + out + '}';
    return out;
  }

  function wrapGroup(s) { return s.length === 1 ? s : '{' + s + '}'; }

  var BRACKETS = { '(': '(', ')': ')', '[': '[', ']': ']', '{': '\\{', '}': '\\}', '|': '|', '‖': '\\|', '⌊': '\\lfloor', '⌋': '\\rfloor',
    '⌈': '\\lceil', '⌉': '\\rceil', '⟨': '\\langle', '⟩': '\\rangle', '〈': '\\langle', '〉': '\\rangle', '': '.' };
  var ACCENTS = { '\u20D7': '\\vec', '\u0302': '\\hat', '\u0305': '\\overline', '\u0304': '\\bar', '\u0307': '\\dot', '\u0308': '\\ddot',
    '\u0303': '\\tilde', '\u20D1': '\\vec', '\u2192': '\\vec', '\u02C6': '\\hat', '^': '\\hat', '\u00AF': '\\overline' };
  var NARY = { '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint', '⋃': '\\bigcup', '⋂': '\\bigcap' };

  /** sin, cos, log … written as plain letters become \\sin, \\cos (upright, correct spacing). */
  function namedFunctions(s) {
    return s.replace(/\\mathrm\{([a-z]+)\}/g, '$1')
      .replace(/(?<![\\a-zA-Z])(?<!\\operatorname\{)(arcsin|arccos|arctan|sinh|cosh|tanh|cosec|sin|cos|tan|cot|sec|csc|log|ln|exp|lim|max|min|det)(?![a-zA-Z])/g,
        function (m, name) { return (FUNCS.indexOf(name) >= 0 ? '\\' + name : '\\operatorname{' + name + '}') + ' '; });
  }

  function convertChildren(el) { return kids(el).map(convert).join(''); }
  function arg(el, name) { return convertChildren(kid(el, name)); }

  function convert(el) {
    switch (ln(el)) {
      case 'oMath': case 'e': case 'num': case 'den': case 'sub': case 'sup': case 'deg': case 'fName': case 'lim': case 'box':
      case 'borderBox': case 'argPr':
        return convertChildren(el);
      case 'r': {
        var t = kids(el, 't').map(function (x) { return x.textContent; }).join('');
        var sty = prop(el, 'rPr', 'sty');
        var nor = kid(kid(el, 'rPr'), 'nor');
        if (nor && /[A-Za-z\u0A80-\u0AFF]/.test(t)) return '\\text{' + t.replace(/[{}\\]/g, '') + '}';
        return runText(t, sty === 'p');
      }
      case 'f': {
        var type = prop(el, 'fPr', 'type');
        var n = arg(el, 'num'), d = arg(el, 'den');
        if (type === 'lin' || type === 'skw') return wrapGroup(n) + '/' + wrapGroup(d);
        if (type === 'noBar') return '\\genfrac{}{}{0pt}{}{' + n + '}{' + d + '}';
        return '\\frac{' + n + '}{' + d + '}';
      }
      case 'sSup': return wrapGroup(arg(el, 'e')) + '^{' + arg(el, 'sup') + '}';
      case 'sSub': return wrapGroup(arg(el, 'e')) + '_{' + arg(el, 'sub') + '}';
      case 'sSubSup': return wrapGroup(arg(el, 'e')) + '_{' + arg(el, 'sub') + '}^{' + arg(el, 'sup') + '}';
      case 'sPre': return '{}_{' + arg(el, 'sub') + '}^{' + arg(el, 'sup') + '}' + wrapGroup(arg(el, 'e'));
      case 'rad': {
        var hide = prop(el, 'radPr', 'degHide');
        var deg = arg(el, 'deg');
        return (hide === '1' || hide === 'on' || hide === 'true' || !deg ? '\\sqrt{' : '\\sqrt[' + deg + ']{') + arg(el, 'e') + '}';
      }
      case 'd': {
        var pr = kid(el, 'dPr');
        var beg = val(kid(pr, 'begChr')), end = val(kid(pr, 'endChr')), sep = val(kid(pr, 'sepChr'));
        beg = beg == null ? '(' : beg; end = end == null ? ')' : end; sep = sep == null ? '|' : sep;
        var parts = kids(el, 'e').map(convertChildren);
        var inner = parts.join(sep === '|' ? ' \\mid ' : ' ' + (SYMBOLS[sep] || sep) + ' ');
        var L = BRACKETS[beg] != null ? BRACKETS[beg] : beg, R = BRACKETS[end] != null ? BRACKETS[end] : end;
        return '\\left' + L + ' ' + inner + ' \\right' + R;
      }
      case 'nary': {
        var npr = kid(el, 'naryPr');
        var chr = val(kid(npr, 'chr')) || '∫';
        var subHide = val(kid(npr, 'subHide')), supHide = val(kid(npr, 'supHide'));
        var op = NARY[chr] || chr;
        var sub = arg(el, 'sub'), sup = arg(el, 'sup');
        return op + (sub && subHide !== '1' && subHide !== 'on' ? '_{' + sub + '}' : '') +
          (sup && supHide !== '1' && supHide !== 'on' ? '^{' + sup + '}' : '') + ' ' + arg(el, 'e');
      }
      case 'func': return namedFunctions(arg(el, 'fName')) + ' ' + arg(el, 'e');
      case 'acc': {
        var ch = val(kid(kid(el, 'accPr'), 'chr'));
        var cmd = ACCENTS[ch == null ? '\u0302' : ch] || '\\hat';
        return cmd + '{' + arg(el, 'e') + '}';
      }
      case 'bar': {
        var pos = val(kid(kid(el, 'barPr'), 'pos'));
        return (pos === 'bot' ? '\\underline{' : '\\overline{') + arg(el, 'e') + '}';
      }
      case 'groupChr': {
        var gpr = kid(el, 'groupChrPr');
        var gch = val(kid(gpr, 'chr')) || '⏟', gpos = val(kid(gpr, 'pos')) || 'bot';
        var body = arg(el, 'e');
        if (gch === '→' || gch === '⟶') return '\\xrightarrow{' + body + '}';
        if (gch === '⏞') return '\\overbrace{' + body + '}';
        if (gch === '⏟') return '\\underbrace{' + body + '}';
        return gpos === 'top' ? '\\overset{' + (SYMBOLS[gch] || gch) + '}{' + body + '}' : '\\underset{' + (SYMBOLS[gch] || gch) + '}{' + body + '}';
      }
      case 'limLow': {
        var base = arg(el, 'e');
        return (/^\\?lim\s*$/.test(base) ? '\\lim' : '\\underset{' + arg(el, 'lim') + '}{' + base + '}') + (/^\\?lim\s*$/.test(base) ? '_{' + arg(el, 'lim') + '} ' : '');
      }
      case 'limUpp': return '\\overset{' + arg(el, 'lim') + '}{' + arg(el, 'e') + '}';
      case 'm': {
        var rows = kids(el, 'mr').map(function (mr) { return kids(mr, 'e').map(convertChildren).join(' & '); });
        return '\\begin{matrix} ' + rows.join(' \\\\ ') + ' \\end{matrix}';
      }
      case 'eqArr': {
        var lines = kids(el, 'e').map(convertChildren);
        var cols = 1;
        lines.forEach(function (l) { cols = Math.max(cols, (l.match(/(^|[^\\])&/g) || []).length + 1); });
        return '\\begin{array}{' + new Array(cols + 1).join('l') + '} ' + lines.join(' \\\\ ') + ' \\end{array}';
      }
      case 'phant': return '';
      case 'oMathPara': return kids(el, 'oMath').map(convert).join(' \\quad ');
      case 'rPr': case 'ctrlPr': case 'fPr': case 'sSupPr': case 'sSubPr': case 'sSubSupPr': case 'radPr': case 'dPr': case 'naryPr':
      case 'funcPr': case 'accPr': case 'barPr': case 'mPr': case 'eqArrPr': case 'limLowPr': case 'limUppPr': case 'groupChrPr':
      case 'boxPr': case 'borderBoxPr': case 'sPrePr': case 'oMathParaPr': case 'bookmarkStart': case 'bookmarkEnd': case 'proofErr':
        return '';
      default: {
        // a normal Word run inside an equation
        if (ln(el) === 't') return runText(el.textContent, false);
        return convertChildren(el);
      }
    }
  }

  /** <m:oMath> or <m:oMathPara> element → LaTeX (without $). */
  function toLatex(el) {
    var s = convert(el);
    // matrices inside brackets become pmatrix/bmatrix/vmatrix for nicer spacing
    s = s.replace(/\\left\( \\begin\{matrix\}([\s\S]*?)\\end\{matrix\} \\right\)/g, '\\begin{pmatrix}$1\\end{pmatrix}')
      .replace(/\\left\[ \\begin\{matrix\}([\s\S]*?)\\end\{matrix\} \\right\]/g, '\\begin{bmatrix}$1\\end{bmatrix}')
      .replace(/\\left\| \\begin\{matrix\}([\s\S]*?)\\end\{matrix\} \\right\|/g, '\\begin{vmatrix}$1\\end{vmatrix}')
      .replace(/\\left\\\{ \\begin\{array\}/g, '\\begin{cases}').replace(/\\end\{array\} \\right\./g, '\\end{cases}')
      .replace(/\\begin\{cases\}\{l+\}/g, '\\begin{cases}');
    s = namedFunctions(s);
    return s.replace(/\s+/g, ' ').replace(/ ([_^])/g, '$1').replace(/\{(\\[a-z]+) \}/g, '{$1}').trim();
  }

  return { toLatex: toLatex, runText: runText };
});
