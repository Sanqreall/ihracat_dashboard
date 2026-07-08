-- Run after 0001_init.sql. Safe to re-run (upserts by unique name).

insert into public.company_settings (company_name, default_currency, default_tax_rate, shipping_price_per_desi)
select 'Yonga', 'TRY', 20.00, 0
where not exists (select 1 from public.company_settings);

insert into public.platforms (name, slug) values
  ('Website', 'website'),
  ('So-mass', 'so-mass'),
  ('Hipicon', 'hipicon'),
  ('Nowshopfun', 'nowshopfun'),
  ('Beymen', 'beymen'),
  ('Showroom', 'showroom')
on conflict (name) do nothing;

insert into public.categories (name) values
  ('Oturma Grubu'), ('Yemek Odası'), ('Yatak Odası'), ('Ofis'), ('Aksesuar')
on conflict (name) do nothing;

insert into public.expense_categories (name) values
  ('Ofis'), ('Pazarlama'), ('Reklam'), ('Maaş'), ('Kargo'), ('Ambalaj'), ('Yazılım'), ('Kira'), ('Faturalar'), ('Diğer')
on conflict (name) do nothing;
