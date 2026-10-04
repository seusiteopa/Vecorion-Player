// Entrega o index.html com og:title/og:description/og:image do vídeo ou conjunto.
// Variáveis: SUPABASE_URL, SUPABASE_ANON_KEY, SITE_URL (sem barra final).
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

exports.handler = async (event) => {
  const { SUPABASE_URL: U, SUPABASE_ANON_KEY: K } = process.env;
  const S = process.env.SITE_URL || `https://${event.headers.host}`;
  const url = new URL(event.rawUrl);
  const m = url.pathname.match(/^\/([vc])\/([\w-]+)$/);
  let html = await (await fetch(`${S}/index.html`)).text();

  if (m && U && K) {
    try {
      const table = m[1] === 'v' ? 'videos' : 'collections';
      const r = await fetch(
        `${U}/rest/v1/${table}?slug=eq.${encodeURIComponent(m[2])}&status=eq.PUBLISHED${m[1] === 'v' ? '&collection_only=eq.false' : ''}&select=title,description,cover_url&limit=1`,
        { headers: { apikey: K, Authorization: `Bearer ${K}` } });
      const [i] = await r.json();
      if (i) {
        const img = /^https:\/\/res\.cloudinary\.com\/[^'"()\s<>]+$/.test(i.cover_url || '')
          ? i.cover_url.replace('/upload/', '/upload/c_fill,w_1200,h_630,f_jpg,q_auto/') : '';
        const title = `${i.title} — Vecorion Player`;
        const desc = (i.description || 'Assista no Vecorion Player.').slice(0, 160);
        const tags = [
          ['og:type', 'video.other'], ['og:site_name', 'Vecorion Player'], ['og:title', title],
          ['og:description', desc], ['og:url', `${S}${url.pathname}`],
          ...(img ? [['og:image', img], ['og:image:width', '1200'], ['og:image:height', '630']] : [])
        ].map(([p, c]) => `<meta property="${p}" content="${esc(c)}">`).join('')
          + `<meta name="twitter:card" content="summary_large_image">`;
        html = html.replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`).replace('<!--OG-->', tags);
      }
    } catch (e) { /* sem OG específico: cai no index padrão */ }
  }
  return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' }, body: html };
};
