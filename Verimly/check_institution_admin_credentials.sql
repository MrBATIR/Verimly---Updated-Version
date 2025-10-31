-- Mevcut kurumların admin giriş bilgilerini kontrol et

-- 1. institutions tablosundaki tüm kurumları listele
SELECT 
    id,
    name,
    type,
    contact_email,
    is_active,
    admin_username,
    admin_password,
    created_at
FROM institutions 
ORDER BY created_at DESC;

-- 2. Eğer admin_username ve admin_password sütunları yoksa, institution_admin_credentials tablosunu kontrol et
SELECT 
    iac.id,
    iac.institution_id,
    i.name as institution_name,
    iac.admin_username,
    iac.admin_password,
    iac.is_active,
    iac.created_at
FROM institution_admin_credentials iac
LEFT JOIN institutions i ON iac.institution_id = i.id
ORDER BY iac.created_at DESC;

-- 3. Kurumların admin bilgileri var mı kontrol et
SELECT 
    i.id,
    i.name,
    i.type,
    CASE 
        WHEN i.admin_username IS NOT NULL THEN 'institutions tablosunda'
        WHEN iac.admin_username IS NOT NULL THEN 'institution_admin_credentials tablosunda'
        ELSE 'Admin bilgisi yok'
    END as admin_info_location,
    COALESCE(i.admin_username, iac.admin_username) as admin_username,
    COALESCE(i.admin_password, iac.admin_password) as admin_password
FROM institutions i
LEFT JOIN institution_admin_credentials iac ON i.id = iac.institution_id
ORDER BY i.created_at DESC;
