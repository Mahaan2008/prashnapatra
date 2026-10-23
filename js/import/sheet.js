/* Reading the first worksheet of an Excel (.xlsx) file (CSV is read by the importer). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./zip'));
  else { root.QPG = root.QPG || {}; root.QPG.sheet = factory(root.QPG.zip); }
})(typeof self !== 'undefined' ? self : this, function (zip) {
  'use strict';

  function kids(el, name) {
    var out = [];
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && (n.localName || n.nodeName.split(':').pop()) === name) out.push(n);
    return out;
  }
  function all(el, name) {
    var out = [];
    (function walk(e) {
      for (var n = e.firstChild; n; n = n.nextSibling) {
        if (n.nodeType !== 1) continue;
        if ((n.localName || n.nodeName.split(':').pop()) === name) out.push(n);
        walk(n);
      }
    })(el);
    return out;
  }
  function attr(el, name) {
    if (!el) return null;
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (a.name === name || a.localName === name || a.name.split(':').pop() === name) return a.value;
    }
    return null;
  }
  function textOf(el) {
    return all(el, 't').map(function (t) { return t.textContent; }).join('');
  }
  function colIndex(ref) {
    var m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1;
    var n = 0; for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
    return n - 1;
  }

  /**
   * Read an .xlsx file. opts: { parseXml(text) → Document, inflateRaw? }
   * Resolves to { sheetName, rows: [[...]] } for the first worksheet.
   */
  function readXlsx(buffer, opts) {
    var z = zip.open(buffer, opts && opts.inflateRaw);
    var parse = opts.parseXml;
    if (!z.has('xl/workbook.xml')) return Promise.reject(new Error('આ Excel (.xlsx) ફાઇલ નથી.'));
    return Promise.all([
      z.text('xl/workbook.xml'), z.text('xl/_rels/workbook.xml.rels'),
      z.has('xl/sharedStrings.xml') ? z.text('xl/sharedStrings.xml') : Promise.resolve('')
    ]).then(function (r) {
      var wb = parse(r[0]), rels = parse(r[1]);
      var sheet = all(wb.documentElement, 'sheet')[0];
      if (!sheet) throw new Error('Excel ફાઇલમાં એક પણ શીટ નથી.');
      var rid = attr(sheet, 'id');
      var target = all(rels.documentElement, 'Relationship').filter(function (x) { return attr(x, 'Id') === rid; })[0];
      var path = attr(target, 'Target') || 'worksheets/sheet1.xml';
      path = path.charAt(0) === '/' ? path.slice(1) : 'xl/' + path.replace(/^\.\//, '');
      var shared = r[2] ? all(parse(r[2]).documentElement, 'si').map(textOf) : [];
      return z.text(path).then(function (xml) {
        var doc = parse(xml);
        var rows = [];
        all(doc.documentElement, 'row').forEach(function (rowEl) {
          var rIdx = Number(attr(rowEl, 'r')) - 1;
          var row = [];
          kids(rowEl, 'c').forEach(function (c, i) {
            var ci = colIndex(attr(c, 'r'));
            if (ci < 0) ci = i;
            var t = attr(c, 't'), v = kids(c, 'v')[0], val = '';
            if (t === 's') val = shared[Number(v && v.textContent)] || '';
            else if (t === 'inlineStr') val = textOf(c);
            else if (t === 'b') val = v && v.textContent === '1' ? 'TRUE' : 'FALSE';
            else val = v ? v.textContent : '';
            if (t !== 's' && t !== 'inlineStr' && t !== 'str' && /^-?\d+\.\d{9,}$/.test(val)) val = String(Number(Number(val).toPrecision(12)));
            row[ci] = val;
          });
          for (var k = 0; k < row.length; k++) if (row[k] == null) row[k] = '';
          rows[rIdx >= 0 ? rIdx : rows.length] = row;
        });
        var kept = [], numbers = [];
        rows.forEach(function (r, i) {
          if (r && r.some(function (x) { return String(x).trim() !== ''; })) { kept.push(r); numbers.push(i + 1); }
        });
        return { sheetName: attr(sheet, 'name'), rows: kept, rowNumbers: numbers };
      });
    });
  }

  return { readXlsx: readXlsx, _all: all, _kids: kids, _attr: attr };
});
