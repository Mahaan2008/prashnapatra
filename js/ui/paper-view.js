/* Paper preview on A4 sheets, print / Save as PDF, answer key; and the saved papers list. */
(function (root) {
  'use strict';
  var QPG = root.QPG;
  QPG.views = QPG.views || {};
  var esc = function (s) { return QPG.questionHtml.esc(s); };
  var icon = function (n) { return QPG.ui.icon(n); };

  QPG.views.paperView = function (el, ctx) {
    var app = QPG.app;
    el.innerHTML = '<p style="color:var(--muted)">પેપર ખૂલે છે…</p>';
    QPG.db.getPaper(ctx.id).then(function (paper) {
      if (!paper || paper.deletedAt) {
        el.innerHTML = '<div class="empty"><strong>આ પેપર મળ્યું નહીં</strong><br><a class="btn" href="#/papers">સેવ કરેલાં પેપર</a></div>';
        return;
      }
      var q = ctx.query || {};
      var st = { set: q.set === 'all' ? 'all' : Math.min(Number(q.set) || 0, paper.sets.length - 1), key: q.key === '1' };
      var preview = !!root.QPG_PREVIEW;
      var getQ = app.getQFor(paper);
      var canFile = QPG.pdfExport.available();
      var canShare = canFile && QPG.ui.canShareFiles();

      el.innerHTML =
        '<div class="page-head view-head"><div><h1>' + esc(paper.title) + '</h1><p data-info>પાનાં ગોઠવાય છે…</p></div>' +
          '<div class="actions"><a class="btn btn-quiet" href="#/papers/edit/' + esc(paper.id) + '?set=' + (st.set === 'all' ? 0 : st.set) + '">' + icon('edit') + 'પ્રશ્નો બદલો</a>' +
          (preview ? '' : '<button type="button" class="btn' + (canFile ? '' : ' btn-primary') + '" data-act="print">' + icon('download') + 'પ્રિન્ટ / Save as PDF</button>') +
          (canFile ? '<button type="button" class="btn btn-primary" data-act="pdf">' + icon(canShare ? 'share' : 'download') + (canShare ? 'PDF શેર કરો (WhatsApp)' : 'PDF ફાઇલ ડાઉનલોડ') + '</button>' : '') +
          '</div></div>' +
        '<div class="view-bar">' +
          (paper.sets.length > 1 ? '<div class="seg">' + paper.sets.map(function (s, i) {
            return '<label><input type="radio" name="vset" value="' + i + '"' + (st.set === i ? ' checked' : '') + '><span>Set ' + esc(s.label) + '</span></label>';
          }).join('') + '<label><input type="radio" name="vset" value="all"' + (st.set === 'all' ? ' checked' : '') + '><span>બધા Set</span></label></div>' : '') +
          '<div class="seg"><label><input type="radio" name="vkey" value="0"' + (!st.key ? ' checked' : '') + '><span>પ્રશ્નપત્ર</span></label>' +
          '<label><input type="radio" name="vkey" value="1"' + (st.key ? ' checked' : '') + '><span>જવાબવહી</span></label></div>' +
        '</div>' +
        (preview ? '<div class="notice notice-info">' + icon('info') + '<div>આ ઓનલાઇન નમૂનામાં પ્રિન્ટ કે PDF બનતી નથી. ZIP વાળી એપમાં <b>પ્રિન્ટ / Save as PDF</b> છે, અને એપ ઓનલાઇન મૂક્યા પછી ફોનમાં <b>PDF શેર કરો (WhatsApp)</b> બટન આવશે.</div></div>' : '') +
        '<div class="notice notice-info" data-progress hidden></div>' +
        '<div class="notice notice-error" data-overflow hidden></div>' +
        '<div class="paper-zoom"><div class="paper-host"></div></div>';

      var host = el.querySelector('.paper-host');
      var zoom = el.querySelector('.paper-zoom');

      function draw() {
        el.querySelector('[data-info]').textContent = 'પાનાં ગોઠવાય છે…';
        QPG.paperRender.render(host, paper, st.set, { getQ: getQ, answerKey: st.key }).then(function (r) {
          QPG.paperRender.fit(host, zoom.clientWidth);
          var v = QPG.assembly.validate(paper, getQ);
          var setsShown = st.set === 'all' ? v.sets : [v.sets[st.set]];
          var bad = setsShown.reduce(function (n, s) { return n + s.issues.length; }, 0);
          el.querySelector('[data-info]').innerHTML = r.pages + ' પાનાં · A4' +
            (st.key ? ' · જવાબવહી' : '') +
            (bad ? ' · <a href="#/papers/edit/' + esc(paper.id) + '">' + bad + ' વાત ધ્યાન રાખવા જેવી</a>' : ' · ગુણ બરાબર');
          var ov = el.querySelector('[data-overflow]');
          if (r.overflow.length) {
            ov.hidden = false;
            ov.innerHTML = icon('warn') + '<div>પાના ' + r.overflow.join(', ') + ' પર એક પ્રશ્ન આખા પાના કરતાં લાંબો છે (લાલ ડેશવાળી રેખા). આકૃતિ નાની કરો અથવા પ્રશ્ન ટૂંકો કરો.</div>';
          } else ov.hidden = true;
        });
      }

      el.addEventListener('change', function (e) {
        if (e.target.name === 'vset') { st.set = e.target.value === 'all' ? 'all' : Number(e.target.value); draw(); }
        if (e.target.name === 'vkey') { st.key = e.target.value === '1'; draw(); }
      });
      var busy = false;
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-act="print"]')) QPG.paperRender.print(host);
        var pdfBtn = e.target.closest('[data-act="pdf"]');
        if (pdfBtn && !busy) {
          busy = true; pdfBtn.disabled = true;
          var prog = el.querySelector('[data-progress]');
          prog.hidden = false; prog.innerHTML = icon('info') + '<div>PDF બને છે…</div>';
          var setPart = st.set === 'all' ? '' : (paper.sets.length > 1 ? ' Set ' + paper.sets[st.set].label : '');
          var name = QPG.pdfExport.safeName(paper.title + setPart + (st.key ? ' - Javabvahi' : '')) + '.pdf';
          QPG.pdfExport.make(paper, st.set, { getQ: getQ, answerKey: st.key }, function (d, t) {
            prog.innerHTML = icon('info') + '<div>PDF બને છે… પાનું ' + d + ' / ' + t + '</div>';
          }).then(function (blob) {
            prog.hidden = true;
            return QPG.ui.saveFile(blob, name, canShare);
          }).then(function (how) {
            if (how === 'downloaded') QPG.ui.toast('PDF ડાઉનલોડ થઈ: ' + name);
            else if (how === 'shared') QPG.ui.toast('PDF મોકલી');
          }).catch(function (err) {
            prog.hidden = false;
            prog.className = 'notice notice-error';
            prog.innerHTML = icon('error') + '<div>PDF બની શકી નહીં: ' + esc(err && err.message || err) + '. "પ્રિન્ટ / Save as PDF" વાપરો.</div>';
          }).finally(function () { busy = false; pdfBtn.disabled = false; });
        }
      });
      var onResize = QPG.ui.debounce(function () { QPG.paperRender.fit(host, zoom.clientWidth); }, 150);
      window.addEventListener('resize', onResize);
      draw();
      ctx.cleanup = function () { window.removeEventListener('resize', onResize); };
    });
    return function () { if (ctx.cleanup) ctx.cleanup(); };
  };

  /* ---------- saved papers ---------- */
  QPG.views.papers = function (el) {
    var app = QPG.app;
    el.innerHTML = '<div class="page-head"><div><h1>સેવ કરેલાં પેપર</h1><p>દરેક ફેરફાર આપોઆપ સેવ થાય છે.</p></div>' +
      '<div class="actions"><a class="btn btn-primary" href="#/new-paper">' + icon('newpaper') + 'નવું પેપર</a></div></div><div data-list></div>';
    var listEl = el.querySelector('[data-list]');

    function draw() {
      QPG.db.allPapers().then(function (papers) {
        if (!papers.length) {
          listEl.innerHTML = '<div class="empty"><strong>હજુ એક પણ પેપર નથી</strong>ફોર્મેટ અને પ્રકરણ પસંદ કરો — પ્રશ્નો આપોઆપ ગોઠવાઈ જશે.<br>' +
            '<a class="btn btn-primary" href="#/new-paper">' + icon('newpaper') + 'પહેલું પેપર બનાવો</a></div>';
          return;
        }
        listEl.innerHTML = '<ul class="paper-list">' + papers.map(function (p) {
          var v = QPG.assembly.validate(p, app.getQFor(p));
          var errs = v.sets.reduce(function (n, s) { return n + s.issues.filter(function (i) { return i.level === 'error'; }).length; }, 0);
          var t = v.sets.map(function (s) { return s.total; });
          return '<li class="paper-card" data-id="' + esc(p.id) + '">' +
            '<div class="paper-card-main"><a class="paper-card-title" href="#/papers/edit/' + esc(p.id) + '">' + esc(p.title) + '</a>' +
            '<div class="qcard-meta"><span class="ch">' + esc(QPG.syllabus.subjectName(p.subject)) + ' · ધો. ' + esc(p.std) + '</span><span>CH ' + esc(p.meta.chapterText) + '</span>' +
            '<span>' + esc(p.meta.institute) + '</span><span>' + p.sets.map(function (s) { return 'Set ' + s.label; }).join(', ') + '</span>' +
            '<span>' + esc(QPG.ui.formatDate(p.updatedAt)) + '</span></div></div>' +
            '<div class="paper-card-marks ' + (errs ? 'is-err' : '') + '"><b>' + t.join(' / ') + '</b><small>/ ' + esc(p.meta.totalMarks) + ' ગુણ</small></div>' +
            '<div class="paper-card-acts">' +
              '<a class="btn btn-sm" href="#/papers/view/' + esc(p.id) + '">' + icon('eye') + 'જુઓ</a>' +
              '<a class="btn btn-sm btn-quiet" href="#/papers/edit/' + esc(p.id) + '">' + icon('edit') + 'સુધારો</a>' +
              '<button type="button" class="btn btn-sm btn-quiet" data-act="copy">' + icon('copy') + 'નકલ</button>' +
              '<button type="button" class="btn btn-sm btn-quiet" data-act="delete" style="color:var(--red)">' + icon('trash') + 'કાઢો</button>' +
            '</div></li>';
        }).join('') + '</ul>';
      });
    }

    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var id = b.closest('[data-id]').getAttribute('data-id');
      QPG.db.getPaper(id).then(function (p) {
        if (b.getAttribute('data-act') === 'delete') {
          QPG.ui.confirmDialog({ title: '"' + p.title + '" કાઢી નાખવું છે?', body: 'પેપર યાદીમાંથી નીકળી જશે. એના પ્રશ્નો પ્રશ્ન બેંકમાં રહેશે.', ok: 'પેપર કાઢો', danger: true })
            .then(function (yes) { if (yes) app.deletePaper(p).then(function () { QPG.ui.toast('પેપર કાઢી નાખ્યું'); draw(); }); });
        } else {
          var c = JSON.parse(JSON.stringify(p));
          c.id = QPG.schema.uuid(); c.title = p.title + ' (નકલ)'; c.createdAt = new Date().toISOString(); c.rev = 0;
          app.savePaper(c).then(function (saved) { QPG.ui.toast('નકલ બની'); app.go('/papers/edit/' + saved.id); });
        }
      });
    });
    draw();
  };
})(self);
