-- ============================================================================
-- YONGA ERP — 0008: Kargo sipariş toplamından çıkarılıyor
--
-- Eski formül: total = (indirimli tutar) + kargo
-- Yeni formül: total = (indirimli tutar)        → kargo yalnızca gider kalemi
--
-- Bu migration mevcut siparişlerin total / total_usd değerlerinden kargoyu düşer.
-- Tekrar çalıştırmaya karşı korumalıdır (aşağıdaki takip tablosu sayesinde),
-- yani yanlışlıkla ikinci kez çalıştırırsanız tutarlar tekrar düşmez.
-- ============================================================================

-- Uygulanan migration'ları takip eden yardımcı tablo
create table if not exists public.applied_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from public.applied_migrations where name = '0008_kargo_toplamdan_cikar') then
    raise notice 'Migration 0008 zaten uygulanmis, atlaniyor.';
    return;
  end if;

  update public.orders
    set total = round(total - coalesce(shipping_cost, 0), 2),
        total_usd = case
          when usd_rate is not null and usd_rate > 0
            then round((total - coalesce(shipping_cost, 0)) / usd_rate, 2)
          else total_usd
        end
    where coalesce(shipping_cost, 0) <> 0
      and deleted_at is null;

  insert into public.applied_migrations (name) values ('0008_kargo_toplamdan_cikar');
  raise notice 'Migration 0008 uygulandi.';
end $$;
