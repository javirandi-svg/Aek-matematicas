// Utilidades compartidas por las funciones del servidor (no es una ruta pública).
const baseUrl = () => (process.env.SUPABASE_URL || '').replace(/\/+$/, '');

function httpErr(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function checkEnv(names) {
  const faltan = names.filter((n) => !process.env[n]);
  if (faltan.length) throw httpErr(500, 'Falta configurar en Vercel: ' + faltan.join(', '));
}

// Llamada a Supabase con la clave secreta (solo en el servidor).
function adminHeaders(extra) {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const h = { apikey: k, 'Content-Type': 'application/json', ...(extra || {}) };
  if (!k.startsWith('sb_')) h.Authorization = 'Bearer ' + k; // claves antiguas (JWT)
  return h;
}

async function sb(path, opts = {}) {
  const r = await fetch(baseUrl() + path, { ...opts, headers: adminHeaders(opts.headers) });
  const t = await r.text();
  let d = null;
  try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  if (!r.ok) {
    const msg = (d && (d.msg || d.message || d.error_description || d.error)) || 'Error ' + r.status;
    throw httpErr(r.status, String(msg));
  }
  return d;
}

// Comprueba que quien llama ha iniciado sesión y es profesor.
async function exigirProfesor(req) {
  const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok) throw httpErr(401, 'Inicia sesión de nuevo.');
  const r = await fetch(baseUrl() + '/auth/v1/user', {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + tok },
  });
  if (!r.ok) throw httpErr(401, 'Tu sesión ha caducado. Vuelve a entrar.');
  const u = await r.json();
  const p = await sb('/rest/v1/perfiles?select=rol&id=eq.' + encodeURIComponent(u.id));
  if (!p || !p[0] || p[0].rol !== 'profesor') throw httpErr(403, 'Solo los profesores pueden hacer esto.');
  return u;
}

function responderError(res, err) {
  console.error(err);
  res.status(err.status && err.status < 600 ? err.status : 500).json({ error: err.message || 'Error inesperado' });
}

module.exports = { sb, exigirProfesor, httpErr, checkEnv, responderError };
