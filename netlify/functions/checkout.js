// Cria o pedido e o pagamento Pix no Mercado Pago. O preço vem SEMPRE do banco.
// Variáveis: MP_ACCESS_TOKEN, SITE_URL (opcional), SUPABASE_*.
const { rest, user, out, UUID } = require('./_lib');

exports.handler = async (e) => {
  if (e.httpMethod !== 'POST') return out(405, { error: 'Método não permitido.' });
  const u = await user(e);
  if (!u) return out(401, { error: 'Faça login para continuar.' });
  let b; try { b = JSON.parse(e.body || '{}'); } catch { return out(400, { error: 'Pedido inválido.' }); }
  const kind = b.kind === 'video' || b.kind === 'collection' ? b.kind : null;
  if (!kind || !UUID.test(b.id || '')) return out(400, { error: 'Pedido inválido.' });

  try {
    const table = kind === 'video' ? 'videos' : 'collections';
    const [i] = await rest(`${table}?id=eq.${b.id}&status=eq.PUBLISHED&access_type=eq.paid&select=id,title,price,owner_id${kind === 'video' ? ',collection_only' : ''}`);
    if (!i || i.collection_only) return out(404, { error: 'Conteúdo não encontrado.' });
    if (i.owner_id === u.id) return out(409, { error: 'Você é o criador deste conteúdo.' });
    const have = await rest(`purchases?user_id=eq.${u.id}&status=eq.approved&${kind}_id=eq.${i.id}&select=id&limit=1`);
    if (have.length) return out(409, { error: 'Você já possui este conteúdo.' });

    const [o] = await rest('orders', { method: 'POST', prefer: 'return=representation',
      body: { user_id: u.id, total_amount: i.price, [`${kind}_id`]: i.id } });
    const site = process.env.SITE_URL || `https://${e.headers.host}`;
    const r = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': o.id },
      body: JSON.stringify({ transaction_amount: Number(i.price), description: i.title.slice(0, 200), payment_method_id: 'pix',
        payer: { email: u.email }, external_reference: o.id, notification_url: `${site}/.netlify/functions/mp-webhook` }) });
    const p = await r.json();
    if (!r.ok) return out(502, { error: 'Não foi possível gerar o pagamento. Tente novamente.' });
    await rest(`orders?id=eq.${o.id}`, { method: 'PATCH', body: { provider_payment_id: String(p.id) } });
    const td = p.point_of_interaction?.transaction_data || {};
    return out(200, { order_id: o.id, qr_code: td.qr_code, qr_code_base64: td.qr_code_base64 });
  } catch (err) {
    console.error(err);
    return out(500, { error: 'Algo deu errado. Tente novamente.' });
  }
};
