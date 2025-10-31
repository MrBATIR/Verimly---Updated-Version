-- ==============================================
-- OSMAN BATIR MEVCUT DURUM KONTROLÜ
-- Supabase SQL Editor'da çalıştırın
-- ==============================================

-- 1. Osman Batır kullanıcısını bul
SELECT 
    u.id as user_id,
    u.email,
    up.name,
    up.user_type,
    up.institution_id as primary_institution_id,
    i.name as primary_institution_name
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN institutions i ON up.institution_id = i.id
WHERE u.email = 'osmanbatir@imikoleji.k12.tr';

-- 2. Osman Batır'ın tüm kurum üyelikleri
SELECT 
    im.institution_id,
    i.name as institution_name,
    im.role,
    im.is_active,
    im.joined_at
FROM institution_memberships im
LEFT JOIN institutions i ON im.institution_id = i.id
LEFT JOIN auth.users u ON im.user_id = u.id
WHERE u.email = 'osmanbatir@imikoleji.k12.tr'
ORDER BY im.joined_at;

-- 3. Mevcut kurumları listele
SELECT 
    id,
    name,
    type,
    is_active,
    is_premium
FROM institutions
WHERE name ILIKE '%İMİ%' 
   OR name ILIKE '%Anadolu%' 
   OR name ILIKE '%Fen%'
   OR name ILIKE '%Osman%'
   OR name ILIKE '%Batır%'
   OR name ILIKE '%Özel%'
ORDER BY name;
