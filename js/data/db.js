/* IndexedDB storage on this device.
   Stores: questions, papers, templates (synced to the cloud), settings, meta, outbox.
   Deletes are "soft" (deletedAt) so a delete on one device reaches the others.
   When sync is on, every change to a synced store also writes an "outbox" entry in the
   same transaction, so a change can never be saved without being queued for upload. */
(function (root) {
  'use strict';
  var QPG = root.QPG = root.QPG || {};
  var DB_NAME = 'qpg';
  var DB_VERSION = 2;
  var SYNCED = { questions: true, papers: true, templates: true };
  var dbPromise = null;
  var tracking = false;            // set by the sync engine while sync is on
  var listeners = [];              // called after a tracked change

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!root.indexedDB) { reject(new Error('આ બ્રાઉઝરમાં ડેટા સેવ થઈ શકતો નથી (IndexedDB નથી).')); return; }
      var req = root.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains('questions')) {
          var qs = d.createObjectStore('questions', { keyPath: 'id' });
          qs.createIndex('subject', 'subject');
          qs.createIndex('updatedAt', 'updatedAt');
        }
        if (!d.objectStoreNames.contains('papers')) d.createObjectStore('papers', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('templates')) d.createObjectStore('templates', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
        // v2: changes waiting to be sent to the cloud
        if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'key' });
      };
      req.onsuccess = function () {
        var d = req.result;
        // another tab opened a newer version: close so it can upgrade
        d.onversionchange = function () { d.close(); dbPromise = null; };
        resolve(d);
      };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('એપ બીજા ટેબમાં જૂની આવૃત્તિમાં ખુલ્લી છે — બીજું ટેબ બંધ કરીને ફરી ખોલો.')); };
    });
    return dbPromise;
  }

  function reqP(r) {
    return new Promise(function (resolve, reject) {
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }

  /** Run fn(stores, setResult) in one transaction over the named stores. */
  function tx(stores, mode, fn) {
    var names = Array.isArray(stores) ? stores : [stores];
    return open().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(names, mode);
        var s = {};
        names.forEach(function (n) { s[n] = t.objectStore(n); });
        var result;
        Promise.resolve(fn(Array.isArray(stores) ? s : s[names[0]], function (r) { result = r; })).catch(function (e) {
          try { t.abort(); } catch (x) { /* already finished */ }
          reject(e);
        });
        t.oncomplete = function () { resolve(result); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('Transaction aborted')); };
      });
    });
  }

  function outboxEntry(store, id) {
    return { key: store + '/' + id, store: store, id: id, at: Date.now() + Math.random() };
  }

  /** Write records; queue them for upload when sync is on (fromSync = records that came from the cloud). */
  function write(store, values, fromSync) {
    if (store === 'questions' && !fromSync) {
      var u = QPG.auth && QPG.auth.user();
      if (u && u.email) {
        values.forEach(function (q) {
          if (q && typeof q === 'object') {
            if (!q.createdBy) q.createdBy = u.email;
            if (!q.creatorName) q.creatorName = u.name || u.email.split('@')[0];
          }
        });
      }
    }
    var track = tracking && SYNCED[store] && !fromSync;
    return tx(track ? [store, 'outbox'] : store, 'readwrite', function (s, set) {
      var target = track ? s[store] : s;
      values.forEach(function (v) {
        target.put(v);
        if (track) s.outbox.put(outboxEntry(store, v.id));
      });
      set(values.length);
    }).then(function (n) {
      if (track && n) listeners.forEach(function (fn) { try { fn(store); } catch (e) { /* ignore */ } });
      return n;
    });
  }

  var db = {
    open: open,
    SYNCED_STORES: Object.keys(SYNCED),
    getAll: function (store) {
      return tx(store, 'readonly', function (s, set) { return reqP(s.getAll()).then(set); });
    },
    get: function (store, key) {
      return tx(store, 'readonly', function (s, set) { return reqP(s.get(key)).then(set); });
    },
    put: function (store, value) { return write(store, [value]).then(function () { return value; }); },
    bulkPut: function (store, values) { return values.length ? write(store, values) : Promise.resolve(0); },
    remove: function (store, key) {
      return tx(store, 'readwrite', function (s) { return reqP(s.delete(key)); });
    },
    clear: function (store) {
      return tx(store, 'readwrite', function (s) { return reqP(s.clear()); });
    },

    /* ---- sync support ---- */
    /** Records that arrived from the cloud: saved without queueing them again. */
    putFromSync: function (store, values) { return values.length ? write(store, values, true) : Promise.resolve(0); },
    setTracking: function (on) { tracking = !!on; },
    isTracking: function () { return tracking; },
    onChange: function (fn) { listeners.push(fn); },
    outbox: function (limit) {
      return tx('outbox', 'readonly', function (s, set) {
        return reqP(s.getAll()).then(function (all) {
          all.sort(function (a, b) { return a.at - b.at; });
          set(limit ? all.slice(0, limit) : all);
        });
      });
    },
    outboxCount: function () {
      return tx('outbox', 'readonly', function (s, set) { return reqP(s.count()).then(set); });
    },
    /** Remove sent entries, unless the record changed again while it was being sent. */
    outboxDone: function (entries) {
      return tx('outbox', 'readwrite', function (s, set) {
        var removed = 0;
        return Promise.all(entries.map(function (e) {
          return reqP(s.get(e.key)).then(function (cur) {
            if (cur && cur.at === e.at) { s.delete(e.key); removed++; }
          });
        })).then(function () { set(removed); });
      });
    },
    /**
     * Records from the cloud: compare with the local copy and save in ONE transaction, so a
     * change made on this device at the same moment can never be overwritten by an older one.
     * decide(local, remote) → 'apply' | 'push' | 'same'. Resolves to {applied: [ids], pushed: [ids]}.
     */
    applyFromSync: function (store, records, decide) {
      var res = { applied: [], pushed: [] };
      if (!records.length) return Promise.resolve(res);
      return tx([store, 'outbox'], 'readwrite', function (s, set) {
        return Promise.all(records.map(function (rec) {
          return reqP(s[store].get(rec.id)).then(function (local) {
            var d = decide(local, rec);
            if (d === 'apply') { s[store].put(rec); res.applied.push(rec.id); }
            else if (d === 'push') { s.outbox.put(outboxEntry(store, rec.id)); res.pushed.push(rec.id); }
          });
        })).then(function () { set(res); });
      });
    },
    clearOutbox: function () { return db.clear('outbox'); },
    /** Queue records for upload (used when sync is switched on, or a local copy is newer). */
    enqueue: function (store, ids) {
      if (!ids.length) return Promise.resolve(0);
      return tx('outbox', 'readwrite', function (s, set) {
        ids.forEach(function (id) { s.put(outboxEntry(store, id)); });
        set(ids.length);
      });
    },

    /* ---- questions ---- */
    allQuestions: function () {
      return db.getAll('questions').then(function (list) { return list.filter(function (q) { return !q.deletedAt; }); });
    },
    saveQuestion: function (q) { return db.put('questions', q); },
    softDeleteQuestion: function (id) {
      return db.get('questions', id).then(function (q) {
        if (!q) return null;
        var now = new Date().toISOString();
        q.deletedAt = now; q.updatedAt = now; q.rev = (q.rev || 0) + 1;
        return db.put('questions', q);
      });
    },
    /** Removes every demo question (soft delete). Returns how many. */
    removeDemoQuestions: function () {
      return db.getAll('questions').then(function (list) {
        var now = new Date().toISOString();
        var demo = list.filter(function (q) { return q.isDemo && !q.deletedAt; });
        demo.forEach(function (q) { q.deletedAt = now; q.updatedAt = now; q.rev = (q.rev || 0) + 1; });
        return db.bulkPut('questions', demo).then(function () { return demo.length; });
      });
    },

    /* ---- papers ---- */
    allPapers: function () {
      return db.getAll('papers').then(function (list) {
        return list.filter(function (p) { return !p.deletedAt; })
          .sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
      });
    },
    getPaper: function (id) { return db.get('papers', id); },
    savePaper: function (p) { return db.put('papers', p); },
    softDeletePaper: function (id) {
      return db.get('papers', id).then(function (p) {
        if (!p) return null;
        var now = new Date().toISOString();
        p.deletedAt = now; p.updatedAt = now; p.rev = (p.rev || 0) + 1;
        return db.put('papers', p);
      });
    },

    /* ---- template changes (institute name, logos …) ---- */
    templateOverrides: function () {
      return db.getAll('templates').then(function (rows) {
        var o = {}; rows.forEach(function (r) { if (!r.deletedAt) o[r.id] = r; }); return o;
      });
    },
    saveTemplateOverride: function (row) {
      row.updatedAt = new Date().toISOString();
      row.rev = (row.rev || 0) + 1;
      return db.put('templates', row);
    },

    /* ---- settings & meta (this device only) ---- */
    getSetting: function (key, fallback) {
      return db.get('settings', key).then(function (r) { return r ? r.value : fallback; });
    },
    setSetting: function (key, value) { return tx('settings', 'readwrite', function (s) { return reqP(s.put({ key: key, value: value })); }); },
    getMeta: function (key) { return db.get('meta', key).then(function (r) { return r ? r.value : undefined; }); },
    setMeta: function (key, value) { return tx('meta', 'readwrite', function (s) { return reqP(s.put({ key: key, value: value })); }); },
    delMeta: function (key) { return tx('meta', 'readwrite', function (s) { return reqP(s.delete(key)); }); },

    /** Ask the browser not to clear our data when storage is low. */
    persist: function () {
      if (root.navigator && navigator.storage && navigator.storage.persist) {
        return navigator.storage.persisted().then(function (p) { return p || navigator.storage.persist(); }).catch(function () { return false; });
      }
      return Promise.resolve(false);
    }
  };

  QPG.db = db;
})(typeof self !== 'undefined' ? self : this);
