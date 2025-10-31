-- Kurum admin kullanıcı adlarını düzelt

-- 1. admin_username sütununu ekle (eğer yoksa)
ALTER TABLE institutions 
ADD COLUMN IF NOT EXISTS admin_username VARCHAR(255);

-- 2. Mevcut kurumlar için admin kullanıcı adları ata
UPDATE institutions 
SET admin_username = 'admin_' || LOWER(REPLACE(REPLACE(REPLACE(name, ' ', '_'), 'ı', 'i'), 'ğ', 'g'))
WHERE admin_username IS NULL OR admin_username = '';

-- 3. Sonucu kontrol et
SELECT 
    id,
    name,
    admin_username,
    'Güncellendi' as status
FROM institutions 
ORDER BY created_at DESC;
