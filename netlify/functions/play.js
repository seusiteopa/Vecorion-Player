// Entrega URL assinada do vídeo pago somente se o usuário tem acesso (compra ou autoria).
// Variáveis: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, SUPABASE_*.
const { U, AK, rest, user, out, UUID } = require('./_lib');
const cloudinary = require('cloudinary').v2;

exports.handler = async (e) => {
  if (e.httpMethod !== 'POST') return out(405, { error: 'Método não permitido.' });
  const u = await user(e);
  if (!u) return out(401, { error: 'Faça login para continuar.' });
  let b; try { b = JSON.parse(e.body || '{}'); } catch { return out(400, { error: 'Pedido inválido.' }); }
  if (!UUID.test(b.video_id || '')) return out(400, { error: 'Pedido inválido.' });
  try {
    const r = await fetch(`${U}/rest/v1/rpc/has_access`, { method: 'POST',
      headers: { apikey: AK, Authorization: u.jwt, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_video: b.video_id, p_collection: null }) });
    if (!r.ok || (await r.json()) !== true) return out(403, { error: 'Você ainda não tem acesso a este vídeo.' });
    const [v] = await rest(`videos?id=eq.${b.video_id}&select=cloudinary_public_id`);
    if (!v?.cloudinary_public_id) return out(409, { error: 'O vídeo ainda está em processamento.' });
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
    const url = cloudinary.url(v.cloudinary_public_id, { resource_type: 'video', type: 'authenticated', sign_url: true, secure: true, fetch_format: 'auto', quality: 'auto' });
    return out(200, { url });
  } catch (err) { console.error(err); return out(500, { error: 'Algo deu errado. Tente novamente.' }); }
};
