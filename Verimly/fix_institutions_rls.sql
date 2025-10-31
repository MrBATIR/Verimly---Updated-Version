-- Institutions tablosu için RLS policy'lerini düzelt
-- Önce mevcut policy'leri kaldır
DROP POLICY IF EXISTS "Users can view own institution" ON institutions;
DROP POLICY IF EXISTS "Users can insert institutions" ON institutions;
DROP POLICY IF EXISTS "Users can update own institution" ON institutions;
DROP POLICY IF EXISTS "Users can delete own institution" ON institutions;

-- Basit RLS policy'leri oluştur (sonsuz döngüyü önlemek için)
CREATE POLICY "Allow all operations for authenticated users" ON institutions
  FOR ALL USING (auth.role() = 'authenticated');

-- Institution memberships için de basit policy
DROP POLICY IF EXISTS "Users can view own memberships" ON institution_memberships;
DROP POLICY IF EXISTS "Users can insert memberships" ON institution_memberships;
DROP POLICY IF EXISTS "Users can update own memberships" ON institution_memberships;

CREATE POLICY "Allow all operations for authenticated users" ON institution_memberships
  FOR ALL USING (auth.role() = 'authenticated');

-- Institution admin credentials için de basit policy
DROP POLICY IF EXISTS "Users can view admin credentials" ON institution_admin_credentials;
DROP POLICY IF EXISTS "Users can insert admin credentials" ON institution_admin_credentials;
DROP POLICY IF EXISTS "Users can update admin credentials" ON institution_admin_credentials;

CREATE POLICY "Allow all operations for authenticated users" ON institution_admin_credentials
  FOR ALL USING (auth.role() = 'authenticated');
