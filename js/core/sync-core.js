/* Automatic sync — the pure rules (tested in Node).
   Every device keeps its own full copy (works offline). Changes go to the cloud through
   an outbox and come back to other devices by sequence number. When the same record was
   changed on two devices, the later change wins ("updatedAt"). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.QPG = root.QPG || {}; root.QPG.syncCore = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KINDS = ['questions', 'papers', 'templates'];
  var EPOCH = '2000-01-01T00:00:00.000Z';
  // Crockford base32: no I, L, O, U — easy to read aloud and type
  var ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  var KEY_LEN = 32;                       // 32 × 5 bits = 160-bit secret
  var KEY_RE = /^[0-9A-HJKMNP-TV-Z]{32}$/;

  /** New secret sync key from 20 random bytes. */
  function newKey(bytes) {
    if (!bytes || bytes.length < 20) throw new Error('need 20 random bytes');
    var bits = 0, value = 0, out = '';
    for (var i = 0; i < 20; i++) {
      value = (value << 8) | bytes[i]; bits += 8;
      while (bits >= 5) { out += ALPHA[(value >>> (bits - 5)) & 31]; bits -= 5; }
      value &= 0xff;
    }
    return out;
  }

  /** Accepts a key typed with spaces/dashes, in lower case, or a whole join link. Returns the key or null. */
  function parseKey(input) {
    var s = String(input == null ? '' : input).trim();
    var m = s.match(/[?&#]k=([^&#\s]+)/);
    if (m) { try { s = decodeURIComponent(m[1]); } catch (e) { s = m[1]; } }
    s = s.toUpperCase().replace(/[\s\-_.]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    return KEY_RE.test(s) ? s : null;
  }

  /** "ABCD-EFGH-…" for showing on screen. */
  function formatKey(key) { return String(key || '').replace(/(.{4})(?=.)/g, '$1-'); }

  function joinLink(base, key) {
    return String(base || '').replace(/#.*$/, '') + '#/sync?k=' + key;
  }

  function stamp(rec) {
    var t = rec && (rec.updatedAt || rec.createdAt);
    return t && !isNaN(Date.parse(t)) ? t : EPOCH;
  }
  function time(rec) { return Date.parse(stamp(rec)); }

  /** A demo question nobody has touched on this device (it exists on every device). */
  function untouchedDemo(rec) {
    return !!(rec && rec.isDemo && !rec.deletedAt && (Number(rec.rev) || 0) <= 1);
  }

  /** Should this local record be sent up when sync is first switched on? */
  function shouldUpload(rec) { return !!(rec && rec.id) && !untouchedDemo(rec); }

  /** Server row for a local record. */
  function toRow(kind, rec) {
    return { kind: kind, id: String(rec.id), data: rec, updated_at: new Date(time(rec)).toISOString(), deleted: !!rec.deletedAt };
  }

  /**
   * What to do with a record that came from the cloud.
   * 'apply' = save it here, 'push' = ours is newer (send ours), 'same' = nothing to do.
   */
  function decide(local, remote) {
    if (!remote) return 'same';
    if (!local) return 'apply';
    var a = time(remote), b = time(local);
    if (a > b) return 'apply';
    // the same demo question exists everywhere: any real change from elsewhere wins
    if (untouchedDemo(local) && !untouchedDemo(remote)) return 'apply';
    if (b > a) return untouchedDemo(local) ? 'same' : 'push';
    return 'same';
  }

  /** Split rows into requests: at most maxRows rows and about maxBytes each (a big row goes alone). */
  function batches(rows, maxRows, maxBytes) {
    maxRows = maxRows || 200; maxBytes = maxBytes || 1500000;
    var out = [], cur = [], size = 0;
    rows.forEach(function (r) {
      var n = JSON.stringify(r).length;
      if (cur.length && (cur.length >= maxRows || size + n > maxBytes)) { out.push(cur); cur = []; size = 0; }
      cur.push(r); size += n;
    });
    if (cur.length) out.push(cur);
    return out;
  }

  /**
   * Pull position. Rows are numbered when written, but a write that is still running can
   * become visible after a higher number was already seen. So the position only moves up to
   * a number seen at least `settle` ms before the current pull started — by then every lower
   * number has finished writing and this pull has read it. Rows read twice are skipped by decide().
   * pos = {cursor, seen: [{t, seq}]}; start/end = when this pull started/finished; maxSeq = highest seq it read.
   */
  var SETTLE = 60000;
  function advance(pos, start, end, maxSeq, settle) {
    settle = settle == null ? SETTLE : settle;
    var c = (pos && pos.cursor) || 0;
    var seen = ((pos && pos.seen) || []).map(function (o) { return { t: Math.min(o.t, end), seq: o.seq }; }); // clock moved back
    seen.forEach(function (o) { if (o.t <= start - settle && o.seq > c) c = o.seq; });
    seen = seen.filter(function (o) { return o.seq > c && o.t > start - settle; });
    if (maxSeq > c) seen.push({ t: end, seq: maxSeq });
    return { cursor: c, seen: seen.slice(-20) };
  }

  /** Turn a failed request into a status the screen can show. */
  function classify(status, body, online) {
    var code = body && body.code, msg = body && (body.message || body.msg) || '';
    if (status === 0) return online === false
      ? { kind: 'offline', retry: true, text: 'ઇન્ટરનેટ નથી — ફેરફાર આ ઉપકરણમાં સચવાયેલા છે, નેટ આવતાં જ મોકલાશે.' }
      : { kind: 'unreachable', retry: true, text: 'ક્લાઉડ સર્વર સુધી પહોંચાતું નથી. થોડી વારમાં ફરી પ્રયત્ન થશે.' };
    if (code === 'P0002' || /unknown sync key/i.test(msg)) return { kind: 'badkey', retry: false, text: 'આ સિંક કી ક્લાઉડમાં મળી નથી — કી ફરી તપાસો, અથવા સિંક બંધ કરીને ફરી ચાલુ કરો.' };
    if (code === '22023' && /sync key/i.test(msg)) return { kind: 'badkey', retry: false, text: 'સિંક કી ખોટી છે.' };
    if (status === 401 || status === 403) return { kind: 'config', retry: false, text: 'ક્લાઉડની ચાવી (API key) સ્વીકારાઈ નહીં — એપની નવી આવૃત્તિ લોડ કરો.' };
    if (status === 429 || code === '54000') return { kind: 'busy', retry: true, text: 'સર્વર વ્યસ્ત છે — થોડી વારમાં ફરી પ્રયત્ન થશે.' };
    if (status >= 500) return { kind: 'server', retry: true, text: 'ક્લાઉડ સર્વર અત્યારે જવાબ આપતું નથી (' + status + '). થોડી વારમાં ફરી પ્રયત્ન થશે.' };
    return { kind: 'error', retry: true, text: 'સિંકમાં ભૂલ: ' + (msg || ('HTTP ' + status)) };
  }

  /** Wait before the next try after n failures in a row: 5 s, 15 s, 45 s … up to 5 min. */
  function backoff(n) { return Math.min(300000, 5000 * Math.pow(3, Math.max(0, n - 1))); }

  return {
    KINDS: KINDS, KEY_LEN: KEY_LEN, newKey: newKey, parseKey: parseKey, formatKey: formatKey, joinLink: joinLink,
    stamp: stamp, untouchedDemo: untouchedDemo, shouldUpload: shouldUpload, toRow: toRow, decide: decide,
    batches: batches, SETTLE: SETTLE, advance: advance, classify: classify, backoff: backoff
  };
});
