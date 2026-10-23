// Gestión de alumnos por el profesor: listar usuarios, crear alumnos y generar contraseñas nuevas.
const crypto = require('crypto');
const { sb, exigirProfesor, httpErr, checkEnv, responderError } = require('./_lib');

const SILABAS = ['sol', 'mar', 'pez', 'luz', 'rio', 'pan', 'oso', 'gato', 'lobo', 'nube', 'roca', 'flor', 'mesa', 'tren', 'faro', 'hoja', 'lago', 'monte', 'cielo', 'barco'];
const nuevaClave = () =>
  SILABAS[crypto.randomInt(SILABAS.length)] + '-' + SILABAS[crypto.randomInt(SILABAS.length)] + '-' + crypto.randomInt(100, 1000);

const limpiarUsuario = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.|\.$/g, '');

module.exports = async (req, res) => {
  try {
    checkEnv(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']);
    await exigirProfesor(req);
    const dominio = process.env.DOMINIO_ALUMNOS || 'aekmatematicas.es';

    if (req.method === 'GET') {
      const d = await sb('/auth/v1/admin/users?per_page=1000');
      const lista = (d.users || d || []).map((u) => ({ id: u.id, email: u.email, ultimo_acceso: u.last_sign_in_at }));
      return res.status(200).json({ usuarios: lista, dominio });
    }
    if (req.method !== 'POST') throw httpErr(405, 'Método no permitido');

    const b = req.body || {};
    if (b.accion === 'crear') {
      const nombre = String(b.nombre || '').trim().slice(0, 80);
      const grupo = String(b.grupo || '').trim().slice(0, 40);
      const usuario = limpiarUsuario(b.usuario || nombre);
      if (!nombre) throw httpErr(400, 'Escribe el nombre del alumno.');
      if (usuario.length < 3) throw httpErr(400, 'El usuario debe tener al menos 3 letras.');
      const clave = nuevaClave();
      try {
        await sb('/auth/v1/admin/users', {
          method: 'POST',
          body: JSON.stringify({
            email: usuario + '@' + dominio,
            password: clave,
            email_confirm: true,
            user_metadata: { nombre, grupo },
          }),
        });
      } catch (e) {
        if (/already|registered|exists/i.test(e.message)) throw httpErr(409, 'Ya existe un alumno con el usuario «' + usuario + '». Elige otro.');
        throw e;
      }
      return res.status(200).json({ ok: true, usuario, clave, nombre });
    }

    if (b.accion === 'clave') {
      const id = String(b.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw httpErr(400, 'Alumno no válido');
      const p = await sb('/rest/v1/perfiles?select=rol,nombre&id=eq.' + id);
      if (!p[0]) throw httpErr(404, 'No encuentro a ese alumno');
      if (p[0].rol !== 'alumno') throw httpErr(403, 'Desde aquí solo se cambian contraseñas de alumnos.');
      const clave = nuevaClave();
      await sb('/auth/v1/admin/users/' + id, { method: 'PUT', body: JSON.stringify({ password: clave }) });
      return res.status(200).json({ ok: true, clave, nombre: p[0].nombre });
    }

    throw httpErr(400, 'Acción no reconocida');
  } catch (err) {
    responderError(res, err);
  }
};
