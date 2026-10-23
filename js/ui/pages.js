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

  /* ---------- automatic sync ---------- */
  var STATUS_TEXT = {
    ok: 'ચાલુ — બધું સિંક થયેલું છે', syncing: 'સિંક થાય છે…', offline: 'ઑફલાઇન — નેટ આવતાં જ સિંક થશે',
    error: 'અટક્યું — ફરી પ્રયત્ન થશે', badkey: 'બંધ — કી ક્લાઉડમાં મળી નથી'
  };

  function syncPanel() {
    return '<section class="panel" data-sync-panel><h2>આપોઆપ સિંક — ફોન અને લેપટોપમાં એક જ ડેટા</h2><div data-sync-body></div></section>';
  }

  function drawSync(box, s) {
    var S = QPG.sync;
    if (!S.available()) {
      box.innerHTML = '<p style="margin:0">આ નમૂના (preview) માં સિંક બંધ છે. ઓનલાઇન મૂકેલી એપમાં કે લેપટોપની એપમાં સિંક ચાલુ કરી શકાય છે.</p>';
      return;
    }
    if (s.status === 'off') {
      if (box.getAttribute('data-mode') === 'off') return;   // keep what the user is typing
      box.setAttribute('data-mode', 'off');
      box.innerHTML =
        '<p style="margin-top:0">સિંક ચાલુ કરશો એટલે પ્રશ્નો, પેપર અને ફોર્મેટ ક્લાઉડમાં સચવાશે અને તમારાં બધાં ઉપકરણોમાં આપોઆપ સરખાં રહેશે. ' +
        'ઇન્ટરનેટ ન હોય ત્યારે પણ એપ ચાલે છે — નેટ આવતાં જ ફેરફાર મોકલાય છે.</p>' +
        '<div class="row row-2">' +
          '<div><h3 style="margin:0 0 6px;font-size:16px">પહેલું ઉપકરણ</h3>' +
            '<p style="margin:0 0 10px;font-size:14.5px;color:var(--muted)">જે ઉપકરણમાં તમારા બધા પ્રશ્નો છે (દા.ત. લેપટોપ) ત્યાં આ દબાવો.</p>' +
            '<button type="button" class="btn btn-primary" data-act="sync-start">' + icon('upload') + 'સિંક ચાલુ કરો</button></div>' +
          '<div><h3 style="margin:0 0 6px;font-size:16px">બીજું ઉપકરણ જોડો</h3>' +
            '<p style="margin:0 0 10px;font-size:14.5px;color:var(--muted)">પહેલા ઉપકરણમાંથી મોકલેલી લિંક ખોલો, અથવા સિંક કી અહીં પેસ્ટ કરો.</p>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap"><input class="input" data-sync-input style="flex:1 1 220px;min-width:0" placeholder="XXXX-XXXX-XXXX-…" autocomplete="off" autocapitalize="characters" spellcheck="false">' +
            '<button type="button" class="btn" data-act="sync-join">જોડો</button></div></div>' +
        '</div><div data-sync-msg style="margin-top:12px"></div>';
      return;
    }
    box.setAttribute('data-mode', 'on');
    var key = S.key(), link = S.link();
    var state = '<dl class="kv">' +
      '<dt>સ્થિતિ</dt><dd><b>' + esc(STATUS_TEXT[s.status] || s.status) + '</b>' + (s.text && s.status !== 'ok' ? '<br><span style="font-size:14px">' + esc(s.text) + '</span>' : '') + '</dd>' +
      '<dt>છેલ્લું સિંક</dt><dd>' + (s.lastAt ? esc(new Date(s.lastAt).toLocaleString('gu-IN', { dateStyle: 'medium', timeStyle: 'short' })) : 'હજુ થયું નથી') + '</dd>' +
      '<dt>મોકલવાના બાકી ફેરફાર</dt><dd>' + (s.pending || 0) + '</dd></dl>';
    var stateBox = box.querySelector('[data-sync-state]');
    if (stateBox && box.getAttribute('data-key') === key) { stateBox.innerHTML = state; return; }
    box.setAttribute('data-key', key);
    box.innerHTML = '<div data-sync-state>' + state + '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 16px">' +
        '<button type="button" class="btn btn-primary" data-act="sync-now">' + icon('ok') + 'હમણાં સિંક કરો</button></div>' +
      '<h3 style="margin:0 0 6px;font-size:16px">બીજું ઉપકરણ (ફોન / લેપટોપ) જોડો</h3>' +
      '<ol class="sync-steps">' +
        (link ? '<li>નીચેનું બટન દબાવી લિંક <b>તમારા પોતાના</b> WhatsApp (Message yourself) કે ઇમેઇલમાં મોકલો.</li><li>બીજા ઉપકરણમાં એ લિંક ખોલો અને "જોડો" દબાવો.</li>'
              : '<li>બીજા ઉપકરણમાં એપ ખોલો → સેટિંગ્સ → "બીજું ઉપકરણ જોડો".</li><li>નીચેની સિંક કી ત્યાં પેસ્ટ કરો.</li>') +
      '</ol>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        (link ? '<button type="button" class="btn" data-act="sync-share">' + icon('share') + 'જોડવાની લિંક મોકલો</button>' +
                '<button type="button" class="btn" data-act="sync-copy-link">' + icon('copy') + 'લિંક કૉપી</button>' : '') +
        '<button type="button" class="btn btn-quiet" data-act="sync-show-key">સિંક કી બતાવો</button></div>' +
      '<div data-sync-key hidden style="margin-top:10px"><div class="sync-key">' + esc(QPG.syncCore.formatKey(key)) + '</div>' +
        '<button type="button" class="btn btn-sm btn-quiet" data-act="sync-copy-key" style="margin-top:6px">' + icon('copy') + 'કી કૉપી કરો</button></div>' +
      '<p style="margin:12px 0 0;font-size:14px;color:var(--muted)">આ કી / લિંક પાસવર્ડ જેવી છે: જેની પાસે હોય તે તમારા પ્રશ્નો જોઈ અને બદલી શકે. બીજા કોઈને ન મોકલશો.</p>' +
      '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--rule)">' +
        '<button type="button" class="btn btn-danger btn-sm" data-act="sync-stop">આ ઉપકરણમાં સિંક બંધ કરો</button>' +
        '<span style="margin-left:10px;font-size:13.5px;color:var(--muted)">અહીંનો ડેટા અને ક્લાઉડનો ડેટા બંને રહેશે.</span></div>';
  }

  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
    var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } finally { ta.remove(); }
    return Promise.resolve();
  }

  function joinMessage(counts) {
    return 'જોડાઈ ગયું. ક્લાઉડમાં ' + (counts.questions || 0) + ' પ્રશ્નો, ' + (counts.papers || 0) + ' પેપર — આ ઉપકરણમાં આવી રહ્યાં છે.';
  }

  /** Buttons of the sync panel. Returns true when the click was handled. */
  function syncClick(a, b, el) {
    var S = QPG.sync, msg = function (cls, t) { var m = el.querySelector('[data-sync-msg]'); if (m) m.innerHTML = '<div class="notice notice-' + cls + '">' + icon(cls === 'error' ? 'error' : 'info') + '<div>' + esc(t) + '</div></div>'; };
    if (a === 'sync-start') {
      b.disabled = true;
      S.start().then(function () { QPG.ui.toast('સિંક ચાલુ થયું'); })
        .catch(function (e) { msg('error', 'સિંક ચાલુ થઈ શક્યું નહીં: ' + (e.message || e)); b.disabled = false; });
      return true;
    }
    if (a === 'sync-join') {
      var v = el.querySelector('[data-sync-input]').value;
      b.disabled = true;
      S.join(v).then(function (c) { QPG.ui.toast(joinMessage(c)); })
        .catch(function (e) { msg('error', e.message || String(e)); b.disabled = false; });
      return true;
    }
    if (a === 'sync-now') { b.disabled = true; S.now().then(function () { b.disabled = false; }); return true; }
    if (a === 'sync-show-key') { var k = el.querySelector('[data-sync-key]'); k.hidden = !k.hidden; b.textContent = k.hidden ? 'સિંક કી બતાવો' : 'સિંક કી છુપાવો'; return true; }
    if (a === 'sync-copy-key') { copyText(QPG.syncCore.formatKey(S.key())).then(function () { QPG.ui.toast('કી કૉપી થઈ'); }); return true; }
    if (a === 'sync-copy-link') { copyText(S.link()).then(function () { QPG.ui.toast('લિંક કૉપી થઈ'); }); return true; }
    if (a === 'sync-share') {
      var text = 'પ્રશ્નપત્ર એપ — આ ઉપકરણ જોડવાની લિંક (ફક્ત મારા માટે):';
      if (navigator.share) navigator.share({ title: 'પ્રશ્નપત્ર સિંક', text: text, url: S.link() }).catch(function () { /* cancelled */ });
      else window.open('https://wa.me/?text=' + encodeURIComponent(text + '\n' + S.link()), '_blank', 'noopener');
      return true;
    }
    if (a === 'sync-stop') {
      QPG.ui.confirmDialog({ title: 'આ ઉપકરણમાં સિંક બંધ કરવું છે?', body: 'અહીંનો ડેટા અહીં જ રહેશે અને ક્લાઉડનો ડેટા ક્લાઉડમાં. પછીથી સિંક કી / લિંકથી ફરી જોડી શકાશે. ' +
        'જે ફેરફાર હજુ મોકલાયા નથી તે ક્લાઉડમાં નહીં જાય.', ok: 'સિંક બંધ કરો', danger: true })
        .then(function (yes) { if (yes) S.stop().then(function () { QPG.ui.toast('આ ઉપકરણમાં સિંક બંધ થયું'); }); });
      return true;
    }
    return false;
  }

  /** #/sync?k=… — opened from the join link on another device. */
  QPG.views.syncJoin = function (el, ctx) {
    var S = QPG.sync, key = QPG.syncCore.parseKey((ctx.query || {}).k || '');
    try { history.replaceState({ p: '/sync' }, '', '#/sync'); } catch (e) { /* keep the key out of the history */ }
    var body;
    if (!key) body = '<div class="notice notice-error">' + icon('error') + '<div>લિંક અધૂરી છે. આખી લિંક ફરીથી કૉપી કરીને ખોલો, અથવા સેટિંગ્સમાં કી પેસ્ટ કરો.</div></div>';
    else if (!S.available()) body = '<p>આ નમૂના (preview) માં સિંક બંધ છે.</p>';
    else if (S.key() === key) body = '<div class="notice notice-info">' + icon('ok') + '<div>આ ઉપકરણ પહેલેથી જોડાયેલું છે.</div></div>';
    else if (S.key()) body = '<div class="notice notice-error">' + icon('warn') + '<div>આ ઉપકરણ બીજી સિંક કી સાથે જોડાયેલું છે. પહેલાં સેટિંગ્સમાં "સિંક બંધ કરો" દબાવો, પછી આ લિંક ફરી ખોલો.</div></div>';
    else body = '<p style="margin-top:0">આ ઉપકરણને તમારા બીજા ઉપકરણ સાથે જોડવું છે? ક્લાઉડમાંના પ્રશ્નો, પેપર અને ફોર્મેટ અહીં આવશે, ' +
      'અને અહીં પહેલેથી હોય તે પણ બીજા ઉપકરણમાં જશે (જે પછીથી સુધારાયું હોય તે રહે).</p>' +
      '<button type="button" class="btn btn-primary" data-act="join">' + icon('ok') + 'હા, જોડો</button> ' +
      '<a class="btn btn-quiet" href="#/settings">રદ કરો</a><div data-msg style="margin-top:12px"></div>';
    el.innerHTML = '<div class="page-head"><div><h1>ઉપકરણ જોડો</h1><p>આપોઆપ સિંક</p></div></div><section class="panel">' + body + '</section>';
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act="join"]');
      if (!b) return;
      b.disabled = true;
      S.join(key).then(function (c) { QPG.ui.toast(joinMessage(c)); QPG.app.go('/settings'); })
        .catch(function (err) {
          b.disabled = false;
          el.querySelector('[data-msg]').innerHTML = '<div class="notice notice-error">' + icon('error') + '<div>' + esc(err.message || err) + '</div></div>';
        });
    });
  };

  QPG.views.settings = function (el) {
    var app = QPG.app;
    var qs = app.state.questions;
    var demo = qs.filter(function (q) { return q.isDemo; }).length;

    el.innerHTML =
      '<div class="page-head"><div><h1>ટેમ્પ્લેટ અને સેટિંગ્સ</h1><p>સિંક, પેપરના ફોર્મેટમાં સંસ્થાનું નામ, લોગો અને લખાણ, બેકઅપ.</p></div></div>' +
      syncPanel() +
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
      '<p style="margin-bottom:0;color:var(--muted);font-size:14px">' + (QPG.sync.key() ? 'ડેટા આ ઉપકરણમાં છે અને ક્લાઉડમાં સિંક થાય છે.' : 'ડેટા આ ઉપકરણમાં જ રહે છે. બીજાં ઉપકરણો સાથે સરખો રાખવા ઉપર "સિંક ચાલુ કરો".') + '</p>' +
      '<div data-install style="margin-top:12px"></div></section>';

    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(function (p) {
        el.querySelector('[data-persist]').textContent = p ? 'હા — બ્રાઉઝર જાતે ડેટા નહીં ભૂંસે' : 'ના — એપ install કરશો ત્યારે ચાલુ થશે';
      });
    } else el.querySelector('[data-persist]').textContent = 'માહિતી નથી';
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(function (e) {
        el.querySelector('[data-usage]').textContent = (e.usage / 1048576).toFixed(1) + ' MB';
      });
    }
    if (app.state.installPrompt) {
      el.querySelector('[data-install]').innerHTML = '<button type="button" class="btn btn-primary" data-act="install">' + icon('download') + 'એપ install કરો</button>';
    }

    var syncBox = el.querySelector('[data-sync-body]');
    var stopStatus = QPG.sync.onStatus(function (st) { drawSync(syncBox, st); });

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
            (QPG.sync.key() ? '' : '<button type="button" class="btn btn-danger btn-sm" data-act="restore-replace">આ ઉપકરણનો બધો ડેટા બદલી નાખો</button>') +
            '<button type="button" class="btn btn-quiet btn-sm" data-act="restore-cancel">રદ કરો</button></div>' +
          '<p style="margin:8px 0 0;font-size:13.5px">"ઉમેરો" માં નવા પ્રશ્નો ઉમેરાશે અને જે પ્રશ્ન બેકઅપમાં પછીથી સુધારાયો હોય તે બદલાશે; બાકીનું એમ જ રહેશે.' +
          (QPG.sync.key() ? ' સિંક ચાલુ છે એટલે ઉમેરેલું બીજાં ઉપકરણોમાં પણ જશે ("બધું બદલો" સિંક બંધ હોય ત્યારે જ મળે છે).' : '') + '</p></div></div>';
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
      if (a.indexOf('sync-') === 0 && syncClick(a, b, el)) return;
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
      } else if (b.getAttribute('data-act') === 'install' && app.state.installPrompt) {
        app.state.installPrompt.prompt();
        app.state.installPrompt.userChoice.finally(function () { app.state.installPrompt = null; app.rerender(); });
      }
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.hasAttribute('data-sync-input')) { var j = el.querySelector('[data-act="sync-join"]'); if (j) j.click(); }
    });
    return stopStatus;
  };
})(self);
