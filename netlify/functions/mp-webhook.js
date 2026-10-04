// Confirma pagamentos: valida assinatura, consulta o MP, confere valor, registra compra e comissão 45/55.
// Idempotente e seguro para reentrega. Variáveis: MP_WEBHOOK_SECRET, MP_ACCESS_TOKEN, SUPABASE_*.
const crypto = require('crypto');
const { rest, out, UUID } = require('./_lib');

exports.handler = async (e) => {
  const q = e.queryStringParameters || {};
  const dataId = String(q['data.id'] || '').toLowerCase();
  const sig = e.headers['x-signature'] || '', rid = e.headers['x-request-id'] || '';
  const ts = (sig.match(/ts=([^,]+)/) || [])[1], v1 = (sig.match(/v1=([^,]+)/) || [])[1];
  if (!process.env.MP_WEBHOOK_SECRET || !ts || !v1 || !dataId) return out(401, { error: 'invalid' });
  const mac = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET).update(`id:${dataId};request-id:${rid};ts:${ts};`).digest('hex');
  if (mac.length !== v1.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(v1))) return out(401, { error: 'invalid' });
  if ((q.type || q.topic) !== 'payment') return out(200, { ok: true, ignored: true });

  try {
    const pr = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`,
      { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } });
    if (!pr.ok) return out(502, { error: 'lookup failed' });           // o MP tenta de novo
    const p = await pr.json();
    if (p.status !== 'approved') return out(200, { ok: true, status: p.status });
    if (!UUID.test(p.external_reference || '')) return out(200, { ok: true, ignored: true });

    const [o] = await rest(`orders?id=eq.${p.external_reference}&select=*`);
    if (!o) return out(200, { ok: true, ignored: true });
    if (Math.round(Number(p.transaction_amount) * 100) !== Math.round(Number(o.total_amount) * 100)) {
      console.error('valor divergente', o.id); return out(200, { ok: false, error: 'amount mismatch' });
    }
    const kind = o.video_id ? 'video' : 'collection';
    const [item] = await rest(`${kind === 'video' ? 'videos' : 'collections'}?id=eq.${o.video_id || o.collection_id}&select=owner_id`);
    const amount = Number(o.total_amount);
    const creator = Math.round(amount * 45) / 100;
    const platform = Math.round((amount - creator) * 100) / 100;

    await rest('purchases?on_conflict=order_id', { method: 'POST', prefer: 'resolution=ignore-duplicates',
      body: { user_id: o.user_id, order_id: o.id, video_id: o.video_id, collection_id: o.collection_id, amount, creator_amount: creator, platform_amount: platform } });
    const [pu] = await rest(`purchases?order_id=eq.${o.id}&select=id`);
    await rest('creator_earnings?on_conflict=purchase_id', { method: 'POST', prefer: 'resolution=ignore-duplicates',
      body: { creator_id: item.owner_id, purchase_id: pu.id, gross_amount: amount, creator_amount: creator, platform_amount: platform } });
    await rest(`orders?id=eq.${o.id}`, { method: 'PATCH', body: { status: 'approved', paid_at: new Date().toISOString(), provider_payment_id: String(p.id) } });
    return out(200, { ok: true });
  } catch (err) {
    console.error(err);
    return out(500, { error: 'retry' });
  }
};
