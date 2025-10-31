-- Tüm institutions tabloları için RLS'i zorla kapat
-- Mevcut tüm policy'leri kaldır

-- Institutions tablosu
ALTER TABLE institutions DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own institution" ON institutions;
DROP POLICY IF EXISTS "Users can insert institutions" ON institutions;
DROP POLICY IF EXISTS "Users can update own institution" ON institutions;
DROP POLICY IF EXISTS "Users can delete own institution" ON institutions;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON institutions;

-- Institution memberships tablosu
ALTER TABLE institution_memberships DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own memberships" ON institution_memberships;
DROP POLICY IF EXISTS "Users can insert memberships" ON institution_memberships;
DROP POLICY IF EXISTS "Users can update own memberships" ON institution_memberships;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON institution_memberships;

-- Institution admin credentials tablosu
ALTER TABLE institution_admin_credentials DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view admin credentials" ON institution_admin_credentials;
DROP POLICY IF EXISTS "Users can insert admin credentials" ON institution_admin_credentials;
DROP POLICY IF EXISTS "Users can update admin credentials" ON institution_admin_credentials;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON institution_admin_credentials;

-- Tüm policy'leri listele (kontrol için)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('institutions', 'institution_memberships', 'institution_admin_credentials');

