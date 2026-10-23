/* Turning outside data into questions: spreadsheet rows (Excel/CSV), plain text
   (pasted or from Word) and JSON. Nothing is saved here — every result goes to a
   review screen with its errors and warnings first. Pure logic, tested in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./schema'), require('./gujarati'), require('../import/legacy'), require('./syllabus'));
  } else { root.QPG = root.QPG || {}; root.QPG.importer = factory(root.QPG.schema, root.QPG.gujarati, root.QPG.legacy, root.QPG.syllabus); }
})(typeof self !== 'undefined' ? self : this, function (schema, gujarati, legacy, syllabus) {
  'use strict';

  /* ---------------- CSV ---------------- */
  /** RFC-4180 style CSV (quotes, commas and line breaks inside quotes). Detects , ; or tab. */
  function parseCSV(text) {
    var s = String(text || '').replace(/^﻿/, '');
    var firstLine = s.split(/\r?\n/)[0] || '';
    var counts = { ',': 0, ';': 0, '\t': 0 }, inQ = false;
    for (var i = 0; i < firstLine.length; i++) {
      var c0 = firstLine[i];
      if (c0 === '"') inQ = !inQ; else if (!inQ && counts[c0] != null) counts[c0]++;
    }
    var sep = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    if (!counts[sep]) sep = ',';
    var rows = [], row = [], cell = '', q = false;
    for (var k = 0; k < s.length; k++) {
      var c = s[k];
      if (q) {
        if (c === '"') { if (s[k + 1] === '"') { cell += '"'; k++; } else q = false; }
        else cell += c;
      } else if (c === '"' && cell === '') q = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && s[k + 1] === '\n') k++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
  }

  /* ---------------- column names (English or Gujarati) ---------------- */
  var COLUMNS = {
    subject: ['subject', 'વિષય'],
    std: ['std', 'standard', 'class', 'ધોરણ'],
    chapter: ['chapter', 'ch', 'chapter no', 'પ્રકરણ', 'પ્રકરણ નંબર'],
    topic: ['topic', 'મુદ્દો', 'ટોપિક'],
    type: ['type', 'question type', 'પ્રકાર', 'પ્રશ્નનો પ્રકાર'],
    marks: ['marks', 'mark', 'ગુણ'],
    difficulty: ['difficulty', 'level', 'કઠિનતા'],
    text: ['question', 'text', 'question text', 'પ્રશ્ન', 'પરિચ્છેદ'],
    a: ['a', 'option a', 'option_a', 'opt a', '(a)', 'વિકલ્પ a', 'વિકલ્પ (a)'],
    b: ['b', 'option b', 'option_b', 'opt b', '(b)', 'વિકલ્પ b', 'વિકલ્પ (b)'],
    c: ['c', 'option c', 'option_c', 'opt c', '(c)', 'વિકલ્પ c', 'વિકલ્પ (c)'],
    d: ['d', 'option d', 'option_d', 'opt d', '(d)', 'વિકલ્પ d', 'વિકલ્પ (d)'],
    answer: ['answer', 'ans', 'correct', 'correct answer', 'જવાબ', 'સાચો જવાબ'],
    solution: ['solution', 'explanation', 'ઉકેલ', 'સમજૂતી'],
    source: ['source', 'reference', 'સંદર્ભ', 'સ્રોત'],
    language: ['language', 'lang', 'ભાષા'],
    assertion: ['assertion', 'વિધાન', 'વિધાન (a)'],
    reason: ['reason', 'કારણ', 'કારણ (r)'],
    column1: ['column 1', 'column i', 'column1', 'કૉલમ-i', 'કોલમ-i', 'કૉલમ 1'],
    column2: ['column 2', 'column ii', 'column2', 'કૉલમ-ii', 'કોલમ-ii', 'કૉલમ 2'],
    subparts: ['sub questions', 'subparts', 'પેટા-પ્રશ્નો', 'પેટા પ્રશ્નો']
  };
  function keyOf(header) {
    var h = gujarati.normalize(header).replace(/[*:]/g, '').trim();
    for (var k in COLUMNS) if (COLUMNS[k].indexOf(h) >= 0) return k;
    return null;
  }

  /* ---------------- value words ---------------- */
  var SUBJECT_WORDS = { physics: ['physics', 'phy', 'ભૌતિકવિજ્ઞાન', 'ભૌતિક વિજ્ઞાન', 'ભૌતિક', 'ફિઝિક્સ'], maths: ['maths', 'math', 'mathematics', 'ગણિત'] };
  var TYPE_WORDS = {
    mcq: ['mcq', 'objective', 'બહુવિકલ્પ', 'બહુવિકલ્પ (mcq)', 'વિકલ્પ'],
    very_short: ['very_short', 'very short', 'one line', 'one-line', 'એક વાક્યમાં જવાબ', 'એક વાક્ય', 'અતિ ટૂંકો'],
    short_answer: ['short_answer', 'short', 'short answer', 'ટૂંકો જવાબ', 'ટૂંકો'],
    long_answer: ['long_answer', 'long', 'long answer', 'લાંબો જવાબ', 'લાંબો'],
    numerical: ['numerical', 'numeric', 'sum', 'દાખલો', 'દાખલા'],
    derivation: ['derivation', 'derive', 'સૂત્ર તારવણી', 'તારવણી'],
    proof: ['proof', 'prove', 'સાબિત કરો', 'સાબિતી'],
    fill_blank: ['fill_blank', 'fill', 'fill in the blank', 'blank', 'ખાલી જગ્યા'],
    match_columns: ['match_columns', 'match', 'match the following', 'જોડકાં', 'જોડકા'],
    assertion_reason: ['assertion_reason', 'assertion reason', 'ar', 'a-r', 'વિધાન-કારણ', 'વિધાન કારણ'],
    case_based: ['case_based', 'case', 'passage', 'case study', 'પરિચ્છેદ આધારિત', 'પરિચ્છેદ'],
    diagram_based: ['diagram_based', 'diagram', 'આકૃતિ આધારિત', 'આકૃતિ']
  };
  var DIFF_WORDS = { easy: ['easy', 'e', 'સરળ'], medium: ['medium', 'm', 'મધ્યમ'], hard: ['hard', 'difficult', 'h', 'કઠિન', 'અઘરો'] };
  function lookup(words, v) {
    var n = gujarati.normalize(v);
    if (!n) return '';
    for (var k in words) if (k === n || words[k].indexOf(n) >= 0) return k;
    return null;
  }
  var GU_LETTERS = { 'અ': 'A', 'બ': 'B', 'ક': 'C', 'ડ': 'D' };
  function answerLetter(v) {
    var s = String(v || '').trim().replace(/[()[\]{}.\s]/g, '');
    if (/^[a-d]$/i.test(s)) return s.toUpperCase();
    if (GU_LETTERS[s]) return GU_LETTERS[s];
    return null;
  }
  function num(v) {
    var s = gujarati.toLatinDigits(String(v == null ? '' : v)).trim();
    if (s === '') return null;
    var n = Number(s);
    return isNaN(n) ? NaN : n;
  }
  function splitList(v) { return String(v || '').split(/\s*\|\s*|\n/).map(function (x) { return x.trim(); }).filter(Boolean); }

  /** Old-font text in a cell is converted; the item gets a "check this" note. */
  function fixLegacy(v, notes) {
    var s = v == null ? '' : String(v);
    if (gujarati.looksLikeLegacyFont(s)) { notes.converted = true; return legacy.convertGuess(s); }
    return s;
  }

  /* ---------------- shared finishing ---------------- */
  function dupKey(q) {
    return [q.subject, gujarati.normalize(q.text || q.assertion), (q.options || []).map(gujarati.normalize).join('|')].join('#');
  }

  /**
   * Validate, add import notes and find duplicates.
   * existing: questions already in the bank.
   */
  function finish(drafts, existing) {
    var seen = {};
    (existing || []).forEach(function (q) { if (!q.deletedAt) seen[dupKey(q)] = { where: 'bank', id: q.id }; });
    return drafts.map(function (d) {
      var q = schema.normalizeQuestion(d.raw);
      var v = schema.validateQuestion(q);
      var warnings = v.warnings.slice();
      (d.notes.messages || []).forEach(function (m) { warnings.unshift({ field: 'import', msg: m }); });
      if (d.notes.converted) warnings.unshift({ field: 'import', msg: 'જૂના ફોન્ટ (Sulekh/Gopika/Terafont) માંથી Unicode માં ફેરવ્યું — એક વાર વાંચીને ચકાસો.' });
      var key = dupKey(q), dup = null;
      if (q.text || q.assertion) {
        if (seen[key]) dup = seen[key].where === 'bank' ? 'bank' : 'file';
        else seen[key] = { where: 'file' };
      }
      return { ref: d.ref, question: q, errors: v.errors, warnings: warnings, duplicate: dup, ok: v.ok };
    });
  }

  /* ---------------- spreadsheet rows ---------------- */
  /**
   * rows: 2-D array with a header row. defaults: {subject, std, chapter, type, marks, difficulty, source}
   * Returns { items, unknownColumns, missing: [...] }.
   */
  function fromRows(rows, defaults, existing) {
    defaults = defaults || {};
    if (!rows || rows.length < 2) return { items: [], unknownColumns: [], missing: ['rows'], headerError: 'ફાઇલમાં પહેલી લાઇનમાં કૉલમનાં નામ અને નીચે ઓછામાં ઓછો એક પ્રશ્ન જોઈએ.' };
    var header = rows[0].map(function (h) { return String(h || ''); });
    var keys = header.map(keyOf);
    var unknown = header.filter(function (h, i) { return h.trim() && !keys[i]; });
    if (keys.indexOf('text') < 0 && keys.indexOf('assertion') < 0) {
      return { items: [], unknownColumns: unknown, missing: ['text'], headerError: '"પ્રશ્ન" (Question) નામની કૉલમ મળી નહીં. નમૂના ફાઇલ જેવી પહેલી લાઇન રાખો.' };
    }
    var drafts = [];
    rows.slice(1).forEach(function (r, i) {
      var cell = {};
      keys.forEach(function (k, j) { if (k) cell[k] = r[j] == null ? '' : String(r[j]).trim(); });
      if (!Object.keys(cell).some(function (k) { return cell[k]; })) return;
      var notes = { messages: [] };
      var raw = { source: defaults.source || '' };

      var subj = lookup(SUBJECT_WORDS, cell.subject);
      if (subj === null) notes.messages.push('વિષય "' + cell.subject + '" ઓળખાયો નહીં.');
      raw.subject = subj || defaults.subject || '';
      var std = num(cell.std);
      raw.std = std != null && !isNaN(std) ? std : (defaults.std || null);
      if (std != null && isNaN(std)) notes.messages.push('ધોરણ "' + cell.std + '" સંખ્યા નથી.');
      var ch = num(cell.chapter);
      raw.chapter = ch != null && !isNaN(ch) ? ch : (defaults.chapter || null);
      if (ch != null && isNaN(ch)) notes.messages.push('પ્રકરણ "' + cell.chapter + '" સંખ્યા નથી.');
      var marks = num(cell.marks);
      raw.marks = marks != null ? marks : (defaults.marks != null ? defaults.marks : null);
      var type = lookup(TYPE_WORDS, cell.type);
      if (type === null) notes.messages.push('પ્રકાર "' + cell.type + '" ઓળખાયો નહીં.');
      var opts = ['a', 'b', 'c', 'd'].map(function (k) { return fixLegacy(cell[k], notes); });
      var hasOpts = opts.some(Boolean);
      raw.type = type || (cell.assertion ? 'assertion_reason' : cell.column1 ? 'match_columns' : hasOpts ? 'mcq' : (defaults.type || 'short_answer'));
      var diff = lookup(DIFF_WORDS, cell.difficulty);
      raw.difficulty = diff || defaults.difficulty || 'medium';
      raw.topic = fixLegacy(cell.topic, notes);
      raw.text = fixLegacy(cell.text, notes);
      raw.options = opts;
      raw.solution = fixLegacy(cell.solution, notes);
      raw.language = cell.language && /en/i.test(cell.language) ? 'en' : 'gu';
      if (cell.source) raw.source = cell.source;
      raw.assertion = fixLegacy(cell.assertion, notes);
      raw.reason = fixLegacy(cell.reason, notes);
      raw.matchLeft = splitList(fixLegacy(cell.column1, notes));
      raw.matchRight = splitList(fixLegacy(cell.column2, notes));
      raw.subparts = splitList(fixLegacy(cell.subparts, notes)).map(function (t) { return { text: t }; });
      var ans = fixLegacy(cell.answer, notes);
      if (raw.type === 'mcq' || raw.type === 'assertion_reason') {
        var L = answerLetter(ans);
        if (ans && !L) {
          var idx = opts.map(gujarati.normalize).indexOf(gujarati.normalize(ans));
          if (idx >= 0) raw.answer = schema.OPTION_LETTERS[idx];
          else { raw.answer = ''; notes.messages.push('જવાબ "' + ans + '" A, B, C કે D નથી — જવાબ ખાલી રાખ્યો.'); }
        } else raw.answer = L || '';
      } else raw.answer = ans;
      drafts.push({ ref: 'લાઇન ' + (rows.rowNumbers ? rows.rowNumbers[i + 1] : i + 2), raw: raw, notes: notes });
    });
    return { items: finish(drafts, existing), unknownColumns: unknown, missing: [] };
  }

  /* ---------------- plain text (pasted, or lines from Word) ---------------- */
  var Q_START = /^\s*(?:પ્ર(?:શ્ન)?\.?\s*|Q\.?\s*)?([0-9૦-૯]{1,3})\s*[).:]\s*(.*)$/i;
  var OPT_ANY = /\(\s*([A-Da-dઅબકડ])\s*\)|(?:^|\s)([A-D])\)\s/g;
  var ANS_LINE = /^\s*(?:જવાબ|ઉત્તર|સાચો જવાબ|ans(?:wer)?)\s*[:：.\-–]\s*(.*)$/i;
  var SOL_LINE = /^\s*(?:ઉકેલ|સમજૂતી|sol(?:ution)?)\s*[:：.\-–]\s*(.*)$/i;
  var OWN_MARKS = /\s*[(\[]\s*([0-9૦-૯]{1,2}(?:\.5)?)\s*(?:ગુણ|marks?)\s*[)\]]\s*$/i;
  var AR_LINE = /^\s*(?:વિધાન|કથન|assertion|કારણ|reason)\s*[(\[]?\s*[AR]?\s*[)\]]?\s*[:：\-–]/i;
  var NOTE_FOR_FLAG = {
    'unknown-chars': 'કેટલાક અક્ષર ઓળખાયા નહીં અને [?] તરીકે દેખાય છે — સુધારો.',
    'ole-equation': 'Word માં જૂનું (MathType / Equation 3.0) સૂત્ર હતું, જે ફેરવી શકાતું નથી — [સૂત્ર] ની જગ્યાએ જાતે લખો.',
    'bad-image': 'આકૃતિ EMF/WMF પ્રકારની છે, જે ઉમેરી શકાતી નથી — પ્રશ્ન સુધારીને ફોટો તરીકે ઉમેરો.',
    'unsupported-font': 'લખાણ એવા જૂના ફોન્ટમાં છે જે હજુ ફેરવી શકાતો નથી — લખાણ તપાસો.'
  };
  var LETTER = { a: 'A', b: 'B', c: 'C', d: 'D', 'અ': 'A', 'બ': 'B', 'ક': 'C', 'ડ': 'D' };

  /** Word/PDF "math italic" letters and bold digits (𝐴, 𝟏) → plain A, 1. */
  function mathAlnum(s) {
    return String(s).replace(/[\u{1D400}-\u{1D7FF}]/gu, function (c) { return c.normalize('NFKC'); });
  }

  /** Marks from a heading like "[ … પ્રત્યેકના 2 ગુણ છે. ]" or "(દરેકના 3 ગુણ)". */
  function headingMarks(line) {
    var t = mathAlnum(gujarati.toLatinDigits(line));
    var m = t.match(/(?:પ્રત્યેક(?:ના|નો)?|દરેક(?:ના|નો)?|each(?: of)?)\s*([0-9]+(?:\.5)?)\s*[–\-−]?\s*(?:ગુણ|marks?)/i) ||
      t.match(/([0-9]+(?:\.5)?)\s*(?:ગુણ|marks?)\s*(?:ના|નો|છે)/i);
    return m ? Number(m[1]) : null;
  }
  function isHeading(line) {
    return /^\s*(section|part|વિભાગ|ભાગ)[\s\-–]*[A-Za-z0-9઀-૿]*\b/i.test(line) || /^\s*\[.*\]\s*$/.test(line) ||
      /^\s*❖/.test(line) || headingMarks(line) != null;
  }

  /** Split one line into text before the options and the options found on it.
      first: the letter the options on this line start from (C when A and B were on the line before). */
  function splitOptions(line, first) {
    var marks = [], m;
    OPT_ANY.lastIndex = 0;
    while ((m = OPT_ANY.exec(line))) {
      var L = LETTER[(m[1] || m[2]).toLowerCase()] || LETTER[m[1]];
      var start = m.index + (m[0].length - m[0].replace(/^\s+/, '').length);
      marks.push({ L: L, start: start, end: m.index + m[0].length });
    }
    // options must appear in order A, B, C, D (to skip "(a)" inside a question)
    var seq = [], want = first || 'A';
    marks.forEach(function (x) {
      if (x.L !== want) return;
      seq.push(x); want = String.fromCharCode(want.charCodeAt(0) + 1);
    });
    if (!seq.length) return null;
    // "(a) … (b)" written in small letters are parts of a question unless all four are there
    var small = seq.some(function (x) { return /[a-dઅબકડ]/.test(line.slice(x.start, x.end).replace(/[()\s]/g, '')); });
    if (small && seq.length < 4 && !first) return null;
    var opts = seq.map(function (x, i) {
      return { L: x.L, text: line.slice(x.end, i + 1 < seq.length ? seq[i + 1].start : line.length).trim() };
    });
    return { before: line.slice(0, seq[0].start).trim(), opts: opts };
  }

  function guessType(q, marks) {
    var opts = q.options.filter(Boolean).length;
    if (q.matchLeft && q.matchLeft.length >= 2) return 'match_columns';
    if (opts >= 2) return 'mcq';
    var t = q.text || '';
    if (/વિધાન\s*\(?A\)?/.test(t) && /કારણ\s*\(?R\)?/.test(t)) return 'assertion_reason';
    if (/(કૉલમ|કોલમ|column)\s*[-–]?\s*(I|1)\b/i.test(t)) return 'match_columns';
    if (/સાબિત\s*કરો|prove/i.test(t)) return 'proof';
    if (/(\.{4,}|…{2,}|_{4,})/.test(t) && marks <= 1) return 'fill_blank';
    if (/(સૂત્ર|સમીકરણ[ોો]*)\s*(મેળવો|તારવો)|derive/i.test(t)) return 'derivation';
    if (marks <= 1) return 'very_short';
    if (marks >= 4) return 'long_answer';
    return 'short_answer';
  }

  /**
   * lines: strings, or {text, images:[dataURL], numbered:{level}, legacy:true}
   * defaults: {subject, std, chapter, marks, type, difficulty, source}
   */
  function fromText(lines, defaults, existing) {
    defaults = defaults || {};
    var list = (typeof lines === 'string' ? lines.split(/\r?\n/) : lines || []).map(function (l) {
      return typeof l === 'string' ? { text: l } : l;
    });
    var drafts = [], cur = null, marks = defaults.marks != null ? Number(defaults.marks) : null;
    var autoNo = 0, preamble = [];

    function close() {
      if (!cur) return;
      var q = cur.raw;
      q.text = q.text.trim();
      q.options = q.options.slice(0, 4);
      var hasAll = q.options.filter(Boolean).length === 4;
      if (q.options.some(Boolean) && !hasAll) cur.notes.messages.push('ચારેય વિકલ્પ મળ્યા નહીં — ચકાસો.');
      if (!defaults.type || defaults.type === 'auto') q.type = guessType(q, q.marks || 0);
      else q.type = defaults.type;
      if (q.type === 'assertion_reason') {
        var a = q.text.match(/વિધાન\s*\(?A\)?\s*[:：]?\s*([\s\S]*?)\s*કારણ\s*\(?R\)?\s*[:：]?\s*([\s\S]*)$/);
        if (a) { q.assertion = a[1].trim(); q.reason = a[2].trim(); q.text = ''; }
      }
      if (q.type === 'mcq' || q.type === 'assertion_reason') q.answer = answerLetter(q.answer) || '';
      drafts.push(cur); cur = null;
    }
    function start(textAfterNo, no) {
      close();
      cur = { ref: 'પ્રશ્ન ' + no, notes: { messages: [] }, lastOpt: -1, raw: {
        subject: defaults.subject, std: defaults.std, chapter: defaults.chapter, marks: marks,
        difficulty: defaults.difficulty || 'medium', source: defaults.source || '', text: '', options: ['', '', '', ''],
        answer: '', solution: '', image: '', matchLeft: [], matchRight: [] } };
      var own = String(textAfterNo).match(OWN_MARKS);
      if (own) {
        var n = Number(gujarati.toLatinDigits(own[1]));
        if (n > 0 && n <= 10) { cur.raw.marks = n; textAfterNo = textAfterNo.slice(0, own.index); }
      }
      addText(textAfterNo);
    }
    function addText(t) {
      if (!cur) return;
      if (AR_LINE.test(t)) { cur.lastOpt = -1; appendBody(t); return; }
      var s = splitOptions(t, cur.lastOpt >= 0 && cur.lastOpt < 3 ? schema.OPTION_LETTERS[cur.lastOpt + 1] : null);
      if (s && cur.lastOpt >= 0 && s.before) { cur.raw.options[cur.lastOpt] += ' ' + s.before; s.before = ''; }
      if (s) {
        if (s.before) appendBody(s.before);
        s.opts.forEach(function (o) { var i = schema.OPTION_LETTERS.indexOf(o.L); cur.raw.options[i] = o.text; cur.lastOpt = i; });
      } else if (cur.lastOpt >= 0 && t.trim()) {
        cur.raw.options[cur.lastOpt] += ' ' + t.trim();          // option text that wrapped to a new line
      } else appendBody(t);
    }
    function appendBody(t) {
      if (cur.inSolution) { cur.raw.solution += (cur.raw.solution ? '\n' : '') + t; return; }
      cur.raw.text += (cur.raw.text ? '\n' : '') + t;
    }

    function table(line) {
      var rows = (line.table || []).filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
      var header = rows.length && rows[0].some(function (c) { return /(કૉલમ|કોલમ|column)/i.test(c); });
      var wantsMatch = cur && (header || /જોડ|કૉલમ|કોલમ|column|match/i.test(cur.raw.text));
      if (wantsMatch && rows.length >= 2) {
        var left = [], right = [];
        rows.slice(header ? 1 : 0).forEach(function (r) {
          var cells = r.map(function (c) { return String(c).trim(); }).filter(function (c) {
            return c && !/^\(?\s*(?:[0-9૦-૯]{1,2}|[a-zA-Z]|[ivx]{1,4}|[અ-ઔ]|[ક-હ])\s*[).]?\s*\)?$/.test(c);
          });
          if (cells.length >= 2) { left.push(cells[0]); right.push(cells[cells.length - 1]); }
          else if (cells.length === 1) right.push(cells[0]);
        });
        if (left.length >= 2) { cur.raw.matchLeft = left; cur.raw.matchRight = right; return true; }
      }
      return false;
    }

    var expanded = [];
    list.forEach(function (line) {
      if (line.table) {
        expanded.push({ tableLine: line });
        line.table.forEach(function (r, i) {
          var text = r.map(function (c) { return String(c).trim(); }).filter(Boolean).join('   ');
          expanded.push({ text: text, fromTable: line, images: i === line.table.length - 1 ? line.images : [], flags: line.flags, legacy: line.legacy });
        });
      } else expanded.push(line);
    });
    // a document typed in an old font: convert every line that still has old-font letters
    var legacyLines = expanded.filter(function (l) { return l.text && gujarati.looksLikeLegacyFont(l.text); }).length;
    var nonEmpty = expanded.filter(function (l) { return l.text && l.text.trim(); }).length || 1;
    var legacyDoc = legacyLines >= 3 || legacyLines / nonEmpty >= 0.2;
    var skipTable = null;
    expanded.forEach(function (line) {
      if (line.tableLine) { skipTable = table(line.tableLine) ? line.tableLine : null; return; }
      if (line.fromTable && line.fromTable === skipTable) {
        if (cur && line.images && line.images.length && !cur.raw.image) cur.raw.image = line.images[0];
        return;
      }
      var raw = String(line.text || '');
      var convertedNow = false;
      if (gujarati.looksLikeLegacyFont(raw) || (legacyDoc && /[\u00C0-\u00FF]/.test(raw))) { raw = legacy.convertGuess(raw); convertedNow = true; }
      var t = mathAlnum(raw).replace(/\s+$/, '');
      if (!t.trim() && !(line.images && line.images.length)) return;

      var hm = headingMarks(t);
      var qs = t.match(Q_START);
      if (!qs && isHeading(t)) { if (hm != null) marks = hm; close(); return; }

      var a = t.match(ANS_LINE), so = t.match(SOL_LINE);
      if (cur && a) { cur.raw.answer = a[1].trim(); cur.lastOpt = -1; }
      else if (cur && so) { cur.raw.solution = so[1].trim(); cur.inSolution = true; cur.lastOpt = -1; }
      else if (qs) start(qs[2], gujarati.toLatinDigits(qs[1]));
      else if (line.numbered && line.numbered.level === 0 && (!line.numbered.fmt || line.numbered.fmt === 'decimal')) start(t, ++autoNo);
      else if (cur) addText(t);
      else { preamble.push(t); return; }   // paper header before question 1 — used only if no numbers are found

      if (cur && line.images && line.images.length && !cur.raw.image) cur.raw.image = line.images[0];
      if (cur && (line.legacy || convertedNow)) cur.notes.converted = true;
      if (cur && line.flags) line.flags.forEach(function (f) {
        if (NOTE_FOR_FLAG[f] && cur.notes.messages.indexOf(NOTE_FOR_FLAG[f]) < 0) cur.notes.messages.push(NOTE_FOR_FLAG[f]);
      });
    });
    close();
    if (!drafts.length && preamble.length) {           // no numbered questions: one question per paragraph
      preamble.forEach(function (p, i) { start(p, i + 1); });
      close();
    }
    return { items: finish(drafts, existing), unknownColumns: [], missing: [], skippedLines: drafts.length ? preamble.length : 0 };
  }

  /* ---------------- JSON ---------------- */
  function fromJSON(text, defaults, existing) {
    var data;
    try { data = typeof text === 'string' ? JSON.parse(text) : text; }
    catch (e) { return { items: [], headerError: 'JSON ફાઇલ વાંચી શકાઈ નહીં: ' + e.message }; }
    var list = Array.isArray(data) ? data : data && Array.isArray(data.questions) ? data.questions : null;
    if (!list) return { items: [], headerError: 'JSON માં પ્રશ્નોની યાદી ("questions") મળી નહીં.' };
    var drafts = list.filter(function (q) { return q && !q.deletedAt; }).map(function (q, i) {
      var raw = Object.assign({}, q);
      delete raw.id; delete raw.usage; delete raw.createdAt; delete raw.rev;
      ['subject', 'std', 'chapter', 'marks'].forEach(function (k) { if (raw[k] == null || raw[k] === '') raw[k] = defaults && defaults[k]; });
      return { ref: 'નંબર ' + (i + 1), raw: raw, notes: { messages: [] } };
    });
    return { items: finish(drafts, existing), unknownColumns: [], missing: [] };
  }

  /** Recheck one item after the teacher edits it on the review screen. */
  function recheck(item, existing, others) {
    var pool = (existing || []).concat((others || []).filter(function (o) { return o !== item; }).map(function (o) { return o.question; }));
    var res = finish([{ ref: item.ref, raw: item.question, notes: { messages: [] } }], pool)[0];
    // keep the question's identity (normalize gives a new id otherwise)
    res.question.id = item.question.id;
    return res;
  }

  return {
    mathAlnum: mathAlnum,
    parseCSV: parseCSV, fromRows: fromRows, fromText: fromText, fromJSON: fromJSON, recheck: recheck,
    splitOptions: splitOptions, headingMarks: headingMarks, guessType: guessType, keyOf: keyOf, dupKey: dupKey,
    TEMPLATE_HEADER: ['વિષય', 'ધોરણ', 'પ્રકરણ', 'મુદ્દો', 'પ્રકાર', 'ગુણ', 'કઠિનતા', 'પ્રશ્ન', 'A', 'B', 'C', 'D', 'જવાબ', 'ઉકેલ', 'સંદર્ભ']
  };
});
