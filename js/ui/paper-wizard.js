/* New paper: choose format, chapters, details and sections, then build it. */
(function (root) {
  'use strict';
  var QPG = root.QPG;
  QPG.views = QPG.views || {};
  var esc = function (s) { return QPG.questionHtml.esc(s); };
  var icon = function (n) { return QPG.ui.icon(n); };

  QPG.views.newPaper = function (el) {
    var app = QPG.app, T = QPG.templates;
    var templates = app.userTemplates ? app.userTemplates() : app.templateList();
    var defaultId = templates[0] ? templates[0].id : '';
    var st = {
      templateId: (app.state.lastTemplateId && templates.some(function (t) { return t.id === app.state.lastTemplateId; })) ? app.state.lastTemplateId : defaultId,
      chapters: null, sets: 1, mode: 'auto', avoidUsed: true,
      title: '', examName: '', paperLabel: '', date: '', duration: '', totalMarks: '', sections: null
    };

    function tpl() { return app.template(st.templateId); }
    function resetFromTemplate() {
      var t = tpl();
      if (!t) return;
      var questions = app.userQuestions ? app.userQuestions() : app.state.questions;
      var counts = QPG.filters.chapterCounts(questions, t.subject, t.std);
      st.chapters = Object.keys(counts).map(Number).sort(function (a, b) { return a - b; });
      st.title = t.paperLabel || '';
      st.examName = t.examName || ''; st.paperLabel = t.paperLabel || '';
      st.duration = t.duration || ''; st.totalMarks = t.totalMarks;
      st.sections = T.clone(t.sections);
    }
    resetFromTemplate();

    function available(sec) {
      var t = tpl();
      if (!t) return 0;
      var questions = app.userQuestions ? app.userQuestions() : app.state.questions;
      return questions.filter(function (q) {
        return q.subject === t.subject && Number(q.std) === Number(t.std) && st.chapters.indexOf(Number(q.chapter)) >= 0 &&
          Number(q.marks) === Number(sec.marks) && sec.types.indexOf(q.type) >= 0 &&
          (!st.avoidUsed || !(q.usage || []).length);
      }).length;
    }

    el.innerHTML = '<div class="page-head"><div><h1>નવું પેપર</h1><p>ફોર્મેટ અને પ્રકરણ પસંદ કરો — પ્રશ્નો આપોઆપ ગોઠવાશે, પછી જોઈએ તે બદલી શકાશે.</p></div></div>' +
      '<form class="wiz" novalidate>' +
        '<section class="panel"><h2>1. ફોર્મેટ</h2><div class="tpl-cards" data-tpls></div></section>' +
        '<section class="panel"><h2>2. પ્રકરણ</h2><div data-chapters></div></section>' +
        '<section class="panel"><h2>3. વિભાગ અને ગુણ</h2><div data-sections></div></section>' +
        '<section class="panel"><h2>4. પેપરની વિગત</h2><div class="row row-3" data-details></div></section>' +
        '<section class="panel"><h2>5. પ્રશ્નો કેવી રીતે પસંદ કરવા?</h2><div data-mode></div></section>' +
        '<div class="notice notice-error" data-err hidden></div>' +
        '<div class="form-foot"><a class="btn btn-quiet" href="#/papers">રદ કરો</a><span class="spacer"></span>' +
          '<button type="submit" class="btn btn-primary">' + icon('newpaper') + 'પેપર બનાવો</button></div>' +
      '</form>';
    var $ = function (s) { return el.querySelector(s); };

    function drawTemplates() {
      $('[data-tpls]').innerHTML = templates.map(function (t) {
        var total = T.templateTotal(t.sections);
        return '<label class="tpl-card"><input type="radio" name="tpl" value="' + esc(t.id) + '"' + (t.id === st.templateId ? ' checked' : '') + '>' +
          '<span class="tpl-mini style-' + esc(t.style) + '"><b>' + esc(t.header.institute) + '</b></span>' +
          '<span class="tpl-name">' + esc(QPG.syllabus.subjectName(t.subject)) + ' · ધોરણ ' + esc(t.std) + '</span>' +
          '<span class="tpl-meta">' + t.sections.length + ' વિભાગ · ' + total + ' ગુણ' + (t.duration ? ' · ' + esc(t.duration) : '') + '</span></label>';
      }).join('');
    }

    function drawChapters() {
      var t = tpl();
      if (!t) {
        $('[data-chapters]').innerHTML = '<div class="notice notice-error">કોઈ ફોર્મેટ ઉપલબ્ધ નથી.</div>';
        return;
      }
      var questions = app.userQuestions ? app.userQuestions() : app.state.questions;
      var counts = QPG.filters.chapterCounts(questions, t.subject, t.std);
      var list = QPG.syllabus.chapters(t.subject, t.std);
      var total = Object.keys(counts).reduce(function (n, k) { return n + counts[k]; }, 0);
      $('[data-chapters]').innerHTML =
        (total ? '' : '<div class="notice notice-demo">' + icon('info') + '<div>આ વિષય અને ધોરણમાં હજુ એક પણ પ્રશ્ન નથી. પહેલાં <a href="#/questions/new">પ્રશ્નો ઉમેરો</a> અથવા <a href="#/import">Import કરો</a>; ખાલી પેપર બનાવીને પછી પણ ભરી શકાશે.</div></div>') +
        '<div class="chip-actions"><button type="button" class="btn btn-sm" data-act="ch-all">બધાં</button>' +
        '<button type="button" class="btn btn-sm" data-act="ch-has">પ્રશ્નો હોય તેવાં</button>' +
        '<button type="button" class="btn btn-sm btn-quiet" data-act="ch-none">એક પણ નહીં</button>' +
        '<span class="hint" data-chtext></span></div>' +
        '<div class="chips">' + list.map(function (c) {
          var n = counts[c.no] || 0;
          return '<label class="chip' + (n ? '' : ' is-empty') + '"><input type="checkbox" value="' + c.no + '"' + (st.chapters.indexOf(c.no) >= 0 ? ' checked' : '') + '>' +
            '<span><b>' + c.no + '</b> ' + esc(c.name) + ' <em>' + n + '</em></span></label>';
        }).join('') + '</div>';
      $('[data-chtext]').textContent = st.chapters.length ? 'પેપર પર: CH ' + QPG.syllabus.chapterRangeText(st.chapters) : '';
    }

    function drawSections() {
      var total = T.templateTotal(st.sections);
      var target = Number(st.totalMarks) || 0;
      $('[data-sections]').innerHTML =
        '<div class="table-wrap"><table class="sec-table"><thead><tr><th>વિભાગ</th><th>છાપવાના પ્રશ્નો</th><th>લખવાના (કોઈપણ)</th><th>દરેકના ગુણ</th><th>કુલ</th><th>બેંકમાં મળે છે</th></tr></thead><tbody>' +
        st.sections.map(function (s, i) {
          var av = available(s);
          var low = st.mode === 'auto' && av < s.print;
          return '<tr><th scope="row">' + esc(QPG.assembly.sectionTitle(s)) + '</th>' +
            '<td><input class="input num" type="number" min="1" inputmode="numeric" data-sec="' + i + '" data-k="print" value="' + esc(s.print) + '" aria-label="' + esc(QPG.assembly.sectionTitle(s)) + ' છાપવાના પ્રશ્નો"></td>' +
            '<td><input class="input num" type="number" min="1" inputmode="numeric" data-sec="' + i + '" data-k="attempt" value="' + esc(s.attempt) + '" aria-label="લખવાના પ્રશ્નો"></td>' +
            '<td><input class="input num" type="number" min="0.5" step="0.5" inputmode="decimal" data-sec="' + i + '" data-k="marks" value="' + esc(s.marks) + '" aria-label="દરેકના ગુણ"></td>' +
            '<td class="tot">' + T.sectionTotal(s) + '</td>' +
            '<td class="' + (low ? 'low' : 'okc') + '">' + av + (low ? ' — ઓછા' : '') + '</td></tr>';
        }).join('') +
        '</tbody><tfoot><tr><th colspan="4">કુલ ગુણ (વિભાગો પ્રમાણે)</th><td class="tot">' + total + '</td><td></td></tr></tfoot></table></div>' +
        (target && total !== target ? '<div class="notice notice-demo" style="margin:10px 0 0">' + icon('warn') + '<div>વિભાગો પ્રમાણે ' + total + ' ગુણ થાય છે, પણ પેપર પર કુલ ગુણ ' + target + ' છે. વિભાગ અથવા કુલ ગુણ સુધારો.</div></div>' : '') +
        '<p class="hint" style="margin:8px 0 0;color:var(--muted);font-size:14px">"બેંકમાં મળે છે" = પસંદ કરેલાં પ્રકરણમાં એ ગુણ અને પ્રકારના પ્રશ્નો. ઓછા હોય તો પેપરમાં જગ્યા ખાલી રહેશે, જે પછી જાતે ભરી શકાશે.</p>';
    }

    function drawDetails() {
      var t = tpl();
      var f = function (k, lbl, type, ph) {
        return '<div class="field"><label for="w-' + k + '">' + lbl + '</label><input id="w-' + k + '" class="input" data-d="' + k + '"' +
          (type ? ' type="' + type + '"' : '') + ' value="' + esc(st[k]) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '></div>';
      };
      $('[data-details]').innerHTML =
        f('title', 'પેપરનું નામ (યાદી માટે)', '', 'દા.ત. TEST PAPER-12') +
        (t.style === 'maths' ? f('paperLabel', 'પેપર લેબલ (જમણી બાજુ)', '', 'TEST PAPER-12') : '') +
        f('examName', 'પરીક્ષાનું નામ', '', 'દા.ત. પ્રથમ પરીક્ષા') +
        f('totalMarks', 'કુલ ગુણ', 'number') +
        f('duration', 'સમય', '', t.style === 'maths' ? 'ખાલી રાખો તો નહીં છપાય' : '2:00 hr') +
        f('date', 'તારીખ (વૈકલ્પિક)', '', 'દા.ત. 25-10-2026');
    }

    function drawMode() {
      $('[data-mode]').innerHTML =
        '<div class="radio-list">' +
          '<label><input type="radio" name="mode" value="auto"' + (st.mode === 'auto' ? ' checked' : '') + '><span><b>આપોઆપ પસંદ કરો</b><small>દરેક વિભાગમાં યોગ્ય ગુણ અને પ્રકારના પ્રશ્નો, બધાં પ્રકરણમાંથી વહેંચીને. પછી કોઈ પણ પ્રશ્ન બદલી શકાશે.</small></span></label>' +
          '<label><input type="radio" name="mode" value="manual"' + (st.mode === 'manual' ? ' checked' : '') + '><span><b>હું જાતે પસંદ કરીશ</b><small>ખાલી પેપર ખૂલશે; દરેક વિભાગમાં પ્રશ્નો પસંદ કરો.</small></span></label>' +
        '</div>' +
        '<label class="check-line"><input type="checkbox" data-avoid' + (st.avoidUsed ? ' checked' : '') + '> પહેલાં બીજા પેપરમાં વપરાયેલા પ્રશ્નો ન લેવા</label>' +
        '<div class="field" style="max-width:360px;margin-top:10px"><span class="lbl">Sets</span><div class="seg">' +
          [1, 2].map(function (n) { return '<label><input type="radio" name="sets" value="' + n + '"' + (st.sets === n ? ' checked' : '') + '><span>' + (n === 1 ? 'ફક્ત Set A' : 'Set A અને Set B') + '</span></label>'; }).join('') +
        '</div><span class="hint">Set B માં Set A થી જુદા પ્રશ્નો આવશે (બેંકમાં પૂરતા હોય તો).</span></div>';
    }

    function drawAll() { drawTemplates(); drawChapters(); drawSections(); drawDetails(); drawMode(); }
    drawAll();

    el.addEventListener('change', function (e) {
      var t = e.target;
      if (t.name === 'tpl') { st.templateId = t.value; resetFromTemplate(); drawAll(); return; }
      if (t.closest('[data-chapters]') && t.type === 'checkbox') {
        st.chapters = Array.from(el.querySelectorAll('[data-chapters] input:checked')).map(function (x) { return Number(x.value); });
        drawChapters(); drawSections(); return;
      }
      if (t.name === 'mode') { st.mode = t.value; drawSections(); }
      if (t.name === 'sets') st.sets = Number(t.value);
      if (t.hasAttribute('data-avoid')) { st.avoidUsed = t.checked; drawSections(); }
      if (t.hasAttribute('data-sec')) {
        var s = st.sections[+t.getAttribute('data-sec')];
        s[t.getAttribute('data-k')] = Number(t.value) || 0;
        drawSections();
      }
    });
    el.addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-d');
      if (!k) return;
      st[k] = e.target.value;
      if (k === 'totalMarks') drawSections();
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var t = tpl();
      var counts = QPG.filters.chapterCounts(app.state.questions, t.subject, t.std);
      var act = b.getAttribute('data-act');
      if (act === 'ch-all') st.chapters = QPG.syllabus.chapters(t.subject, t.std).map(function (c) { return c.no; });
      if (act === 'ch-has') st.chapters = Object.keys(counts).map(Number);
      if (act === 'ch-none') st.chapters = [];
      st.chapters.sort(function (a, b2) { return a - b2; });
      drawChapters(); drawSections();
    });

    el.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var errs = [];
      if (!st.chapters.length) errs.push('ઓછામાં ઓછું એક પ્રકરણ પસંદ કરો.');
      st.sections.forEach(function (s) {
        if (!(s.print > 0) || !(s.attempt > 0) || !(s.marks > 0)) errs.push(QPG.assembly.sectionTitle(s) + ': બધી સંખ્યા 0 કરતાં વધારે હોવી જોઈએ.');
        else if (s.attempt > s.print) errs.push(QPG.assembly.sectionTitle(s) + ': લખવાના પ્રશ્નો છાપવાના પ્રશ્નો કરતાં વધારે ન હોઈ શકે.');
      });
      var box = $('[data-err]');
      if (errs.length) {
        box.hidden = false;
        box.innerHTML = icon('error') + '<div><b>પેપર બનાવતા પહેલાં આ સુધારો:</b><ul>' + errs.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></div>';
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      box.hidden = true;
      var t = tpl();
      var templ = Object.assign({}, t, { sections: st.sections });
      var paper = QPG.assembly.createPaper(templ, {
        chapters: st.chapters, sets: st.sets, title: st.title || st.paperLabel || '',
        meta: { examName: st.examName, paperLabel: st.paperLabel, duration: st.duration, date: st.date, totalMarks: Number(st.totalMarks) || T.templateTotal(st.sections) }
      });
      if (st.examName && !st.title) paper.title = st.examName + ' — ' + paper.title;
      var msg = 'ખાલી પેપર તૈયાર છે — પ્રશ્નો ઉમેરો';
      if (st.mode === 'auto') {
        var pool = st.avoidUsed ? app.state.questions.filter(function (q) { return !(q.usage || []).length; }) : app.state.questions;
        var r = QPG.assembly.autoFill(paper, pool, { seed: Date.now() % 2147483647 });
        paper = r.paper;
        var missing = r.shortages.reduce(function (n, s) { return n + (s.need - s.got); }, 0);
        msg = missing ? 'પેપર બન્યું — ' + missing + ' પ્રશ્નોની જગ્યા ખાલી છે' : 'પેપર બન્યું — બધા વિભાગ ભરાઈ ગયા';
      }
      app.state.lastTemplateId = st.templateId;
      app.savePaper(paper).then(function (saved) {
        QPG.ui.toast(msg);
        app.go('/papers/edit/' + saved.id);
      });
    });
  };
})(self);
