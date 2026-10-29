/* App start-up, state and hash router. */
(function (root) {
  'use strict';
  var QPG = root.QPG;
  var VERSION = '0.7.2';
  var DEMO_DATE = '2026-01-01T00:00:00.000Z';

  var state = {
    questions: [],          // live (not deleted) questions, kept in memory
    bankFilters: { demo: 'any', used: 'any' },
    templateOverrides: {}
  };

  var app = QPG.app = {
    VERSION: VERSION,
    state: state,
    guard: null,            // set by a view with unsaved changes: () => message | null
    currentPath: null,

    refreshQuestions: function () {
      return QPG.db.allQuestions().then(function (list) { state.questions = list; return list; });
    },
    upsertLocal: function (q) {
      var i = state.questions.findIndex(function (x) { return x.id === q.id; });
      if (q.deletedAt) { if (i >= 0) state.questions.splice(i, 1); return; }
      if (i >= 0) state.questions[i] = q; else state.questions.push(q);
    },
    questionById: function (id) {
      return state.questions.find(function (q) { return q.id === id; });
    },
    go: null, // set below

    /** Who is logged in comes from the server profile (QPG.auth.user()); the preview has no login. */
    isAdmin: function () {
      var u = QPG.auth && QPG.auth.user();
      if (!u) return !QPG.sync.available();
      return !!u.isAdmin;
    },

    userSubjects: function () {
      var all = ['physics', 'maths', 'science'];
      var u = QPG.auth && QPG.auth.user();
      if (!u || u.isAdmin) return all;
      var subs = u.subjects.filter(function (s) { return all.indexOf(s) >= 0; });
      return subs.length ? subs : ['physics'];
    },

    userStandards: function () {
      var all = [8, 9, 10, 11, 12];
      var u = QPG.auth && QPG.auth.user();
      if (!u || u.isAdmin) return all;
      var stds = u.standards.filter(function (s) { return all.indexOf(s) >= 0; });
      return stds.length ? stds : [11];
    },

    /** Standards this user may pick for a subject (and that the syllabus has). */
    stdsFor: function (subject) {
      var mine = app.userStandards(), known = QPG.syllabus.standardsFor(subject);
      var both = mine.filter(function (n) { return known.indexOf(n) >= 0; });
      return both.length ? both : (known.length ? known : mine);
    },
    /** Subjects this user may pick (those with at least one allowed standard first). */
    subjectsAllowed: function () {
      var subs = app.userSubjects(), mine = app.userStandards();
      var ok = subs.filter(function (s) { return QPG.syllabus.standardsFor(s).some(function (n) { return mine.indexOf(n) >= 0; }); });
      return ok.length ? ok : subs;
    },
    /** Make {subject, std} a pair that exists and that this user may use. Returns true when it changed. */
    fixSubjectStd: function (o) {
      var before = o.subject + '/' + o.std, subs = app.subjectsAllowed();
      if (subs.indexOf(o.subject) < 0) o.subject = subs[0];
      var stds = app.stdsFor(o.subject), pref = QPG.syllabus.DEFAULT_STD[o.subject];
      if (stds.indexOf(Number(o.std)) < 0) o.std = stds.indexOf(pref) >= 0 ? pref : stds[0];
      o.std = Number(o.std);
      return before !== o.subject + '/' + o.std;
    },

    userQuestions: function () {
      var all = state.questions || [];
      if (app.isAdmin()) return all;
      var u = QPG.auth && QPG.auth.user();
      var uEmail = u && u.email ? u.email.toLowerCase().trim() : '';
      var allowedSubs = app.userSubjects();
      var allowedStds = app.userStandards();
      return all.filter(function (q) {
        // If assigned specifically to this teacher or 'all'
        if (q.assignedTo && Array.isArray(q.assignedTo) && q.assignedTo.length) {
          if (q.assignedTo.indexOf('all') >= 0 || q.assignedTo.indexOf(uEmail) >= 0) return true;
          return false;
        }
        var subOk = allowedSubs.indexOf(q.subject) >= 0;
        var stdOk = allowedStds.indexOf(Number(q.std)) >= 0;
        return subOk && stdOk;
      });
    },

    userPapers: function (papers) {
      if (app.isAdmin()) return papers || [];
      var allowedSubs = app.userSubjects();
      var allowedStds = app.userStandards();
      return (papers || []).filter(function (p) {
        var subOk = allowedSubs.indexOf(p.subject) >= 0;
        var pStd = p.meta && p.meta.std ? Number(p.meta.std) : (p.std ? Number(p.std) : null);
        var stdOk = !pStd || allowedStds.indexOf(pStd) >= 0;
        return subOk && stdOk;
      });
    },

    templateList: function () { return QPG.templates.list(state.templateOverrides); },
    userTemplates: function () {
      var list = app.templateList();
      if (app.isAdmin()) return list;
      var allowedSubs = app.userSubjects();
      return list.filter(function (t) {
        return !t.subject || allowedSubs.indexOf(t.subject) >= 0;
      });
    },
    template: function (id) { return QPG.templates.get(id, state.templateOverrides); },

    /** Question lookup for a paper: the live question, or the copy saved with the paper. */
    getQFor: function (paper) {
      return function (id) { return app.questionById(id) || (paper.snapshots && paper.snapshots[id]); };
    },

    /** Save a paper: keep copies of its questions and mark them as used in this paper. */
    savePaper: function (paper) {
      var p = QPG.assembly.snapshot(paper, app.questionById);
      p.rev = (p.rev || 0) + 1;
      p.updatedAt = new Date().toISOString();
      var changed = QPG.assembly.usageChanges(state.questions, p);
      return QPG.db.savePaper(p)
        .then(function () { return changed.length ? QPG.db.bulkPut('questions', changed) : 0; })
        .then(function () { changed.forEach(app.upsertLocal); return p; });
    },

    /** Delete a paper and clear its "used" marks from the questions. */
    deletePaper: function (paper) {
      var empty = JSON.parse(JSON.stringify(paper));
      empty.sets.forEach(function (s) { Object.keys(s.items).forEach(function (k) { s.items[k] = []; }); });
      var changed = QPG.assembly.usageChanges(state.questions, empty);
      return QPG.db.softDeletePaper(paper.id)
        .then(function () { return changed.length ? QPG.db.bulkPut('questions', changed) : 0; })
        .then(function () { changed.forEach(app.upsertLocal); });
    }
  };

  /* ---------- routing ---------- */
  var ROUTES = [
    { re: /^\/?$/, view: 'dashboard', nav: 'home', title: 'હોમ' },
    { re: /^\/questions\/new$/, view: 'form', nav: 'bank', title: 'નવો પ્રશ્ન' },
    { re: /^\/questions\/edit\/(.+)$/, view: 'form', nav: 'bank', title: 'પ્રશ્ન સુધારો', mode: 'edit' },
    { re: /^\/questions\/copy\/(.+)$/, view: 'form', nav: 'bank', title: 'પ્રશ્નની નકલ', mode: 'copy' },
    { re: /^\/questions$/, view: 'bank', nav: 'bank', title: 'પ્રશ્ન બેંક' },
    { re: /^\/new-paper$/, view: 'newPaper', nav: 'newpaper', title: 'નવું પેપર' },
    { re: /^\/papers$/, view: 'papers', nav: 'papers', title: 'સેવ કરેલાં પેપર' },
    { re: /^\/papers\/edit\/(.+)$/, view: 'paperEditor', nav: 'papers', title: 'પેપર તૈયાર કરો' },
    { re: /^\/papers\/view\/(.+)$/, view: 'paperView', nav: 'papers', title: 'પેપર જુઓ' },
    { re: /^\/import$/, view: 'importView', nav: 'import', title: 'પ્રશ્નો Import' },
    { re: /^\/settings$/, view: 'settings', nav: 'more', title: 'ટેમ્પ્લેટ અને સેટિંગ્સ' },
    { re: /^\/sync$/, view: 'settings', nav: 'more', title: 'ટેમ્પ્લેટ અને સેટિંગ્સ' },
    { re: /^\/login$/, view: 'login', nav: '', title: 'લૉગિન', open: true },
    { re: /^\/password$/, view: 'setPassword', nav: 'more', title: 'નવો પાસવર્ડ' }
  ];

  /* The current path is kept in memory and mirrored to the address bar when allowed,
     so links work even where the page cannot change location.hash (embedded previews). */
  if (QPG.auth) QPG.auth.consumeHash();   // an email link (#access_token=…) must not be read as a page
  var currentPath = (function () {
    try { return decodeURIComponent((location.hash || '#/').slice(1)) || '/'; } catch (e) { return '/'; }
  })();

  function parsePath(h) {
    var qi = h.indexOf('?');
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var query = {};
    if (qi >= 0) new URLSearchParams(h.slice(qi + 1)).forEach(function (v, k) { query[k] = v; });
    return { path: path || '/', query: query, raw: h };
  }

  var cleanup = null;

  /** Go to a path. Asks first when the current screen has unsaved changes. */
  function navigate(path, fromHistory) {
    if (path === currentPath && !fromHistory && document.getElementById('view').firstChild) { render(); return; }
    var msg = app.guard && app.guard();
    if (msg) {
      if (fromHistory) { try { history.pushState({ p: currentPath }, '', '#' + currentPath); } catch (e) { /* ignore */ } }
      QPG.ui.confirmDialog({ title: 'ફેરફાર સેવ કર્યા નથી', body: msg, ok: 'સેવ કર્યા વગર જાઓ', cancel: 'અહીં જ રહો', danger: true })
        .then(function (yes) { if (yes) { app.guard = null; navigate(path); } });
      return;
    }
    currentPath = path;
    if (!fromHistory) { try { history.pushState({ p: path }, '', '#' + path); } catch (e) { /* address bar not available */ } }
    render();
  }
  app.go = navigate;
  /** Draw the current screen again (after changes arrived from another device), keeping the scroll. */
  app.rerender = function () { var y = window.scrollY; render(); window.scrollTo(0, y); };

  function render() {
    var loc = parsePath(currentPath);
    app.guard = null;
    app.currentPath = currentPath;

    var route = ROUTES.find(function (r) { return r.re.test(loc.path); }) || ROUTES[0];
    // not logged in: only the login screen (the preview has no login)
    var needLogin = QPG.sync.available() && !QPG.auth.signedIn();
    if (needLogin && !route.open) route = ROUTES.find(function (r) { return r.view === 'login'; });
    if (!needLogin && route.view === 'login') route = ROUTES[0];
    document.body.classList.toggle('signed-out', needLogin);
    var m = loc.path.match(route.re) || [];
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;

    document.querySelectorAll('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === route.nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var tt = document.querySelector('.topbar-title');
    if (tt) tt.textContent = route.title;
    document.title = route.title + ' — પ્રશ્નપત્ર';
    var fab = document.querySelector('.fab');
    if (fab) fab.hidden = route.view !== 'bank' && route.view !== 'dashboard';

    var host = document.getElementById('view');
    host.innerHTML = '';
    var el = document.createElement('div');   // fresh element: listeners of the old view go with it
    host.appendChild(el);
    var view = QPG.views[route.view];
    cleanup = view(el, { id: m[1], mode: route.mode, query: loc.query });
    window.scrollTo(0, 0);
    host.focus({ preventScroll: true });
  }

  /* ---------- automatic sync ---------- */
  var SAFE_TO_REDRAW = { dashboard: 1, bank: 1, papers: 1, settings: 1 };
  function onRemoteChange(changed) {
    var jobs = [];
    if (changed.questions) jobs.push(app.refreshQuestions());
    if (changed.templates) jobs.push(QPG.db.templateOverrides().then(function (o) { state.templateOverrides = o; }));
    Promise.all(jobs).then(function () {
      var route = ROUTES.find(function (r) { return r.re.test(parsePath(currentPath).path); }) || ROUTES[0];
      var typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      var unsaved = app.guard && app.guard();
      if (SAFE_TO_REDRAW[route.view] && !unsaved && !typing && !document.querySelector('dialog[open]')) app.rerender();
      else if (route.view !== 'settings' && route.view !== 'syncJoin') QPG.ui.toast('બીજા ઉપકરણમાંથી ફેરફાર આવ્યા');
    });
  }

  var STATUS_LABEL = {
    ok: 'સિંક ✓', syncing: 'સિંક થાય છે…', offline: 'ઑફલાઇન', error: 'સિંક અટક્યું', signedout: 'ફરી લૉગિન કરો'
  };
  function showSyncStatus(s) {
    document.querySelectorAll('[data-sync-chip]').forEach(function (chip) {
      if (s.status === 'off') { chip.hidden = true; return; }
      chip.hidden = false;
      chip.setAttribute('data-state', s.status);
      var label = STATUS_LABEL[s.status] || 'સિંક';
      if (s.status === 'ok' && s.pending) label = 'મોકલવાનું બાકી: ' + s.pending;
      if (s.status === 'offline' && s.pending) label = 'ઑફલાઇન · ' + s.pending + ' બાકી';
      chip.innerHTML = '<span class="dot"></span>' + QPG.questionHtml.esc(label);
      chip.title = s.text || (s.lastAt ? 'છેલ્લું સિંક: ' + new Date(s.lastAt).toLocaleString('gu-IN') : '');
    });
  }

  /**
   * Ask the server again whether this account is still approved (and for its subjects / standards).
   * Approval taken back by the admin → log out on this device. No internet → keep working.
   */
  function checkAccountLater() {
    setTimeout(function () {
      QPG.auth.refreshProfile().then(function (r) {
        if (r === 'revoked') {
          return QPG.sync.signOut().then(function () {
            currentPath = '/login?msg=' + encodeURIComponent('ઍડમિને તમારી મંજૂરી રદ કરી છે, એટલે આ ઉપકરણમાંથી લૉગઆઉટ થયું છે. પ્રશ્ન હોય તો ઍડમિનનો સંપર્ક કરો.');
            app.guard = null;
            render();
          });
        }
        if (r === 'ok') {
          if (app.isAdmin() && QPG.approvals) QPG.approvals.load().catch(function () { /* offline */ });
          if (SAFE_TO_REDRAW[currentRouteView()] && !(app.guard && app.guard())) app.rerender();
        }
      });
    }, 800);
  }
  function currentRouteView() {
    var r = ROUTES.find(function (x) { return x.re.test(parsePath(currentPath).path); });
    return r ? r.view : '';
  }

  /** Right after a successful login on this device. */
  app.afterLogin = function () {
    if (app.isAdmin() && QPG.approvals) QPG.approvals.load().catch(function () { /* offline */ });
    return QPG.sync.begin()
      .then(seedDemoOnce)
      .then(app.refreshQuestions)
      .then(function () { return QPG.db.templateOverrides().then(function (o) { state.templateOverrides = o; }); })
      .then(function () {
        QPG.ui.toast('લૉગિન થયું — તમારો ડેટા આવી રહ્યો છે');
        currentPath = '/';
        try { history.replaceState({ p: '/' }, '', '#/'); } catch (e) { /* ignore */ }
        render();
      });
  };

  /* ---------- start-up ---------- */
  function seedDemoOnce() {
    return QPG.db.getMeta('demoSeeded').then(function (done) {
      if (done) return 0;
      // fixed date: the same demo question is on every device, and any real change elsewhere must win
      var list = (QPG.DEMO_QUESTIONS || []).map(function (q) { return QPG.schema.normalizeQuestion(q, DEMO_DATE); });
      return QPG.db.bulkPut('questions', list).then(function () { return QPG.db.setMeta('demoSeeded', true); })
        .then(function () { return list.length; });
    });
  }

  function start() {
    document.querySelectorAll('[data-icon]').forEach(function (s) { s.outerHTML = QPG.ui.icon(s.getAttribute('data-icon')); });
    document.querySelector('.sidebar-foot').textContent = 'આવૃત્તિ ' + VERSION;

    QPG.db.open()
      .then(seedDemoOnce)
      .then(app.refreshQuestions)
      .then(function () { return QPG.db.templateOverrides().then(function (o) { state.templateOverrides = o; }); })
      .then(function () { return QPG.auth.init(); })
      .then(function (linkResult) {
        QPG.sync.onStatus(showSyncStatus);
        QPG.sync.onRemoteChange(onRemoteChange);
        if (linkResult.type === 'recovery') currentPath = '/password';
        else if (linkResult.type === 'signup' || linkResult.type === 'email') setTimeout(function () { QPG.ui.toast('ઇમેઇલ ચકાસાયો — લૉગિન થઈ ગયું'); }, 300);
        else if (linkResult.error) currentPath = '/login?msg=' + encodeURIComponent(linkResult.error);
        if (!QPG.auth.signedIn()) return null;
        checkAccountLater();
        return QPG.sync.init().then(seedDemoOnce).then(function () {
          // first login on this device may have replaced the local data
          return app.refreshQuestions().then(function () { return QPG.db.templateOverrides(); }).then(function (o) { state.templateOverrides = o; });
        }).catch(function () { /* sync problems never stop the app */ });
      })
      .then(function () {
        QPG.db.persist();
        document.addEventListener('click', function (e) {
          var a = e.target.closest && e.target.closest('a[href^="#/"]');
          if (!a || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
          e.preventDefault();
          navigate(a.getAttribute('href').slice(1));
        });
        window.addEventListener('popstate', function (e) {
          var p = (e.state && e.state.p) || decodeURIComponent((location.hash || '#/').slice(1)) || '/';
          navigate(p, true);
        });
        try { history.replaceState({ p: currentPath }, '', '#' + currentPath); } catch (e) { /* ignore */ }
        render();
      })
      .catch(function (err) {
        document.getElementById('view').innerHTML =
          '<div class="notice notice-error">' + QPG.ui.icon('error') + '<div><b>એપ શરૂ થઈ શકી નથી.</b><br>' +
          QPG.questionHtml.esc(err && err.message || err) +
          '<br>Chrome અથવા Edge નું નવું વર્ઝન વાપરો, અને Private/Incognito વિન્ડોમાં ન ખોલો.</div></div>';
      });

    // no "Install app" bar: the browser's own install offer is turned off
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); });

    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      var hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache not available here */ });
      // a new version was installed in the background: offer to reload
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!hadController || document.querySelector('.update-bar')) return;
        var bar = document.createElement('div');
        bar.className = 'update-bar'; bar.setAttribute('role', 'status');
        bar.innerHTML = '<span>એપની નવી આવૃત્તિ આવી છે.</span><button type="button" class="btn btn-sm btn-primary">હમણાં ખોલો</button>';
        bar.querySelector('button').addEventListener('click', function () {
          var msg = app.guard && app.guard();
          if (msg) { QPG.ui.toast('પહેલાં ફેરફાર સેવ કરો'); return; }
          location.reload();
        });
        document.body.appendChild(bar);
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(self);
