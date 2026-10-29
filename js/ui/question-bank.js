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
    var allowedSubs = QPG.app && QPG.app.userSubjects ? QPG.app.userSubjects() : ['physics', 'maths', 'science'];
    var allowedStds = QPG.app && QPG.app.userStandards ? QPG.app.userStandards() : [8, 9, 10, 11, 12];
    var subList = QPG.syllabus.SUBJECTS.filter(function (s) { return allowedSubs.indexOf(s.id) !== -1; });
    var stdList = QPG.syllabus.STANDARDS.filter(function (s) { return allowedStds.indexOf(Number(s)) !== -1; });

    return '' +
      '<div class="field"><label for="f-subject">વિષય</label><select id="f-subject" class="input" data-f="subject">' +
        (subList.length > 1 ? opt('', 'બધા વિષય', f.subject) : '') + subList.map(function (s) { return opt(s.id, s.gu, f.subject); }).join('') + '</select></div>' +
      '<div class="field"><label for="f-std">ધોરણ</label><select id="f-std" class="input" data-f="std">' +
        (stdList.length > 1 ? opt('', 'બધાં ધોરણ', f.std) : '') + stdList.map(function (s) { return opt(s, 'ધોરણ ' + s, f.std); }).join('') + '</select></div>' +
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
    var isAdmin = QPG.app && QPG.app.isAdmin && QPG.app.isAdmin();
    var creatorBadge = (q.creatorName || q.createdBy)
      ? '<span style="background:#e0f2fe;color:#0369a1;padding:2px 7px;border-radius:6px;font-size:12px;font-weight:600">👤 ' + esc(q.creatorName || q.createdBy) + '</span>'
      : '';
    var assignedBadge = (q.assignedTo && q.assignedTo.length && q.assignedTo[0] !== 'all')
      ? '<span style="background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:6px;font-size:12px;font-weight:600">🎯 સોંપેલ: ' + esc(q.assignedTo.join(', ')) + '</span>'
      : '';

    return '<li class="qcard" data-id="' + esc(q.id) + '">' +
      '<div class="qcard-body">' +
        '<div class="qcard-meta">' +
          '<span class="ch">' + esc(QPG.syllabus.subjectName(q.subject)) + ' · ધો. ' + esc(q.std) + ' · પ્રક. ' + esc(q.chapter) + (ch ? ' ' + esc(ch) : '') + '</span>' +
          '<span>' + esc(S.typeLabel(q.type)) + '</span><span>' + esc(S.difficultyLabel(q.difficulty)) + '</span>' +
          (q.topic ? '<span>' + esc(q.topic) + '</span>' : '') +
          creatorBadge +
          assignedBadge +
          (used ? '<span>' + used + ' પેપરમાં વપરાયો</span>' : '') +
          (q.isDemo ? '<span class="badge badge-demo">ડેમો</span>' : '') +
        '</div>' +
        QPG.questionHtml.render(q, { showAnswer: QPG.app.state.showAnswers }) +
        '<div class="qcard-actions">' +
          (isAdmin ? '<button type="button" class="btn btn-quiet btn-sm" data-act="assign-teacher" style="color:var(--accent);font-weight:600">👨‍🏫 શિક્ષકને સોંપો</button>' : '') +
          '<a class="btn btn-quiet btn-sm" href="#/questions/edit/' + encodeURIComponent(q.id) + '">' + icon('edit') + 'સુધારો</a>' +
          '<a class="btn btn-quiet btn-sm" href="#/questions/copy/' + encodeURIComponent(q.id) + '">' + icon('copy') + 'નકલ</a>' +
          '<button type="button" class="btn btn-quiet btn-sm" data-act="delete" style="color:var(--red)">' + icon('trash') + 'કાઢી નાખો</button>' +
        '</div>' +
      '</div>' +
      '<div class="qcard-marks" aria-label="' + esc(q.marks) + ' ગુણ"><b>[' + esc(q.marks) + ']</b><small>ગુણ</small></div>' +
    '</li>';
  }

  /** Assign questions to a teacher ('all', an email, or 'none' to take the assignment back). Counts as a change, so it syncs. */
  function assignTo(list, target) {
    var now = new Date().toISOString();
    list.forEach(function (q) {
      q.assignedTo = target === 'none' ? [] : [target];
      if (target !== 'none') q.assignedEver = true;
      q.updatedAt = now; q.rev = (Number(q.rev) || 0) + 1;
    });
    return QPG.db.bulkPut('questions', list).then(function () { list.forEach(QPG.app.upsertLocal); });
  }
  function teacherOptions(current, withAll) {
    var teachers = QPG.approvals.getApprovedTeachers();
    return (withAll ? '<option value="none"' + (!current || current === 'none' ? ' selected' : '') + '>કોઈને નહીં (સોંપણી રદ)</option>' +
      '<option value="all"' + (current === 'all' ? ' selected' : '') + '>બધા શિક્ષકો</option>' : '') +
      teachers.map(function (t) {
        return '<option value="' + esc(t.email) + '"' + (current === t.email ? ' selected' : '') + '>' + esc(t.name) + ' (' + esc(t.email) + ')</option>';
      }).join('');
  }
  function noTeachers() {
    QPG.ui.confirmDialog({ title: 'કોઈ મંજૂર શિક્ષક નથી', body: 'પહેલાં સેટિંગ્સ → "શિક્ષકો અને મંજૂરી" માં શિક્ષકને મંજૂર કરો (અથવા યાદી હજુ આવી રહી છે — થોડી વાર પછી ફરી પ્રયત્ન કરો).', ok: 'સમજાયું' });
  }

  QPG.views.bank = function (el, ctx) {
    if (QPG.app.isAdmin() && QPG.auth.user()) QPG.approvals.ready().catch(function () { /* offline */ });
    var state = QPG.app.state;
    var f = state.bankFilters;
    var isAdmin = QPG.app && QPG.app.isAdmin && QPG.app.isAdmin();
    // filters passed in the link (from the home screen) replace the current ones
    if (ctx.query && Object.keys(ctx.query).length) {
      f = state.bankFilters = { demo: 'any', used: 'any' };
      ['subject', 'std', 'chapter', 'type', 'q'].forEach(function (k) { if (ctx.query[k]) f[k] = ctx.query[k]; });
    }
    var shown = PAGE;
    var collapsed = true;

    el.innerHTML =
      '<div class="page-head"><div><h1>પ્રશ્ન બેંક</h1><p>બધા પ્રશ્નો, જવાબ અને ઉકેલ એક જગ્યાએ.</p></div>' +
      '<div class="actions">' +
        (isAdmin ? '<button type="button" class="btn btn-quiet" data-act="bulk-assign" style="font-weight:600">📤 શિક્ષકને પ્રશ્નો સોંપો</button>' : '') +
        '<button type="button" class="btn" data-act="answers">' + icon('eye') + '<span data-answers-label></span></button>' +
        '<a class="btn" href="#/import">' + icon('upload') + 'Import</a>' +
        '<a class="btn btn-primary hide-mobile" href="#/questions/new">' + icon('plus') + 'નવો પ્રશ્ન</a>' +
      '</div></div>' +
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
      var all = QPG.app && QPG.app.userQuestions ? QPG.app.userQuestions() : state.questions;
      filtersEl.innerHTML = filtersHtml(f, QPG.filters.facets(all));
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
      var all = QPG.app && QPG.app.userQuestions ? QPG.app.userQuestions() : state.questions;
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
      } else if (act === 'assign-teacher') {
        var aq = QPG.app.questionById(b.closest('.qcard').getAttribute('data-id'));
        if (!aq) return;
        QPG.approvals.ready().catch(function () { /* offline */ }).then(function () {
          if (!QPG.approvals.getApprovedTeachers().length) return noTeachers();
          var modal = document.createElement('div');
          modal.className = 'modal is-open';
          modal.innerHTML = '<div class="modal-card panel" role="dialog" aria-modal="true" style="max-width:480px">' +
            '<h2>શિક્ષકને પ્રશ્ન સોંપો</h2>' +
            '<p style="margin:4px 0 14px;color:var(--muted);font-size:14.5px">સોંપેલો પ્રશ્ન એ શિક્ષકના એકાઉન્ટમાં આપોઆપ પહોંચશે. "કોઈને નહીં" કરો તો એમનામાંથી નીકળી જશે.</p>' +
            '<label class="field"><span class="lbl">શિક્ષક</span><select class="input" data-assign-sel>' + teacherOptions((aq.assignedTo || [])[0], true) + '</select></label>' +
            '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">' +
              '<button type="button" class="btn btn-quiet" data-assign-cancel>રદ કરો</button>' +
              '<button type="button" class="btn btn-primary" data-assign-ok>સાચવો</button></div></div>';
          document.body.appendChild(modal);
          modal.querySelector('[data-assign-cancel]').onclick = function () { modal.remove(); };
          modal.querySelector('[data-assign-ok]').onclick = function () {
            var v = modal.querySelector('[data-assign-sel]').value;
            assignTo([aq], v).then(function () {
              modal.remove();
              QPG.ui.toast(v === 'none' ? 'સોંપણી રદ કરી' : v === 'all' ? 'પ્રશ્ન બધા શિક્ષકોને સોંપાયો' : 'પ્રશ્ન ' + v + ' ને સોંપાયો');
              drawList();
            });
          };
        });
      } else if (act === 'bulk-assign') {
        if (!QPG.approvals.getApprovedTeachers().length) { QPG.approvals.ready().catch(function () {}); return noTeachers(); }
        var tOpts = teacherOptions('', false) + '<option value="all">બધા શિક્ષકો</option><option value="none">કોઈને નહીં (સોંપણી રદ)</option>';

        var sOpts = QPG.syllabus.SUBJECTS.map(function (s) {
          return '<option value="' + s.id + '">' + esc(s.gu) + ' (' + esc(s.en) + ')</option>';
        }).join('');

        var stdOpts = QPG.syllabus.STANDARDS.map(function (s) {
          return '<option value="' + s + '">ધોરણ ' + s + '</option>';
        }).join('');

        var modal = document.createElement('div');
        modal.className = 'modal is-open';
        modal.innerHTML =
          '<div class="modal-card panel" style="max-width:500px">' +
            '<h2>એક વિષય-ધોરણના બધા પ્રશ્નો સોંપો</h2>' +
            '<p style="margin:4px 0 14px;color:var(--muted);font-size:14px">કોઈ વિષય અને ધોરણના બધા પ્રશ્નો એકસાથે શિક્ષકને સોંપો.</p>' +
            '<div class="row row-2">' +
              '<label class="field"><span class="lbl">વિષય</span><select class="input" data-bulk-sub>' + sOpts + '</select></label>' +
              '<label class="field"><span class="lbl">ધોરણ</span><select class="input" data-bulk-std>' + stdOpts + '</select></label>' +
            '</div>' +
            '<label class="field" style="margin-top:10px"><span class="lbl">શિક્ષક પસંદ કરો</span><select class="input" data-bulk-teacher>' + tOpts + '</select></label>' +
            '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">' +
              '<button type="button" class="btn btn-quiet" data-bulk-cancel>રદ કરો</button>' +
              '<button type="button" class="btn btn-primary" data-bulk-ok>બધા પ્રશ્નો સોંપો</button>' +
            '</div>' +
          '</div>';

        document.body.appendChild(modal);
        modal.querySelector('[data-bulk-cancel]').onclick = function () { modal.remove(); };
        modal.querySelector('[data-bulk-ok]').onclick = function () {
          var selSub = modal.querySelector('[data-bulk-sub]').value;
          var selStd = Number(modal.querySelector('[data-bulk-std]').value);
          var selTeacher = modal.querySelector('[data-bulk-teacher]').value;
          var all = QPG.app.state.questions || [];
          var matches = all.filter(function (q) {
            return q.subject === selSub && Number(q.std) === selStd;
          });
          if (!matches.length) {
            QPG.ui.toast('આ વિષય અને ધોરણમાં કોઈ પ્રશ્નો મળ્યા નહીં.');
            modal.remove();
            return;
          }
          assignTo(matches, selTeacher).then(function () {
            modal.remove();
            QPG.ui.toast(selTeacher === 'none' ? matches.length + ' પ્રશ્નોની સોંપણી રદ કરી' : matches.length + ' પ્રશ્નો ' + (selTeacher === 'all' ? 'બધા શિક્ષકોને' : selTeacher + ' ને') + ' સોંપ્યા');
            drawList();
          });
        };
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
