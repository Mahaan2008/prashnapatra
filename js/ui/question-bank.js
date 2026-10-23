/* Question bank: search, filters, list with edit / duplicate / delete. */
(function (root) {
  'use strict';
  var QPG = root.QPG;
  QPG.views = QPG.views || {};
  var esc = function (s) { return QPG.questionHtml.esc(s); };
  var icon = function (n) { return QPG.ui.icon(n); };
  var PAGE = 30;

  function opt(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (String(selected) === String(value) ? ' selected' : '') + '>' + esc(label) + '</option>';
  }

  function chapterOptions(f) {
    if (!f.subject) return opt('', 'બધાં પ્રકરણ', f.chapter);
    var std = f.std || QPG.syllabus.DEFAULT_STD[f.subject];
    var list = QPG.syllabus.chapters(f.subject, std);
    return opt('', 'બધાં પ્રકરણ', f.chapter) + list.map(function (c) { return opt(c.no, c.no + '. ' + c.name, f.chapter); }).join('');
  }

  function filtersHtml(f, facets) {
    var S = QPG.schema;
    return '' +
      '<div class="field"><label for="f-subject">વિષય</label><select id="f-subject" class="input" data-f="subject">' +
        opt('', 'બધા વિષય', f.subject) + QPG.syllabus.SUBJECTS.map(function (s) { return opt(s.id, s.gu, f.subject); }).join('') + '</select></div>' +
      '<div class="field"><label for="f-std">ધોરણ</label><select id="f-std" class="input" data-f="std">' +
        opt('', 'બધાં ધોરણ', f.std) + QPG.syllabus.STANDARDS.map(function (s) { return opt(s, 'ધોરણ ' + s, f.std); }).join('') + '</select></div>' +
      '<div class="field"><label for="f-chapter">પ્રકરણ</label><select id="f-chapter" class="input" data-f="chapter"' + (f.subject ? '' : ' disabled') + '>' + chapterOptions(f) + '</select></div>' +
      '<div class="field"><label for="f-type">પ્રકાર</label><select id="f-type" class="input" data-f="type">' +
        opt('', 'બધા પ્રકાર', f.type) + S.TYPES.map(function (t) { return opt(t.id, t.gu, f.type); }).join('') + '</select></div>' +
      '<div class="field"><label for="f-marks">ગુણ</label><select id="f-marks" class="input" data-f="marks">' +
        opt('', 'બધા ગુણ', f.marks) + facets.marks.map(function (m) { return opt(m, m + ' ગુણ', f.marks); }).join('') + '</select></div>' +
      '<div class="field"><label for="f-diff">કઠિનતા</label><select id="f-diff" class="input" data-f="difficulty">' +
        opt('', 'બધી', f.difficulty) + S.DIFFICULTIES.map(function (d) { return opt(d.id, d.gu, f.difficulty); }).join('') + '</select></div>' +
      '<div class="field"><label for="f-used">અગાઉ વપરાયેલા</label><select id="f-used" class="input" data-f="used">' +
        opt('any', 'બધા', f.used) + opt('unused', 'ક્યારેય ન વપરાયેલા', f.used) + opt('used', 'વપરાયેલા', f.used) + '</select></div>' +
      '<div class="field"><label for="f-demo">ડેમો પ્રશ્નો</label><select id="f-demo" class="input" data-f="demo">' +
        opt('any', 'બતાવો', f.demo) + opt('hide', 'છુપાવો', f.demo) + opt('only', 'ફક્ત ડેમો', f.demo) + '</select></div>' +
      '<div class="field" style="grid-column: span 2"><label for="f-topic">મુદ્દો (Topic)</label><input id="f-topic" class="input" data-f="topic" list="f-topics" value="' + esc(f.topic || '') + '" placeholder="દા.ત. પ્રક્ષિપ્ત ગતિ">' +
        '<datalist id="f-topics">' + facets.topics.map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist></div>' +
      '<div class="filters-foot" style="grid-column: span 2; align-self:end"><button type="button" class="btn btn-quiet btn-sm" data-act="clear">ફિલ્ટર સાફ કરો</button></div>';
  }

  function cardHtml(q) {
    var S = QPG.schema;
    var ch = QPG.syllabus.chapterName(q.subject, q.std, q.chapter);
    var used = (q.usage || []).length;
    return '<li class="qcard" data-id="' + esc(q.id) + '">' +
      '<div class="qcard-body">' +
        '<div class="qcard-meta"><span class="ch">' + esc(QPG.syllabus.subjectName(q.subject)) + ' · ધો. ' + esc(q.std) + ' · પ્રક. ' + esc(q.chapter) + (ch ? ' ' + esc(ch) : '') + '</span>' +
        '<span>' + esc(S.typeLabel(q.type)) + '</span><span>' + esc(S.difficultyLabel(q.difficulty)) + '</span>' +
        (q.topic ? '<span>' + esc(q.topic) + '</span>' : '') +
        (used ? '<span>' + used + ' પેપરમાં વપરાયો</span>' : '') +
        (q.isDemo ? '<span class="badge badge-demo">ડેમો</span>' : '') + '</div>' +
        QPG.questionHtml.render(q, { showAnswer: QPG.app.state.showAnswers }) +
        '<div class="qcard-actions">' +
          '<a class="btn btn-quiet btn-sm" href="#/questions/edit/' + encodeURIComponent(q.id) + '">' + icon('edit') + 'સુધારો</a>' +
          '<a class="btn btn-quiet btn-sm" href="#/questions/copy/' + encodeURIComponent(q.id) + '">' + icon('copy') + 'નકલ</a>' +
          '<button type="button" class="btn btn-quiet btn-sm" data-act="delete" style="color:var(--red)">' + icon('trash') + 'કાઢી નાખો</button>' +
        '</div>' +
      '</div>' +
      '<div class="qcard-marks" aria-label="' + esc(q.marks) + ' ગુણ"><b>[' + esc(q.marks) + ']</b><small>ગુણ</small></div>' +
    '</li>';
  }

  QPG.views.bank = function (el, ctx) {
    var state = QPG.app.state;
    var f = state.bankFilters;
    // filters passed in the link (from the home screen) replace the current ones
    if (ctx.query && Object.keys(ctx.query).length) {
      f = state.bankFilters = { demo: 'any', used: 'any' };
      ['subject', 'std', 'chapter', 'type', 'q'].forEach(function (k) { if (ctx.query[k]) f[k] = ctx.query[k]; });
    }
    var shown = PAGE;
    var collapsed = true;

    el.innerHTML =
      '<div class="page-head"><div><h1>પ્રશ્ન બેંક</h1><p>બધા પ્રશ્નો, જવાબ અને ઉકેલ એક જગ્યાએ.</p></div>' +
      '<div class="actions"><button type="button" class="btn" data-act="answers">' + icon('eye') + '<span data-answers-label></span></button>' +
      '<a class="btn" href="#/import">' + icon('upload') + 'Import</a>' +
      '<a class="btn btn-primary hide-mobile" href="#/questions/new">' + icon('plus') + 'નવો પ્રશ્ન</a></div></div>' +
      '<div class="bank-tools"><div class="search">' + icon('search') +
        '<label class="sr-only" for="q-search">પ્રશ્ન શોધો</label>' +
        '<input id="q-search" class="input" type="search" placeholder="શબ્દ લખીને શોધો…" value="' + esc(f.q || '') + '"></div>' +
        '<button type="button" class="btn filter-toggle" data-act="toggle" aria-expanded="false" aria-controls="filters">' + icon('filter') + 'ફિલ્ટર</button></div>' +
      '<div id="filters" class="filters is-collapsed"></div>' +
      '<div class="result-line" aria-live="polite"></div>' +
      '<ul class="qlist"></ul><div class="more"></div>';

    var filtersEl = el.querySelector('#filters');
    var listEl = el.querySelector('.qlist');
    var resultEl = el.querySelector('.result-line');
    var moreEl = el.querySelector('.more');

    function setAnswersLabel() {
      el.querySelector('[data-answers-label]').textContent = state.showAnswers ? 'જવાબ છુપાવો' : 'જવાબ બતાવો';
    }

    function drawFilters() {
      filtersEl.innerHTML = filtersHtml(f, QPG.filters.facets(state.questions));
    }

    function criteria() {
      return {
        q: f.q, subject: f.subject, std: f.std, chapters: f.chapter ? [f.chapter] : null,
        types: f.type ? [f.type] : null, marks: f.marks ? [f.marks] : null, difficulty: f.difficulty ? [f.difficulty] : null,
        topic: f.topic, used: f.used, demo: f.demo
      };
    }

    function activeFilterCount() {
      return ['subject', 'std', 'chapter', 'type', 'marks', 'difficulty', 'topic'].filter(function (k) { return f[k]; }).length +
        (f.used && f.used !== 'any' ? 1 : 0) + (f.demo && f.demo !== 'any' ? 1 : 0);
    }

    function drawList() {
      var all = state.questions;
      var list = QPG.filters.sortQuestions(QPG.filters.filterQuestions(all, criteria()));
      var n = activeFilterCount();
      el.querySelector('[data-act="toggle"]').innerHTML = icon('filter') + 'ફિલ્ટર' + (n ? ' (' + n + ')' : '');

      if (!all.length) {
        resultEl.textContent = '';
        listEl.innerHTML = '<li class="empty"><strong>પ્રશ્ન બેંક ખાલી છે</strong>પહેલો પ્રશ્ન ઉમેરો — જવાબ અને ઉકેલ પણ સાથે સેવ થશે.<br>' +
          '<a class="btn btn-primary" href="#/questions/new">' + icon('plus') + 'પ્રશ્ન ઉમેરો</a></li>';
        moreEl.innerHTML = '';
        return;
      }
      if (!list.length) {
        resultEl.textContent = '';
        listEl.innerHTML = '<li class="empty"><strong>આ ફિલ્ટરમાં એક પણ પ્રશ્ન નથી</strong>ફિલ્ટર ઓછા કરો અથવા આ પ્રકરણ માટે પ્રશ્ન ઉમેરો.<br>' +
          '<button type="button" class="btn" data-act="clear">ફિલ્ટર સાફ કરો</button></li>';
        moreEl.innerHTML = '';
        return;
      }
      var totalMarks = list.reduce(function (s, q) { return s + (q.marks || 0); }, 0);
      resultEl.textContent = list.length + ' પ્રશ્નો' + (list.length !== all.length ? ' (કુલ ' + all.length + ' માંથી)' : '') + ' · કુલ ' + totalMarks + ' ગુણ';
      listEl.innerHTML = list.slice(0, shown).map(cardHtml).join('');
      QPG.math.render(listEl);
      moreEl.innerHTML = list.length > shown
        ? '<button type="button" class="btn" data-act="more">વધુ ' + Math.min(PAGE, list.length - shown) + ' બતાવો (' + (list.length - shown) + ' બાકી)</button>' : '';
    }

    function update() { shown = PAGE; drawList(); }

    filtersEl.addEventListener('change', function (e) {
      var k = e.target.getAttribute('data-f');
      if (!k) return;
      f[k] = e.target.value;
      if (k === 'subject') {
        f.chapter = '';
        f.std = f.subject ? String(QPG.syllabus.DEFAULT_STD[f.subject]) : '';
        drawFilters();
      }
      if (k === 'std') { f.chapter = ''; drawFilters(); }
      update();
    });
    filtersEl.addEventListener('input', QPG.ui.debounce(function (e) {
      if (e.target.getAttribute('data-f') === 'topic') { f.topic = e.target.value; update(); }
    }, 200));
    el.querySelector('#q-search').addEventListener('input', QPG.ui.debounce(function (e) { f.q = e.target.value; update(); }, 200));

    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'toggle') {
        collapsed = !collapsed;
        filtersEl.classList.toggle('is-collapsed', collapsed);
        b.setAttribute('aria-expanded', String(!collapsed));
      } else if (act === 'clear') {
        f = state.bankFilters = { demo: 'any', used: 'any' };
        el.querySelector('#q-search').value = '';
        drawFilters(); update();
      } else if (act === 'more') {
        shown += PAGE; drawList();
      } else if (act === 'answers') {
        state.showAnswers = !state.showAnswers; setAnswersLabel(); drawList();
      } else if (act === 'delete') {
        var id = b.closest('.qcard').getAttribute('data-id');
        var q = QPG.app.questionById(id);
        QPG.ui.confirmDialog({
          title: 'આ પ્રશ્ન કાઢી નાખવો છે?',
          body: (q && q.usage && q.usage.length ? 'આ પ્રશ્ન ' + q.usage.length + ' સેવ કરેલા પેપરમાં છે; એ પેપર બદલાશે નહીં. ' : '') + 'પ્રશ્ન બેંકમાંથી દૂર થશે.',
          ok: 'કાઢી નાખો', danger: true
        }).then(function (yes) {
          if (!yes) return;
          QPG.db.softDeleteQuestion(id).then(function (saved) {
            if (saved) QPG.app.upsertLocal(saved);
            QPG.ui.toast('પ્રશ્ન કાઢી નાખ્યો');
            drawFilters(); drawList();
          });
        });
      }
    });

    setAnswersLabel();
    drawFilters();
    drawList();
  };
})(self);
