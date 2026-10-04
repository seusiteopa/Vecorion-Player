# Vecorion Player

Marketplace de vídeos e conjuntos: assistir, comprar (Pix) e publicar na mesma conta. Frontend em um único `index.html`; Netlify Functions só onde há segredo ou webhook.

## Arquivos
| Arquivo | Função |
|---|---|
| `index.html` | App completo (vitrine, páginas de vídeo/conjunto, player, login, Meus Vídeos, Pix) |
| `netlify.toml` | Rewrites (`/v/*`, `/c/*`) e cabeçalhos de segurança |
| `netlify/functions/share.js` | Injeta og:image (capa 1200×630) por vídeo/conjunto |
| `netlify/functions/checkout.js` | Cria pedido e Pix; preço sempre vindo do banco |
| `netlify/functions/mp-webhook.js` | Confirma pagamento, grava compra e comissão 45/55 |
| `netlify/functions/play.js` | URL assinada do vídeo pago, só com acesso |
| `netlify/functions/_lib.js` | Utilitários (service role só no servidor) |
| `supabase/schema.sql` | Tabelas, RLS, triggers e funções |
| `docs/ARTEFATO.md` | Memória oficial do projeto (decisões, assets, motion, QA) |

## Como colocar no ar
1. **Supabase:** rode `supabase/schema.sql` no SQL Editor. Em Authentication > URL Configuration, informe a URL do site. Crie categorias na tabela `categories`.
2. **Primeiro admin:** crie sua conta pelo site e rode no SQL Editor: `update profiles set role='ADMIN' where id='SEU_USER_ID';`
3. **Cloudinary:** vídeos pagos devem usar entrega **authenticated**; gratuitos, **upload** (público). Capas são públicas.
4. **Mercado Pago:** crie a aplicação, copie o Access Token e, em Webhooks, cadastre `https://SEU_SITE/.netlify/functions/mp-webhook` com o evento *Pagamentos*; copie a assinatura secreta para `MP_WEBHOOK_SECRET`. A conta precisa ter chave Pix.
5. **Netlify:** conecte o repositório, preencha as variáveis de `.env.example` e faça o deploy.
6. **index.html:** preencha `CFG` (só valores públicos).

## Segurança (resumo)
RLS em todas as tabelas; compras, ganhos e pagamentos só são escritos pelo servidor; conteúdo pago só vira PUBLISHED por trigger/backend; webhook com assinatura e conferência de valor; nenhum segredo no frontend.

## Limites conhecidos
- **Ainda não existem:** upload assinado e tela Publicar (taxa de R$ 40 por vídeo), Meus Ganhos, Meu Painel, Admin, pagamento com cartão, login com Google. Enquanto isso, o conteúdo é cadastrado manualmente (Cloudinary + tabelas `videos`/`collections` no Supabase) e a publicação paga é liberada pelo admin.
- A URL assinada do Cloudinary não expira (expiração exige token do plano Enterprise).
- Sem reembolso por decisão do negócio; revisar com advogado (direito de arrependimento).
- Termos de uso e Privacidade ainda precisam ser escritos.
- Não validado em navegador real nem com contas reais de Supabase, Cloudinary e Mercado Pago.
- Suporte exibido ao cliente: vecorionsuporte@gmail.com
