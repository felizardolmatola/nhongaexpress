-- =============================================================================
-- NhongaExpress — BASE DE DADOS (versão organizada por tema)
-- =============================================================================
-- COMO USAR
--   Supabase > SQL Editor > New query > apagar tudo > colar este ficheiro > Run.
--   É seguro repetir (IF NOT EXISTS / OR REPLACE): serve para uma base nova
--   e também para uma base que já tem parte das tabelas.
--
-- COMO ESTÁ ORGANIZADO
--   Cada secção trata de UM tema e tem o mesmo desenho:
--       tabelas  ->  colunas extra p/ bases antigas  ->  funções
--   Para saltar para uma secção, pesquise por "SECÇÃO n" (ex.: "SECÇÃO 5").
--
-- MAPA (a ordem respeita as dependências)
--
--   SECÇÃO 0   Preparação ............ função set_updated_at
--   SECÇÃO 1   Contas ................ users, password_resets
--   SECÇÃO 2   Catálogo .............. categories, products, home_section_products
--   SECÇÃO 3   Entrega ............... drivers, delivery_zones
--   SECÇÃO 4   Conta do cliente ...... addresses, user_settings
--   SECÇÃO 5   Pedidos ............... orders, order_items, order_events, create_order
--   SECÇÃO 6   Notificações .......... notifications, user_notifications, funções
--   SECÇÃO 7   Triggers .............. tudo o que acontece "sozinho"
--   SECÇÃO 8   Imagens ............... bucket product-images
--   SECÇÃO 9   Permissões ............ só o backend (service_role) chama as funções
--   SECÇÃO 10  Dados iniciais ........ preenche avisos e histórico dos pedidos antigos
--   SECÇÃO 11  Verificação ........... deve devolver ZERO linhas
--   SECÇÃO 12  Migração do legado .... admin antigo (Supabase Auth) -> users.role
--   SECÇÃO 13  Extras opcionais ...... tudo comentado
--
-- RELAÇÕES ENTRE TABELAS
--
--   users ─┬─< password_resets
--          ├─< addresses
--          ├─1 user_settings
--          ├─< notifications >─ orders (opcional)
--          └─< orders ─┬─< order_items >─ products
--                      ├─< order_events
--                      └─> drivers
--
--   categories (liga-se a products pelo NOME, products.category)
--   home_section_products >─ products
--   delivery_zones (independente: taxa por bairro)
--
-- REGRA DE SEGURANÇA DO PROJETO
--   Todas as tabelas têm RLS LIGADO e SEM políticas: a chave pública (anon) não
--   lê nem escreve nada. Só o backend, com a chave service_role, acede aos dados.
--   (Única exceção: o bucket de imagens, que é de leitura pública — SECÇÃO 8.)
--
-- O QUE MUDOU EM RELAÇÃO AO FICHEIRO ANTIGO
--   * Cada tabela aparece UMA vez, já com as colunas finais.
--   * create_order, password_resets e set_updated_at estavam repetidos: ficou só a versão final.
--   * Triggers agrupados na SECÇÃO 7; permissões agrupadas na SECÇÃO 9.
--   * admin_users / is_admin() e as políticas de upload do Supabase Auth já não são
--     usadas (o admin é users.role = 'admin'): deixaram de ser criadas.
--     Se a sua base antiga ainda as tem, a SECÇÃO 12 migra os admins e explica como limpar.
-- =============================================================================


-- #############################################################################
-- SECÇÃO 0 — PREPARAÇÃO
-- #############################################################################

-- Atualiza `updated_at` automaticamente em cada alteração (usada pelos triggers da SECÇÃO 7).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- #############################################################################
-- SECÇÃO 1 — CONTAS
-- #############################################################################

-- 1.1 users — clientes da loja e administradores --------------------------------
create table if not exists public.users (
  id                   uuid        primary key default gen_random_uuid(),
  name                 text        not null check (char_length(name) between 2 and 100),
  email                text,                        -- guardado sempre em minúsculas
  phone                text,                        -- formato normalizado: +258XXXXXXXXX
  password_hash        text,                        -- hash bcrypt, NUNCA a palavra-passe; null = conta só Google/Apple
  role                 text        not null default 'customer',   -- 'customer' | 'admin'
  google_id            text,                        -- `sub` do token Google
  apple_id             text,                        -- `sub` do token Apple
  sessions_valid_after timestamptz,                 -- tokens emitidos antes deste instante são recusados (null = nunca revogado)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- A conta precisa de pelo menos um contacto (e-mail OU telefone).
  constraint users_contact_required check (email is not null or phone is not null)
);

-- Para bases antigas: acrescenta o que faltar e ajusta regras.
alter table public.users add column if not exists role                 text not null default 'customer';
alter table public.users add column if not exists google_id            text;
alter table public.users add column if not exists apple_id             text;
alter table public.users add column if not exists sessions_valid_after timestamptz;
alter table public.users alter column password_hash drop not null;
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('customer', 'admin'));

-- Únicos (o índice de e-mail/telefone também acelera o login).
create unique index if not exists users_email_unique     on public.users (email)     where email     is not null;
create unique index if not exists users_phone_unique     on public.users (phone)     where phone     is not null;
create unique index if not exists users_google_id_unique on public.users (google_id) where google_id is not null;
create unique index if not exists users_apple_id_unique  on public.users (apple_id)  where apple_id  is not null;

alter table public.users enable row level security;

-- 1.2 password_resets — recuperação de palavra-passe ------------------------------
-- Um código de 6 dígitos por utilizador. Guardamos só o HASH (HMAC), a validade e as
-- tentativas falhadas. Uma linha por utilizador (um novo pedido substitui o anterior).
create table if not exists public.password_resets (
  user_id    uuid        primary key references public.users (id) on delete cascade,
  code_hash  text        not null,
  expires_at timestamptz not null,
  attempts   integer     not null default 0,
  created_at timestamptz not null default now()
);

alter table public.password_resets enable row level security;


-- #############################################################################
-- SECÇÃO 2 — CATÁLOGO
-- #############################################################################

-- 2.1 categories — nome + ícone, geridas pelo administrador -----------------------
-- `icon_url` = URL público da imagem do ícone (vazio = sem ícone próprio).
-- Os produtos ligam-se à categoria pelo NOME (products.category).
-- As 8 categorias iniciais SÓ são inseridas quando a tabela é criada agora (base nova):
-- o que o administrador apagou ou renomeou não volta.
-- CONFIRME se a lista coincide com a de services/data.ts e acrescente o que faltar.
do $$
begin
  if to_regclass('public.categories') is null then
    create table public.categories (
      id         uuid        primary key default gen_random_uuid(),
      name       text        not null check (char_length(btrim(name)) between 2 and 60),
      icon_url   text        not null default '',
      position   integer     not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    insert into public.categories (name, position) values
      ('Acessórios para telemóveis', 1),
      ('Áudio', 2),
      ('Computadores', 3),
      ('Energia e carregamento', 4),
      ('Internet e conectividade', 5),
      ('Acessórios automóveis', 6),
      ('Fotografia e vídeo', 7),
      ('Gadgets', 8);
  end if;
end $$;

-- Para bases antigas: o ícone passou de `icon` para `icon_url` (imagem carregada).
alter table public.categories add column if not exists icon_url text not null default '';
alter table public.categories drop column if exists icon;

-- Não deixa duas categorias com o mesmo nome (sem distinguir maiúsculas).
create unique index if not exists categories_name_unique on public.categories (lower(name));

alter table public.categories enable row level security;

-- 2.2 products ----------------------------------------------------------------------
create table if not exists public.products (
  id          uuid          primary key default gen_random_uuid(),
  name        text          not null check (char_length(name) between 2 and 160),
  description text          not null default '',
  price       numeric(12,2) not null check (price >= 0),
  category    text          not null,                     -- NOME da categoria
  image       text          not null default '',          -- URL da imagem (bucket product-images)
  stock       integer       not null default 0 check (stock >= 0),
  active      boolean       not null default true,
  specs       jsonb         not null default '[]'::jsonb, -- [{"label":"Bateria","value":"30 horas"}]
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

alter table public.products add column if not exists specs jsonb not null default '[]'::jsonb;

alter table public.products enable row level security;

-- 2.3 home_section_products — vitrines da página inicial -----------------------------
create table if not exists public.home_section_products (
  section    text        not null check (section in ('featured','offers','new','best-sellers','recommended')),
  product_id uuid        not null references public.products (id) on delete cascade,
  position   integer     not null default 0,
  created_at timestamptz not null default now(),
  primary key (section, product_id)
);

create index if not exists home_section_products_order on public.home_section_products (section, position);

alter table public.home_section_products enable row level security;

-- Substitui a lista de uma secção de forma atómica (apaga + insere na mesma transação).
create or replace function public.replace_home_section(p_section text, p_product_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from home_section_products where section = p_section;

  insert into home_section_products (section, product_id, position)
  select p_section, t.pid, t.ord - 1
    from unnest(p_product_ids) with ordinality as t(pid, ord);
end;
$$;


-- #############################################################################
-- SECÇÃO 3 — ENTREGA
-- #############################################################################

-- 3.1 drivers — entregadores -------------------------------------------------------------
create table if not exists public.drivers (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null check (char_length(name) between 2 and 100),
  phone      text        not null,                 -- formato normalizado: +258XXXXXXXXX
  vehicle    text        not null default '',      -- ex.: "Mota", "Bicicleta", "Carrinha"
  active     boolean     not null default true,    -- inativo = não aparece para atribuir, mas o histórico fica
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists drivers_phone_unique on public.drivers (phone);

alter table public.drivers enable row level security;

-- 3.2 delivery_zones — taxa de entrega fixa por bairro (cidade da Beira) -----------------
-- Uma linha por bairro. Sem linha = bairro ainda sem taxa (o checkout avisa o cliente).
-- O público vê as taxas via GET /api/delivery/zones; a edição é feita pelo painel admin.
create table if not exists public.delivery_zones (
  neighborhood text        primary key check (char_length(neighborhood) between 1 and 60),
  fee_mzn      integer     not null check (fee_mzn >= 0 and fee_mzn <= 100000),  -- MT, inteiro
  updated_at   timestamptz not null default now()
);

alter table public.delivery_zones enable row level security;


-- #############################################################################
-- SECÇÃO 4 — CONTA DO CLIENTE
-- #############################################################################

-- 4.1 addresses — moradas guardadas (máx. 5, regra aplicada no backend) ----------------
create table if not exists public.addresses (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.users (id) on delete cascade,
  label        text        not null default 'Casa',
  recipient    text        not null,
  phone        text        not null,
  province     text        not null default 'Sofala',
  city         text        not null default 'Cidade da Beira',
  in_city      boolean     not null default true,   -- true = dentro da cidade (30 min); false = fora (1 hora)
  neighborhood text        not null,
  reference    text        not null,
  is_default   boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.addresses add column if not exists in_city boolean not null default true;

create index if not exists addresses_user_idx on public.addresses (user_id);
-- No máximo UMA morada padrão por cliente.
create unique index if not exists addresses_one_default_per_user on public.addresses (user_id) where is_default;

alter table public.addresses enable row level security;

-- Define a morada padrão (atómico: tira a anterior e põe a nova na mesma transação).
create or replace function public.set_default_address(p_user_id uuid, p_address_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.addresses a where a.id = p_address_id and a.user_id = p_user_id) then
    raise exception 'ADDRESS_NOT_FOUND';
  end if;

  update public.addresses set is_default = false where user_id = p_user_id and is_default;
  update public.addresses set is_default = true, updated_at = now() where id = p_address_id and user_id = p_user_id;
end;
$$;

-- 4.2 user_settings — pagamento preferido e preferências de notificações -----------------
create table if not exists public.user_settings (
  user_id         uuid        primary key references public.users (id) on delete cascade,
  default_payment text,
  notify_orders   boolean     not null default true,    -- "Estado dos pedidos"
  notify_offers   boolean     not null default false,   -- "Ofertas e novidades"
  updated_at      timestamptz not null default now()
);

alter table public.user_settings enable row level security;


-- #############################################################################
-- SECÇÃO 5 — PEDIDOS
-- #############################################################################
-- Ciclo de vida do estado:
--   pending -> paid -> processing -> shipped -> completed
--   qualquer estado -> cancelled (devolve o stock; um pedido cancelado NÃO pode ser reaberto)

-- 5.1 orders --------------------------------------------------------------------------
create table if not exists public.orders (
  id                 uuid          primary key default gen_random_uuid(),
  user_id            uuid          references public.users (id) on delete set null,
  total              numeric(12,2) not null default 0 check (total >= 0),
  status             text          not null default 'pending'
                       check (status in ('pending','paid','processing','shipped','completed','cancelled')),
  payment_method     text          not null default 'Pagamento na entrega',
  shipping_address   text          not null default '',
  delivery_method    text          not null default 'Normal',
  delivery_fee       numeric(12,2) not null default 0 check (delivery_fee >= 0),
  idempotency_key    text,                                  -- evita pedidos duplicados (duplo clique / repetição de rede)
  hidden_by_customer boolean       not null default false,  -- o cliente "apagou" do histórico (o admin continua a ver)
  driver_id          uuid          references public.drivers (id) on delete set null,
  driver_assigned_at timestamptz,
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now()
);

-- Para bases antigas: acrescenta as colunas que foram surgindo.
alter table public.orders add column if not exists payment_method     text          not null default 'Pagamento na entrega';
alter table public.orders add column if not exists shipping_address   text          not null default '';
alter table public.orders add column if not exists delivery_method    text          not null default 'Normal';
alter table public.orders add column if not exists delivery_fee       numeric(12,2) not null default 0 check (delivery_fee >= 0);
alter table public.orders add column if not exists idempotency_key    text;
alter table public.orders add column if not exists hidden_by_customer boolean       not null default false;
alter table public.orders add column if not exists driver_id          uuid references public.drivers (id) on delete set null;
alter table public.orders add column if not exists driver_assigned_at timestamptz;

-- Uma chave de idempotência por utilizador (chaves nulas não contam).
create unique index if not exists orders_user_idempotency_unique on public.orders (user_id, idempotency_key) where idempotency_key is not null;
-- Listagem rápida do histórico de cada cliente (só os visíveis).
create index if not exists orders_user_visible_idx on public.orders (user_id, created_at desc) where hidden_by_customer = false;
-- Pedidos de cada entregador.
create index if not exists orders_driver_idx on public.orders (driver_id) where driver_id is not null;

alter table public.orders enable row level security;

-- 5.2 order_items ------------------------------------------------------------------------
create table if not exists public.order_items (
  id           uuid          primary key default gen_random_uuid(),
  order_id     uuid          not null references public.orders (id) on delete cascade,
  product_id   uuid          references public.products (id) on delete set null,
  product_name text          not null default '',   -- nome na altura da compra (o histórico não muda se o produto for editado/apagado)
  quantity     integer       not null check (quantity > 0),
  unit_price   numeric(12,2) not null check (unit_price >= 0)
);

alter table public.order_items add column if not exists product_name text not null default '';

alter table public.order_items enable row level security;

-- 5.3 order_events — linha do tempo do pedido (painel admin) --------------------------------
-- Cada mudança de estado e cada atribuição/troca de entregador fica registada,
-- venha do painel, do backend ou de SQL direto (preenchida pelo trigger da SECÇÃO 7).
create table if not exists public.order_events (
  id          uuid        primary key default gen_random_uuid(),
  order_id    uuid        not null references public.orders (id) on delete cascade,
  kind        text        not null check (kind in ('status', 'driver')),
  status      text,          -- kind = 'status'
  driver_id   uuid,          -- kind = 'driver' (null = entregador retirado)
  driver_name text,          -- nome na altura (o histórico não muda se o entregador for renomeado)
  created_at  timestamptz not null default now()
);

create index if not exists order_events_order_idx on public.order_events (order_id, created_at);

alter table public.order_events enable row level security;

-- 5.4 order_json — pedido completo (com itens) em JSON ---------------------------------------
create or replace function public.order_json(p_order_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',              o.id,
    'status',          o.status,
    'total',           o.total,
    'deliveryFee',     o.delivery_fee,
    'paymentMethod',   o.payment_method,
    'shippingAddress', o.shipping_address,
    'deliveryMethod',  o.delivery_method,
    'createdAt',       o.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id',        oi.id,
               'productId', oi.product_id,
               'name',      oi.product_name,
               'quantity',  oi.quantity,
               'unitPrice', oi.unit_price,
               'subtotal',  oi.quantity * oi.unit_price
             ) order by oi.product_name, oi.id)
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.id = p_order_id;
$$;

-- 5.5 create_order — checkout atómico (POST /api/orders) ---------------------------------------
-- O que faz:
--   * junta linhas repetidas do mesmo produto (A:1 + A:2 -> A:3);
--   * bloqueia os produtos SEMPRE na mesma ordem (por id) -> sem deadlocks entre compras;
--   * usa o preço ATUAL da base de dados (o cliente nunca envia preço);
--   * reserva o stock logo (baixa já neste momento);
--   * idempotência: a mesma chave não cria dois pedidos;
--   * qualquer erro desfaz TUDO (pedido, itens e baixa de stock);
--   * devolve o pedido completo em JSON.
-- Erros possíveis: EMPTY_ORDER, USER_NOT_FOUND, INVALID_QUANTITY:<id>, PRODUCT_NOT_FOUND:<id>, STOCK_INSUFFICIENT:<id>

-- Remove versões antigas (evita duas funções com o mesmo nome).
drop function if exists public.create_order(uuid, jsonb, text, text, text);
drop function if exists public.create_order(uuid, jsonb, text, text, text, text);

create or replace function public.create_order(
  p_user_id          uuid,
  p_items            jsonb,
  p_payment_method   text,
  p_shipping_address text,
  p_delivery_method  text,
  p_delivery_fee     numeric default 0,
  p_idempotency_key  text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total    numeric(12,2) := 0;
  v_line     record;
  v_product  public.products%rowtype;
  v_key      text := nullif(btrim(p_idempotency_key), '');
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ORDER';
  end if;

  if not exists (select 1 from public.users u where u.id = p_user_id) then
    raise exception 'USER_NOT_FOUND';
  end if;

  -- Idempotência: este utilizador já fez este pedido? Devolve o mesmo, sem criar outro.
  if v_key is not null then
    select o.id into v_order_id
      from public.orders o
     where o.user_id = p_user_id and o.idempotency_key = v_key;
    if found then
      return public.order_json(v_order_id);
    end if;
  end if;

  v_order_id := gen_random_uuid();

  begin
    insert into public.orders (id, user_id, total, delivery_fee, status, payment_method, shipping_address, delivery_method, idempotency_key)
    values (v_order_id, p_user_id, 0, greatest(coalesce(p_delivery_fee, 0), 0), 'pending',
            left(p_payment_method, 50), left(p_shipping_address, 500), left(p_delivery_method, 50), v_key);
  exception when unique_violation then
    -- Dois pedidos iguais em simultâneo: o outro ganhou, devolvemos o dele.
    select o.id into v_order_id
      from public.orders o
     where o.user_id = p_user_id and o.idempotency_key = v_key;
    return public.order_json(v_order_id);
  end;

  -- Produtos agrupados e ordenados por id: bloqueio sempre na mesma ordem (sem deadlock).
  for v_line in
    select (e->>'productId')::uuid                 as product_id,
           sum((e->>'quantity')::integer)::integer as qty
      from jsonb_array_elements(p_items) e
     group by 1
     order by 1
  loop
    if v_line.qty < 1 or v_line.qty > 99 then
      raise exception 'INVALID_QUANTITY:%', v_line.product_id;
    end if;

    -- FOR UPDATE: ninguém mais altera este produto até ao fim da transação.
    select * into v_product
      from public.products p
     where p.id = v_line.product_id and p.active
       for update;
    if not found then
      raise exception 'PRODUCT_NOT_FOUND:%', v_line.product_id;
    end if;

    if v_product.stock < v_line.qty then
      raise exception 'STOCK_INSUFFICIENT:%', v_line.product_id;
    end if;

    insert into public.order_items (order_id, product_id, product_name, quantity, unit_price)
    values (v_order_id, v_product.id, v_product.name, v_line.qty, v_product.price);

    update public.products set stock = stock - v_line.qty where id = v_product.id;

    v_total := v_total + v_product.price * v_line.qty;
  end loop;

  update public.orders
     set total = v_total + greatest(coalesce(p_delivery_fee, 0), 0)
   where id = v_order_id;

  return public.order_json(v_order_id);
end;
$$;

-- 5.6 orders_restock_on_cancel — cancelar devolve o stock (função do trigger, SECÇÃO 7) ------
create or replace function public.orders_restock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.products p
       set stock = p.stock + s.qty
      from (
        select oi.product_id, sum(oi.quantity)::integer as qty
          from public.order_items oi
         where oi.order_id = new.id and oi.product_id is not null
         group by oi.product_id
      ) s
     where p.id = s.product_id;
  elsif old.status = 'cancelled' and new.status <> 'cancelled' then
    -- O stock já foi devolvido; reabrir exigiria reservar de novo. Peça um pedido novo.
    raise exception 'ORDER_CANCELLED';
  end if;
  return new;
end;
$$;

-- 5.7 orders_log_events — regista a linha do tempo (função do trigger, SECÇÃO 7) ---------------
create or replace function public.orders_log_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, kind, status) values (new.id, 'status', new.status);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.order_events (order_id, kind, status) values (new.id, 'status', new.status);
  end if;

  if new.driver_id is distinct from old.driver_id then
    select d.name into v_name from public.drivers d where d.id = new.driver_id;
    insert into public.order_events (order_id, kind, driver_id, driver_name) values (new.id, 'driver', new.driver_id, v_name);
  end if;

  return new;
end;
$$;


-- #############################################################################
-- SECÇÃO 6 — NOTIFICAÇÕES (sino do cabeçalho)
-- #############################################################################
-- Ideia: cada aviso é UMA LINHA na base de dados. Assim:
--   * o "lido / por ler" fica guardado na conta (não se perde ao trocar de telemóvel);
--   * os avisos de pedidos nascem sozinhos por TRIGGER (painel admin, backend ou SQL);
--   * o mesmo aviso nunca é duplicado (chave `dedupe_key`);
--   * há avisos de ofertas (respeitam "Ofertas e novidades") e avisos do sistema.
--
--   notifications              a tabela (uma linha por aviso)
--   user_notifications         vista que o backend lê (já aplica as preferências da conta)
--   create_notification        cria um aviso (ignora repetidos)
--   order_notification_content texto de cada estado do pedido
--   mark_notifications_read    marca como lidos (alguns ou todos) de UM cliente
--   broadcast_offer            envia uma oferta a quem aceitou receber ofertas
--   purge_old_notifications    limpeza periódica

-- 6.1 Tabela -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.users (id) on delete cascade,

  type       text        not null check (type in ('order', 'offer', 'system')),
  title      text        not null check (char_length(btrim(title))   between 1 and 120),
  message    text        not null check (char_length(btrim(message)) between 1 and 500),
  -- Cor/ícone no sino: wait = a decorrer, go = a caminho, ok = concluído, bad = cancelado, info = neutro.
  tone       text        not null default 'info' check (tone in ('wait', 'go', 'ok', 'bad', 'info')),

  -- Pedido a que o aviso se refere (o clique no sino abre esse pedido). Pedido apagado = aviso apagado.
  order_id   uuid        references public.orders (id) on delete cascade,
  -- Extras livres (ex.: {"status":"shipped","ref":"#A1B2C3D4"}) sem precisar de novas colunas.
  data       jsonb       not null default '{}'::jsonb,
  -- Chave de idempotência, ex.: 'order:<id>:shipped'. Repetir o mesmo evento não cria outro aviso.
  dedupe_key text,

  -- Por ler = null. A data de leitura permite saber QUANDO foi lido.
  read_at    timestamptz,
  created_at timestamptz not null default now(),

  -- Um aviso de pedido tem de apontar para o pedido.
  constraint notifications_order_link check (type <> 'order' or order_id is not null)
);

create index if not exists notifications_user_recent_idx on public.notifications (user_id, created_at desc);                  -- lista do sino
create index if not exists notifications_user_unread_idx on public.notifications (user_id) where read_at is null;             -- contador vermelho
create unique index if not exists notifications_dedupe_unique on public.notifications (user_id, dedupe_key) where dedupe_key is not null;  -- sem repetidos
create index if not exists notifications_order_idx on public.notifications (order_id) where order_id is not null;             -- acelera o on delete cascade

alter table public.notifications enable row level security;

-- 6.2 Vista que o backend lê ------------------------------------------------------------
-- Aplica as preferências de Conta > Definições > Notificações:
--   "Estado dos pedidos" desligado  -> não mostra nem conta avisos de pedidos;
--   "Ofertas e novidades" desligado -> não mostra nem conta ofertas.
-- Os avisos continuam guardados: ao voltar a ligar, o histórico reaparece.
-- Lista:     select * from user_notifications where user_id = ? order by created_at desc limit 15
-- Contador:  select count(*) from user_notifications where user_id = ? and read_at is null
create or replace view public.user_notifications
with (security_invoker = true) as
select n.*
from public.notifications n
left join public.user_settings s on s.user_id = n.user_id
where case n.type
        when 'order' then coalesce(s.notify_orders, true)
        when 'offer' then coalesce(s.notify_offers, false)
        else true
      end;

-- 6.3 create_notification — devolve o id novo, ou null se já existia (mesma dedupe_key) ---------
create or replace function public.create_notification(
  p_user_id    uuid,
  p_type       text,
  p_title      text,
  p_message    text,
  p_tone       text  default 'info',
  p_order_id   uuid  default null,
  p_data       jsonb default '{}'::jsonb,
  p_dedupe_key text  default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (user_id, type, title, message, tone, order_id, data, dedupe_key)
  values (p_user_id, p_type, p_title, p_message, p_tone, p_order_id, coalesce(p_data, '{}'::jsonb), p_dedupe_key)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- 6.4 order_notification_content — texto de cada estado ------------------------------------------
-- Igual ao que a loja mostra em ORDER_STATUS no App.tsx.
-- `stage` agrupa estados com o mesmo significado: 'pending' e 'processing' são ambos
-- "em preparação", por isso o cliente não recebe dois avisos iguais quando o admin passa de um para o outro.
create or replace function public.order_notification_content(p_status text)
returns table (stage text, title text, message text, tone text)
language sql
immutable
as $$
  select t.stage, t.title, t.message, t.tone
  from (values
    ('pending',    'preparing', 'Pedido em preparação',  'O seu pedido está a ser preparado para a entrega.',                         'wait'),
    ('processing', 'preparing', 'Pedido em preparação',  'O seu pedido está a ser preparado para a entrega.',                         'wait'),
    ('paid',       'paid',      'Pagamento confirmado',  'Pagamento confirmado. O seu pedido está a ser preparado para a entrega.',   'wait'),
    ('shipped',    'shipped',   'Pedido a caminho',      'O seu pedido saiu para entrega e está a caminho.',                          'go'),
    ('completed',  'delivered', 'Pedido entregue',       'O seu pedido foi entregue. Obrigado pela compra!',                          'ok'),
    ('cancelled',  'cancelled', 'Pedido cancelado',      'O seu pedido foi cancelado.',                                               'bad')
  ) as t(status, stage, title, message, tone)
  where t.status = p_status;
$$;

-- 6.5 Funções dos triggers de pedidos (ligadas na SECÇÃO 7) -----------------------------------------
-- Cria o aviso quando um pedido é criado ou muda de estado.
create or replace function public.orders_notify_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  if new.user_id is null then return new; end if;        -- pedido sem cliente associado
  if new.hidden_by_customer then return new; end if;     -- o cliente apagou-o do histórico
  select * into c from public.order_notification_content(new.status);
  if not found then return new; end if;

  perform public.create_notification(
    new.user_id, 'order', c.title, c.message, c.tone, new.id,
    jsonb_build_object('status', new.status, 'ref', '#' || upper(left(new.id::text, 8))),
    'order:' || new.id::text || ':' || c.stage
  );
  return new;
end;
$$;

-- Quando o cliente "elimina" o pedido do histórico, os avisos dele saem do sino.
create or replace function public.orders_hide_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications where order_id = new.id;
  return new;
end;
$$;

-- 6.6 mark_notifications_read — p_ids = lista a marcar; null = TODOS os por ler daquele cliente ------
-- Só toca nos avisos do próprio p_user_id. Devolve quantos marcou.
create or replace function public.mark_notifications_read(p_user_id uuid, p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.notifications
     set read_at = now()
   where user_id = p_user_id
     and read_at is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 6.7 broadcast_offer — envia a quem ligou "Ofertas e novidades". Devolve quantos receberam. -------
-- Exemplo:  select public.broadcast_offer('Promoção de fim de semana', 'Até 20% de desconto em Áudio.');
create or replace function public.broadcast_offer(p_title text, p_message text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.notifications (user_id, type, title, message, tone)
  select s.user_id, 'offer', p_title, p_message, 'info'
  from public.user_settings s
  where s.notify_offers;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 6.8 purge_old_notifications — limpeza ------------------------------------------------------------
-- Apaga avisos já lidos com mais de p_days dias e QUALQUER aviso com mais do dobro desses dias.
-- Devolve quantos apagou.
create or replace function public.purge_old_notifications(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.notifications
   where (read_at is not null and created_at < now() - make_interval(days => p_days))
      or created_at < now() - make_interval(days => p_days * 2);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- #############################################################################
-- SECÇÃO 7 — TRIGGERS (tudo o que acontece "sozinho")
-- #############################################################################
--
--   Evento na tabela orders                 O que dispara                    Função
--   --------------------------------------  -------------------------------  ----------------------------
--   UPDATE (qualquer)                       atualiza updated_at              set_updated_at
--   UPDATE do status                        cancelar devolve o stock         orders_restock_on_cancel
--   INSERT e UPDATE do status               cria o aviso no sino             orders_notify_status
--   UPDATE de hidden_by_customer -> true    remove os avisos desse pedido    orders_hide_notifications
--   INSERT e UPDATE de status/driver_id     regista na linha do tempo        orders_log_events

-- 7.1 updated_at automático ---------------------------------------------------------------------
drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists drivers_set_updated_at on public.drivers;
create trigger drivers_set_updated_at
  before update on public.drivers
  for each row execute function public.set_updated_at();

drop trigger if exists delivery_zones_set_updated_at on public.delivery_zones;
create trigger delivery_zones_set_updated_at
  before update on public.delivery_zones
  for each row execute function public.set_updated_at();

-- 7.2 Pedidos: stock ------------------------------------------------------------------------------
drop trigger if exists orders_restock_on_cancel on public.orders;
create trigger orders_restock_on_cancel
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function public.orders_restock_on_cancel();

-- 7.3 Pedidos: avisos no sino ----------------------------------------------------------------------
drop trigger if exists orders_notify_insert on public.orders;
create trigger orders_notify_insert
  after insert on public.orders
  for each row execute function public.orders_notify_status();

drop trigger if exists orders_notify_update on public.orders;
create trigger orders_notify_update
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function public.orders_notify_status();

drop trigger if exists orders_hide_notifications on public.orders;
create trigger orders_hide_notifications
  after update of hidden_by_customer on public.orders
  for each row
  when (new.hidden_by_customer and not old.hidden_by_customer)
  execute function public.orders_hide_notifications();

-- 7.4 Pedidos: linha do tempo ------------------------------------------------------------------------
drop trigger if exists orders_log_insert on public.orders;
create trigger orders_log_insert
  after insert on public.orders
  for each row execute function public.orders_log_events();

drop trigger if exists orders_log_update on public.orders;
create trigger orders_log_update
  after update of status, driver_id on public.orders
  for each row
  when (old.status is distinct from new.status or old.driver_id is distinct from new.driver_id)
  execute function public.orders_log_events();


-- #############################################################################
-- SECÇÃO 8 — IMAGENS DE PRODUTOS (Storage)
-- #############################################################################
-- Bucket público: a aplicação guarda na base de dados apenas o URL da imagem.
-- O upload é feito pelo backend (service_role), por isso não há políticas de escrita.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- Leitura pública, para a loja mostrar as fotos sem login.
drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
  for select to public using (bucket_id = 'product-images');


-- #############################################################################
-- SECÇÃO 9 — PERMISSÕES (só o backend, com service_role)
-- #############################################################################

-- 9.1 Funções chamadas pelo backend: fechadas ao público, abertas ao service_role.
revoke all on function public.order_json(uuid)                                                       from public, anon, authenticated;
revoke all on function public.create_order(uuid, jsonb, text, text, text, numeric, text)             from public, anon, authenticated;
revoke all on function public.set_default_address(uuid, uuid)                                        from public, anon, authenticated;
revoke all on function public.replace_home_section(text, uuid[])                                     from public, anon, authenticated;
revoke all on function public.create_notification(uuid, text, text, text, text, uuid, jsonb, text)   from public, anon, authenticated;
revoke all on function public.mark_notifications_read(uuid, uuid[])                                  from public, anon, authenticated;
revoke all on function public.broadcast_offer(text, text)                                            from public, anon, authenticated;
revoke all on function public.purge_old_notifications(integer)                                       from public, anon, authenticated;

grant execute on function public.order_json(uuid)                                                       to service_role;
grant execute on function public.create_order(uuid, jsonb, text, text, text, numeric, text)             to service_role;
grant execute on function public.set_default_address(uuid, uuid)                                        to service_role;
grant execute on function public.replace_home_section(text, uuid[])                                     to service_role;
grant execute on function public.create_notification(uuid, text, text, text, text, uuid, jsonb, text)   to service_role;
grant execute on function public.mark_notifications_read(uuid, uuid[])                                  to service_role;
grant execute on function public.broadcast_offer(text, text)                                            to service_role;
grant execute on function public.purge_old_notifications(integer)                                       to service_role;

-- 9.2 Funções de trigger: ninguém as chama diretamente.
revoke all on function public.orders_restock_on_cancel()   from public, anon, authenticated;
revoke all on function public.orders_notify_status()       from public, anon, authenticated;
revoke all on function public.orders_hide_notifications()  from public, anon, authenticated;
revoke all on function public.orders_log_events()          from public, anon, authenticated;

-- 9.3 Tabelas e vista: acesso total só para o service_role.
revoke all on public.notifications      from anon, authenticated;
revoke all on public.user_notifications from anon, authenticated;

grant select, insert, update, delete on public.notifications   to service_role;
grant select                         on public.user_notifications to service_role;
grant select, insert, update, delete on public.drivers         to service_role;
grant select, insert, update, delete on public.order_events    to service_role;
grant select, insert, update, delete on public.delivery_zones  to service_role;


-- #############################################################################
-- SECÇÃO 10 — DADOS INICIAIS (pedidos que já existem)
-- #############################################################################

-- 10.1 Avisos: cria o aviso do estado atual dos pedidos dos últimos 30 dias, JÁ marcado como lido
--      (para ninguém receber de repente uma enxurrada de avisos por ler).
insert into public.notifications (user_id, type, title, message, tone, order_id, data, dedupe_key, read_at, created_at)
select o.user_id, 'order', c.title, c.message, c.tone, o.id,
       jsonb_build_object('status', o.status, 'ref', '#' || upper(left(o.id::text, 8))),
       'order:' || o.id::text || ':' || c.stage,
       now(), o.updated_at
from public.orders o
cross join lateral public.order_notification_content(o.status) c
where o.user_id is not null
  and not o.hidden_by_customer
  and o.created_at > now() - interval '30 days'
on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

-- 10.2 Linha do tempo: um primeiro registo com o estado atual (só para pedidos ainda sem histórico).
insert into public.order_events (order_id, kind, status, created_at)
select o.id, 'status', o.status, o.created_at
  from public.orders o
 where not exists (select 1 from public.order_events e where e.order_id = o.id);


-- #############################################################################
-- SECÇÃO 11 — VERIFICAÇÃO
-- #############################################################################
-- Esta consulta deve devolver ZERO linhas (tabelas do esquema public sem RLS).
select tablename from pg_tables where schemaname = 'public' and not rowsecurity;


-- #############################################################################
-- SECÇÃO 12 — MIGRAÇÃO DO LEGADO (só afeta bases antigas)
-- #############################################################################
-- Antes, o painel tinha um login à parte (Supabase Auth + tabela admin_users).
-- Agora o administrador é uma conta normal da tabela `users` com role = 'admin'.
--
-- Este bloco só faz algo se `admin_users` ainda existir: o e-mail do admin antigo que
-- coincidir com o e-mail de uma conta da loja passa a administrador.
do $$
begin
  if to_regclass('public.admin_users') is not null then
    update public.users u
       set role = 'admin'
      from public.admin_users a
      join auth.users au on au.id = a.user_id
     where a.active = true and a.role = 'admin' and lower(u.email) = lower(au.email);
  end if;
end $$;

-- Limpeza (OPCIONAL, depois de confirmar que os admins já estão migrados). Retire os "--" para executar:
--   drop policy if exists product_images_admin_insert on storage.objects;
--   drop policy if exists product_images_admin_update on storage.objects;
--   drop policy if exists product_images_admin_delete on storage.objects;
--   drop function if exists public.is_admin();
--   drop table    if exists public.admin_users;


-- #############################################################################
-- SECÇÃO 13 — EXTRAS OPCIONAIS (tudo comentado; retire os "--" para usar)
-- #############################################################################

-- Promover um administrador (alternativa ao script `npm run admin:promote`):
--   update public.users set role = 'admin' where email = 'o-seu-email@exemplo.com';

-- Taxas de entrega iniciais (ajuste os valores). Também pode defini-las no painel admin
-- (PUT /api/delivery/zones/:bairro):
--   insert into public.delivery_zones (neighborhood, fee_mzn) values
--     ('Macuti', 100), ('Esturro', 100), ('Ponta-Gêa', 100), ('Chaimite', 150), ('Munhava-Central', 200)
--   on conflict (neighborhood) do update set fee_mzn = excluded.fee_mzn;

-- E-mail obrigatório. PRIMEIRO veja que contas ainda não têm e-mail:
--   select id, name, phone, created_at from users where email is null;
-- Preencha o e-mail dessas contas (Table Editor) ou apague as de teste.
-- SÓ DEPOIS de a consulta devolver 0 linhas:
--   alter table users alter column email set not null;

-- Limpeza automática de notificações todos os dias às 03:00
-- (Supabase > Database > Extensions > pg_cron):
--   select cron.schedule('limpar-notificacoes', '0 3 * * *', $$select public.purge_old_notifications(90)$$);

-- Pede ao PostgREST (API do Supabase) para reconhecer as tabelas novas de imediato.
notify pgrst, 'reload schema';
