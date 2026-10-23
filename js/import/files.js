/* Reading teachers' files in the browser — no outside libraries:
   Excel (.xlsx), Word (.docx), CSV / text / JSON, and text pasted from Word with its fonts. */
(function (root) {
  'use strict';
  var QPG = root.QPG = root.QPG || {};

  function readAsText(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result)); };
      r.onerror = function () { reject(r.error); };
      r.readAsText(file, 'utf-8');
    });
  }
  function readAsBuffer(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsArrayBuffer(file);
    });
  }
  function parseXml(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('ફાઇલની અંદરનું લખાણ વાંચી શકાયું નહીં (ફાઇલ ખરાબ હોઈ શકે).');
    return doc;
  }
  function friendly(e) {
    var m = (e && e.message) || String(e);
    if (/ZIP|ફાઇલ ખરાબ|central/i.test(m)) m = 'આ ફાઇલ ખૂલી શકી નહીં — કદાચ જૂની .doc / .xls ફાઇલ છે. Word/Excel માં ખોલીને "Save As" થી .docx / .xlsx તરીકે સેવ કરો.';
    return new Error(m);
  }

  /** First worksheet → rows (rows.rowNumbers holds the real Excel row numbers). */
  function readXlsx(file) {
    return readAsBuffer(file).then(function (buf) { return QPG.sheet.readXlsx(buf, { parseXml: parseXml }); })
      .then(function (r) { var rows = r.rows; rows.rowNumbers = r.rowNumbers; return rows; })
      .catch(function (e) { throw friendly(e); });
  }

  /** Word file → { lines, report } for QPG.importer.fromText. */
  function readDocx(file) {
    return readAsBuffer(file).then(function (buf) { return QPG.docx.read(buf, { parseXml: parseXml }); })
      .catch(function (e) { throw friendly(e); });
  }

  /**
   * HTML copied from Word: text with the font of each piece, so old-font words convert correctly.
   * Resolves to { lines, converted, unknown }.
   */
  function htmlToLines(html) {
    return new Promise(function (resolve) {
      var frame = document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-same-origin');
      frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:600px;visibility:hidden';
      document.body.appendChild(frame);
      var doc = frame.contentDocument;
      doc.open(); doc.write(String(html).replace(/<script[\s\S]*?<\/script>/gi, '')); doc.close();
      var win = frame.contentWindow, L = QPG.legacy;
      var lines = [], cur = [], converted = 0, unknown = [];
      var BLOCK = /^(P|DIV|H[1-6]|LI|TR|TABLE|BR|UL|OL)$/;
      function push() {
        var text = cur.join('').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
        if (text) lines.push({ text: text });
        cur = [];
      }
      function fontOf(el) {
        var f = (win.getComputedStyle(el).fontFamily || '').split(',')[0];
        return f.replace(/["']/g, '').trim();
      }
      (function walk(node) {
        for (var n = node.firstChild; n; n = n.nextSibling) {
          if (n.nodeType === 3) {
            var el = n.parentElement, t = n.nodeValue;
            if (!el || !t) continue;
            var kind = L.fontKind(fontOf(el));
            if (kind === 'sg' || kind === 'tera' || kind === 'symbol') {
              if (kind === 'symbol') t = L.convertSymbol(t);
              else {
                var r = L.convert(t, kind);
                t = r.text; converted++;
                r.unknown.forEach(function (c) { if (unknown.indexOf(c) < 0) unknown.push(c); });
              }
            }
            var va = win.getComputedStyle(el).verticalAlign;
            if ((va === 'super' || el.closest('sup')) && t.trim()) t = '$^{' + t.trim() + '}$';
            else if ((va === 'sub' || el.closest('sub')) && t.trim()) t = '$_{' + t.trim() + '}$';
            cur.push(t);
          } else if (n.nodeType === 1) {
            var tag = n.tagName;
            if (tag === 'STYLE' || tag === 'SCRIPT' || tag === 'HEAD' || tag === 'TITLE') continue;
            if (tag === 'TD' || tag === 'TH') { walk(n); cur.push('   '); continue; }
            if (BLOCK.test(tag)) push();
            walk(n);
            if (BLOCK.test(tag)) push();
          }
        }
      })(doc.body);
      push();
      frame.remove();
      resolve({ lines: lines.map(function (l) { return { text: l.text, legacy: converted > 0 }; }), converted: converted, unknown: unknown });
    });
  }

  QPG.files = { readAsText: readAsText, readXlsx: readXlsx, readDocx: readDocx, htmlToLines: htmlToLines, parseXml: parseXml };
})(typeof self !== 'undefined' ? self : this);
