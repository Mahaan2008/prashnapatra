/* Settings: paper formats (templates), backup / restore, demo questions, app details. */
(function (root) {
  'use strict';
  var QPG = root.QPG;
  QPG.views = QPG.views || {};
  var esc = function (s) { return QPG.questionHtml.esc(s); };
  var icon = function (n) { return QPG.ui.icon(n); };

  function templatePanel(t) {
    var h = t.header;
    var f = function (k, lbl, val, ph) {
      return '<label class="field"><span class="lbl">' + lbl + '</span><input class="input" data-tk="' + k + '" value="' + esc(val || '') + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '></label>';
    };
    var logo = function (k, lbl) {
      return '<div class="field"><span class="lbl">' + lbl + '</span><div class="thumb">' +
        (h[k] ? '<img src="' + esc(h[k]) + '" alt="" style="max-width:64px;max-height:64px"><button type="button" class="btn btn-sm btn-quiet" data-logo-del="' + k + '">કાઢો</button>' : '<span class="hint">લોગો નથી</span>') +
        '<label class="btn btn-sm">' + icon('image') + 'પસંદ કરો<input type="file" accept="image/*" data-logo="' + k + '" hidden></label></div></div>';
    };
    return '<section class="panel tpl-panel" data-tpl="' + esc(t.id) + '"><h2>' + esc(t.name) + '</h2>' +
      '<div class="row row-3">' +
        f('h.institute', 'સંસ્થાનું નામ (બૉક્સમાં)', h.institute) +
        f('h.topText', 'ઉપરની પટ્ટીમાં', h.topText) + f('h.bottomText', 'નીચેની પટ્ટીમાં', h.bottomText) +
        f('h.watermark', 'વૉટરમાર્ક (ત્રાંસું ઝાંખું લખાણ)', h.watermark) +
        f('h.subjectLabel', 'વિષય (પેપર પર)', h.subjectLabel) +
        f('duration', 'સમય', t.duration, t.style === 'maths' ? 'ખાલી = નહીં છપાય' : '') +
        (t.style === 'maths' ? f('examName', 'પરીક્ષાનું નામ', t.examName) + f('paperLabel', 'પેપર લેબલ', t.paperLabel) : '') +
        f('closing', 'છેલ્લે લખાણ', t.closing, 'દા.ત. || ALL THE BEST ||') +
        logo('logoLeft', 'ડાબો લોગો') + logo('logoRight', 'જમણો લોગો') +
      '</div><div style="display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap">' +
        '<button type="button" class="btn btn-primary" data-act="tpl-save">આ ફોર્મેટ સાચવો</button>' +
        '<span class="hint" style="color:var(--muted);font-size:14px">નવાં પેપરમાં લાગુ થશે. બનેલાં પેપરની વિગત પેપરમાં જ બદલી શકાય છે.</span></div></section>';
  }

  /* ---------- account + automatic sync ---------- */
  var STATUS_TEXT = {
    ok: 'ચાલુ — બધું સિંક થયેલું છે', syncing: 'સિંક થાય છે…', offline: 'ઑફલાઇન — નેટ આવતાં જ સિંક થશે',
    error: 'અટક્યું — ફરી પ્રયત્ન થશે', signedout: 'ફરી લૉગિન કરવું પડશે', off: 'બંધ'
  };

  function accountPanel() {
    return '<section class="panel" data-account-panel><h2>તમારું એકાઉન્ટ અને આપોઆપ સિંક</h2><div data-account-body></div></section>';
  }

  function drawAccount(box, s) {
    var u = QPG.auth.user();
    if (!QPG.sync.available() || !u) {
      box.innerHTML = '<p style="margin:0">' + (root.QPG_PREVIEW ? 'આ નમૂના (preview) માં લૉગિન અને સિંક બંધ છે.' : 'લૉગિન કર્યું નથી.') + '</p>';
      return;
    }
    var state = '<dl class="kv">' +
      '<dt>લૉગિન</dt><dd><b>' + esc(u.email) + '</b></dd>' +
      '<dt>સિંક</dt><dd><b>' + esc(STATUS_TEXT[s.status] || s.status) + '</b>' + (s.text && s.status !== 'ok' ? '<br><span style="font-size:14px">' + esc(s.text) + '</span>' : '') + '</dd>' +
      '<dt>છેલ્લું સિંક</dt><dd>' + (s.lastAt ? esc(new Date(s.lastAt).toLocaleString('gu-IN', { dateStyle: 'medium', timeStyle: 'short' })) : 'હજુ થયું નથી') + '</dd>' +
      '<dt>મોકલવાના બાકી ફેરફાર</dt><dd>' + (s.pending || 0) + '</dd></dl>';
    var stateBox = box.querySelector('[data-account-state]');
    if (stateBox) { stateBox.innerHTML = state; return; }
    box.innerHTML = '<div data-account-state>' + state + '</div>' +
      '<p style="margin:4px 0 14px;font-size:14.5px;color:var(--muted)">બીજા ફોન કે કમ્પ્યુટરમાં એપ ખોલી આ જ ઇમેઇલ અને પાસવર્ડથી લૉગિન કરો — તમારો બધો ડેટા આપોઆપ આવી જશે.</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button type="button" class="btn btn-primary" data-act="sync-now">' + icon('ok') + 'હમણાં સિંક કરો</button>' +
        '<button type="button" class="btn" data-act="pw-open">પાસવર્ડ બદલો</button>' +
        '<button type="button" class="btn btn-danger" data-act="logout">લૉગઆઉટ</button></div>' +
      '<form data-pw-form hidden style="margin-top:14px;max-width:420px">' +
        '<label class="field"><span class="lbl">નવો પાસવર્ડ (ઓછામાં ઓછા 8 અક્ષર)</span><input class="input" type="password" name="pw" autocomplete="new-password" minlength="8" required></label>' +
        '<label class="field"><span class="lbl">ફરી લખો</span><input class="input" type="password" name="pw2" autocomplete="new-password" minlength="8" required></label>' +
        '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-primary btn-sm">પાસવર્ડ સાચવો</button><button type="button" class="btn btn-quiet btn-sm" data-act="pw-close">રદ કરો</button></div>' +
        '<div data-pw-msg style="margin-top:8px"></div></form>';
  }

  /** Log out on this device: send what is waiting, then remove this device's copy. */
  QPG.app_logout = function () {
    return QPG.sync.flush().then(function (left) {
      if (!left) return true;
      return QPG.ui.confirmDialog({
        title: left + ' ફેરફાર હજુ ક્લાઉડમાં ગયા નથી',
        body: 'ઇન્ટરનેટ ચાલુ કરીને થોડી વાર પછી લૉગઆઉટ કરો, નહીં તો આ ફેરફાર જતા રહેશે. છતાં લૉગઆઉટ કરવું છે?',
        ok: 'હા, લૉગઆઉટ', danger: true
      });
    }).then(function (yes) {
      if (!yes) return false;
      return QPG.auth.signOut().then(function () { return QPG.sync.signOut(); }).then(function () { location.reload(); return true; });
    });
  };

  function accountClick(a, b, el) {
    if (a === 'sync-now') { b.disabled = true; QPG.sync.now().then(function () { b.disabled = false; }); return true; }
    if (a === 'pw-open') { el.querySelector('[data-pw-form]').hidden = false; el.querySelector('[data-pw-form] [name=pw]').focus(); return true; }
    if (a === 'pw-close') { el.querySelector('[data-pw-form]').hidden = true; return true; }
    if (a === 'logout') {
      QPG.ui.confirmDialog({ title: 'આ ઉપકરણમાંથી લૉગઆઉટ કરવું છે?', body: 'આ ઉપકરણમાંથી ડેટા નીકળી જશે, પણ ક્લાઉડમાં સલામત રહેશે. ફરી લૉગિન કરતાં પાછો આવી જશે.', ok: 'લૉગઆઉટ', danger: true })
        .then(function (yes) { if (yes) { b.disabled = true; QPG.app_logout().then(function (done) { if (!done) b.disabled = false; }); } });
      return true;
    }
    return false;
  }

  function passwordSubmit(form, onDone) {
    var msg = form.querySelector('[data-pw-msg]'), pw = form.pw.value, pw2 = form.pw2.value;
    var show = function (cls, t) { msg.innerHTML = '<div class="notice notice-' + cls + '">' + icon(cls === 'error' ? 'error' : 'ok') + '<div>' + esc(t) + '</div></div>'; };
    if (pw.length < 8) return show('error', 'પાસવર્ડ ઓછામાં ઓછા 8 અક્ષરનો રાખો.');
    if (pw !== pw2) return show('error', 'બંને પાસવર્ડ સરખા નથી.');
    var btn = form.querySelector('button:not([type=button])'); btn.disabled = true;
    QPG.auth.updatePassword(pw).then(function () { form.reset(); onDone(); }, function (e) { show('error', e.message || String(e)); })
      .finally(function () { btn.disabled = false; });
  }

  /* ---------- login screen ---------- */
  QPG.views.login = function (el, ctx) {
    var mode = 'login';
    var note = (ctx && ctx.query && ctx.query.msg) || '';
    function draw(message) {
      var signup = mode === 'signup', forgot = mode === 'forgot';
      el.innerHTML = '<div class="auth-wrap"><div class="auth-card panel">' +
        '<div class="auth-brand"><div class="brand-name" style="font-size:28px">પ્રશ્નપત્ર</div></div>' +
        '<h1>' + (signup ? 'નવું એકાઉન્ટ બનાવો' : forgot ? 'પાસવર્ડ ભૂલી ગયા' : 'લૉગિન') + '</h1>' +
        '<p class="auth-lead">' + (signup ? 'એક જ એકાઉન્ટથી ફોન અને લેપટોપ બંનેમાં તમારા પ્રશ્નો આપોઆપ સરખા રહેશે.'
          : forgot ? 'તમારો ઇમેઇલ લખો — નવો પાસવર્ડ બનાવવાની લિંક મોકલીશું.'
          : 'તમારા ઇમેઇલ અને પાસવર્ડથી લૉગિન કરો — તમારો બધો ડેટા આપોઆપ આવી જશે.') + '</p>' +
        (message || note ? '<div data-auth-msg>' + (message || '<div class="notice notice-error" style="background:#fef2f2;color:#991b1b;border:1px solid #f87171;padding:12px;border-radius:6px;line-height:1.5;display:flex;align-items:flex-start;gap:8px">' + icon('error') + '<div>' + esc(note) + '</div></div>') + '</div>' : '<div data-auth-msg></div>') +
        '<form data-auth-form novalidate>' +
          (signup ? '<label class="field"><span class="lbl">શિક્ષકનું પૂરું નામ</span><input class="input" type="text" name="name" placeholder="દા.ત. રમેશભાઈ પટેલ" required></label>' : '') +
          '<label class="field"><span class="lbl">ઇમેઇલ</span><input class="input" type="email" name="email" autocomplete="email" inputmode="email" required></label>' +
          (signup ?
            '<div class="field"><span class="lbl" style="font-weight:600;margin-bottom:6px;display:block">વિષય પસંદ કરો (એક અથવા વધુ પસંદ કરી શકો છો)</span>' +
              '<div style="display:flex;gap:14px;margin-top:6px;flex-wrap:wrap">' +
                '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" name="subject" value="physics" checked> <span>ભૌતિક વિજ્ઞાન (Physics)</span></label>' +
                '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" name="subject" value="maths" checked> <span>ગણિત (Maths)</span></label>' +
                '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" name="subject" value="science" checked> <span>વિજ્ઞાન (Science)</span></label>' +
              '</div></div>' +
            '<div class="field" style="margin-top:10px"><span class="lbl" style="font-weight:600;margin-bottom:6px;display:block">ધોરણ પસંદ કરો (એક અથવા વધુ પસંદ કરી શકો છો)</span>' +
              '<div style="display:flex;gap:12px;margin-top:6px;flex-wrap:wrap">' +
                '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" name="std" value="8"> <span>ધોરણ 8</span></label>' +
                '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" name="std" value="9"> <span>ધોરણ 9</span></label>' +
                '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" name="std" value="10" checked> <span>ધોરણ 10</span></label>' +
                '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" name="std" value="11" checked> <span>ધોરણ 11</span></label>' +
                '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" name="std" value="12" checked> <span>ધોરણ 12</span></label>' +
              '</div></div>'
          : '') +
          (forgot ? '' :
          '<label class="field"><span class="lbl">પાસવર્ડ' + (signup ? ' (ઓછામાં ઓછા 8 અક્ષર)' : '') + '</span><input class="input" type="password" name="pw" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" required></label>') +
          (signup ? '<label class="field"><span class="lbl">પાસવર્ડ ફરી લખો</span><input class="input" type="password" name="pw2" autocomplete="new-password" required></label>' : '') +
          (forgot ? '' : '<label class="auth-show"><input type="checkbox" data-show-pw> પાસવર્ડ બતાવો</label>') +
          '<button class="btn btn-primary auth-submit">' + (signup ? 'એકાઉન્ટ બનાવો' : forgot ? 'લિંક મોકલો' : 'લૉગિન') + '</button>' +
        '</form>' +
        '<div class="auth-links">' +
          (mode !== 'login' ? '<button type="button" class="linkish" data-mode="login">લૉગિન પર પાછા જાઓ</button>' : '') +
          (mode === 'login' ? '<button type="button" class="linkish" data-mode="forgot">પાસવર્ડ ભૂલી ગયા?</button><button type="button" class="linkish" data-mode="signup">નવું એકાઉન્ટ બનાવો</button>' : '') +
        '</div></div></div>';
      var first = el.querySelector('[name=name]') || el.querySelector('[name=email]'); if (first) first.focus();
    }
    function show(cls, text) {
      el.querySelector('[data-auth-msg]').innerHTML = '<div class="notice notice-' + cls + '">' + icon(cls === 'error' ? 'error' : cls === 'ok' ? 'ok' : 'info') + '<div>' + esc(text) + '</div></div>';
    }
    draw();
    el.addEventListener('click', function (e) {
      var m = e.target.closest('[data-mode]');
      if (m) { var email = (el.querySelector('[name=email]') || {}).value || ''; mode = m.getAttribute('data-mode'); note = ''; draw(); el.querySelector('[name=email]').value = email; }
    });
    el.addEventListener('change', function (e) {
      if (e.target.hasAttribute('data-show-pw')) el.querySelectorAll('input[name=pw], input[name=pw2]').forEach(function (i) { i.type = e.target.checked ? 'text' : 'password'; });
    });
    el.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, email = f.email.value.trim(), btn = f.querySelector('.auth-submit');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return show('error', 'ઇમેઇલ સરનામું બરાબર લખો.');
      if (mode === 'forgot') {
        btn.disabled = true;
        return QPG.auth.recover(email).then(function () { show('ok', email + ' પર લિંક મોકલી છે. ઇમેઇલમાં લિંક ખોલી નવો પાસવર્ડ બનાવો (Spam ફોલ્ડર પણ જુઓ).'); },
          function (err) { show('error', err.message); }).finally(function () { btn.disabled = false; });
      }
      var pw = f.pw.value;
      if (!pw) return show('error', 'પાસવર્ડ લખો.');
      if (mode === 'signup') {
        var name = (f.name && f.name.value.trim()) || '';
        if (!name) return show('error', 'કૃપા કરીને શિક્ષકનું પૂરું નામ લખો.');
        var subEls = f.querySelectorAll('input[name=subject]:checked');
        var subjects = Array.from(subEls).map(function (c) { return c.value; });
        if (!subjects.length) return show('error', 'ઓછામાં ઓછો એક વિષય પસંદ કરવો જરૂરી છે.');
        var stdEls = f.querySelectorAll('input[name=std]:checked');
        var standards = Array.from(stdEls).map(function (c) { return parseInt(c.value, 10); });
        if (!standards.length) return show('error', 'ઓછામાં ઓછું એક ધોરણ પસંદ કરવું જરૂરી છે.');

        if (pw.length < 8) return show('error', 'પાસવર્ડ ઓછામાં ઓછા 8 અક્ષરનો રાખો.');
        if (pw !== f.pw2.value) return show('error', 'બંને પાસવર્ડ સરખા નથી.');
        btn.disabled = true;
        return QPG.auth.signUp(email, pw, { name: name, subjects: subjects, standards: standards }).then(function (r) {
          if (r.session) return QPG.app.afterLogin();
          mode = 'login';
          draw('<div class="notice notice-ok">' + icon('ok') + '<div><b>એકાઉન્ટ નોંધાઈ ગયું.</b><br>' +
            (r.confirm ? '1) <b>' + esc(email) + '</b> પર આવેલા ઇમેઇલમાં <b>Confirm your mail</b> લિંક ખોલો (Spam પણ જુઓ).<br>2) ' : '') +
            'ઍડમિન તમારું એકાઉન્ટ મંજૂર (Approve) કરે પછી અહીં લૉગિન કરી શકશો.</div></div>');
          el.querySelector('[name=email]').value = email;
        }, function (err) { show('error', err.message); btn.disabled = false; });
      }
      btn.disabled = true; btn.textContent = 'લૉગિન થાય છે…';
      QPG.auth.signIn(email, pw).then(function () { return QPG.app.afterLogin(); }, function (err) {
        show('error', err.message); btn.disabled = false; btn.textContent = 'લૉગિન';
      });
    });
  };

  /* ---------- after the "reset password" email link ---------- */
  QPG.views.setPassword = function (el) {
    el.innerHTML = '<div class="auth-wrap"><div class="auth-card panel"><h1>નવો પાસવર્ડ બનાવો</h1>' +
      '<p class="auth-lead">' + esc((QPG.auth.user() || {}).email || '') + '</p>' +
      '<form data-pw-form><label class="field"><span class="lbl">નવો પાસવર્ડ (ઓછામાં ઓછા 8 અક્ષર)</span><input class="input" type="password" name="pw" autocomplete="new-password" required></label>' +
      '<label class="field"><span class="lbl">ફરી લખો</span><input class="input" type="password" name="pw2" autocomplete="new-password" required></label>' +
      '<button class="btn btn-primary auth-submit">પાસવર્ડ સાચવો</button><div data-pw-msg style="margin-top:10px"></div></form></div></div>';
    el.addEventListener('submit', function (e) {
      e.preventDefault();
      passwordSubmit(e.target, function () { QPG.ui.toast('નવો પાસવર્ડ સચવાયો'); QPG.app.go('/'); });
    });
  };

  /* ---------- admin: teachers and their approval (server) ---------- */
  var SUBJECT_OPTS = [['physics', 'ભૌતિકવિજ્ઞાન (Physics)'], ['maths', 'ગણિત (Maths)'], ['science', 'વિજ્ઞાન (Science)']];
  var STD_OPTS = [8, 9, 10, 11, 12];
  function subjectName(s) { return s === 'physics' ? 'Physics' : s === 'maths' ? 'ગણિત' : s === 'science' ? 'વિજ્ઞાન' : s; }
  function checks(name, opts, chosen) {
    return '<div class="chk-row">' + opts.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, label = Array.isArray(o) ? o[1] : 'ધોરણ ' + o;
      return '<label><input type="checkbox" name="' + name + '" value="' + v + '"' + (chosen.indexOf(v) >= 0 ? ' checked' : '') + '> ' + esc(label) + '</label>';
    }).join('') + '</div>';
  }

  function adminApprovalsPanel() {
    if (!QPG.app.isAdmin() || !QPG.auth.user()) return '';
    return '<section class="panel admin-panel" data-admin-panel>' +
      '<div class="admin-head"><h2>શિક્ષકો અને મંજૂરી (ઍડમિન)</h2>' +
        '<button type="button" class="btn btn-sm btn-quiet" data-act="admin-refresh-teachers">ફરી લાવો</button></div>' +
      '<p style="margin-top:0">નવા શિક્ષક સાઇન-અપ કરે એટલે અહીં "મંજૂરી બાકી" માં દેખાય છે. મંજૂર કરેલા શિક્ષક જ લૉગિન અને સિંક કરી શકે છે — આ નિયમ સર્વર પર લાગુ છે.</p>' +
      '<div data-admin-list><p style="color:var(--muted)">શિક્ષકોની યાદી આવે છે…</p></div>' +
      '<details class="admin-add"><summary>નવો શિક્ષક અગાઉથી ઉમેરો (સાઇન-અપ કરતાં જ મંજૂર)</summary>' +
        '<div class="row row-2" style="margin-top:10px">' +
          '<label class="field"><span class="lbl">શિક્ષકનું નામ</span><input class="input" id="admin-add-name" placeholder="દા.ત. રમેશભાઈ પટેલ"></label>' +
          '<label class="field"><span class="lbl">શિક્ષકનું ઇમેઇલ</span><input class="input" type="email" id="admin-add-email" placeholder="teacher@gmail.com"></label>' +
        '</div>' +
        '<span class="lbl">વિષય</span>' + checks('adm-sub', SUBJECT_OPTS, ['physics']) +
        '<span class="lbl">ધોરણ</span>' + checks('adm-std', STD_OPTS, [11, 12]) +
        '<button type="button" class="btn btn-primary btn-sm" data-act="admin-add-teacher" style="margin-top:10px">ઉમેરો અને મંજૂર કરો</button>' +
      '</details></section>';
  }

  function drawTeachers(box, list) {
    if (!list.length) { box.innerHTML = '<div class="empty-mini">હજુ કોઈ શિક્ષકે સાઇન-અપ કર્યું નથી.</div>'; return; }
    var pending = list.filter(function (t) { return !t.approved; }).length;
    box.innerHTML = (pending ? '<div class="notice notice-demo">' + icon('warn') + '<div><b>' + pending + '</b> શિક્ષક મંજૂરીની રાહ જુએ છે.</div></div>' : '') +
      '<ul class="teacher-list">' + list.map(function (t) {
        var state = t.approved ? '<span class="tag tag-ok">મંજૂર</span>' : '<span class="tag tag-wait">મંજૂરી બાકી</span>';
        var note = !t.registered ? 'હજુ સાઇન-અપ કર્યું નથી' : (!t.confirmed ? 'ઇમેઇલ હજુ ચકાસ્યો નથી' : '');
        return '<li data-teacher="' + esc(t.email) + '">' +
          '<div class="t-main"><b>' + esc(t.name) + '</b> ' + state + '<br><small>' + esc(t.email) + (note ? ' · ' + esc(note) : '') + '</small>' +
            '<div class="t-perm">' + esc(t.subjects.map(subjectName).join(', ') || '—') + ' · ધોરણ ' + esc(t.standards.join(', ') || '—') + '</div></div>' +
          '<div class="t-acts">' +
            (t.approved ? '<button type="button" class="btn btn-sm" data-admin-act="revoke">મંજૂરી રદ</button>'
                        : '<button type="button" class="btn btn-sm btn-primary" data-admin-act="approve">' + icon('ok') + 'મંજૂર કરો</button>') +
            '<button type="button" class="btn btn-sm btn-quiet" data-admin-act="edit">વિષય / ધોરણ</button>' +
            '<button type="button" class="btn btn-sm btn-quiet" data-admin-act="delete" style="color:var(--red)">કાઢો</button>' +
          '</div>' +
          '<div class="t-edit" hidden><span class="lbl">વિષય</span>' + checks('ed-sub', SUBJECT_OPTS, t.subjects) +
            '<span class="lbl">ધોરણ</span>' + checks('ed-std', STD_OPTS, t.standards) +
            '<button type="button" class="btn btn-sm btn-primary" data-admin-act="save-perm">સાચવો</button></div>' +
        '</li>';
      }).join('') + '</ul>';
  }

  function loadTeachers(el) {
    var box = el.querySelector('[data-admin-list]');
    if (!box) return Promise.resolve();
    return QPG.approvals.load().then(function (list) { drawTeachers(box, list); }, function (e) {
      box.innerHTML = '<div class="notice notice-error">' + icon('error') + '<div>યાદી આવી નહીં: ' + esc(e.message || e) + '</div></div>';
    });
  }

  /** Clicks inside the admin panel. Returns true when handled. */
  function adminClick(e, el) {
    var b = e.target.closest('[data-admin-act]');
    if (!b) return false;
    var li = b.closest('[data-teacher]'), email = li.getAttribute('data-teacher'), act = b.getAttribute('data-admin-act');
    var t = QPG.approvals.list().find(function (x) { return x.email === email; }) || {};
    var done = function (msg) { return function () { QPG.ui.toast(msg); return loadTeachers(el); }; };
    var fail = function (err) { QPG.ui.toast('ન થયું: ' + (err.message || err)); b.disabled = false; };
    if (act === 'edit') { li.querySelector('.t-edit').hidden = !li.querySelector('.t-edit').hidden; return true; }
    b.disabled = true;
    if (act === 'approve') QPG.approvals.setApproved(email, true).then(done(t.name + ' ને મંજૂરી આપી')).catch(fail);
    else if (act === 'revoke') {
      QPG.ui.confirmDialog({ title: t.name + ' ની મંજૂરી રદ કરવી છે?', body: 'એ શિક્ષક હવે લૉગિન કે સિંક કરી શકશે નહીં (એમનાં ઉપકરણમાંથી આપોઆપ લૉગઆઉટ થશે). એમનો ક્લાઉડ ડેટા રહેશે; ફરી મંજૂર કરો તો પાછો મળશે.', ok: 'મંજૂરી રદ કરો', danger: true })
        .then(function (yes) { if (!yes) { b.disabled = false; return; } return QPG.approvals.setApproved(email, false).then(done(t.name + ' ની મંજૂરી રદ થઈ')); }).catch(fail);
    } else if (act === 'delete') {
      QPG.ui.confirmDialog({ title: t.name + ' ને યાદીમાંથી કાઢવા છે?', body: 'મંજૂરી પણ નીકળી જશે. એ ફરી લૉગિન કરે તો "મંજૂરી બાકી" માં દેખાશે. એમનો સેવ થયેલો ડેટા રહેશે.', ok: 'કાઢો', danger: true })
        .then(function (yes) { if (!yes) { b.disabled = false; return; } return QPG.approvals.remove(email).then(done(t.name + ' ને યાદીમાંથી કાઢ્યા')); }).catch(fail);
    } else if (act === 'save-perm') {
      var subs = Array.from(li.querySelectorAll('input[name=ed-sub]:checked')).map(function (c) { return c.value; });
      var stds = Array.from(li.querySelectorAll('input[name=ed-std]:checked')).map(function (c) { return Number(c.value); });
      if (!subs.length || !stds.length) { QPG.ui.toast('ઓછામાં ઓછો એક વિષય અને એક ધોરણ પસંદ કરો.'); b.disabled = false; return true; }
      QPG.approvals.save(email, t.name, subs, stds, t.approved).then(done('વિષય / ધોરણ સચવાયાં')).catch(fail);
    }
    return true;
  }

  QPG.views.settings = function (el) {
    var app = QPG.app;
    var qs = app.state.questions;
    var demo = qs.filter(function (q) { return q.isDemo; }).length;

    el.innerHTML =
      '<div class="page-head"><div><h1>ટેમ્પ્લેટ અને સેટિંગ્સ</h1><p>સિંક, પેપરના ફોર્મેટમાં સંસ્થાનું નામ, લોગો અને લખાણ, બેકઅપ.</p></div></div>' +
      adminApprovalsPanel() +
      accountPanel() +
      '<section class="panel"><h2>Gemini AI (PDF માંથી પ્રશ્નો, સૂત્રો, જવાબ)</h2>' +
        '<p style="margin-top:0">PDF / Word માંથી પ્રશ્નો અને ગણિતનાં સૂત્રો (LaTeX) સચોટ લાવવા, અને જવાબ લખવા Gemini AI વપરાય છે.</p>' +
        '<p data-gemini-server style="font-size:15px">AI ની સ્થિતિ ચકાસે છે…</p>' +
        (app.isAdmin() ? '<p style="font-size:14px;color:var(--muted);margin-top:0">ઍડમિન: કી એક જ વાર Vercel માં મૂકો — Project → Settings → Environment Variables → <b>GEMINI_API_KEY</b>. પછી બધા મંજૂર શિક્ષકો પોતાની કી વગર AI વાપરી શકશે, અને કી કોઈને દેખાશે નહીં.</p>' : '') +
        '<details><summary style="cursor:pointer">આ ઉપકરણ માટે પોતાની કી (વૈકલ્પિક)</summary>' +
        '<div class="row row-2" style="margin-top:10px">' +
          '<label class="field"><span class="lbl">Gemini API Key</span>' +
            '<input type="password" class="input" data-setting-gemini-key value="' + esc(QPG.gemini ? QPG.gemini.getApiKey() : '') + '" placeholder="AIzaSy..." autocomplete="off">' +
          '</label>' +
          '<div class="field" style="display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap">' +
            '<button type="button" class="btn btn-primary" data-act="save-settings-gemini">સાચવો / ચકાસો</button>' +
            '<a class="btn btn-quiet" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">મફત API Key મેળવો ↗</a>' +
          '</div>' +
        '</div>' +
        '<div data-gemini-status style="margin-top:8px;font-size:14px;color:var(--muted)">' +
          (QPG.gemini && QPG.gemini.getApiKey() ? 'આ ઉપકરણમાં કી સાચવેલી છે (સર્વર પર કી ન હોય ત્યારે જ વપરાય).' : 'આ ઉપકરણમાં કી નથી.') +
        '</div></details>' +
      '</section>' +
      app.templateList().map(templatePanel).join('') +
      '<section class="panel"><h2>બેકઅપ ફાઇલ</h2>' +
        '<p style="margin-top:0">બધા પ્રશ્નો, પેપર અને ફોર્મેટ એક ફાઇલમાં સેવ થશે. સિંક ચાલુ હોય તો પણ મહિનામાં એક વાર બેકઅપ ફાઇલ બનાવી Drive / ઇમેઇલમાં રાખવી સલાહભર્યું છે.</p>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button type="button" class="btn btn-primary" data-act="backup">' + icon('download') + 'બેકઅપ ફાઇલ બનાવો</button>' +
          '<label class="btn">' + icon('upload') + 'બેકઅપમાંથી પાછું લાવો<input type="file" accept=".json,application/json" data-restore hidden></label>' +
        '</div><div data-restore-box style="margin-top:12px"></div>' +
        '<p data-last-backup style="margin:10px 0 0;color:var(--muted);font-size:14px"></p>' +
      '</section>' +
      '<section class="panel"><h2>ડેમો પ્રશ્નો</h2>' +
        (demo ? '<p style="margin-top:0">બેંકમાં ' + demo + ' ડેમો પ્રશ્નો છે. તમારા પોતાના પ્રશ્નો પર એની કોઈ અસર નહીં થાય.</p>' +
          '<button type="button" class="btn btn-danger" data-act="demo">' + icon('trash') + 'ડેમો પ્રશ્નો દૂર કરો</button>'
          : '<p style="margin:0">ડેમો પ્રશ્નો દૂર કરી દીધા છે.</p>') +
      '</section>' +
      '<section class="panel"><h2>એપ</h2><dl class="kv">' +
        '<dt>કુલ પ્રશ્નો</dt><dd>' + qs.length + '</dd>' +
        '<dt>ડેટા ક્યાં છે</dt><dd>આ ' + (/(Android|iPhone|iPad)/i.test(navigator.userAgent) ? 'ફોન' : 'કમ્પ્યુટર') + 'ના બ્રાઉઝરમાં (ઇન્ટરનેટ વગર પણ)</dd>' +
        '<dt>સુરક્ષિત સંગ્રહ</dt><dd data-persist>ચકાસે છે…</dd>' +
        '<dt>જગ્યા વપરાઈ</dt><dd data-usage>—</dd>' +
        '<dt>આવૃત્તિ</dt><dd>' + esc(app.VERSION) + '</dd>' +
      '</dl>' +
      '<p style="margin-bottom:0;color:var(--muted);font-size:14px">' + (QPG.auth.user() ? 'ડેટા આ ઉપકરણમાં છે અને તમારા એકાઉન્ટમાં (ક્લાઉડમાં) સિંક થાય છે.' : 'ડેટા આ ઉપકરણમાં જ રહે છે.') + '</p></section>';

    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(function (p) {
        el.querySelector('[data-persist]').textContent = p ? 'હા — બ્રાઉઝર જાતે ડેટા નહીં ભૂંસે' : 'ના — બ્રાઉઝર જગ્યા ઓછી હોય તો ભૂંસી શકે (ડેટા ક્લાઉડમાં પણ છે)';
      });
    } else el.querySelector('[data-persist]').textContent = 'માહિતી નથી';
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(function (e) {
        el.querySelector('[data-usage]').textContent = (e.usage / 1048576).toFixed(1) + ' MB';
      });
    }

    if (el.querySelector('[data-admin-panel]')) loadTeachers(el);
    if (QPG.gemini) QPG.gemini.checkServer().then(function (on) {
      var g = el.querySelector('[data-gemini-server]');
      if (!g) return;
      g.innerHTML = on ? '<b style="color:var(--green)">✓ AI ચાલુ છે</b> — સર્વર પરની કી વપરાય છે (લૉગિન કરેલા મંજૂર શિક્ષકો માટે).'
        : (QPG.gemini.getApiKey() ? '<b>AI ચાલુ છે</b> — આ ઉપકરણની કીથી.' : '<b style="color:var(--amber)">AI હજુ ચાલુ નથી</b> — સર્વર પર કી ગોઠવાયેલી નથી.');
    });
    var accBox = el.querySelector('[data-account-body]');
    var stopStatus = QPG.sync.onStatus(function (st) { drawAccount(accBox, st); });

    QPG.db.getMeta('lastBackup').then(function (d) {
      var lb = el.querySelector('[data-last-backup]');
      if (lb) lb.textContent = d ? 'છેલ્લો બેકઅપ: ' + QPG.ui.formatDate(d) : 'હજુ એક પણ બેકઅપ બનાવ્યો નથી.';
    });

    function makeBackup() {
      return Promise.all([QPG.db.getAll('questions'), QPG.db.getAll('papers'), QPG.db.getAll('templates'), QPG.db.getAll('settings')])
        .then(function (r) {
          var now = new Date().toISOString();
          var data = QPG.backup.make({ questions: r[0], papers: r[1], templates: r[2], settings: r[3] }, app.VERSION, now);
          var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
          return QPG.ui.saveFile(blob, QPG.backup.fileName(now), QPG.ui.canShareFiles()).then(function (how) {
            if (how === 'cancelled') return;
            QPG.db.setMeta('lastBackup', now);
            var lb = el.querySelector('[data-last-backup]'); if (lb) lb.textContent = 'છેલ્લો બેકઅપ: ' + QPG.ui.formatDate(now);
            QPG.ui.toast('બેકઅપ ફાઇલ બની: ' + data.questions.length + ' પ્રશ્નો, ' + data.papers.length + ' પેપર');
          });
        });
    }

    function restore(file) {
      var box = el.querySelector('[data-restore-box]');
      QPG.files.readAsText(file).then(function (text) {
        var obj; try { obj = JSON.parse(text); } catch (e) { obj = null; }
        var c = QPG.backup.check(obj);
        if (!c.ok) {
          box.innerHTML = '<div class="notice notice-error">' + icon('error') + '<div>' + c.errors.map(esc).join('<br>') + '</div></div>';
          return;
        }
        box.innerHTML = '<div class="notice notice-info">' + icon('info') + '<div><b>' + esc(file.name) + '</b>' +
          (c.exportedAt ? ' (' + esc(QPG.ui.formatDate(c.exportedAt)) + ')' : '') + ': ' + c.counts.questions + ' પ્રશ્નો, ' + c.counts.papers + ' પેપર, ' + c.counts.templates + ' ફોર્મેટ.' +
          (c.errors.length ? '<br>' + c.errors.map(esc).join('<br>') : '') +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
            '<button type="button" class="btn btn-primary btn-sm" data-act="restore-merge">આ ઉપકરણના ડેટામાં ઉમેરો</button>' +
            (QPG.auth.user() ? '' : '<button type="button" class="btn btn-danger btn-sm" data-act="restore-replace">આ ઉપકરણનો બધો ડેટા બદલી નાખો</button>') +
            '<button type="button" class="btn btn-quiet btn-sm" data-act="restore-cancel">રદ કરો</button></div>' +
          '<p style="margin:8px 0 0;font-size:13.5px">"ઉમેરો" માં નવા પ્રશ્નો ઉમેરાશે અને જે પ્રશ્ન બેકઅપમાં પછીથી સુધારાયો હોય તે બદલાશે; બાકીનું એમ જ રહેશે.' +
          (QPG.auth.user() ? ' ઉમેરેલું તમારા એકાઉન્ટમાં જશે અને બીજાં ઉપકરણોમાં પણ દેખાશે.' : '') + '</p></div></div>';
        box._data = c.data;
      }).catch(function (e) { box.innerHTML = '<div class="notice notice-error">' + icon('error') + '<div>' + esc(e.message || e) + '</div></div>'; });
    }

    function applyRestore(mode) {
      var box = el.querySelector('[data-restore-box]'), data = box._data;
      if (!data) return;
      var stores = ['questions', 'papers', 'templates'];
      var go = function () {
        var jobs = stores.map(function (st) {
          return QPG.db.getAll(st).then(function (existing) {
            var incoming = data[st] || [];
            if (mode === 'replace') return QPG.db.clear(st).then(function () { return QPG.db.bulkPut(st, incoming); }).then(function () { return { added: incoming.length }; });
            if (st === 'templates') return QPG.db.bulkPut(st, incoming).then(function () { return { added: incoming.length }; });
            var m = QPG.backup.mergeRecords(existing, incoming);
            return QPG.db.bulkPut(st, m.write).then(function () { return m; });
          });
        });
        return Promise.all(jobs).then(function (res) {
          return app.refreshQuestions().then(function () { return QPG.db.templateOverrides(); }).then(function (o) {
            app.state.templateOverrides = o;
            var q = res[0], pp = res[1];
            QPG.ui.toast(mode === 'replace' ? 'ડેટા બેકઅપ પ્રમાણે બદલાયો' :
              'ઉમેર્યું: ' + (q.added || 0) + ' નવા પ્રશ્નો, ' + (q.updated || 0) + ' સુધારેલા; ' + (pp.added || 0) + ' પેપર');
            app.rerender();
          });
        });
      };
      if (mode === 'replace') {
        QPG.ui.confirmDialog({ title: 'આ ઉપકરણનો બધો ડેટા બદલી નાખવો છે?', body: 'અહીંના બધા પ્રશ્નો, પેપર અને ફોર્મેટ કાઢીને બેકઅપ ફાઇલનો ડેટા મુકાશે. પહેલાં અહીંનો બેકઅપ બનાવી રાખવો સલાહભર્યું છે.', ok: 'હા, બદલી નાખો', danger: true })
          .then(function (yes) { if (yes) go(); });
      } else go();
    }

    var pendingLogos = {};
    // unsaved format changes: ask before leaving, and don't redraw this screen under the user
    var dirtyTpl = {};
    var tplOf = function (node) { return node.closest('[data-tpl]').getAttribute('data-tpl'); };
    el.addEventListener('input', function (e) { if (e.target.hasAttribute('data-tk')) dirtyTpl[tplOf(e.target)] = true; });
    app.guard = function () { return Object.keys(dirtyTpl).length ? 'ફોર્મેટમાં કરેલા ફેરફાર હજુ સાચવ્યા નથી ("આ ફોર્મેટ સાચવો").' : null; };
    el.addEventListener('change', function (e) {
      if (e.target.hasAttribute('data-restore')) { if (e.target.files[0]) restore(e.target.files[0]); e.target.value = ''; return; }
      var k = e.target.getAttribute('data-logo');
      if (!k || !e.target.files[0]) return;
      var id = e.target.closest('[data-tpl]').getAttribute('data-tpl');
      var r = new FileReader();
      r.onload = function () {
        pendingLogos[id] = pendingLogos[id] || {}; pendingLogos[id][k] = r.result; dirtyTpl[id] = true;
        var img = e.target.closest('.thumb'); img.innerHTML = '<img src="' + r.result + '" alt="" style="max-width:64px;max-height:64px"><span class="hint">સાચવો દબાવો</span>';
      };
      r.readAsDataURL(e.target.files[0]);
    });

    el.addEventListener('click', function (e) {
      if (adminClick(e, el)) return;

      var del = e.target.closest('[data-logo-del]');
      if (del) {
        var tid = del.closest('[data-tpl]').getAttribute('data-tpl');
        pendingLogos[tid] = pendingLogos[tid] || {}; pendingLogos[tid][del.getAttribute('data-logo-del')] = ''; dirtyTpl[tid] = true;
        del.closest('.thumb').innerHTML = '<span class="hint">લોગો કાઢ્યો — સાચવો દબાવો</span>';
        return;
      }
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var a = b.getAttribute('data-act');
      if (accountClick(a, b, el)) return;

      if (a === 'admin-refresh-teachers') {
        b.disabled = true;
        loadTeachers(el).then(function () { b.disabled = false; });
        return;
      }

      if (a === 'admin-add-teacher') {
        var tName = el.querySelector('#admin-add-name').value.trim();
        var tEmail = el.querySelector('#admin-add-email').value.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(tEmail)) { QPG.ui.toast('માન્ય ઇમેઇલ સરનામું લખો.'); return; }
        var subs = Array.from(el.querySelectorAll('input[name="adm-sub"]:checked')).map(function (c) { return c.value; });
        var stds = Array.from(el.querySelectorAll('input[name="adm-std"]:checked')).map(function (c) { return Number(c.value); });
        if (!subs.length || !stds.length) { QPG.ui.toast('ઓછામાં ઓછો એક વિષય અને એક ધોરણ પસંદ કરો.'); return; }
        b.disabled = true;
        QPG.approvals.save(tEmail, tName, subs, stds, true).then(function () {
          QPG.ui.toast(tEmail + ' ઉમેરાયા અને મંજૂર થયા');
          el.querySelector('#admin-add-name').value = ''; el.querySelector('#admin-add-email').value = '';
          return loadTeachers(el);
        }).catch(function (err) { QPG.ui.toast('ન થયું: ' + (err.message || err)); }).finally(function () { b.disabled = false; });
        return;
      }

      if (a === 'save-settings-gemini') {
        var inp = el.querySelector('[data-setting-gemini-key]');
        var key = inp ? inp.value.trim() : '';
        var statusEl = el.querySelector('[data-gemini-status]');
        if (!key) {
          if (QPG.gemini) QPG.gemini.setApiKey('');
          QPG.ui.toast('Gemini API Key કાઢી નાખી.');
          if (statusEl) statusEl.textContent = 'આ ઉપકરણમાં કી નથી.';
          return;
        }
        b.textContent = 'ચકાસે છે…';
        b.disabled = true;
        (QPG.gemini ? QPG.gemini.testApiKey(key) : Promise.resolve()).then(function () {
          if (QPG.gemini) QPG.gemini.setApiKey(key);
          QPG.ui.toast('✨ Gemini API Key સફળતાપૂર્વક સાચવી અને ચકાસી લેવાઈ!');
          b.textContent = 'સાચવો / ચકાસો';
          b.disabled = false;
          if (statusEl) statusEl.textContent = 'આ ઉપકરણમાં કી સાચવેલી છે (સર્વર પર કી ન હોય ત્યારે જ વપરાય).';
        }).catch(function (err) {
          b.textContent = 'સાચવો / ચકાસો';
          b.disabled = false;
          QPG.ui.toast('API Key ભૂલ: ' + (err && err.message || err));
          if (statusEl) statusEl.textContent = 'ભૂલ: ' + (err && err.message || err);
        });
        return;
      }

      if (a === 'backup') { b.disabled = true; makeBackup().catch(function (err) { QPG.ui.toast('બેકઅપ બની શક્યો નહીં: ' + (err.message || err)); }).finally(function () { b.disabled = false; }); return; }
      if (a === 'restore-merge') { applyRestore('merge'); return; }
      if (a === 'restore-replace') { applyRestore('replace'); return; }
      if (a === 'restore-cancel') { el.querySelector('[data-restore-box]').innerHTML = ''; return; }
      if (b.getAttribute('data-act') === 'tpl-save') {
        var panel = b.closest('[data-tpl]'), id = panel.getAttribute('data-tpl');
        var row = Object.assign({ id: id, header: {} }, app.state.templateOverrides[id] || {});
        row.header = Object.assign({}, row.header);
        panel.querySelectorAll('[data-tk]').forEach(function (inp) {
          var k = inp.getAttribute('data-tk');
          if (k.indexOf('h.') === 0) row.header[k.slice(2)] = inp.value; else row[k] = inp.value;
        });
        Object.assign(row.header, pendingLogos[id] || {});
        QPG.db.saveTemplateOverride(row).then(function () {
          app.state.templateOverrides[id] = row;
          delete pendingLogos[id];
          delete dirtyTpl[id];
          QPG.ui.toast('ફોર્મેટ સાચવ્યું');
        });
        return;
      }
      if (b.getAttribute('data-act') === 'demo') {
        QPG.ui.confirmDialog({
          title: 'બધા ડેમો પ્રશ્નો દૂર કરવા છે?',
          body: demo + ' ડેમો પ્રશ્નો પ્રશ્ન બેંકમાંથી નીકળી જશે. તમે ઉમેરેલા કે સુધારેલા પ્રશ્નો રહેશે.',
          ok: 'ડેમો પ્રશ્નો દૂર કરો', danger: true
        }).then(function (yes) {
          if (!yes) return;
          QPG.db.removeDemoQuestions().then(function (n) {
            return app.refreshQuestions().then(function () {
              QPG.ui.toast(n + ' ડેમો પ્રશ્નો દૂર કર્યા');
              app.rerender();
            });
          });
        });
      }
    });
    el.addEventListener('submit', function (e) {
      if (!e.target.hasAttribute('data-pw-form')) return;
      e.preventDefault();
      passwordSubmit(e.target, function () { e.target.hidden = true; QPG.ui.toast('નવો પાસવર્ડ સચવાયો'); });
    });
    return stopStatus;
  };
})(self);
