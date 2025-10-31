-- institutions tablosuna admin_username ve admin_password sütunlarını ekle

-- admin_username sütununu ekle
ALTER TABLE institutions 
ADD COLUMN IF NOT EXISTS admin_username VARCHAR(255);

-- admin_password sütununu ekle  
ALTER TABLE institutions 
ADD COLUMN IF NOT EXISTS admin_password VARCHAR(255);

-- Sütunların eklendiğini kontrol et
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'institutions' 
AND column_name IN ('admin_username', 'admin_password');
