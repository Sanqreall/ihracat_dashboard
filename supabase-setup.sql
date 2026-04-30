-- ============================================================================
-- Export-Flow · Supabase Kurulum SQL'i
-- ============================================================================
-- Bunu Supabase'de SQL Editor'a yapıştırıp "Run" butonuna bas.
-- Bir kez çalıştırman yeterli. Tekrar çalıştırırsan da sorun olmaz.
-- ============================================================================

-- 1. Veri tablosu
create table if not exists public.data (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

-- 2. Güncelleme zaman damgası
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists data_updated_at on public.data;
create trigger data_updated_at
  before update on public.data
  for each row execute function public.set_updated_at();

-- 3. Anonim ve giriş yapmış rollere tablo erişimi (yeni projelerde gerekli)
grant usage on schema public to anon, authenticated;
grant all on public.data to anon, authenticated;

-- 4. Row Level Security aç
alter table public.data enable row level security;

-- 5. Erişim politikası
-- Bu, projenin URL'ini bilen herkesin erişebileceği anlamına gelir.
-- Yalnızca güvendiğin ekip üyelerine paylaş.
drop policy if exists "public access" on public.data;
create policy "public access" on public.data
  for all
  using (true)
  with check (true);

-- 6. Test
insert into public.data (key, value) values ('_test', '{"ok": true}'::jsonb)
on conflict (key) do update set value = excluded.value;

select 'Kurulum basarili!' as durum, value from public.data where key = '_test';
