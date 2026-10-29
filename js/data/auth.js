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

  function fromTokens(r) {
    var claims = decodeJwt(r.access_token) || {};
    var exp = Number(r.expires_at) || claims.exp || (Math.floor(Date.now() / 1000) + (Number(r.expires_in) || 3600));
    var u = r.user || {};
    var email = (u.email || claims.email || '').toLowerCase().trim();
    var meta = u.user_metadata || claims.user_metadata || {};
    var isAdmin = email === 'mahaanthakkar2008@gmail.com';
    var regUser = (QPG.approvals && QPG.approvals.getUser(email)) || {};

    return {
      access_token: r.access_token, refresh_token: r.refresh_token, expires_at: exp,
      user: {
        id: u.id || claims.sub,
        email: email,
        name: isAdmin ? 'મુખ્ય ઍડમિન (Admin)' : (meta.name || regUser.name || email.split('@')[0]),
        role: isAdmin ? 'admin' : 'teacher',
        approved: isAdmin ? true : (meta.approved === true || regUser.approved === true),
        subjects: isAdmin ? ['physics', 'maths', 'science'] : (regUser.subjects || meta.subjects || ['physics']),
        standards: isAdmin ? [8, 9, 10, 11, 12] : (regUser.standards || meta.standards || [11])
      }
    };
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
          var s = fromTokens(r); return save(s).then(function () { return s; });
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
        var s = fromTokens(h.tokens);
        var em = (s.user && s.user.email) ? s.user.email.toLowerCase().trim() : '';
        var isAdmin = em === 'mahaanthakkar2008@gmail.com';
        if (isAdmin) {
          return save(s).then(function () { return { type: h.type }; });
        }
        // Non-admin teacher: MUST BE APPROVED by admin!
        return (QPG.approvals ? QPG.approvals.checkRemote(em) : Promise.resolve(false))
          .then(function (isAppr) {
            if (!isAppr && !s.user.approved) {
              if (s.access_token) {
                try { call('POST', '/logout?scope=local', null, s.access_token); } catch (e) {}
              }
              session = null;
              return save(null).then(function () {
                return {
                  error: 'તમારું ઇમેઇલ સફળતાપૂર્વક ચકાસાયું છે! પરંતુ તમારું એકાઉન્ટ હજુ મુખ્ય ઍડમિન (mahaanthakkar2008@gmail.com) દ્વારા મંજૂર (Approve) કરવામાં આવ્યું નથી. ઍડમિન Approve કરશે તે પછી જ તમે લૉગિન કરી શકશો.'
                };
              });
            }
            s.user.approved = true;
            return save(s).then(function () { return { type: h.type }; });
          });
      }
      return QPG.db.getMeta('authSession').then(function (s) {
        if (s && s.user && s.user.email && s.user.email.toLowerCase().trim() !== 'mahaanthakkar2008@gmail.com') {
          var em = s.user.email.toLowerCase().trim();
          var isAppr = (QPG.approvals && QPG.approvals.isApproved(em, s.user));
          if (!isAppr) {
            session = null;
            return QPG.db.delMeta('authSession').then(function () {
              return { error: 'તમારું એકાઉન્ટ હજુ ઍડમિન દ્વારા મંજૂર (Approve) થયેલ નથી.' };
            });
          }
        }
        session = s || null;
        if (h && h.error) {
          return { error: h.error === 'otp_expired' ? 'ઇમેઇલની લિંક જૂની થઈ ગઈ છે — ફરી લૉગિન / પાસવર્ડ રીસેટ કરો.' : ('ઇમેઇલની લિંક ચાલી નહીં: ' + (h.text || h.error)) };
        }
        return {};
      });
    },

    session: function () { return session; },
    user: function () { return session ? session.user : null; },
    signedIn: function () { return !!(session && session.refresh_token); },
    onChange: function (fn) { subs.push(fn); },

    /** A fresh access token (renewed when it expires within a minute). */
    token: function (force) {
      if (!session) return Promise.reject(authError('session_not_found', MESSAGES.session_not_found));
      if (!force && session.expires_at * 1000 - Date.now() > 60000) return Promise.resolve(session.access_token);
      return refresh().then(function (s) { return s.access_token; });
    },

    signIn: function (email, password) {
      var em = String(email || '').trim().toLowerCase();
      var isAdmin = em === 'mahaanthakkar2008@gmail.com';

      return call('POST', '/token?grant_type=password', { email: em, password: password })
        .then(function (r) {
          if (!isAdmin) {
            return (QPG.approvals ? QPG.approvals.checkRemote(em) : Promise.resolve(false))
              .then(function (isAppr) {
                var metaAppr = r.user && r.user.user_metadata && r.user.user_metadata.approved === true;
                if (!isAppr && !metaAppr) {
                  if (r.access_token) {
                    try { call('POST', '/logout?scope=local', null, r.access_token); } catch (e) {}
                  }
                  throw authError('pending_approval', 'તમારું એકાઉન્ટ હજુ મુખ્ય ઍડમિન દ્વારા મંજૂર (Approve) કરવામાં આવ્યું નથી. કૃપા કરીને મુખ્ય ઍડમિન (mahaanthakkar2008@gmail.com) નો સંપર્ક કરો.');
                }
                var s = fromTokens(r);
                s.user.approved = true;
                return save(s).then(function () { return s; });
              });
          }
          var s = fromTokens(r);
          return save(s).then(function () { return s; });
        });
    },

    /** New account with selected subjects & standards. */
    signUp: function (email, password, extraData) {
      var redirect = appUrl();
      var em = String(email || '').trim().toLowerCase();
      var isAdmin = em === 'mahaanthakkar2008@gmail.com';
      var userMeta = Object.assign({
        name: extraData && extraData.name ? extraData.name : em.split('@')[0],
        subjects: extraData && extraData.subjects ? extraData.subjects : ['physics'],
        standards: extraData && extraData.standards ? extraData.standards : [11],
        approved: isAdmin ? true : false,
        role: isAdmin ? 'admin' : 'teacher'
      }, extraData || {});

      var body = {
        email: em,
        password: password,
        data: userMeta
      };

      return call('POST', '/signup' + (redirect ? '?redirect_to=' + encodeURIComponent(redirect) : ''), body)
        .then(function (r) {
          if (QPG.approvals) {
            QPG.approvals.registerPending(Object.assign({ email: em }, userMeta));
          }
          if (r.access_token) {
            if (!isAdmin && !userMeta.approved) {
              return { confirm: false, pendingApproval: true, email: em };
            }
            var s = fromTokens(r);
            return save(s).then(function () { return { session: s }; });
          }
          if (r.user && Array.isArray(r.user.identities) && !r.user.identities.length) throw authError('user_already_exists', MESSAGES.user_already_exists);
          if (r.id && Array.isArray(r.identities) && !r.identities.length) throw authError('user_already_exists', MESSAGES.user_already_exists);
          return { confirm: true, pendingApproval: !isAdmin, email: em };
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
