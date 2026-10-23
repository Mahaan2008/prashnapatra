/* Word (.docx) → lines of text for the question splitter.
   Handles: old Gujarati fonts (per run, using the run's font), Word equations (→ $LaTeX$),
   Symbol-font characters, superscript/subscript runs, automatic list numbering,
   tables, and pictures. Things it cannot convert are reported, not guessed. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./zip'), require('./legacy'), require('./omml'));
  else { root.QPG = root.QPG || {}; root.QPG.docx = factory(root.QPG.zip, root.QPG.legacy, root.QPG.omml); }
})(typeof self !== 'undefined' ? self : this, function (zip, legacy, omml) {
  'use strict';

  function ln(n) { return n.localName || String(n.nodeName).split(':').pop(); }
  function kids(el, name) {
    var out = [];
    if (!el) return out;
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && (!name || ln(n) === name)) out.push(n);
    return out;
  }
  function kid(el, name) { return kids(el, name)[0] || null; }
  function attr(el, name) {
    if (!el || !el.attributes) return null;
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if ((a.localName || a.name.split(':').pop()) === name) return a.value;
    }
    return null;
  }
  function deep(el, name, out) {
    out = out || [];
    for (var n = el && el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType !== 1) continue;
      if (ln(n) === name) out.push(n);
      deep(n, name, out);
    }
    return out;
  }

  var IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' };

  /* ---------- styles: which font a run really uses ---------- */
  function readStyles(doc) {
    var styles = {}, defaults = {};
    if (!doc) return { styles: styles, defaults: defaults };
    var root = doc.documentElement;
    var dd = kid(kid(kid(kid(root, 'docDefaults'), 'rPrDefault'), 'rPr'), 'rFonts');
    if (dd) defaults = { ascii: attr(dd, 'ascii'), hAnsi: attr(dd, 'hAnsi') };
    kids(root, 'style').forEach(function (s) {
      var rPr = kid(s, 'rPr'), pPr = kid(s, 'pPr');
      var f = kid(rPr, 'rFonts');
      var numPr = kid(pPr, 'numPr');
      styles[attr(s, 'styleId')] = {
        basedOn: attr(kid(s, 'basedOn'), 'val'),
        ascii: f ? attr(f, 'ascii') : null, hAnsi: f ? attr(f, 'hAnsi') : null,
        numId: numPr ? attr(kid(numPr, 'numId'), 'val') : null,
        ilvl: numPr ? attr(kid(numPr, 'ilvl'), 'val') : null
      };
    });
    return { styles: styles, defaults: defaults };
  }
  function styleChain(st, id, key) {
    var guard = 0;
    while (id && st.styles[id] && guard++ < 20) {
      if (st.styles[id][key]) return st.styles[id][key];
      id = st.styles[id].basedOn;
    }
    return null;
  }

  /* ---------- numbering: "1)", "(A)" made by Word lists ---------- */
  function readNumbering(doc) {
    var abs = {}, nums = {};
    if (!doc) return { abs: abs, nums: nums };
    kids(doc.documentElement, 'abstractNum').forEach(function (a) {
      var levels = {};
      kids(a, 'lvl').forEach(function (l) {
        levels[attr(l, 'ilvl')] = {
          fmt: attr(kid(l, 'numFmt'), 'val') || 'decimal',
          text: attr(kid(l, 'lvlText'), 'val') || '%1.',
          start: Number(attr(kid(l, 'start'), 'val') || 1)
        };
      });
      abs[attr(a, 'abstractNumId')] = levels;
    });
    kids(doc.documentElement, 'num').forEach(function (n) {
      nums[attr(n, 'numId')] = attr(kid(n, 'abstractNumId'), 'val');
    });
    return { abs: abs, nums: nums };
  }
  var GU_LETTERS = ['ક', 'ખ', 'ગ', 'ઘ', 'ચ', 'છ', 'જ', 'ઝ'];
  function roman(n) {
    var r = '', m = [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
    m.forEach(function (p) { while (n >= p[0]) { r += p[1]; n -= p[0]; } });
    return r;
  }
  function fmtNum(n, fmt) {
    switch (fmt) {
      case 'upperLetter': return String.fromCharCode(64 + ((n - 1) % 26) + 1);
      case 'lowerLetter': return String.fromCharCode(96 + ((n - 1) % 26) + 1);
      case 'upperRoman': return roman(n).toUpperCase();
      case 'lowerRoman': return roman(n);
      case 'bullet': return '';
      case 'hindiConsonants': case 'gujaratiConsonants': return GU_LETTERS[(n - 1) % GU_LETTERS.length];
      default: return String(n);
    }
  }

  /**
   * Read a .docx. opts: { parseXml, inflateRaw? }
   * Resolves to { lines: [...], report: {...} }.
   * A line is { text, images: [dataUrl], flags: [..] } or { table: [[cell text]], images, flags }.
   */
  function read(buffer, opts) {
    var z = zip.open(buffer, opts && opts.inflateRaw);
    var parse = opts.parseXml;
    if (!z.has('word/document.xml')) return Promise.reject(new Error('આ Word (.docx) ફાઇલ નથી. જૂની .doc ફાઇલ હોય તો Word માં ખોલીને "Save As → .docx" કરો.'));
    var opt = function (name) { return z.has(name) ? z.text(name) : Promise.resolve(null); };
    return Promise.all([z.text('word/document.xml'), opt('word/styles.xml'), opt('word/numbering.xml'), opt('word/_rels/document.xml.rels')])
      .then(function (r) {
        var doc = parse(r[0]);
        var st = readStyles(r[1] && parse(r[1]));
        var numbering = readNumbering(r[2] && parse(r[2]));
        var rels = {};
        if (r[3]) kids(parse(r[3]).documentElement, 'Relationship').forEach(function (x) { rels[attr(x, 'Id')] = attr(x, 'Target'); });
        var report = { paragraphs: 0, equations: 0, oleEquations: 0, images: 0, badImages: 0, legacy: {}, unsupportedFonts: {}, unknownChars: [] };
        var counters = {};
        var imageJobs = [];
        var lines = [];

        function imageFor(rid, line) {
          var target = rels[rid];
          if (!target) return;
          var path = target.charAt(0) === '/' ? target.slice(1) : 'word/' + target.replace(/^\.\//, '');
          var ext = (path.split('.').pop() || '').toLowerCase();
          if (!IMAGE_TYPES[ext]) { report.badImages++; line.flags.push('bad-image'); return; }
          report.images++;
          var slot = line.images.length;
          line.images.push(null);
          imageJobs.push(z.bytes(path).then(function (b) {
            line.images[slot] = 'data:' + IMAGE_TYPES[ext] + ';base64,' + zip.base64(b);
          }).catch(function () { line.images[slot] = null; }));
        }

        /* Collect a paragraph's pieces: { kind, text, vert } or { math }. */
        function paragraphPieces(p, line) {
          var pieces = [];
          var pStyle = attr(kid(kid(p, 'pPr'), 'pStyle'), 'val');
          function runFonts(r) {
            var rPr = kid(r, 'rPr');
            var f = kid(rPr, 'rFonts');
            var rStyle = attr(kid(rPr, 'rStyle'), 'val');
            var ascii = (f && attr(f, 'ascii')) || styleChain(st, rStyle, 'ascii') || styleChain(st, pStyle, 'ascii') || st.defaults.ascii;
            var hAnsi = (f && attr(f, 'hAnsi')) || (f && attr(f, 'ascii')) || styleChain(st, rStyle, 'hAnsi') || styleChain(st, pStyle, 'hAnsi') || st.defaults.hAnsi || ascii;
            var va = attr(kid(rPr, 'vertAlign'), 'val');
            return { ascii: ascii, hAnsi: hAnsi, vert: va === 'superscript' ? 'sup' : va === 'subscript' ? 'sub' : '' };
          }
          function pushText(text, fonts) {
            Array.from(text).forEach(function (ch) {
              var font = ch.charCodeAt(0) < 0x80 ? fonts.ascii : fonts.hAnsi;
              var kind = legacy.fontKind(font);
              if (kind === 'unsupported') report.unsupportedFonts[font] = (report.unsupportedFonts[font] || 0) + 1;
              var last = pieces[pieces.length - 1];
              if (last && !last.math && last.kind === kind && last.vert === fonts.vert && last.font === (kind === 'unsupported' ? font : last.font)) last.text += ch;
              else pieces.push({ kind: kind, text: ch, vert: fonts.vert, font: kind === 'unsupported' ? font : null });
            });
          }
          function walk(node) {
            kids(node).forEach(function (c) {
              switch (ln(c)) {
                case 'r': {
                  var fonts = runFonts(c);
                  kids(c).forEach(function (x) {
                    switch (ln(x)) {
                      case 't': pushText(x.textContent, fonts); break;
                      case 'tab': pushText('\t', { ascii: null, hAnsi: null, vert: '' }); break;
                      case 'br': case 'cr': pushText('\n', { ascii: null, hAnsi: null, vert: '' }); break;
                      case 'noBreakHyphen': pushText('-', fonts); break;
                      case 'sym': {
                        var code = parseInt(attr(x, 'char') || '0', 16);
                        var font = attr(x, 'font') || '';
                        var ch = String.fromCharCode(code >= 0xF000 ? code - 0xF000 : code);
                        if (/symbol/i.test(font)) ch = legacy.symbolChar(ch);
                        pushText(ch, { ascii: null, hAnsi: null, vert: fonts.vert });
                        break;
                      }
                      case 'drawing':
                        deep(x, 'blip').forEach(function (b) { imageFor(attr(b, 'embed'), line); });
                        break;
                      case 'pict':
                        deep(x, 'imagedata').forEach(function (im) { imageFor(attr(im, 'id'), line); });
                        break;
                      case 'object': {
                        var ole = deep(x, 'OLEObject')[0];
                        var prog = ole ? attr(ole, 'ProgID') || '' : '';
                        if (/equation|dsmt|mathtype/i.test(prog)) {
                          report.oleEquations++;
                          line.flags.push('ole-equation');
                          pieces.push({ kind: 'unicode', text: ' [સૂત્ર] ', vert: '' });
                        } else {
                          deep(x, 'imagedata').forEach(function (im) { imageFor(attr(im, 'id'), line); });
                        }
                        break;
                      }
                    }
                  });
                  break;
                }
                case 'oMath': case 'oMathPara': {
                  var tex = '';
                  try { tex = omml.toLatex(c); } catch (e) { tex = ''; }
                  report.equations++;
                  if (tex) pieces.push({ math: tex });
                  break;
                }
                case 'hyperlink': case 'smartTag': case 'ins': case 'fldSimple': case 'customXml': case 'sdtContent':
                  walk(c); break;
                case 'sdt': walk(kid(c, 'sdtContent') || c); break;
                default: break;   // pPr, bookmarks, deleted text, comments
              }
            });
          }
          walk(p);
          return pieces;
        }

        function piecesToText(pieces, line) {
          return pieces.map(function (pc) {
            if (pc.math) return '$' + pc.math + '$';
            var t = pc.text;
            if (pc.kind === 'sg' || pc.kind === 'tera') {
              var r = legacy.convert(t, pc.kind);
              report.legacy[pc.kind] = (report.legacy[pc.kind] || 0) + 1;
              if (line.flags.indexOf('legacy') < 0) line.flags.push('legacy');
              r.unknown.forEach(function (u) { if (report.unknownChars.indexOf(u) < 0) report.unknownChars.push(u); });
              if (r.unknown.length && line.flags.indexOf('unknown-chars') < 0) line.flags.push('unknown-chars');
              t = r.text;
            } else if (pc.kind === 'symbol') {
              t = legacy.convertSymbol(t);
            } else if (pc.kind === 'unsupported') {
              if (line.flags.indexOf('unsupported-font') < 0) line.flags.push('unsupported-font');
            }
            t = t.replace(/\$/g, '＄');   // a typed dollar sign must not start a formula
            if (pc.vert && t.trim()) {
              var inner = t.trim().replace(/[{}]/g, '').replace(/−/g, '-');
              return (pc.vert === 'sup' ? '$^{' : '$_{') + (/[઀-૿]/.test(inner) ? '\\text{' + inner + '}' : inner) + '}$';
            }
            return t;
          }).join('');
        }

        function numberLabel(p) {
          var pPr = kid(p, 'pPr');
          var numPr = kid(pPr, 'numPr');
          var pStyle = attr(kid(pPr, 'pStyle'), 'val');
          var numId = numPr ? attr(kid(numPr, 'numId'), 'val') : styleChain(st, pStyle, 'numId');
          var ilvl = numPr && kid(numPr, 'ilvl') ? attr(kid(numPr, 'ilvl'), 'val') : (styleChain(st, pStyle, 'ilvl') || '0');
          if (!numId || numId === '0') return null;
          var absId = numbering.nums[numId];
          var levels = numbering.abs[absId];
          if (!levels) return null;
          var lvl = Number(ilvl) || 0;
          var key = absId;
          var c = counters[key] = counters[key] || {};
          c[lvl] = (c[lvl] == null ? (levels[lvl] ? levels[lvl].start : 1) : c[lvl] + 1);
          Object.keys(c).forEach(function (k) { if (Number(k) > lvl) delete c[k]; });
          var def = levels[lvl] || { fmt: 'decimal', text: '%1.' };
          if (def.fmt === 'bullet' || def.fmt === 'none') return null;
          var label = def.text.replace(/%(\d)/g, function (m, d) {
            var L = Number(d) - 1;
            var ld = levels[L] || def;
            return fmtNum(c[L] == null ? 1 : c[L], ld.fmt);
          });
          return { label: label, level: lvl, fmt: def.fmt };
        }

        function paragraphLine(p) {
          var line = { text: '', images: [], flags: [] };
          var pieces = paragraphPieces(p, line);
          var text = piecesToText(pieces, line);
          var num = numberLabel(p);
          if (num && text.trim()) {
            line.numbered = num;
            // a top-level 1, 2, 3 list starts a new question (the importer uses line.numbered);
            // other list labels such as (A) (B) are written out so options are recognised
            if (!(num.fmt === 'decimal' && num.level === 0)) text = num.label + ' ' + text;
          }
          line.text = text;
          return line;
        }

        function tableLine(tbl) {
          var line = { table: [], images: [], flags: [] };
          kids(tbl, 'tr').forEach(function (tr) {
            var row = [];
            kids(tr, 'tc').forEach(function (tc) {
              var parts = [];
              kids(tc).forEach(function (x) {
                if (ln(x) === 'p') {
                  var pl = paragraphLine(x);
                  if (pl.text.trim()) parts.push(pl.text.trim());
                  pl.images.forEach(function (im, i) { line.images.push(im); void i; });
                  pl.flags.forEach(function (f) { if (line.flags.indexOf(f) < 0) line.flags.push(f); });
                } else if (ln(x) === 'tbl') {
                  var inner = tableLine(x);
                  inner.table.forEach(function (r2) { parts.push(r2.join('\t')); });
                }
              });
              row.push(parts.join(' '));
            });
            line.table.push(row);
          });
          return line;
        }

        var body = kid(doc.documentElement, 'body');
        (function walkBody(node) {
          kids(node).forEach(function (el) {
            var name = ln(el);
            if (name === 'p') {
              report.paragraphs++;
              var line = paragraphLine(el);
              // a soft line break inside a paragraph starts a new line
              var parts = line.text.split('\n');
              parts.forEach(function (t, i) {
                lines.push({ text: t, images: i === parts.length - 1 ? line.images : [], flags: line.flags.slice(),
                  numbered: i === 0 ? line.numbered : null, legacy: line.flags.indexOf('legacy') >= 0 });
              });
            } else if (name === 'tbl') {
              var tl = tableLine(el);
              tl.legacy = tl.flags.indexOf('legacy') >= 0;
              lines.push(tl);
            } else if (name === 'sdt') {
              walkBody(kid(el, 'sdtContent') || el);
            }
          });
        })(body);

        return Promise.all(imageJobs).then(function () {
          lines.forEach(function (l) { l.images = l.images.filter(Boolean); });
          return { lines: lines, report: report };
        });
      });
  }

  return { read: read };
});
