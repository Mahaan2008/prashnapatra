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
    { id: 'maths', gu: 'ગણિત', en: 'Mathematics' },
    { id: 'science', gu: 'વિજ્ઞાન', en: 'Science' }
  ];

  var CHAPTERS = {
    'science-8': [
      'પાક ઉત્પાદન અને વ્યવસ્થાપન',
      'સૂક્ષ્મજીવો : મિત્ર અને શત્રુ',
      'કોલસો અને પેટ્રોલિયમ',
      'દહન અને જ્વાળા',
      'વનસ્પતિઓ અને પ્રાણીઓનું સંરક્ષણ',
      'પ્રાણીઓમાં પ્રજનન',
      'તરુણાવસ્થા તરફ',
      'બળ અને દબાણ',
      'ઘર્ષણ',
      'ધ્વનિ',
      'વિદ્યુતપ્રવાહની રાસાયણિક અસરો',
      'કેટલીક કુદરતી ઘટનાઓ',
      'પ્રકાશ'
    ],
    'science-9': [
      'આપણી આસપાસમાં દ્રવ્ય',
      'શું આપણી આસપાસનાં દ્રવ્યો શુદ્ધ છે?',
      'પરમાણુઓ અને અણુઓ',
      'પરમાણુનું બંધારણ',
      'સજીવનો પાયાનો એકમ',
      'પેશીઓ',
      'ગતિ',
      'બળ તથા ગતિના નિયમો',
      'ગુરુત્વાકર્ષણ',
      'કાર્ય અને ઊર્જા',
      'ધ્વનિ',
      'અન્નસ્ત્રોતોમાં સુધારણા'
    ],
    'science-10': [
      'રાસાયણિક પ્રક્રિયાઓ અને સમીકરણો',
      'એસિડ, બેઇઝ અને ક્ષાર',
      'ધાતુઓ અને અધાતુઓ',
      'કાર્બન અને તેનાં સંયોજનો',
      'જૈવિક ક્રિયાઓ',
      'નિયંત્રણ અને સંકલન',
      'સજીવો કેવી રીતે પ્રજનન કરે છે?',
      'આનુવંશિકતા',
      'પ્રકાશ - પરાવર્તન અને વક્રીભવન',
      'માનવ આંખ અને રંગબેરંગી દુનિયા',
      'વિદ્યુત',
      'વિદ્યુતપ્રવાહની ચુંબકીય અસરો',
      'આપણું પર્યાવરણ'
    ],
    'maths-8': [
      'સંમેય સંખ્યાઓ',
      'એકચલ સુરેખ સમીકરણ',
      'ચતુષ્કોણની સમજ',
      'માહિતીનું નિયમન',
      'વર્ગ અને વર્ગમૂળ',
      'ઘન અને ઘનમૂળ',
      'રાશિઓની તુલના',
      'બૈજિક પદાવલિઓ અને નિત્યસમ',
      'ક્ષેત્રમિતિ',
      'ઘાત અને ઘાતાંક',
      'સમપ્રમાણ અને વ્યસ્ત પ્રમાણ',
      'અવયવીકરણ',
      'આલેખનો પરિચય'
    ],
    'maths-9': [
      'સંખ્યા પદ્ધતિ',
      'બહુપદીઓ',
      'યામ ભૂમિતિ',
      'દ્વિચલ સુરેખ સમીકરણો',
      'યુક્લિડની ભૂમિતિનો પરિચય',
      'રેખાઓ અને ખૂણાઓ',
      'ત્રિકોણ',
      'ચતુષ્કોણ',
      'વર્તુળ',
      'હેરોનનું સૂત્ર',
      'પૃષ્ઠફળ અને ઘનફળ',
      'આંકડાશાસ્ત્ર'
    ],
    'maths-10': [
      'વાસ્તવિક સંખ્યાઓ',
      'બહુપદીઓ',
      'દ્વિચલ સુરેખ સમીકરણ યુગ્મ',
      'દ્વિઘાત સમીકરણ',
      'સમાંતર શ્રેણી',
      'ત્રિકોણ',
      'યામ ભૂમિતિ',
      'ત્રિકોણમિતિનો પરિચય',
      'ત્રિકોણમિતિના કેટલાક ઉપયોગો',
      'વર્તુળ',
      'વર્તુળ સંબંધિત ક્ષેત્રફળ',
      'પૃષ્ઠફળ અને ઘનફળ',
      'આંકડાશાસ્ત્ર',
      'સંભાવના'
    ],
    'maths-11': [
      'ગણ',
      'સંબંધ અને વિધેય',
      'ત્રિકોણમિતીય વિધેયો',
      'સંકર સંખ્યાઓ અને દ્વિઘાત સમીકરણો',
      'સુરેખ અસમતાઓ',
      'ક્રમચય અને સંચય',
      'દ્વિપદી પ્રમેય',
      'અનુક્રમ અને શ્રેણી',
      'રેખાઓ',
      'શંકુઓ',
      'ત્રિપરિમાણીય ભૂમિતિનો પરિચય',
      'લક્ષ અને વિકલન',
      'આંકડાશાસ્ત્ર',
      'સંભાવના'
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
    ],
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
    'physics-12': [
      'વિદ્યુતભારો અને ક્ષેત્રો',
      'સ્થિર વિદ્યુતસ્થિતિમાન અને કેપેસિટન્સ',
      'પ્રવાહ વિદ્યુત',
      'ગતિમાન વિદ્યુતભારો અને ચુંબકત્વ',
      'ચુંબકત્વ અને દ્રવ્ય',
      'વિદ્યુતચુંબકીય પ્રેરણ',
      'પ્રત્યાવર્તી પ્રવાહ (AC)',
      'વિદ્યુતચુંબકીય તરંગો',
      'કિરણ પ્રકાશશાસ્ત્ર અને પ્રકાશીય ઉપકરણો',
      'તરંગ પ્રકાશશાસ્ત્ર',
      'વિકિરણ અને દ્રવ્યની દ્વૈત પ્રકૃતિ',
      'પરમાણુઓ',
      'ન્યુક્લિયસ',
      'સેમિકન્ડક્ટર ઇલેક્ટ્રોનિક્સ'
    ]
  };

  var DEFAULT_STD = { physics: 11, maths: 12, science: 10 };
  var STANDARDS = [8, 9, 10, 11, 12];

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
