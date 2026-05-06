-- ============================================================================
-- İHRACAT OPERASYONLARI — Supabase Kurulum SQL (v2.2)
-- Auth ile entegre — anon kullanıcı sadece okur, giriş yapan düzenler
-- ============================================================================

-- 1. data tablosu (varsa atla)
CREATE TABLE IF NOT EXISTS data (
  key text PRIMARY KEY,
  value jsonb,
  updated_at timestamptz DEFAULT now()
);

-- 2. RLS aktif
ALTER TABLE data ENABLE ROW LEVEL SECURITY;

-- 3. Eski politikaları kaldır (varsa)
DROP POLICY IF EXISTS "Public read access" ON data;
DROP POLICY IF EXISTS "Public write access" ON data;
DROP POLICY IF EXISTS "Public update access" ON data;
DROP POLICY IF EXISTS "Public delete access" ON data;
DROP POLICY IF EXISTS "Anyone can read" ON data;
DROP POLICY IF EXISTS "Authenticated can insert" ON data;
DROP POLICY IF EXISTS "Authenticated can update" ON data;
DROP POLICY IF EXISTS "Authenticated can delete" ON data;

-- 4. YENİ POLİTİKALAR
-- Herkes (anon ve authenticated) okuyabilir → misafir görüntüleme için
CREATE POLICY "Anyone can read" ON data
  FOR SELECT USING (true);

-- Sadece giriş yapmış kullanıcı yazabilir
CREATE POLICY "Authenticated can insert" ON data
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update" ON data
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete" ON data
  FOR DELETE TO authenticated
  USING (true);

-- 5. Anon ve authenticated rollerine GRANT'lar
GRANT SELECT ON data TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON data TO authenticated;

-- 6. updated_at otomatik güncellensin
CREATE OR REPLACE FUNCTION update_data_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS data_update_timestamp ON data;
CREATE TRIGGER data_update_timestamp
  BEFORE UPDATE ON data
  FOR EACH ROW EXECUTE FUNCTION update_data_timestamp();

-- ============================================================================
-- KULLANIMI:
-- 1. Bu SQL'i Supabase --> SQL Editor'a yapistir --> Run
-- 2. Authentication --> Users --> Add user (email + sifre + Auto Confirm)
-- 3. Kullaniciya rol vermek icin:
--    Authentication --> Users --> kullaniciya tikla --> Raw User Meta Data:
--    {"role": "admin"}     - tum yetkiler
--    {"role": "editor"}    - duzenleyebilir (varsayilan)
--    {"role": "viewer"}    - sadece okur
-- ============================================================================

-- Test: data tablosuna bir test kayit at (bossa)
INSERT INTO data (key, value)
VALUES ('_init', '"Ihracat Operasyonlari kuruldu"'::jsonb)
ON CONFLICT (key) DO NOTHING;
