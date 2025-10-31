-- Kullanıcı Reklam Durumu Kontrol Scripti
-- Bu script belirli bir kullanıcının neden reklam görmediğini kontrol eder

-- ==============================================
-- 1. KULLANICI BİLGİLERİNİ KONTROL ET
-- ==============================================

-- canbatir@imikoleji.k12.tr kullanıcısını bul
SELECT 
    'Kullanıcı Bilgileri' as info,
    u.id as user_id,
    u.email,
    up.user_type,
    up.institution_id,
    i.name as institution_name,
    i.is_active as institution_active,
    i.is_premium as institution_premium,
    i.contract_end_date
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN institutions i ON up.institution_id = i.id
WHERE u.email = 'canbatir@imikoleji.k12.tr';

-- ==============================================
-- 2. KURUM ÜYELİK DURUMUNU KONTROL ET
-- ==============================================

-- Kurum üyelik durumunu kontrol et
SELECT 
    'Kurum Üyelik Durumu' as info,
    im.institution_id,
    im.user_id,
    im.role,
    im.is_active as membership_active,
    i.name as institution_name,
    i.is_active as institution_active,
    i.is_premium as institution_premium
FROM institution_memberships im
JOIN institutions i ON im.institution_id = i.id
JOIN auth.users u ON im.user_id = u.id
WHERE u.email = 'canbatir@imikoleji.k12.tr';

-- ==============================================
-- 3. REKLAM DURUMU KONTROLÜ
-- ==============================================

-- check_institution_access fonksiyonunu test et
SELECT 
    'Kurum Erişim Kontrolü' as info,
    check_institution_access(u.id) as has_institution_access
FROM auth.users u
WHERE u.email = 'canbatir@imikoleji.k12.tr';

-- ==============================================
-- 4. BİREYSEL PREMİUM DURUMU
-- ==============================================

-- Bireysel premium durumunu kontrol et
SELECT 
    'Bireysel Premium Durumu' as info,
    up.user_id,
    up.is_premium,
    up.premium_start_date,
    up.premium_end_date,
    CASE 
        WHEN up.is_premium = true AND up.premium_end_date > NOW() THEN 'Aktif'
        ELSE 'Pasif'
    END as premium_status
FROM user_premium up
JOIN auth.users u ON up.user_id = u.id
WHERE u.email = 'canbatir@imikoleji.k12.tr';

-- ==============================================
-- 5. REKLAM KALDIRMA DURUMU
-- ==============================================

-- Reklam kaldırma durumunu kontrol et
SELECT 
    'Reklam Kaldırma Durumu' as info,
    uar.user_id,
    uar.removal_date,
    uar.is_active,
    CASE 
        WHEN uar.is_active = true AND uar.removal_date = CURRENT_DATE THEN 'Bugün Kaldırıldı'
        WHEN uar.is_active = true AND uar.removal_date < CURRENT_DATE THEN 'Geçmişte Kaldırıldı'
        ELSE 'Kaldırılmamış'
    END as removal_status
FROM user_ad_removals uar
JOIN auth.users u ON uar.user_id = u.id
WHERE u.email = 'canbatir@imikoleji.k12.tr'
ORDER BY uar.removal_date DESC;

-- ==============================================
-- 6. ÖĞRETMEN DURUMU KONTROLÜ
-- ==============================================

-- Öğretmen durumunu kontrol et
SELECT 
    'Öğretmen Durumu' as info,
    up.user_id,
    up.user_type,
    CASE 
        WHEN up.user_type = 'teacher' THEN 'Öğretmen - Reklamlar Görünmez'
        ELSE 'Öğretmen Değil'
    END as teacher_status
FROM user_profiles up
JOIN auth.users u ON up.user_id = u.id
WHERE u.email = 'canbatir@imikoleji.k12.tr';

-- ==============================================
-- 7. GENEL REKLAM DURUMU ÖZETİ
-- ==============================================

-- Tüm reklam durumlarını özetle
WITH user_info AS (
    SELECT 
        u.id as user_id,
        u.email,
        up.user_type,
        up.institution_id,
        i.name as institution_name,
        i.is_active as institution_active,
        i.is_premium as institution_premium,
        i.contract_end_date
    FROM auth.users u
    LEFT JOIN user_profiles up ON u.id = up.user_id
    LEFT JOIN institutions i ON up.institution_id = i.id
    WHERE u.email = 'canbatir@imikoleji.k12.tr'
),
premium_info AS (
    SELECT 
        up.user_id,
        up.is_premium,
        up.premium_end_date,
        CASE 
            WHEN up.is_premium = true AND up.premium_end_date > NOW() THEN true
            ELSE false
        END as is_premium_active
    FROM user_premium up
    JOIN user_info ui ON up.user_id = ui.user_id
),
removal_info AS (
    SELECT 
        uar.user_id,
        CASE 
            WHEN uar.is_active = true AND uar.removal_date = CURRENT_DATE THEN true
            ELSE false
        END as is_removed_today
    FROM user_ad_removals uar
    JOIN user_info ui ON uar.user_id = ui.user_id
    WHERE uar.is_active = true
)
SELECT 
    'REKLAM DURUMU ÖZETİ' as info,
    ui.email,
    ui.user_type,
    ui.institution_name,
    ui.institution_active,
    ui.institution_premium,
    pi.is_premium_active,
    ri.is_removed_today,
    check_institution_access(ui.user_id) as has_institution_access,
    CASE 
        WHEN ui.user_type = 'teacher' THEN 'Öğretmen - Reklamlar Görünmez'
        WHEN check_institution_access(ui.user_id) = true THEN 'Kurum Premium - Reklamlar Görünmez'
        WHEN pi.is_premium_active = true THEN 'Bireysel Premium - Reklamlar Görünmez'
        WHEN ri.is_removed_today = true THEN 'Reklamlar Kaldırıldı - Reklamlar Görünmez'
        ELSE 'Normal - Reklamlar Görünür'
    END as ad_status_reason
FROM user_info ui
LEFT JOIN premium_info pi ON ui.user_id = pi.user_id
LEFT JOIN removal_info ri ON ui.user_id = ri.user_id;
