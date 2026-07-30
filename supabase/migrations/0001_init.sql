-- ============================================================================
-- İHRACAT ERP — INITIAL SCHEMA (0001)
-- Supabase SQL Editor'de (Dashboard → SQL Editor → New query) tek seferde Run et.
-- Yonga ERP konvansiyonu: uuid PK + enum + RLS + soft-delete + audit + trigger.
-- Eski uygulamadaki TEXT id'ler `legacy_id` kolonunda saklanır; veri taşıma
-- (0002_data_migration) FK'leri legacy_id üzerinden eşler.
-- Tekrar çalıştırmaya güvenli: IF NOT EXISTS / guarded enum blokları.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================
do $$ begin
  create type user_role as enum ('admin', 'manager', 'employee');
exception when duplicate_object then null; end $$;

-- İhracat sipariş durumları (uygulamadaki ORDER_STATUSES ile birebir)
do $$ begin
  create type export_order_status as enum
    ('draft','confirmed','production','ready','shipped','delivered','completed','cancelled');
exception when duplicate_object then null; end $$;

-- Ödeme (gerçekleşen para hareketi) durumu
do $$ begin
  create type export_payment_status as enum ('paid','pending','cancelled');
exception when duplicate_object then null; end $$;

-- Ödeme planı kalem tipi
do $$ begin
  create type payment_plan_type as enum ('prepayment','preShipment','deferred','vat','other');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- PROFILES (auth.users uzantısı — yetki buradan okunur)
-- ============================================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       user_role not null default 'employee',
  can_edit   boolean not null default false,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- APP SETTINGS (key-value — örn. son TCMB tarihi, genel ayarlar)
-- ============================================================================
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- DÖVİZ KURLARI (USD bazlı)
-- ============================================================================
create table if not exists public.exchange_rates (
  currency    char(3) primary key,
  rate_to_usd numeric(20,10) not null check (rate_to_usd > 0),
  source      text,
  last_update date,
  updated_at  timestamptz not null default now()
);

-- ============================================================================
-- BANKA HESAPLARI
-- ============================================================================
create table if not exists public.bank_accounts (
  id             uuid primary key default uuid_generate_v4(),
  legacy_id      text unique,
  name           text not null,
  bank_name      text,
  account_number text,
  iban           text,
  swift          text,
  currency       char(3) not null default 'USD',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  created_by     uuid references auth.users(id),
  updated_by     uuid references auth.users(id)
);

-- ============================================================================
-- MÜŞTERİLER
-- ============================================================================
create table if not exists public.customers (
  id                       uuid primary key default uuid_generate_v4(),
  legacy_id                text unique,
  code                     text,
  name                     text not null,
  email                    text,
  phone                    text,
  address                  text,
  country                  text,
  tax_number               text,
  notes                    text,
  contact_person           text,
  credit_limit             numeric(14,2) not null default 0,
  default_currency         char(3) not null default 'USD',
  preferred_incoterm       text,
  default_payment_terms    integer not null default 0,
  default_payment_method   text not null default 'bank_transfer',
  default_prepayment_pct   numeric(5,2) not null default 0,
  default_pre_shipment_pct numeric(5,2) not null default 0,
  default_deferred_pct     numeric(5,2) not null default 100,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,
  created_by               uuid references auth.users(id),
  updated_by               uuid references auth.users(id)
);
create index if not exists idx_customers_code    on public.customers(code) where code is not null;
create index if not exists idx_customers_country on public.customers(country);

-- ============================================================================
-- ÜRÜNLER
-- ============================================================================
create table if not exists public.products (
  id                 uuid primary key default uuid_generate_v4(),
  legacy_id          text unique,
  product_code       text,
  manufacturing_code text,
  name_tr            text,
  name_en            text,
  unit               text not null default 'adet',
  category           text,
  notes              text,
  default_price      numeric(14,4) not null default 0,
  default_currency   char(3) not null default 'USD',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  created_by         uuid references auth.users(id),
  updated_by         uuid references auth.users(id)
);
create index if not exists idx_products_product_code       on public.products(product_code) where product_code is not null;
create index if not exists idx_products_manufacturing_code on public.products(manufacturing_code) where manufacturing_code is not null;

-- ============================================================================
-- SİPARİŞLER
-- ============================================================================
create table if not exists public.orders (
  id                      uuid primary key default uuid_generate_v4(),
  legacy_id               text unique,
  order_number            text,
  customer_id             uuid references public.customers(id) on delete restrict,
  status                  export_order_status not null default 'draft',
  currency                char(3) not null default 'USD',
  vat_rate                numeric(5,2) not null default 0,
  incoterms               text,
  order_date              date,
  shipment_date           date,
  actual_shipment_date    date,
  shipping_method         text,
  port_of_loading         text,
  port_of_discharge       text,
  bill_of_lading          text,
  invoice_number          text,
  notes                   text,
  discount_type           text,
  discount_value          numeric(14,2) not null default 0,
  payment_basis           text not null default 'order',
  payment_plan_template   jsonb,
  locked_at               date,
  locked_rate_at_shipment numeric(20,10),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,
  created_by              uuid references auth.users(id),
  updated_by              uuid references auth.users(id)
);
create index if not exists idx_orders_customer      on public.orders(customer_id);
create index if not exists idx_orders_status        on public.orders(status);
create index if not exists idx_orders_order_date    on public.orders(order_date);
create index if not exists idx_orders_shipment_date on public.orders(shipment_date);

-- ============================================================================
-- SİPARİŞ KALEMLERİ
-- ============================================================================
create table if not exists public.order_items (
  id                 uuid primary key default uuid_generate_v4(),
  legacy_id          text unique,
  order_id           uuid not null references public.orders(id) on delete cascade,
  product_id         uuid references public.products(id) on delete set null,
  product_code       text,
  manufacturing_code text,
  name_tr            text,
  name_en            text,
  unit               text not null default 'adet',
  quantity           numeric(12,2) not null default 0,
  unit_price         numeric(14,4) not null default 0,
  discount           numeric(5,2) not null default 0,
  shipment_no        integer,
  sort_order         integer not null default 0
);
create index if not exists idx_order_items_order   on public.order_items(order_id);
create index if not exists idx_order_items_product on public.order_items(product_id) where product_id is not null;

-- ============================================================================
-- ÇOKLU SEVKİYATLAR
-- ============================================================================
create table if not exists public.order_shipments (
  id                   uuid primary key default uuid_generate_v4(),
  legacy_id            text unique,
  order_id             uuid not null references public.orders(id) on delete cascade,
  shipment_no          integer not null,
  name                 text,
  notes                text,
  shipment_date        date,
  actual_shipment_date date,
  unique (order_id, shipment_no)
);
create index if not exists idx_order_shipments_order on public.order_shipments(order_id);

-- ============================================================================
-- EK MALİYETLER (palet, navlun, vs.)
-- ============================================================================
create table if not exists public.order_additional_costs (
  id          uuid primary key default uuid_generate_v4(),
  legacy_id   text unique,
  order_id    uuid not null references public.orders(id) on delete cascade,
  description text not null,
  amount      numeric(14,2) not null default 0
);
create index if not exists idx_order_additional_costs_order on public.order_additional_costs(order_id);

-- ============================================================================
-- ÖDEME PLANI (planlanan ödeme kalemleri)
-- ============================================================================
create table if not exists public.payment_plan_items (
  id               uuid primary key default uuid_generate_v4(),
  legacy_id        text unique,
  order_id         uuid not null references public.orders(id) on delete cascade,
  type             payment_plan_type not null,
  amount           numeric(14,2) not null default 0,
  percentage       numeric(8,4),
  due_date         date,
  method           text not null default 'bank_transfer',
  notes            text,
  shipment_no      integer,
  prepayment_basis text,
  sort_order       integer not null default 0
);
create index if not exists idx_payment_plan_order on public.payment_plan_items(order_id);
create index if not exists idx_payment_plan_type  on public.payment_plan_items(type);

-- ============================================================================
-- ÖDEMELER (gerçekleşen para hareketleri)
-- ============================================================================
create table if not exists public.payments (
  id                       uuid primary key default uuid_generate_v4(),
  legacy_id                text unique,
  order_id                 uuid not null references public.orders(id) on delete cascade,
  plan_item_id             uuid references public.payment_plan_items(id) on delete set null,
  type                     text,
  amount                   numeric(14,2) not null,
  currency                 char(3) not null,
  method                   text not null default 'bank_transfer',
  status                   export_payment_status not null,
  due_date                 date,
  paid_date                date,
  bank_account_id          uuid references public.bank_accounts(id) on delete set null,
  reference_number         text,
  exchange_rate_at_payment numeric(20,10),
  shipment_no              integer,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists idx_payments_order     on public.payments(order_id);
create index if not exists idx_payments_plan_item on public.payments(plan_item_id) where plan_item_id is not null;
create index if not exists idx_payments_status    on public.payments(status);
create index if not exists idx_payments_due_date  on public.payments(due_date);
create index if not exists idx_payments_paid_date on public.payments(paid_date) where paid_date is not null;

-- ============================================================================
-- RAPOR VIEW'LARI (uygulama kullanmıyor; SQL sorguları için pratik)
-- ============================================================================
create or replace view public.v_customer_balances as
select
  c.id   as customer_id,
  c.code,
  c.name,
  c.default_currency,
  coalesce(sum(case when p.status='paid'    then p.amount else 0 end), 0) as paid_total,
  coalesce(sum(case when p.status='pending' then p.amount else 0 end), 0) as open_total,
  coalesce(sum(case when p.status='pending' and p.due_date < current_date
                    then p.amount else 0 end), 0)                          as overdue_total
from public.customers c
left join public.orders   o on o.customer_id = c.id and o.deleted_at is null
left join public.payments p on p.order_id    = o.id
where c.deleted_at is null
group by c.id, c.code, c.name, c.default_currency;

create or replace view public.v_order_totals as
select
  o.id           as order_id,
  o.order_number,
  o.customer_id,
  o.currency,
  o.status,
  coalesce(sum(oi.quantity * oi.unit_price * (1 - oi.discount/100.0)), 0)
    - coalesce(o.discount_value, 0)                                as gross_total,
  (select count(*) from public.order_items i where i.order_id = o.id) as item_count
from public.orders o
left join public.order_items oi on oi.order_id = o.id
where o.deleted_at is null
group by o.id;

-- ============================================================================
-- TRIGGER: updated_at otomatik güncelle (tüm updated_at'li tablolar)
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'profiles','app_settings','exchange_rates','bank_accounts','customers',
      'products','orders','payments'
    ])
  loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ============================================================================
-- TRIGGER: yeni auth kullanıcısı → profiles satırı (rol user metadata'dan)
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare r user_role;
begin
  r := coalesce((new.raw_user_meta_data->>'role')::user_role, 'employee');
  insert into public.profiles (id, full_name, role, can_edit)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    r,
    (r = 'admin')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- RLS — paylaşımlı model: tüm giriş yapmış kullanıcılar aynı veriyi görür/yazar
-- ============================================================================
alter table public.profiles               enable row level security;
alter table public.app_settings           enable row level security;
alter table public.exchange_rates         enable row level security;
alter table public.bank_accounts          enable row level security;
alter table public.customers              enable row level security;
alter table public.products               enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;
alter table public.order_shipments        enable row level security;
alter table public.order_additional_costs enable row level security;
alter table public.payment_plan_items     enable row level security;
alter table public.payments               enable row level security;

-- profiles: herkes okur, kendi satırını günceller
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Operasyonel tablolar: authenticated tam yetki
do $$
declare tbl text;
begin
  for tbl in
    select unnest(array[
      'app_settings','exchange_rates','bank_accounts','customers','products',
      'orders','order_items','order_shipments','order_additional_costs',
      'payment_plan_items','payments'
    ])
  loop
    execute format('drop policy if exists "%1$s_select" on public.%1$s', tbl);
    execute format('drop policy if exists "%1$s_insert" on public.%1$s', tbl);
    execute format('drop policy if exists "%1$s_update" on public.%1$s', tbl);
    execute format('drop policy if exists "%1$s_delete" on public.%1$s', tbl);
    execute format('create policy "%1$s_select" on public.%1$s for select to authenticated using (true)', tbl);
    execute format('create policy "%1$s_insert" on public.%1$s for insert to authenticated with check (true)', tbl);
    execute format('create policy "%1$s_update" on public.%1$s for update to authenticated using (true) with check (true)', tbl);
    execute format('create policy "%1$s_delete" on public.%1$s for delete to authenticated using (true)', tbl);
  end loop;
end $$;

-- ============================================================================
-- Bitti. Sonraki adım: bir admin kullanıcı oluştur
--   Authentication → Users → Add user
--   Raw User Meta Data: {"role":"admin"}
-- Ardından (veri taşıma fazında) 0002_data_migration.sql çalıştırılır.
-- ============================================================================
