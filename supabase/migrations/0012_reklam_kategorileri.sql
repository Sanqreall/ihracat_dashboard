-- ============================================================================
-- YONGA ERP — 0012: Meta ve Google reklam gideri kategorileri
--
-- ROAS (reklam harcamasının getirisi) hesabı için iki ayrı reklam kategorisi:
-- "Meta Reklam" ve "Google Reklam". Bunlar aylık gider olarak girilir
-- (is_monthly = true) ve raporlarda güne bölünür.
-- ============================================================================

insert into public.expense_categories (name)
values ('Meta Reklam'), ('Google Reklam')
on conflict (name) do nothing;
