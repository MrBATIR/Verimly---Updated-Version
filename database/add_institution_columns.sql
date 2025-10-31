-- Kurum Sütunları Ekleme Scripti
-- Bu script tüm tablolara institution_id sütunu ekler

-- ==============================================
-- 1. GEREKLİ SÜTUNLARI EKLE
-- ==============================================

-- teachers tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'teachers' AND column_name = 'institution_id') THEN
        ALTER TABLE teachers 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
        RAISE NOTICE 'teachers tablosuna institution_id sütunu eklendi';
    ELSE
        RAISE NOTICE 'teachers tablosunda institution_id sütunu zaten mevcut';
    END IF;
END $$;

-- students tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'students' AND column_name = 'institution_id') THEN
        ALTER TABLE students 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
        RAISE NOTICE 'students tablosuna institution_id sütunu eklendi';
    ELSE
        RAISE NOTICE 'students tablosunda institution_id sütunu zaten mevcut';
    END IF;
END $$;

-- study_logs tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'study_logs' AND column_name = 'institution_id') THEN
        ALTER TABLE study_logs 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
        RAISE NOTICE 'study_logs tablosuna institution_id sütunu eklendi';
    ELSE
        RAISE NOTICE 'study_logs tablosunda institution_id sütunu zaten mevcut';
    END IF;
END $$;

-- messages tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'institution_id') THEN
        ALTER TABLE messages 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
        RAISE NOTICE 'messages tablosuna institution_id sütunu eklendi';
    ELSE
        RAISE NOTICE 'messages tablosunda institution_id sütunu zaten mevcut';
    END IF;
END $$;

-- student_daily_plans tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'student_daily_plans' AND column_name = 'institution_id') THEN
        ALTER TABLE student_daily_plans 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
        RAISE NOTICE 'student_daily_plans tablosuna institution_id sütunu eklendi';
    ELSE
        RAISE NOTICE 'student_daily_plans tablosunda institution_id sütunu zaten mevcut';
    END IF;
END $$;

-- student_weekly_plans tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'student_weekly_plans' AND column_name = 'institution_id') THEN
        ALTER TABLE student_weekly_plans 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
        RAISE NOTICE 'student_weekly_plans tablosuna institution_id sütunu eklendi';
    ELSE
        RAISE NOTICE 'student_weekly_plans tablosunda institution_id sütunu zaten mevcut';
    END IF;
END $$;

-- teacher_student_requests tablosuna institution_id ekle (eğer tablo varsa ve sütun yoksa)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE information_schema.tables.table_name = 'teacher_student_requests') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE information_schema.columns.table_name = 'teacher_student_requests' AND information_schema.columns.column_name = 'institution_id') THEN
            ALTER TABLE teacher_student_requests 
            ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
            RAISE NOTICE 'teacher_student_requests tablosuna institution_id sütunu eklendi';
        ELSE
            RAISE NOTICE 'teacher_student_requests tablosunda institution_id sütunu zaten mevcut';
        END IF;
    ELSE
        RAISE NOTICE 'teacher_student_requests tablosu mevcut değil, atlanıyor';
    END IF;
END $$;

-- ==============================================
-- 2. SÜTUN EKLEME DURUMUNU KONTROL ET
-- ==============================================

-- institution_id sütunları mevcut mu?
SELECT 
    table_name,
    CASE 
        WHEN column_name = 'institution_id' THEN '✅ Mevcut'
        ELSE '❌ Mevcut değil'
    END as institution_id_status
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('user_profiles', 'teachers', 'students', 'study_logs', 'messages', 'student_daily_plans', 'student_weekly_plans', 'teacher_student_requests')
AND column_name = 'institution_id'
ORDER BY table_name;

-- ==============================================
-- 3. MİGRASYON HAZIRLIK DURUMU
-- ==============================================

SELECT 
    'SÜTUN EKLEME DURUMU' as status,
    COUNT(CASE WHEN column_name = 'institution_id' THEN 1 END) as institution_id_columns_added,
    COUNT(*) as total_required_columns
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('user_profiles', 'teachers', 'students', 'study_logs', 'messages', 'student_daily_plans', 'student_weekly_plans', 'teacher_student_requests')
AND column_name = 'institution_id';

-- ==============================================
-- 4. SONUÇ
-- ==============================================

SELECT 
    'Sütun ekleme işlemi tamamlandı!' as message,
    'Artık migrasyon scriptini çalıştırabilirsiniz.' as next_step;
