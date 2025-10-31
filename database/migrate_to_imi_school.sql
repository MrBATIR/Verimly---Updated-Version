-- İMİ Anadolu ve Fen Lisesi'ne Veri Migrasyonu
-- Mevcut tüm verileri bu kuruma aktarır

-- ==============================================
-- 1. MİGRASYON ÖNCESİ YEDEKLEME
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
    END IF;
END $$;

-- ==============================================
-- 2. GEREKLİ SÜTUNLARI EKLE
-- ==============================================

-- teachers tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'teachers' AND column_name = 'institution_id') THEN
        ALTER TABLE teachers 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- students tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'students' AND column_name = 'institution_id') THEN
        ALTER TABLE students 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- study_logs tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'study_logs' AND column_name = 'institution_id') THEN
        ALTER TABLE study_logs 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- messages tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'institution_id') THEN
        ALTER TABLE messages 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- student_daily_plans tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'student_daily_plans' AND column_name = 'institution_id') THEN
        ALTER TABLE student_daily_plans 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- student_weekly_plans tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'student_weekly_plans' AND column_name = 'institution_id') THEN
        ALTER TABLE student_weekly_plans 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
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
        END IF;
    END IF;
END $$;

-- ==============================================
-- 3. İMİ ANADOLU VE FEN LİSESİ KURUMUNU BUL
-- ==============================================

-- İMİ Anadolu ve Fen Lisesi kurumunu bul
CREATE OR REPLACE FUNCTION find_imi_school()
RETURNS UUID AS $$
DECLARE
    imi_school_id UUID;
BEGIN
    SELECT id INTO imi_school_id 
    FROM institutions 
    WHERE name ILIKE '%İMİ%' OR name ILIKE '%Anadolu%' OR name ILIKE '%Fen%'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF imi_school_id IS NULL THEN
        RAISE EXCEPTION 'İMİ Anadolu ve Fen Lisesi kurumu bulunamadı!';
    END IF;
    
    RETURN imi_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 3. GÜVENLİ MİGRASYON FONKSİYONU
-- ==============================================

CREATE OR REPLACE FUNCTION migrate_all_data_to_imi_school()
RETURNS TABLE(
    step_name TEXT,
    status TEXT,
    affected_records BIGINT,
    success BOOLEAN
) AS $$
DECLARE
    imi_school_id UUID;
    migration_start_time TIMESTAMP := NOW();
BEGIN
    -- İMİ okulunu bul
    SELECT find_imi_school() INTO imi_school_id;
    
    -- Adım 1: user_profiles'ı güncelle
    UPDATE user_profiles 
    SET institution_id = imi_school_id 
    WHERE institution_id IS NULL OR institution_id != imi_school_id;
    
    RETURN QUERY SELECT 
        'user_profiles_migration'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM user_profiles WHERE institution_id = imi_school_id),
        true;
    
    -- Adım 2: teachers'ı güncelle
    UPDATE teachers 
    SET institution_id = imi_school_id 
    WHERE institution_id IS NULL OR institution_id != imi_school_id;
    
    RETURN QUERY SELECT 
        'teachers_migration'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM teachers WHERE institution_id = imi_school_id),
        true;
    
    -- Adım 3: students'ı güncelle
    UPDATE students 
    SET institution_id = imi_school_id 
    WHERE institution_id IS NULL OR institution_id != imi_school_id;
    
    RETURN QUERY SELECT 
        'students_migration'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM students WHERE institution_id = imi_school_id),
        true;
    
    -- Adım 4: study_logs'ı güncelle
    UPDATE study_logs 
    SET institution_id = (
        SELECT up.institution_id 
        FROM user_profiles up 
        WHERE up.user_id = study_logs.user_id
    )
    WHERE institution_id IS NULL OR institution_id != imi_school_id;
    
    RETURN QUERY SELECT 
        'study_logs_migration'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM study_logs WHERE institution_id = imi_school_id),
        true;
    
    -- Adım 5: messages'ı güncelle
    UPDATE messages 
    SET institution_id = (
        SELECT up.institution_id 
        FROM user_profiles up 
        WHERE up.user_id = messages.sender_id
    )
    WHERE institution_id IS NULL OR institution_id != imi_school_id;
    
    RETURN QUERY SELECT 
        'messages_migration'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM messages WHERE institution_id = imi_school_id),
        true;
    
    -- Adım 6: student_daily_plans'ı güncelle
    UPDATE student_daily_plans 
    SET institution_id = (
        SELECT up.institution_id 
        FROM user_profiles up 
        WHERE up.user_id = student_daily_plans.student_id
    )
    WHERE institution_id IS NULL OR institution_id != imi_school_id;
    
    RETURN QUERY SELECT 
        'student_daily_plans_migration'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM student_daily_plans WHERE institution_id = imi_school_id),
        true;
    
    -- Adım 7: student_weekly_plans'ı güncelle
    UPDATE student_weekly_plans 
    SET institution_id = (
        SELECT up.institution_id 
        FROM user_profiles up 
        WHERE up.user_id = student_weekly_plans.student_id
    )
    WHERE institution_id IS NULL OR institution_id != imi_school_id;
    
    RETURN QUERY SELECT 
        'student_weekly_plans_migration'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM student_weekly_plans WHERE institution_id = imi_school_id),
        true;
    
    -- Adım 8: teacher_student_requests'ı güncelle (eğer tablo varsa)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE information_schema.tables.table_name = 'teacher_student_requests') THEN
        UPDATE teacher_student_requests 
        SET institution_id = (
            SELECT up.institution_id 
            FROM user_profiles up 
            WHERE up.user_id = teacher_student_requests.teacher_id
        )
        WHERE institution_id IS NULL OR institution_id != imi_school_id;
        
        RETURN QUERY SELECT 
            'teacher_student_requests_migration'::TEXT,
            'Tamamlandı'::TEXT,
            (SELECT COUNT(*) FROM teacher_student_requests WHERE institution_id = imi_school_id),
            true;
    ELSE
        RETURN QUERY SELECT 
            'teacher_student_requests_migration'::TEXT,
            'Tablo mevcut değil'::TEXT,
            0::BIGINT,
            true;
    END IF;
    
    -- Adım 9: institution_memberships oluştur
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
    
    RETURN QUERY SELECT 
        'institution_memberships_creation'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM institution_memberships WHERE institution_id = imi_school_id),
        true;
    
    -- Adım 10: Kurum istatistikleri
    RETURN QUERY SELECT 
        'migration_summary'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM user_profiles WHERE institution_id = imi_school_id),
        true;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 4. MİGRASYON DOĞRULAMA
-- ==============================================

CREATE OR REPLACE FUNCTION verify_imi_migration()
RETURNS TABLE(
    table_name TEXT,
    total_records BIGINT,
    records_with_imi_institution BIGINT,
    migration_success_rate NUMERIC,
    data_integrity BOOLEAN
) AS $$
DECLARE
    imi_school_id UUID;
BEGIN
    -- İMİ okulunu bul
    SELECT find_imi_school() INTO imi_school_id;
    
    -- user_profiles kontrolü
    RETURN QUERY
    SELECT 
        'user_profiles'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id = imi_school_id THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id = imi_school_id THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
            2
        ),
        COUNT(*) = (SELECT COUNT(*) FROM backup_user_profiles_before_migration)
    FROM user_profiles;
    
    -- teachers kontrolü
    RETURN QUERY
    SELECT 
        'teachers'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id = imi_school_id THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id = imi_school_id THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
            2
        ),
        COUNT(*) = (SELECT COUNT(*) FROM backup_teachers_before_migration)
    FROM teachers;
    
    -- students kontrolü
    RETURN QUERY
    SELECT 
        'students'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id = imi_school_id THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id = imi_school_id THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
            2
        ),
        COUNT(*) = (SELECT COUNT(*) FROM backup_students_before_migration)
    FROM students;
    
    -- study_logs kontrolü
    RETURN QUERY
    SELECT 
        'study_logs'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id = imi_school_id THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id = imi_school_id THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
            2
        ),
        COUNT(*) = (SELECT COUNT(*) FROM backup_study_logs_before_migration)
    FROM study_logs;
    
    -- messages kontrolü
    RETURN QUERY
    SELECT 
        'messages'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id = imi_school_id THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id = imi_school_id THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
            2
        ),
        COUNT(*) = (SELECT COUNT(*) FROM backup_messages_before_migration)
    FROM messages;
    
    -- student_daily_plans kontrolü
    RETURN QUERY
    SELECT 
        'student_daily_plans'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id = imi_school_id THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id = imi_school_id THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
            2
        ),
        COUNT(*) = (SELECT COUNT(*) FROM backup_student_daily_plans_before_migration)
    FROM student_daily_plans;
    
    -- student_weekly_plans kontrolü
    RETURN QUERY
    SELECT 
        'student_weekly_plans'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id = imi_school_id THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id = imi_school_id THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
            2
        ),
        COUNT(*) = (SELECT COUNT(*) FROM backup_student_weekly_plans_before_migration)
    FROM student_weekly_plans;
    
    -- teacher_student_requests kontrolü (eğer tablo varsa)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE information_schema.tables.table_name = 'teacher_student_requests') THEN
        RETURN QUERY
        SELECT 
            'teacher_student_requests'::TEXT,
            COUNT(*),
            COUNT(CASE WHEN institution_id = imi_school_id THEN 1 END),
            ROUND(
                (COUNT(CASE WHEN institution_id = imi_school_id THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
                2
            ),
            COUNT(*) = (SELECT COUNT(*) FROM backup_teacher_student_requests_before_migration)
        FROM teacher_student_requests;
    END IF;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 5. KURUM BİLGİLERİNİ GÖRÜNTÜLE
-- ==============================================

CREATE OR REPLACE FUNCTION get_imi_school_info()
RETURNS TABLE(
    institution_id UUID,
    institution_name VARCHAR(255),
    institution_type VARCHAR(50),
    contact_email VARCHAR(255),
    is_active BOOLEAN,
    is_premium BOOLEAN,
    total_members BIGINT,
    teacher_count BIGINT,
    student_count BIGINT,
    study_logs_count BIGINT,
    messages_count BIGINT
) AS $$
DECLARE
    imi_school_id UUID;
BEGIN
    -- İMİ okulunu bul
    SELECT find_imi_school() INTO imi_school_id;
    
    RETURN QUERY
    SELECT 
        i.id,
        i.name,
        i.type,
        i.contact_email,
        i.is_active,
        i.is_premium,
        COUNT(DISTINCT im.user_id) as total_members,
        COUNT(DISTINCT CASE WHEN im.role = 'teacher' THEN im.user_id END) as teacher_count,
        COUNT(DISTINCT CASE WHEN im.role = 'student' THEN im.user_id END) as student_count,
        (SELECT COUNT(*) FROM study_logs WHERE institution_id = imi_school_id) as study_logs_count,
        (SELECT COUNT(*) FROM messages WHERE institution_id = imi_school_id) as messages_count
    FROM institutions i
    LEFT JOIN institution_memberships im ON i.id = im.institution_id
    WHERE i.id = imi_school_id
    GROUP BY i.id, i.name, i.type, i.contact_email, i.is_active, i.is_premium;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 6. MİGRASYON ÇALIŞTIRMA
-- ==============================================

-- Migrasyonu çalıştır
SELECT 'İMİ Anadolu ve Fen Lisesi migrasyonu başlatıldı...' as status;

-- İMİ okulunu bul
SELECT find_imi_school() as imi_school_id;

-- Migrasyonu çalıştır
SELECT * FROM migrate_all_data_to_imi_school();

-- Migrasyon sonrası doğrulama
SELECT 'Migrasyon doğrulaması:' as info;
SELECT * FROM verify_imi_migration();

-- Kurum bilgilerini göster
SELECT 'İMİ Anadolu ve Fen Lisesi bilgileri:' as info;
SELECT * FROM get_imi_school_info();

-- ==============================================
-- 7. KULLANIM ÖRNEKLERİ
-- ==============================================

-- İMİ okulunu bul
-- SELECT find_imi_school();

-- Migrasyonu çalıştır
-- SELECT * FROM migrate_all_data_to_imi_school();

-- Migrasyon durumunu kontrol et
-- SELECT * FROM verify_imi_migration();

-- Kurum bilgilerini göster
-- SELECT * FROM get_imi_school_info();

