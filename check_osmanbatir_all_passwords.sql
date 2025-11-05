-- osmanbatir için TÜM olası şifre kayıtlarını kontrol et
-- 1. Tüm institution_admin_credentials kayıtları (osmanbatir ile ilgili)
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
WHERE admin_username = 'osmanbatir'
   OR institution_id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5'
ORDER BY updated_at DESC;

-- 2. Aynı institution_id'ye ait TÜM admin kayıtları (belki birden fazla kayıt var)
SELECT 
    iac.id,
    iac.institution_id,
    iac.admin_username,
    iac.admin_password,
    LENGTH(iac.admin_password) as password_length,
    iac.is_active,
    iac.created_at,
    iac.updated_at,
    i.name as institution_name
FROM institution_admin_credentials iac
LEFT JOIN institutions i ON iac.institution_id = i.id
WHERE iac.institution_id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5'
ORDER BY iac.updated_at DESC;

-- 3. RPC fonksiyonunun test edilmesi (123456 şifresi ile)
-- Bu sorguyu çalıştırmak için Supabase SQL Editor'da şunu deneyin:
-- SELECT * FROM verify_institution_admin_login('osmanbatir', '123456');
-- SELECT * FROM verify_institution_admin_login('osmanbatir', 'CaN.2020.');

-- 4. Şifre eşleştirme kontrolü (manuel)
SELECT 
    admin_username,
    admin_password,
    CASE 
        WHEN admin_password = '123456' THEN 'EŞLEŞİYOR: 123456'
        WHEN admin_password = 'CaN.2020.' THEN 'EŞLEŞİYOR: CaN.2020.'
        ELSE 'EŞLEŞMİYOR'
    END as password_match_status,
    institution_id
FROM institution_admin_credentials
WHERE admin_username = 'osmanbatir'
   OR institution_id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5';

-- 5. RPC fonksiyonunun tanımını kontrol et
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'verify_institution_admin_login'
  AND n.nspname = 'public';


