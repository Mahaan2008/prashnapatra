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
        '<div class="auth-brand"><div class="brand-name">પ્રશ્નપત્ર</div><div class="brand-sub">Physics · ગણિત</div></div>' +
        '<h1>' + (signup ? 'નવું એકાઉન્ટ બનાવો' : forgot ? 'પાસવર્ડ ભૂલી ગયા' : 'લૉગિન') + '</h1>' +
        '<p class="auth-lead">' + (signup ? 'એક જ એકાઉન્ટથી ફોન અને લેપટોપ બંનેમાં તમારા પ્રશ્નો આપોઆપ સરખા રહેશે.'
          : forgot ? 'તમારો ઇમેઇલ લખો — નવો પાસવર્ડ બનાવવાની લિંક મોકલીશું.'
          : 'તમારા ઇમેઇલ અને પાસવર્ડથી લૉગિન કરો — તમારો બધો ડેટા આપોઆપ આવી જશે.') + '</p>' +
        (message || note ? '<div data-auth-msg>' + (message || '<div class="notice notice-info">' + icon('info') + '<div>' + esc(note) + '</div></div>') + '</div>' : '<div data-auth-msg></div>') +
        '<form data-auth-form novalidate>' +
          (signup ? '<label class="field"><span class="lbl">શિક્ષકનું પૂરું નામ</span><input class="input" type="text" name="name" placeholder="દા.ત. રમેશભાઈ પટેલ" required></label>' : '') +
          '<label class="field"><span class="lbl">ઇમેઇલ</span><input class="input" type="email" name="email" autocomplete="email" inputmode="email" required></label>' +
          (signup ?
            '<div class="field"><span class="lbl" style="font-weight:600;margin-bottom:4px;display:block">વિષય પસંદ કરો (એક અથવા બંને પસંદ કરી શકો છો)</span>' +
              '<div style="display:flex;gap:18px;margin-top:6px;flex-wrap:wrap">' +
                '<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" name="subject" value="physics" checked> <span>ભૌતિક વિજ્ઞાન (Physics)</span></label>' +
                '<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" name="subject" value="maths" checked> <span>ગણિત (Maths)</span></label>' +
              '</div></div>' +
            '<div class="field" style="margin-top:8px"><span class="lbl" style="font-weight:600;margin-bottom:4px;display:block">ધોરણ પસંદ કરો (એક અથવા બંને પસંદ કરી શકો છો)</span>' +
              '<div style="display:flex;gap:18px;margin-top:6px;flex-wrap:wrap">' +
                '<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" name="std" value="11" checked> <span>ધોરણ 11</span></label>' +
                '<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" name="std" value="12" checked> <span>ધોરણ 12</span></label>' +
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
          draw('<div class="notice notice-ok">' + icon('ok') + '<div>એકાઉન્ટ નોંધાઈ ગયું છે!<br>તમારું એકાઉન્ટ મુખ્ય ઍડમિન (<b>mahaanthakkar2008@gmail.com</b>) ની મંજૂરી (Approval) માટે મોકલાયું છે. ઍડમિન મંજૂર કરશે તે પછી જ તમે લૉગિન કરી શકશો.</div></div>');
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

  function adminApprovalsPanel() {
    if (!QPG.app || !QPG.app.isAdmin || !QPG.app.isAdmin()) return '';
    var list = QPG.approvals ? QPG.approvals.getAll() : {};
    var emails = Object.keys(list);

    var rows = emails.map(function (em) {
      var u = list[em];
      var subs = (u.subjects || []).map(function (s) { return s === 'physics' ? 'Physics' : s === 'maths' ? 'ગણિત' : s; }).join(', ') || '—';
      var stds = (u.standards || []).map(function (s) { return 'ધોરણ ' + s; }).join(', ') || '—';
      var isApproved = !!u.approved;
      var statusBadge = isApproved
        ? '<span style="background:#16a34a;color:#fff;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;display:inline-block">🟢 મંજૂર થયેલ</span>'
        : '<span style="background:#eab308;color:#000;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;display:inline-block">🟡 મંજૂરી બાકી</span>';

      var actBtn = isApproved
        ? '<button type="button" class="btn btn-quiet btn-sm" data-admin-act="revoke" data-email="' + esc(em) + '" style="color:var(--red)">' + icon('trash') + 'મંજૂરી રદ</button>'
        : '<button type="button" class="btn btn-primary btn-sm" data-admin-act="approve" data-email="' + esc(em) + '">' + icon('ok') + 'Approve કરો</button>';

      return '<tr style="border-bottom:1px solid var(--border)">' +
        '<td style="padding:10px 8px"><b>' + esc(u.name || em.split('@')[0]) + '</b><br><small style="color:var(--muted)">' + esc(em) + '</small></td>' +
        '<td style="padding:10px 8px">' + esc(subs) + '</td>' +
        '<td style="padding:10px 8px">' + esc(stds) + '</td>' +
        '<td style="padding:10px 8px">' + statusBadge + '</td>' +
        '<td style="padding:10px 8px"><div style="display:flex;gap:6px;flex-wrap:wrap">' + actBtn +
          '<button type="button" class="btn btn-quiet btn-sm" data-admin-act="delete" data-email="' + esc(em) + '" style="color:var(--red)">' + icon('trash') + 'કાઢો</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    return '<section class="panel" data-admin-panel style="border: 2px solid var(--accent); background: rgba(59,130,246,0.03); margin-bottom: 20px">' +
      '<h2 style="color:var(--accent);display:flex;align-items:center;gap:8px">👑 મુખ્ય ઍડમિન પેનલ — શિક્ષકોની મંજૂરી (User Approvals)</h2>' +
      '<p style="margin-top:0">મુખ્ય ઍડમિન તરીકે (<b>mahaanthakkar2008@gmail.com</b>) તમે નવા નોંધાયેલા શિક્ષકોને Approve કે રદ કરી શકો છો. માત્ર Approve થયેલા શિક્ષકો જ લૉગિન કરી શકશે.</p>' +
      (emails.length === 0
        ? '<div style="padding:14px;background:var(--bg);border-radius:8px;text-align:center;color:var(--muted);border:1px dashed var(--border)">હજુ સુધી કોઈ શિક્ષકે સાઇન-અપ કર્યું નથી.</div>'
        : '<div style="overflow-x:auto"><table style="width:100%;text-align:left;border-collapse:collapse;font-size:14.5px">' +
            '<thead><tr style="border-bottom:2px solid var(--border);color:var(--muted)"><th style="padding:8px">શિક્ષક</th><th style="padding:8px">વિષય</th><th style="padding:8px">ધોરણ</th><th style="padding:8px">સ્થિતિ</th><th style="padding:8px">ક્રિયાઓ</th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table></div>') +
    '</section>';
  }

  QPG.views.settings = function (el) {
    var app = QPG.app;
    var qs = app.state.questions;
    var demo = qs.filter(function (q) { return q.isDemo; }).length;

    el.innerHTML =
      '<div class="page-head"><div><h1>ટેમ્પ્લેટ અને સેટિંગ્સ</h1><p>સિંક, પેપરના ફોર્મેટમાં સંસ્થાનું નામ, લોગો અને લખાણ, બેકઅપ.</p></div></div>' +
      adminApprovalsPanel() +
      accountPanel() +
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
      var adm = e.target.closest('[data-admin-act]');
      if (adm) {
        var act = adm.getAttribute('data-admin-act');
        var tEmail = adm.getAttribute('data-email');
        if (act === 'approve') {
          QPG.approvals.approveUser(tEmail);
          QPG.ui.toast(tEmail + ' ને Approve કર્યા!');
          app.rerender();
          return;
        }
        if (act === 'revoke') {
          QPG.approvals.revokeUser(tEmail);
          QPG.ui.toast(tEmail + ' ની મંજૂરી રદ કરી.');
          app.rerender();
          return;
        }
        if (act === 'delete') {
          QPG.ui.confirmDialog({
            title: tEmail + ' ને કાઢી નાખવા છે?',
            body: 'આ શિક્ષકનું એકાઉન્ટ લિસ્ટમાંથી દૂર થઈ જશે.',
            ok: 'હા, કાઢો',
            danger: true
          }).then(function (yes) {
            if (yes) {
              QPG.approvals.rejectUser(tEmail);
              QPG.ui.toast(tEmail + ' ને દૂર કરવામાં આવ્યા.');
              app.rerender();
            }
          });
          return;
        }
      }

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
