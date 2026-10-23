/* Subjects, standards and chapter lists (GSEB / NCERT rationalised syllabus).
   Chapter names are defaults; they can be changed later in Settings. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.QPG = root.QPG || {}; root.QPG.syllabus = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SUBJECTS = [
    { id: 'physics', gu: 'ભૌતિકવિજ્ઞાન', en: 'Physics' },
    { id: 'maths', gu: 'ગણિત', en: 'Mathematics' }
  ];

  var CHAPTERS = {
    'physics-11': [
      'એકમ અને માપન',
      'સુરેખ પથ પર ગતિ',
      'સમતલમાં ગતિ',
      'ગતિના નિયમો',
      'કાર્ય, ઊર્જા અને પાવર',
      'કણોનાં તંત્રો અને ચાકગતિ',
      'ગુરુત્વાકર્ષણ',
      'ઘન પદાર્થોના યાંત્રિક ગુણધર્મો',
      'તરલના યાંત્રિક ગુણધર્મો',
      'દ્રવ્યના ઉષ્મીય ગુણધર્મો',
      'થરમૉડાયનેમિક્સ',
      'ગતિવાદ',
      'દોલનો',
      'તરંગો'
    ],
    'maths-12': [
      'સંબંધ અને વિધેય',
      'ત્રિકોણમિતીય પ્રતિવિધેયો',
      'શ્રેણિક',
      'નિશ્ચાયક',
      'સાતત્ય અને વિકલનીયતા',
      'વિકલિતના ઉપયોગો',
      'સંકલન',
      'સંકલનના ઉપયોગો',
      'વિકલ સમીકરણો',
      'સદિશ બીજગણિત',
      'ત્રિપરિમાણીય ભૂમિતિ',
      'સુરેખ આયોજન',
      'સંભાવના'
    ]
  };

  var DEFAULT_STD = { physics: 11, maths: 12 };
  var STANDARDS = [9, 10, 11, 12];

  function subjectName(id) {
    for (var i = 0; i < SUBJECTS.length; i++) if (SUBJECTS[i].id === id) return SUBJECTS[i].gu;
    return id || '';
  }

  /** Returns [{no, name}] for a subject+standard, or [] when no list is defined. */
  function chapters(subject, std, overrides) {
    var key = subject + '-' + std;
    var list = (overrides && overrides[key]) || CHAPTERS[key] || [];
    return list.map(function (name, i) { return { no: i + 1, name: name }; });
  }

  function chapterName(subject, std, no, overrides) {
    var list = chapters(subject, std, overrides);
    for (var i = 0; i < list.length; i++) if (list[i].no === Number(no)) return list[i].name;
    return '';
  }

  /** "1 થી 5, 10 થી 13" style range text from a list of chapter numbers. */
  function chapterRangeText(nums) {
    var n = Array.from(new Set((nums || []).map(Number).filter(function (x) { return x > 0; })))
      .sort(function (a, b) { return a - b; });
    var parts = [];
    for (var i = 0; i < n.length; i++) {
      var start = n[i], end = start;
      while (i + 1 < n.length && n[i + 1] === end + 1) { end = n[++i]; }
      parts.push(end - start >= 2 ? start + ' થી ' + end : (end === start ? String(start) : start + ', ' + end));
    }
    return parts.join(', ');
  }

  return {
    SUBJECTS: SUBJECTS, CHAPTERS: CHAPTERS, DEFAULT_STD: DEFAULT_STD, STANDARDS: STANDARDS,
    subjectName: subjectName, chapters: chapters, chapterName: chapterName,
    chapterRangeText: chapterRangeText
  };
});
