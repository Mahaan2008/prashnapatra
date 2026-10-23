/* Gujarati text helpers: digits, normalisation, legacy (non-Unicode) font detection. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.QPG = root.QPG || {}; root.QPG.gujarati = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GU_DIGITS = '૦૧૨૩૪૫૬૭૮૯';
  var GUJARATI_LETTER = /[઀-૿]/;

  function toGujaratiDigits(s) {
    return String(s).replace(/[0-9]/g, function (d) { return GU_DIGITS[+d]; });
  }
  function toLatinDigits(s) {
    return String(s).replace(/[૦-૯]/g, function (d) { return String(GU_DIGITS.indexOf(d)); });
  }

  /** Text with maths removed, used for legacy-font detection. */
  function stripMath(s) {
    return String(s || '').replace(/\$\$[\s\S]*?\$\$/g, ' ').replace(/\$[^$]*\$/g, ' ');
  }

  /**
   * Old Gujarati fonts (SULEKH, GopikaTwo, ...) store Gujarati letters in the
   * Latin-1 range, so pasted text looks like "ÍýÕë½". Flag text that has several
   * such characters and few or no real Gujarati letters.
   */
  function looksLikeLegacyFont(s) {
    var t = stripMath(s);
    var latin1 = (t.match(/[À-ÿ]/g) || []).length;
    if (latin1 < 3) return false;
    var gu = (t.match(/[઀-૿]/g) || []).length;
    return latin1 >= 3 && latin1 > gu;
  }

  function hasGujarati(s) { return GUJARATI_LETTER.test(String(s || '')); }

  /** Lower-case, NFC, collapse spaces — for duplicate checks and search. */
  function normalize(s) {
    return String(s == null ? '' : s).normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  return {
    toGujaratiDigits: toGujaratiDigits, toLatinDigits: toLatinDigits,
    stripMath: stripMath, looksLikeLegacyFont: looksLikeLegacyFont,
    hasGujarati: hasGujarati, normalize: normalize
  };
});
