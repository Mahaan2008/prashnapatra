/* Automatic sync engine.
   - Every save on this device is queued (outbox) in the same transaction as the save.
   - Queued changes are sent a moment after each save, when the app comes back to the screen,
     and when the internet returns. Changes from other devices are fetched every minute while
     the app is open, on opening and on returning to the app.
   - Works offline: nothing is lost, it just waits.  Rules: js/core/sync-core.js */
(function (root) {
  'use strict';
  var QPG = root.QPG;
  var S = QPG.syncCore, db = QPG.db;

  var PULL_EVERY = 60000;      // fetch others' changes while the app is open
  var PUSH_DELAY = 1500;       // wait after a save, so quick edits go together
  var PAGE = 100;

  var st = { status: 'off', text: '', key: null, lastAt: null, pending: 0, failures: 0, joinedAt: null };
  var current = null, nextOpts = null, nextRun = null, pushTimer = null, retryTimer = null, tick = null, lastPull = 0, started = false;
  var statusSubs = [], remoteSubs = [];

  function cfg() { return QPG.config || {}; }
  function available() {
    if (QPG.syncTransport) return true;
    return !root.QPG_PREVIEW && !!(cfg().SUPABASE_URL && cfg().SUPABASE_KEY) && typeof fetch === 'function';
  }

  function syncError(info) { var e = new Error(info.text); e.sync = info; return e; }

  /** Call one server function. Tests replace QPG.syncTransport. */
  function rpc(name, body) {
    if (QPG.syncTransport) {
      return QPG.syncTransport(name, body).then(function (r) {
        if (r.status >= 200 && r.status < 300) return r.body;
        throw syncError(S.classify(r.status, r.body, true));
      }, function () { throw syncError(S.classify(0, null, root.navigator ? navigator.onLine : true)); });
    }
    var c = cfg();
    return fetch(c.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { apikey: c.SUPABASE_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store'
    }).then(function (res) {
      return res.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = { message: t.slice(0, 200) }; }
        if (!res.ok) throw syncError(S.classify(res.status, j, navigator.onLine));
        return j;
      });
    }, function () { throw syncError(S.classify(0, null, navigator.onLine)); });
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
            return rpc('sync_push', { p_key: st.key, p_rows: batch.map(function (i) { return i.row; }) });
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
        return rpc('sync_pull', { p_key: st.key, p_after: after, p_limit: PAGE }).then(function (res) {
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
    if (!st.key || st.status === 'badkey') return Promise.resolve();
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
        if (info.kind === 'badkey' || info.kind === 'config') { set(info.kind === 'badkey' ? 'badkey' : 'error', info.text); return; }
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
    db.onChange(function () { if (st.key) { refreshPending(); schedulePush(); } });
    tick = setInterval(function () {
      if (st.key && document.visibilityState !== 'hidden' && Date.now() - lastPull >= PULL_EVERY) run({ pull: true });
    }, 15000);
    document.addEventListener('visibilitychange', function () {
      if (!st.key) return;
      if (document.visibilityState === 'hidden') { if (st.pending) run({ pull: false }); }
      else run({ pull: Date.now() - lastPull >= 30000 });
    });
    root.addEventListener('online', function () { if (st.key) { st.failures = 0; run({ pull: true }); } });
    root.addEventListener('offline', function () { if (st.key) set('offline', 'ઇન્ટરનેટ નથી — ફેરફાર આ ઉપકરણમાં સચવાયેલા છે, નેટ આવતાં જ મોકલાશે.'); });
  }

  function activate(key) {
    st.key = key; st.failures = 0;
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

  function randomBytes(n) {
    var a = new Uint8Array(n);
    (root.crypto || root.msCrypto).getRandomValues(a);
    return a;
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

    /** At app start: resume if this device has sync on. */
    init: function () {
      return Promise.all([db.getMeta('syncKey'), db.getMeta('syncLastAt'), db.getMeta('syncJoinedAt')]).then(function (r) {
        if (!r[0]) { set('off'); return; }
        st.lastAt = r[1] || null; st.joinedAt = r[2] || null;
        activate(r[0]);
        set(navigator.onLine === false ? 'offline' : 'ok', navigator.onLine === false ? 'ઇન્ટરનેટ નથી — નેટ આવતાં સિંક થશે.' : '');
        refreshPending();
        if (available()) run({ pull: true });
      });
    },

    /** First device: make a new secret key, register it, upload everything. */
    start: function () {
      var key = S.newKey(randomBytes(20));
      return rpc('sync_register', { p_key: key }).then(function () { return begin(key); });
    },

    /** Another device: check the key, then merge both sides (newer change wins). Resolves to cloud counts. */
    join: function (input) {
      var key = S.parseKey(input);
      if (!key) return Promise.reject(new Error('સિંક કી બરાબર નથી — 32 અક્ષરની કી કે આખી લિંક પેસ્ટ કરો.'));
      return rpc('sync_status', { p_key: key }).then(function (counts) {
        return begin(key).then(function () { return counts || {}; });
      });
    },

    /** Turn sync off on this device (data here and in the cloud stays). */
    stop: function () {
      st.key = null; st.failures = 0;
      clearTimeout(pushTimer); clearTimeout(retryTimer);
      db.setTracking(false);
      return Promise.all([db.delMeta('syncKey'), db.delMeta('syncPos'), db.delMeta('syncLastAt'), db.delMeta('syncJoinedAt'), db.clearOutbox()])
        .then(function () { st.pending = 0; st.lastAt = null; set('off'); });
    },

    now: function () { return run({ pull: true }); },
    key: function () { return st.key; },
    link: function () {
      var base = cfg().APP_URL || (/^https?:$/.test(location.protocol) ? location.origin + location.pathname : '');
      return st.key && base ? S.joinLink(base, st.key) : '';
    }
  };

  function begin(key) {
    var now = new Date().toISOString();
    return db.setMeta('syncKey', key)
      .then(function () { return db.setMeta('syncPos', { cursor: 0, seen: [] }); })
      .then(function () { return db.setMeta('syncJoinedAt', now); })
      .then(function () { st.joinedAt = now; activate(key); return queueAll(); })
      .then(refreshPending)
      .then(function () { set('syncing', 'પહેલી વાર સિંક થાય છે…'); return run({ pull: true }); });
  }

  QPG.sync = sync;
})(typeof self !== 'undefined' ? self : this);
