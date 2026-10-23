/* Paper assembly: create a paper from a template, pick questions, number them,
   total the marks and report problems. Pure logic — tested in Node.
   Rule: a question's own marks are never changed to make a total fit. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./templates'), require('./syllabus'));
  else { root.QPG = root.QPG || {}; root.QPG.assembly = factory(root.QPG.templates, root.QPG.syllabus); }
})(typeof self !== 'undefined' ? self : this, function (templates, syllabus) {
  'use strict';

  var SET_LABELS = ['A', 'B', 'C', 'D'];

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  /* ---- seeded random, so "auto pick" can be repeated exactly ---- */
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /**
   * New, empty paper from a template.
   * opts: { chapters: [..], sets: 1|2, title, meta: {...} }
   */
  function createPaper(template, opts) {
    opts = opts || {};
    var now = new Date().toISOString();
    var nSets = Math.max(1, Math.min(SET_LABELS.length, Number(opts.sets) || 1));
    var sections = clone(template.sections);
    var chapters = (opts.chapters || []).map(Number).sort(function (a, b) { return a - b; });
    var meta = Object.assign({
      institute: template.header.institute,
      topText: template.header.topText,
      bottomText: template.header.bottomText,
      watermark: template.header.watermark,
      showWatermark: true,
      subjectLabel: template.header.subjectLabel,
      logoLeft: template.header.logoLeft,
      logoRight: template.header.logoRight,
      showSetLetter: template.header.showSetLetter && nSets > 1,
      examName: template.examName,
      paperLabel: template.paperLabel,
      duration: template.duration,
      totalMarks: template.totalMarks,
      std: template.std,
      chapterText: syllabus.chapterRangeText(chapters),
      date: '',
      closing: template.closing
    }, opts.meta || {});
    return {
      id: uid(),
      templateId: template.id,
      style: template.style,
      title: opts.title || template.paperLabel || (syllabus.subjectName(template.subject) + (chapters.length ? ' — CH ' + syllabus.chapterRangeText(chapters) : '')),
      subject: template.subject,
      std: Number(opts.std || template.std),
      chapters: chapters,
      meta: meta,
      sections: sections,
      sets: SET_LABELS.slice(0, nSets).map(function (l) {
        var items = {};
        sections.forEach(function (s) { items[s.id] = []; });
        return { label: l, items: items };
      }),
      allowDuplicates: false,
      snapshots: {},
      createdAt: now, updatedAt: now, deletedAt: null, rev: 1
    };
  }

  /** Questions that may go into this paper at all (subject, standard, chosen chapters). */
  function eligible(paper, questions) {
    var ch = paper.chapters || [];
    return (questions || []).filter(function (q) {
      return !q.deletedAt && q.subject === paper.subject && Number(q.std) === Number(paper.std) &&
        (!ch.length || ch.indexOf(Number(q.chapter)) >= 0);
    });
  }

  function idsInSet(set) {
    var out = [];
    Object.keys(set.items).forEach(function (k) { out = out.concat(set.items[k]); });
    return out;
  }

  /** Spread picks over chapters: take one from each chapter in turn. */
  function roundRobin(pool, need, rand) {
    var byCh = {};
    pool.forEach(function (q) { (byCh[q.chapter] = byCh[q.chapter] || []).push(q); });
    var chs = Object.keys(byCh).map(Number).sort(function (a, b) { return a - b; });
    chs.forEach(function (c) {
      // unused questions first, random within the same usage count
      byCh[c] = shuffle(byCh[c], rand).sort(function (a, b) { return (a.usage || []).length - (b.usage || []).length; });
    });
    var out = [], start = Math.floor(rand() * Math.max(1, chs.length));
    var guard = 0;
    while (out.length < need && guard < 100000) {
      var any = false;
      for (var i = 0; i < chs.length && out.length < need; i++) {
        var list = byCh[chs[(start + i) % chs.length]];
        if (list.length) { out.push(list.shift()); any = true; }
      }
      if (!any) break;
      guard++;
    }
    return out;
  }

  function typeRank(section) {
    var order = (section.mix || []).map(function (m) { return m.type; }).concat(section.types || []);
    return function (t) { var i = order.indexOf(t); return i < 0 ? 99 : i; };
  }

  /** Paper order inside a section: by question type (as in the template), then chapter. */
  function sortSection(section, qs) {
    var rank = typeRank(section);
    return qs.slice().sort(function (a, b) { return rank(a.type) - rank(b.type) || a.chapter - b.chapter; });
  }

  /**
   * Fill every section of the chosen sets with matching questions.
   * opts: { seed, setIndexes: [0,1], keepExisting: true }
   * Returns { paper, shortages: [{set, sectionId, title, need, got}] }.
   * Set B avoids Set A's questions; only if there are not enough does it reuse them (reported).
   */
  function autoFill(paper, questions, opts) {
    opts = opts || {};
    var p = clone(paper);
    var rand = rng(opts.seed != null ? opts.seed : Date.now());
    var pool = eligible(p, questions);
    var shortages = [], reused = [];
    var setIdx = opts.setIndexes || p.sets.map(function (_, i) { return i; });

    setIdx.forEach(function (si) {
      var set = p.sets[si];
      var otherSetIds = {};
      p.sets.forEach(function (s, i) { if (i !== si) idsInSet(s).forEach(function (id) { otherSetIds[id] = true; }); });
      var taken = {};
      if (opts.keepExisting !== false) idsInSet(set).forEach(function (id) { taken[id] = true; });

      p.sections.forEach(function (sec) {
        var current = opts.keepExisting === false ? [] : set.items[sec.id].slice();
        if (opts.keepExisting === false) current.forEach(function (id) { delete taken[id]; });
        var need = Math.max(0, (Number(sec.print) || 0) - current.length);
        var fits = function (q) {
          return !taken[q.id] && Number(q.marks) === Number(sec.marks) && (sec.types || []).indexOf(q.type) >= 0;
        };
        var fresh = pool.filter(function (q) { return fits(q) && !otherSetIds[q.id]; });
        var picked = [];

        // fixed mix of types first (e.g. 10 MCQ + 3 one-line + 1 blank + 1 match)
        (sec.mix || []).forEach(function (m) {
          var have = current.filter(function (id) { var q = pool.find(function (x) { return x.id === id; }); return q && q.type === m.type; }).length;
          var want = Math.min(Math.max(0, m.count - have), need - picked.length);
          var got = roundRobin(fresh.filter(function (q) { return q.type === m.type && picked.indexOf(q) < 0; }), want, rand);
          picked = picked.concat(got);
        });
        if (picked.length < need) {
          picked = picked.concat(roundRobin(fresh.filter(function (q) { return picked.indexOf(q) < 0; }), need - picked.length, rand));
        }
        // not enough new questions: reuse ones from the other set, and say so
        if (picked.length < need) {
          var again = pool.filter(function (q) { return fits(q) && otherSetIds[q.id] && picked.indexOf(q) < 0; });
          var more = roundRobin(again, need - picked.length, rand);
          more.forEach(function (q) { reused.push({ set: set.label, sectionId: sec.id, id: q.id }); });
          picked = picked.concat(more);
        }
        picked.forEach(function (q) { taken[q.id] = true; });

        var all = current.map(function (id) { return pool.find(function (q) { return q.id === id; }); }).filter(Boolean).concat(picked);
        var keepUnknown = current.filter(function (id) { return !pool.some(function (q) { return q.id === id; }); });
        set.items[sec.id] = sortSection(sec, all).map(function (q) { return q.id; }).concat(keepUnknown);
        if (set.items[sec.id].length < sec.print) {
          shortages.push({ set: set.label, sectionId: sec.id, title: sectionTitle(sec), need: Number(sec.print), got: set.items[sec.id].length });
        }
      });
    });
    p.updatedAt = new Date().toISOString();
    return { paper: p, shortages: shortages, reused: reused };
  }

  function sectionTitle(s) { return [s.part, s.title].filter(Boolean).join(' ') || s.id; }

  /** Question numbers for one set: { sectionId: [1,2,3…] } following restart/continue. */
  function numbering(paper, setIndex) {
    var set = paper.sets[setIndex || 0];
    var out = {}, n = 0;
    paper.sections.forEach(function (s) {
      if (s.numbering !== 'continue') n = 0;
      out[s.id] = set.items[s.id].map(function () { return ++n; });
    });
    return out;
  }

  /** {from, to} question numbers of each section, for instructions like "1 થી 12". */
  function ranges(paper, setIndex) {
    var nums = numbering(paper, setIndex), out = {};
    paper.sections.forEach(function (s) {
      var a = nums[s.id];
      out[s.id] = a.length ? { from: a[0], to: a[a.length - 1] } : { from: '', to: '' };
    });
    return out;
  }

  /**
   * Marks and problems for every set.
   * byId: function(id) → question (live or snapshot) or undefined.
   */
  function validate(paper, byId) {
    var configured = Number(paper.meta && paper.meta.totalMarks) || 0;
    var sets = paper.sets.map(function (set, si) {
      var issues = [];
      var seen = {};
      var nums = numbering(paper, si);
      var total = 0;
      var secs = paper.sections.map(function (s) {
        var ids = set.items[s.id] || [];
        var sIssues = [];
        var title = sectionTitle(s);
        var qs = ids.map(byId);
        var print = Number(s.print) || 0, attempt = Number(s.attempt) || 0, marks = Number(s.marks) || 0;

        ids.forEach(function (id, i) {
          var q = qs[i];
          if (seen[id] && !paper.allowDuplicates) sIssues.push({ level: 'error', msg: 'પ્રશ્ન ' + nums[s.id][i] + ' આ પેપરમાં બે વાર છે.' });
          seen[id] = true;
          if (!q) { sIssues.push({ level: 'error', msg: 'પ્રશ્ન ' + nums[s.id][i] + ' પ્રશ્ન બેંકમાં મળતો નથી.' }); return; }
          if (Number(q.marks) !== marks)
            sIssues.push({ level: 'warn', msg: 'પ્રશ્ન ' + nums[s.id][i] + ' ના ગુણ ' + q.marks + ' છે, પણ ' + title + ' માં દરેક પ્રશ્ન ' + marks + ' ગુણનો છે.' });
        });

        if (attempt > print) sIssues.push({ level: 'error', msg: title + ': લખવાના પ્રશ્નો (' + attempt + ') છાપવાના પ્રશ્નો (' + print + ') કરતાં વધારે ન હોઈ શકે.' });
        if (ids.length < attempt) sIssues.push({ level: 'error', msg: title + ' માં ઓછામાં ઓછા ' + attempt + ' પ્રશ્નો જોઈએ, હાલ ' + ids.length + ' છે.' });
        else if (ids.length < print) sIssues.push({ level: 'warn', msg: title + ' માં ' + print + ' પ્રશ્નો છાપવાના છે, હાલ ' + ids.length + ' છે — વિકલ્પ ઓછા મળશે.' });
        if (ids.length > print) sIssues.push({ level: 'warn', msg: title + ' માં ' + print + ' ને બદલે ' + ids.length + ' પ્રશ્નો છે.' });

        var known = qs.filter(Boolean);
        var qMarks = known.map(function (q) { return Number(q.marks) || 0; });
        var sum = qMarks.reduce(function (a, b) { return a + b; }, 0);
        var mixed = qMarks.some(function (m) { return m !== qMarks[0]; });
        var sTotal;
        if (ids.length <= attempt) sTotal = sum;                 // every printed question must be answered
        else if (!mixed && qMarks.length) sTotal = attempt * qMarks[0];
        else sTotal = attempt * marks;
        if (mixed && ids.length > attempt)
          sIssues.push({ level: 'warn', msg: title + ' માં "કોઈપણ ' + attempt + '" છે પણ પ્રશ્નોના ગુણ જુદા જુદા છે — કુલ ગુણ ચોક્કસ નથી.' });
        total += sTotal;
        issues = issues.concat(sIssues);
        return { id: s.id, title: title, count: ids.length, print: print, attempt: attempt, marks: marks, total: sTotal, issues: sIssues };
      });
      if (configured && total !== configured)
        issues.push({ level: 'warn', msg: 'Set ' + set.label + ': પ્રશ્નોના ગુણનો સરવાળો ' + total + ' થાય છે, પણ પેપર પર કુલ ગુણ ' + configured + ' લખ્યા છે.' });
      return { label: set.label, sections: secs, total: total, issues: issues, ok: !issues.some(function (i) { return i.level === 'error'; }) };
    });
    return { sets: sets, configured: configured, ok: sets.every(function (s) { return s.ok; }) };
  }

  /* ---- editing (each returns a changed copy) ---- */
  function edit(paper, fn) { var p = clone(paper); fn(p); p.updatedAt = new Date().toISOString(); return p; }

  function move(paper, si, sectionId, index, delta) {
    return edit(paper, function (p) {
      var a = p.sets[si].items[sectionId], j = index + delta;
      if (j < 0 || j >= a.length) return;
      var t = a[index]; a[index] = a[j]; a[j] = t;
    });
  }
  function remove(paper, si, sectionId, index) {
    return edit(paper, function (p) { p.sets[si].items[sectionId].splice(index, 1); });
  }
  function replace(paper, si, sectionId, index, newId) {
    return edit(paper, function (p) { p.sets[si].items[sectionId][index] = newId; });
  }
  /** Add questions to the end of a section. Skips ones already in the set unless duplicates are allowed. */
  function add(paper, si, sectionId, ids) {
    var skipped = [];
    var p = edit(paper, function (pp) {
      var inSet = idsInSet(pp.sets[si]);
      ids.forEach(function (id) {
        if (!pp.allowDuplicates && inSet.indexOf(id) >= 0) { skipped.push(id); return; }
        pp.sets[si].items[sectionId].push(id); inSet.push(id);
      });
    });
    return { paper: p, skipped: skipped };
  }
  function contains(paper, si, id) { return idsInSet(paper.sets[si]).indexOf(id) >= 0; }

  /** Add or remove a set (A, B, …). A new set starts empty. */
  function setCount(paper, n) {
    return edit(paper, function (p) {
      n = Math.max(1, Math.min(SET_LABELS.length, n));
      while (p.sets.length > n) p.sets.pop();
      while (p.sets.length < n) {
        var items = {}; p.sections.forEach(function (s) { items[s.id] = []; });
        p.sets.push({ label: SET_LABELS[p.sets.length], items: items });
      }
      p.meta.showSetLetter = p.sets.length > 1 && p.meta.showSetLetter !== false;
    });
  }

  /** Change print / attempt / marks of a section. Questions stay as they are. */
  function updateSection(paper, sectionId, changes) {
    return edit(paper, function (p) {
      var s = p.sections.find(function (x) { return x.id === sectionId; });
      ['print', 'attempt', 'marks'].forEach(function (k) { if (changes[k] != null && changes[k] !== '') s[k] = Number(changes[k]); });
      if (changes.title != null) s.title = changes.title;
      if (changes.instruction != null) s.instruction = changes.instruction;
    });
  }

  /** Question ids that appear in more than one set. */
  function overlap(paper) {
    var count = {};
    paper.sets.forEach(function (s) {
      var u = {};
      idsInSet(s).forEach(function (id) { u[id] = true; });
      Object.keys(u).forEach(function (id) { count[id] = (count[id] || 0) + 1; });
    });
    return Object.keys(count).filter(function (id) { return count[id] > 1; });
  }

  function allIds(paper) {
    var u = {};
    paper.sets.forEach(function (s) { idsInSet(s).forEach(function (id) { u[id] = true; }); });
    return Object.keys(u);
  }

  /** Keep a copy of every question used, so a saved paper still prints if a question is later edited or deleted. */
  function snapshot(paper, byId) {
    var p = clone(paper), snaps = {};
    allIds(p).forEach(function (id) { var q = byId(id); if (q) snaps[id] = clone(q); else if (p.snapshots && p.snapshots[id]) snaps[id] = p.snapshots[id]; });
    p.snapshots = snaps;
    return p;
  }

  /**
   * "Previously used" bookkeeping. Returns the questions whose usage list must change
   * so that exactly the questions in this paper carry {paperId}.
   */
  function usageChanges(questions, paper, when) {
    var inPaper = {};
    allIds(paper).forEach(function (id) { inPaper[id] = true; });
    var changed = [];
    var now = new Date().toISOString();
    // a usage change is a real change: newer time + revision, so it reaches the other devices
    var bump = function (q, usage) { return Object.assign({}, q, { usage: usage, updatedAt: now, rev: (Number(q.rev) || 0) + 1 }); };
    (questions || []).forEach(function (q) {
      var u = q.usage || [];
      var has = u.some(function (x) { return x.paperId === paper.id; });
      if (inPaper[q.id] && !has) {
        changed.push(bump(q, u.concat([{ paperId: paper.id, title: paper.title, date: when || now }])));
      } else if (!inPaper[q.id] && has) {
        changed.push(bump(q, u.filter(function (x) { return x.paperId !== paper.id; })));
      }
    });
    return changed;
  }

  return {
    SET_LABELS: SET_LABELS, rng: rng, shuffle: shuffle,
    createPaper: createPaper, eligible: eligible, autoFill: autoFill, numbering: numbering, ranges: ranges,
    validate: validate, move: move, remove: remove, replace: replace, add: add, contains: contains,
    setCount: setCount, updateSection: updateSection, overlap: overlap, allIds: allIds, idsInSet: idsInSet,
    snapshot: snapshot, usageChanges: usageChanges, sectionTitle: sectionTitle, sortSection: sortSection
  };
});
