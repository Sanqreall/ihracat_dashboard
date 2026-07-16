-- ============================================================================
-- YONGA ERP — 0011: Silinen sipariş numaraları tekrar kullanılabilsin
--
-- SORUN: orders.order_number üzerindeki benzersizlik kısıtı, soft-delete edilmiş
-- (deleted_at dolu) siparişleri de kapsıyordu. Bu yüzden bir siparişi silip
-- aynı numarayı başka bir siparişe vermek "duplicate key" hatası veriyordu.
--
-- ÇÖZÜM: Tam sütun kısıtını kaldırıp, yerine YALNIZCA silinmemiş siparişleri
-- kapsayan kısmi (partial) benzersiz indeks koyuyoruz. Böylece:
--   • Aktif siparişler arasında numara hâlâ benzersiz (veri bütünlüğü korunur)
--   • Silinen bir siparişin numarası anında yeniden kullanılabilir
--
-- Tekrar çalıştırılabilir.
-- ============================================================================

-- 1) Eski tam benzersizlik kısıtını kaldır (varsa)
alter table public.orders
  drop constraint if exists orders_order_number_key;

-- Bazı kurulumlarda kısıt yerine indeks olabilir; onu da düşür
drop index if exists public.orders_order_number_key;

-- 2) Yalnızca silinmemiş siparişleri kapsayan kısmi benzersiz indeks
create unique index if not exists orders_order_number_active_key
  on public.orders (order_number)
  where deleted_at is null;

-- ============================================================================
-- AYNI DÜZELTMEYİ İADE ve ÜRETİM EMRİ NUMARALARINA DA UYGULA
-- (returns.return_number benzersiz olabilir; production_batches.batch_number)
-- ============================================================================

-- İadeler: return_number benzersizse ve soft-delete yoksa dokunmuyoruz.
-- returns tablosunda deleted_at kolonu varsa aynı mantığı uygula:
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'returns' and column_name = 'deleted_at'
  ) then
    alter table public.returns drop constraint if exists returns_return_number_key;
    drop index if exists public.returns_return_number_key;
    execute 'create unique index if not exists returns_return_number_active_key
             on public.returns (return_number) where deleted_at is null';
  end if;
end $$;
