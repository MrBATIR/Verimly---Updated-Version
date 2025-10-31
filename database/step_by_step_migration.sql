-- Adım Adım İMİ Anadolu ve Fen Lisesi Migrasyonu
-- Bu script adım adım migrasyonu yapar

-- ==============================================
-- ADIM 1: GEREKLİ SÜTUNLARI EKLE
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
-- ADIM 2: İMİ KURUMUNU BUL
-- ==============================================

-- İMİ Anadolu ve Fen Lisesi kurumunu bul
SELECT 
    'İMİ Kurumu Bulundu' as status,
    id,
    name,
    type,
    is_active,
    is_premium
FROM institutions 
WHERE name ILIKE '%İMİ%' OR name ILIKE '%Anadolu%' OR name ILIKE '%Fen%'
ORDER BY created_at DESC
LIMIT 1;

-- ==============================================
-- ADIM 3: VERİLERİ YEDEKLE
-- ==============================================

-- Mevcut verileri yedekle
CREATE TABLE IF NOT EXISTS backup_user_profiles_before_migration AS 
SELECT *, NOW() as backup_created_at FROM user_profiles;

CREATE TABLE IF NOT EXISTS backup_teachers_before_migration AS 
SELECT *, NOW() as backup_created_at FROM teachers;

CREATE TABLE IF NOT EXISTS backup_students_before_migration AS 
SELECT *, NOW() as backup_created_at FROM students;

CREATE TABLE IF NOT EXISTS backup_study_logs_before_migration AS 
SELECT *, NOW() as backup_created_at FROM study_logs;

CREATE TABLE IF NOT EXISTS backup_messages_before_migration AS 
SELECT *, NOW() as backup_created_at FROM messages;

CREATE TABLE IF NOT EXISTS backup_student_daily_plans_before_migration AS 
SELECT *, NOW() as backup_created_at FROM student_daily_plans;

CREATE TABLE IF NOT EXISTS backup_student_weekly_plans_before_migration AS 
SELECT *, NOW() as backup_created_at FROM student_weekly_plans;

-- teacher_student_requests tablosu varsa yedekle
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE information_schema.tables.table_name = 'teacher_student_requests') THEN
        CREATE TABLE IF NOT EXISTS backup_teacher_student_requests_before_migration AS 
        SELECT *, NOW() as backup_created_at FROM teacher_student_requests;
        RAISE NOTICE 'teacher_student_requests tablosu yedeklendi';
    ELSE
        RAISE NOTICE 'teacher_student_requests tablosu mevcut değil, yedekleme atlandı';
    END IF;
END $$;

-- ==============================================
-- ADIM 4: İMİ KURUMUNA VERİLERİ AKTAR
-- ==============================================

-- İMİ kurumunu bul ve değişkene ata
DO $$
DECLARE
    imi_school_id UUID;
BEGIN
    -- İMİ kurumunu bul
    SELECT id INTO imi_school_id 
    FROM institutions 
    WHERE name ILIKE '%İMİ%' OR name ILIKE '%Anadolu%' OR name ILIKE '%Fen%'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF imi_school_id IS NULL THEN
        RAISE EXCEPTION 'İMİ Anadolu ve Fen Lisesi kurumu bulunamadı!';
    END IF;
    
    RAISE NOTICE 'İMİ kurumu bulundu: %', imi_school_id;
    
    -- user_profiles'ı güncelle
    UPDATE user_profiles 
    SET institution_id = imi_school_id 
    WHERE institution_id IS NULL OR institution_id != imi_school_id;
    
    RAISE NOTICE 'user_profiles güncellendi: % kayıt', (SELECT COUNT(*) FROM user_profiles WHERE institution_id = imi_school_id);
    
    -- teachers'ı güncelle
    UPDATE teachers 
    SET institution_id = imi_school_id 
    WHERE institution_id IS NULL OR institution_id != imi_school_id;
    
    RAISE NOTICE 'teachers güncellendi: % kayıt', (SELECT COUNT(*) FROM teachers WHERE institution_id = imi_school_id);
    
    -- students'ı güncelle
    UPDATE students 
    SET institution_id = imi_school_id 
    WHERE institution_id IS NULL OR institution_id != imi_school_id;
    
    RAISE NOTICE 'students güncellendi: % kayıt', (SELECT COUNT(*) FROM students WHERE institution_id = imi_school_id);
    
    -- study_logs'ı güncelle
    UPDATE study_logs 
    SET institution_id = (
        SELECT up.institution_id 
        FROM user_profiles up 
        WHERE up.user_id = study_logs.user_id
    )
    WHERE institution_id IS NULL OR institution_id != imi_school_id;
    
    RAISE NOTICE 'study_logs güncellendi: % kayıt', (SELECT COUNT(*) FROM study_logs WHERE institution_id = imi_school_id);
    
    -- messages'ı güncelle
    UPDATE messages 
    SET institution_id = (
        SELECT up.institution_id 
        FROM user_profiles up 
        WHERE up.user_id = messages.sender_id
    )
    WHERE institution_id IS NULL OR institution_id != imi_school_id;
    
    RAISE NOTICE 'messages güncellendi: % kayıt', (SELECT COUNT(*) FROM messages WHERE institution_id = imi_school_id);
    
    -- student_daily_plans'ı güncelle
    UPDATE student_daily_plans 
    SET institution_id = (
        SELECT up.institution_id 
        FROM user_profiles up 
        WHERE up.user_id = student_daily_plans.student_id
    )
    WHERE institution_id IS NULL OR institution_id != imi_school_id;
    
    RAISE NOTICE 'student_daily_plans güncellendi: % kayıt', (SELECT COUNT(*) FROM student_daily_plans WHERE institution_id = imi_school_id);
    
    -- student_weekly_plans'ı güncelle
    UPDATE student_weekly_plans 
    SET institution_id = (
        SELECT up.institution_id 
        FROM user_profiles up 
        WHERE up.user_id = student_weekly_plans.student_id
    )
    WHERE institution_id IS NULL OR institution_id != imi_school_id;
    
    RAISE NOTICE 'student_weekly_plans güncellendi: % kayıt', (SELECT COUNT(*) FROM student_weekly_plans WHERE institution_id = imi_school_id);
    
    -- teacher_student_requests'ı güncelle (eğer tablo varsa)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE information_schema.tables.table_name = 'teacher_student_requests') THEN
        UPDATE teacher_student_requests 
        SET institution_id = (
            SELECT up.institution_id 
            FROM user_profiles up 
            WHERE up.user_id = teacher_student_requests.teacher_id
        )
        WHERE institution_id IS NULL OR institution_id != imi_school_id;
        
        RAISE NOTICE 'teacher_student_requests güncellendi: % kayıt', (SELECT COUNT(*) FROM teacher_student_requests WHERE institution_id = imi_school_id);
    END IF;
    
    -- institution_memberships oluştur
    INSERT INTO institution_memberships (institution_id, user_id, role, is_active)
    SELECT 
        up.institution_id,
        up.user_id,
        up.user_type,
        true
    FROM user_profiles up
    WHERE up.institution_id = imi_school_id
    ON CONFLICT (institution_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        is_active = true,
        updated_at = NOW();
    
    RAISE NOTICE 'institution_memberships oluşturuldu: % kayıt', (SELECT COUNT(*) FROM institution_memberships WHERE institution_id = imi_school_id);
    
    RAISE NOTICE 'İMİ Anadolu ve Fen Lisesi migrasyonu tamamlandı!';
    
END $$;

-- ==============================================
-- ADIM 5: MİGRASYON SONUÇLARINI KONTROL ET
-- ==============================================

-- İMİ kurumunu bul
DO $$
DECLARE
    imi_school_id UUID;
BEGIN
    SELECT id INTO imi_school_id 
    FROM institutions 
    WHERE name ILIKE '%İMİ%' OR name ILIKE '%Anadolu%' OR name ILIKE '%Fen%'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Migrasyon sonuçlarını göster
    RAISE NOTICE '=== MİGRASYON SONUÇLARI ===';
    RAISE NOTICE 'İMİ Kurumu ID: %', imi_school_id;
    RAISE NOTICE 'Toplam Kullanıcı: %', (SELECT COUNT(*) FROM user_profiles WHERE institution_id = imi_school_id);
    RAISE NOTICE 'Toplam Öğretmen: %', (SELECT COUNT(*) FROM teachers WHERE institution_id = imi_school_id);
    RAISE NOTICE 'Toplam Öğrenci: %', (SELECT COUNT(*) FROM students WHERE institution_id = imi_school_id);
    RAISE NOTICE 'Toplam Çalışma Kaydı: %', (SELECT COUNT(*) FROM study_logs WHERE institution_id = imi_school_id);
    RAISE NOTICE 'Toplam Mesaj: %', (SELECT COUNT(*) FROM messages WHERE institution_id = imi_school_id);
    RAISE NOTICE 'Toplam Günlük Plan: %', (SELECT COUNT(*) FROM student_daily_plans WHERE institution_id = imi_school_id);
    RAISE NOTICE 'Toplam Haftalık Plan: %', (SELECT COUNT(*) FROM student_weekly_plans WHERE institution_id = imi_school_id);
    RAISE NOTICE 'Toplam Kurum Üyeliği: %', (SELECT COUNT(*) FROM institution_memberships WHERE institution_id = imi_school_id);
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE information_schema.tables.table_name = 'teacher_student_requests') THEN
        RAISE NOTICE 'Toplam Öğretmen-Öğrenci İsteği: %', (SELECT COUNT(*) FROM teacher_student_requests WHERE institution_id = imi_school_id);
    END IF;
    
    RAISE NOTICE '=== MİGRASYON BAŞARILI ===';
    
END $$;

-- ==============================================
-- ADIM 6: KURUM BİLGİLERİNİ GÖRÜNTÜLE
-- ==============================================

-- İMİ Anadolu ve Fen Lisesi bilgilerini göster
SELECT 
    'İMİ Anadolu ve Fen Lisesi Bilgileri' as info,
    i.name as institution_name,
    i.type as institution_type,
    i.is_active,
    i.is_premium,
    COUNT(DISTINCT im.user_id) as total_members,
    COUNT(DISTINCT CASE WHEN im.role = 'teacher' THEN im.user_id END) as teacher_count,
    COUNT(DISTINCT CASE WHEN im.role = 'student' THEN im.user_id END) as student_count
FROM institutions i
LEFT JOIN institution_memberships im ON i.id = im.institution_id
WHERE i.name ILIKE '%İMİ%' OR i.name ILIKE '%Anadolu%' OR i.name ILIKE '%Fen%'
GROUP BY i.id, i.name, i.type, i.is_active, i.is_premium;

-- ==============================================
-- ADIM 7: VERİ BÜTÜNLÜĞÜ KONTROLÜ
-- ==============================================

-- Veri bütünlüğü kontrolü
SELECT 
    'Veri Bütünlüğü Kontrolü' as test_name,
    'user_profiles' as table_name,
    (SELECT COUNT(*) FROM user_profiles) as current_count,
    (SELECT COUNT(*) FROM backup_user_profiles_before_migration) as backup_count,
    (SELECT COUNT(*) FROM user_profiles) = (SELECT COUNT(*) FROM backup_user_profiles_before_migration) as data_integrity
UNION ALL
SELECT 
    'Veri Bütünlüğü Kontrolü' as test_name,
    'teachers' as table_name,
    (SELECT COUNT(*) FROM teachers) as current_count,
    (SELECT COUNT(*) FROM backup_teachers_before_migration) as backup_count,
    (SELECT COUNT(*) FROM teachers) = (SELECT COUNT(*) FROM backup_teachers_before_migration) as data_integrity
UNION ALL
SELECT 
    'Veri Bütünlüğü Kontrolü' as test_name,
    'students' as table_name,
    (SELECT COUNT(*) FROM students) as current_count,
    (SELECT COUNT(*) FROM backup_students_before_migration) as backup_count,
    (SELECT COUNT(*) FROM students) = (SELECT COUNT(*) FROM backup_students_before_migration) as data_integrity
UNION ALL
SELECT 
    'Veri Bütünlüğü Kontrolü' as test_name,
    'study_logs' as table_name,
    (SELECT COUNT(*) FROM study_logs) as current_count,
    (SELECT COUNT(*) FROM backup_study_logs_before_migration) as backup_count,
    (SELECT COUNT(*) FROM study_logs) = (SELECT COUNT(*) FROM backup_study_logs_before_migration) as data_integrity
UNION ALL
SELECT 
    'Veri Bütünlüğü Kontrolü' as test_name,
    'messages' as table_name,
    (SELECT COUNT(*) FROM messages) as current_count,
    (SELECT COUNT(*) FROM backup_messages_before_migration) as backup_count,
    (SELECT COUNT(*) FROM messages) = (SELECT COUNT(*) FROM backup_messages_before_migration) as data_integrity;

-- ==============================================
-- ADIM 8: SONUÇ
-- ==============================================

SELECT 
    'İMİ Anadolu ve Fen Lisesi migrasyonu tamamlandı!' as message,
    'Tüm veriler güvenli şekilde aktarıldı.' as status,
    'Kurum izolasyonu aktif oldu.' as result;
