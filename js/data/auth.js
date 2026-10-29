/* Login with email + password (Supabase Auth), without extra libraries.
   The session (access token + refresh token) is kept on this device, so after one login the app
   opens straight away, also offline. The access token is renewed automatically before it expires.
   Email links (confirm signup, reset password) come back as #access_token=… in the address. */
(function (root) {
  'use strict';
  var QPG = root.QPG = root.QPG || {};

  var session = null;          // {access_token, refresh_token, expires_at (s), user: {id, email}}
  var refreshing = null;
  var hashResult = null;       // what the address carried when the page opened (email link)
  var subs = [];

  function cfg() { return QPG.config || {}; }
  function base() { return String(cfg().SUPABASE_URL || '').replace(/\/$/, '') + '/auth/v1'; }
  function appUrl() {
    var c = cfg().APP_URL;
    if (/^https?:$/.test(root.location && location.protocol)) return location.origin + location.pathname;
    return c || '';
  }

  function authError(code, text) { var e = new Error(text); e.auth = code; return e; }

  var MESSAGES = {
    invalid_credentials: 'ઇમેઇલ કે પાસવર્ડ ખોટો છે.',
    email_not_confirmed: 'ઇમેઇલ હજુ ચકાસાયો નથી — તમારા ઇમેઇલમાં આવેલી લિંક ખોલો (Spam પણ જુઓ).',
    user_already_exists: 'આ ઇમેઇલથી એકાઉન્ટ પહેલેથી છે — "લૉગિન" કરો.',
    email_exists: 'આ ઇમેઇલથી એકાઉન્ટ પહેલેથી છે — "લૉગિન" કરો.',
    weak_password: 'પાસવર્ડ નબળો છે — ઓછામાં ઓછા 8 અક્ષર, અક્ષર અને અંક બંને રાખો.',
    over_email_send_rate_limit: 'થોડી વારમાં બહુ ઇમેઇલ મોકલાયા — એક કલાક પછી ફરી પ્રયત્ન કરો.',
    over_request_rate_limit: 'બહુ પ્રયત્ન થયા — થોડી મિનિટ પછી ફરી પ્રયત્ન કરો.',
    signup_disabled: 'નવાં એકાઉન્ટ બંધ છે — તમારા એકાઉન્ટથી લૉગિન કરો.',
    email_address_invalid: 'ઇમેઇલ સરનામું બરાબર નથી.',
    validation_failed: 'ઇમેઇલ કે પાસવર્ડ બરાબર નથી.',
    same_password: 'નવો પાસવર્ડ જૂના જેવો જ છે — બીજો પાસવર્ડ રાખો.',
    refresh_token_not_found: 'લૉગિન પૂરું થઈ ગયું છે — ફરી લૉગિન કરો.',
    session_not_found: 'લૉગિન પૂરું થઈ ગયું છે — ફરી લૉગિન કરો.'
  };

  /** One call to Supabase Auth. Resolves to JSON; rejects with a Gujarati message (err.auth = code). */
  function call(method, path, body, token) {
    var headers = { apikey: cfg().SUPABASE_KEY, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    var f = QPG.authTransport || function (url, init) {
      return fetch(url, init).then(function (res) {
        return res.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; } return { status: res.status, body: j }; });
      });
    };
    return f(base() + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
      .then(function (r) {
        if (r.status >= 200 && r.status < 300) return r.body || {};
        var b = r.body || {};
        var code = b.error_code || b.code || b.error || ('http_' + r.status);
        if (code === 'invalid_grant' && /refresh/i.test(b.error_description || b.msg || '')) code = 'refresh_token_not_found';
        throw authError(code, MESSAGES[code] || ('લૉગિનમાં ભૂલ: ' + (b.msg || b.message || b.error_description || ('HTTP ' + r.status))));
      }, function (e) {
        if (e && e.auth) throw e;
        throw authError('network', (root.navigator && navigator.onLine === false) ? 'ઇન્ટરનેટ નથી — લૉગિન માટે ઇન્ટરનેટ જોઈએ.' : 'સર્વર સુધી પહોંચાતું નથી — થોડી વારમાં ફરી પ્રયત્ન કરો.');
      });
  }

  /* ---- reading the user from the token ---- */
  function decodeJwt(t) {
    try {
      var p = String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (p.length % 4) p += '=';
      var bin = atob(p), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) { return null; }
  }

  /** Session from the token answer. Who the user is (approved, admin, subjects) comes from the server: see profile. */
  function fromTokens(r, profile) {
    var claims = decodeJwt(r.access_token) || {};
    var exp = Number(r.expires_at) || claims.exp || (Math.floor(Date.now() / 1000) + (Number(r.expires_in) || 3600));
    var u = r.user || {};
    return {
      access_token: r.access_token, refresh_token: r.refresh_token, expires_at: exp,
      user: { id: u.id || claims.sub, email: String(u.email || claims.email || '').toLowerCase().trim() },
      profile: profile || null
    };
  }

  var PENDING_TEXT = 'તમારું એકાઉન્ટ હજુ ઍડમિન દ્વારા મંજૂર (Approve) થયું નથી. ઍડમિન મંજૂર કરે પછી ફરી લૉગિન કરો.';

  /** Call a database function as this user → {status, body}. Tests replace QPG.syncTransport. */
  function rest(name, body, token) {
    if (QPG.syncTransport) return QPG.syncTransport(name, body, token).catch(function () { return { status: 0, body: null }; });
    return fetch(String(cfg().SUPABASE_URL).replace(/\/$/, '') + '/rest/v1/rpc/' + name, {
      method: 'POST', cache: 'no-store',
      headers: { apikey: cfg().SUPABASE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (res) {
      return res.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; } return { status: res.status, body: j }; });
    }, function () { return { status: 0, body: null }; });
  }

  function fetchProfile(token) {
    return rest('my_profile', {}, token).then(function (r) {
      if (r.status >= 200 && r.status < 300 && r.body) return r.body;
      if (r.status === 0) throw authError('network', 'સર્વર સુધી પહોંચાતું નથી — ઇન્ટરનેટ તપાસીને ફરી પ્રયત્ન કરો.');
      throw authError('profile', 'એકાઉન્ટની માહિતી મળી નહીં (' + r.status + ').');
    });
  }

  /** Tokens → check approval with the server → save. Not approved: end that login and say so. */
  function accept(r) {
    return fetchProfile(r.access_token).then(function (p) {
      if (!p.approved) {
        call('POST', '/logout?scope=local', null, r.access_token).catch(function () {});
        throw authError('pending_approval', PENDING_TEXT);
      }
      var s = fromTokens(r, p);
      return save(s).then(function () { return s; });
    });
  }

  function save(s) {
    session = s;
    subs.forEach(function (fn) { try { fn(s); } catch (e) { /* ignore */ } });
    return s ? QPG.db.setMeta('authSession', s) : QPG.db.delMeta('authSession');
  }

  function withLock(name, fn) {
    if (root.navigator && navigator.locks && navigator.locks.request) return navigator.locks.request(name, fn);
    return fn();
  }

  /** Renew the access token. Another tab may have just renewed it, so re-read the stored session first. */
  function refresh() {
    if (refreshing) return refreshing;
    refreshing = withLock('qpg-auth', function () {
      return QPG.db.getMeta('authSession').then(function (stored) {
        if (stored && stored.access_token !== (session && session.access_token) && stored.expires_at * 1000 - Date.now() > 60000) {
          session = stored; return stored;
        }
        var rt = (stored || session || {}).refresh_token;
        if (!rt) throw authError('session_not_found', MESSAGES.session_not_found);
        return call('POST', '/token?grant_type=refresh_token', { refresh_token: rt }).then(function (r) {
          var s = fromTokens(r, (stored || session || {}).profile); return save(s).then(function () { return s; });
        });
      });
    }).finally(function () { refreshing = null; });
    return refreshing;
  }

  /* ---- the address after an email link: #access_token=…&type=signup|recovery, or #error=… ---- */
  function consumeHash() {
    if (hashResult || !root.location) return hashResult;
    var h = (location.hash || '').replace(/^#/, '');
    if (!/(^|&)(access_token|error_code|error)=/.test(h)) return null;
    var p = {};
    h.split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) { try { p[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) { p[kv.slice(0, i)] = kv.slice(i + 1); } } });
    hashResult = p.access_token ? { tokens: p, type: p.type || '' } : { error: p.error_code || p.error, text: p.error_description || '' };
    try { history.replaceState(null, '', location.pathname + location.search + '#/'); } catch (e) { /* ignore */ }
    return hashResult;
  }

  var auth = {
    consumeHash: consumeHash,
    MESSAGES: MESSAGES,

    /** At start: load the saved session, or take the one an email link brought. Resolves to {type?, error?}. */
    init: function () {
      var h = consumeHash();
      if (h && h.tokens) {
        return accept(h.tokens).then(function () { return { type: h.type }; }, function (e) {
          session = null;
          return save(null).then(function () {
            return { error: e.auth === 'pending_approval' ? 'તમારો ઇમેઇલ ચકાસાઈ ગયો છે. ' + PENDING_TEXT : e.message };
          });
        });
      }
      return QPG.db.getMeta('authSession').then(function (s) {
        session = s && s.refresh_token ? s : null;
        if (h && h.error) {
          return { error: h.error === 'otp_expired' ? 'ઇમેઇલની લિંક જૂની થઈ ગઈ છે — ફરી લૉગિન / પાસવર્ડ રીસેટ કરો.' : ('ઇમેઇલની લિંક ચાલી નહીં: ' + (h.text || h.error)) };
        }
        return {};
      });
    },

    /**
     * Ask the server again who this user is (approval can be taken back, subjects can change).
     * Resolves to 'ok' | 'revoked' | 'offline'. On 'revoked' the session is removed.
     */
    refreshProfile: function () {
      if (!session) return Promise.resolve('offline');
      return auth.token().then(fetchProfile).then(function (p) {
        if (!p.approved) return save(null).then(function () { return 'revoked'; });
        session.profile = p;
        return save(session).then(function () { return 'ok'; });
      }, function (e) {
        if (e && (e.auth === 'refresh_token_not_found' || e.auth === 'session_not_found')) return save(null).then(function () { return 'revoked'; });
        return 'offline';
      });
    },

    /** Call a database function as the logged-in user. Resolves to its answer, rejects with a message. */
    rpc: function (name, body) {
      var once = function (force) { return auth.token(force).then(function (t) { return rest(name, body, t); }); };
      return once(false).then(function (r) { return r.status === 401 ? once(true) : r; }).then(function (r) {
        if (r.status >= 200 && r.status < 300) return r.body;
        if (r.status === 0) throw authError('network', 'ઇન્ટરનેટ નથી — થોડી વાર પછી ફરી પ્રયત્ન કરો.');
        var m = (r.body && (r.body.message || r.body.hint)) || ('HTTP ' + r.status);
        throw authError(r.body && r.body.code || 'http_' + r.status, m === 'admin only' ? 'આ કામ ફક્ત ઍડમિન કરી શકે.' : m);
      });
    },

    PENDING_TEXT: PENDING_TEXT,
    session: function () { return session; },
    /** {id, email, name, isAdmin, approved, subjects, standards} — from the server profile. */
    user: function () {
      if (!session) return null;
      var p = session.profile || {}, u = session.user || {};
      return {
        id: u.id, email: u.email, name: p.name || (u.email || '').split('@')[0],
        isAdmin: !!p.is_admin, role: p.is_admin ? 'admin' : 'teacher', approved: !!p.approved,
        subjects: Array.isArray(p.subjects) ? p.subjects : [], standards: Array.isArray(p.standards) ? p.standards.map(Number) : []
      };
    },
    signedIn: function () { return !!(session && session.refresh_token); },
    onChange: function (fn) { subs.push(fn); },

    /** A fresh access token (renewed when it expires within a minute). */
    token: function (force) {
      if (!session) return Promise.reject(authError('session_not_found', MESSAGES.session_not_found));
      if (!force && session.expires_at * 1000 - Date.now() > 60000) return Promise.resolve(session.access_token);
      return refresh().then(function (s) { return s.access_token; });
    },

    signIn: function (email, password) {
      return call('POST', '/token?grant_type=password', { email: String(email || '').trim().toLowerCase(), password: password }).then(accept);
    },

    /**
     * New teacher account. The name, subjects and standards go to the admin for approval.
     * Resolves {confirm: true} (email link sent) or {pendingApproval: true}.
     */
    signUp: function (email, password, extra) {
      var redirect = appUrl();
      extra = extra || {};
      var body = {
        email: String(email || '').trim().toLowerCase(), password: password,
        data: { name: extra.name || '', subjects: extra.subjects || [], standards: extra.standards || [] }
      };
      return call('POST', '/signup' + (redirect ? '?redirect_to=' + encodeURIComponent(redirect) : ''), body)
        .then(function (r) {
          if (r.user && Array.isArray(r.user.identities) && !r.user.identities.length) throw authError('user_already_exists', MESSAGES.user_already_exists);
          if (r.id && Array.isArray(r.identities) && !r.identities.length) throw authError('user_already_exists', MESSAGES.user_already_exists);
          if (r.access_token) {
            return accept(r).then(function (s) { return { session: s }; }, function (e) {
              if (e.auth === 'pending_approval') return { pendingApproval: true };
              throw e;
            });
          }
          return { confirm: true };
        });
    },

    /** Email with a link to set a new password. */
    recover: function (email) {
      var redirect = appUrl();
      return call('POST', '/recover' + (redirect ? '?redirect_to=' + encodeURIComponent(redirect) : ''), { email: String(email).trim() });
    },

    updatePassword: function (password) {
      return auth.token().then(function (t) { return call('PUT', '/user', { password: password }, t); });
    },

    /** Log out on this device (the server session ends too when online). */
    signOut: function () {
      var t = session && session.access_token;
      var done = function () { return save(null); };
      if (!t) return done();
      return call('POST', '/logout?scope=local', null, t).then(done, done);
    }
  };

  QPG.auth = auth;
})(typeof self !== 'undefined' ? self : this);
