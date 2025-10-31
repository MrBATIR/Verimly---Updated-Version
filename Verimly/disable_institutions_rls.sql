-- Institutions tabloları için RLS'i geçici olarak kapat
-- Bu sadece geliştirme aşamasında kullanılmalı

ALTER TABLE institutions DISABLE ROW LEVEL SECURITY;
ALTER TABLE institution_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE institution_admin_credentials DISABLE ROW LEVEL SECURITY;

-- Mevcut policy'leri kaldır
DROP POLICY IF EXISTS "Users can view own institution" ON institutions;
DROP POLICY IF EXISTS "Users can insert institutions" ON institutions;
DROP POLICY IF EXISTS "Users can update own institution" ON institutions;
DROP POLICY IF EXISTS "Users can delete own institution" ON institutions;

DROP POLICY IF EXISTS "Users can view own memberships" ON institution_memberships;
DROP POLICY IF EXISTS "Users can insert memberships" ON institution_memberships;
DROP POLICY IF EXISTS "Users can update own memberships" ON institution_memberships;

DROP POLICY IF EXISTS "Users can view admin credentials" ON institution_admin_credentials;
DROP POLICY IF EXISTS "Users can insert admin credentials" ON institution_admin_credentials;
DROP POLICY IF EXISTS "Users can update admin credentials" ON institution_admin_credentials;
