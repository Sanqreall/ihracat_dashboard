-- ============================================================================
-- YONGA ERP — INITIAL SCHEMA
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Safe to re-run: guarded with IF NOT EXISTS / DROP ... IF EXISTS where useful.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================
do $$ begin
  create type user_role as enum ('admin', 'manager', 'employee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type product_status as enum ('active', 'passive', 'discontinued');
exception when duplicate_object then null; end $$;

do $$ begin
  create type movement_type as enum ('purchase', 'production', 'sale', 'return', 'adjustment', 'manual', 'transfer', 'cancellation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('draft', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('unpaid', 'partial', 'paid', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shipment_status as enum ('pending', 'preparing', 'shipped', 'delivered', 'returned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type production_status as enum ('queued', 'in_production', 'completed', 'transferred', 'cancelled');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- PROFILES (extends auth.users)
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'employee',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- SETTINGS (single-row company config)
-- ============================================================================
create table if not exists public.company_settings (
  id uuid primary key default uuid_generate_v4(),
  company_name text not null default 'Yonga',
  default_currency text not null default 'TRY',
  default_tax_rate numeric(5,2) not null default 20.00,
  shipping_price_per_desi numeric(10,2) not null default 0,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.series (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.platforms (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  commission_rate numeric(5,2) default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.expense_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- PRODUCTS
-- ============================================================================
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  product_code text not null unique,
  barcode text,
  name text not null,
  series_id uuid references public.series(id),
  category_id uuid references public.categories(id),
  brand text,
  description text,
  status product_status not null default 'active',
  sales_price numeric(12,2) not null default 0,
  cost_price numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 20.00,
  weight_kg numeric(10,3) default 0,
  volume_m3 numeric(10,4) default 0,
  desi numeric(10,2) default 0,
  shipping_class text,
  critical_stock int not null default 0,
  forecast_stock int not null default 0,
  current_stock int not null default 0,
  production_stock int not null default 0,
  reserved_stock int not null default 0,
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_products_status on public.products(status) where deleted_at is null;
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_series on public.products(series_id);
create index if not exists idx_products_code on public.products(product_code);

-- available_stock is a computed convenience column
create or replace view public.products_with_available_stock as
  select *, (current_stock + production_stock - reserved_stock) as available_stock
  from public.products
  where deleted_at is null;

create table if not exists public.product_images (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- INVENTORY MOVEMENTS (ledger — append only, source of truth for stock)
-- ============================================================================
create table if not exists public.stock_movements (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id),
  movement_type movement_type not null,
  quantity int not null, -- positive = in, negative = out
  unit_cost numeric(12,2),
  reference_type text, -- 'order', 'return', 'production', 'manual'
  reference_id uuid,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_movements_product on public.stock_movements(product_id);
create index if not exists idx_stock_movements_reference on public.stock_movements(reference_type, reference_id);

-- ============================================================================
-- PRODUCTION
-- ============================================================================
create table if not exists public.production_batches (
  id uuid primary key default uuid_generate_v4(),
  batch_number text not null unique,
  product_id uuid not null references public.products(id),
  planned_quantity int not null,
  completed_quantity int not null default 0,
  status production_status not null default 'queued',
  production_cost numeric(12,2) default 0,
  notes text,
  started_at date,
  completed_at date,
  transferred_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_production_status on public.production_batches(status);

-- ============================================================================
-- CUSTOMERS
-- ============================================================================
create table if not exists public.customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  company text,
  phone text,
  email text,
  tax_number text,
  billing_address text,
  shipping_address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_customers_name on public.customers(name);

-- ============================================================================
-- ORDERS
-- ============================================================================
create table if not exists public.orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text not null unique,
  order_date date not null default current_date,
  platform_id uuid references public.platforms(id),
  customer_id uuid references public.customers(id),
  billing_address text,
  shipping_address text,
  order_discount_percent numeric(5,2) default 0,
  order_discount_amount numeric(12,2) default 0,
  shipping_cost numeric(12,2) default 0,
  shipping_override boolean not null default false,
  tax_amount numeric(12,2) default 0,
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  net_total numeric(12,2) not null default 0,
  status order_status not null default 'draft',
  payment_status payment_status not null default 'unpaid',
  shipment_status shipment_status not null default 'pending',
  invoice_number text,
  tracking_number text,
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_orders_platform on public.orders(platform_id);
create index if not exists idx_orders_customer on public.orders(customer_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_date on public.orders(order_date);

create table if not exists public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity int not null,
  unit_price numeric(12,2) not null,
  line_discount_percent numeric(5,2) default 0,
  line_discount_amount numeric(12,2) default 0,
  tax_rate numeric(5,2) default 20.00,
  line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_product on public.order_items(product_id);

-- ============================================================================
-- RETURNS
-- ============================================================================
create table if not exists public.returns (
  id uuid primary key default uuid_generate_v4(),
  return_number text not null unique,
  return_date date not null default current_date,
  order_id uuid references public.orders(id),
  customer_id uuid references public.customers(id),
  platform_id uuid references public.platforms(id),
  reason text,
  refund_amount numeric(12,2) default 0,
  transferred_to_inventory boolean not null default false,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.return_items (
  id uuid primary key default uuid_generate_v4(),
  return_id uuid not null references public.returns(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity int not null,
  unit_price numeric(12,2),
  created_at timestamptz not null default now()
);

create index if not exists idx_returns_order on public.returns(order_id);

-- ============================================================================
-- EXPENSES
-- ============================================================================
create table if not exists public.expenses (
  id uuid primary key default uuid_generate_v4(),
  expense_date date not null default current_date,
  category_id uuid references public.expense_categories(id),
  description text,
  amount numeric(12,2) not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_date on public.expenses(expense_date);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  table_name text not null,
  record_id uuid,
  action text not null, -- insert/update/delete
  changed_by uuid references public.profiles(id),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- TRIGGERS: updated_at maintenance
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['products','orders','customers','production_batches','profiles','company_settings'] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ============================================================================
-- TRIGGER: stock_movements -> auto-adjust products.current_stock
-- Keeps current_stock in sync whenever a ledger row is inserted.
-- production movements adjust production_stock instead.
-- ============================================================================
create or replace function public.apply_stock_movement()
returns trigger language plpgsql as $$
begin
  if new.movement_type = 'production' then
    update public.products
      set production_stock = production_stock + new.quantity
      where id = new.product_id;
  else
    update public.products
      set current_stock = current_stock + new.quantity
      where id = new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_stock_movement on public.stock_movements;
create trigger trg_apply_stock_movement
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- ============================================================================
-- FUNCTION: new user -> profile row (called from a Supabase Auth webhook/trigger)
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'employee');
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- All authenticated users can read/write shared operational data.
-- Only admins can manage other users' profiles/roles.
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.categories enable row level security;
alter table public.series enable row level security;
alter table public.platforms enable row level security;
alter table public.expense_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.stock_movements enable row level security;
alter table public.production_batches enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.returns enable row level security;
alter table public.return_items enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: everyone can read all profiles; users can update their own; admins update any
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles for select to authenticated using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- generic shared read/write policy applied to every operational table
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'company_settings','categories','series','platforms','expense_categories',
    'products','product_images','stock_movements','production_batches',
    'customers','orders','order_items','returns','return_items','expenses'
  ] loop
    execute format('drop policy if exists "%1$s_select" on public.%1$s', tbl);
    execute format('create policy "%1$s_select" on public.%1$s for select to authenticated using (true)', tbl);
    execute format('drop policy if exists "%1$s_insert" on public.%1$s', tbl);
    execute format('create policy "%1$s_insert" on public.%1$s for insert to authenticated with check (true)', tbl);
    execute format('drop policy if exists "%1$s_update" on public.%1$s', tbl);
    execute format('create policy "%1$s_update" on public.%1$s for update to authenticated using (true)', tbl);
    execute format('drop policy if exists "%1$s_delete" on public.%1$s', tbl);
    execute format('create policy "%1$s_delete" on public.%1$s for delete to authenticated using (true)', tbl);
  end loop;
end $$;

-- audit_logs: read-only for authenticated users, writes happen via security-definer functions only
drop policy if exists "audit_logs_select" on public.audit_logs;
create policy "audit_logs_select" on public.audit_logs for select to authenticated using (true);

-- ============================================================================
-- DONE. Next: run supabase/seed/0001_seed.sql for starter data.
-- ============================================================================
