/* Offline support: keeps the app files on the device so it opens without internet.
   Bump VERSION whenever app files change, so phones pick up the new version. */
var VERSION = 'qpg-0.5.0';
var FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'css/paper.css',
  'vendor/katex/katex.min.css', 'vendor/katex/katex.min.js', 'vendor/katex/contrib/auto-render.min.js',
  'js/core/gujarati.js', 'js/core/syllabus.js', 'js/core/schema.js', 'js/core/filters.js', 'js/core/templates.js', 'js/core/assembly.js', 'js/core/backup.js', 'js/core/sync-core.js', 'js/core/importer.js',
  'js/import/legacy.js', 'js/import/zip.js', 'js/import/omml.js', 'js/import/sheet.js', 'js/import/docx.js', 'js/import/files.js',
  'js/data/db.js', 'js/data/config.js', 'js/data/sync.js', 'js/data/demo-questions.js', 'js/render/math.js', 'js/render/question-html.js', 'js/render/paper-render.js', 'js/render/pdf-export.js',
  'js/ui/ui.js', 'js/ui/dashboard.js', 'js/ui/question-bank.js', 'js/ui/question-form.js', 'js/ui/pages.js', 'js/ui/paper-wizard.js', 'js/ui/paper-editor.js', 'js/ui/paper-view.js', 'js/ui/import-view.js', 'js/app.js',
  'vendor/html-to-image/html-to-image.js', 'vendor/jspdf/jspdf.umd.min.js', 'samples/prashno-namuno.xlsx', 'samples/prashno-namuno.csv',
  'icons/icon-192.png', 'icons/icon-512.png', 'assets/logo-maths.png',
  'vendor/katex/fonts/KaTeX_AMS-Regular.woff2',
  'vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2',
  'vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2',
  'vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2',
  'vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2',
  'vendor/katex/fonts/KaTeX_Main-Bold.woff2',
  'vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2',
  'vendor/katex/fonts/KaTeX_Main-Italic.woff2',
  'vendor/katex/fonts/KaTeX_Main-Regular.woff2',
  'vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2',
  'vendor/katex/fonts/KaTeX_Math-Italic.woff2',
  'vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2',
  'vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2',
  'vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2',
  'vendor/katex/fonts/KaTeX_Script-Regular.woff2',
  'vendor/katex/fonts/KaTeX_Size1-Regular.woff2',
  'vendor/katex/fonts/KaTeX_Size2-Regular.woff2',
  'vendor/katex/fonts/KaTeX_Size3-Regular.woff2',
  'vendor/katex/fonts/KaTeX_Size4-Regular.woff2',
  'vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2',
  'fonts/noto-serif-gujarati-gujarati-400-normal.woff2', 'fonts/noto-serif-gujarati-latin-400-normal.woff2',
  'fonts/noto-serif-gujarati-gujarati-700-normal.woff2', 'fonts/noto-serif-gujarati-latin-700-normal.woff2',
  'fonts/noto-sans-gujarati-gujarati-400-normal.woff2', 'fonts/noto-sans-gujarati-latin-400-normal.woff2',
  'fonts/noto-sans-gujarati-gujarati-600-normal.woff2', 'fonts/noto-sans-gujarati-latin-600-normal.woff2',
  'fonts/noto-sans-gujarati-gujarati-700-normal.woff2', 'fonts/noto-sans-gujarati-latin-700-normal.woff2'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* App files: cache first (works offline). KaTeX fonts and anything else: cache, then network. */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      if (req.mode === 'navigate') return caches.match('index.html');
      throw new Error('offline');
    });
  }));
});
