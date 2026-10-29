/* Add / edit / copy a question, with formula buttons and a live preview. */
(function (root) {
  'use strict';
  var QPG = root.QPG;
  QPG.views = QPG.views || {};
  var esc = function (s) { return QPG.questionHtml.esc(s); };
  var icon = function (n) { return QPG.ui.icon(n); };
  var CURSOR = '§';

  /* Formula buttons: [label shown (LaTeX), snippet inserted; § = cursor position] */
  var MATH_BUTTONS = [
    ['\\frac{a}{b}', '\\frac{§}{}', 'અપૂર્ણાંક'], ['\\sqrt{x}', '\\sqrt{§}', 'વર્ગમૂળ'], ['x^{n}', '^{§}', 'ઘાત'], ['x_{n}', '_{§}', 'નીચે લખાણ'],
    ['\\vec{a}', '\\vec{§}', 'સદિશ'], ['\\hat{i}', '\\hat{§}', 'એકમ સદિશ'], ['\\sin^{-1}', '\\sin^{-1}', 'પ્રતિવિધેય'],
    ['\\theta', '\\theta'], ['\\pi', '\\pi'], ['\\alpha', '\\alpha'], ['\\beta', '\\beta'], ['\\lambda', '\\lambda'], ['\\mu', '\\mu'], ['\\omega', '\\omega'], ['\\Delta', '\\Delta'],
    ['\\times', '\\times'], ['\\div', '\\div'], ['\\pm', '\\pm'], ['\\le', '\\le'], ['\\ge', '\\ge'], ['\\ne', '\\ne'], ['\\to', '\\to'], ['x^{\\circ}', '^\\circ', 'અંશ'],
    ['\\infty', '\\infty'], ['\\cup', '\\cup'], ['\\cap', '\\cap'], ['\\subset', '\\subset'], ['\\phi', '\\phi'],
    ['\\frac{dy}{dx}', '\\frac{d§}{dx}', 'વિકલિત'], ['\\int', '\\int_{§}^{}', 'સંકલન'],
    ['[M L T]', '[M^{§}L^{}T^{}]', 'પારિમાણિક સૂત્ર'],
    ['\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}', '\\begin{bmatrix} § & \\\\  & \\end{bmatrix}', 'શ્રેણિક 2×2'],
    ['\\begin{bmatrix}\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\end{bmatrix}', '\\begin{bmatrix} § &  &  \\\\  &  &  \\\\  &  &  \\end{bmatrix}', 'શ્રેણિક 3×3'],
    ['\\begin{vmatrix}a&b\\\\c&d\\end{vmatrix}', '\\begin{vmatrix} § & \\\\  & \\end{vmatrix}', 'નિશ્ચાયક'],
    ['\\begin{cases}a\\\\b\\end{cases}', '\\begin{cases} § , & x \\ge 0 \\\\  , & x < 0 \\end{cases}', 'વિભાગીય વિધેય']
  ];

  function opt(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (String(selected) === String(value) ? ' selected' : '') + '>' + esc(label) + '</option>';
  }

  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function setPath(obj, path, value) {
    var keys = path.split('.'), o = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null) o[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
  }

  function insideMath(value, pos) {
    var before = value.slice(0, pos).replace(/\\\$/g, '');
    return ((before.match(/\$/g) || []).length % 2) === 1;
  }

  function insertSnippet(input, snippet) {
    var v = input.value, s = input.selectionStart, e = input.selectionEnd;
    var sel = v.slice(s, e);
    var body = snippet.indexOf(CURSOR) >= 0 ? snippet.replace(CURSOR, sel + CURSOR) : snippet + (sel ? ' ' + sel : '') + CURSOR;
    if (!insideMath(v, s)) body = '$' + body + '$';
    var caret = body.indexOf(CURSOR);
    body = body.replace(CURSOR, '');
    input.value = v.slice(0, s) + body + v.slice(e);
    input.focus();
    input.setSelectionRange(s + caret, s + caret);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /** Resize a picked image so stored questions stay small. Returns a data URL. */
  function readImage(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type)) { reject(new Error('ફક્ત ફોટો/ચિત્ર ફાઇલ પસંદ કરો.')); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var max = 1200, w = img.naturalWidth, h = img.naturalHeight;
        var k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var png = file.type === 'image/png' && c.width * c.height < 700000;
        resolve(c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('આ ચિત્ર ખૂલી શક્યું નહીં.')); };
      img.src = url;
    });
  }

  QPG.views.form = function (el, ctx) {
    if (QPG.app.isAdmin() && QPG.auth.user()) QPG.approvals.ready().catch(function () { /* offline */ });
    var S = QPG.schema, app = QPG.app;
    var original = null, draft;

    if (ctx.mode === 'edit' || ctx.mode === 'copy') {
      original = app.questionById(ctx.id);
      if (!original) {
        el.innerHTML = '<div class="empty"><strong>આ પ્રશ્ન મળ્યો નહીં</strong>કદાચ કાઢી નાખ્યો હશે.<br><a class="btn" href="#/questions">પ્રશ્ન બેંક</a></div>';
        return;
      }
      draft = JSON.parse(JSON.stringify(ctx.mode === 'copy' ? S.duplicateQuestion(original) : original));
    } else {
      var last = app.state.lastFormDefaults || {};
      draft = {
        subject: last.subject || 'physics', std: last.std || 11, chapter: last.chapter || '', topic: last.topic || '',
        type: last.type || 'mcq', marks: last.marks || 1, difficulty: last.difficulty || 'medium', language: 'gu',
        text: '', options: ['', '', '', ''], answer: '', solution: '', image: '', source: '',
        assertion: '', reason: '', matchLeft: ['', '', ''], matchRight: ['', '', ''], subparts: [{ text: '', options: [] }]
      };
    }
    ['options', 'matchLeft', 'matchRight'].forEach(function (k) { if (!Array.isArray(draft[k])) draft[k] = []; });
    while (draft.options.length < 4) draft.options.push('');
    if (!draft.matchLeft.length) draft.matchLeft = ['', '', ''];
    if (!draft.matchRight.length) draft.matchRight = ['', '', ''];
    if (!Array.isArray(draft.subparts) || !draft.subparts.length) draft.subparts = [{ text: '', options: [] }];

    var snapshot = JSON.stringify(draft);
    var triedSave = false;
    var lastFocused = null;

    var title = ctx.mode === 'edit' ? 'પ્રશ્ન સુધારો' : ctx.mode === 'copy' ? 'પ્રશ્નની નકલ' : 'નવો પ્રશ્ન';
    el.innerHTML =
      '<div class="page-head"><div><h1>' + title + '</h1>' +
      '<p>' + (ctx.mode === 'copy' ? 'નકલ સેવ કરશો ત્યારે નવો પ્રશ્ન બનશે; મૂળ પ્રશ્ન એમ જ રહેશે.' : 'ગણિતનું સૂત્ર $ … $ વચ્ચે લખાય છે — નીચેનાં બટન આપોઆપ લખી આપશે.') + '</p></div>' +
      '<div class="actions hide-mobile"><a class="btn btn-quiet" href="#/questions">' + icon('back') + 'પ્રશ્ન બેંક</a></div></div>' +
      (original && original.isDemo && ctx.mode === 'edit' ? '<div class="notice notice-demo">' + icon('info') + '<div>આ ડેમો પ્રશ્ન છે. ફેરફાર સેવ કરશો તો એ તમારો પ્રશ્ન ગણાશે અને "ડેમો પ્રશ્નો દૂર કરો" થી નહીં નીકળે.</div></div>' : '') +
      '<form class="form-grid" novalidate>' +
        '<div class="form-main">' +
          '<div class="notice notice-error" data-errors hidden></div>' +
          '<section class="panel"><h2>ક્યાંનો પ્રશ્ન?</h2><div class="row row-4" data-where></div></section>' +
          '<section class="panel"><h2>પ્રશ્ન</h2>' +
            '<div class="row row-3" data-kind style="margin-bottom:14px"></div>' +
            '<div class="mathbar" role="toolbar" aria-label="ગણિતનાં સૂત્રો"><div class="mathbar-label">સૂત્ર ઉમેરવા પહેલાં જ્યાં લખવું હોય ત્યાં ક્લિક કરો, પછી બટન દબાવો.</div>' +
              MATH_BUTTONS.map(function (b, i) { return '<button type="button"' + (i >= 31 ? ' class="tall"' : '') + ' data-snip="' + i + '" title="' + esc(b[2] || b[1]) + '">$' + esc(b[0]) + '$</button>'; }).join('') +
            '</div>' +
            '<div data-body style="display:flex;flex-direction:column;gap:14px;margin-top:14px"></div>' +
          '</section>' +
          '<section class="panel"><h2>જવાબ અને ઉકેલ</h2><div data-answer style="display:flex;flex-direction:column;gap:14px"></div></section>' +
          '<details class="more-fields panel"><summary>વધુ વિગતો (ભાષા, સંદર્ભ)</summary><div class="row row-2" data-extra></div></details>' +
        '</div>' +
        '<aside class="preview" aria-label="પેપરમાં કેવો દેખાશે">' +
          '<div class="preview-sheet"><div class="preview-title">' + icon('eye') + 'પેપરમાં આવો દેખાશે</div><div data-preview></div></div>' +
          '<div class="checks" data-checks aria-live="polite"></div>' +
        '</aside>' +
        '<div class="form-foot" style="grid-column:1/-1">' +
          '<a class="btn btn-quiet" href="#/questions">રદ કરો</a><span class="spacer"></span>' +
          (ctx.mode === 'edit' ? '' : '<button type="submit" class="btn" data-save="next">સેવ કરીને બીજો ઉમેરો</button>') +
          '<button type="submit" class="btn btn-primary" data-save="done">પ્રશ્ન સેવ કરો</button>' +
        '</div>' +
      '</form>';

    var form = el.querySelector('form');
    var $ = function (sel) { return el.querySelector(sel); };

    function field(id, lbl, inner, k) {
      return '<div class="field" data-field="' + (k || '') + '"><label for="' + id + '">' + lbl + '</label>' + inner + '<div class="field-error" hidden></div></div>';
    }
    function textarea(k, lbl, rows, ph) {
      var id = 'fq-' + k.replace(/\./g, '-');
      return field(id, lbl, '<textarea id="' + id + '" class="input" data-k="' + k + '" data-math rows="' + (rows || 3) + '"' +
        (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>' + esc(getPath(draft, k) || '') + '</textarea>', k.split('.')[0]);
    }
    function textInput(k, ph, math) {
      return '<input class="input" data-k="' + k + '"' + (math ? ' data-math' : '') + ' value="' + esc(getPath(draft, k) || '') + '"' +
        (ph ? ' placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '"' : '') + '>';
    }

    function drawWhere() {
      var subList = QPG.syllabus.SUBJECTS.filter(function (s) { return app.subjectsAllowed().indexOf(s.id) !== -1 || s.id === draft.subject; });
      if (!original || ctx.mode === 'copy') app.fixSubjectStd(draft);   // a saved question keeps its own subject / standard
      var stdList = app.stdsFor(draft.subject);
      if (stdList.indexOf(Number(draft.std)) < 0) stdList = stdList.concat([Number(draft.std)]).sort(function (x, y) { return x - y; });

      var std = Number(draft.std);
      var chapters = QPG.syllabus.chapters(draft.subject, std);
      var topics = QPG.filters.facets(app.state.questions.filter(function (q) { return q.subject === draft.subject; })).topics;

      var isAdmin = app.isAdmin && app.isAdmin();
      var assignHtml = '';
      if (isAdmin) {
        var teachers = QPG.approvals.getApprovedTeachers();
        var curAssigned = (draft.assignedTo && draft.assignedTo[0]) || 'none';
        var tOpts = '<option value="none"' + (curAssigned === 'none' ? ' selected' : '') + '>કોઈને નહીં</option>' +
          '<option value="all"' + (curAssigned === 'all' ? ' selected' : '') + '>બધા શિક્ષકો</option>' +
          teachers.map(function (t) {
            return '<option value="' + esc(t.email) + '"' + (curAssigned === t.email ? ' selected' : '') + '>' + esc(t.name) + ' (' + esc(t.email) + ')</option>';
          }).join('');
        assignHtml = field('fq-assigned', 'શિક્ષકને સોંપો (Assign)', '<select id="fq-assigned" class="input" data-assign-to>' + tOpts + '</select>', 'assignedTo');
      }

      $('[data-where]').innerHTML =
        field('fq-subject', 'વિષય', '<select id="fq-subject" class="input" data-k="subject">' + subList.map(function (s) { return opt(s.id, s.gu, draft.subject); }).join('') + '</select>', 'subject') +
        field('fq-std', 'ધોરણ', '<select id="fq-std" class="input" data-k="std" data-num>' + stdList.map(function (s) { return opt(s, 'ધોરણ ' + s, draft.std); }).join('') + '</select>', 'std') +
        field('fq-chapter', 'પ્રકરણ', chapters.length
          ? '<select id="fq-chapter" class="input" data-k="chapter" data-num>' + opt('', 'પસંદ કરો', draft.chapter) + chapters.map(function (c) { return opt(c.no, c.no + '. ' + c.name, draft.chapter); }).join('') + '</select>'
          : '<input id="fq-chapter" class="input" type="number" min="1" inputmode="numeric" data-k="chapter" data-num value="' + esc(draft.chapter || '') + '" placeholder="પ્રકરણ નંબર">', 'chapter') +
        field('fq-topic', 'મુદ્દો (Topic)', '<input id="fq-topic" class="input" data-k="topic" list="fq-topics" value="' + esc(draft.topic || '') + '" placeholder="દા.ત. પ્રક્ષિપ્ત ગતિ">' +
          '<datalist id="fq-topics">' + topics.map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>', 'topic') +
        assignHtml;
    }

    function drawKind() {
      $('[data-kind]').innerHTML =
        field('fq-type', 'પ્રશ્નનો પ્રકાર', '<select id="fq-type" class="input" data-k="type">' + S.TYPES.map(function (t) { return opt(t.id, t.gu, draft.type); }).join('') + '</select>', 'type') +
        field('fq-marks', 'ગુણ', '<input id="fq-marks" class="input" type="number" min="0.5" step="0.5" inputmode="decimal" data-k="marks" data-num value="' + esc(draft.marks == null ? '' : draft.marks) + '">', 'marks') +
        field('fq-diff', 'કઠિનતા', '<select id="fq-diff" class="input" data-k="difficulty">' + S.DIFFICULTIES.map(function (d) { return opt(d.id, d.gu, draft.difficulty); }).join('') + '</select>', 'difficulty');
    }

    function drawBody() {
      var t = draft.type, h = '';
      if (t === 'assertion_reason') {
        h += textarea('assertion', 'વિધાન (A)', 2) + textarea('reason', 'કારણ (R)', 2) +
          '<p class="hint" style="margin:0;color:var(--muted);font-size:14px">ચાર પ્રમાણભૂત વિકલ્પો (A–D) પેપરમાં આપોઆપ છપાશે.</p>';
      } else {
        var lbl = t === 'case_based' ? 'પરિચ્છેદ (Passage)' : t === 'match_columns' ? 'સૂચના' : t === 'fill_blank' ? 'પ્રશ્ન (ખાલી જગ્યા માટે .......... લખો)' : 'પ્રશ્ન';
        var ph = t === 'match_columns' ? 'કૉલમ-I ને કૉલમ-II સાથે જોડો.' : '';
        h += textarea('text', lbl, t === 'case_based' ? 6 : 3, ph);
      }
      if (t === 'mcq') {
        h += '<div class="field" data-field="options"><span class="lbl">વિકલ્પો</span>' +
          S.OPTION_LETTERS.map(function (L, i) { return '<div class="opt-row"><span class="lt">(' + L + ')</span>' + textInput('options.' + i, 'વિકલ્પ ' + L, true) + '</div>'; }).join('') +
          '<div class="field-error" hidden></div></div>';
      }
      if (t === 'match_columns') {
        var n = Math.max(draft.matchLeft.length, draft.matchRight.length);
        var rows = '';
        for (var i = 0; i < n; i++) {
          rows += '<div class="match-row"><span class="lt">(' + (i + 1) + ')</span>' + textInput('matchLeft.' + i, 'કૉલમ-I (' + (i + 1) + ')', true) +
            '<span class="lt rl">(' + String.fromCharCode(97 + i) + ')</span><div class="r">' + textInput('matchRight.' + i, 'કૉલમ-II (' + String.fromCharCode(97 + i) + ')', true) + '</div>' +
            '<button type="button" class="btn btn-quiet btn-sm" data-act="del-match" data-i="' + i + '" aria-label="પંક્તિ ' + (i + 1) + ' કાઢો">' + icon('trash') + '</button></div>';
        }
        h += '<div class="field" data-field="matchLeft"><span class="lbl">જોડકાં (કૉલમ-I અને કૉલમ-II)</span><div class="match-rows">' + rows + '</div>' +
          '<div class="field-error" hidden></div><div><button type="button" class="btn btn-sm" data-act="add-match">' + icon('plus') + 'પંક્તિ ઉમેરો</button></div></div>' +
          '<div class="field" data-field="matchRight"><div class="field-error" hidden></div></div>';
      }
      if (t === 'case_based') {
        h += '<div class="field" data-field="subparts"><span class="lbl">પેટા-પ્રશ્નો</span>' +
          draft.subparts.map(function (p, i) {
            var hasOpts = p.options && p.options.length;
            return '<div class="sub-item"><div class="sub-item-head">(' + (i + 1) + ')' +
              '<button type="button" class="btn btn-quiet btn-sm" data-act="sub-opts" data-i="' + i + '">' + (hasOpts ? 'વિકલ્પો કાઢો' : 'MCQ વિકલ્પો ઉમેરો') + '</button>' +
              '<button type="button" class="btn btn-quiet btn-sm" data-act="del-sub" data-i="' + i + '" aria-label="પેટા-પ્રશ્ન ' + (i + 1) + ' કાઢો">' + icon('trash') + '</button></div>' +
              '<textarea class="input" rows="2" data-math data-k="subparts.' + i + '.text" aria-label="પેટા-પ્રશ્ન ' + (i + 1) + '">' + esc(p.text || '') + '</textarea>' +
              (hasOpts ? S.OPTION_LETTERS.map(function (L, j) { return '<div class="opt-row"><span class="lt">(' + L + ')</span>' + textInput('subparts.' + i + '.options.' + j, 'વિકલ્પ ' + L, true) + '</div>'; }).join('') : '') +
              '</div>';
          }).join('') +
          '<div class="field-error" hidden></div><div><button type="button" class="btn btn-sm" data-act="add-sub">' + icon('plus') + 'પેટા-પ્રશ્ન ઉમેરો</button></div></div>';
      }
      h += '<div class="field" data-field="image"><span class="lbl">આકૃતિ / ચિત્ર (જરૂર હોય તો)</span>' +
        (draft.image ? '<div class="thumb"><img src="' + esc(draft.image) + '" alt="પ્રશ્નની આકૃતિ"><button type="button" class="btn btn-sm btn-danger" data-act="del-img">' + icon('trash') + 'આકૃતિ કાઢો</button></div>'
          : '<label class="btn btn-sm" style="align-self:flex-start">' + icon('image') + 'આકૃતિ પસંદ કરો<input type="file" accept="image/*" data-img hidden></label>' +
            '<span class="hint">ફોનમાંથી આકૃતિનો ફોટો પણ પાડી શકો છો.</span>') +
        '<div class="field-error" hidden></div></div>';
      $('[data-body]').innerHTML = h;
      QPG.math.render($('[data-body]'));
    }

    function drawAnswer() {
      var t = draft.type, h = '';
      var solveBtn = '<button type="button" class="btn btn-sm" data-act="gemini-solve-single" style="background:#e8f0fe;color:#1967d2;border:1px solid #c2e7ff;font-size:12px;padding:2px 8px;font-weight:600">✨ Gemini વડે સાચો જવાબ શોધો</button>';
      if (t === 'mcq' || t === 'assertion_reason') {
        h += '<div class="field" data-field="answer">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><span class="lbl" style="margin:0">સાચો જવાબ</span>' + solveBtn + '</div>' +
          '<div class="answer-pick" role="radiogroup">' +
          ['', 'A', 'B', 'C', 'D'].map(function (L) {
            return '<label><input type="radio" name="fq-ans" data-k="answer" value="' + L + '"' + ((draft.answer || '') === L ? ' checked' : '') + '><span>' + (L ? '(' + L + ')' : 'ખબર નથી') + '</span></label>';
          }).join('') + '</div><div class="field-error" hidden></div></div>';
      } else {
        h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><span class="lbl" style="margin:0">ટૂંકો જવાબ (Answer key માં આવશે)</span>' + solveBtn + '</div>' +
          textarea('answer', '', 2, t === 'match_columns' ? 'દા.ત. 1 → c, 2 → a, 3 → b' : '');
      }
      h += textarea('solution', 'ઉકેલ / સમજૂતી (વૈકલ્પિક)', 4);
      $('[data-answer]').innerHTML = h;
    }

    function drawExtra() {
      $('[data-extra]').innerHTML =
        field('fq-lang', 'ભાષા', '<select id="fq-lang" class="input" data-k="language">' + S.LANGUAGES.map(function (l) { return opt(l.id, l.gu, draft.language); }).join('') + '</select>', 'language') +
        field('fq-src', 'સંદર્ભ / સ્રોત', '<input id="fq-src" class="input" data-k="source" value="' + esc(draft.source || '') + '" placeholder="દા.ત. પાઠ્યપુસ્તક સ્વાધ્યાય 3.2, 2025 બોર્ડ">', 'source');
    }

    function current() {
      var copy = JSON.parse(JSON.stringify(draft));
      return S.normalizeQuestion(copy, draft.updatedAt);
    }

    function drawPreview() {
      var q = current();
      var res = S.validateQuestion(q);
      var mathErr = QPG.math.errors(S.allText(q));
      $('[data-preview]').innerHTML = '<div class="preview-q"><span class="no">1)</span>' +
        QPG.questionHtml.render(q, { showAnswer: true }) + '<span class="mk">[' + esc(q.marks == null || isNaN(q.marks) ? '?' : q.marks) + ']</span></div>';
      QPG.math.render($('[data-preview]'));

      var items = [];
      res.errors.forEach(function (e) { items.push([triedSave ? 'err' : 'pending', e.msg]); });
      mathErr.forEach(function (m) { items.push(['warn', 'આ સૂત્ર સમજાતું નથી: $' + m.tex + '$ — ' + m.msg]); });
      res.warnings.forEach(function (w) { items.push(['warn', w.msg]); });
      if (!items.length) items.push(['ok', 'બધું બરાબર છે — સેવ કરી શકો છો.']);
      $('[data-checks]').innerHTML = items.map(function (it) {
        var cls = it[0] === 'pending' ? '' : ' is-' + it[0];
        var ic = it[0] === 'ok' ? 'ok' : it[0] === 'warn' ? 'warn' : it[0] === 'err' ? 'error' : 'info';
        return '<div class="check' + cls + '">' + icon(ic) + '<span>' + esc(it[1]) + '</span></div>';
      }).join('');

      if (triedSave) showFieldErrors(res.errors);
      return res;
    }

    function showFieldErrors(errors) {
      el.querySelectorAll('.field').forEach(function (f) {
        f.classList.remove('has-error');
        var fe = f.querySelector(':scope > .field-error'); if (fe) { fe.hidden = true; fe.textContent = ''; }
      });
      errors.forEach(function (e) {
        var f = el.querySelector('.field[data-field="' + e.field + '"]');
        if (!f) return;
        f.classList.add('has-error');
        var fe = f.querySelector(':scope > .field-error');
        if (fe) { fe.hidden = false; fe.textContent = fe.textContent ? fe.textContent + ' ' + e.msg : e.msg; }
      });
      var box = $('[data-errors]');
      if (errors.length) {
        box.hidden = false;
        box.innerHTML = icon('error') + '<div><b>સેવ કરતાં પહેલાં આ સુધારો:</b><ul>' + errors.map(function (e) { return '<li>' + esc(e.msg) + '</li>'; }).join('') + '</ul></div>';
      } else box.hidden = true;
    }

    var refreshPreview = QPG.ui.debounce(drawPreview, 150);

    function drawAll() { drawWhere(); drawKind(); drawBody(); drawAnswer(); drawExtra(); drawPreview(); }

    /* ---- events ---- */
    form.addEventListener('focusin', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-math')) lastFocused = e.target; });

    function onValue(e) {
      var t = e.target;
      if (t.hasAttribute && t.hasAttribute('data-assign-to')) {
        draft.assignedTo = t.value === 'none' ? [] : [t.value];
        if (t.value !== 'none') draft.assignedEver = true;
        return;
      }
      var k = t.getAttribute && t.getAttribute('data-k');
      if (!k) return;
      var v = t.value;
      if (t.hasAttribute('data-num')) v = v === '' ? '' : Number(v);
      setPath(draft, k, v);
      if (k === 'subject') { draft.std = QPG.syllabus.DEFAULT_STD[draft.subject] || draft.std; app.fixSubjectStd(draft); draft.chapter = ''; draft.topic = ''; drawWhere(); }
      else if (k === 'std') { draft.chapter = ''; drawWhere(); }
      else if (k === 'type') { drawBody(); drawAnswer(); }
      refreshPreview();
    }
    form.addEventListener('input', onValue);
    form.addEventListener('change', function (e) {
      if (e.target.matches('[data-img]')) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        readImage(file).then(function (url) { draft.image = url; drawBody(); drawPreview(); })
          .catch(function (err) { QPG.ui.toast(err.message); });
        return;
      }
      if (e.target.tagName === 'SELECT' || e.target.type === 'radio') onValue(e);
    });

    form.addEventListener('click', function (e) {
      var snip = e.target.closest('[data-snip]');
      if (snip) {
        var target = lastFocused && el.contains(lastFocused) ? lastFocused : el.querySelector('[data-math]');
        if (target) insertSnippet(target, MATH_BUTTONS[+snip.getAttribute('data-snip')][1]);
        return;
      }
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var i = +b.getAttribute('data-i');
      switch (b.getAttribute('data-act')) {
        case 'add-match': draft.matchLeft.push(''); draft.matchRight.push(''); break;
        case 'del-match': draft.matchLeft.splice(i, 1); draft.matchRight.splice(i, 1);
          if (!draft.matchLeft.length) { draft.matchLeft = ['']; draft.matchRight = ['']; } break;
        case 'add-sub': draft.subparts.push({ text: '', options: [] }); break;
        case 'del-sub': draft.subparts.splice(i, 1); if (!draft.subparts.length) draft.subparts = [{ text: '', options: [] }]; break;
        case 'sub-opts': var p = draft.subparts[i]; p.options = p.options && p.options.length ? [] : ['', '', '', '']; break;
        case 'del-img': draft.image = ''; break;
        case 'gemini-solve-single':
          if (!QPG.gemini || !QPG.gemini.hasApiKey()) {
            QPG.ui.toast('Gemini AI વાપરવા માટે સેટિંગ્સમાંથી API Key દાખલ કરો.');
            return;
          }
          if (!draft.text && !draft.assertion) {
            QPG.ui.toast('પહેલાં પ્રશ્નનું લખાણ લખો.');
            return;
          }
          var origBtnText = b.textContent;
          b.textContent = 'જવાબ શોધે છે…';
          b.disabled = true;
          QPG.gemini.solveSingleQuestion(draft, { subject: draft.subject, std: draft.std }).then(function (res) {
            b.textContent = origBtnText;
            b.disabled = false;
            if (res && res.answer) {
              var ans = String(res.answer).trim();
              if (draft.type === 'mcq' || draft.type === 'assertion_reason') {
                var m = ans.match(/\b([A-D])\b/i);
                draft.answer = m ? m[1].toUpperCase() : ans.charAt(0).toUpperCase();
              } else {
                draft.answer = ans;
              }
              if (res.solution && !draft.solution) draft.solution = res.solution;
              drawAnswer();
              refreshPreview();
              QPG.ui.toast('✓ સાચો જવાબ પસંદ થયો: (' + draft.answer + ')');
            } else {
              QPG.ui.toast('જવાબ ઓળખાયો નહીં.');
            }
          }).catch(function (err) {
            b.textContent = origBtnText;
            b.disabled = false;
            QPG.ui.toast('ભૂલ: ' + (err && err.message || err));
          });
          return;
        default: return;
      }
      drawBody(); drawPreview();
    });

    var nextAfterSave = false;
    form.addEventListener('click', function (e) {
      var s = e.target.closest('[data-save]');
      if (s) nextAfterSave = s.getAttribute('data-save') === 'next';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      triedSave = true;
      var res = drawPreview();
      if (!res.ok) { $('[data-errors]').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      var q = current();
      if (ctx.mode === 'edit' && original) {
        q.isDemo = false; q.usage = original.usage || []; q.createdAt = original.createdAt; q.rev = (original.rev || 0) + 1;
      }
      QPG.db.saveQuestion(q).then(function () {
        app.upsertLocal(q);
        snapshot = JSON.stringify(draft);
        app.state.lastFormDefaults = { subject: q.subject, std: q.std, chapter: q.chapter, topic: q.topic, type: q.type, marks: q.marks, difficulty: q.difficulty };
        QPG.ui.toast(ctx.mode === 'edit' ? 'ફેરફાર સેવ થયા' : 'પ્રશ્ન સેવ થયો');
        app.guard = null;
        if (nextAfterSave) {
          app.go('/questions/new');
          var first = document.querySelector('[data-k="text"], [data-k="assertion"]');
          if (first) first.focus();
        } else app.go('/questions');
      }).catch(function (err) {
        QPG.ui.toast('સેવ થઈ શક્યું નહીં: ' + (err && err.message || err));
      });
    });

    app.guard = function () {
      return JSON.stringify(draft) !== snapshot ? 'આ પ્રશ્નમાં કરેલા ફેરફાર હજુ સેવ નથી થયા.' : null;
    };

    drawAll();
    QPG.math.render(el.querySelector('.mathbar'));
  };

  QPG.views.form.insertSnippet = insertSnippet;
})(self);
