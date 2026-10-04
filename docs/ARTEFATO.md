# Artefato central: Vecorion Player (v0.3)

## Briefing
Marketplace de vídeos: uma conta assiste, compra e publica. Vídeos avulsos e conjuntos (aulas). Taxa de publicação de R$ 40 por vídeo pago; venda dividida 45% criador / 55% plataforma; categorias dinâmicas; sem reembolso; suporte em vecorionsuporte@gmail.com.

## Decisões aprovadas
Nome: Vecorion Player. Gateway: Mercado Pago, checkout transparente (Pix implementado; cartão pendente). Capas no Cloudinary; capa do vídeo/conjunto é também og:image. Página própria para cada vídeo e conjunto: gratuito abre o conteúdo, pago leva ao checkout. Stack: Supabase, Cloudinary, Netlify. Frontend em um HTML; Functions apenas por segurança.

## Arquitetura
Rotas: `/`, `/v/:slug`, `/c/:slug`, `/login`, `/meus-videos`. OG por slug via `share.js`. Acesso pago: `has_access` (RLS) + `play.js`. Compra: `checkout.js` → Pix → `mp-webhook.js` → compra + ganho.

## Design System
Cores: fundo #0B0E14, superfícies #141923/#1C2331, texto #EAF0F8, apoio #8D99AE, primária #2F8CFF, grátis #36D6A0, pago #FFB938, halo #5CE1E6. Tipografia: Sora (títulos), Inter (texto). Movimento: 120/220/400 ms; easing `cubic-bezier(.2,.8,.2,1)` e `(.4,0,.2,1)`.

## Direção de arte e assets
Conceito "Órbita": escuro, luz azul à direita (a Terra da logo). Logo criada em SVG a partir da descrição do cliente (infinito com a Terra no círculo direito).
| ID | Asset | Origem | Status |
|---|---|---|---|
| A01/A02 | Logo e símbolo | SVG gerado | Aplicado (header, hero, favicon, loader) |
| A03 | Terra animável | SVG | Aplicado |
| A04 | Hero orbital | Procedural SVG/CSS | Aplicado (só desktop, 60 s) |
| A05 | Ruído | SVG | Aplicado |
| A06 | Ícones | SVG | Não usado (sem necessidade) |
| A07 | Estado vazio | Texto + símbolo ∞ | Simplificado |
| A08 | Infinito carregando | SVG motion | Aplicado (loader) |
| A09 | Fundo desfocado do player | CSS | Aplicado (sem blur no celular) |
| A10/A11 | Capa 16:9 e og 1200×630 | Cloudinary | Aplicado |

## Motion
Entrada do hero (400 ms, uma vez), hover de card (só com mouse), desenho do infinito (900 ms), Terra (1,2 s), órbita (60 s, desktop). Reduced motion: tudo parado no estado final. Sem Canvas, partículas ou WebGL.

## Segurança
RLS; triggers de publicação paga e de papel; webhook assinado e idempotente; valor conferido; segredos só nas Functions; textos escapados; capas só do Cloudinary; CSP restritiva (usa `unsafe-inline`).

## Histórico de QA
- Etapa 8: 9 correções (âncora, aula paga, vídeos de conjunto soltos, ids duplicados, SITE_URL, órbita, chip Todas, foco, loader).
- Etapa 9: checkout, webhook, play e Pix criados e testados com serviços simulados (45/55, reentrega, assinatura, valor).

## Pendências
Upload assinado e Publicar com taxa; Meus Ganhos, Painel e Admin; cartão; Google; Termos e Privacidade; sitemap; testes reais e medição de desempenho; revisão jurídica da política sem reembolso.
