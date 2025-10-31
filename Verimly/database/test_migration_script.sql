-- İMİ Anadolu ve Fen Lisesi Migrasyon Test Scripti
-- Bu script sadece test amaçlıdır, gerçek migrasyon yapmaz

-- ==============================================
-- 1. MEVCUT TABLOLARI VE SÜTUNLARI KONTROL ET
-- ==============================================

-- Hangi tablolar mevcut?
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('user_profiles', 'teachers', 'students', 'study_logs', 'messages', 'student_daily_plans', 'student_weekly_plans', 'teacher_student_requests') 
        THEN '✅ Mevcut'
        ELSE '❌ Mevcut değil'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_profiles', 'teachers', 'students', 'study_logs', 'messages', 'student_daily_plans', 'student_weekly_plans', 'teacher_student_requests')
ORDER BY table_name;

-- institution_id sütunları mevcut mu?
SELECT 
    table_name,
    column_name,
    CASE 
        WHEN column_name = 'institution_id' THEN '✅ Mevcut'
        ELSE '❌ Mevcut değil'
    END as institution_id_status
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('user_profiles', 'teachers', 'students', 'study_logs', 'messages', 'student_daily_plans', 'student_weekly_plans', 'teacher_student_requests')
AND column_name = 'institution_id'
ORDER BY table_name;

-- Hangi tablolar mevcut?
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('user_profiles', 'teachers', 'students', 'study_logs', 'messages', 'student_daily_plans', 'student_weekly_plans', 'teacher_student_requests') 
        THEN '✅ Mevcut'
        ELSE '❌ Mevcut değil'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_profiles', 'teachers', 'students', 'study_logs', 'messages', 'student_daily_plans', 'student_weekly_plans', 'teacher_student_requests')
ORDER BY table_name;

-- ==============================================
-- 2. İMİ KURUMUNU KONTROL ET
-- ==============================================

-- İMİ Anadolu ve Fen Lisesi kurumunu bul
SELECT 
    id,
    name,
    type,
    is_active,
    is_premium,
    created_at
FROM institutions 
WHERE name ILIKE '%İMİ%' OR name ILIKE '%Anadolu%' OR name ILIKE '%Fen%'
ORDER BY created_at DESC;

-- ==============================================
-- 3. MEVCUT VERİ SAYILARINI KONTROL ET
-- ==============================================

-- Kullanıcı sayıları
SELECT 
    'user_profiles' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END) as with_institution,
    COUNT(CASE WHEN institution_id IS NULL THEN 1 END) as without_institution
FROM user_profiles

UNION ALL

SELECT 
    'teachers' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END) as with_institution,
    COUNT(CASE WHEN institution_id IS NULL THEN 1 END) as without_institution
FROM teachers

UNION ALL

SELECT 
    'students' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END) as with_institution,
    COUNT(CASE WHEN institution_id IS NULL THEN 1 END) as without_institution
FROM students

UNION ALL

SELECT 
    'study_logs' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END) as with_institution,
    COUNT(CASE WHEN institution_id IS NULL THEN 1 END) as without_institution
FROM study_logs

UNION ALL

SELECT 
    'messages' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END) as with_institution,
    COUNT(CASE WHEN institution_id IS NULL THEN 1 END) as without_institution
FROM messages

UNION ALL

SELECT 
    'student_daily_plans' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END) as with_institution,
    COUNT(CASE WHEN institution_id IS NULL THEN 1 END) as without_institution
FROM student_daily_plans

UNION ALL

SELECT 
    'student_weekly_plans' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END) as with_institution,
    COUNT(CASE WHEN institution_id IS NULL THEN 1 END) as without_institution
FROM student_weekly_plans;

-- teacher_student_requests kontrolü (eğer varsa)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_student_requests') THEN
        RAISE NOTICE 'teacher_student_requests tablosu mevcut';
    ELSE
        RAISE NOTICE 'teacher_student_requests tablosu mevcut değil';
    END IF;
END $$;

-- ==============================================
-- 4. KURUM ÜYELİKLERİNİ KONTROL ET
-- ==============================================

-- Mevcut kurum üyelikleri
SELECT 
    i.name as institution_name,
    COUNT(im.user_id) as member_count,
    COUNT(CASE WHEN im.role = 'teacher' THEN 1 END) as teacher_count,
    COUNT(CASE WHEN im.role = 'student' THEN 1 END) as student_count
FROM institutions i
LEFT JOIN institution_memberships im ON i.id = im.institution_id
GROUP BY i.id, i.name
ORDER BY member_count DESC;

-- ==============================================
-- 5. MİGRASYON HAZIRLIK DURUMU
-- ==============================================

SELECT 
    'MİGRASYON HAZIRLIK DURUMU' as status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM institutions WHERE name ILIKE '%İMİ%' OR name ILIKE '%Anadolu%' OR name ILIKE '%Fen%') 
        THEN '✅ İMİ kurumu mevcut'
        ELSE '❌ İMİ kurumu bulunamadı'
    END as imi_school_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') 
        THEN '✅ user_profiles mevcut'
        ELSE '❌ user_profiles mevcut değil'
    END as user_profiles_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'institution_memberships') 
        THEN '✅ institution_memberships mevcut'
        ELSE '❌ institution_memberships mevcut değil'
    END as institution_memberships_status;
