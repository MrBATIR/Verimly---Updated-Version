-- osmanbatir giriş sorunu için debug sorguları

-- 1. RPC fonksiyonunun gerçek sonuçlarını test et
-- Bu sorguları çalıştırıp sonuçları paylaşın:
SELECT 
    '123456 ile test' as test_name,
    * 
FROM verify_institution_admin_login('osmanbatir', '123456');

SELECT 
    'CaN.2020. ile test' as test_name,
    * 
FROM verify_institution_admin_login('osmanbatir', 'CaN.2020.');

-- 2. RPC fonksiyonunun güncel tanımını kontrol et
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'verify_institution_admin_login'
  AND n.nspname = 'public';

-- 3. Manuel şifre karşılaştırması (RPC fonksiyonunun yaptığını simüle et)
SELECT 
    'Manuel 123456 test' as test_type,
    iac.id,
    iac.institution_id,
    iac.admin_username,
    iac.admin_password,
    iac.is_active as credential_active,
    i.is_active as institution_active,
    CASE 
        WHEN iac.admin_password = '123456' THEN 'EŞLEŞİYOR'
        ELSE 'EŞLEŞMİYOR'
    END as password_match
FROM institution_admin_credentials iac
JOIN institutions i ON iac.institution_id = i.id
WHERE iac.admin_username = 'osmanbatir'
  AND iac.admin_password = '123456'  -- RPC fonksiyonundaki aynı koşul
  AND iac.is_active = true
  AND i.is_active = true;

SELECT 
    'Manuel CaN.2020. test' as test_type,
    iac.id,
    iac.institution_id,
    iac.admin_username,
    iac.admin_password,
    iac.is_active as credential_active,
    i.is_active as institution_active,
    CASE 
        WHEN iac.admin_password = 'CaN.2020.' THEN 'EŞLEŞİYOR'
        ELSE 'EŞLEŞMİYOR'
    END as password_match
FROM institution_admin_credentials iac
JOIN institutions i ON iac.institution_id = i.id
WHERE iac.admin_username = 'osmanbatir'
  AND iac.admin_password = 'CaN.2020.'  -- RPC fonksiyonundaki aynı koşul
  AND iac.is_active = true
  AND i.is_active = true;

-- 4. Şifre karakterlerini detaylı kontrol et (gizli karakterler olabilir)
SELECT 
    id,
    admin_username,
    admin_password,
    LENGTH(admin_password) as password_length,
    encode(admin_password::bytea, 'hex') as password_hex,  -- Hex formatında göster
    admin_password || '|' as password_with_trailer,  -- Sonunda boşluk var mı?
    '|' || admin_password || '|' as password_with_both  -- Başında/sonunda boşluk var mı?
FROM institution_admin_credentials
WHERE institution_id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5'
  AND admin_username = 'osmanbatir';

-- 5. Tüm olası şifre varyasyonlarını test et
SELECT 
    '123456 test' as test_password,
    CASE WHEN admin_password = '123456' THEN 'EŞLEŞİYOR' ELSE 'EŞLEŞMİYOR' END as result
FROM institution_admin_credentials
WHERE institution_id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5'
  AND admin_username = 'osmanbatir'
UNION ALL
SELECT 
    'CaN.2020. test' as test_password,
    CASE WHEN admin_password = 'CaN.2020.' THEN 'EŞLEŞİYOR' ELSE 'EŞLEŞMİYOR' END as result
FROM institution_admin_credentials
WHERE institution_id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5'
  AND admin_username = 'osmanbatir'
UNION ALL
SELECT 
    'CaN.2020 (nokta yok) test' as test_password,
    CASE WHEN admin_password = 'CaN.2020' THEN 'EŞLEŞİYOR' ELSE 'EŞLEŞMİYOR' END as result
FROM institution_admin_credentials
WHERE institution_id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5'
  AND admin_username = 'osmanbatir';

-- 6. Institution'ın is_active durumunu kontrol et
SELECT 
    id,
    name,
    is_active,
    contract_end_date,
    CASE 
        WHEN contract_end_date IS NOT NULL AND contract_end_date < NOW() THEN 'SÖZLEŞME BİTMİŞ'
        ELSE 'SÖZLEŞME AKTİF'
    END as contract_status
FROM institutions
WHERE id = 'd92e9cd0-be1c-4a40-8546-3dfd70ed05c5';


