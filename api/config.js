// Datos públicos que necesita la página para conectarse a Supabase.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_ANON_KEY || '',
    dominio: process.env.DOMINIO_ALUMNOS || 'aekmatematicas.es',
  });
};
