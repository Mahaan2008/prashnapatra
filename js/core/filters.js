/* Search and filtering of the question bank. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./schema'), require('./gujarati'));
  else { root.QPG = root.QPG || {}; root.QPG.filters = factory(root.QPG.schema, root.QPG.gujarati); }
})(typeof self !== 'undefined' ? self : this, function (schema, gujarati) {
  'use strict';

  function asSet(v) {
    if (v == null || v === '') return null;
    var a = (Array.isArray(v) ? v : [v]).filter(function (x) { return x !== '' && x != null; });
    return a.length ? a.map(String) : null;
  }

  /**
   * criteria: {
   *   q: search text, subject, std, chapters: [], topic, types: [], marks: [], difficulty: [],
   *   used: 'any'|'used'|'unused', demo: 'any'|'hide'|'only', includeDeleted: false
   * }
   */
  function filterQuestions(list, criteria) {
    var c = criteria || {};
    var chapters = asSet(c.chapters), types = asSet(c.types), marks = asSet(c.marks), diff = asSet(c.difficulty);
    var words = gujarati.normalize(c.q).split(' ').filter(Boolean);
    var topic = gujarati.normalize(c.topic);

    return (list || []).filter(function (q) {
      if (!c.includeDeleted && q.deletedAt) return false;
      if (c.subject && q.subject !== c.subject) return false;
      if (c.std && Number(q.std) !== Number(c.std)) return false;
      if (chapters && chapters.indexOf(String(q.chapter)) < 0) return false;
      if (types && types.indexOf(q.type) < 0) return false;
      if (marks && marks.indexOf(String(q.marks)) < 0) return false;
      if (diff && diff.indexOf(q.difficulty) < 0) return false;
      if (topic && gujarati.normalize(q.topic).indexOf(topic) < 0) return false;
      var used = (q.usage || []).length > 0;
      if (c.used === 'used' && !used) return false;
      if (c.used === 'unused' && used) return false;
      if (c.demo === 'hide' && q.isDemo) return false;
      if (c.demo === 'only' && !q.isDemo) return false;
      if (words.length) {
        var hay = gujarati.normalize(schema.allText(q));
        for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false;
      }
      return true;
    });
  }

  /** Default order: subject, std, chapter, marks, then oldest first. */
  function sortQuestions(list) {
    return (list || []).slice().sort(function (a, b) {
      return (a.subject || '').localeCompare(b.subject || '') ||
        (a.std || 0) - (b.std || 0) ||
        (a.chapter || 0) - (b.chapter || 0) ||
        (a.marks || 0) - (b.marks || 0) ||
        String(a.createdAt).localeCompare(String(b.createdAt));
    });
  }

  /** Distinct values present in the list, for building filter menus. */
  function facets(list) {
    var topics = {}, marks = {};
    (list || []).forEach(function (q) {
      if (q.deletedAt) return;
      if (q.topic) topics[q.topic] = true;
      if (q.marks != null) marks[q.marks] = true;
    });
    return {
      topics: Object.keys(topics).sort(),
      marks: Object.keys(marks).map(Number).sort(function (a, b) { return a - b; })
    };
  }

  /** Count of live questions per chapter for one subject+std. */
  function chapterCounts(list, subject, std) {
    var out = {};
    (list || []).forEach(function (q) {
      if (q.deletedAt || q.subject !== subject || Number(q.std) !== Number(std)) return;
      out[q.chapter] = (out[q.chapter] || 0) + 1;
    });
    return out;
  }

  return { filterQuestions: filterQuestions, sortQuestions: sortQuestions, facets: facets, chapterCounts: chapterCounts };
});
