/* Gemini AI Integration for Question Paper Generator:
   Extracts questions, Gujarati text, and perfect LaTeX mathematical formulas from PDFs,
   Word (.docx) files, and pasted text using Google Gemini API.
   Optimized with localhost proxy (bypassing CORS & ad-blockers) and Gemini Flash Lite. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.QPG = root.QPG || {}; root.QPG.gemini = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'qpg_gemini_api_key';
  var DEFAULT_KEY = '';

  // Verified working Gemini models (v1beta)
  var MODELS = [
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview'
  ];

  function getApiKey() {
    try {
      var stored = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY));
      if (stored && stored.trim()) return stored.trim();
    } catch (e) {}
    return DEFAULT_KEY;
  }

  function setApiKey(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        if (key && key.trim()) localStorage.setItem(STORAGE_KEY, key.trim());
        else localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {}
  }

  function hasApiKey() {
    var k = getApiKey();
    return !!(k && k.trim().length > 10);
  }

  /**
   * Build URLs: uses local proxy on localhost to avoid browser CORS/ad-blocker blocks,
   * with automatic direct fallback.
   */
  function buildUrls(model, key) {
    var k = encodeURIComponent(key);
    var directUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + k;
    if (typeof window !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      var proxyUrl = '/api/gemini/v1beta/models/' + model + ':generateContent?key=' + k;
      return [proxyUrl, directUrl];
    }
    return [directUrl];
  }

  /**
   * Robust JSON parser for LLM responses containing raw LaTeX backslashes.
   * Handles unescaped \times, \mu, \alpha, \frac, \vec, etc. without throwing SyntaxError.
   */
  function safeParseJson(rawText) {
    if (!rawText) return null;
    var clean = rawText.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try {
      return JSON.parse(clean);
    } catch (e1) {
      try {
        var repaired = clean.replace(/\\([a-zA-Z0-9_\{\}\(\)\[\]\^\.\-\+])/g, '\\\\$1');
        return JSON.parse(repaired);
      } catch (e2) {
        var repaired2 = clean.replace(/\\(u[0-9a-fA-F]{4}|["\\\/bfnrt]|.)/g, function (m, g) {
          if (/^u[0-9a-fA-F]{4}$/.test(g)) return '\\' + g;
          if (/^["\\\/bfnrt]$/.test(g)) return '\\' + g;
          return '\\\\' + g;
        });
        return JSON.parse(repaired2);
      }
    }
  }

  /** Test whether an API key works with a minimal prompt */
  async function testApiKey(key) {
    var k = (key || getApiKey() || '').trim();
    if (!k) throw new Error('API Key દાખલ કરેલી નથી.');
    var models = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.8-flash'];
    var lastErr = null;

    for (var i = 0; i < models.length; i++) {
      var urls = buildUrls(models[i], k);
      for (var u = 0; u < urls.length; u++) {
        var url = urls[u];
        try {
          var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          var timer = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;
          var res = await fetch(url, {
            method: 'POST',
            signal: controller ? controller.signal : undefined,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Respond with JSON: {"status":"ok"}' }] }],
              generationConfig: { responseMimeType: 'application/json' }
            })
          });
          if (timer) clearTimeout(timer);
          if (res.ok) return true;
          var err = await res.json().catch(function () { return {}; });
          var msg = (err.error && err.error.message) || ('HTTP Error ' + res.status);
          if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) {
            throw new Error('આ API Key માન્ય નથી. કૃપા કરીને Google AI Studio માંથી નવી કી લાવીને દાખલ કરો.');
          }
          lastErr = new Error(msg);
        } catch (e) {
          lastErr = e;
          if (/API Key માન્ય નથી/i.test(e.message)) throw e;
        }
      }
    }
    throw lastErr || new Error('API Key ચકાસી શકાઈ નહીં. ઇન્ટરનેટ કનેક્શન તપાસો.');
  }

  function buildPrompt(defaults) {
    var def = defaults || {};
    var subj = def.subject === 'maths' ? 'ગણિત (Mathematics)' : 'ભૌતિકવિજ્ઞાન (Physics)';
    var std = def.std || (def.subject === 'maths' ? 12 : 11);

    return `You are an expert exam question extractor for Gujarati medium ${subj} (Std ${std}) school and board examinations.
Extract all questions from the provided document.

CRITICAL INSTRUCTIONS:
1. GUJARATI TEXT:
- Output all Gujarati text in clean, standard Unicode Gujarati script.
- If the original document used old Gujarati fonts (Sulekh, Gopika, Terafont, LMG, etc.), convert them to proper, readable Unicode Gujarati.
- Never guess or skip questions. Keep question numbers and hierarchy intact.

2. MATHEMATICS AND PHYSICS EQUATIONS / FORMULAS:
- Every mathematical expression, formula, fraction, exponent, square root, vector, calculus notation, matrix, determinant, or symbol MUST be formatted in LaTeX notation and wrapped in dollar signs ($...$ for inline or $$...$$ for display).
- Fractions: $\\frac{numerator}{denominator}$ (e.g., $\\frac{1}{2}$, $\\frac{x+1}{x-1}$)
- Powers/Exponents: $x^2$, $e^{2x}$, $10^{-3}$
- Roots: $\\sqrt{3}$, $\\sqrt[3]{x}$
- Vectors: $\\vec{F}$, $\\vec{a}$, $\\hat{i}$, $\\hat{j}$, $\\hat{k}$
- Matrices & Determinants: $\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$, $\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}$
- Calculus & Limits: $\\int_0^1 x dx$, $\\frac{dy}{dx}$, $\\lim_{x \\to 0}$
- Trigonometry: $\\sin^{-1}x$, $\\cos\\theta$, $\\tan^2 x$
- Greek letters: $\\alpha, \\beta, \\gamma, \\theta, \\lambda, \\mu, \\pi, \\omega, \\Delta, \\Omega$
- Relations & Sets: $\\in, \\notin, \\subset, \\cup, \\cap, \\phi, \\emptyset, \\mathbb{R}, \\mathbb{N}$
- Units & Constants: $m/s^2$, $kg\\cdot m/s$, $N$, $J$

3. QUESTION TYPES:
Classify each question into one of:
- 'mcq' (Multiple Choice Question with 4 options A, B, C, D)
- 'very_short' (One-line answer)
- 'short_answer' (2-3 marks short answer/question)
- 'long_answer' (Long answer)
- 'numerical' (Physics/Maths calculation/problem)
- 'derivation' (Formula derivation)
- 'proof' (Proof question)
- 'fill_blank' (Fill in the blank)
- 'match_columns' (Match Column I with Column II)
- 'assertion_reason' (Assertion-Reason question)
- 'case_based' (Passage / Case-based question)

4. STRUCTURE:
Return a JSON array where each item has:
- 'text': The full question body (with LaTeX $...$ for formulas).
- 'type': One of the types listed above.
- 'options': For MCQ, an array of exactly 4 strings for [A, B, C, D] (with LaTeX $...$ for formulas).
- 'answer': The correct answer letter ('A', 'B', 'C', or 'D') or answer text/number if given in document.
- 'solution': Detailed step-by-step solution if given.
- 'marks': Number of marks (e.g. 1 for MCQ, 2 for short, etc.).
- 'chapter': NCERT/GSEB Chapter number (integer, e.g. 1, 2, 3...) determinable from topic.
- 'subject': '${def.subject || 'physics'}'.
- 'std': ${std}.
- 'difficulty': 'easy', 'medium', or 'hard'.
- 'assertion': For assertion_reason, the assertion text (વિધાન A).
- 'reason': For assertion_reason, the reason text (કારણ R).
- 'matchLeft': For match_columns, list of items in Column I.
- 'matchRight': For match_columns, list of items in Column II.

Return ONLY a valid JSON array of question objects.`;
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = String(reader.result);
        var base64 = dataUrl.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(file);
    });
  }

  async function callGemini(parts, apiKey, timeoutMs) {
    var k = (apiKey || getApiKey() || '').trim();
    if (!k) throw new Error('Gemini API Key દાખલ કરેલી નથી. ઉપર "Gemini API Key" બોક્સમાં કી દાખલ કરો.');

    var models = MODELS;
    var lastError = null;
    var limit = timeoutMs || 15000;

    for (var i = 0; i < models.length; i++) {
      var model = models[i];
      var urls = buildUrls(model, k);

      for (var u = 0; u < urls.length; u++) {
        var url = urls[u];
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = controller ? setTimeout(function () { controller.abort(); }, limit) : null;

        try {
          var res = await fetch(url, {
            method: 'POST',
            signal: controller ? controller.signal : undefined,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: parts }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1
              }
            })
          });

          if (timer) clearTimeout(timer);

          if (!res.ok) {
            var errData = await res.json().catch(function () { return {}; });
            var msg = (errData.error && errData.error.message) || ('HTTP Error ' + res.status);
            if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) {
              throw new Error('Gemini API Key ખોટી છે અથવા માન્ય નથી. કૃપા કરીને નવી કી દાખલ કરો.');
            }
            throw new Error(msg);
          }

          var json = await res.json();
          var candidate = json.candidates && json.candidates[0];
          var outText = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;
          if (!outText) throw new Error('Gemini તરફથી કોઈ જવાબ મળ્યો નહીં.');

          var parsed = safeParseJson(outText);
          if (!parsed) throw new Error('Gemini જવાબનું JSON વાંચી શકાયું નહીં.');
          if (Array.isArray(parsed)) return parsed;
          if (parsed.questions && Array.isArray(parsed.questions)) return parsed.questions;
          if (parsed.items && Array.isArray(parsed.items)) return parsed.items;
          return [parsed];
        } catch (err) {
          if (timer) clearTimeout(timer);
          lastError = err;
          if (/API Key ખોટી છે|API key not valid|PERMISSION_DENIED/i.test(err.message)) throw err;
        }
      }
    }
    throw lastError || new Error('Gemini API સાથે જોડાણ થઈ શક્યું નહીં.');
  }

  /**
   * Extract questions from a PDF file using Gemini Vision & multimodal capabilities.
   */
  async function extractFromPdf(file, defaults, apiKey) {
    var base64 = await fileToBase64(file);
    var prompt = buildPrompt(defaults);
    var parts = [
      { inlineData: { mimeType: 'application/pdf', data: base64 } },
      { text: prompt }
    ];
    return await callGemini(parts, apiKey, 30000);
  }

  /**
   * Refine or extract questions from text content using Gemini AI.
   */
  async function extractFromText(text, defaults, apiKey) {
    var prompt = buildPrompt(defaults) + '\n\nHere is the raw extracted document content:\n\n' + text;
    var parts = [{ text: prompt }];
    return await callGemini(parts, apiKey, 20000);
  }

  /**
   * Ultra-fast chunked enhancement for questions:
   * 1. Converts and wraps all mathematical formulas into pristine LaTeX ($...$)
   * 2. Automatically determines and assigns missing NCERT Chapter numbers
   * 3. Sets marks (1 for MCQ)
   * 4. Identifies answers
   */
  async function enhanceItems(items, defaults, onProgress, apiKey) {
    if (!items || !items.length) return items;
    var def = defaults || {};
    var subj = def.subject === 'maths' ? 'ગણિત (Mathematics)' : 'ભૌતિકવિજ્ઞાન (Physics)';
    var std = def.std || (def.subject === 'maths' ? 12 : 11);

    var CHUNK_SIZE = 5;
    var chunks = [];
    for (var i = 0; i < items.length; i += CHUNK_SIZE) {
      chunks.push({
        startIndex: i,
        items: items.slice(i, i + CHUNK_SIZE)
      });
    }

    var total = items.length;
    var processed = 0;
    if (onProgress) onProgress({ current: 0, total: total, percent: 0 });

    async function processChunk(chunk) {
      var simplified = chunk.items.map(function (it, idx) {
        var q = it.question;
        return {
          idx: idx,
          text: q.text || q.assertion || '',
          type: q.type || 'mcq',
          options: q.options || [],
          chapter: q.chapter || null,
          marks: q.marks || null,
          answer: q.answer || '',
          solution: q.solution || ''
        };
      });

      var prompt = 'You are an expert Gujarati ' + subj + ' (Std ' + std + ' NCERT/GSEB) exam question enhancer.\n' +
        'TASK:\n' +
        '1. Wrap all mathematical & physics expressions, formulas, fractions, powers, roots, vectors, matrices, units, and placeholders like [સૂત્ર] into clean standard LaTeX notation ($...$).\n' +
        '2. If chapter is missing or null, identify and assign the correct NCERT Chapter number (integer, e.g. 1, 2, 3...).\n' +
        '3. If marks is missing or null, assign appropriate marks (1 for MCQ).\n' +
        '4. Identify the correct answer (A, B, C, or D) if possible.\n' +
        '5. Keep Gujarati words, question text, and meaning exactly identical.\n\n' +
        'Input questions:\n' + JSON.stringify(simplified) + '\n\n' +
        'Return ONLY a valid JSON array of objects with: { "idx": number, "text": string, "options": array, "chapter": number, "marks": number, "answer": string, "solution": string }';

      try {
        var enhancedArray = await callGemini([{ text: prompt }], apiKey, 15000);
        if (Array.isArray(enhancedArray)) {
          enhancedArray.forEach(function (enh) {
            var origIndex = (typeof enh.idx === 'number' && enh.idx >= 0 && enh.idx < chunk.items.length) ? enh.idx : null;
            var targetItem = origIndex !== null ? chunk.items[origIndex] : null;
            if (!targetItem) {
              var pos = enhancedArray.indexOf(enh);
              if (pos >= 0 && pos < chunk.items.length) targetItem = chunk.items[pos];
            }
            if (targetItem && targetItem.question) {
              var q = targetItem.question;
              if (enh.text) {
                if (q.type === 'assertion_reason' && q.assertion) {
                  q.assertion = enh.text;
                } else {
                  q.text = enh.text;
                }
              }
              if (Array.isArray(enh.options) && enh.options.length) {
                q.options = enh.options;
              }
              if (enh.chapter && (!q.chapter || q.chapter === '')) {
                q.chapter = Number(enh.chapter);
              }
              if (enh.marks && (!q.marks || q.marks === 0)) {
                q.marks = Number(enh.marks);
              } else if (!q.marks && q.type === 'mcq') {
                q.marks = 1;
              }
              if (enh.answer && !q.answer) {
                q.answer = enh.answer;
              }
              if (enh.solution && !q.solution) {
                q.solution = enh.solution;
              }
              if (targetItem.warnings && targetItem.warnings.length) {
                targetItem.warnings = targetItem.warnings.filter(function (w) {
                  return !/સૂત્ર|equation|MathType/i.test(w.msg || '');
                });
              }
            }
          });
        }
      } catch (err) {
        console.error('Chunk enhancement failed for index ' + chunk.startIndex + ':', err);
        chunk.items.forEach(function (it) {
          if (it && it.question) {
            if (!it.question.marks && it.question.type === 'mcq') it.question.marks = 1;
            if (!it.question.chapter && def.chapter) it.question.chapter = Number(def.chapter);
          }
        });
      }

      processed += chunk.items.length;
      if (onProgress) {
        onProgress({
          current: Math.min(processed, total),
          total: total,
          percent: Math.min(100, Math.round((processed / total) * 100))
        });
      }
    }

    var chunkIndex = 0;
    async function worker() {
      while (chunkIndex < chunks.length) {
        var c = chunks[chunkIndex++];
        await processChunk(c);
      }
    }

    var workers = [];
    var concurrency = Math.min(2, chunks.length);
    for (var w = 0; w < concurrency; w++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    return items;
  }

  /**
   * Automatically solves questions that are missing answers.
   */
  async function autoSolveAnswers(items, defaults, onProgress, apiKey) {
    if (!items || !items.length) return items;
    var def = defaults || {};
    var subj = def.subject === 'maths' ? 'ગણિત (Mathematics)' : 'ભૌતિકવિજ્ઞાન (Physics)';
    var std = def.std || (def.subject === 'maths' ? 12 : 11);

    var missing = items.filter(function (it) {
      var q = it.question;
      if (!q) return false;
      if (!q.answer || !String(q.answer).trim()) return true;
      if (q.type === 'mcq' && ['A', 'B', 'C', 'D'].indexOf(String(q.answer).trim().toUpperCase()) < 0) return true;
      return false;
    });

    if (!missing.length) return items;

    var CHUNK_SIZE = 5;
    var chunks = [];
    for (var i = 0; i < missing.length; i += CHUNK_SIZE) {
      chunks.push({
        startIndex: i,
        items: missing.slice(i, i + CHUNK_SIZE)
      });
    }

    var total = missing.length;
    var processed = 0;
    if (onProgress) onProgress({ current: 0, total: total, percent: 0 });

    async function processChunk(chunk) {
      var list = chunk.items.map(function (it, idx) {
        var q = it.question;
        return {
          idx: idx,
          ref: it.ref,
          text: q.text || q.assertion || '',
          type: q.type || 'mcq',
          options: q.options || [],
          assertion: q.assertion || '',
          reason: q.reason || '',
          subparts: q.subparts || []
        };
      });

      var prompt = 'You are a master teacher in GSEB/NCERT Gujarati medium ' + subj + ' (Class ' + std + ').\n' +
        'TASK: For each question provided below, SOLVE IT ACCURATELY and select the correct answer.\n' +
        'RULES:\n' +
        '1. If type is "mcq", select EXACTLY ONE correct option letter: "A", "B", "C", or "D". Set "answer": "A" (or B, C, D).\n' +
        '2. If type is "assertion_reason", select "A", "B", "C", or "D".\n' +
        '3. If type is "short_answer", "very_short", "numerical", or "fill_blank", provide the exact answer value or text in "answer".\n' +
        '4. Provide a clear, step-by-step Gujarati explanation in "solution" with LaTeX formulas ($...$) where needed.\n\n' +
        'Input questions:\n' + JSON.stringify(list) + '\n\n' +
        'Return ONLY a valid JSON array of objects: [{ "idx": number, "answer": string, "solution": string }]';

      try {
        var solved = await callGemini([{ text: prompt }], apiKey, 20000);
        if (Array.isArray(solved)) {
          solved.forEach(function (res) {
            var idx = (typeof res.idx === 'number' && res.idx >= 0 && res.idx < chunk.items.length) ? res.idx : null;
            var target = idx !== null ? chunk.items[idx] : null;
            if (!target) {
              var pos = solved.indexOf(res);
              if (pos >= 0 && pos < chunk.items.length) target = chunk.items[pos];
            }
            if (target && target.question) {
              var q = target.question;
              if (res.answer) {
                var ans = String(res.answer).trim();
                if (q.type === 'mcq' || q.type === 'assertion_reason') {
                  var m = ans.match(/\b([A-D])\b/i);
                  q.answer = m ? m[1].toUpperCase() : ans.charAt(0).toUpperCase();
                } else {
                  q.answer = ans;
                }
              }
              if (res.solution && !q.solution) {
                q.solution = res.solution;
              }
            }
          });
        }
      } catch (e) {
        console.error('Error auto-solving chunk:', e);
      }

      processed += chunk.items.length;
      if (onProgress) {
        onProgress({
          current: Math.min(processed, total),
          total: total,
          percent: Math.min(100, Math.round((processed / total) * 100))
        });
      }
    }

    var chunkIndex = 0;
    async function worker() {
      while (chunkIndex < chunks.length) {
        var c = chunks[chunkIndex++];
        await processChunk(c);
      }
    }

    var workers = [];
    var concurrency = Math.min(2, chunks.length);
    for (var w = 0; w < concurrency; w++) workers.push(worker());
    await Promise.all(workers);

    return items;
  }

  /**
   * Solves a single question and returns { answer, solution }.
   */
  async function solveSingleQuestion(q, defaults, apiKey) {
    var def = defaults || {};
    var subj = (q.subject || def.subject) === 'maths' ? 'ગણિત (Mathematics)' : 'ભૌતિકવિજ્ઞાન (Physics)';
    var std = q.std || def.std || 11;
    var prompt = 'You are an expert Gujarati teacher for GSEB/NCERT ' + subj + ' Std ' + std + '.\n' +
      'Solve this question accurately.\n' +
      'Question: ' + (q.text || q.assertion || '') + '\n' +
      (q.type === 'assertion_reason' ? 'Assertion: ' + q.assertion + '\nReason: ' + q.reason + '\n' : '') +
      (q.options && q.options.length ? 'Options:\n(A) ' + q.options[0] + '\n(B) ' + q.options[1] + '\n(C) ' + q.options[2] + '\n(D) ' + q.options[3] + '\n' : '') +
      'Type: ' + (q.type || 'mcq') + '\n\n' +
      'Task: Determine the correct answer. If MCQ or assertion_reason, return answer as "A", "B", "C", or "D". Also provide a clear Gujarati step-by-step solution.\n' +
      'Return ONLY a valid JSON object: { "answer": string, "solution": string }';

    var res = await callGemini([{ text: prompt }], apiKey, 15000);
    return res;
  }

  function parseTemplateLocally(text, fileName, defaults) {
    defaults = defaults || {};
    var lines = (text || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var institute = (lines[0] || '').replace(/^[#*_\s]+/, '').slice(0, 60) || 'મારી સ્કૂલ / સંસ્થા';
    var topText = (lines.length > 1 && lines[1].length < 30) ? lines[1] : '॥ શ્રીહરિ ॥';
    var bottomText = defaults.subject === 'maths' ? 'શ્રીહરિ' : 'Divyang Sir';

    var totalMarks = 50;
    var duration = '2:00 hr';
    var std = defaults.std || 11;
    var subject = defaults.subject || 'physics';

    lines.forEach(function (l) {
      var mMarks = l.match(/(?:marks|કુલ\s*ગુણ|ગુણ)\s*[:\-]?\s*(\d+)/i);
      if (mMarks) totalMarks = Number(mMarks[1]);
      var mTime = l.match(/(?:time|સમય)\s*[:\-]?\s*([0-9.:\s\w]+(?:કલાક|hr|min|મિનિટ)?)/i);
      if (mTime) duration = mTime[1].trim();
      var mStd = l.match(/(?:std|ધોરણ)\s*[:\-]?\s*(\d+)/i);
      if (mStd) std = Number(mStd[1]);
      if (/ગણિત|maths|mathematics/i.test(l)) subject = 'maths';
      if (/physics|ભૌતિકવિજ્ઞાન/i.test(l)) subject = 'physics';
    });

    var sections = [];
    var currentSec = null;
    var questionCount = 0;

    lines.forEach(function (l) {
      var mSec = l.match(/^(?:વિભાગ|section|part)\s*[-:]?\s*([A-Za-z0-9]+)/i);
      if (mSec) {
        if (currentSec) {
          currentSec.print = questionCount || currentSec.print;
          currentSec.attempt = currentSec.print;
          sections.push(currentSec);
        }
        var secId = mSec[1].toUpperCase();
        var marks = secId === 'A' ? 1 : (secId === 'B' ? 2 : (secId === 'C' ? 3 : 4));
        currentSec = {
          id: secId,
          title: 'વિભાગ ' + secId,
          part: secId === 'A' ? 'PART-A' : 'PART-B',
          print: secId === 'A' ? 15 : (secId === 'B' ? 9 : 6),
          attempt: secId === 'A' ? 15 : (secId === 'B' ? 6 : 4),
          marks: marks,
          numbering: 'restart',
          types: secId === 'A' ? ['mcq', 'very_short'] : ['short_answer', 'numerical', 'derivation'],
          instruction: 'નીચે આપેલ પ્રશ્નોના માગ્યા પ્રમાણે જવાબ આપો. દરેકના {marks} ગુણ.'
        };
        questionCount = 0;
      } else if (currentSec && /^\s*(?:\d+[\.\)]|\(\d+\))/.test(l)) {
        questionCount++;
      }
    });

    if (currentSec) {
      if (questionCount > 0) { currentSec.print = questionCount; currentSec.attempt = questionCount; }
      sections.push(currentSec);
    }

    if (!sections.length) {
      sections = [
        { id: 'A', title: 'વિભાગ A', part: 'PART-A', print: 15, attempt: 15, marks: 1, numbering: 'restart', types: ['mcq', 'very_short'], instruction: 'નીચે આપેલ પ્રશ્નોના માગ્યા પ્રમાણે જવાબ આપો અને પ્રત્યેકના {marks} ગુણ છે.' },
        { id: 'B', title: 'વિભાગ B', part: 'PART-B', print: 9, attempt: 6, marks: 2, numbering: 'restart', types: ['short_answer', 'numerical', 'derivation'], instruction: 'નીચે આપેલ પ્રશ્નોના માગ્યા પ્રમાણે જવાબ આપો અને પ્રત્યેકના {marks} ગુણ છે.' },
        { id: 'C', title: 'વિભાગ C', part: 'PART-B', print: 8, attempt: 5, marks: 3, numbering: 'restart', types: ['short_answer', 'numerical', 'long_answer'], instruction: 'નીચે આપેલ પ્રશ્નોના માગ્યા પ્રમાણે જવાબ આપો અને પ્રત્યેકના {marks} ગુણ છે.' },
        { id: 'D', title: 'વિભાગ D', part: 'PART-B', print: 3, attempt: 2, marks: 4, numbering: 'restart', types: ['long_answer', 'derivation', 'numerical'], instruction: 'નીચે આપેલ પ્રશ્નોના માગ્યા પ્રમાણે જવાબ આપો અને પ્રત્યેકના {marks} ગુણ છે.' }
      ];
    }

    var cleanName = (fileName || 'નવું સેમ્પલ ફોર્મેટ').replace(/\.[^.]+$/, '');

    return {
      id: 'custom-' + Date.now(),
      name: cleanName,
      subject: subject,
      std: std,
      style: subject === 'maths' ? 'maths' : 'physics',
      isCustom: true,
      header: {
        institute: institute,
        topText: topText,
        bottomText: bottomText,
        watermark: institute,
        subjectLabel: subject === 'maths' ? 'ગણિત' : 'PHYSICS',
        showSetLetter: subject !== 'maths',
        logoLeft: '',
        logoRight: ''
      },
      totalMarks: totalMarks,
      duration: duration,
      examName: 'પ્રથમ સત્રાંત પરીક્ષા',
      paperLabel: 'TEST PAPER-1',
      closing: '|| ALL THE BEST ||',
      sections: sections
    };
  }

  async function extractTemplateFromPaper(fileOrText, defaults, apiKey) {
    defaults = defaults || {};
    var isFile = typeof fileOrText === 'object' && fileOrText !== null && fileOrText.name;
    var fileName = isFile ? fileOrText.name : '';
    var ext = isFile ? (fileName.split('.').pop() || '').toLowerCase() : '';

    var extractedText = '';
    var base64Data = null;
    var mimeType = '';

    if (isFile) {
      if (ext === 'docx') {
        if (QPG.docx && QPG.docx.extract) {
          try {
            var docRes = await QPG.docx.extract(fileOrText);
            if (docRes && docRes.text) extractedText = docRes.text;
          } catch (e) {}
        }
      } else if (ext === 'pdf') {
        base64Data = await fileToBase64(fileOrText);
        mimeType = 'application/pdf';
      } else if (['png', 'jpg', 'jpeg', 'webp'].indexOf(ext) >= 0) {
        base64Data = await fileToBase64(fileOrText);
        mimeType = fileOrText.type || ('image/' + (ext === 'jpg' ? 'jpeg' : ext));
      } else {
        try { extractedText = await fileOrText.text(); } catch (e) {}
      }
    } else {
      extractedText = String(fileOrText || '');
    }

    var key = apiKey || getApiKey();
    if (!key) {
      return parseTemplateLocally(extractedText, fileName, defaults);
    }

    var prompt =
      'You are an expert exam paper structure analyzer. Analyze this sample question paper (in Gujarati/English) and extract its layout, header, styling, and section structure as a clean JSON template.\n\n' +
      'JSON Structure:\n' +
      '{\n' +
      '  "name": string (e.g. "સહજાનંદ - 50 ગુણ યુનિટ ટેસ્ટ"),\n' +
      '  "subject": "physics" or "maths",\n' +
      '  "std": number (11 or 12),\n' +
      '  "style": "physics" or "maths",\n' +
      '  "header": {\n' +
      '    "institute": string (School/Institute/Coaching name from top),\n' +
      '    "topText": string (top line header text e.g. "॥ શ્રીહરિ ॥"),\n' +
      '    "bottomText": string (footer/teacher text e.g. "Divyang Sir"),\n' +
      '    "watermark": string (watermark text or institute name),\n' +
      '    "subjectLabel": string (e.g. "PHYSICS" or "ગણિત"),\n' +
      '    "showSetLetter": boolean\n' +
      '  },\n' +
      '  "examName": string (e.g. "પ્રથમ પરીક્ષા" or "UNIT TEST"),\n' +
      '  "paperLabel": string (e.g. "TEST PAPER-1"),\n' +
      '  "duration": string (e.g. "2:00 hr"),\n' +
      '  "totalMarks": number (e.g. 50 or 100),\n' +
      '  "closing": string (e.g. "|| ALL THE BEST ||"),\n' +
      '  "sections": [\n' +
      '    {\n' +
      '      "id": string ("A", "B", "C", "D" or "PA", "BA", etc.),\n' +
      '      "title": string ("વિભાગ A" or "Section A"),\n' +
      '      "part": string ("PART-A" or "PART-B" or ""),\n' +
      '      "print": number (number of questions printed in this section),\n' +
      '      "attempt": number (number of questions student must attempt),\n' +
      '      "marks": number (marks per question, e.g. 1, 2, 3, 4),\n' +
      '      "numbering": "restart" or "continue",\n' +
      '      "types": array of strings (choose from: "mcq", "very_short", "short_answer", "long_answer", "numerical", "derivation", "proof", "fill_blank", "match_columns", "assertion_reason"),\n' +
      '      "instruction": string (Gujarati instruction text with {marks}, {attempt}, {print} placeholders)\n' +
      '    }\n' +
      '  ]\n' +
      '}\n\n' +
      'Defaults hint:\n' +
      '- Subject: ' + (defaults.subject || 'physics') + '\n' +
      '- Std: ' + (defaults.std || 11) + '\n\n' +
      'Return ONLY the raw JSON object. Do not wrap in markdown or backticks.';

    var parts = [];
    if (base64Data && mimeType) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
      parts.push({ text: prompt });
    } else {
      parts.push({ text: prompt + '\n\nSample Paper Content:\n' + extractedText.slice(0, 30000) });
    }

    try {
      var raw = await callGemini(parts, key, 35000);
      var parsed = safeParseJson(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON from Gemini');

      parsed.id = 'custom-' + Date.now();
      parsed.isCustom = true;
      if (!parsed.header) parsed.header = {};
      if (!parsed.sections || !Array.isArray(parsed.sections) || !parsed.sections.length) {
        parsed.sections = parseTemplateLocally(extractedText, fileName, defaults).sections;
      }
      if (!parsed.name) parsed.name = (fileName || 'નવું સેમ્પલ ફોર્મેટ').replace(/\.[^.]+$/, '');
      if (!parsed.subject) parsed.subject = defaults.subject || 'physics';
      if (!parsed.std) parsed.std = defaults.std || 11;
      if (!parsed.style) parsed.style = parsed.subject === 'maths' ? 'maths' : 'physics';
      return parsed;
    } catch (err) {
      console.warn('Gemini template extraction failed, falling back to local parser:', err.message);
      return parseTemplateLocally(extractedText, fileName, defaults);
    }
  }

  return {
    getApiKey: getApiKey,
    setApiKey: setApiKey,
    hasApiKey: hasApiKey,
    testApiKey: testApiKey,
    extractFromPdf: extractFromPdf,
    extractFromText: extractFromText,
    enhanceItems: enhanceItems,
    autoSolveAnswers: autoSolveAnswers,
    solveSingleQuestion: solveSingleQuestion,
    extractTemplateFromPaper: extractTemplateFromPaper,
    parseTemplateLocally: parseTemplateLocally
  };
});
