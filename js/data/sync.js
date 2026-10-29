/* Automatic sync engine.
   - Every save on this device is queued (outbox) in the same transaction as the save.
   - Queued changes are sent a moment after each save, when the app comes back to the screen,
     and when the internet returns. Changes from other devices are fetched every minute while
     the app is open, on opening and on returning to the app.
   - Works offline: nothing is lost, it just waits.  Rules: js/core/sync-core.js
   - Data belongs to the logged-in account (js/data/auth.js); the server finds it from the login token. */
(function (root) {
  'use strict';
  var QPG = root.QPG;
  var S = QPG.syncCore, db = QPG.db;

  var PULL_EVERY = 60000;      // fetch others' changes while the app is open
  var PUSH_DELAY = 1500;       // wait after a save, so quick edits go together
  var PAGE = 100;

  var st = { status: 'off', text: '', user: null, lastAt: null, pending: 0, failures: 0 };
  var current = null, nextOpts = null, nextRun = null, pushTimer = null, retryTimer = null, tick = null, lastPull = 0, started = false;
  var statusSubs = [], remoteSubs = [];

  function cfg() { return QPG.config || {}; }
  function available() {
    if (QPG.syncTransport) return true;
    return !root.QPG_PREVIEW && !!(cfg().SUPABASE_URL && cfg().SUPABASE_KEY) && typeof fetch === 'function';
  }

  function syncError(info) { var e = new Error(info.text); e.sync = info; return e; }

  function online() { return root.navigator ? navigator.onLine !== false : true; }

  /** One raw call → {status, body}; status 0 = no connection. Tests replace QPG.syncTransport. */
  function send(name, body, token) {
    if (QPG.syncTransport) return QPG.syncTransport(name, body, token).catch(function () { return { status: 0, body: null }; });
    var c = cfg();
    return fetch(c.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { apikey: c.SUPABASE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store'
    }).then(function (res) {
      return res.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = { message: t.slice(0, 200) }; }
        return { status: res.status, body: j };
      });
    }, function () { return { status: 0, body: null }; });
  }

  /** Call one server function as the logged-in user; renews the login once if it has just expired. */
  function rpc(name, body) {
    var tryOnce = function (force) {
      return QPG.auth.token(force).then(function (t) { return send(name, body, t); }, function (e) {
        if (e && e.auth === 'network') return { status: 0, body: null };
        throw syncError({ kind: 'signedout', retry: false, text: e && e.message || 'ફરી લૉગિન કરો.' });
      });
    };
    return tryOnce(false).then(function (r) {
      if (r.status === 401 || (r.body && /^PGRST30/.test(r.body.code || ''))) return tryOnce(true);
      return r;
    }).then(function (r) {
      if (r.status >= 200 && r.status < 300) return r.body;
      if (r.status === 401) throw syncError({ kind: 'signedout', retry: false, text: 'લૉગિન પૂરું થઈ ગયું છે — ફરી લૉગિન કરો.' });
      if (r.body && r.body.hint === 'pending_approval') throw syncError({ kind: 'signedout', retry: false, text: QPG.auth.PENDING_TEXT });
      throw syncError(S.classify(r.status, r.body, online()));
    });
  }

  function emit() {
    var snap = Object.assign({}, st);
    statusSubs.forEach(function (fn) { try { fn(snap); } catch (e) { /* ignore */ } });
  }
  function set(status, text) { st.status = status; st.text = text || ''; emit(); }
  function refreshPending() {
    return db.outboxCount().then(function (n) { st.pending = n; emit(); return n; });
  }

  /* ---------- sending ---------- */
  function pushAll() {
    return db.outbox().then(function (entries) {
      if (!entries.length) return 0;
      return Promise.all(entries.map(function (e) {
        return db.get(e.store, e.id).then(function (rec) { return { e: e, rec: rec }; });
      })).then(function (list) {
        var gone = list.filter(function (x) { return !x.rec || S.KINDS.indexOf(x.e.store) < 0; }).map(function (x) { return x.e; });
        var items = list.filter(function (x) { return x.rec && S.KINDS.indexOf(x.e.store) >= 0; })
          .map(function (x) { return { row: S.toRow(x.e.store, x.rec), e: x.e }; });
        var sent = 0;
        var chain = gone.length ? db.outboxDone(gone) : Promise.resolve();
        S.batches(items).forEach(function (batch) {
          chain = chain.then(function () {
            return rpc('sync_push_me', { p_rows: batch.map(function (i) { return i.row; }) });
          }).then(function () {
            sent += batch.length;
            return db.outboxDone(batch.map(function (i) { return i.e; }));
          }).then(refreshPending);
        });
        return chain.then(function () { return sent; });
      });
    });
  }

  /* ---------- receiving ---------- */
  function applyRows(rows, changed) {
    var byKind = {};
    rows.forEach(function (r) {
      if (!r || S.KINDS.indexOf(r.kind) < 0 || !r.data || typeof r.data !== 'object') return;
      var rec = Object.assign({}, r.data, { id: r.id });
      (byKind[r.kind] = byKind[r.kind] || []).push(rec);
    });
    return Promise.all(Object.keys(byKind).map(function (kind) {
      return db.applyFromSync(kind, byKind[kind], S.decide).then(function (res) {
        if (res.applied.length) changed[kind] = (changed[kind] || 0) + res.applied.length;
      });
    }));
  }

  function pullAll(changed) {
    var start = Date.now();
    lastPull = start;
    return db.getMeta('syncPos').then(function (pos) {
      pos = pos || { cursor: 0, seen: [] };
      var after = pos.cursor || 0, maxSeq = after, got = 0;
      function page() {
        return rpc('sync_pull_me', { p_after: after, p_limit: PAGE }).then(function (res) {
          var rows = (res && res.rows) || [];
          got += rows.length;
          if (got > PAGE) set('syncing', 'ક્લાઉડમાંથી આવે છે… ' + got);
          return applyRows(rows, changed).then(function () {
            var last = Number(res && res.last_seq) || after;
            if (last > maxSeq) maxSeq = last;
            if (res && res.more && rows.length && last > after) { after = last; return page(); }
          });
        });
      }
      return page().then(function () {
        return db.setMeta('syncPos', S.advance(pos, start, Date.now(), maxSeq));
      }).then(function () { return changed; });
    });
  }

  /* ---------- one round: send, fetch, send again (records where ours turned out newer) ---------- */
  function withLock(fn) {
    if (root.navigator && navigator.locks && navigator.locks.request) {
      return navigator.locks.request('qpg-sync', function () { return fn(); });
    }
    return fn();
  }

  /**
   * opts.pull: also fetch others' changes. Resolves when done (never rejects).
   * While a round is running, further requests are merged into one more round after it.
   */
  function run(opts) {
    opts = opts || {};
    if (!st.user || st.status === 'signedout' || !available()) return Promise.resolve();
    if (current) {
      nextOpts = { pull: (nextOpts && nextOpts.pull) || !!opts.pull };
      if (!nextRun) nextRun = current.then(function () { var o = nextOpts; nextOpts = null; nextRun = null; return run(o); });
      return nextRun;
    }
    current = runOnce(opts).then(function () { current = null; });
    return current;
  }

  function runOnce(opts) {
    clearTimeout(retryTimer);
    var done = false;
    var showBusy = setTimeout(function () { if (!done) set('syncing', 'સિંક ચાલે છે…'); }, 400);
    var changed = {};
    return withLock(function () {
      return pushAll()
        .then(function () { return opts.pull ? pullAll(changed) : null; })
        .then(function () { return db.outboxCount(); })
        .then(function (n) { return n ? pushAll() : 0; });
    }).then(function () {
      st.failures = 0;
      st.lastAt = new Date().toISOString();
      db.setMeta('syncLastAt', st.lastAt);
      return refreshPending().then(function () { set('ok'); });
    }, function (e) {
      var info = e && e.sync ? e.sync : { kind: 'error', retry: true, text: 'સિંકમાં ભૂલ: ' + (e && e.message || e) };
      return refreshPending().then(function () {
        if (info.kind === 'signedout' || info.kind === 'badkey' || info.kind === 'config') { set(info.kind === 'config' ? 'error' : 'signedout', info.text); return; }
        st.failures++;
        set(info.kind === 'offline' ? 'offline' : 'error', info.text);
        if (info.retry) retryTimer = setTimeout(function () { run({ pull: true }); }, S.backoff(st.failures));
      });
    }).then(function () {
      clearTimeout(showBusy);
      done = true;
      if (Object.keys(changed).length) remoteSubs.forEach(function (fn) { try { fn(changed); } catch (x) { /* ignore */ } });
    });
  }

  function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { run({ pull: false }); }, PUSH_DELAY);
  }

  /* ---------- start / stop ---------- */
  function startTriggers() {
    if (started) return;
    started = true;
    db.onChange(function () { if (st.user) { refreshPending(); schedulePush(); } });
    tick = setInterval(function () {
      if (st.user && document.visibilityState !== 'hidden' && Date.now() - lastPull >= PULL_EVERY) run({ pull: true });
    }, 15000);
    document.addEventListener('visibilitychange', function () {
      if (!st.user) return;
      if (document.visibilityState === 'hidden') { if (st.pending) run({ pull: false }); }
      else run({ pull: Date.now() - lastPull >= 30000 });
    });
    root.addEventListener('online', function () { if (st.user) { st.failures = 0; run({ pull: true }); } });
    root.addEventListener('offline', function () { if (st.user) set('offline', 'ઇન્ટરનેટ નથી — ફેરફાર આ ઉપકરણમાં સચવાયેલા છે, નેટ આવતાં જ મોકલાશે.'); });
  }

  function activate(userId) {
    st.user = userId; st.failures = 0;
    db.setTracking(true);
    startTriggers();
  }

  /** Queue every record of this device (except untouched demo questions) for upload. */
  function queueAll() {
    return Promise.all(S.KINDS.map(function (kind) {
      return db.getAll(kind).then(function (list) {
        return db.enqueue(kind, list.filter(S.shouldUpload).map(function (r) { return r.id; }));
      });
    }));
  }

  /** Remove this device's copy of the data (used when a different account logs in, and on logout). */
  function wipeLocal() {
    return Promise.all(S.KINDS.concat(['outbox']).map(function (st2) { return db.clear(st2); }))
      .then(function () { return Promise.all(['syncPos', 'syncLastAt', 'ownerId', 'syncKey', 'syncJoinedAt', 'demoSeeded'].map(db.delMeta)); });
  }

  var sync = {
    available: available,
    state: function () { return Object.assign({}, st); },
    /** Calls fn(state) now and on every change. Returns a function that stops it. */
    onStatus: function (fn) {
      statusSubs.push(fn); fn(Object.assign({}, st));
      return function () { var i = statusSubs.indexOf(fn); if (i >= 0) statusSubs.splice(i, 1); };
    },
    /** fn({questions: n, papers: n, templates: n}) after changes from other devices were saved here. */
    onRemoteChange: function (fn) { remoteSubs.push(fn); },

    /** At app start (after QPG.auth.init): resume syncing for the logged-in account. */
    init: function () {
      var u = QPG.auth.user();
      return Promise.all([db.getMeta('ownerId'), db.getMeta('syncLastAt'), db.getMeta('syncKey')]).then(function (r) {
        if (r[2]) return db.delMeta('syncKey').then(function () { return db.delMeta('syncJoinedAt'); }).then(function () { return sync.init(); }); // old key sync → login
        if (!u) { set('off'); return; }
        if (r[0] !== u.id) return sync.begin();       // first time on this device for this account
        st.lastAt = r[1] || null;
        activate(u.id);
        set(online() ? 'ok' : 'offline', online() ? '' : 'ઇન્ટરનેટ નથી — નેટ આવતાં સિંક થશે.');
        refreshPending();
        return run({ pull: true });
      });
    },

    /**
     * Right after a login on this device. Data already here from before any login is kept and
     * uploaded into the account; data of a different account is removed first.
     */
    begin: function () {
      var u = QPG.auth.user();
      if (!u) return Promise.resolve();
      return db.getMeta('ownerId').then(function (owner) {
        return owner && owner !== u.id ? wipeLocal() : null;
      }).then(function () { return db.setMeta('ownerId', u.id); })
        .then(function () { return db.setMeta('syncPos', { cursor: 0, seen: [] }); })
        .then(function () { activate(u.id); return queueAll(); })
        .then(refreshPending)
        .then(function () { set('syncing', 'પહેલી વાર સિંક થાય છે…'); run({ pull: true }); });   // runs on in the background
    },

    /** Send what is still waiting (best effort). Resolves to the number still not sent. */
    flush: function () { return run({ pull: false }).then(refreshPending); },

    /** Log out: stop syncing and remove this device's copy (it is safe in the cloud). */
    signOut: function () {
      st.user = null; st.failures = 0;
      clearTimeout(pushTimer); clearTimeout(retryTimer);
      db.setTracking(false);
      return wipeLocal().then(function () { st.pending = 0; st.lastAt = null; set('off'); });
    },

    now: function () { if (st.status === 'signedout' && QPG.auth.signedIn()) { st.status = 'ok'; } return run({ pull: true }); }
  };

  QPG.sync = sync;
})(typeof self !== 'undefined' ? self : this);
