/* Old (non-Unicode) Gujarati fonts → Unicode.
   Tables were read from the glyphs embedded in the owner's two reference papers
   (Guj_*_SULEKH, Guj_GopikaTwo, TERAFONT-CHANDANA) and checked word by word against
   how those papers print. Characters not in a table come out as "[?]" so they are
   seen and fixed in the review screen, never guessed. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.QPG = root.QPG || {}; root.QPG.legacy = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var UNKNOWN = '[?]';
  var REPH = '';          // internal marks, removed before output
  var REPH_ANUSVARA = '';
  var PREBASE_I = 'િ';
  var PREBASE_I_ANUSVARA = 'િં';

  /* Sulekh and GopikaTwo share one keyboard layout (checked on every code both papers use). */
  var SG = {
    '#': 'રૂ', '&': 'ૅ', '*': PREBASE_I, '@': 'શ્ચ',
    'D': 'ધ્', 'I': 'ીં', 'K': 'ખ્', 'L': 'ળ્', 'S': 'શ્', 'T': 'થ્', 'W': 'શ્',
    ']': 'દ્વ', '^': 'ત્ત્', 'c': 'ચ્', 'e': 'ેં', 'f': 'ડ્ડ', 'g': 'ગ્', 'i': PREBASE_I_ANUSVARA,
    'j': 'જ્', 'k': 'ક્', 'l': 'લ્', 'm': 'મ્', 'n': 'ન્', 'o': 'ોં', 'p': 'પ્', 'r': 'રુ',
    's': 'સ્', 't': 'ત્', 'u': 'ુ', 'v': 'વ્', 'w': 'ષ્', '}': 'દ્ધ',
    '¥': '્ય', '¨': 'દ્ર', '©': 'દ્વ', '¬': '?', '®': 'ક્ર', '±': 'ઋ',
    '»': 'ક', '¼': 'ખ', '½': 'ગ', '¾': 'ઘ', '¿': 'ચ', 'À': 'છ', 'Á': 'જ', 'Â': 'ઝ', 'Ã': 'ટ',
    'Ä': 'ઠ', 'Å': 'ડ', 'Æ': 'ઢ', 'Ç': 'ણ', 'È': 'ત', 'É': 'થ', 'Ê': 'દ', 'Ë': 'ધ', 'Ì': 'ન',
    'Í': 'પ', 'Î': 'ફ', 'Ï': 'બ', 'Ð': 'ભ', 'Ñ': 'મ', 'Ò': 'ય', 'Ó': 'ર', 'Ô': 'લ', 'Õ': 'વ',
    'Ö': 'સ', '×': 'શ', 'Ø': 'ષ', 'Ù': 'શ્ર', 'Ú': 'હ', 'Û': 'ળ', 'Ü': 'ક્ષ', 'Ý': 'ત્ર',
    'á': 'અ', 'â': 'ા', 'ã': PREBASE_I, 'ä': 'ી', 'å': 'ઇ', 'æ': 'ઈ', 'ç': 'ુ', 'è': 'ૂ', 'é': 'ઉ',
    'ê': 'ઊ', 'ë': 'ે', 'ì': 'ૈ', 'í': 'ો', 'ï': 'ં', 'ð': ':', 'ô': REPH, 'õ': REPH_ANUSVARA,
    '÷': '્ર', 'ù': 'ઊં', 'ý': '્ર', '—': 'શ્ન', '’': 'જા', '“': '“', '”': '”'
  };
  var SG_PASS = ' 0123456789!()+,-./:;=?[]%\'"\t\n';

  /* Terafont (Chandana / Varun layout): every key is a letter, so nothing passes through. */
  var TERA = {
    '"': REPH, '%': 'પ્', ',': 'લ', '/': 'ળ', '0': 'ડ', '4': ',', '5': 'પ', '6': 'ણ', '8': 'ટ',
    ';': 'સ', '<': 'લ્', 'A': 'બ', 'B': 'ખ', 'C': 'હ', 'D': 'મ', 'F': 'ા', 'G': 'ન', 'H': 'જ',
    'I': 'ય', 'J': 'વ', 'K': 'છ', 'L': 'ી', 'M': 'ો', 'N': 'દ', 'P': '.', 'Q': 'ષ્', 'R': 'ચ',
    'S': 'ક', 'T': 'ત', 'U': 'ગ', 'V': 'અ', 'W': 'ધ', 'X': 'શ', 'Y': 'થ', 'Z': 'ર', '[': 'ે',
    '\\': 'ં', ']': 'ુ', 'l': PREBASE_I, 'm': '?', 't': 'ત્', '|': '્ર', '}': 'ૂ', '£': 'દ્વ'
  };
  var TERA_PASS = ' \t\n';

  var TABLES = { sg: { map: SG, pass: SG_PASS }, tera: { map: TERA, pass: TERA_PASS } };

  /** Which converter a Word font name needs. */
  function fontKind(name) {
    var n = String(name || '').toLowerCase();
    if (!n) return 'unicode';
    if (n.indexOf('sulekh') >= 0 || n.indexOf('gopika') >= 0) return 'sg';
    if (n.indexOf('terafont') >= 0) return 'tera';
    if (n === 'symbol' || n.indexOf('symbol') === 0) return 'symbol';
    if (/(lmg|harikrishna|saral|krishna|avantika|bhasha|ghanshyam|shree|kap|akruti|hari)/.test(n) && n.indexOf('unicode') < 0) return 'unsupported';
    return 'unicode';
  }

  /* Symbol font (Greek letters and maths signs typed with the Symbol font in Word). */
  var SYMBOL = {
    a: 'α', b: 'β', g: 'γ', d: 'δ', e: 'ε', z: 'ζ', h: 'η', q: 'θ', i: 'ι', k: 'κ', l: 'λ', m: 'μ', n: 'ν',
    x: 'ξ', p: 'π', r: 'ρ', s: 'σ', t: 'τ', u: 'υ', f: 'φ', c: 'χ', y: 'ψ', w: 'ω', j: 'ϕ', v: 'ϖ',
    D: 'Δ', G: 'Γ', Q: 'Θ', L: 'Λ', X: 'Ξ', P: 'Π', S: 'Σ', F: 'Φ', Y: 'Ψ', W: 'Ω',
    '°': '°', '´': '×', '±': '±', '£': '≤', '³': '≥', '¹': '≠', '®': '→',
    'Þ': '⇒', '¥': '∞', 'Ö': '√', 'å': '∑', 'ò': '∫', 'Î': '∈', 'Ì': '⊂',
    'È': '∪', 'Ç': '∩', 'Æ': '∅', '»': '≈', 'º': '≡', '¶': '∂', '×': '·',
    '¸': '÷', '¬': '←', '­': '↑', '¯': '↓', 'Û': '⇔', 'Å': '⊕', 'Ð': '∠',
    '¢': '′', '²': '″', '-': '−', '¾': '—'
  };
  function symbolChar(c) {
    var code = c.charCodeAt(0);
    if (code >= 0xF020 && code <= 0xF0FF) c = String.fromCharCode(code - 0xF000);
    return SYMBOL[c] || c;
  }
  function convertSymbol(text) { return Array.from(String(text)).map(symbolChar).join(''); }

  /* ---------- reordering helpers (visual order → Unicode order) ---------- */
  var CONS = /^[ક-હૠ]/;          // starts with a consonant
  function isHalf(t) { return t.length >= 2 && CONS.test(t) && t.charAt(t.length - 1) === '્'; }
  function isFull(t) { return CONS.test(t) && !isHalf(t); }
  function isPostBase(t) { return t === '્ર' || t === '્ય'; }
  function isMark(t) { return /^[઼-ૌઁ-ઃૅૉ]+$/.test(t); }

  function reorder(tokens) {
    var t = tokens.slice(), i, j;
    // 1. half consonant + ા stroke = the full consonant (Terafont "ષ" = ષ્ + ા)
    for (i = 0; i < t.length - 1; i++) {
      if (isHalf(t[i]) && t[i + 1] === 'ા') { t[i] = t[i].slice(0, -1); t.splice(i + 1, 1); }
    }
    // 2. the short-i sign is typed before its consonant cluster; move it after
    for (i = 0; i < t.length; i++) {
      if (t[i] !== PREBASE_I && t[i] !== PREBASE_I_ANUSVARA) continue;
      j = i + 1;
      while (j < t.length && isHalf(t[j])) j++;
      if (j < t.length && isFull(t[j])) j++; else continue;
      while (j < t.length && isPostBase(t[j])) j++;
      var sign = t.splice(i, 1)[0];
      t.splice(j - 1, 0, sign);
      i = j - 1;
    }
    // 3. reph (ર્ above) is typed after its syllable; move it before the cluster
    for (i = 0; i < t.length; i++) {
      if (t[i] !== REPH && t[i] !== REPH_ANUSVARA) continue;
      var withDot = t[i] === REPH_ANUSVARA;
      j = i - 1;
      while (j >= 0 && (isMark(t[j]) || isPostBase(t[j]) || t[j] === PREBASE_I || t[j] === PREBASE_I_ANUSVARA)) j--;
      if (j < 0 || !isFull(t[j])) { t[i] = withDot ? 'ર્ં' : 'ર્'; continue; }
      while (j - 1 >= 0 && isHalf(t[j - 1])) j--;
      t.splice(i, 1);
      if (withDot) t.splice(i, 0, 'ં');
      t.splice(j, 0, 'ર્');
    }
    return t;
  }

  function normalize(s) {
    return s
      .replace(/ાે/g, 'ો').replace(/ાૈ/g, 'ૌ').replace(/ાૅ/g, 'ૉ').replace(/ોૅ/g, 'ૉ')
      .replace(/અા/g, 'આ').replace(/અો/g, 'ઓ').replace(/અૌ/g, 'ઔ').replace(/અે/g, 'એ').replace(/અૈ/g, 'ઐ')
      .replace(/અૉ/g, 'ઑ').replace(/અૅ/g, 'ઍ').replace(/આે/g, 'ઓ').replace(/આૈ/g, 'ઔ')
      .replace(/ં([ા-ૌ])/g, '$1ં')
      .normalize('NFC');
  }

  /**
   * Convert text typed in an old font.
   * Returns { text, unknown: [characters that are not in the table] }.
   */
  function convert(text, kindOrFont) {
    var kind = TABLES[kindOrFont] ? kindOrFont : fontKind(kindOrFont);
    var table = TABLES[kind];
    if (!table) return { text: String(text || ''), unknown: [], converted: false, unsupported: kind === 'unsupported' };
    var out = [], unknown = [], segment = [];
    var flush = function () { if (segment.length) { out.push(normalize(reorder(segment).join(''))); segment = []; } };
    Array.from(String(text || '')).forEach(function (c) {
      var code = c.charCodeAt(0);
      if (code >= 0xF020 && code <= 0xF0FF) c = cp1252(code - 0xF000);
      if (Object.prototype.hasOwnProperty.call(table.map, c)) { segment.push(table.map[c]); return; }
      flush();
      // real Unicode (maths signs, …, Gujarati) is kept; only unknown old-font codes are marked
      if (table.pass.indexOf(c) >= 0 || /\s/.test(c) || !/[\u0021-\u007E\u00A1-\u00FF]/.test(c)) { out.push(c); return; }
      if (unknown.indexOf(c) < 0) unknown.push(c);
      out.push(UNKNOWN);
    });
    flush();
    return { text: out.join(''), unknown: unknown, converted: true, unsupported: false };
  }

  var CP1252_HIGH = { 0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8A: 'Š', 0x8B: '‹', 0x8C: 'Œ', 0x8E: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9A: 'š', 0x9B: '›', 0x9C: 'œ', 0x9E: 'ž', 0x9F: 'Ÿ' };
  function cp1252(code) { return CP1252_HIGH[code] || String.fromCharCode(code); }

  /**
   * Pasted plain text has lost its fonts. Convert only the words that clearly come from
   * Sulekh/Gopika (they contain Latin-1 letters such as Ì â ë); English words and numbers stay.
   */
  function convertPlainWords(text) {
    var unknown = [], changed = 0;
    var out = String(text || '').split('\n').map(function (line) {
      // a "}" or "]" closing a bracket opened on the same line is a bracket, not a letter
      var keepBrace = line.indexOf('{') >= 0, keepBracket = line.indexOf('[') >= 0;
      return line.replace(/[^\s]+/g, function (w) {
        if (!/[©-ÿ—’“”]/.test(w)) return w;
        var tail = '';
        var m = /[}\])]+$/.exec(w);
        if (m && ((keepBrace && m[0].indexOf('}') >= 0) || (keepBracket && m[0].indexOf(']') >= 0))) {
          tail = m[0]; w = w.slice(0, -tail.length);
        }
        var r = convert(w, 'sg');
        changed++;
        r.unknown.forEach(function (c) { if (unknown.indexOf(c) < 0) unknown.push(c); });
        return r.text + tail;
      });
    }).join('\n');
    return { text: out, unknown: unknown, changed: changed };
  }


  return {
    UNKNOWN: UNKNOWN, fontKind: fontKind, convert: convert, convertSymbol: convertSymbol,
    symbolChar: symbolChar, convertPlainWords: convertPlainWords, reorder: reorder,
    /** Pasted text without font information: convert the Sulekh/Gopika-looking words. */
    convertGuess: function (t) { return convertPlainWords(t).text; }
  };
});
