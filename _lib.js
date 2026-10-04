// Utilitários compartilhados das Functions (service role fica só aqui, no servidor).
const U = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, AK = process.env.SUPABASE_ANON_KEY;

const rest = async (path, { method = 'GET', body, prefer } = {}) => {
  const r = await fetch(`${U}/rest/v1/${path}`, {
    method,
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`supabase ${r.status}: ${t}`);
  return t ? JSON.parse(t) : null;
};

// Identifica o usuário pelo JWT enviado pelo navegador.
const user = async (event) => {
  const a = event.headers.authorization || event.headers.Authorization || '';
  if (!a.startsWith('Bearer ')) return null;
  const r = await fetch(`${U}/auth/v1/user`, { headers: { apikey: AK, Authorization: a } });
  return r.ok ? { ...(await r.json()), jwt: a } : null;
};

const out = (statusCode, obj) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
module.exports = { U, AK, rest, user, out, UUID };
