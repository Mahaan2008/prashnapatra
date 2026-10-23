/* Lays a paper out on A4 sheets in the owner's formats.
   Blocks (header, section headings, questions) are poured into sheets one by one;
   a heading always moves with its first question and a question is never split. */
(function (root) {
  'use strict';
  var QPG = root.QPG = root.QPG || {};
  var esc = function (s) { return QPG.questionHtml.esc(s); };

  var FONT_FACES = [
    '400 12pt "QP Serif"', '700 12pt "QP Serif"', '400 12pt "QP Sans"', '600 12pt "QP Sans"', '700 12pt "QP Sans"',
    '400 12pt KaTeX_Main', 'italic 400 12pt KaTeX_Math', '400 12pt KaTeX_Size1', '400 12pt KaTeX_Size2', '400 12pt KaTeX_AMS'
  ];
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(FONT_FACES.map(function (f) { return document.fonts.load(f, 'અa1').catch(function () {}); }))
      .then(function () { return document.fonts.ready; });
  }

  /* ---------- sheet chrome ---------- */
  function band(pos, text) {
    return '<div class="sh-band ' + pos + '"><span class="sh-ring"></span><span class="sh-curl"></span><span class="sh-rule"></span><span class="sh-dot"></span>' +
      (text ? '<span class="sh-cart">' + esc(text) + '</span>' : '') +
      '<span class="sh-dot"></span><span class="sh-rule"></span><span class="sh-curl" style="transform:scaleX(-1)"></span><span class="sh-ring"></span></div>';
  }
  function newSheet(paper, pageNo) {
    var m = paper.meta;
    var s = document.createElement('div');
    s.className = 'sheet style-' + (paper.style || 'physics');
    s.innerHTML = '<div class="sh-frame"></div>' + band('top', m.topText) + band('bottom', m.bottomText) +
      (m.showWatermark !== false && m.watermark ? '<div class="sh-wm" aria-hidden="true">' + esc(m.watermark) + '</div>' : '') +
      '<div class="sh-no">' + pageNo + '</div><div class="sh-content"></div>';
    return s;
  }

  /* ---------- headers ---------- */
  function physicsHeader(paper, set) {
    var m = paper.meta;
    var ch = String(m.chapterText || '').replace(/ થી /g, ' to ');
    return '<div class="pb">' +
      '<div class="ph-head"><div>' + (m.showSetLetter ? '<div class="ph-set">' + esc(set.label) + '</div>' : '') + '</div>' +
      '<div class="ph-inst">' + esc(m.institute) + '</div><div></div></div>' +
      (m.examName ? '<div class="ph-exam">' + esc(m.examName) + (m.paperLabel ? ' — ' + esc(m.paperLabel) : '') + '</div>' : '') +
      '<div class="ph-rows">' +
        '<div class="ph-row"><span><b>Std :</b> ' + esc(m.std) + '<sup>th</sup></span><span></span><span>' + (m.duration ? '<b>Time :</b> ' + esc(m.duration) : '') + '</span></div>' +
        '<div class="ph-row"><span><b>Ch : ' + esc(ch) + '</b></span><span class="ph-sub">Sub : ' + esc(m.subjectLabel) + '</span><span><b>Marks :</b> ' + esc(m.totalMarks) + '</span></div>' +
        (m.date ? '<div class="ph-row"><span>' + esc(m.date) + '</span><span></span><span></span></div>' : '') +
      '</div></div>';
  }

  function mathsHeader(paper, set) {
    var m = paper.meta;
    var logo = function (src) { return src ? '<img class="mh-logo" src="' + esc(src) + '" alt="">' : '<span></span>'; };
    var setText = paper.sets.length > 1 ? ' (Set ' + esc(set.label) + ')' : '';
    return '<div class="pb">' +
      '<div class="mh-head">' + logo(m.logoLeft) + '<div class="mh-inst">' + esc(m.institute) + '</div>' + logo(m.logoRight) + '</div>' +
      '<div class="mh-bands">' +
        '<div class="mh-band"><span class="lat">STD-' + esc(m.std) + '</span><span class="lat">CH-' + esc(m.chapterText) + '</span><span class="lat">' + esc(m.paperLabel || '') + setText + '</span></div>' +
        '<div class="mh-band"><span>વિષય :- ' + esc(m.subjectLabel) + '</span><span>' + esc(m.examName || '') + (m.duration ? ' (સમય : ' + esc(m.duration) + ')' : '') + '</span><span class="lat">MARKS-' + esc(m.totalMarks) + '</span></div>' +
        (m.date ? '<div style="text-align:right;font-size:10pt;font-family:var(--sans)">' + esc(m.date) + '</div>' : '') +
      '</div></div>';
  }

  /* ---------- section headings ---------- */
  function physicsSection(sec, range) {
    var choice = Number(sec.attempt) < Number(sec.print) ? '<span class="ps-choice">(કોઈપણ ' + esc(sec.attempt) + ')</span>' : '';
    return '<div class="pb ps-head">' +
      (sec.title ? '<div class="ps-title">' + esc(sec.title) + choice + '</div>' : '') +
      '<div class="ps-instr">[ ' + esc(QPG.templates.instruction(sec, range)) + ' ]</div></div>';
  }
  function mathsSection(sec, range, newPart, total) {
    return '<div class="pb">' +
      (newPart && sec.part ? '<div class="mh-part"><span>' + esc(sec.part) + '</span></div>' : '') +
      (sec.title ? '<div class="mh-vib"><span>' + esc(sec.title) + '</span></div>' : '') +
      '<div class="mh-instr"><span>❖ ' + esc(QPG.templates.instruction(sec, range)) + '</span><span class="mk">[' + esc(total) + ']</span></div></div>';
  }

  function questionBlock(no, q, opts) {
    if (!q) return '<div class="pb pq"><span class="pq-no">' + no + ')</span><div class="pq-body" style="color:#b00">[ આ પ્રશ્ન મળતો નથી ]</div><span></span></div>';
    return '<div class="pb pq"><span class="pq-no">' + no + ')</span><div class="pq-body">' +
      QPG.questionHtml.render(q, { showAnswer: !!opts.showAnswers }) + '</div>' +
      (opts.showQuestionMarks ? '<span class="pq-mk">[' + esc(q.marks) + ']</span>' : '<span></span>') + '</div>';
  }

  /** Blocks for one set: [{html, keepWithNext}] */
  function setBlocks(paper, si, getQ, opts) {
    var set = paper.sets[si];
    var nums = QPG.assembly.numbering(paper, si);
    var ranges = QPG.assembly.ranges(paper, si);
    var blocks = [{ html: paper.style === 'maths' ? mathsHeader(paper, set) : physicsHeader(paper, set), keepWithNext: true }];
    var lastPart = null;
    paper.sections.forEach(function (sec) {
      var ids = set.items[sec.id] || [];
      if (!ids.length && opts.skipEmpty) return;
      var head = paper.style === 'maths'
        ? mathsSection(sec, ranges[sec.id], sec.part !== lastPart, QPG.templates.sectionTotal(sec))
        : physicsSection(sec, ranges[sec.id]);
      lastPart = sec.part;
      blocks.push({ html: head, keepWithNext: true });
      ids.forEach(function (id, i) { blocks.push({ html: questionBlock(nums[sec.id][i], getQ(id), opts) }); });
    });
    if (paper.meta.closing) blocks.push({ html: '<div class="pb mh-close">' + esc(paper.meta.closing) + '</div>' });
    return blocks;
  }

  function answerKeyBlocks(paper, si, getQ) {
    var set = paper.sets[si];
    var nums = QPG.assembly.numbering(paper, si);
    var m = paper.meta;
    var blocks = [{ html: '<div class="pb ak-head"><div class="t1">' + esc(m.institute) + '</div><div class="t2">' +
      esc(paper.title) + ' · ' + esc(QPG.syllabus.subjectName(paper.subject)) + ' · ધોરણ ' + esc(m.std) +
      (paper.sets.length > 1 ? ' · Set ' + esc(set.label) : '') + '</div><div class="t2">જવાબવહી (Answer Key)</div></div>', keepWithNext: true }];
    paper.sections.forEach(function (sec) {
      var ids = set.items[sec.id] || [];
      if (!ids.length) return;
      blocks.push({ html: '<div class="pb ak-sec">' + esc(QPG.assembly.sectionTitle(sec)) + '</div>', keepWithNext: true });
      // consecutive MCQ answers go into a compact grid; other answers get a row each
      var grid = [];
      var flush = function () {
        if (grid.length) blocks.push({ html: '<div class="pb ak-grid">' + grid.join('') + '</div>' });
        grid = [];
      };
      ids.forEach(function (id, i) {
        var q = getQ(id);
        var choice = q && (q.type === 'mcq' || q.type === 'assertion_reason');
        if (choice && !q.solution) {
          grid.push('<div>' + nums[sec.id][i] + ') ' + (q.answer ? '(' + esc(q.answer) + ')' : '—') + '</div>');
          return;
        }
        flush();
        var ans = q ? (choice && q.answer ? '(' + q.answer + ')' : q.answer) : '';
        blocks.push({ html: '<div class="pb ak-row"><span>' + nums[sec.id][i] + ')</span><div>' +
          (ans ? QPG.questionHtml.text(ans) : '<span style="color:#888">જવાબ લખ્યો નથી</span>') +
          (q && q.solution ? '<div class="sol">' + QPG.questionHtml.text(q.solution) + '</div>' : '') + '</div></div>' });
      });
      flush();
    });
    return blocks;
  }

  /**
   * Pour blocks into sheets inside `container`.
   * Returns { pages, overflow: [page numbers where one block is taller than a page] }.
   */
  function paginate(container, paper, blocks, firstPageNo) {
    var pages = [], overflow = [];
    var pageNo = firstPageNo || 1;
    var sheet = newSheet(paper, pageNo), content = sheet.querySelector('.sh-content');
    container.appendChild(sheet); pages.push(sheet);
    var fits = function () { return content.scrollHeight <= content.clientHeight + 1; };

    blocks.forEach(function (b) {
      var tmp = document.createElement('div');
      tmp.innerHTML = b.html;
      var el = tmp.firstElementChild;
      if (b.keepWithNext) el.setAttribute('data-keep', '1');
      QPG.math.render(el);
      content.appendChild(el);
      if (fits()) return;
      // move this block, plus any headings waiting for it, to a new sheet
      var moving = [el];
      var prev = el.previousElementSibling;
      while (prev && prev.getAttribute('data-keep')) { moving.unshift(prev); prev = prev.previousElementSibling; }
      if (moving.length === content.children.length) {   // the block alone is too tall for a sheet
        content.classList.add('overflowing'); overflow.push(pageNo);
        return;
      }
      sheet = newSheet(paper, ++pageNo); content = sheet.querySelector('.sh-content');
      container.appendChild(sheet); pages.push(sheet);
      moving.forEach(function (m) { content.appendChild(m); });
      if (!fits()) { content.classList.add('overflowing'); overflow.push(pageNo); }
    });
    return { pages: pages, overflow: overflow, lastPageNo: pageNo };
  }

  /**
   * Render one set (or all sets when setIndex is 'all') into container.
   * opts: { getQ, answerKey, showAnswers, showQuestionMarks }
   */
  function render(container, paper, setIndex, opts) {
    opts = opts || {};
    container.innerHTML = '';
    container.classList.add('paper-pages');
    return fontsReady().then(function () {
      var idx = setIndex === 'all' ? paper.sets.map(function (_, i) { return i; }) : [setIndex || 0];
      var result = { pages: 0, overflow: [] };
      idx.forEach(function (si) {
        var blocks = opts.answerKey ? answerKeyBlocks(paper, si, opts.getQ) : setBlocks(paper, si, opts.getQ, opts);
        var r = paginate(container, paper, blocks, 1);   // page numbers restart for each set
        result.pages += r.pages.length;
        result.overflow = result.overflow.concat(r.overflow);
      });
      return result;
    });
  }

  /** Scale sheets down to the available width (phones). */
  function fit(container, available) {
    var w = 793.7; // 210mm at 96dpi
    var k = Math.min(1, (available - 8) / w);
    container.querySelectorAll('.sheet').forEach(function (s) { s.style.zoom = k < 1 ? k.toFixed(3) : ''; });
    return k;
  }

  /** Print the given sheets only. */
  function print(container) {
    var rootEl = document.getElementById('print-root');
    if (!rootEl) { rootEl = document.createElement('div'); rootEl.id = 'print-root'; document.body.appendChild(rootEl); }
    rootEl.innerHTML = '';
    container.querySelectorAll('.sheet').forEach(function (s) { var c = s.cloneNode(true); c.style.zoom = ''; rootEl.appendChild(c); });
    var done = function () { rootEl.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  }

  QPG.paperRender = { render: render, fit: fit, print: print, fontsReady: fontsReady, setBlocks: setBlocks };
})(typeof self !== 'undefined' ? self : this);
