/* Paper editor: sections with their questions, totals and warnings,
   move / replace / remove / add, Set A–B, and the paper's details. Saves automatically. */
(function (root) {
  'use strict';
  var QPG = root.QPG;
  QPG.views = QPG.views || {};
  var esc = function (s) { return QPG.questionHtml.esc(s); };
  var icon = function (n) { return QPG.ui.icon(n); };
  var A = function () { return QPG.assembly; };

  /* ---------- question picker (add or replace) ---------- */
  /**
   * opts: { paper, setIndex, section, mode: 'add'|'replace', replaceIndex }
   * resolves with an array of chosen ids (empty when cancelled)
   */
  function pickQuestions(opts) {
    return new Promise(function (resolve) {
      var app = QPG.app, paper = opts.paper, sec = opts.section, S = QPG.schema;
      var f = { q: '', chapter: '', type: '', marks: String(sec.marks), used: 'any' };
      var chosen = [];
      var single = opts.mode === 'replace';
      var shown = 40;

      var d = document.createElement('dialog');
      d.className = 'dlg dlg-full';
      var chOpts = paper.chapters.map(function (n) { return '<option value="' + n + '">' + n + '. ' + esc(QPG.syllabus.chapterName(paper.subject, paper.std, n)) + '</option>'; }).join('');
      var marks = QPG.filters.facets(A().eligible(paper, app.state.questions)).marks;
      d.innerHTML =
        '<div class="pick">' +
          '<div class="pick-head"><h2>' + (single ? 'પ્રશ્ન ' + (opts.replaceNo) + ' બદલો' : esc(A().sectionTitle(sec)) + ' માં પ્રશ્ન ઉમેરો') + '</h2>' +
            '<button type="button" class="btn btn-quiet btn-sm" data-x aria-label="બંધ કરો">' + icon('error') + '</button></div>' +
          '<div class="pick-filters">' +
            '<div class="search">' + icon('search') + '<input class="input" type="search" data-f="q" placeholder="શબ્દ લખીને શોધો…" aria-label="શોધો"></div>' +
            '<select class="input" data-f="chapter" aria-label="પ્રકરણ"><option value="">બધાં પ્રકરણ</option>' + chOpts + '</select>' +
            '<select class="input" data-f="type" aria-label="પ્રકાર"><option value="">બધા પ્રકાર</option>' + S.TYPES.map(function (t) { return '<option value="' + t.id + '">' + esc(t.gu) + '</option>'; }).join('') + '</select>' +
            '<select class="input" data-f="marks" aria-label="ગુણ"><option value="">બધા ગુણ</option>' + marks.map(function (m) { return '<option value="' + m + '"' + (String(m) === f.marks ? ' selected' : '') + '>' + m + ' ગુણ</option>'; }).join('') + '</select>' +
            '<select class="input" data-f="used" aria-label="અગાઉ વપરાયેલા"><option value="any">વપરાયેલા પણ</option><option value="unused">ક્યારેય ન વપરાયેલા</option></select>' +
          '</div>' +
          '<div class="pick-line"><span data-count></span>' + (single ? '' : '<button type="button" class="btn btn-sm" data-all>દેખાતા બધા પસંદ કરો</button>') + '</div>' +
          '<ul class="pick-list" data-list></ul>' +
          '<div class="pick-foot"><button type="button" class="btn" data-x>રદ કરો</button><span class="spacer"></span>' +
            '<button type="button" class="btn btn-primary" data-ok disabled>' + (single ? 'આ પ્રશ્ન મૂકો' : 'ઉમેરો') + '</button></div>' +
        '</div>';
      document.body.appendChild(d);
      var list = d.querySelector('[data-list]');

      function results() {
        var pool = A().eligible(paper, app.state.questions);
        return QPG.filters.sortQuestions(QPG.filters.filterQuestions(pool, {
          q: f.q, chapters: f.chapter ? [f.chapter] : null, types: f.type ? [f.type] : null,
          marks: f.marks ? [f.marks] : null, used: f.used
        }));
      }
      function draw() {
        var r = results();
        d.querySelector('[data-count]').textContent = r.length + ' પ્રશ્નો' + (chosen.length ? ' · ' + chosen.length + ' પસંદ' : '');
        if (!r.length) {
          list.innerHTML = '<li class="empty"><strong>આ ફિલ્ટરમાં પ્રશ્ન નથી</strong>ગુણ અથવા પ્રકારનું ફિલ્ટર બદલો, અથવા પ્રશ્ન બેંકમાં નવો પ્રશ્ન ઉમેરો.</li>';
        } else {
          list.innerHTML = r.slice(0, shown).map(function (q) {
            var inPaper = A().contains(paper, opts.setIndex, q.id) && !paper.allowDuplicates;
            var on = chosen.indexOf(q.id) >= 0;
            return '<li class="pick-item' + (inPaper ? ' is-in' : '') + (on ? ' is-on' : '') + '">' +
              '<label><input type="' + (single ? 'radio' : 'checkbox') + '" name="pk" value="' + esc(q.id) + '"' + (on ? ' checked' : '') + (inPaper ? ' disabled' : '') + '>' +
              '<div class="pick-body"><div class="qcard-meta"><span class="ch">પ્રક. ' + esc(q.chapter) + '</span><span>' + esc(S.typeLabel(q.type)) + '</span>' +
              '<span>' + esc(S.difficultyLabel(q.difficulty)) + '</span>' + ((q.usage || []).length ? '<span>' + q.usage.length + ' પેપરમાં વપરાયો</span>' : '') +
              (inPaper ? '<span class="badge badge-soon">પેપરમાં છે</span>' : '') + (q.isDemo ? '<span class="badge badge-demo">ડેમો</span>' : '') + '</div>' +
              QPG.questionHtml.render(q) + '</div><span class="pick-mk' + (Number(q.marks) !== Number(sec.marks) ? ' is-off' : '') + '">[' + esc(q.marks) + ']</span></label></li>';
          }).join('') + (r.length > shown ? '<li class="more"><button type="button" class="btn" data-more>વધુ બતાવો (' + (r.length - shown) + ' બાકી)</button></li>' : '');
          QPG.math.render(list);
        }
        d.querySelector('[data-ok]').disabled = !chosen.length;
      }
      function close(ids) { d.close(); d.remove(); resolve(ids || []); }

      d.addEventListener('input', QPG.ui.debounce(function (e) {
        var k = e.target.getAttribute('data-f'); if (k === 'q') { f.q = e.target.value; shown = 40; draw(); }
      }, 200));
      d.addEventListener('change', function (e) {
        var k = e.target.getAttribute('data-f');
        if (k && k !== 'q') { f[k] = e.target.value; shown = 40; draw(); return; }
        if (e.target.name === 'pk') {
          var id = e.target.value;
          if (single) chosen = [id];
          else if (e.target.checked) chosen.push(id); else chosen = chosen.filter(function (x) { return x !== id; });
          e.target.closest('.pick-item').classList.toggle('is-on', e.target.checked);
          if (single) list.querySelectorAll('.pick-item').forEach(function (li) { li.classList.toggle('is-on', li.querySelector('input').checked); });
          d.querySelector('[data-count]').textContent = results().length + ' પ્રશ્નો · ' + chosen.length + ' પસંદ';
          d.querySelector('[data-ok]').disabled = !chosen.length;
        }
      });
      d.addEventListener('click', function (e) {
        if (e.target.closest('[data-x]')) close([]);
        else if (e.target.closest('[data-ok]')) close(chosen);
        else if (e.target.closest('[data-more]')) { shown += 40; draw(); }
        else if (e.target.closest('[data-all]')) {
          results().forEach(function (q) {
            if (chosen.indexOf(q.id) < 0 && !(A().contains(paper, opts.setIndex, q.id) && !paper.allowDuplicates)) chosen.push(q.id);
          });
          draw();
        }
      });
      d.addEventListener('cancel', function (e) { e.preventDefault(); close([]); });
      d.showModal();
      draw();
    });
  }

  /* ---------- editor ---------- */
  QPG.views.paperEditor = function (el, ctx) {
    var app = QPG.app;
    el.innerHTML = '<p style="color:var(--muted)">પેપર ખૂલે છે…</p>';
    QPG.db.getPaper(ctx.id).then(function (paper) {
      if (!paper || paper.deletedAt) {
        el.innerHTML = '<div class="empty"><strong>આ પેપર મળ્યું નહીં</strong>કદાચ કાઢી નાખ્યું હશે.<br><a class="btn" href="#/papers">સેવ કરેલાં પેપર</a></div>';
        return;
      }
      editor(el, paper, ctx);
    });
  };

  function editor(el, paper, ctx) {
    var app = QPG.app;
    var si = Math.min(Number(ctx.query && ctx.query.set) || 0, paper.sets.length - 1);
    var saving = Promise.resolve();
    var getQ = app.getQFor(paper);

    function persist(p, toastMsg) {
      paper = p;
      saving = saving.then(function () { return app.savePaper(paper); }).then(function (saved) {
        paper = saved; getQ = app.getQFor(paper);
        var s = el.querySelector('[data-saved]'); if (s) s.textContent = 'સેવ થયું';
        if (toastMsg) QPG.ui.toast(toastMsg);
      });
      draw();
    }

    function sectionHtml(sec, v, nums, ranges, overlapIds) {
      var ids = paper.sets[si].items[sec.id];
      var info = v.sections.find(function (x) { return x.id === sec.id; });
      var state = info.issues.some(function (i) { return i.level === 'error'; }) ? 'err' : info.issues.length ? 'warn' : 'ok';
      var missing = Math.max(0, sec.print - ids.length);
      return '<section class="psec is-' + state + '" data-sec="' + esc(sec.id) + '">' +
        '<header class="psec-head"><div><h3>' + esc(A().sectionTitle(sec)) + '</h3>' +
          '<p class="psec-instr">' + esc(QPG.templates.instruction(sec, ranges[sec.id])) + '</p></div>' +
          '<div class="psec-tally"><b>' + ids.length + '/' + esc(sec.print) + '</b><span>પ્રશ્નો</span></div>' +
          '<div class="psec-tally"><b>' + info.total + '</b><span>ગુણ</span></div></header>' +
        '<div class="psec-rule">છાપવા <b>' + esc(sec.print) + '</b> · લખવાના <b>' + esc(sec.attempt) + '</b> · દરેક <b>' + esc(sec.marks) + '</b> ગુણ ' +
          '<button type="button" class="btn btn-quiet btn-sm" data-act="sec-edit">' + icon('edit') + 'બદલો</button></div>' +
        '<div class="psec-form" hidden>' +
          ['print', 'attempt', 'marks'].map(function (k) {
            var lbl = { print: 'છાપવાના', attempt: 'લખવાના', marks: 'દરેકના ગુણ' }[k];
            return '<label class="field"><span class="lbl">' + lbl + '</span><input class="input" type="number" min="' + (k === 'marks' ? 0.5 : 1) + '" step="' + (k === 'marks' ? 0.5 : 1) + '" data-sk="' + k + '" value="' + esc(sec[k]) + '"></label>';
          }).join('') +
          '<button type="button" class="btn btn-primary btn-sm" data-act="sec-save">સાચવો</button></div>' +
        (info.issues.length ? '<ul class="psec-issues">' + info.issues.map(function (i) { return '<li class="is-' + i.level + '">' + icon(i.level === 'error' ? 'error' : 'warn') + esc(i.msg) + '</li>'; }).join('') + '</ul>' : '') +
        '<ol class="pq-list">' + ids.map(function (id, i) {
          var q = getQ(id);
          var off = q && Number(q.marks) !== Number(sec.marks);
          return '<li class="pq-item" data-i="' + i + '"><span class="pq-n">' + nums[sec.id][i] + ')</span><div class="pq-main">' +
            (q ? '<div class="qcard-meta"><span class="ch">પ્રક. ' + esc(q.chapter) + '</span><span>' + esc(QPG.schema.typeLabel(q.type)) + '</span>' +
              '<span' + (off ? ' class="off"' : '') + '>' + esc(q.marks) + ' ગુણ</span>' +
              (overlapIds.indexOf(id) >= 0 ? '<span class="badge badge-soon">બીજા Set માં પણ</span>' : '') +
              (app.questionById(id) ? '' : '<span class="badge badge-demo">બેંકમાંથી કાઢેલો</span>') + '</div>' + QPG.questionHtml.render(q)
              : '<p style="color:var(--red)">આ પ્રશ્ન મળતો નથી.</p>') + '</div>' +
            '<div class="pq-acts">' +
              '<button type="button" class="btn btn-quiet btn-sm" data-act="up"' + (i === 0 ? ' disabled' : '') + ' aria-label="ઉપર ખસેડો" title="ઉપર">↑</button>' +
              '<button type="button" class="btn btn-quiet btn-sm" data-act="down"' + (i === ids.length - 1 ? ' disabled' : '') + ' aria-label="નીચે ખસેડો" title="નીચે">↓</button>' +
              '<button type="button" class="btn btn-quiet btn-sm" data-act="replace">' + icon('copy') + 'બદલો</button>' +
              '<button type="button" class="btn btn-quiet btn-sm" data-act="remove" style="color:var(--red)">' + icon('trash') + 'કાઢો</button>' +
            '</div></li>';
        }).join('') + '</ol>' +
        '<div class="psec-add"><button type="button" class="btn btn-sm" data-act="add">' + icon('plus') + 'પ્રશ્ન પસંદ કરો</button>' +
          (missing ? '<button type="button" class="btn btn-sm" data-act="fill">ખાલી ' + missing + ' જગ્યા આપોઆપ ભરો</button>' : '') + '</div>' +
      '</section>';
    }

    function detailsHtml() {
      var m = paper.meta;
      var f = function (k, lbl, type) {
        return '<label class="field"><span class="lbl">' + lbl + '</span><input class="input" data-m="' + k + '"' + (type ? ' type="' + type + '"' : '') + ' value="' + esc(m[k] == null ? '' : m[k]) + '"></label>';
      };
      return '<details class="panel pdetails"><summary>પેપર પર છપાતી વિગત બદલો (નામ, ધોરણ, પ્રકરણ, સમય, ગુણ…)</summary>' +
        '<div class="row row-3" style="margin-top:12px">' +
          '<label class="field"><span class="lbl">પેપરનું નામ (યાદી માટે)</span><input class="input" data-title value="' + esc(paper.title) + '"></label>' +
          f('institute', 'સંસ્થાનું નામ') + f('examName', 'પરીક્ષાનું નામ') +
          (paper.style === 'maths' ? f('paperLabel', 'પેપર લેબલ') : '') +
          f('std', 'ધોરણ') + f('subjectLabel', 'વિષય (પેપર પર)') + f('chapterText', 'પ્રકરણ (પેપર પર)') +
          f('totalMarks', 'કુલ ગુણ', 'number') + f('duration', 'સમય') + f('date', 'તારીખ') +
          f('topText', 'ઉપરની પટ્ટીમાં') + f('bottomText', 'નીચેની પટ્ટીમાં') + f('watermark', 'વૉટરમાર્ક') +
          f('closing', 'છેલ્લે લખાણ') +
        '</div>' +
        '<div class="check-col">' +
          '<label class="check-line"><input type="checkbox" data-mc="showWatermark"' + (m.showWatermark !== false ? ' checked' : '') + '> વૉટરમાર્ક છાપો</label>' +
          (paper.sets.length > 1 ? '<label class="check-line"><input type="checkbox" data-mc="showSetLetter"' + (m.showSetLetter ? ' checked' : '') + '> Set અક્ષર (A/B) છાપો</label>' : '') +
          '<label class="check-line"><input type="checkbox" data-dup' + (paper.allowDuplicates ? ' checked' : '') + '> એક જ પ્રશ્ન બે વાર મૂકવા દો</label>' +
        '</div></details>';
    }

    function draw() {
      var v = A().validate(paper, getQ);
      var vs = v.sets[si];
      var nums = A().numbering(paper, si), ranges = A().ranges(paper, si);
      var overlapIds = A().overlap(paper);
      var errors = vs.issues.filter(function (i) { return i.level === 'error'; }).length;
      var warns = vs.issues.length - errors;
      var configured = Number(paper.meta.totalMarks) || 0;
      var empty = paper.sections.reduce(function (n, s) { return n + Math.max(0, s.print - paper.sets[si].items[s.id].length); }, 0);

      el.innerHTML =
        '<div class="page-head"><div><h1>' + esc(paper.title) + '</h1>' +
          '<p>' + esc(paper.meta.institute) + ' · ' + esc(QPG.syllabus.subjectName(paper.subject)) + ' ધોરણ ' + esc(paper.std) + ' · CH ' + esc(paper.meta.chapterText) +
          ' · <span data-saved>સેવ થયું</span></p></div>' +
          '<div class="actions"><a class="btn btn-primary" href="#/papers/view/' + esc(paper.id) + '?set=' + si + '">' + icon('eye') + 'પેપર જુઓ / પ્રિન્ટ</a></div></div>' +
        '<div class="set-bar">' +
          (paper.sets.length > 1 ? '<div class="seg set-tabs" role="tablist">' + paper.sets.map(function (s, i) {
            return '<button type="button" role="tab" aria-selected="' + (i === si) + '" data-set="' + i + '">Set ' + esc(s.label) + '</button>';
          }).join('') + '</div>' : '') +
          (paper.sets.length < 2 ? '<button type="button" class="btn btn-sm" data-act="add-set">' + icon('plus') + 'Set B ઉમેરો</button>'
            : '<button type="button" class="btn btn-sm btn-quiet" data-act="drop-set">Set ' + esc(paper.sets[paper.sets.length - 1].label) + ' કાઢો</button>') +
        '</div>' +
        '<div class="ptotal is-' + (errors ? 'err' : (vs.total !== configured ? 'warn' : 'ok')) + '">' +
          '<div class="ptotal-num"><b>' + vs.total + '</b><span>/ ' + configured + ' ગુણ</span></div>' +
          '<div class="ptotal-secs">' + vs.sections.map(function (s) {
            var cls = s.issues.some(function (i) { return i.level === 'error'; }) ? 'err' : s.issues.length ? 'warn' : 'ok';
            return '<a href="#" data-jump="' + esc(s.id) + '" class="pchip is-' + cls + '">' + esc(s.title) + ' <b>' + s.count + '/' + s.print + '</b> · ' + s.total + ' ગુણ</a>';
          }).join('') + '</div>' +
          '<div class="ptotal-msg">' + (errors ? icon('error') + errors + ' વાત સુધારવી જરૂરી' : warns ? icon('warn') + warns + ' ધ્યાન રાખવા જેવી વાત' : icon('ok') + 'પેપર તૈયાર છે') + '</div>' +
          (empty ? '<button type="button" class="btn btn-sm" data-act="fill-all">ખાલી ' + empty + ' જગ્યા આપોઆપ ભરો</button>' : '') +
          '<button type="button" class="btn btn-sm btn-quiet" data-act="repick">બધા પ્રશ્નો ફરી પસંદ કરો</button>' +
        '</div>' +
        (configured && vs.total !== configured
          ? '<div class="notice notice-demo">' + icon('warn') + '<div>' + esc('Set ' + vs.label + ': પ્રશ્નોના ગુણનો સરવાળો ' + vs.total + ' થાય છે, પણ પેપર પર કુલ ગુણ ' + configured + ' લખ્યા છે. પ્રશ્નોના પોતાના ગુણ બદલાતા નથી — વિભાગ, પ્રશ્નો અથવા "કુલ ગુણ" સુધારો.') + '</div></div>' : '') +
        (overlapIds.length && paper.sets.length > 1 ? '<div class="notice notice-info">' + icon('info') + '<div>' + overlapIds.length + ' પ્રશ્નો બંને Set માં છે (બેંકમાં પૂરતા જુદા પ્રશ્નો ન હતા). એને "બદલો" થી બદલી શકો છો.</div></div>' : '') +
        detailsHtml() +
        '<div class="psecs">' + paper.sections.map(function (sec) { return sectionHtml(sec, vs, nums, ranges, overlapIds); }).join('') + '</div>' +
        '<div class="form-foot"><a class="btn btn-quiet" href="#/papers">' + icon('back') + 'બધાં પેપર</a><span class="spacer"></span>' +
          '<a class="btn btn-primary" href="#/papers/view/' + esc(paper.id) + '?set=' + si + '">' + icon('eye') + 'પેપર જુઓ / પ્રિન્ટ</a></div>';
      QPG.math.render(el.querySelector('.psecs'));
    }

    function secOf(node) { var s = node.closest('[data-sec]'); return s && paper.sections.find(function (x) { return x.id === s.getAttribute('data-sec'); }); }

    el.addEventListener('click', function (e) {
      var jump = e.target.closest('[data-jump]');
      if (jump) { e.preventDefault(); var t = el.querySelector('[data-sec="' + jump.getAttribute('data-jump') + '"]'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      var tab = e.target.closest('[data-set]');
      if (tab) { si = +tab.getAttribute('data-set'); draw(); return; }
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      var sec = secOf(b);
      var item = b.closest('[data-i]');
      var i = item ? +item.getAttribute('data-i') : -1;

      if (act === 'up' || act === 'down') persist(A().move(paper, si, sec.id, i, act === 'up' ? -1 : 1));
      else if (act === 'remove') persist(A().remove(paper, si, sec.id, i), 'પ્રશ્ન કાઢ્યો');
      else if (act === 'replace') {
        pickQuestions({ paper: paper, setIndex: si, section: sec, mode: 'replace', replaceNo: A().numbering(paper, si)[sec.id][i] }).then(function (ids) {
          if (ids.length) persist(A().replace(paper, si, sec.id, i, ids[0]), 'પ્રશ્ન બદલ્યો');
        });
      } else if (act === 'add') {
        pickQuestions({ paper: paper, setIndex: si, section: sec, mode: 'add' }).then(function (ids) {
          if (!ids.length) return;
          var r = A().add(paper, si, sec.id, ids);
          persist(r.paper, (ids.length - r.skipped.length) + ' પ્રશ્ન ઉમેર્યા' + (r.skipped.length ? ' (' + r.skipped.length + ' પહેલેથી પેપરમાં હતા)' : ''));
        });
      } else if (act === 'fill' || act === 'fill-all') {
        var only = act === 'fill' ? sec.id : null;
        var p2 = JSON.parse(JSON.stringify(paper));
        if (only) p2.sections = p2.sections.filter(function (s) { return s.id === only; });
        var r = A().autoFill(p2, app.state.questions, { seed: Date.now() % 2147483647, setIndexes: [si] });
        var next = JSON.parse(JSON.stringify(paper));
        next.sets[si].items = Object.assign(next.sets[si].items, r.paper.sets[si].items);
        var before = A().idsInSet(paper.sets[si]).length, after = A().idsInSet(next.sets[si]).length;
        persist(next, after > before ? (after - before) + ' પ્રશ્નો ઉમેર્યા' : 'બેંકમાં યોગ્ય ગુણ/પ્રકારના બીજા પ્રશ્નો નથી');
      } else if (act === 'repick') {
        QPG.ui.confirmDialog({ title: 'Set ' + paper.sets[si].label + ' ના બધા પ્રશ્નો ફરી પસંદ કરવા છે?', body: 'હાલના બધા પ્રશ્નો હટીને નવા આપોઆપ પસંદ થશે. વિભાગ અને વિગત એ જ રહેશે.', ok: 'ફરી પસંદ કરો' })
          .then(function (yes) {
            if (!yes) return;
            var r2 = A().autoFill(paper, app.state.questions, { seed: Date.now() % 2147483647, setIndexes: [si], keepExisting: false });
            persist(r2.paper, 'નવા પ્રશ્નો પસંદ થયા');
          });
      } else if (act === 'add-set') {
        var withB = A().setCount(paper, 2);
        var r3 = A().autoFill(withB, app.state.questions, { seed: Date.now() % 2147483647, setIndexes: [1] });
        si = 1;
        persist(r3.paper, 'Set B બન્યો' + (r3.reused.length ? ' — ' + r3.reused.length + ' પ્રશ્નો Set A જેવા જ છે' : ''));
      } else if (act === 'drop-set') {
        var label = paper.sets[paper.sets.length - 1].label;
        QPG.ui.confirmDialog({ title: 'Set ' + label + ' કાઢી નાખવો છે?', body: 'એના પ્રશ્નો પ્રશ્ન બેંકમાં રહેશે; ફક્ત આ Set પેપરમાંથી નીકળશે.', ok: 'Set ' + label + ' કાઢો', danger: true })
          .then(function (yes) { if (yes) { si = 0; persist(A().setCount(paper, paper.sets.length - 1), 'Set ' + label + ' કાઢ્યો'); } });
      } else if (act === 'sec-edit') {
        var form = b.closest('.psec').querySelector('.psec-form'); form.hidden = !form.hidden;
      } else if (act === 'sec-save') {
        var box = b.closest('.psec-form'), ch = {};
        box.querySelectorAll('[data-sk]').forEach(function (inp) { ch[inp.getAttribute('data-sk')] = inp.value; });
        if (Number(ch.attempt) > Number(ch.print)) { QPG.ui.toast('લખવાના પ્રશ્નો છાપવાના કરતાં વધારે ન હોઈ શકે'); return; }
        persist(A().updateSection(paper, sec.id, ch), 'વિભાગ બદલ્યો');
      }
    });

    el.addEventListener('input', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-m')) {
        var k = t.getAttribute('data-m');
        paper.meta[k] = t.type === 'number' ? Number(t.value) : t.value;
        var s = el.querySelector('[data-saved]'); if (s) s.textContent = 'સેવ થાય છે…';
        saveSoon(k === 'totalMarks');
      } else if (t.hasAttribute('data-title')) {
        paper.title = t.value; saveSoon(false);
      }
    });
    function saveSoon(redraw) {
      clearTimeout(saveSoon.t);
      saveSoon.t = setTimeout(function () {
        saving = saving.then(function () { return app.savePaper(paper); }).then(function (saved) {
          paper = saved; var s = el.querySelector('[data-saved]'); if (s) s.textContent = 'સેવ થયું';
          if (redraw) { var open = el.querySelector('.pdetails').open; draw(); el.querySelector('.pdetails').open = open; }
        });
      }, 500);
    }
    el.addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-mc')) { paper.meta[t.getAttribute('data-mc')] = t.checked; saveSoon(false); }
      if (t.hasAttribute('data-dup')) { paper.allowDuplicates = t.checked; saveSoon(true); }
    });

    draw();
  }

  QPG.views.paperEditor.pickQuestions = pickQuestions;
})(self);
