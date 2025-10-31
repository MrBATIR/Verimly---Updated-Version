-- GÜVENLİ VERİ MİGRASYONU
-- Mevcut verilerinizi yeni kurum yapısına güvenli şekilde aktarır

-- ==============================================
-- 1. MİGRASYON ÖNCESİ KONTROLLER
-- ==============================================

-- Mevcut veri sayılarını kontrol et
CREATE OR REPLACE FUNCTION check_existing_data()
RETURNS TABLE(
    table_name TEXT,
    record_count BIGINT,
    has_data BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'user_profiles'::TEXT,
        COUNT(*),
        COUNT(*) > 0
    FROM user_profiles
    
    UNION ALL
    
    SELECT 
        'teachers'::TEXT,
        COUNT(*),
        COUNT(*) > 0
    FROM teachers
    
    UNION ALL
    
    SELECT 
        'students'::TEXT,
        COUNT(*),
        COUNT(*) > 0
    FROM students
    
    UNION ALL
    
    SELECT 
        'study_logs'::TEXT,
        COUNT(*),
        COUNT(*) > 0
    FROM study_logs
    
    UNION ALL
    
    SELECT 
        'messages'::TEXT,
        COUNT(*),
        COUNT(*) > 0
    FROM messages;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 2. GÜVENLİ MİGRASYON FONKSİYONU
-- ==============================================

CREATE OR REPLACE FUNCTION safe_migrate_to_institution_system()
RETURNS TABLE(
    step_name TEXT,
    status TEXT,
    affected_records BIGINT,
    success BOOLEAN
) AS $$
DECLARE
    default_institution_id UUID;
    migration_start_time TIMESTAMP := NOW();
BEGIN
    -- Adım 1: Varsayılan kurum oluştur
    INSERT INTO institutions (name, type, is_active, is_premium, notes)
    VALUES ('Mevcut Kullanıcılar', 'individual', true, false, 'Mevcut kullanıcılar için varsayılan kurum - ' || migration_start_time::TEXT)
    ON CONFLICT DO NOTHING
    RETURNING id INTO default_institution_id;
    
    -- Eğer kurum zaten varsa ID'sini al
    IF default_institution_id IS NULL THEN
        SELECT id INTO default_institution_id 
        FROM institutions 
        WHERE name = 'Mevcut Kullanıcılar' 
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;
    
    -- Adım 2: user_profiles'ı güncelle
    UPDATE user_profiles 
    SET institution_id = default_institution_id 
    WHERE institution_id IS NULL;
    
    RETURN QUERY SELECT 
        'user_profiles_migration'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM user_profiles WHERE institution_id = default_institution_id),
        true;
    
    -- Adım 3: teachers'ı güncelle
    UPDATE teachers 
    SET institution_id = default_institution_id 
    WHERE institution_id IS NULL;
    
    RETURN QUERY SELECT 
        'teachers_migration'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM teachers WHERE institution_id = default_institution_id),
        true;
    
    -- Adım 4: students'ı güncelle
    UPDATE students 
    SET institution_id = default_institution_id 
    WHERE institution_id IS NULL;
    
    RETURN QUERY SELECT 
        'students_migration'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM students WHERE institution_id = default_institution_id),
        true;
    
    -- Adım 5: study_logs'ı güncelle
    UPDATE study_logs 
    SET institution_id = (
        SELECT up.institution_id 
        FROM user_profiles up 
        WHERE up.user_id = study_logs.user_id
    )
    WHERE institution_id IS NULL;
    
    RETURN QUERY SELECT 
        'study_logs_migration'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM study_logs WHERE institution_id IS NOT NULL),
        true;
    
    -- Adım 6: messages'ı güncelle
    UPDATE messages 
    SET institution_id = (
        SELECT up.institution_id 
        FROM user_profiles up 
        WHERE up.user_id = messages.sender_id
    )
    WHERE institution_id IS NULL;
    
    RETURN QUERY SELECT 
        'messages_migration'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM messages WHERE institution_id IS NOT NULL),
        true;
    
    -- Adım 7: student_daily_plans'ı güncelle
    UPDATE student_daily_plans 
    SET institution_id = (
        SELECT up.institution_id 
        FROM user_profiles up 
        WHERE up.user_id = student_daily_plans.student_id
    )
    WHERE institution_id IS NULL;
    
    RETURN QUERY SELECT 
        'student_daily_plans_migration'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM student_daily_plans WHERE institution_id IS NOT NULL),
        true;
    
    -- Adım 8: student_weekly_plans'ı güncelle
    UPDATE student_weekly_plans 
    SET institution_id = (
        SELECT up.institution_id 
        FROM user_profiles up 
        WHERE up.user_id = student_weekly_plans.student_id
    )
    WHERE institution_id IS NULL;
    
    RETURN QUERY SELECT 
        'student_weekly_plans_migration'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM student_weekly_plans WHERE institution_id IS NOT NULL),
        true;
    
    -- Adım 9: teacher_student_requests'ı güncelle
    UPDATE teacher_student_requests 
    SET institution_id = (
        SELECT up.institution_id 
        FROM user_profiles up 
        WHERE up.user_id = teacher_student_requests.teacher_id
    )
    WHERE institution_id IS NULL;
    
    RETURN QUERY SELECT 
        'teacher_student_requests_migration'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM teacher_student_requests WHERE institution_id IS NOT NULL),
        true;
    
    -- Adım 10: institution_memberships oluştur
    INSERT INTO institution_memberships (institution_id, user_id, role, is_active)
    SELECT 
        up.institution_id,
        up.user_id,
        up.user_type,
        true
    FROM user_profiles up
    WHERE up.institution_id IS NOT NULL
    ON CONFLICT (institution_id, user_id) DO NOTHING;
    
    RETURN QUERY SELECT 
        'institution_memberships_creation'::TEXT,
        'Tamamlandı'::TEXT,
        (SELECT COUNT(*) FROM institution_memberships WHERE institution_id = default_institution_id),
        true;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 3. MİGRASYON DOĞRULAMA
-- ==============================================

CREATE OR REPLACE FUNCTION verify_migration_success()
RETURNS TABLE(
    table_name TEXT,
    total_records BIGINT,
    records_with_institution BIGINT,
    migration_success_rate NUMERIC,
    data_integrity BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'user_profiles'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
            2
        ),
        COUNT(*) = (SELECT COUNT(*) FROM backup_user_profiles)
    FROM user_profiles
    
    UNION ALL
    
    SELECT 
        'teachers'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
            2
        ),
        COUNT(*) = (SELECT COUNT(*) FROM backup_teachers)
    FROM teachers
    
    UNION ALL
    
    SELECT 
        'students'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
            2
        ),
        COUNT(*) = (SELECT COUNT(*) FROM backup_students)
    FROM students
    
    UNION ALL
    
    SELECT 
        'study_logs'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
            2
        ),
        COUNT(*) = (SELECT COUNT(*) FROM backup_study_logs)
    FROM study_logs
    
    UNION ALL
    
    SELECT 
        'messages'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
            2
        ),
        COUNT(*) = (SELECT COUNT(*) FROM backup_messages)
    FROM messages;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 4. ROLLBACK FONKSİYONU
-- ==============================================

CREATE OR REPLACE FUNCTION rollback_migration_safe()
RETURNS TABLE(
    step_name TEXT,
    status TEXT,
    affected_records BIGINT,
    success BOOLEAN
) AS $$
BEGIN
    -- institution_id sütunlarını NULL yap
    UPDATE user_profiles SET institution_id = NULL;
    UPDATE teachers SET institution_id = NULL;
    UPDATE students SET institution_id = NULL;
    UPDATE study_logs SET institution_id = NULL;
    UPDATE messages SET institution_id = NULL;
    UPDATE student_daily_plans SET institution_id = NULL;
    UPDATE student_weekly_plans SET institution_id = NULL;
    UPDATE teacher_student_requests SET institution_id = NULL;
    
    -- institution_memberships'i temizle
    DELETE FROM institution_memberships WHERE institution_id = (
        SELECT id FROM institutions WHERE name = 'Mevcut Kullanıcılar'
    );
    
    RETURN QUERY SELECT 
        'rollback_completed'::TEXT,
        'Tamamlandı'::TEXT,
        0::BIGINT,
        true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 5. MİGRASYON ÇALIŞTIRMA
-- ==============================================

-- Mevcut veri durumunu kontrol et
SELECT 'Mevcut veri durumu:' as info;
SELECT * FROM check_existing_data();

-- Migrasyonu çalıştır
SELECT 'Migrasyon başlatıldı...' as status;
SELECT * FROM safe_migrate_to_institution_system();

-- Migrasyon sonrası doğrulama
SELECT 'Migrasyon doğrulaması:' as info;
SELECT * FROM verify_migration_success();

-- ==============================================
-- 6. KULLANIM ÖRNEKLERİ
-- ==============================================

-- Mevcut veri durumunu kontrol et
-- SELECT * FROM check_existing_data();

-- Migrasyonu çalıştır
-- SELECT * FROM safe_migrate_to_institution_system();

-- Migrasyon durumunu kontrol et
-- SELECT * FROM verify_migration_success();

-- Rollback yap (gerekirse)
-- SELECT * FROM rollback_migration_safe();

