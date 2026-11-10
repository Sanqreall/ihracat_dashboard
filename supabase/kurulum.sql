-- ============================================================================
-- İHRACAT YÖNETİM SİSTEMİ · v4 · VERİTABANI KURULUMU
-- ============================================================================
-- YENİ ve BOŞ bir Supabase projesinde, SQL Editor'de BİR KEZ çalıştır.
-- Bu dosya hiçbir tabloyu SİLMEZ (DROP TABLE yok). Tekrar çalıştırılırsa
-- "already exists" hatası verir ve durur — verine dokunmaz.
--
-- Temel kurallar:
--  • Ödemeler tablosunda SADECE gerçekten gelen para (tahsilat) tutulur.
--    "Bekleyen" tutar kayıt değildir: plan tutarı − tahsil edilen olarak hesaplanır.
--  • Tahsilatlar plan kalemlerine otomatik dağıtılır (en eski vadeden başlayarak).
--    İstenirse bir tahsilat belirli bir plan kalemine sabitlenebilir.
--  • Plan değişse/silinse bile tahsilat kaybolmaz; kalan kalemlere yeniden dağılır.
--  • Tüm hesaplar (toplam, KDV, iskonto, kalan, gecikme) bu dosyadaki view'larda.
--  • Yetki: admin / editor / viewer — veritabanında zorunlu (RLS).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 0. YARDIMCI FONKSİYONLAR
-- ----------------------------------------------------------------------------
-- Türkiye saatine göre bugün (UTC değil)
create function public.tr_today() returns date
language sql stable as $$ select (now() at time zone 'Europe/Istanbul')::date $$;

create function public.new_id() returns text
language sql volatile as $$ select replace(gen_random_uuid()::text, '-', '') $$;

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- 1. KULLANICILAR & ROLLER
-- ----------------------------------------------------------------------------
-- Rol kullanıcının kendi değiştirebildiği metadata'da DEĞİL, bu tabloda tutulur.
-- Sadece admin rol değiştirebilir.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'pending' check (role in ('admin','editor','viewer','pending')),
  created_at  timestamptz not null default now()
);

create function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.can_view() returns boolean
language sql stable as $$ select coalesce(public.app_role() in ('admin','editor','viewer'), false) $$;

create function public.can_edit() returns boolean
language sql stable as $$ select coalesce(public.app_role() in ('admin','editor'), false) $$;

create function public.is_admin() returns boolean
language sql stable as $$ select coalesce(public.app_role() = 'admin', false) $$;

-- Yeni kullanıcı eklenince profil aç. İlk kullanıcı otomatik admin olur,
-- sonrakiler 'pending' (onay bekliyor) başlar ve HİÇBİR veriyi göremez;
-- admin Kullanıcılar ekranından rol verir.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles) then 'pending' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Kurulumdan önce eklenmiş kullanıcılar varsa onlara da profil aç
insert into public.profiles (id, email, full_name, role)
select u.id, u.email,
       coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
       case when row_number() over (order by u.created_at) = 1 then 'admin' else 'pending' end
from auth.users u
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. AYARLAR
-- ----------------------------------------------------------------------------
create table public.app_settings (
  key         text primary key,
  value       jsonb,
  updated_at  timestamptz not null default now()
);
create trigger trg_app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();

insert into public.app_settings (key, value) values
  ('migration_locked', 'false'::jsonb),
  ('default_payment_terms', '30'::jsonb);

-- ----------------------------------------------------------------------------
-- 3. DÖVİZ KURLARI — günlük geçmiş tutulur (USD bazlı: 1 birim = X USD)
-- ----------------------------------------------------------------------------
create table public.exchange_rates (
  rate_date    date          not null,
  currency     char(3)       not null,
  rate_to_usd  numeric(20,10) not null check (rate_to_usd > 0),
  source       text,
  created_at   timestamptz   not null default now(),
  primary key (rate_date, currency)
);

-- Belirli bir tarihteki kur (o gün yoksa öncesindeki en yakın; hiç yoksa en eski)
create function public.rate_on(p_currency text, p_date date) returns numeric
language sql stable as $$
  select case
    when upper(p_currency) = 'USD' then 1::numeric
    else coalesce(
      (select rate_to_usd from public.exchange_rates
        where currency = upper(p_currency) and rate_date <= coalesce(p_date, public.tr_today())
        order by rate_date desc limit 1),
      (select rate_to_usd from public.exchange_rates
        where currency = upper(p_currency)
        order by rate_date asc limit 1)
    )
  end
$$;

create view public.v_latest_rates with (security_invoker = on) as
select distinct on (currency) currency, rate_to_usd, rate_date, source
from public.exchange_rates
order by currency, rate_date desc;

-- ----------------------------------------------------------------------------
-- 4. BANKA HESAPLARI
-- ----------------------------------------------------------------------------
create table public.bank_accounts (
  id              text primary key default public.new_id(),
  name            text not null,
  bank_name       text,
  account_number  text,
  iban            text,
  swift           text,
  currency        char(3) not null default 'USD',
  notes           text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_bank_accounts_touch before update on public.bank_accounts
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 5. MÜŞTERİLER
-- ----------------------------------------------------------------------------
create table public.customers (
  id                        text primary key default public.new_id(),
  code                      text,
  name                      text not null,
  contact_person            text,
  email                     text,
  phone                     text,
  address                   text,
  country                   text,
  tax_number                text,
  notes                     text,
  credit_limit              numeric(14,2) not null default 0,
  default_currency          char(3)       not null default 'USD',
  preferred_incoterm        text,
  payment_terms_days        integer       not null default 30 check (payment_terms_days >= 0),
  default_payment_method    text          not null default 'bank_transfer',
  default_prepayment_pct    numeric(5,2)  not null default 0,
  default_pre_shipment_pct  numeric(5,2)  not null default 0,
  default_deferred_pct      numeric(5,2)  not null default 100,
  is_active                 boolean       not null default true,
  created_at                timestamptz   not null default now(),
  updated_at                timestamptz   not null default now()
);
create index idx_customers_code on public.customers(code);
create index idx_customers_name on public.customers(lower(name));
create trigger trg_customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 6. ÜRÜNLER
-- ----------------------------------------------------------------------------
create table public.products (
  id                  text primary key default public.new_id(),
  product_code        text,
  manufacturing_code  text,
  name_tr             text,
  name_en             text,
  unit                text           not null default 'adet',
  category            text,
  notes               text,
  default_price       numeric(14,4)  not null default 0,
  default_currency    char(3)        not null default 'USD',
  packages            jsonb          not null default '[]'::jsonb,
  is_active           boolean        not null default true,
  created_at          timestamptz    not null default now(),
  updated_at          timestamptz    not null default now()
);
create index idx_products_code on public.products(product_code);
create trigger trg_products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 7. SİPARİŞLER
-- ----------------------------------------------------------------------------
create table public.orders (
  id                  text primary key default public.new_id(),
  order_number        text not null unique,
  customer_id         text not null references public.customers(id) on delete restrict,
  status              text not null default 'draft'
    check (status in ('draft','confirmed','production','ready','shipped','delivered','completed','cancelled')),
  currency            char(3)        not null default 'USD',
  order_date          date           not null default public.tr_today(),
  incoterm            text,
  shipping_method     text,
  port_of_loading     text,
  port_of_discharge   text,
  bill_of_lading      text,
  invoice_number      text,
  notes               text,
  vat_rate            numeric(5,2)   not null default 0 check (vat_rate >= 0),
  discount_type       text           not null default 'none' check (discount_type in ('none','percentage','amount')),
  discount_value      numeric(14,2)  not null default 0 check (discount_value >= 0),
  payment_basis       text           not null default 'order' check (payment_basis in ('order','shipment')),
  plan_template       jsonb,
  created_by          uuid default auth.uid(),
  created_at          timestamptz    not null default now(),
  updated_at          timestamptz    not null default now()
);
create index idx_orders_customer   on public.orders(customer_id);
create index idx_orders_status     on public.orders(status);
create index idx_orders_order_date on public.orders(order_date);
create trigger trg_orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- Sevkiyatlar — her siparişin EN AZ 1 sevkiyatı vardır (tek sevkiyat = 1 numara).
-- Fiili sevk tarihi girilince o günün kuru otomatik kilitlenir.
create table public.order_shipments (
  id                  text primary key default public.new_id(),
  order_id            text not null references public.orders(id) on delete cascade,
  shipment_no         integer not null check (shipment_no >= 1),
  name                text,
  planned_date        date,
  actual_date         date,
  locked_rate_to_usd  numeric(20,10) check (locked_rate_to_usd is null or locked_rate_to_usd > 0),
  locked_at           date,
  notes               text,
  unique (order_id, shipment_no)
);
create index idx_order_shipments_order on public.order_shipments(order_id);

create table public.order_items (
  id                  text primary key default public.new_id(),
  order_id            text not null references public.orders(id) on delete cascade,
  shipment_no         integer not null default 1,
  product_id          text references public.products(id) on delete set null,
  product_code        text,
  manufacturing_code  text,
  name_tr             text,
  name_en             text,
  unit                text           not null default 'adet',
  quantity            numeric(14,3)  not null default 0 check (quantity >= 0),
  unit_price          numeric(14,4)  not null default 0 check (unit_price >= 0),
  discount_pct        numeric(5,2)   not null default 0 check (discount_pct between 0 and 100),
  sort_order          integer        not null default 0,
  foreign key (order_id, shipment_no) references public.order_shipments(order_id, shipment_no)
    on update cascade on delete no action deferrable initially deferred
);
create index idx_order_items_order   on public.order_items(order_id);
create index idx_order_items_product on public.order_items(product_id);

-- Ek maliyetler (palet, navlun, sigorta…) — kendi KDV oranıyla
create table public.order_costs (
  id           text primary key default public.new_id(),
  order_id     text not null references public.orders(id) on delete cascade,
  shipment_no  integer,
  description  text not null default '',
  amount       numeric(14,2) not null default 0 check (amount >= 0),
  vat_rate     numeric(5,2)  not null default 0 check (vat_rate >= 0),
  sort_order   integer       not null default 0,
  foreign key (order_id, shipment_no) references public.order_shipments(order_id, shipment_no)
    on update cascade on delete no action deferrable initially deferred
);
create index idx_order_costs_order on public.order_costs(order_id);

-- Ödeme planı — NE ZAMAN ne kadar beklendiği. Tahsilat DEĞİLDİR.
create table public.plan_items (
  id           text primary key default public.new_id(),
  order_id     text not null references public.orders(id) on delete cascade,
  type         text not null check (type in ('prepayment','preShipment','deferred','vat','cost','other')),
  shipment_no  integer,
  cost_id      text references public.order_costs(id) on delete set null,
  percentage   numeric(9,4),
  amount       numeric(14,2) not null default 0 check (amount >= 0),
  due_date     date,
  method       text not null default 'bank_transfer',
  notes        text,
  sort_order   integer not null default 0,
  foreign key (order_id, shipment_no) references public.order_shipments(order_id, shipment_no)
    on update cascade on delete no action deferrable initially deferred
);
create index idx_plan_items_order on public.plan_items(order_id);
create index idx_plan_items_due   on public.plan_items(due_date);

-- ----------------------------------------------------------------------------
-- 8. TAHSİLATLAR — sadece gerçekten gelen para
-- ----------------------------------------------------------------------------
-- amount: sipariş para birimi cinsinden (plana karşı sayılan tutar)
-- received_currency / received_amount: hesaba fiilen giren (farklı dövizle ödendiyse)
-- rate_to_usd: tahsilat günü sipariş dövizinin USD kuru (raporlar bu kurla)
-- plan_item_id: boşsa otomatik dağıtılır; doluysa önce o kaleme sayılır.
create table public.collections (
  id                 text primary key default public.new_id(),
  order_id           text not null references public.orders(id) on delete restrict,
  plan_item_id       text references public.plan_items(id) on delete set null,
  received_date      date not null,
  amount             numeric(14,2) not null check (amount > 0),
  received_currency  char(3),
  received_amount    numeric(14,2),
  rate_to_usd        numeric(20,10) check (rate_to_usd is null or rate_to_usd > 0),
  bank_account_id    text references public.bank_accounts(id) on delete restrict,
  method             text not null default 'bank_transfer',
  reference          text,
  notes              text,
  created_by         uuid default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_collections_order on public.collections(order_id);
create index idx_collections_date  on public.collections(received_date);
create index idx_collections_bank  on public.collections(bank_account_id);
create trigger trg_collections_touch before update on public.collections
  for each row execute function public.touch_updated_at();

-- Tahsilat tutarlılık kontrolü + eksik alanları doldur
create function public.collections_before_write() returns trigger
language plpgsql as $$
declare v_cur text;
begin
  select currency into v_cur from public.orders where id = new.order_id;
  if new.plan_item_id is not null and not exists (
    select 1 from public.plan_items where id = new.plan_item_id and order_id = new.order_id
  ) then
    new.plan_item_id := null;  -- başka siparişin kalemine bağlanamaz → otomatik dağıtıma düşer
  end if;
  if new.received_currency is null then new.received_currency := v_cur; end if;
  if new.received_amount  is null then new.received_amount  := new.amount; end if;
  if new.rate_to_usd is null
     or (tg_op = 'UPDATE' and (new.received_date is distinct from old.received_date
                               or new.order_id is distinct from old.order_id)
         and new.rate_to_usd is not distinct from old.rate_to_usd) then
    new.rate_to_usd := public.rate_on(v_cur, new.received_date);
  end if;
  return new;
end $$;
create trigger trg_collections_before before insert or update on public.collections
  for each row execute function public.collections_before_write();

-- ----------------------------------------------------------------------------
-- 9. MÜŞTERİ NOTLARI (Takip ekranı)
-- ----------------------------------------------------------------------------
create table public.customer_notes (
  id           text primary key default public.new_id(),
  customer_id  text not null references public.customers(id) on delete cascade,
  text         text not null,
  done         boolean not null default false,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_customer_notes_customer on public.customer_notes(customer_id);
create trigger trg_customer_notes_touch before update on public.customer_notes
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 10. KUR KİLİDİ — fiili sevk tarihinde kur kilitlenir
-- ----------------------------------------------------------------------------
create function public.shipments_lock_rate() returns trigger
language plpgsql as $$
declare v_cur text;
begin
  select currency into v_cur from public.orders where id = new.order_id;
  if tg_op = 'INSERT' then
    if new.actual_date is not null and new.locked_rate_to_usd is null then
      new.locked_rate_to_usd := public.rate_on(v_cur, new.actual_date);
      new.locked_at := new.actual_date;
    end if;
  else
    if new.actual_date is distinct from old.actual_date
       and new.locked_rate_to_usd is not distinct from old.locked_rate_to_usd then
      if new.actual_date is null then
        new.locked_rate_to_usd := null; new.locked_at := null;
      else
        new.locked_rate_to_usd := public.rate_on(v_cur, new.actual_date);
        new.locked_at := new.actual_date;
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger trg_shipments_lock_rate before insert or update on public.order_shipments
  for each row execute function public.shipments_lock_rate();

-- Sipariş dövizi değişirse kilitli kurları yeni dövize göre yeniden hesapla
create function public.orders_currency_changed() returns trigger
language plpgsql as $$
begin
  if new.currency is distinct from old.currency then
    update public.order_shipments s
       set locked_rate_to_usd = case when s.actual_date is null then null
                                     else public.rate_on(new.currency, s.actual_date) end,
           locked_at = s.actual_date
     where s.order_id = new.id;
    update public.collections c
       set rate_to_usd = public.rate_on(new.currency, c.received_date)
     where c.order_id = new.id;
  end if;
  return new;
end $$;
create trigger trg_orders_currency after update of currency on public.orders
  for each row execute function public.orders_currency_changed();

-- ----------------------------------------------------------------------------
-- 11. KAYIT GEÇMİŞİ (audit) — her değişikliğin eski/yeni hali
-- ----------------------------------------------------------------------------
create table public.audit_log (
  id          bigserial primary key,
  table_name  text not null,
  row_id      text,
  action      text not null,
  old_data    jsonb,
  new_data    jsonb,
  changed_by  uuid default auth.uid(),
  changed_at  timestamptz not null default now()
);
create index idx_audit_row on public.audit_log(table_name, row_id, changed_at desc);

create function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.skip_audit', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  insert into public.audit_log (table_name, row_id, action, old_data, new_data)
  values (
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id', ''),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['customers','products','bank_accounts','orders','order_shipments',
                           'order_items','order_costs','plan_items','collections']
  loop
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$I
                    for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

-- ============================================================================
-- 12. HESAP VIEW'LARI — tüm ekranlar ve raporlar bunları kullanır
-- ============================================================================

-- Sevkiyat bazında mal bedeli (satır iskontosu dahil)
create view public.v_shipment_goods with (security_invoker = on) as
select s.order_id, s.shipment_no, s.id as shipment_id, s.name,
       s.planned_date, s.actual_date, s.locked_rate_to_usd,
       coalesce(sum(i.quantity * i.unit_price * (1 - i.discount_pct / 100)), 0)::numeric as goods_gross
from public.order_shipments s
left join public.order_items i on i.order_id = s.order_id and i.shipment_no = s.shipment_no
group by s.order_id, s.shipment_no, s.id;

-- Sipariş toplamları
create view public.v_order_totals with (security_invoker = on) as
with g as (
  select order_id, sum(goods_gross) as subtotal from public.v_shipment_goods group by order_id
), c as (
  select order_id, sum(amount) as costs, sum(amount * vat_rate / 100) as costs_vat
  from public.order_costs group by order_id
), p as (
  select order_id, sum(amount) as plan_total from public.plan_items group by order_id
), col as (
  select order_id, sum(amount) as collected, sum(amount * coalesce(rate_to_usd, 0)) as collected_usd,
         max(received_date) as last_collection_date
  from public.collections group by order_id
), base as (
  select o.*, coalesce(g.subtotal, 0) as subtotal,
         coalesce(c.costs, 0) as costs, coalesce(c.costs_vat, 0) as costs_vat,
         coalesce(p.plan_total, 0) as plan_total,
         coalesce(col.collected, 0) as collected, coalesce(col.collected_usd, 0) as collected_usd,
         col.last_collection_date
  from public.orders o
  left join g   on g.order_id = o.id
  left join c   on c.order_id = o.id
  left join p   on p.order_id = o.id
  left join col on col.order_id = o.id
), d as (
  select b.*,
    case b.discount_type
      when 'percentage' then b.subtotal * b.discount_value / 100
      when 'amount'     then least(b.discount_value, b.subtotal)
      else 0 end as discount
  from base b
)
select
  d.id as order_id, d.order_number, d.customer_id, d.status, d.currency, d.order_date,
  d.payment_basis, d.vat_rate,
  round(d.subtotal, 2)                                   as subtotal,
  round(d.discount, 2)                                   as discount,
  round(d.subtotal - d.discount, 2)                      as net_goods,
  round((d.subtotal - d.discount) * d.vat_rate / 100, 2) as vat_amount,
  round(d.costs, 2)                                      as costs,
  round(d.costs_vat, 2)                                  as costs_vat,
  round((d.subtotal - d.discount) * (1 + d.vat_rate / 100) + d.costs + d.costs_vat, 2) as total,
  round(d.plan_total, 2)                                 as plan_total,
  round(d.collected, 2)                                  as collected,
  round(d.collected_usd, 2)                              as collected_usd,
  d.last_collection_date
from d;

-- Sevkiyat bazında toplam — sipariş toplamını (iskonto, KDV, ek maliyet dahil)
-- mal bedeli oranında sevkiyatlara dağıtır → sevkiyatların toplamı = sipariş toplamı.
create view public.v_shipment_totals with (security_invoker = on) as
with sg as (
  select g.*, count(*) over (partition by g.order_id) as shipment_count,
         sum(g.goods_gross) over (partition by g.order_id) as order_goods
  from public.v_shipment_goods g
)
select sg.order_id, sg.shipment_no, sg.shipment_id, sg.name, sg.planned_date, sg.actual_date,
       coalesce(sg.actual_date, sg.planned_date) as effective_date,
       sg.locked_rate_to_usd,
       t.order_number, t.customer_id, t.status, t.currency,
       case when sg.order_goods > 0 then sg.goods_gross / sg.order_goods
            else 1.0 / sg.shipment_count end as share,
       round(t.total * case when sg.order_goods > 0 then sg.goods_gross / sg.order_goods
                            else 1.0 / sg.shipment_count end, 2) as total,
       coalesce(sg.locked_rate_to_usd, public.rate_on(t.currency, public.tr_today())) as rate_to_usd,
       round(t.total * case when sg.order_goods > 0 then sg.goods_gross / sg.order_goods
                            else 1.0 / sg.shipment_count end
             * coalesce(sg.locked_rate_to_usd, public.rate_on(t.currency, public.tr_today())), 2) as total_usd
from sg
join public.v_order_totals t on t.order_id = sg.order_id;

-- Plan kalemi durumu — tahsilatların plana dağıtımı (şelale/FIFO)
--  1) Bir kaleme sabitlenmiş tahsilatlar önce o kaleme sayılır.
--  2) Kalan tüm tahsilatlar vadesi en eski kalemden başlayarak dağıtılır.
create view public.v_plan_status with (security_invoker = on) as
with t as (
  select plan_item_id, sum(amount) as targeted
  from public.collections where plan_item_id is not null group by plan_item_id
), base as (
  select pi.*,
         least(coalesce(t.targeted, 0), pi.amount)             as direct_paid,
         greatest(coalesce(t.targeted, 0) - pi.amount, 0)      as overflow,
         greatest(pi.amount - coalesce(t.targeted, 0), 0)      as need
  from public.plan_items pi
  left join t on t.plan_item_id = pi.id
), pool as (
  select o.id as order_id,
         coalesce((select sum(c.amount) from public.collections c
                    where c.order_id = o.id and c.plan_item_id is null), 0)
       + coalesce((select sum(b.overflow) from base b where b.order_id = o.id), 0) as pool
  from public.orders o
), ordered as (
  select b.*, p.pool,
         sum(b.need) over (partition by b.order_id
                           order by b.due_date nulls last, b.sort_order, b.id
                           rows between unbounded preceding and current row) as cum_need
  from base b join pool p on p.order_id = b.order_id
), calc as (
  select x.*,
         round(x.direct_paid + greatest(0, least(x.need, x.pool - (x.cum_need - x.need))), 2) as paid
  from ordered x
)
select calc.id as plan_item_id, calc.order_id, o.order_number, o.customer_id, o.currency,
       o.status as order_status, calc.type, calc.shipment_no, calc.cost_id, calc.percentage,
       calc.amount, calc.due_date, calc.method, calc.notes, calc.sort_order,
       calc.paid,
       round(calc.amount - calc.paid, 2) as remaining,
       case
         when o.status = 'cancelled'                     then 'cancelled'
         when calc.amount - calc.paid <= 0.005           then 'paid'
         when calc.due_date < public.tr_today()          then 'overdue'
         when calc.paid > 0                              then 'partial'
         else 'open'
       end as status,
       case when o.status <> 'cancelled' and calc.amount - calc.paid > 0.005
                 and calc.due_date < public.tr_today()
            then public.tr_today() - calc.due_date else 0 end as days_overdue,
       round((calc.amount - calc.paid) * coalesce(public.rate_on(o.currency, public.tr_today()), 0), 2)
         as remaining_usd
from calc
join public.orders o on o.id = calc.order_id;

-- Sipariş özeti — liste ekranları ve müşteri ekstresi bunu kullanır
create view public.v_order_summary with (security_invoker = on) as
with ps as (
  select order_id,
         sum(paid)                                                      as plan_paid,
         sum(remaining) filter (where status <> 'cancelled')            as open_amount,
         sum(remaining) filter (where status = 'overdue')               as overdue_amount,
         sum(remaining_usd) filter (where status <> 'cancelled')        as open_usd,
         sum(remaining_usd) filter (where status = 'overdue')           as overdue_usd,
         min(due_date) filter (where status in ('open','partial','overdue')) as next_due_date
  from public.v_plan_status group by order_id
), st as (
  select order_id, sum(total_usd) as total_usd,
         min(effective_date) as first_shipment_date, max(effective_date) as last_shipment_date,
         count(*) as shipment_count,
         count(*) filter (where actual_date is not null) as shipped_count
  from public.v_shipment_totals group by order_id
)
select t.*,
       c.name as customer_name, c.code as customer_code, c.country as customer_country,
       coalesce(st.total_usd, 0)                     as total_usd,
       st.first_shipment_date, st.last_shipment_date,
       coalesce(st.shipment_count, 0)                as shipment_count,
       coalesce(st.shipped_count, 0)                 as shipped_count,
       round(t.total - t.plan_total, 2)              as plan_diff,
       coalesce(ps.open_amount, 0)                   as open_amount,
       coalesce(ps.overdue_amount, 0)                as overdue_amount,
       coalesce(ps.open_usd, 0)                      as open_usd,
       coalesce(ps.overdue_usd, 0)                   as overdue_usd,
       ps.next_due_date,
       -- Plana dağıtılamayan fazla tahsilat (avans/alacak)
       round(t.collected - coalesce(ps.plan_paid, 0), 2) as unallocated,
       -- Gerçek borç: iptal siparişte 0 − tahsilat (iade edilecek tutar eksi görünür)
       round(case when t.status = 'cancelled' then 0 else t.total end - t.collected, 2) as balance
from public.v_order_totals t
join public.customers c on c.id = t.customer_id
left join ps on ps.order_id = t.order_id
left join st on st.order_id = t.order_id;

-- Müşteri bakiyeleri — para birimi bazında (farklı dövizler toplanmaz)
create view public.v_customer_balances with (security_invoker = on) as
select s.customer_id, s.currency,
       count(*) filter (where s.status <> 'cancelled')                  as order_count,
       round(sum(s.total) filter (where s.status <> 'cancelled'), 2)    as total,
       round(sum(s.total_usd) filter (where s.status <> 'cancelled'), 2) as total_usd,
       round(sum(s.collected), 2)                                       as collected,
       round(sum(s.balance), 2)                                         as balance,
       round(sum(s.open_amount), 2)                                     as open_amount,
       round(sum(s.overdue_amount), 2)                                  as overdue_amount,
       round(sum(s.open_usd), 2)                                        as open_usd,
       round(sum(s.overdue_usd), 2)                                     as overdue_usd,
       max(s.last_collection_date)                                      as last_collection_date
from public.v_order_summary s
group by s.customer_id, s.currency;

-- Tahsilat listesi (sipariş/müşteri/banka bilgisiyle)
create view public.v_collections with (security_invoker = on) as
select c.*, o.order_number, o.currency as order_currency, o.customer_id,
       cu.name as customer_name, cu.code as customer_code,
       b.name as bank_account_name,
       round(c.amount * coalesce(c.rate_to_usd, 0), 2) as amount_usd,
       pi.type as plan_item_type
from public.collections c
join public.orders o     on o.id = c.order_id
join public.customers cu on cu.id = o.customer_id
left join public.bank_accounts b on b.id = c.bank_account_id
left join public.plan_items pi   on pi.id = c.plan_item_id;

-- ============================================================================
-- 13. SİPARİŞ KAYDI — tek işlemde (ya hepsi ya hiçbiri)
-- ============================================================================
create function public.next_order_number(p_year integer default null) returns text
language sql stable as $$
  with yy as (select coalesce(p_year, extract(year from public.tr_today())::int)::text as y)
  select 'SP-' || yy.y || '-' || lpad((coalesce((
           select max(nullif(regexp_replace(o.order_number, '^SP-' || yy.y || '-(\d+).*$', '\1'),
                             o.order_number)::bigint)
           from public.orders o where o.order_number like 'SP-' || yy.y || '-%'
         ), 0) + 1)::text, 4, '0')
  from yy
$$;

-- p = { order:{...}, shipments:[...], items:[...], costs:[...], plan:[...] }
-- order.updated_at gönderilirse ve DB'deki farklıysa (başkası değiştirmiş) hata verir.
create function public.save_order(p jsonb) returns text
language plpgsql security invoker set search_path = public as $$
declare
  o        jsonb := p->'order';
  v_id     text  := nullif(o->>'id', '');
  v_num    text  := nullif(trim(o->>'order_number'), '');
  v_cur_upd timestamptz;
  v_ship_nos int[];
begin
  if not public.can_edit() then
    raise exception 'Yetkiniz yok: sipariş kaydetmek için editör/admin olmalısınız';
  end if;

  if v_id is not null then
    select updated_at into v_cur_upd from public.orders where id = v_id for update;
    if found and nullif(o->>'updated_at', '') is not null
       and date_trunc('milliseconds', v_cur_upd) <> date_trunc('milliseconds', (o->>'updated_at')::timestamptz) then
      raise exception 'Bu sipariş siz düzenlerken başka biri tarafından değiştirildi. Sayfayı yenileyip tekrar deneyin.';
    end if;
  else
    v_id := public.new_id();
  end if;
  if v_num is null then v_num := public.next_order_number(); end if;

  insert into public.orders as t (id, order_number, customer_id, status, currency, order_date, incoterm,
      shipping_method, port_of_loading, port_of_discharge, bill_of_lading, invoice_number, notes,
      vat_rate, discount_type, discount_value, payment_basis, plan_template)
  values (v_id, v_num, o->>'customer_id', coalesce(nullif(o->>'status',''), 'draft'),
      upper(coalesce(nullif(o->>'currency',''), 'USD')),
      coalesce(nullif(o->>'order_date','')::date, public.tr_today()),
      nullif(o->>'incoterm',''), nullif(o->>'shipping_method',''), nullif(o->>'port_of_loading',''),
      nullif(o->>'port_of_discharge',''), nullif(o->>'bill_of_lading',''), nullif(o->>'invoice_number',''),
      nullif(o->>'notes',''), coalesce(nullif(o->>'vat_rate','')::numeric, 0),
      coalesce(nullif(o->>'discount_type',''), 'none'), coalesce(nullif(o->>'discount_value','')::numeric, 0),
      coalesce(nullif(o->>'payment_basis',''), 'order'),
      case when jsonb_typeof(o->'plan_template') = 'object' then o->'plan_template' end)
  on conflict (id) do update set
      order_number = excluded.order_number, customer_id = excluded.customer_id, status = excluded.status,
      currency = excluded.currency, order_date = excluded.order_date, incoterm = excluded.incoterm,
      shipping_method = excluded.shipping_method, port_of_loading = excluded.port_of_loading,
      port_of_discharge = excluded.port_of_discharge, bill_of_lading = excluded.bill_of_lading,
      invoice_number = excluded.invoice_number, notes = excluded.notes, vat_rate = excluded.vat_rate,
      discount_type = excluded.discount_type, discount_value = excluded.discount_value,
      payment_basis = excluded.payment_basis, plan_template = excluded.plan_template;

  -- SEVKİYATLAR — gönderildiyse listeyle hizala; siparişin en az 1 sevkiyatı olur
  if p ? 'shipments' and jsonb_typeof(p->'shipments') = 'array' and jsonb_array_length(p->'shipments') > 0 then
    if (select count(distinct (s->>'shipment_no')::int) from jsonb_array_elements(p->'shipments') s)
       <> jsonb_array_length(p->'shipments') then
      raise exception 'Aynı sevkiyat numarası iki kez kullanılmış';
    end if;

    -- Listede olmayan sevkiyatları sil (numaraları yeni sevkiyatlara serbest kalsın).
    -- Kalem/plan bağları işlem sonunda kontrol edilir (deferred FK).
    delete from public.order_shipments
     where order_id = v_id
       and id not in (select nullif(s->>'id','') from jsonb_array_elements(p->'shipments') s
                       where nullif(s->>'id','') is not null);

    insert into public.order_shipments as t (id, order_id, shipment_no, name, planned_date, actual_date, notes)
    select coalesce(nullif(s->>'id',''), public.new_id()), v_id, (s->>'shipment_no')::int,
           nullif(s->>'name',''), nullif(s->>'planned_date','')::date, nullif(s->>'actual_date','')::date,
           nullif(s->>'notes','')
    from jsonb_array_elements(p->'shipments') s
    on conflict (id) do update set
           shipment_no = excluded.shipment_no, name = excluded.name, planned_date = excluded.planned_date,
           actual_date = excluded.actual_date, notes = excluded.notes
    where t.order_id = v_id;
  end if;
  if not exists (select 1 from public.order_shipments where order_id = v_id) then
    insert into public.order_shipments (order_id, shipment_no) values (v_id, 1);
  end if;
  select array_agg(shipment_no) into v_ship_nos from public.order_shipments where order_id = v_id;

  -- KALEMLER
  if p ? 'items' and jsonb_typeof(p->'items') = 'array' then
    delete from public.order_items
     where order_id = v_id
       and id not in (select nullif(x->>'id','') from jsonb_array_elements(p->'items') x
                       where nullif(x->>'id','') is not null);
    insert into public.order_items as t (id, order_id, shipment_no, product_id, product_code, manufacturing_code,
           name_tr, name_en, unit, quantity, unit_price, discount_pct, sort_order)
    select coalesce(nullif(x->>'id',''), public.new_id()), v_id,
           coalesce(nullif(x->>'shipment_no','')::int, 1),
           case when exists (select 1 from public.products pr where pr.id = x->>'product_id') then x->>'product_id' end,
           nullif(x->>'product_code',''), nullif(x->>'manufacturing_code',''),
           nullif(x->>'name_tr',''), nullif(x->>'name_en',''), coalesce(nullif(x->>'unit',''), 'adet'),
           coalesce(nullif(x->>'quantity','')::numeric, 0), coalesce(nullif(x->>'unit_price','')::numeric, 0),
           coalesce(nullif(x->>'discount_pct','')::numeric, 0), (ord - 1)::int
    from jsonb_array_elements(p->'items') with ordinality as e(x, ord)
    on conflict (id) do update set
           shipment_no = excluded.shipment_no, product_id = excluded.product_id,
           product_code = excluded.product_code, manufacturing_code = excluded.manufacturing_code,
           name_tr = excluded.name_tr, name_en = excluded.name_en, unit = excluded.unit,
           quantity = excluded.quantity, unit_price = excluded.unit_price,
           discount_pct = excluded.discount_pct, sort_order = excluded.sort_order
    where t.order_id = v_id;
  end if;

  -- EK MALİYETLER
  if p ? 'costs' and jsonb_typeof(p->'costs') = 'array' then
    delete from public.order_costs
     where order_id = v_id
       and id not in (select nullif(x->>'id','') from jsonb_array_elements(p->'costs') x
                       where nullif(x->>'id','') is not null);
    insert into public.order_costs as t (id, order_id, shipment_no, description, amount, vat_rate, sort_order)
    select coalesce(nullif(x->>'id',''), public.new_id()), v_id, nullif(x->>'shipment_no','')::int,
           coalesce(x->>'description',''), coalesce(nullif(x->>'amount','')::numeric, 0),
           coalesce(nullif(x->>'vat_rate','')::numeric, 0), (ord - 1)::int
    from jsonb_array_elements(p->'costs') with ordinality as e(x, ord)
    on conflict (id) do update set
           shipment_no = excluded.shipment_no, description = excluded.description,
           amount = excluded.amount, vat_rate = excluded.vat_rate, sort_order = excluded.sort_order
    where t.order_id = v_id;
  end if;

  -- ÖDEME PLANI (silinen kalemlere sabitlenmiş tahsilatlar otomatik dağıtıma düşer — kaybolmaz)
  if p ? 'plan' and jsonb_typeof(p->'plan') = 'array' then
    delete from public.plan_items
     where order_id = v_id
       and id not in (select nullif(x->>'id','') from jsonb_array_elements(p->'plan') x
                       where nullif(x->>'id','') is not null);
    insert into public.plan_items as t (id, order_id, type, shipment_no, cost_id, percentage, amount,
           due_date, method, notes, sort_order)
    select coalesce(nullif(x->>'id',''), public.new_id()), v_id, x->>'type', nullif(x->>'shipment_no','')::int,
           case when exists (select 1 from public.order_costs oc where oc.id = x->>'cost_id' and oc.order_id = v_id)
                then x->>'cost_id' end,
           nullif(x->>'percentage','')::numeric, round(coalesce(nullif(x->>'amount','')::numeric, 0), 2),
           nullif(x->>'due_date','')::date, coalesce(nullif(x->>'method',''), 'bank_transfer'),
           nullif(x->>'notes',''), (ord - 1)::int
    from jsonb_array_elements(p->'plan') with ordinality as e(x, ord)
    on conflict (id) do update set
           type = excluded.type, shipment_no = excluded.shipment_no, cost_id = excluded.cost_id,
           percentage = excluded.percentage, amount = excluded.amount, due_date = excluded.due_date,
           method = excluded.method, notes = excluded.notes, sort_order = excluded.sort_order
    where t.order_id = v_id;
  end if;

  -- Silinen sevkiyata bağlı kayıt kaldıysa anlaşılır hata ver
  if exists (select 1 from public.order_items where order_id = v_id and not (shipment_no = any (v_ship_nos)))
  or exists (select 1 from public.order_costs where order_id = v_id and shipment_no is not null and not (shipment_no = any (v_ship_nos)))
  or exists (select 1 from public.plan_items  where order_id = v_id and shipment_no is not null and not (shipment_no = any (v_ship_nos))) then
    raise exception 'Silinen bir sevkiyata bağlı kalem, ek maliyet veya plan kalemi var. Önce onları başka sevkiyata taşıyın.';
  end if;
  set constraints all immediate;

  return v_id;
end $$;

-- Sipariş silme — tahsilatı olan sipariş silinemez (önce tahsilatı başka siparişe taşı/sil)
create function public.delete_order(p_id text) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not public.can_edit() then raise exception 'Yetkiniz yok'; end if;
  if exists (select 1 from public.collections where order_id = p_id) then
    raise exception 'Bu siparişe bağlı tahsilat var. Önce tahsilatları silin veya başka siparişe taşıyın.';
  end if;
  delete from public.orders where id = p_id;
end $$;

-- ============================================================================
-- 14. GÜVENLİK (RLS)
-- Giriş yapmayan HİÇBİR ŞEY göremez. viewer okur, editor/admin yazar.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array['app_settings','exchange_rates','bank_accounts','customers','products',
                           'orders','order_shipments','order_items','order_costs','plan_items',
                           'collections','customer_notes']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "okuma" on public.%I for select to authenticated using (public.can_view())', t);
    execute format('create policy "ekleme" on public.%I for insert to authenticated with check (public.can_edit())', t);
    execute format('create policy "guncelleme" on public.%I for update to authenticated using (public.can_edit()) with check (public.can_edit())', t);
    execute format('create policy "silme" on public.%I for delete to authenticated using (public.can_edit())', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- app_settings: sadece admin yazar
drop policy "ekleme" on public.app_settings;
drop policy "guncelleme" on public.app_settings;
drop policy "silme" on public.app_settings;
create policy "admin yazar" on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles: herkes kendini görür, admin herkesi görür ve rol değiştirir
alter table public.profiles enable row level security;
create policy "kendini veya admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "admin gunceller" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.profiles from anon;
grant select, update on public.profiles to authenticated;

-- audit_log: sadece okuma (giriş yapan), yazma sadece trigger
alter table public.audit_log enable row level security;
create policy "okuma" on public.audit_log for select to authenticated using (public.can_view());
revoke all on public.audit_log from anon;
grant select on public.audit_log to authenticated;

-- View'lar: anon erişemez
revoke all on public.v_latest_rates, public.v_shipment_goods, public.v_order_totals,
              public.v_shipment_totals, public.v_plan_status, public.v_order_summary,
              public.v_customer_balances, public.v_collections from anon;
grant select on public.v_latest_rates, public.v_shipment_goods, public.v_order_totals,
               public.v_shipment_totals, public.v_plan_status, public.v_order_summary,
               public.v_customer_balances, public.v_collections to authenticated;

-- Fonksiyonlar: anon çağıramaz
revoke execute on function public.save_order(jsonb), public.delete_order(text),
                           public.next_order_number(integer) from anon, public;
grant execute on function public.save_order(jsonb), public.delete_order(text),
                          public.next_order_number(integer) to authenticated;

-- ============================================================================
-- Aşağıda: veri aktarımı fonksiyonları
-- ============================================================================


-- ============================================================================
-- 15. VERİ AKTARIMI (eski sistemden) — aktarım bitince ekrandan "Kilitle"
-- ============================================================================

create function public.migration_is_locked() returns boolean
language sql stable as $$
  select coalesce((select value::text = 'true' from public.app_settings where key = 'migration_locked'), false)
$$;

-- Tek bir tabloya satır yığını ekler (aynı id varsa atlar → tekrar çalıştırılabilir)
create function public.migrate_import(p_table text, p_rows jsonb) returns integer
language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'Sadece admin veri aktarabilir'; end if;
  if public.migration_is_locked() then raise exception 'Aktarım kilitli'; end if;
  if p_table not in ('exchange_rates','bank_accounts','customers','products','orders','order_shipments',
                     'order_items','order_costs','plan_items','collections','customer_notes') then
    raise exception 'Geçersiz tablo: %', p_table;
  end if;
  perform set_config('app.skip_audit', 'on', true);
  execute format(
    'insert into public.%1$I select * from jsonb_populate_recordset(null::public.%1$I, $1) on conflict do nothing',
    p_table) using p_rows;
  get diagnostics n = row_count;
  return n;
end $$;

-- Yeni sistemdeki TÜM iş verisini siler (kullanıcılar ve ayarlar kalır).
-- Sadece aktarım kilitli DEĞİLKEN ve onay metni 'SIFIRLA' ise çalışır.
create function public.migrate_reset(p_confirm text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Sadece admin'; end if;
  if public.migration_is_locked() then raise exception 'Aktarım kilitli — sıfırlama yapılamaz'; end if;
  if p_confirm is distinct from 'SIFIRLA' then raise exception 'Onay metni hatalı'; end if;
  truncate public.collections, public.plan_items, public.order_costs, public.order_items,
           public.order_shipments, public.orders, public.customer_notes, public.products,
           public.customers, public.bank_accounts, public.exchange_rates, public.audit_log
           restart identity;
end $$;

revoke execute on function public.migrate_import(text, jsonb), public.migrate_reset(text) from anon, public;
grant execute on function public.migrate_import(text, jsonb), public.migrate_reset(text) to authenticated;
