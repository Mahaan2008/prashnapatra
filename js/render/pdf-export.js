/* A real PDF file of the paper (for WhatsApp / sharing from the phone).
   Each A4 sheet is drawn by the browser itself (so Gujarati joined letters and formulas look
   exactly like the screen), turned into a high-resolution picture, and placed on a PDF page.
   For the sharpest print on a laptop, "Print / Save as PDF" is still offered. */
(function (root) {
  'use strict';
  var QPG = root.QPG = root.QPG || {};

  /** True where the browser can build the file (needs the app served over http/https). */
  function available() {
    return /^https?:$/.test(location.protocol) && !root.QPG_PREVIEW;
  }

  /* The two PDF libraries are big, so they load only when a PDF is made. */
  var libs = null;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve;
      s.onerror = function () { reject(new Error('PDF બનાવવાની ફાઇલ (' + src + ') ખૂલી નહીં')); };
      document.head.appendChild(s);
    });
  }
  function loadLibs() {
    if (!libs) libs = Promise.all([
      root.htmlToImage ? null : loadScript('vendor/html-to-image/html-to-image.js'),
      root.jspdf ? null : loadScript('vendor/jspdf/jspdf.umd.min.js')
    ]).catch(function (e) { libs = null; throw e; });
    return libs;
  }

  /**
   * paper, setIndex ('all' or number), opts {getQ, answerKey}, onProgress(done, total)
   * Resolves to a Blob (application/pdf).
   */
  function make(paper, setIndex, opts, onProgress) {
    var holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:820px;pointer-events:none';
    holder.setAttribute('aria-hidden', 'true');
    document.body.appendChild(holder);
    return loadLibs().then(function () { return QPG.paperRender.render(holder, paper, setIndex, opts); }).then(function () {
      var sheets = Array.prototype.slice.call(holder.querySelectorAll('.sheet'));
      var pdf = new root.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      var chain = Promise.resolve();
      // Safari draws fonts only from the second attempt; one throw-away pass avoids blank text
      var safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
      if (safari && sheets[0]) chain = chain.then(function () { return root.htmlToImage.toJpeg(sheets[0], { pixelRatio: 0.5 }).catch(function () {}); });
      sheets.forEach(function (sheet, i) {
        chain = chain.then(function () {
          return root.htmlToImage.toJpeg(sheet, { quality: 0.9, pixelRatio: 2.2, backgroundColor: '#ffffff', cacheBust: false });
        }).then(function (url) {
          if (i > 0) pdf.addPage('a4', 'portrait');
          pdf.addImage(url, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
          if (onProgress) onProgress(i + 1, sheets.length);
        });
      });
      return chain.then(function () { return pdf.output('blob'); });
    }).finally(function () { holder.remove(); });
  }

  function safeName(s) {
    return String(s || 'paper').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'paper';
  }

  QPG.pdfExport = { available: available, make: make, safeName: safeName };

  /* ---------- saving or sharing any file ---------- */
  /**
   * Share (phone: WhatsApp, Drive …) when the device can; otherwise download.
   * Resolves to 'shared' | 'downloaded' | 'cancelled'.
   */
  QPG.ui.saveFile = function (blob, name, preferShare) {
    var file;
    try { file = new File([blob], name, { type: blob.type }); } catch (e) { file = null; }
    if (preferShare && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: name }).then(function () { return 'shared'; })
        .catch(function (e) { return e && e.name === 'AbortError' ? 'cancelled' : download(); });
    }
    return Promise.resolve(download());
    function download() {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
      return 'downloaded';
    }
  };
  QPG.ui.canShareFiles = function () {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })); }
    catch (e) { return false; }
  };
})(typeof self !== 'undefined' ? self : this);
