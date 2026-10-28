/* Paper formats (templates) taken from the owner's two reference papers.
   A template is data: header style, texts, and an ordered list of sections. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.QPG = root.QPG || {}; root.QPG.templates = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PHYS_INSTR = 'નીચે આપેલ પ્રશ્નોના માગ્યા પ્રમાણે જવાબ આપો અને પ્રત્યેકના {marks} ગુણ છે.';
  var MATHS_INSTR = 'નીચે આપેલા પ્રશ્ન નંબર {from} થી {to} માંથી ગમે તે {attempt} પ્રશ્નોની ગણતરી કરી ટૂંકમાં જવાબ આપો. (દરેકના {marks} ગુણ)';

  var BUILT_IN = [
    {
      id: 'physics-sahjanand',
      name: 'Physics — સહજાનંદ ક્લાસીસ',
      subject: 'physics', std: 11,
      style: 'physics',
      header: {
        institute: 'સહજાનંદ ક્લાસીસ',
        topText: 'Shree Hari',
        bottomText: 'Divyang Sir',
        watermark: 'Divyang Sir',
        subjectLabel: 'PHYSICS',
        showSetLetter: true,
        logoLeft: '', logoRight: ''
      },
      totalMarks: 50, duration: '2:00 hr', examName: '', paperLabel: '',
      closing: '',
      sections: [
        { id: 'A', title: 'Section A', part: '', print: 15, attempt: 15, marks: 1, numbering: 'restart',
          types: ['mcq', 'very_short', 'fill_blank', 'match_columns', 'assertion_reason'],
          mix: [{ type: 'mcq', count: 10 }, { type: 'very_short', count: 3 }, { type: 'fill_blank', count: 1 }, { type: 'match_columns', count: 1 }],
          instruction: PHYS_INSTR },
        { id: 'B', title: 'Section B', part: '', print: 9, attempt: 6, marks: 2, numbering: 'restart',
          types: ['short_answer', 'numerical', 'derivation', 'proof', 'very_short', 'diagram_based', 'long_answer'],
          instruction: PHYS_INSTR },
        { id: 'C', title: 'Section C', part: '', print: 8, attempt: 5, marks: 3, numbering: 'restart',
          types: ['short_answer', 'numerical', 'derivation', 'proof', 'long_answer', 'diagram_based'],
          instruction: PHYS_INSTR },
        { id: 'D', title: 'Section D', part: '', print: 3, attempt: 2, marks: 4, numbering: 'restart',
          types: ['derivation', 'long_answer', 'case_based', 'numerical', 'proof', 'diagram_based'],
          instruction: PHYS_INSTR }
      ]
    },
    {
      id: 'maths-nainesh',
      name: 'ગણિત — નૈનેશભાઈ બી. પટેલ',
      subject: 'maths', std: 12,
      style: 'maths',
      header: {
        institute: 'નૈનેશભાઈ બી.પટેલ',
        topText: 'શ્રીહરિ',
        bottomText: 'શ્રીહરિ',
        watermark: 'નૈનેશભાઈ બી.પટેલ',
        subjectLabel: 'ગણિત',
        showSetLetter: false,
        logoLeft: 'assets/logo-maths.png', logoRight: 'assets/logo-maths.png'
      },
      totalMarks: 100, duration: '', examName: 'પ્રથમ પરીક્ષા', paperLabel: 'TEST PAPER-12',
      closing: '|| ALL THE BEST ||',
      sections: [
        { id: 'PA', title: '', part: 'PART-A', print: 50, attempt: 50, marks: 1, numbering: 'restart',
          types: ['mcq', 'assertion_reason'],
          instruction: 'આપેલ વિધાન સાચું બને તે રીતે આપેલ વિકલ્પમાંથી યોગ્ય વિકલ્પ પસંદ કરો : (પ્રત્યેકનો {marks} – ગુણ)' },
        { id: 'BA', title: 'વિભાગ-A', part: 'PART-B', print: 12, attempt: 8, marks: 2, numbering: 'restart',
          types: ['short_answer', 'proof', 'numerical', 'very_short', 'long_answer', 'derivation'], instruction: MATHS_INSTR },
        { id: 'BB', title: 'વિભાગ-B', part: 'PART-B', print: 9, attempt: 6, marks: 3, numbering: 'continue',
          types: ['short_answer', 'proof', 'numerical', 'long_answer', 'derivation'], instruction: MATHS_INSTR },
        { id: 'BC', title: 'વિભાગ-C', part: 'PART-B', print: 6, attempt: 4, marks: 4, numbering: 'continue',
          types: ['long_answer', 'proof', 'numerical', 'short_answer', 'derivation', 'case_based'], instruction: MATHS_INSTR }
      ]
    },
    {
      id: 'science-standard',
      name: 'વિજ્ઞાન — ધોરણ 10 (GSEB)',
      subject: 'science', std: 10,
      style: 'physics',
      header: {
        institute: 'આદર્શ વિદ્યાલય',
        topText: 'શ્રી ગણેશાય નમઃ',
        bottomText: 'વિજ્ઞાન અને ટેકનોલોજી',
        watermark: 'વિજ્ઞાન',
        subjectLabel: 'SCIENCE',
        showSetLetter: true,
        logoLeft: '', logoRight: ''
      },
      totalMarks: 80, duration: '3:00 hr', examName: 'વાર્ષિક પરીક્ષા', paperLabel: 'MODEL PAPER',
      closing: '|| ALL THE BEST ||',
      sections: [
        { id: 'A', title: 'વિભાગ A (હેતુલક્ષી પ્રશ્નો)', part: '', print: 16, attempt: 16, marks: 1, numbering: 'restart',
          types: ['mcq', 'very_short', 'fill_blank', 'match_columns', 'assertion_reason'],
          instruction: 'નીચે આપેલ પ્રશ્નોના માગ્યા મુજબ ઉત્તર આપો. (પ્રત્યેકનો 1 ગુણ)' },
        { id: 'B', title: 'વિભાગ B (ટૂંકજવાબી પ્રશ્નો)', part: '', print: 10, attempt: 10, marks: 2, numbering: 'restart',
          types: ['short_answer', 'diagram_based', 'very_short'],
          instruction: 'નીચે આપેલ પ્રશ્નોના આશરે 40 થી 50 શબ્દોમાં ઉત્તર લખો. (પ્રત્યેકના 2 ગુણ)' },
        { id: 'C', title: 'વિભાગ C', part: '', print: 8, attempt: 8, marks: 3, numbering: 'restart',
          types: ['short_answer', 'numerical', 'diagram_based', 'long_answer'],
          instruction: 'નીચે આપેલ પ્રશ્નોના મુદ્દાસર ઉત્તર લખો. (પ્રત્યેકના 3 ગુણ)' },
        { id: 'D', title: 'વિભાગ D (વિસ્તૃત જવાબી પ્રશ્નો)', part: '', print: 5, attempt: 5, marks: 4, numbering: 'restart',
          types: ['long_answer', 'case_based', 'derivation', 'proof'],
          instruction: 'નીચે આપેલ પ્રશ્નોના સવિસ્તર ઉત્તર લખો. (પ્રત્યેકના 4 ગુણ)' }
      ]
    }
  ];

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /** Built-in templates with any saved changes (name, header texts, logos) applied. */
  function list(overrides) {
    return BUILT_IN.map(function (t) {
      var c = clone(t), o = overrides && overrides[t.id];
      if (o) {
        if (o.header) Object.keys(o.header).forEach(function (k) { if (o.header[k] != null) c.header[k] = o.header[k]; });
        ['name', 'examName', 'paperLabel', 'closing', 'duration'].forEach(function (k) { if (o[k] != null) c[k] = o[k]; });
      }
      return c;
    });
  }

  function get(id, overrides) {
    return list(overrides).find(function (t) { return t.id === id; }) || null;
  }

  /** Section total counts only the questions a student must answer. */
  function sectionTotal(s) { return (Number(s.attempt) || 0) * (Number(s.marks) || 0); }
  function templateTotal(sections) {
    return (sections || []).reduce(function (sum, s) { return sum + sectionTotal(s); }, 0);
  }

  /** Fill {marks}, {attempt}, {print}, {from}, {to}, {total} in a section instruction. */
  function instruction(s, range) {
    var vals = {
      marks: s.marks, attempt: s.attempt, print: s.print, total: sectionTotal(s),
      from: range ? range.from : '', to: range ? range.to : ''
    };
    return String(s.instruction || '').replace(/\{(\w+)\}/g, function (m, k) { return vals[k] != null ? vals[k] : m; });
  }

  return { BUILT_IN: BUILT_IN, list: list, get: get, sectionTotal: sectionTotal, templateTotal: templateTotal, instruction: instruction, clone: clone };
});
