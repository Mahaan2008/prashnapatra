/* Home screen: main actions and chapter-wise question count for each subject. */
(function (root) {
  'use strict';
  var QPG = root.QPG;
  QPG.views = QPG.views || {};
  var esc = function (s) { return QPG.questionHtml.esc(s); };
  var icon = function (n) { return QPG.ui.icon(n); };

  function coveragePanel(subject, std, questions) {
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
    return '<section class="panel" aria-labelledby="cov-' + subject + '"><div class="cov-head">' +
      '<h2 id="cov-' + subject + '">' + esc(QPG.syllabus.subjectName(subject)) + ' <span style="font-size:15px;color:var(--muted);font-family:var(--sans)">ધોરણ ' + std + '</span></h2>' +
      '<span class="cov-total"><b>' + total + '</b> પ્રશ્નો</span></div>' +
      '<ul class="cov-list">' + rows + '</ul></section>';
  }

  QPG.views.dashboard = function (el) {
    var qs = QPG.app.state.questions;
    var demoCount = qs.filter(function (q) { return q.isDemo; }).length;
    var other = qs.filter(function (q) {
      return !((q.subject === 'physics' && q.std === 11) || (q.subject === 'maths' && q.std === 12));
    }).length;

    el.innerHTML =
      '<div class="page-head"><div><h1>આજે શું તૈયાર કરવું છે?</h1>' +
      '<p>પ્રશ્નો તમારા, ફોર્મેટ તમારું — પેપર એક જગ્યાએથી તૈયાર.</p></div></div>' +
      (demoCount ? '<div class="notice notice-demo">' + icon('info') + '<div>બેંકમાં <b>' + demoCount +
        ' ડેમો પ્રશ્નો</b> છે, જે સંદર્ભ પેપરમાંથી લીધા છે, જેથી એપ અજમાવી શકો. એ <span class="badge badge-demo">ડેમો</span> નિશાનીથી ઓળખાય છે. ' +
        '<a href="#/settings">સેટિંગ્સ</a>માંથી એક ક્લિકમાં દૂર કરી શકાશે.</div></div>' : '') +
      '<div class="dash-actions">' +
      '<a class="dash-action is-main" href="#/new-paper">' + icon('newpaper') + '<strong>નવું પેપર બનાવો</strong><span>તમારા ફોર્મેટમાં, પ્રશ્નો આપોઆપ</span></a>' +
      '<a class="dash-action" href="#/questions/new">' + icon('plus') + '<strong>પ્રશ્ન ઉમેરો</strong><span>જવાબ અને ઉકેલ સાથે</span></a>' +
      '<a class="dash-action" href="#/questions">' + icon('bank') + '<strong>પ્રશ્ન બેંક</strong><span>' + qs.length + ' પ્રશ્નો શોધો, સુધારો</span></a>' +
      '<a class="dash-action" href="#/import">' + icon('upload') + '<strong>પ્રશ્નો Import</strong><span>Excel, Word કે પેસ્ટ કરેલા લખાણમાંથી</span></a>' +
      '</div>' +
      '<div class="coverage-grid">' + coveragePanel('physics', 11, qs) + coveragePanel('maths', 12, qs) + '</div>' +
      (other ? '<p style="color:var(--muted);font-size:14px;margin-top:12px">બીજા ધોરણના ' + other + ' પ્રશ્નો <a href="#/questions">પ્રશ્ન બેંક</a>માં છે.</p>' : '');
  };
})(self);
