-- osmanbatir kurumunun admin bilgilerini kontrol et
-- 1. Institution bilgileri
SELECT 
    id,
    name,
    type,
    contact_email,
    contact_phone,
    is_active,
    created_at,
    updated_at
FROM institutions
WHERE id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5'
   OR name ILIKE '%osmanbatir%'
   OR contact_email ILIKE '%osmanbatir%';

-- 2. Institution Admin Credentials (giriş bilgileri)
SELECT 
    id,
    institution_id,
    admin_username,
    admin_password,
    is_active,
    created_at,
    updated_at
FROM institution_admin_credentials
WHERE institution_id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5'
   OR admin_username = 'osmanbatir';

-- 3. Tüm kurumlar ve admin bilgileri (osmanbatir ile ilgili)
SELECT 
    i.id as institution_id,
    i.name as institution_name,
    i.contact_email,
    i.contact_phone,
    i.is_active as institution_active,
    iac.admin_username,
    iac.admin_password,
    iac.is_active as admin_active,
    iac.created_at as admin_created_at,
    iac.updated_at as admin_updated_at
FROM institutions i
LEFT JOIN institution_admin_credentials iac ON i.id = iac.institution_id
WHERE i.id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5'
   OR i.name ILIKE '%osmanbatir%'
   OR i.contact_email ILIKE '%osmanbatir%'
   OR iac.admin_username = 'osmanbatir';

-- 4. Şifre uzunluğu kontrolü (log'da storedPasswordLength: 9 görünüyordu)
SELECT 
    admin_username,
    LENGTH(admin_password) as password_length,
    admin_password,
    institution_id
FROM institution_admin_credentials
WHERE admin_username = 'osmanbatir'
   OR institution_id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5';


