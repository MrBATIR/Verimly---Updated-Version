-- Sorunlu RLS policy'lerini kaldır
-- Bu policy'ler sonsuz döngüye neden oluyor

-- Institutions tablosundaki sorunlu policy'leri kaldır
DROP POLICY IF EXISTS "Admins can manage own institution" ON institutions;
DROP POLICY IF EXISTS "Users can view own institution" ON institutions;
DROP POLICY IF EXISTS "Users can insert institutions" ON institutions;
DROP POLICY IF EXISTS "Users can update own institution" ON institutions;
DROP POLICY IF EXISTS "Users can delete own institution" ON institutions;

-- Institution memberships tablosundaki sorunlu policy'leri kaldır
DROP POLICY IF EXISTS "Admins can manage memberships" ON institution_memberships;
DROP POLICY IF EXISTS "Users can view own memberships" ON institution_memberships;
DROP POLICY IF EXISTS "Users can insert memberships" ON institution_memberships;
DROP POLICY IF EXISTS "Users can update own memberships" ON institution_memberships;

-- Institution admin credentials tablosundaki policy'leri kaldır
DROP POLICY IF EXISTS "System can manage admin credentials" ON institution_admin_credentials;
DROP POLICY IF EXISTS "Users can view admin credentials" ON institution_admin_credentials;
DROP POLICY IF EXISTS "Users can insert admin credentials" ON institution_admin_credentials;
DROP POLICY IF EXISTS "Users can update admin credentials" ON institution_admin_credentials;

-- RLS'i tamamen kapat
ALTER TABLE institutions DISABLE ROW LEVEL SECURITY;
ALTER TABLE institution_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE institution_admin_credentials DISABLE ROW LEVEL SECURITY;

-- Kalan policy'leri kontrol et
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('institutions', 'institution_memberships', 'institution_admin_credentials');
