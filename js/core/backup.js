/* Backup file (all data in one JSON) and restoring it safely. Pure logic — tested in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./schema'));
  else { root.QPG = root.QPG || {}; root.QPG.backup = factory(root.QPG.schema); }
})(typeof self !== 'undefined' ? self : this, function (schema) {
  'use strict';

  var FORMAT = 1;

  function make(data, appVersion, now) {
    return {
      app: 'qpg', format: FORMAT, appVersion: appVersion || '', exportedAt: now || new Date().toISOString(),
      questions: data.questions || [], papers: data.papers || [], templates: data.templates || [],
      settings: data.settings || []
    };
  }

  function fileName(now) {
    var d = (now || new Date().toISOString()).slice(0, 10);
    return 'prashnapatra-backup-' + d + '.json';
  }

  /**
   * Check a backup before anything is written.
   * Returns { ok, errors: [msg], counts: {questions, papers, templates}, data }
   */
  function check(obj) {
    var errors = [];
    if (!obj || typeof obj !== 'object') return { ok: false, errors: ['આ બેકઅપ ફાઇલ નથી.'], counts: {} };
    if (obj.app !== 'qpg') errors.push('આ ફાઇલ આ એપનો બેકઅપ નથી.');
    if (obj.format > FORMAT) errors.push('આ બેકઅપ નવી આવૃત્તિનો છે — પહેલાં એપ અપડેટ કરો.');
    ['questions', 'papers'].forEach(function (k) { if (!Array.isArray(obj[k])) errors.push('બેકઅપમાં "' + k + '" ની યાદી નથી.'); });
    if (errors.length) return { ok: false, errors: errors, counts: {} };

    var bad = 0;
    var questions = obj.questions.filter(function (q) {
      var good = q && typeof q === 'object' && typeof q.id === 'string' && q.id && typeof q.subject === 'string';
      if (!good) bad++;
      return good;
    });
    var papers = obj.papers.filter(function (p) {
      var good = p && typeof p.id === 'string' && Array.isArray(p.sections) && Array.isArray(p.sets);
      if (!good) bad++;
      return good;
    });
    var templates = Array.isArray(obj.templates) ? obj.templates.filter(function (t) { return t && typeof t.id === 'string'; }) : [];
    var settings = Array.isArray(obj.settings) ? obj.settings.filter(function (s) { return s && typeof s.key === 'string'; }) : [];
    if (bad) errors.push(bad + ' ખરાબ નોંધો છોડી દેવાશે.');
    return {
      ok: true, errors: errors,
      counts: {
        questions: questions.filter(function (q) { return !q.deletedAt; }).length,
        papers: papers.filter(function (p) { return !p.deletedAt; }).length,
        templates: templates.length
      },
      data: { questions: questions, papers: papers, templates: templates, settings: settings },
      exportedAt: obj.exportedAt
    };
  }

  /**
   * What to write for "merge": a record from the backup is used when it is new,
   * or when it was changed later than the copy on this device.
   */
  function mergeRecords(existing, incoming) {
    var byId = {};
    (existing || []).forEach(function (r) { byId[r.id] = r; });
    var write = [], added = 0, updated = 0, kept = 0;
    (incoming || []).forEach(function (r) {
      var cur = byId[r.id];
      if (!cur) { write.push(r); if (!r.deletedAt) added++; return; }
      if (String(r.updatedAt || '') > String(cur.updatedAt || '')) { write.push(r); updated++; } else kept++;
    });
    return { write: write, added: added, updated: updated, kept: kept };
  }

  return { FORMAT: FORMAT, make: make, check: check, mergeRecords: mergeRecords, fileName: fileName };
});
