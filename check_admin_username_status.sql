-- Kurum admin kullanıcı adı durumunu kontrol et

-- 1. institutions tablosunda admin_username sütunu var mı kontrol et
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'institutions' 
AND column_name = 'admin_username';

-- 2. Mevcut kurumların admin_username değerlerini kontrol et
SELECT 
    id,
    name,
    admin_username,
    CASE 
        WHEN admin_username IS NULL THEN 'NULL'
        WHEN admin_username = '' THEN 'BOŞ STRING'
        ELSE 'DOLU: ' || admin_username
    END as admin_username_status
FROM institutions 
ORDER BY created_at DESC;

-- 3. Eğer admin_username sütunu yoksa, ekle
-- ALTER TABLE institutions ADD COLUMN IF NOT EXISTS admin_username VARCHAR(255);

-- 4. Mevcut kurumlar için varsayılan admin kullanıcı adları atayabilirsiniz
-- UPDATE institutions 
-- SET admin_username = 'admin_' || LOWER(REPLACE(name, ' ', '_'))
-- WHERE admin_username IS NULL OR admin_username = '';
