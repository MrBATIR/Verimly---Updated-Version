-- osmanbatir kurumunun institutions tablosundaki bilgilerini kontrol et
-- 1. Institution bilgileri
SELECT 
    id,
    name,
    type,
    contact_email,
    contact_phone,
    address,
    max_teachers,
    max_students,
    contract_start_date,
    contract_end_date,
    is_active,
    created_at,
    updated_at,
    notes
FROM institutions
WHERE id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5'
   OR name ILIKE '%osmanbatir%'
   OR contact_email ILIKE '%osmanbatir%'
ORDER BY created_at DESC;

-- 2. Institution ve Admin Credentials birlikte (tam resim)
SELECT 
    i.id as institution_id,
    i.name as institution_name,
    i.type as institution_type,
    i.contact_email,
    i.contact_phone,
    i.is_active as institution_active,
    iac.id as credential_id,
    iac.admin_username,
    iac.admin_password,
    LENGTH(iac.admin_password) as password_length,
    iac.is_active as credential_active,
    iac.created_at as credential_created_at,
    iac.updated_at as credential_updated_at
FROM institutions i
LEFT JOIN institution_admin_credentials iac ON i.id = iac.institution_id
WHERE i.id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5'
   OR i.name ILIKE '%osmanbatir%'
   OR i.contact_email ILIKE '%osmanbatir%'
   OR iac.admin_username = 'osmanbatir'
ORDER BY iac.updated_at DESC NULLS LAST;

-- 3. Tüm admin credentials kayıtları (bu institution_id için)
SELECT 
    id,
    institution_id,
    admin_username,
    admin_password,
    LENGTH(admin_password) as password_length,
    is_active,
    created_at,
    updated_at
FROM institution_admin_credentials
WHERE institution_id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5'
ORDER BY updated_at DESC;

-- 4. RPC fonksiyonunun hangi kaydı bulduğunu test et
-- Bu sorguları Supabase SQL Editor'da çalıştırın:
-- SELECT * FROM verify_institution_admin_login('osmanbatir', '123456');
-- SELECT * FROM verify_institution_admin_login('osmanbatir', 'CaN.2020.');

-- 5. Şifre karşılaştırması (manuel)
-- 123456 ile eşleşen kayıt var mı?
SELECT 
    '123456 ile eşleşen kayıt' as test_type,
    id,
    institution_id,
    admin_username,
    admin_password,
    LENGTH(admin_password) as password_length,
    is_active
FROM institution_admin_credentials
WHERE institution_id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5'
  AND admin_username = 'osmanbatir'
  AND admin_password = '123456';

-- CaN.2020. ile eşleşen kayıt var mı?
SELECT 
    'CaN.2020. ile eşleşen kayıt' as test_type,
    id,
    institution_id,
    admin_username,
    admin_password,
    LENGTH(admin_password) as password_length,
    is_active
FROM institution_admin_credentials
WHERE institution_id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5'
  AND admin_username = 'osmanbatir'
  AND admin_password = 'CaN.2020.';

-- 6. Tüm aktif/pasif kayıtlar (is_active kontrolü olmadan)
SELECT 
    id,
    institution_id,
    admin_username,
    admin_password,
    LENGTH(admin_password) as password_length,
    is_active,
    created_at,
    updated_at
FROM institution_admin_credentials
WHERE institution_id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5'
  AND admin_username = 'osmanbatir'
ORDER BY updated_at DESC;


