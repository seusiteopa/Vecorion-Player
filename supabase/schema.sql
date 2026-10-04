-- Vecorion Player: esquema base. Execute no SQL Editor do Supabase.
create extension if not exists pgcrypto;

create table profiles(
  id uuid primary key references auth.users on delete cascade,
  name text, avatar_url text,
  role text not null default 'USER' check (role in ('USER','ADMIN')),
  created_at timestamptz default now());

create table categories(
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text unique not null, description text, image_url text,
  access_type text not null default 'mixed' check (access_type in ('free','paid','mixed')),
  created_at timestamptz default now());

create table videos(
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  category_id uuid references categories(id),
  slug text unique not null, title text not null, description text, tags text[],
  access_type text not null default 'free' check (access_type in ('free','paid')),
  price numeric(10,2), currency text default 'BRL',
  cloudinary_public_id text, cover_url text,
  duration numeric, width int, height int, orientation text, file_size bigint, format text,
  status text not null default 'DRAFT' check (status in ('DRAFT','PROCESSING','PENDING_PAYMENT','PUBLISHED','ARCHIVED','REJECTED')),
  featured boolean default false,
  collection_only boolean not null default false,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  check (access_type='free' or price > 0));

create table collections(
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  category_id uuid references categories(id),
  slug text unique not null, title text not null, description text, cover_url text,
  access_type text not null default 'free' check (access_type in ('free','paid')),
  price numeric(10,2), currency text default 'BRL',
  status text not null default 'DRAFT' check (status in ('DRAFT','PROCESSING','PENDING_PAYMENT','PUBLISHED','ARCHIVED','REJECTED')),
  featured boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  check (access_type='free' or price > 0));

create table collection_lessons(
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  title text not null, description text, lesson_order int not null,
  unique (collection_id, lesson_order));

create table orders(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  video_id uuid references videos(id), collection_id uuid references collections(id),
  total_amount numeric(10,2) not null, currency text default 'BRL',
  provider text default 'mercadopago', provider_payment_id text unique,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz default now(), paid_at timestamptz,
  check (num_nonnulls(video_id, collection_id) = 1));

create table purchases(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  order_id uuid unique references orders(id),
  video_id uuid references videos(id), collection_id uuid references collections(id),
  amount numeric(10,2) not null, creator_amount numeric(10,2) not null, platform_amount numeric(10,2) not null,
  status text not null default 'approved' check (status in ('approved','cancelled')),
  purchased_at timestamptz default now(),
  check (num_nonnulls(video_id, collection_id) = 1));

create table publication_payments(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  content_type text not null check (content_type in ('video','collection')),
  content_id uuid not null, video_count int not null check (video_count > 0),
  unit_fee numeric(10,2) not null default 40, total_amount numeric(10,2) not null,
  provider text default 'mercadopago', provider_payment_id text unique,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz default now(), paid_at timestamptz);

create table creator_earnings(
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id),
  purchase_id uuid not null unique references purchases(id),
  gross_amount numeric(10,2) not null,
  creator_percentage numeric(5,2) not null default 45, creator_amount numeric(10,2) not null,
  platform_percentage numeric(5,2) not null default 55, platform_amount numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending','paid')),
  created_at timestamptz default now());

-- Funções de apoio
create function is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'ADMIN') $$;

create function has_access(p_video uuid, p_collection uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and (
    exists(select 1 from videos v where v.id = p_video and v.owner_id = auth.uid())
    or exists(select 1 from collections c where c.id = p_collection and c.owner_id = auth.uid())
    or exists(select 1 from purchases p where p.user_id = auth.uid() and p.status = 'approved'
              and (p.video_id = p_video or p.collection_id = p_collection))
    or exists(select 1 from purchases p join collection_lessons l on l.collection_id = p.collection_id
              where p.user_id = auth.uid() and p.status = 'approved' and l.video_id = p_video)) $$;

-- Perfil automático ao criar conta
create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into profiles(id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Trava: conteúdo pago só vira PUBLISHED pelo backend (webhook com service role) ou admin
create function guard_content() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce(auth.role(), 'service_role') = 'service_role' or is_admin() then return new; end if;
  if tg_op = 'UPDATE' and new.owner_id <> old.owner_id then
    raise exception 'O dono do conteúdo não pode ser alterado.';
  end if;
  if new.access_type = 'paid' and new.status = 'PUBLISHED'
     and (tg_op = 'INSERT' or old.status <> 'PUBLISHED' or old.access_type <> 'paid') then
    raise exception 'Conteúdo pago só é publicado após a confirmação da taxa.';
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger guard_videos before insert or update on videos for each row execute function guard_content();
create trigger guard_collections before insert or update on collections for each row execute function guard_content();

-- Trava: ninguém altera o próprio papel
create function guard_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.role <> old.role and not (coalesce(auth.role(), 'service_role') = 'service_role' or is_admin()) then
    raise exception 'Papel não pode ser alterado.';
  end if;
  return new;
end $$;
create trigger guard_profiles before update on profiles for each row execute function guard_profile();

-- RLS
alter table profiles enable row level security;
alter table categories enable row level security;
alter table videos enable row level security;
alter table collections enable row level security;
alter table collection_lessons enable row level security;
alter table orders enable row level security;
alter table purchases enable row level security;
alter table publication_payments enable row level security;
alter table creator_earnings enable row level security;

create policy p_read on profiles for select using (true);
create policy p_upd on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy p_adm on profiles for all using (is_admin()) with check (is_admin());

create policy c_read on categories for select using (true);
create policy c_adm on categories for all using (is_admin()) with check (is_admin());

create policy v_read on videos for select using (status = 'PUBLISHED' or owner_id = auth.uid() or is_admin());
create policy v_ins on videos for insert with check (owner_id = auth.uid());
create policy v_upd on videos for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy v_del on videos for delete using (owner_id = auth.uid());
create policy v_adm on videos for all using (is_admin()) with check (is_admin());

create policy k_read on collections for select using (status = 'PUBLISHED' or owner_id = auth.uid() or is_admin());
create policy k_ins on collections for insert with check (owner_id = auth.uid());
create policy k_upd on collections for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy k_del on collections for delete using (owner_id = auth.uid());
create policy k_adm on collections for all using (is_admin()) with check (is_admin());

create policy l_read on collection_lessons for select using (
  exists(select 1 from collections c where c.id = collection_id and (c.status = 'PUBLISHED' or c.owner_id = auth.uid())) or is_admin());
create policy l_own on collection_lessons for all using (
  exists(select 1 from collections c where c.id = collection_id and c.owner_id = auth.uid()))
  with check (exists(select 1 from collections c where c.id = collection_id and c.owner_id = auth.uid()));

-- Financeiro: leitura apenas do próprio; escrita somente pelo backend (service role)
create policy o_read on orders for select using (user_id = auth.uid() or is_admin());
create policy u_read on purchases for select using (user_id = auth.uid() or is_admin());
create policy f_read on publication_payments for select using (user_id = auth.uid() or is_admin());
create policy e_read on creator_earnings for select using (creator_id = auth.uid() or is_admin());
