-- Öğrenci kaydı kontrol scripti
-- Bu script belirli bir kullanıcının students tablosunda kaydı olup olmadığını kontrol eder

-- ==============================================
-- 1. MEVCUT ÖĞRENCİ KAYITLARINI KONTROL ET
-- ==============================================

-- Tüm students kayıtlarını listele
SELECT 
    id,
    user_id,
    email,
    name,
    school,
    grade,
    phone,
    created_at
FROM students 
ORDER BY created_at DESC;

-- ==============================================
-- 2. USER_ID İLE EŞLEŞEN KAYITLARI KONTROL ET
-- ==============================================

-- user_id ile eşleşen kayıtları kontrol et
SELECT 
    s.id,
    s.user_id,
    s.email,
    s.name,
    s.school,
    s.grade,
    s.phone,
    u.email as auth_email,
    u.id as auth_user_id
FROM students s
LEFT JOIN auth.users u ON s.user_id = u.id
ORDER BY s.created_at DESC;

-- ==============================================
-- 3. AUTH.USERS İLE STUDENTS EŞLEŞMESİ
-- ==============================================

-- auth.users'da olan ama students'da olmayan kullanıcıları bul
SELECT 
    u.id as user_id,
    u.email,
    u.created_at as user_created_at,
    'MISSING IN STUDENTS' as status
FROM auth.users u
LEFT JOIN students s ON s.user_id = u.id
WHERE s.user_id IS NULL
ORDER BY u.created_at DESC;
