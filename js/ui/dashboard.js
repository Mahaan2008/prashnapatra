/* Home screen: 2x2 action matrix, collapsible chapter list for allowed subjects & standards. */
(function (root) {
  'use strict';
  var QPG = root.QPG;
  QPG.views = QPG.views || {};
  var esc = function (s) { return QPG.questionHtml.esc(s); };
  var icon = function (n) { return QPG.ui.icon(n); };

  function coveragePanel(subject, std, questions, isOpen) {
    var chapters = QPG.syllabus.chapters(subject, std);
    var counts = QPG.filters.chapterCounts(questions, subject, std);
    var total = Object.keys(counts).reduce(function (s, k) { return s + counts[k]; }, 0);
    var max = Math.max.apply(null, [1].concat(Object.keys(counts).map(function (k) { return counts[k]; })));
    var rows = chapters.map(function (c) {
      var n = counts[c.no] || 0;
      return '<li><a href="#/questions?subject=' + subject + '&std=' + std + '&chapter=' + c.no + '">' +
        '<span class="cov-no">' + c.no + '</span><span class="cov-name">' + esc(c.name) + '</span>' +
        '<span class="cov-count">' + (n ? '<span class="cov-bar" aria-hidden="true"><i style="width:' + Math.round(n / max * 100) + '%"></i></span>' + n
          : '<span class="cov-zero">0</span>') + '</span></a></li>';
    }).join('');

    var subIcon = subject === 'maths' ? '📐' : '⚡';
    var stdColor = std === 11 ? '#2563eb' : '#7c3aed';

    return '<section class="panel cov-panel' + (isOpen ? ' is-open' : '') + '" data-cov-panel="' + subject + '-' + std + '" style="padding:0;overflow:hidden;border:1px solid var(--rule);margin-bottom:14px;border-radius:var(--radius)">' +
      '<button type="button" class="cov-toggle-btn" data-act="toggle-cov" data-target="' + subject + '-' + std + '" style="width:100%;text-align:left;background:none;border:none;padding:15px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;-webkit-tap-highlight-color:transparent">' +
        '<div style="display:flex;align-items:center;gap:12px;min-width:0">' +
          '<div style="width:38px;height:38px;border-radius:10px;background:' + (subject === 'maths' ? '#eff6ff' : '#fef2f2') + ';display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">' + subIcon + '</div>' +
          '<div>' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
              '<h3 style="margin:0;font-size:16px;color:var(--ink-strong);font-weight:700">' + esc(QPG.syllabus.subjectName(subject)) + '</h3>' +
              '<span style="font-size:12px;font-weight:700;color:#fff;background:' + stdColor + ';padding:2px 8px;border-radius:99px">ધોરણ ' + std + '</span>' +
            '</div>' +
            '<div style="font-size:13px;color:var(--muted);margin-top:2px">કુલ ' + chapters.length + ' પ્રકરણો · <b>' + total + '</b> પ્રશ્નો</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">' +
          '<span class="cov-pill" style="font-size:12.5px;font-weight:600;color:var(--ink);background:var(--ink-wash);padding:4px 10px;border-radius:20px;display:flex;align-items:center;gap:4px">' +
            '<span class="cov-arrow" style="font-size:11px">' + (isOpen ? '▲' : '▼') + '</span> ' +
            '<span class="cov-text">' + (isOpen ? 'પ્રકરણો બંધ કરો' : 'પ્રકરણો જુઓ') + '</span>' +
          '</span>' +
        '</div>' +
      '</button>' +
      '<div class="cov-collapse" style="' + (isOpen ? 'display:block;' : 'display:none;') + 'border-top:1px solid var(--rule);background:var(--sheet)">' +
        '<div style="padding:10px 18px;font-size:12.5px;color:var(--muted);background:var(--canvas);border-bottom:1px solid var(--rule)">' +
          '👉 પ્રકરણ પર ક્લિક કરીને સીધા એ પ્રકરણના પ્રશ્નો જુઓ:' +
        '</div>' +
        '<ul class="cov-list" style="margin:0">' + rows + '</ul>' +
      '</div>' +
    '</section>';
  }

  QPG.views.dashboard = function (el) {
    var qs = QPG.app.userQuestions ? QPG.app.userQuestions() : QPG.app.state.questions;
    var u = QPG.auth && QPG.auth.user();
    var isAdmin = QPG.app.isAdmin && QPG.app.isAdmin();
    var demoCount = qs.filter(function (q) { return q.isDemo; }).length;

    var allowedSubs = QPG.app.userSubjects ? QPG.app.userSubjects() : ['physics', 'maths'];
    var allowedStds = QPG.app.userStandards ? QPG.app.userStandards() : [11, 12];

    var covPanels = '';
    if (allowedSubs.indexOf('physics') >= 0) {
      if (allowedStds.indexOf(11) >= 0) covPanels += coveragePanel('physics', 11, qs, false);
      if (allowedStds.indexOf(12) >= 0) covPanels += coveragePanel('physics', 12, qs, false);
    }
    if (allowedSubs.indexOf('maths') >= 0) {
      if (allowedStds.indexOf(11) >= 0) covPanels += coveragePanel('maths', 11, qs, false);
      if (allowedStds.indexOf(12) >= 0) covPanels += coveragePanel('maths', 12, qs, false);
    }

    // Role badge
    var roleBadge = isAdmin
      ? '<span style="font-size:12px;background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:99px;font-weight:700">👑 મુખ્ય ઍડમિન (Admin)</span>'
      : '<span style="font-size:12px;background:#eff6ff;color:#1e40af;padding:3px 10px;border-radius:99px;font-weight:700">👨‍🏫 શિક્ષક (' +
        allowedSubs.map(function (s) { return s === 'maths' ? 'Maths' : 'Physics'; }).join(', ') + ' · Std ' +
        allowedStds.join(', ') + ')</span>';

    var welcomeBanner = u ?
      '<div style="background:var(--sheet);border:1px solid var(--rule);border-radius:var(--radius);padding:18px 20px;margin-bottom:20px;box-shadow:0 2px 10px rgba(0,0,0,0.03)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">' +
          '<div>' +
            '<div style="margin-bottom:6px">' + roleBadge + '</div>' +
            '<h2 style="margin:0;font-size:19px;color:var(--ink-strong)">સ્વાગત છે, ' + esc(u.name || (u.email ? u.email.split('@')[0] : 'શિક્ષક મિત્ર')) + '!</h2>' +
            '<div style="font-size:13px;color:var(--muted);margin-top:2px">' + esc(u.email || '') + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<div style="background:var(--canvas);border:1px solid var(--rule);padding:8px 14px;border-radius:var(--radius-sm);text-align:center">' +
              '<div style="font-size:11.5px;color:var(--muted)">તમારા પ્રશ્નો</div>' +
              '<b style="font-size:17px;color:var(--ink-strong)">' + qs.length + '</b>' +
            '</div>' +
            (isAdmin ? '<a href="#/settings" class="btn btn-sm btn-quiet" style="font-size:12.5px;font-weight:600">👑 ઍડમિન પેનલ</a>' : '') +
          '</div>' +
        '</div>' +
      '</div>' : '';

    el.innerHTML =
      welcomeBanner +
      (demoCount ? '<div class="notice notice-demo">' + icon('info') + '<div>બેંકમાં <b>' + demoCount +
        ' ડેમો પ્રશ્નો</b> છે. <a href="#/settings">સેટિંગ્સ</a>માંથી એક ક્લિકમાં દૂર કરી શકાશે.</div></div>' : '') +

      /* 2x2 Matrix Quick Actions Grid */
      '<div class="dash-actions">' +
        '<a class="dash-action is-main" href="#/new-paper">' +
          icon('newpaper') +
          '<strong>નવું પેપર બનાવો</strong>' +
          '<span>બ્લુપ્રિન્ટ & ગુણ મુજબ</span>' +
        '</a>' +
        '<a class="dash-action" href="#/questions/new">' +
          icon('plus') +
          '<strong>નવો પ્રશ્ન ઉમેરો</strong>' +
          '<span>જવાબ & ઉકેલ સાથે</span>' +
        '</a>' +
        '<a class="dash-action" href="#/questions">' +
          icon('bank') +
          '<strong>પ્રશ્ન બેંક (' + qs.length + ')</strong>' +
          '<span>શોધો અને સુધારો</span>' +
        '</a>' +
        '<a class="dash-action" href="#/import">' +
          icon('upload') +
          '<strong>પ્રશ્નો Import</strong>' +
          '<span>Word, Excel, PDF</span>' +
        '</a>' +
      '</div>' +

      /* Collapsible Chapters by Standard */
      '<div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">' +
        '<h3 style="margin:0;font-size:16px;color:var(--ink-strong)">📚 વિષય અને ધોરણવાર પ્રકરણો (Chapters)</h3>' +
        '<span style="font-size:12.5px;color:var(--muted)">ક્લિક કરવાથી પ્રકરણો ખુલશે</span>' +
      '</div>' +
      '<div class="coverage-grid" style="grid-template-columns:1fr">' +
        (covPanels || '<p class="muted-p">કોઈ પ્રકરણો મળ્યા નહીં.</p>') +
      '</div>';

    el.addEventListener('click', function (e) {
      var covBtn = e.target.closest('[data-act="toggle-cov"]');
      if (covBtn) {
        e.preventDefault();
        var panel = covBtn.closest('.cov-panel');
        if (panel) {
          var collapse = panel.querySelector('.cov-collapse');
          var arrow = panel.querySelector('.cov-arrow');
          var text = panel.querySelector('.cov-text');
          if (collapse) {
            var isHidden = collapse.style.display === 'none';
            collapse.style.display = isHidden ? 'block' : 'none';
            panel.classList.toggle('is-open', isHidden);
            if (arrow) arrow.textContent = isHidden ? '▲' : '▼';
            if (text) text.textContent = isHidden ? 'પ્રકરણો બંધ કરો' : 'પ્રકરણો જુઓ';
          }
        }
      }
    });
  };
})(self);
