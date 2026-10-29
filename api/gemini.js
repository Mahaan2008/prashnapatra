// Gemini AI for Prashnapatra — runs on Vercel, so the API key stays on the server.
// Set it once in Vercel → Project → Settings → Environment Variables: GEMINI_API_KEY.
// Only logged-in, approved teachers (checked with Supabase) can use it.
//
// GET  /api/gemini            → {server_key: true|false}
// POST /api/gemini  {model, contents, generationConfig}  (header Authorization: Bearer <login token>)

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ajrajlytkhgndcyfgwnb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_w_xML4WEJsHUMY6WBNjSqQ_jT4DKVov';
const MODELS = new Set(['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']);

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

/** The login token belongs to an approved teacher (or the admin)? */
async function approved(token) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/my_profile', {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: '{}'
  });
  if (r.status === 401) return { ok: false, status: 401, error: 'login_expired' };
  if (!r.ok) return { ok: false, status: 502, error: 'profile_check_failed' };
  const p = await r.json();
  return p && p.approved ? { ok: true } : { ok: false, status: 403, error: 'not_approved' };
}

module.exports = async function handler(req, res) {
  const key = process.env.GEMINI_API_KEY || '';
  if (req.method === 'GET') return send(res, 200, { server_key: !!key });
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  if (!key) return send(res, 503, { error: 'no_server_key' });

  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return send(res, 401, { error: 'login_required' });

  let body;
  try { body = await readJson(req); } catch (e) { return send(res, 400, { error: 'bad_json' }); }
  const model = String(body.model || '');
  if (!MODELS.has(model)) return send(res, 400, { error: 'unknown_model' });
  if (!Array.isArray(body.contents) || !body.contents.length) return send(res, 400, { error: 'no_contents' });

  let who;
  try { who = await approved(token); } catch (e) { return send(res, 502, { error: 'profile_check_failed' }); }
  if (!who.ok) return send(res, who.status, { error: who.error });

  try {
    const g = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: body.contents, generationConfig: body.generationConfig || {} })
    });
    const text = await g.text();
    res.statusCode = g.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(text);
  } catch (e) {
    return send(res, 502, { error: 'gemini_unreachable' });
  }
};
