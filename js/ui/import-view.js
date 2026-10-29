/* Import questions: Excel / CSV, Word, pasted text, PDF (Gemini), JSON → review every question → save. */
(function (root) {
  'use strict';
  var QPG = root.QPG;
  QPG.views = QPG.views || {};
  var esc = function (s) { return QPG.questionHtml.esc(s); };
  var icon = function (n) { return QPG.ui.icon(n); };

  function opt(v, l, sel) { return '<option value="' + esc(v) + '"' + (String(sel) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>'; }

  QPG.views.importView = function (el) {
    var app = QPG.app, S = QPG.schema;
    var allowedSubs = app.userSubjects ? app.userSubjects() : ['physics', 'maths', 'science'];
    var allowedStds = app.userStandards ? app.userStandards() : [8, 9, 10, 11, 12];
    var subList = QPG.syllabus.SUBJECTS.filter(function (s) { return allowedSubs.indexOf(s.id) !== -1; });
    var stdList = QPG.syllabus.STANDARDS.filter(function (s) { return allowedStds.indexOf(Number(s)) !== -1; });

    var defaultSub = subList.length ? subList[0].id : 'physics';
    var defaultStd = stdList.length ? stdList[0] : 11;

    var last = app.state.importDefaults || { subject: defaultSub, std: defaultStd, chapter: '', marks: '', type: 'auto', difficulty: 'medium', source: '' };
    if (allowedSubs.indexOf(last.subject) === -1 && subList.length) last.subject = subList[0].id;
    if (allowedStds.indexOf(Number(last.std)) === -1 && stdList.length) last.std = stdList[0];

    var st = { source: 'file', defaults: last, items: null, report: null, fileName: '', filter: 'all', saving: false, shown: 30 };

    el.innerHTML =
      '<div class="page-head"><div><h1>પ્રશ્નો Import કરો</h1><p>PDF, Word, Excel કે લખાણમાંથી ઘણા પ્રશ્નો એકસાથે. સેવ કરતાં પહેલાં દરેક પ્રશ્ન ચકાસી શકાશે.</p></div></div>' +
      '<div data-step1></div><div data-review></div>';
    var step1 = el.querySelector('[data-step1]'), review = el.querySelector('[data-review]');

    /* ---------- step 1: source + defaults ---------- */
    function drawStep1() {
      var d = st.defaults;
      var chapters = QPG.syllabus.chapters(d.subject, d.std);
      var hasGemini = QPG.gemini && QPG.gemini.hasApiKey();
      var geminiKey = (QPG.gemini && QPG.gemini.getApiKey()) || '';
      var geminiHtml =
        '<div class="gemini-bar" style="margin-bottom:14px;padding:12px 14px;background:linear-gradient(135deg,#f0f4ff,#e8f0fe);border:1px solid ' + (hasGemini ? '#9bc0f7' : '#d2dff6') + ';border-radius:var(--radius-sm)">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
            '<div style="display:flex;align-items:center;gap:8px">' +
              '<span style="font-size:18px">✨</span>' +
              '<div>' +
                '<b style="color:var(--ink-strong)">Gemini AI પ્રશ્નો & ગણિતનાં સૂત્રો (Equations) Import</b>' +
                (hasGemini
                  ? '<span style="margin-left:8px;font-size:12px;background:#e6f4ec;color:#1d7a4c;padding:2px 8px;border-radius:99px;font-weight:700">✓ સક્રિય (Active)</span>'
                  : '<span style="margin-left:8px;font-size:12px;background:#fff2d6;color:#8a5a00;padding:2px 8px;border-radius:99px">PDF અને સૂત્રો માટે Key દાખલ કરો</span>') +
                '<div style="font-size:13px;color:var(--muted)">PDF અને Word માંથી 100% સચોટ ગુજરાતી અને LaTeX સૂત્રો ($...$) લાવવા માટે.</div>' +
              '</div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
              '<input type="password" class="input input-sm" style="width:200px;background:#fff" placeholder="Gemini API Key" data-gemini-key value="' + esc(geminiKey) + '">' +
              '<button type="button" class="btn btn-sm btn-primary" data-act="save-gemini-key">સાચવો / ચકાસો</button>' +
              '<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" style="font-size:12.5px;color:var(--ink);text-decoration:underline">મફત Key મેળવો ↗</a>' +
            '</div>' +
          '</div>' +
        '</div>';

      step1.innerHTML =
        geminiHtml +
        '<section class="panel"><h2>1. ક્યાંથી?</h2><div class="seg seg-wrap" role="tablist">' +
          [['file', 'PDF / Word / Excel / CSV ફાઇલ'], ['paste', 'લખાણ પેસ્ટ કરો']].map(function (s) {
            return '<label><input type="radio" name="src" value="' + s[0] + '"' + (st.source === s[0] ? ' checked' : '') + '><span>' + s[1] + '</span></label>';
          }).join('') + '</div>' +
          (st.source === 'file'
            ? '<label class="drop" data-drop><input type="file" data-file accept=".pdf,.docx,.xlsx,.csv,.txt,.json,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,text/plain,application/json" hidden>' +
                icon('upload') + '<b>ફાઇલ પસંદ કરો</b><span>.pdf, .docx (Word), .xlsx (Excel), .csv, .txt અથવા .json — અહીં ખેંચીને પણ મૂકી શકો.</span></label>' +
              '<div class="import-help"><div><b>PDF:</b> પ્રશ્નપત્રની PDF અપલોડ કરો — Gemini AI આપોઆપ બધા પ્રશ્નો, ગણિતનાં સૂત્રો ($...$) અને વિકલ્પો વાંચી લેશે.</div>' +
              '<div><b>Word:</b> પ્રશ્નો 1) 2) 3), વિકલ્પ (A) (B) (C) (D), "જવાબ: C". Sulekh, Gopika, Terafont ફોન્ટ Unicode માં ફેરવાશે અને Word નાં સૂત્રો (Equation) પણ આવશે.</div>' +
              '<div><b>Excel / CSV:</b> દરેક લાઇનમાં એક પ્રશ્ન. <a href="samples/prashno-namuno.xlsx" download>નમૂના Excel ફાઇલ</a> · <a href="samples/prashno-namuno.csv" download>CSV</a></div></div>'
            : '<div class="field" style="margin-top:12px"><label for="imp-paste">પ્રશ્નો અહીં પેસ્ટ કરો</label>' +
                '<textarea id="imp-paste" class="input" rows="10" data-paste placeholder="1) પ્રવેગ એટલે કણના ..........&#10;(A) વેગ (B) બળ (C) વેગના ફેરફારનો દર (D) દળ&#10;જવાબ: C&#10;2) ...">' + esc(st.pasted || '') + '</textarea>' +
                '<span class="hint">Word કે PDF માંથી કૉપી કરેલું લખાણ પણ ચાલશે; જૂના ફોન્ટનું લખાણ આપોઆપ ફેરવાશે.</span></div>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
                '<button type="button" class="btn btn-primary" data-act="read-paste">' + icon('search') + 'પ્રશ્નો શોધો</button>' +
                '<button type="button" class="btn" data-act="gemini-paste">✨ Gemini AI વડે સચોટ શોધો (સૂત્રો સાથે)</button>' +
              '</div>') +
        '</section>' +
        '<section class="panel"><h2>2. ફાઇલમાં ન લખ્યું હોય તો</h2><p class="muted-p">ફાઇલની કૉલમમાં વિષય, પ્રકરણ, ગુણ લખેલા હોય તો એ જ લેવાશે; નહીં તો આ મૂલ્ય વપરાશે.</p><div class="row row-4">' +
          '<label class="field"><span class="lbl">વિષય</span><select class="input" data-d="subject">' + subList.map(function (s) { return opt(s.id, s.gu, d.subject); }).join('') + '</select></label>' +
          '<label class="field"><span class="lbl">ધોરણ</span><select class="input" data-d="std">' + stdList.map(function (s) { return opt(s, 'ધોરણ ' + s, d.std); }).join('') + '</select></label>' +
          '<label class="field"><span class="lbl">પ્રકરણ</span><select class="input" data-d="chapter">' + opt('', '— પસંદ કરો —', d.chapter) + chapters.map(function (c) { return opt(c.no, c.no + '. ' + c.name, d.chapter); }).join('') + '</select></label>' +
          '<label class="field"><span class="lbl">ગુણ</span><input class="input" type="number" min="0.5" step="0.5" data-d="marks" value="' + esc(d.marks) + '" placeholder="મથાળા/કૉલમ પરથી"></label>' +
          '<label class="field"><span class="lbl">પ્રકાર</span><select class="input" data-d="type">' + opt('auto', 'આપોઆપ ઓળખો', d.type) + S.TYPES.map(function (t) { return opt(t.id, t.gu, d.type); }).join('') + '</select></label>' +
          '<label class="field"><span class="lbl">કઠિનતા</span><select class="input" data-d="difficulty">' + S.DIFFICULTIES.map(function (x) { return opt(x.id, x.gu, d.difficulty); }).join('') + '</select></label>' +
          '<label class="field" style="grid-column: span 2"><span class="lbl">સંદર્ભ / સ્રોત</span><input class="input" data-d="source" value="' + esc(d.source) + '" placeholder="દા.ત. Test Paper-12, 2025"></label>' +
        '</div>' + (st.items ? '<button type="button" class="btn btn-sm" data-act="reapply" style="margin-top:10px">આ મૂલ્ય ફરીથી લાગુ કરો</button>' : '') + '</section>';
    }

    /* ---------- reading ---------- */
    function defaultsForParse() {
      var d = st.defaults;
      return { subject: d.subject, std: Number(d.std), chapter: d.chapter ? Number(d.chapter) : null, marks: d.marks === '' ? null : Number(d.marks), type: d.type, difficulty: d.difficulty, source: d.source || st.fileName };
    }
    var lastInput = null;   // {kind, data} so defaults can be re-applied
    function parse(kind, data) {
      lastInput = { kind: kind, data: data };
      var def = defaultsForParse(), I = QPG.importer, bank = app.state.questions, r;
      if (kind === 'rows') r = I.fromRows(data, def, bank);
      else if (kind === 'json') r = I.fromJSON(data, def, bank);
      else r = I.fromText(data, def, bank);
      if (r.headerError) { st.items = null; showError(r.headerError); return; }
      st.items = r.items.map(function (it) { it.include = !it.duplicate; return it; });
      st.unknownColumns = r.unknownColumns || [];
      st.skippedLines = r.skippedLines || 0;
      st.filter = 'all'; st.shown = 30;
      drawStep1(); drawReview();
      review.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function showError(msg) {
      review.innerHTML = '<div class="notice notice-error">' + icon('error') + '<div style="white-space:pre-line;line-height:1.5">' + esc(msg) + '</div></div>';
    }
    function readFile(file) {
      if (!file) return;
      st.fileName = file.name; st.report = null; st.docxLines = null;
      var name = file.name.toLowerCase();
      review.innerHTML = '<p class="muted-p">"' + esc(file.name) + '" વંચાય છે…</p>';
      var p;
      if (/\.xlsx$/.test(name)) p = QPG.files.readXlsx(file).then(function (rows) { parse('rows', rows); });
      else if (/\.docx$/.test(name)) p = QPG.files.readDocx(file).then(function (res) { st.report = res.report; st.docxLines = res.lines; parse('lines', res.lines); });
      else if (/\.pdf$/.test(name)) {
        if (!QPG.gemini || !QPG.gemini.hasApiKey()) {
          showError('PDF માંથી પ્રશ્નો અને ગણિતનાં સમીકરણો (Equations) સચોટ લાવવા માટે ઉપર "Gemini AI API Key" દાખલ કરી "સાચવો" પર ક્લિક કરો.\n(Google AI Studio પરથી મફત API Key મળી જાય છે).');
          return;
        }
        review.innerHTML = '<div class="panel" style="text-align:center;padding:36px 20px"><div class="spinner" style="margin:0 auto 16px"></div><h2>✨ Gemini AI પેપર વાંચી રહ્યું છે…</h2><p class="muted-p">"' + esc(file.name) + '" માંથી બધા પ્રશ્નો, વિકલ્પો અને ગણિતનાં સૂત્રો (LaTeX) અલગ પાડી રહ્યું છે.<br>પેપરની લંબાઈ મુજબ 5 થી 15 સેકન્ડ થઈ શકે છે. કૃપા કરીને થોડી રાહ જુઓ…</p></div>';
        p = QPG.gemini.extractFromPdf(file, defaultsForParse()).then(function (qs) {
          parse('json', qs);
          QPG.ui.toast('✨ Gemini AI વડે ' + qs.length + ' પ્રશ્નો સફળતાપૂર્વક લાવ્યા!');
        });
      }
      else if (/\.json$/.test(name)) p = QPG.files.readAsText(file).then(function (t) { parse('json', t); });
      else if (/\.csv$/.test(name)) p = QPG.files.readAsText(file).then(function (t) { parse('rows', QPG.importer.parseCSV(t)); });
      else if (/\.txt$/.test(name)) p = QPG.files.readAsText(file).then(function (t) { parse('lines', t); });
      else if (/\.(doc|xls)$/.test(name)) { showError('જૂની .doc / .xls ફાઇલ સીધી વંચાતી નથી. Word/Excel માં ખોલીને "Save As" → .docx / .xlsx તરીકે સેવ કરો, પછી અહીં પસંદ કરો.'); return; }
      else { showError('આ પ્રકારની ફાઇલ ઓળખાઈ નહીં. .pdf, .docx, .xlsx, .csv, .txt અથવા .json પસંદ કરો.'); return; }
      p.catch(function (e) { showError((e && e.message) || String(e)); });
    }

    /* ---------- step 2: review ---------- */
    function counts() {
      var c = { all: st.items.length, ok: 0, warn: 0, err: 0, dup: 0, include: 0, imgNeeded: 0 };
      st.items.forEach(function (it) {
        if (!it.ok) c.err++; else if (it.duplicate) c.dup++; else if (it.warnings.length) c.warn++; else c.ok++;
        if (it.include) c.include++;
        var q = it.question;
        if (!q.image && (it.warnings.some(function (w) { return /આકૃતિ/i.test(w.msg || ''); }) || /આકૃતિ/i.test(q.text || '') || (it.flags && it.flags.indexOf('bad-image') >= 0))) {
          c.imgNeeded++;
        }
      });
      return c;
    }
    function status(it) { return !it.ok ? 'err' : it.duplicate ? 'dup' : it.warnings.length ? 'warn' : 'ok'; }

    function itemHtml(it, i) {
      var q = it.question, s = status(it);
      var label = { ok: 'બરાબર', warn: 'ચકાસો', err: 'સુધારવું જરૂરી (પેપરમાં વાપરી શકાશે)', dup: it.duplicate === 'bank' ? 'બેંકમાં પહેલેથી છે' : 'ફાઇલમાં બે વાર' }[s];
      var msgs = it.errors.map(function (e) { return '<li class="is-error">' + icon('error') + esc(e.msg) + '</li>'; })
        .concat(it.warnings.map(function (w) { return '<li class="is-warn">' + icon('warn') + esc(w.msg) + '</li>'; })).join('');
      var chapters = QPG.syllabus.chapters(q.subject, q.std);

      var needsImage = !q.image && (
        it.warnings.some(function (w) { return /આકૃતિ/i.test(w.msg || ''); }) ||
        /આકૃતિ/i.test(q.text || '') ||
        (it.flags && it.flags.indexOf('bad-image') >= 0)
      );

      var imgPrompt = '';
      if (needsImage) {
        imgPrompt = '<div class="imp-img-prompt" style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fffbeb;border:1.5px dashed #f59e0b;padding:10px 14px;border-radius:6px;margin:8px 0">' +
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<span style="font-size:22px">📷</span>' +
            '<div>' +
              '<b style="color:#92400e;display:block;font-size:13.5px">આ પ્રશ્નમાં આકૃતિ ઉમેરવી જરૂરી છે!</b>' +
              '<span style="color:#b45309;font-size:12px">પ્રશ્નમાં આકૃતિનો ઉલ્લેખ છે. અહીં ક્લિક કરી આકૃતિ અપલોડ કરો:</span>' +
            '</div>' +
          '</div>' +
          '<label class="btn btn-sm btn-primary" style="margin:0;cursor:pointer;white-space:nowrap">' +
            icon('upload') + 'આકૃતિ અપલોડ કરો (PNG/JPG)' +
            '<input type="file" accept="image/*" data-qimg hidden>' +
          '</label>' +
        '</div>';
      } else if (q.image) {
        imgPrompt = '<div style="margin:6px 0;display:flex;align-items:center;gap:10px">' +
          '<span style="font-size:12.5px;color:#16a34a;font-weight:600">✓ આકૃતિ જોડેલી છે</span>' +
          '<label class="btn btn-sm btn-quiet" style="cursor:pointer;font-size:12px;padding:2px 8px">' +
            icon('edit') + 'આકૃતિ બદલો' +
            '<input type="file" accept="image/*" data-qimg hidden>' +
          '</label>' +
          '<button type="button" class="btn btn-sm btn-quiet" data-act="img-del" style="font-size:12px;padding:2px 8px;color:#dc2626">' +
            icon('trash') + 'કાઢો' +
          '</button>' +
        '</div>';
      }

      return '<li class="imp-item is-' + s + '" data-i="' + i + '">' +
        '<label class="imp-check"><input type="checkbox" data-inc' + (it.include ? ' checked' : '') + ' aria-label="' + esc(it.ref) + ' સેવ કરો"></label>' +
        '<div class="imp-main">' +
          '<div class="imp-top"><span class="imp-ref">' + esc(it.ref) + '</span><span class="imp-status">' + label + '</span>' +
            '<select class="input input-sm" data-q="chapter" aria-label="પ્રકરણ">' + opt('', 'પ્રકરણ?', q.chapter) + chapters.map(function (c) { return opt(c.no, c.no + '. ' + c.name, q.chapter); }).join('') + '</select>' +
            '<select class="input input-sm" data-q="type" aria-label="પ્રકાર">' + S.TYPES.map(function (t) { return opt(t.id, t.gu, q.type); }).join('') + '</select>' +
            '<label class="imp-marks"><input class="input input-sm" type="number" min="0.5" step="0.5" data-q="marks" value="' + esc(q.marks == null ? '' : q.marks) + '" aria-label="ગુણ"> ગુણ</label>' +
            '<button type="button" class="btn btn-quiet btn-sm" data-act="edit">' + icon('edit') + 'પ્રશ્ન સુધારો</button>' +
          '</div>' +
          (msgs ? '<ul class="psec-issues">' + msgs + '</ul>' : '') +
          imgPrompt +
          '<div class="imp-q">' + QPG.questionHtml.render(q, { showAnswer: true }) + '</div>' +
          '<div class="imp-edit" hidden></div>' +
        '</div></li>';
    }

    function visible() {
      return st.items.map(function (it, i) { return { it: it, i: i }; }).filter(function (x) {
        if (st.filter === 'img-needed') {
          var q = x.it.question;
          return !q.image && (
            x.it.warnings.some(function (w) { return /આકૃતિ/i.test(w.msg || ''); }) ||
            /આકૃતિ/i.test(q.text || '') ||
            (x.it.flags && x.it.flags.indexOf('bad-image') >= 0)
          );
        }
        return st.filter === 'all' || status(x.it) === st.filter;
      });
    }

    function drawReview() {
      if (!st.items) { review.innerHTML = ''; return; }
      var c = counts();
      if (!c.all) {
        review.innerHTML = '<div class="empty"><strong>એક પણ પ્રશ્ન મળ્યો નહીં</strong>પ્રશ્નો 1) 2) 3) એમ નંબરવાળા હોય અથવા Excel માં "પ્રશ્ન" કૉલમ હોય તે ચકાસો.</div>';
        return;
      }
      var rep = st.report, repHtml = '';
      if (rep) {
        var kinds = Object.keys(rep.legacy || {}).map(function (k) { return k === 'sg' ? 'Sulekh / Gopika' : k === 'tera' ? 'Terafont' : k; });
        var uf = Object.keys(rep.unsupportedFonts || {});
        repHtml = '<div class="notice notice-info">' + icon('info') + '<div>Word ફાઇલ: ' + rep.equations + ' સૂત્રો, ' + rep.images + ' ચિત્રો' +
          (kinds.length ? ' · જૂના ફોન્ટ (' + esc(kinds.join(', ')) + ') Unicode માં ફેરવ્યા' : '') +
          (rep.badImages ? ' · ' + rep.badImages + ' ચિત્ર (EMF/WMF) વંચાયાં નહીં — એ પ્રશ્નોમાં આકૃતિ જાતે ઉમેરવી પડશે' : '') +
          (rep.oleEquations ? ' · ' + rep.oleEquations + ' જૂનાં MathType સૂત્રો ફેરવી શકાયાં નહીં — [સૂત્ર] ની જગ્યાએ લખવાં પડશે' : '') + '</div></div>' +
          (rep.unknownChars && rep.unknownChars.length ? '<div class="notice notice-demo">' + icon('warn') + '<div>આ જૂના-ફોન્ટ અક્ષર ઓળખાયા નહીં અને [?] તરીકે દેખાશે: <b>' + esc(rep.unknownChars.join(' ')) + '</b></div></div>' : '') +
          (uf.length ? '<div class="notice notice-error">' + icon('warn') + '<div>આ ફોન્ટ હજુ ફેરવી શકાતા નથી: <b>' + esc(uf.join(', ')) + '</b>. એ લખાણ ખોટું દેખાશે — એવા પ્રશ્નો સુધારો, અથવા એ ફોન્ટવાળી ફાઇલ મોકલો જેથી ફેરવવાનું ઉમેરી શકાય.</div></div>' : '');
      }

      var imgBanner = c.imgNeeded > 0
        ? '<div class="notice" style="background:#fffbeb;border:1.5px solid #fcd34d;padding:12px 16px;border-radius:6px;margin:10px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">' +
            '<div style="display:flex;align-items:center;gap:12px">' +
              '<span style="font-size:26px">📷</span>' +
              '<div>' +
                '<b style="color:#92400e;font-size:14.5px">આ ફાઇલમાં ' + c.imgNeeded + ' પ્રશ્નોમાં આકૃતિની જરૂર છે!</b>' +
                '<div style="font-size:13px;color:#78350f">નીચે દરેક પ્રશ્ન પર પીળા બોક્સમાં <b>"આકૃતિ અપલોડ કરો"</b> બટન આપેલું છે. ત્યાંથી સીધો ફોટો ઉમેરી શકો છો.</div>' +
              '</div>' +
            '</div>' +
            '<button type="button" class="btn btn-sm" style="background:#fef3c7;border:1px solid #f59e0b;color:#92400e;font-weight:700" data-filter="img-needed">' +
              icon('image') + 'ફક્ત આકૃતિવાળા ' + c.imgNeeded + ' પ્રશ્નો જુઓ' +
            '</button>' +
          '</div>'
        : '';

      var v = visible();
      review.innerHTML =
        '<section class="panel imp-review"><h2>3. ચકાસો અને સેવ કરો' + (st.fileName ? ' — ' + esc(st.fileName) : '') + '</h2>' + repHtml + imgBanner +
        (st.unknownColumns && st.unknownColumns.length ? '<div class="notice notice-demo">' + icon('warn') + '<div>આ કૉલમ ઓળખાઈ નહીં અને વપરાશે નહીં: ' + esc(st.unknownColumns.join(', ')) + '</div></div>' : '') +
        (st.items.some(function (it) { return it.errors.some(function (e) { return e.field === 'chapter'; }); })
          ? '<div class="notice notice-demo">' + icon('warn') + '<div>કેટલાક પ્રશ્નોમાં પ્રકરણ નથી. ઉપર "2." માં પ્રકરણ પસંદ કરીને <b>આ મૂલ્ય ફરીથી લાગુ કરો</b> દબાવો, અથવા નીચે "પ્રકરણ બદલો…" થી બધા માટે એકસાથે પસંદ કરો.</div></div>' : '') +
        (st.skippedLines ? '<p class="muted-p">પહેલા પ્રશ્ન પહેલાંની ' + st.skippedLines + ' લાઇન (પેપરનું મથાળું વગેરે) છોડી દીધી.</p>' : '') +
        '<div class="imp-sum">' +
          [['all', 'બધા', c.all], ['ok', 'બરાબર', c.ok], ['warn', 'ચકાસો', c.warn], ['err', 'સુધારવા જરૂરી', c.err], ['dup', 'ડુપ્લિકેટ', c.dup]].concat(
            c.imgNeeded > 0 ? [['img-needed', '📷 આકૃતિ બાકી', c.imgNeeded]] : []
          ).map(function (f) {
            return '<button type="button" class="pchip is-' + f[0] + (st.filter === f[0] ? ' is-on' : '') + '" data-filter="' + f[0] + '"' + (f[2] || f[0] === 'all' ? '' : ' disabled') + '>' + f[1] + ' <b>' + f[2] + '</b></button>';
          }).join('') +
          (c.err || c.warn || c.dup ? '<button type="button" class="btn btn-sm btn-quiet" data-act="report">' + icon('download') + 'ભૂલોની યાદી (CSV)</button>' : '') +
          '<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">' +
            '<button type="button" class="btn btn-sm" data-act="gemini-auto-answers" style="background:#1d7a4c;color:#fff;border-color:#166534;font-weight:600">✨ Gemini વડે બાકી જવાબો આપોઆપ શોધો</button>' +
            '<button type="button" class="btn btn-sm" data-act="gemini-enhance">✨ Gemini AI વડે સમીકરણો સુધારો</button>' +
          '</div>' +
        '</div>' +
        '<div class="imp-bulk"><span>દેખાતા બધા પ્રશ્નો માટે:</span>' +
          '<select class="input input-sm" data-bulk="chapter" aria-label="પ્રકરણ બદલો">' + opt('', 'પ્રકરણ બદલો…', '') + QPG.syllabus.chapters(st.defaults.subject, st.defaults.std).map(function (ch) { return opt(ch.no, ch.no + '. ' + ch.name, ''); }).join('') + '</select>' +
          '<input class="input input-sm" type="number" min="0.5" step="0.5" data-bulk="marks" placeholder="ગુણ" aria-label="ગુણ બદલો" style="width:80px">' +
          '<select class="input input-sm" data-bulk="difficulty" aria-label="કઠિનતા બદલો">' + opt('', 'કઠિનતા…', '') + S.DIFFICULTIES.map(function (x) { return opt(x.id, x.gu, ''); }).join('') + '</select>' +
          '<button type="button" class="btn btn-sm btn-quiet" data-act="sel-all">બધા પસંદ</button><button type="button" class="btn btn-sm btn-quiet" data-act="sel-none">એક પણ નહીં</button>' +
        '</div>' +
        '<ol class="imp-list">' + v.slice(0, st.shown).map(function (x) { return itemHtml(x.it, x.i); }).join('') + '</ol>' +
        (v.length > st.shown ? '<div class="more"><button type="button" class="btn" data-act="more">વધુ બતાવો (' + (v.length - st.shown) + ' બાકી)</button></div>' : '') +
        '<div class="form-foot"><button type="button" class="btn btn-quiet" data-act="cancel">રદ કરો</button><span class="spacer"></span>' +
          '<span class="muted-p" style="margin:0">' + c.include + ' પ્રશ્નો સેવ થશે</span>' +
          '<button type="button" class="btn btn-primary" data-act="save"' + (c.include ? '' : ' disabled') + '>' + icon('ok') + c.include + ' પ્રશ્નો બેંકમાં સેવ કરો</button></div>' +
        '</section>';
      QPG.math.render(review.querySelector('.imp-list'));
    }

    function redrawItem(i) {
      var li = review.querySelector('.imp-item[data-i="' + i + '"]');
      if (!li) return drawReview();
      var tmp = document.createElement('div');
      tmp.innerHTML = itemHtml(st.items[i], i);
      li.replaceWith(tmp.firstChild);
      QPG.math.render(review.querySelector('.imp-item[data-i="' + i + '"] .imp-q'));
      var c = counts();
      review.querySelectorAll('.imp-sum [data-filter]').forEach(function (b) {
        var k = b.getAttribute('data-filter');
        var val = k === 'img-needed' ? c.imgNeeded : c[k];
        if (b.querySelector('b')) b.querySelector('b').textContent = val || 0;
        b.disabled = !val && k !== 'all';
      });
      var saveBtn = review.querySelector('[data-act="save"]');
      if (saveBtn) {
        saveBtn.disabled = !c.include;
        saveBtn.lastChild.textContent = c.include + ' પ્રશ્નો બેંકમાં સેવ કરો';
        saveBtn.previousElementSibling.textContent = c.include + ' પ્રશ્નો સેવ થશે';
      }
    }

    function recheck(i) {
      var it = st.items[i];
      var wasIncluded = it.include;
      var res = QPG.importer.recheck(it, app.state.questions, st.items);
      res.include = res.ok && (wasIncluded || (!it.ok && res.ok)) && !(res.duplicate && !wasIncluded);
      st.items[i] = res;
    }

    function openEdit(i) {
      var it = st.items[i], li = review.querySelector('.imp-item[data-i="' + i + '"]');
      var box = li.querySelector('.imp-edit');
      box.hidden = false;
      var q = it.question;
      var isMcq = q.type === 'mcq';
      box.innerHTML =
        '<div class="imp-edit-box">' +
          '<div class="field"><label>પ્રશ્નનું લખાણ</label><textarea class="input" rows="3" data-eq="text">' + esc(q.text || '') + '</textarea></div>' +
          (isMcq ? '<div class="row row-2">' +
            ['A', 'B', 'C', 'D'].map(function (L, j) {
              return '<label class="field"><span class="lbl">(' + L + ')</span><input class="input" data-eq="opt.' + j + '" value="' + esc((q.options || [])[j] || '') + '"></label>';
            }).join('') + '</div>' : '') +
          '<div class="row row-2">' +
            (isMcq ? '<label class="field"><span class="lbl">સાચો જવાબ</span><select class="input" data-eq="answer">' +
              ['', 'A', 'B', 'C', 'D'].map(function (L) { return opt(L, L ? '(' + L + ')' : 'ખબર નથી', q.answer); }).join('') + '</select></label>'
              : '<label class="field"><span class="lbl">ટૂંકો જવાબ</span><input class="input" data-eq="answer" value="' + esc(q.answer || '') + '"></label>') +
            '<label class="field"><span class="lbl">સમજૂતી (Solution)</span><input class="input" data-eq="solution" value="' + esc(q.solution || '') + '"></label>' +
          '</div>' +
          '<div style="margin-top:8px;display:flex;gap:8px">' +
            '<button type="button" class="btn btn-sm btn-primary" data-act="edit-done">સુધારો સાચવો</button>' +
          '</div>' +
        '</div>';
      QPG.math.render(box);
    }

    function closeEdit(i) {
      var it = st.items[i], li = review.querySelector('.imp-item[data-i="' + i + '"]');
      var box = li.querySelector('.imp-edit');
      var q = it.question;
      var ta = box.querySelector('[data-eq="text"]'); if (ta) q.text = ta.value;
      if (q.type === 'mcq') {
        q.options = ['A', 'B', 'C', 'D'].map(function (L, j) {
          var inp = box.querySelector('[data-eq="opt.' + j + '"]'); return inp ? inp.value : '';
        });
      }
      var ansInp = box.querySelector('[data-eq="answer"]'); if (ansInp) q.answer = ansInp.value;
      var solInp = box.querySelector('[data-eq="solution"]'); if (solInp) q.solution = solInp.value;
      box.hidden = true; box.innerHTML = '';
      recheck(i); redrawItem(i);
    }

    /* ---------- error report ---------- */
    function downloadReport() {
      var rows = [['સ્થાન', 'સ્થિતિ', 'ભૂલ / ચેતવણી', 'પ્રશ્નની શરૂઆત']];
      st.items.forEach(function (it) {
        var start = String(it.question.text || it.question.assertion || '').replace(/\s+/g, ' ').slice(0, 70);
        it.errors.forEach(function (e) { rows.push([it.ref, 'ભૂલ', e.msg, start]); });
        it.warnings.forEach(function (w) { rows.push([it.ref, 'ચેતવણી', w.msg, start]); });
        if (it.duplicate) rows.push([it.ref, 'ડુપ્લિકેટ', it.duplicate === 'bank' ? 'પ્રશ્ન બેંકમાં પહેલેથી છે' : 'આ ફાઇલમાં બે વાર છે', start]);
      });
      var csv = '\uFEFF' + rows.map(function (r) { return r.map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = 'import-bhulo' + (st.fileName ? '-' + st.fileName.replace(/\.[^.]+$/, '') : '') + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    }

    /* ---------- save ---------- */
    function save() {
      if (st.saving) return;
      var chosen = st.items.filter(function (it) { return it.include; });
      if (!chosen.length) return;
      st.saving = true;
      var now = new Date().toISOString();
      var u = QPG.auth && QPG.auth.user();
      var uEmail = u && u.email ? u.email.toLowerCase().trim() : '';
      var uName = u && u.name ? u.name : (uEmail ? uEmail.split('@')[0] : '');

      var list = chosen.map(function (it) {
        var raw = it.question;
        if (!raw.subject) raw.subject = st.defaults.subject || 'physics';
        if (!raw.std) raw.std = Number(st.defaults.std || 11);
        if (!raw.chapter) raw.chapter = st.defaults.chapter ? Number(st.defaults.chapter) : 1;
        if (!raw.marks || isNaN(raw.marks)) raw.marks = (raw.type === 'mcq' ? 1 : (st.defaults.marks ? Number(st.defaults.marks) : 1));
        var q = QPG.schema.normalizeQuestion(raw, now);
        q.isDemo = false;
        q.usage = [];
        if (uEmail) {
          q.createdBy = uEmail;
          q.creatorName = uName;
        }
        return q;
      });
      if (QPG.syllabus && QPG.syllabus.learnChaptersFromQuestions) {
        QPG.syllabus.learnChaptersFromQuestions(list);
      }
      QPG.db.bulkPut('questions', list).then(function () {
        list.forEach(app.upsertLocal);
        app.state.importDefaults = st.defaults;
        if (QPG.sync) QPG.sync.syncNow({ notify: true });
        var left = st.items.length - list.length;
        review.innerHTML = '<div class="panel imp-done">' + icon('ok') + '<div><h2>' + list.length + ' પ્રશ્નો પ્રશ્ન બેંકમાં સેવ થયા</h2>' +
          (left ? '<p class="muted-p">' + left + ' પ્રશ્નો સેવ ન કર્યા (ડુપ્લિકેટ અથવા તમે નાપસંદ કર્યા).</p>' : '') +
          '<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn-primary" href="#/questions">' + icon('bank') + 'પ્રશ્ન બેંક જુઓ</a>' +
          '<button type="button" class="btn" data-act="again">બીજી ફાઇલ Import કરો</button>' +
          '<a class="btn" href="#/new-paper">' + icon('newpaper') + 'નવું પેપર બનાવો</a></div></div></div>';
        st.items = null; st.saving = false; app.guard = null;
      }).catch(function (e) { st.saving = false; QPG.ui.toast('સેવ થઈ શક્યું નહીં: ' + (e && e.message || e)); });
    }

    /* ---------- events ---------- */
    el.addEventListener('change', function (e) {
      var t = e.target;
      if (t.name === 'src') { st.source = t.value; drawStep1(); return; }
      if (t.hasAttribute('data-file')) { readFile(t.files[0]); t.value = ''; return; }
      if (t.hasAttribute('data-d')) {
        var k = t.getAttribute('data-d');
        st.defaults[k] = t.type === 'number' || k === 'std' ? (t.value === '' ? '' : Number(t.value)) : t.value;
        if (k === 'subject') { st.defaults.std = QPG.syllabus.DEFAULT_STD[t.value] || 11; st.defaults.chapter = ''; }
        if (k === 'subject' || k === 'std') drawStep1();
        return;
      }
      var li = t.closest('.imp-item');
      if (li) {
        var i = +li.getAttribute('data-i'), it = st.items[i];
        if (t.hasAttribute('data-inc')) { it.include = t.checked; redrawItem(i); return; }
        if (t.hasAttribute('data-qimg') && t.files && t.files[0]) {
          QPG.files.readImage(t.files[0]).then(function (dataUrl) {
            it.question.image = dataUrl;
            recheck(i);
            openEdit(i);
            QPG.ui.toast('આકૃતિ સફળતાપૂર્વક ઉમેરાઈ!');
          }).catch(function (err) {
            QPG.ui.toast('આકૃતિ ઉમેરી શકાઈ નહીં: ' + (err && err.message || err));
          });
          return;
        }
        var qk = t.getAttribute('data-q');
        if (qk) { it.question[qk] = qk === 'type' ? t.value : (t.value === '' ? null : Number(t.value)); if (qk === 'type') it.question = QPG.schema.normalizeQuestion(Object.assign({}, it.question, { id: it.question.id })); recheck(i); redrawItem(i); }
        return;
      }
      var bk = t.getAttribute('data-bulk');
      if (bk && t.value !== '') {
        var val = bk === 'difficulty' ? t.value : Number(t.value);
        visible().forEach(function (x) { x.it.question[bk] = val; recheck(x.i); });
        QPG.ui.toast(visible().length + ' પ્રશ્નોમાં બદલ્યું');
        drawReview();
      }
    });
    el.addEventListener('input', function (e) { if (e.target.hasAttribute('data-paste')) st.pasted = e.target.value; });
    // text copied from Word carries its fonts as HTML: convert old-font pieces before they lose their font
    el.addEventListener('paste', function (e) {
      var ta = e.target;
      if (!ta.hasAttribute || !ta.hasAttribute('data-paste') || !e.clipboardData) return;
      var html = e.clipboardData.getData('text/html');
      if (html && /sulekh|gopika|terafont|symbol/i.test(html)) {
        e.preventDefault();
        QPG.files.htmlToLines(html).then(function (r) {
          var text = r.lines.map(function (l) { return l.text; }).join('\n');
          var s0 = ta.selectionStart, s1 = ta.selectionEnd;
          ta.value = ta.value.slice(0, s0) + text + ta.value.slice(s1);
          ta.selectionStart = ta.selectionEnd = s0 + text.length;
          st.pasted = ta.value;
          QPG.ui.toast(r.converted ? 'Guj_Gopika / Sulekh લખાણ Unicode માં ફેરવ્યું' : 'લખાણ પેસ્ટ થયું');
        });
        return;
      }
      var plain = e.clipboardData.getData('text/plain');
      if (plain && QPG.gujarati.looksLikeLegacyFont(plain)) {
        e.preventDefault();
        var converted = QPG.legacy.convertGuess(plain);
        var s0 = ta.selectionStart, s1 = ta.selectionEnd;
        ta.value = ta.value.slice(0, s0) + converted + ta.value.slice(s1);
        ta.selectionStart = ta.selectionEnd = s0 + converted.length;
        st.pasted = ta.value;
        QPG.ui.toast('Guj_Gopika / Sulekh લખાણ આપોઆપ Unicode માં ફેરવ્યું');
      }
    });
    el.addEventListener('click', function (e) {
      var f = e.target.closest('[data-filter]');
      if (f) { st.filter = f.getAttribute('data-filter'); st.shown = 30; drawReview(); return; }
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act'), li = b.closest('.imp-item'), i = li ? +li.getAttribute('data-i') : -1;
      if (act === 'save-gemini-key') {
        var inp = el.querySelector('[data-gemini-key]');
        var key = inp ? inp.value.trim() : '';
        if (!key) {
          if (QPG.gemini) QPG.gemini.setApiKey('');
          QPG.ui.toast('Gemini API Key કાઢી નાખી.');
          drawStep1();
          return;
        }
        b.textContent = 'ચકાસે છે…';
        (QPG.gemini ? QPG.gemini.testApiKey(key) : Promise.resolve()).then(function () {
          if (QPG.gemini) QPG.gemini.setApiKey(key);
          QPG.ui.toast('✨ Gemini API Key સફળતાપૂર્વક સાચવી અને ચકાસી લેવાઈ!');
          drawStep1();
        }).catch(function (err) {
          b.textContent = 'સાચવો / ચકાસો';
          QPG.ui.toast('API Key ભૂલ: ' + (err && err.message || err));
        });
        return;
      }
      if (act === 'gemini-paste') {
        if (!(st.pasted || '').trim()) { QPG.ui.toast('પહેલાં પ્રશ્નો પેસ્ટ કરો'); return; }
        if (!QPG.gemini || !QPG.gemini.hasApiKey()) {
          showError('Gemini AI વાપરવા માટે ઉપર "Gemini API Key" દાખલ કરી "સાચવો" પર ક્લિક કરો.');
          return;
        }
        review.innerHTML = '<div class="panel" style="text-align:center;padding:36px 20px"><div class="spinner" style="margin:0 auto 16px"></div><h2>✨ Gemini AI પ્રશ્નો અને સૂત્રો શોધી રહ્યું છે…</h2><p class="muted-p">પેસ્ટ કરેલા લખાણમાંથી બધા પ્રશ્નો, વિકલ્પો અને LaTeX ગણિતનાં સૂત્રો ($...$) તૈયાર થઈ રહ્યાં છે…</p></div>';
        QPG.gemini.extractFromText(st.pasted, defaultsForParse()).then(function (qs) {
          parse('json', qs);
          QPG.ui.toast('✨ Gemini AI વડે ' + qs.length + ' પ્રશ્નો સફળતાપૂર્વક લાવ્યા!');
        }).catch(function (e) { showError((e && e.message) || String(e)); });
        return;
      }
      if (act === 'gemini-enhance') {
        if (!QPG.gemini || !QPG.gemini.hasApiKey()) {
          showError('Gemini AI વાપરવા માટે ઉપર "Gemini API Key" દાખલ કરી "સાચવો" પર ક્લિક કરો.');
          return;
        }
        if (!st.items || !st.items.length) { QPG.ui.toast('સુધારવા માટે કોઈ પ્રશ્નો મળ્યા નહીં'); return; }

        review.innerHTML = '<div class="panel" style="text-align:center;padding:36px 20px">' +
          '<div class="spinner" style="margin:0 auto 16px"></div>' +
          '<h2>✨ Gemini AI સમીકરણો સુધારી રહ્યું છે…</h2>' +
          '<div style="max-width:360px;margin:16px auto;background:#e5e7eb;border-radius:999px;height:10px;overflow:hidden">' +
            '<div id="gemini-prog-bar" style="background:var(--primary,#2563eb);height:100%;width:0%;transition:width 0.25s ease"></div>' +
          '</div>' +
          '<p id="gemini-prog-desc" class="muted-p">પ્રશ્નો સુધરી રહ્યા છે: 0/' + st.items.length + ' (0%)</p>' +
          '</div>';

        QPG.gemini.enhanceItems(st.items, defaultsForParse(), function (prog) {
          var bar = document.getElementById('gemini-prog-bar');
          var desc = document.getElementById('gemini-prog-desc');
          if (bar) bar.style.width = prog.percent + '%';
          if (desc) desc.textContent = 'પ્રશ્નો સુધરી રહ્યા છે: ' + prog.current + '/' + prog.total + ' (' + prog.percent + '%)';
        }).then(function (updated) {
          st.items = updated;
          st.items.forEach(function (it, idx) {
            if (!it.question.chapter && st.defaults.chapter) it.question.chapter = Number(st.defaults.chapter);
            if (!it.question.marks && it.question.type === 'mcq') it.question.marks = 1;
            recheck(idx);
          });
          drawReview();
          QPG.ui.toast('✨ Gemini AI વડે પ્રશ્નો, સમીકરણો અને પ્રકરણો સફળતાપૂર્વક સુધારી લેવાયાં!');
        }).catch(function (e) {
          drawReview();
          showError('Gemini સુધારવામાં ભૂલ આવી: ' + (e && e.message || e));
        });
        return;
      }
      if (act === 'gemini-auto-answers') {
        if (!QPG.gemini || !QPG.gemini.hasApiKey()) {
          showError('Gemini AI વાપરવા માટે ઉપર "Gemini API Key" દાખલ કરી "સાચવો" પર ક્લિક કરો.');
          return;
        }
        if (!st.items || !st.items.length) { QPG.ui.toast('કોઈ પ્રશ્નો મળ્યા નહીં'); return; }

        var missing = st.items.filter(function (it) {
          var q = it.question;
          if (!q) return false;
          if (!q.answer || !String(q.answer).trim()) return true;
          if (q.type === 'mcq' && ['A', 'B', 'C', 'D'].indexOf(String(q.answer).trim().toUpperCase()) < 0) return true;
          return false;
        });

        if (!missing.length) {
          QPG.ui.toast('બધા જ પ્રશ્નોમાં જવાબો પહેલેથી હાજર છે!');
          return;
        }

        review.innerHTML = '<div class="panel" style="text-align:center;padding:36px 20px">' +
          '<div class="spinner" style="margin:0 auto 16px"></div>' +
          '<h2>✨ Gemini AI જવાબો શોધી રહ્યું છે (' + missing.length + ' પ્રશ્નો)…</h2>' +
          '<p class="muted-p">પ્રશ્નો અને વિકલ્પોનું વિશ્લેષણ કરીને સાચો વિકલ્પ (A, B, C, D) આપોઆપ પસંદ થઈ રહ્યો છે.</p>' +
          '<div style="max-width:360px;margin:16px auto;background:#e5e7eb;border-radius:999px;height:10px;overflow:hidden">' +
            '<div id="gemini-ans-bar" style="background:#16a34a;height:100%;width:0%;transition:width 0.25s ease"></div>' +
          '</div>' +
          '<p id="gemini-ans-desc" class="muted-p">જવાબો શોધી રહ્યા છે: 0/' + missing.length + ' (0%)</p>' +
          '</div>';

        QPG.gemini.autoSolveAnswers(st.items, defaultsForParse(), function (prog) {
          var bar = document.getElementById('gemini-ans-bar');
          var desc = document.getElementById('gemini-ans-desc');
          if (bar) bar.style.width = prog.percent + '%';
          if (desc) desc.textContent = 'જવાબો શોધી રહ્યા છે: ' + prog.current + '/' + prog.total + ' (' + prog.percent + '%)';
        }).then(function (updated) {
          st.items = updated;
          st.items.forEach(function (it, idx) { recheck(idx); });
          drawReview();
          QPG.ui.toast('✨ Gemini AI વડે ' + missing.length + ' પ્રશ્નોના જવાબો આપોઆપ શોધીને પસંદ કરી લેવાયા!');
        }).catch(function (e) {
          drawReview();
          showError('જવાબો શોધવામાં ભૂલ આવી: ' + (e && e.message || e));
        });
        return;
      }
      if (act === 'read-paste') {
        if (!(st.pasted || '').trim()) { QPG.ui.toast('પહેલાં પ્રશ્નો પેસ્ટ કરો'); return; }
        st.fileName = ''; st.report = null; parse('lines', st.pasted);
      } else if (act === 'reapply' && lastInput) parse(lastInput.kind, lastInput.data);
      else if (act === 'edit') openEdit(i);
      else if (act === 'edit-done') closeEdit(i);
      else if (act === 'img-del') { st.items[i].question.image = ''; recheck(i); openEdit(i); QPG.ui.toast('આકૃતિ કાઢી નાખી.'); }
      else if (act === 'more') { st.shown += 30; drawReview(); }
      else if (act === 'sel-all' || act === 'sel-none') { visible().forEach(function (x) { x.it.include = act === 'sel-all'; }); drawReview(); }
      else if (act === 'save') save();
      else if (act === 'report') downloadReport();
      else if (act === 'cancel' || act === 'again') { st.items = null; review.innerHTML = ''; drawStep1(); window.scrollTo(0, 0); }
    });
    // drag and drop a file on the drop area
    el.addEventListener('dragover', function (e) { if (e.target.closest('[data-drop]')) { e.preventDefault(); e.target.closest('[data-drop]').classList.add('is-over'); } });
    el.addEventListener('dragleave', function (e) { var d = e.target.closest('[data-drop]'); if (d) d.classList.remove('is-over'); });
    el.addEventListener('drop', function (e) {
      var d = e.target.closest('[data-drop]'); if (!d) return;
      e.preventDefault(); d.classList.remove('is-over');
      readFile(e.dataTransfer.files[0]);
    });

    app.guard = function () { return st.items && st.items.length ? 'Import કરેલા પ્રશ્નો હજુ સેવ નથી થયા.' : null; };
    drawStep1();
  };
})(self);
