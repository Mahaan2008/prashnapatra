/* Question shape, defaults and validation. Pure logic: runs in the browser and in Node tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./gujarati'));
  else { root.QPG = root.QPG || {}; root.QPG.schema = factory(root.QPG.gujarati); }
})(typeof self !== 'undefined' ? self : this, function (gujarati) {
  'use strict';

  var TYPES = [
    { id: 'mcq', gu: 'બહુવિકલ્પ (MCQ)' },
    { id: 'very_short', gu: 'એક વાક્યમાં જવાબ' },
    { id: 'short_answer', gu: 'ટૂંકો જવાબ' },
    { id: 'long_answer', gu: 'લાંબો જવાબ' },
    { id: 'numerical', gu: 'દાખલો' },
    { id: 'derivation', gu: 'સૂત્ર તારવણી' },
    { id: 'proof', gu: 'સાબિત કરો' },
    { id: 'fill_blank', gu: 'ખાલી જગ્યા' },
    { id: 'match_columns', gu: 'જોડકાં' },
    { id: 'assertion_reason', gu: 'વિધાન-કારણ' },
    { id: 'case_based', gu: 'પરિચ્છેદ આધારિત' },
    { id: 'diagram_based', gu: 'આકૃતિ આધારિત' }
  ];

  var DIFFICULTIES = [
    { id: 'easy', gu: 'સરળ' },
    { id: 'medium', gu: 'મધ્યમ' },
    { id: 'hard', gu: 'કઠિન' }
  ];

  var LANGUAGES = [
    { id: 'gu', gu: 'ગુજરાતી' },
    { id: 'en', gu: 'English' }
  ];

  var OPTION_LETTERS = ['A', 'B', 'C', 'D'];

  /** Standard options printed under every assertion–reason question. */
  var AR_OPTIONS = [
    'વિધાન $A$ અને કારણ $R$ બંને સાચાં છે અને $R$ એ $A$ ની સાચી સમજૂતી છે.',
    'વિધાન $A$ અને કારણ $R$ બંને સાચાં છે, પરંતુ $R$ એ $A$ ની સાચી સમજૂતી નથી.',
    'વિધાન $A$ સાચું છે, પરંતુ કારણ $R$ ખોટું છે.',
    'વિધાન $A$ ખોટું છે, પરંતુ કારણ $R$ સાચું છે.'
  ];

  function label(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].gu;
    return id || '';
  }
  function typeLabel(id) { return label(TYPES, id); }
  function difficultyLabel(id) { return label(DIFFICULTIES, id); }

  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'q-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function str(v) { return v == null ? '' : String(v).trim(); }
  function strList(v, len) {
    var a = Array.isArray(v) ? v.map(str) : [];
    if (len != null) { while (a.length < len) a.push(''); a = a.slice(0, len); }
    return a;
  }

  /** Fill defaults and clean up a question object (does not validate). */
  function normalizeQuestion(input, now) {
    var q = input || {};
    var t = now || new Date().toISOString();
    var type = str(q.type) || 'short_answer';
    var out = {
      id: str(q.id) || uuid(),
      subject: str(q.subject),
      std: q.std === '' || q.std == null ? null : Number(q.std),
      chapter: q.chapter === '' || q.chapter == null ? null : Number(q.chapter),
      topic: str(q.topic),
      type: type,
      marks: q.marks === '' || q.marks == null ? null : Number(q.marks),
      difficulty: str(q.difficulty) || 'medium',
      language: str(q.language) || 'gu',
      text: str(q.text),
      options: type === 'mcq' ? strList(q.options, 4) : [],
      answer: str(q.answer),
      solution: str(q.solution),
      image: typeof q.image === 'string' ? q.image : '',
      source: str(q.source),
      assertion: type === 'assertion_reason' ? str(q.assertion) : '',
      reason: type === 'assertion_reason' ? str(q.reason) : '',
      matchLeft: type === 'match_columns' ? strList(q.matchLeft) : [],
      matchRight: type === 'match_columns' ? strList(q.matchRight) : [],
      subparts: type === 'case_based' && Array.isArray(q.subparts)
        ? q.subparts.map(function (p) {
            var opts = strList(p && p.options);
            return { text: str(p && p.text), options: opts.some(Boolean) ? strList(opts, 4) : [] };
          })
        : [],
      isDemo: !!q.isDemo,
      usage: Array.isArray(q.usage) ? q.usage.slice() : [],
      createdBy: q.createdBy || '',
      creatorName: q.creatorName || '',
      assignedTo: Array.isArray(q.assignedTo) ? q.assignedTo : (q.assignedTo ? [q.assignedTo] : []),
      createdAt: q.createdAt || t,
      updatedAt: t,
      deletedAt: q.deletedAt || null,
      rev: (Number(q.rev) || 0) + 1
    };
    if (out.type === 'mcq' || out.type === 'assertion_reason') out.answer = out.answer.toUpperCase();
    return out;
  }

  /** True when every $ … $ and $$ … $$ is closed. */
  function mathBalanced(s) {
    var t = String(s || '').replace(/\\\$/g, '').replace(/\$\$/g, '');
    return ((t.match(/\$/g) || []).length % 2) === 0;
  }

  var FIGURE_WORDS = /આકૃતિ|આકૃતિમાં|figure|diagram|\bfig\b/i;
  function mentionsFigure(s) { return FIGURE_WORDS.test(String(s || '')); }

  /** Indexes (pairs) of options that are identical after normalisation. */
  function duplicateOptions(options) {
    var seen = {}, dups = [];
    (options || []).forEach(function (o, i) {
      var k = gujarati.normalize(o);
      if (!k) return;
      if (seen[k] != null) dups.push([seen[k], i]); else seen[k] = i;
    });
    return dups;
  }

  /** Every text field of a question, for checks and search. */
  function allText(q) {
    var parts = [q.text, q.assertion, q.reason, q.answer, q.solution, q.topic, q.source]
      .concat(q.options || [], q.matchLeft || [], q.matchRight || []);
    (q.subparts || []).forEach(function (p) { parts.push(p.text); parts = parts.concat(p.options || []); });
    return parts.filter(Boolean).join('\n');
  }

  /**
   * Validate a (normalised) question.
   * errors block saving; warnings are shown but allow saving.
   */
  function validateQuestion(q) {
    var errors = [], warnings = [];
    function err(field, msg) { errors.push({ field: field, msg: msg }); }
    function warn(field, msg) { warnings.push({ field: field, msg: msg }); }

    if (!q.subject) err('subject', 'વિષય પસંદ કરો.');
    if (!q.std) err('std', 'ધોરણ પસંદ કરો.');
    if (!q.chapter || q.chapter < 1) err('chapter', 'પ્રકરણ પસંદ કરો.');
    if (!TYPES.some(function (t) { return t.id === q.type; })) err('type', 'પ્રશ્નનો પ્રકાર પસંદ કરો.');
    if (q.marks == null || isNaN(q.marks) || q.marks <= 0) err('marks', 'ગુણ 0 કરતાં વધારે હોવા જોઈએ.');
    else if (q.marks > 20) warn('marks', 'એક પ્રશ્નના ' + q.marks + ' ગુણ વધારે લાગે છે — ચકાસો.');
    else if (Math.round(q.marks * 2) !== q.marks * 2) err('marks', 'ગુણ પૂર્ણાંક અથવા અડધો (0.5) હોવા જોઈએ.');

    if (q.type === 'assertion_reason') {
      if (!q.assertion) err('assertion', 'વિધાન (A) લખો.');
      if (!q.reason) err('reason', 'કારણ (R) લખો.');
    } else if (q.type === 'case_based') {
      if (!q.text) err('text', 'પરિચ્છેદ લખો.');
      var parts = (q.subparts || []).filter(function (p) { return p.text; });
      if (parts.length < 1) err('subparts', 'ઓછામાં ઓછો એક પેટા-પ્રશ્ન ઉમેરો.');
      (q.subparts || []).forEach(function (p, i) {
        if (p.options && p.options.length && p.options.some(function (o) { return !o; }))
          err('subparts', 'પેટા-પ્રશ્ન ' + (i + 1) + ' ના ચારેય વિકલ્પ લખો (અથવા બધા ખાલી રાખો).');
      });
    } else if (!q.text) {
      err('text', 'પ્રશ્ન લખો.');
    }

    if (q.type === 'mcq') {
      if (q.options.length !== 4 || q.options.some(function (o) { return !o; }))
        err('options', 'ચારેય વિકલ્પ (A, B, C, D) લખો.');
      duplicateOptions(q.options).forEach(function (d) {
        warn('options', 'વિકલ્પ (' + OPTION_LETTERS[d[0]] + ') અને (' + OPTION_LETTERS[d[1]] + ') એકસરખા છે.');
      });
    }
    if ((q.type === 'mcq' || q.type === 'assertion_reason') && q.answer && OPTION_LETTERS.indexOf(q.answer) < 0)
      err('answer', 'સાચો જવાબ A, B, C અથવા D હોવો જોઈએ.');

    if (q.type === 'match_columns') {
      var l = q.matchLeft.filter(Boolean).length, r = q.matchRight.filter(Boolean).length;
      if (l < 2) err('matchLeft', 'કૉલમ-I માં ઓછામાં ઓછી 2 વિગત લખો.');
      if (r < l) err('matchRight', 'કૉલમ-II માં કૉલમ-I જેટલી અથવા વધારે વિગત લખો.');
    }

    // Maths delimiters in every field
    var fields = { text: q.text, assertion: q.assertion, reason: q.reason, answer: q.answer, solution: q.solution };
    Object.keys(fields).forEach(function (f) {
      if (fields[f] && !mathBalanced(fields[f])) err(f, 'સૂત્રનો $ બંધ કર્યો નથી — દરેક સૂત્ર $ થી શરૂ થઈ $ થી પૂરું થવું જોઈએ.');
    });
    (q.options || []).forEach(function (o, i) {
      if (o && !mathBalanced(o)) err('options', 'વિકલ્પ (' + OPTION_LETTERS[i] + ') માં સૂત્રનો $ બંધ કર્યો નથી.');
    });

    if ((mentionsFigure(q.text) || q.type === 'diagram_based') && !q.image)
      warn('image', 'પ્રશ્નમાં આકૃતિનો ઉલ્લેખ છે, પણ આકૃતિ ઉમેરી નથી.');

    if (gujarati.looksLikeLegacyFont(allText(q)))
      warn('text', 'લખાણ જૂના ગુજરાતી ફોન્ટ (Sulekh/Gopika) માં લાગે છે — પેપરમાં ખોટું છપાશે. Unicode માં લખો.');

    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  /** Copy of a question as a new, unsaved question. */
  function duplicateQuestion(q) {
    var c = JSON.parse(JSON.stringify(q));
    delete c.id; delete c.createdAt; delete c.rev;
    c.usage = []; c.isDemo = false; c.deletedAt = null;
    return normalizeQuestion(c);
  }

  return {
    TYPES: TYPES, DIFFICULTIES: DIFFICULTIES, LANGUAGES: LANGUAGES,
    OPTION_LETTERS: OPTION_LETTERS, AR_OPTIONS: AR_OPTIONS,
    typeLabel: typeLabel, difficultyLabel: difficultyLabel, uuid: uuid,
    normalizeQuestion: normalizeQuestion, validateQuestion: validateQuestion,
    duplicateQuestion: duplicateQuestion, mathBalanced: mathBalanced,
    mentionsFigure: mentionsFigure, duplicateOptions: duplicateOptions, allText: allText
  };
});
