-- Veri Migrasyonu Planı
-- Mevcut verileri koruyarak kurum izolasyonu sistemine geçiş

-- ==============================================
-- 1. MİGRASYON ÖNCESİ YEDEKLEME
-- ==============================================

-- Önemli tabloları yedekle
CREATE TABLE IF NOT EXISTS backup_user_profiles AS SELECT * FROM user_profiles;
CREATE TABLE IF NOT EXISTS backup_teachers AS SELECT * FROM teachers;
CREATE TABLE IF NOT EXISTS backup_students AS SELECT * FROM students;
CREATE TABLE IF NOT EXISTS backup_study_logs AS SELECT * FROM study_logs;
CREATE TABLE IF NOT EXISTS backup_messages AS SELECT * FROM messages;
CREATE TABLE IF NOT EXISTS backup_student_daily_plans AS SELECT * FROM student_daily_plans;
CREATE TABLE IF NOT EXISTS backup_student_weekly_plans AS SELECT * FROM student_weekly_plans;
CREATE TABLE IF NOT EXISTS backup_teacher_student_requests AS SELECT * FROM teacher_student_requests;

-- ==============================================
-- 2. MİGRASYON ADIMLARI
-- ==============================================

-- Adım 1: Varsayılan kurum oluştur
INSERT INTO institutions (name, type, is_active, is_premium, notes)
VALUES ('Mevcut Kullanıcılar', 'individual', true, false, 'Mevcut kullanıcılar için varsayılan kurum')
ON CONFLICT DO NOTHING;

-- Adım 2: Mevcut kullanıcıları varsayılan kuruma ata
UPDATE user_profiles 
SET institution_id = (
    SELECT id FROM institutions 
    WHERE name = 'Mevcut Kullanıcılar' 
    LIMIT 1
)
WHERE institution_id IS NULL;

UPDATE teachers 
SET institution_id = (
    SELECT id FROM institutions 
    WHERE name = 'Mevcut Kullanıcılar' 
    LIMIT 1
)
WHERE institution_id IS NULL;

UPDATE students 
SET institution_id = (
    SELECT id FROM institutions 
    WHERE name = 'Mevcut Kullanıcılar' 
    LIMIT 1
)
WHERE institution_id IS NULL;

-- Adım 3: Çalışma kayıtlarını kurum bazlı güncelle
UPDATE study_logs 
SET institution_id = (
    SELECT up.institution_id 
    FROM user_profiles up 
    WHERE up.user_id = study_logs.user_id
)
WHERE institution_id IS NULL;

-- Adım 4: Mesajları kurum bazlı güncelle
UPDATE messages 
SET institution_id = (
    SELECT up.institution_id 
    FROM user_profiles up 
    WHERE up.user_id = messages.sender_id
)
WHERE institution_id IS NULL;

-- Adım 5: Öğrenci planlarını kurum bazlı güncelle
UPDATE student_daily_plans 
SET institution_id = (
    SELECT up.institution_id 
    FROM user_profiles up 
    WHERE up.user_id = student_daily_plans.student_id
)
WHERE institution_id IS NULL;

UPDATE student_weekly_plans 
SET institution_id = (
    SELECT up.institution_id 
    FROM user_profiles up 
    WHERE up.user_id = student_weekly_plans.student_id
)
WHERE institution_id IS NULL;

-- Adım 6: Öğretmen-öğrenci isteklerini kurum bazlı güncelle
UPDATE teacher_student_requests 
SET institution_id = (
    SELECT up.institution_id 
    FROM user_profiles up 
    WHERE up.user_id = teacher_student_requests.teacher_id
)
WHERE institution_id IS NULL;

-- ==============================================
-- 3. KURUM ÜYELİKLERİNİ OLUŞTUR
-- ==============================================

-- Tüm kullanıcıları varsayılan kuruma üye olarak ekle
INSERT INTO institution_memberships (institution_id, user_id, role, is_active)
SELECT 
    up.institution_id,
    up.user_id,
    up.user_type,
    true
FROM user_profiles up
WHERE up.institution_id IS NOT NULL
ON CONFLICT (institution_id, user_id) DO NOTHING;

-- ==============================================
-- 4. MİGRASYON DOĞRULAMA
-- ==============================================

-- Migrasyon sonrası kontrol sorguları
CREATE OR REPLACE FUNCTION verify_migration()
RETURNS TABLE(
    table_name TEXT,
    total_records BIGINT,
    records_with_institution BIGINT,
    migration_success_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'user_profiles'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END)::NUMERIC / COUNT(*)) * 100, 
            2
        )
    FROM user_profiles
    
    UNION ALL
    
    SELECT 
        'teachers'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END)::NUMERIC / COUNT(*)) * 100, 
            2
        )
    FROM teachers
    
    UNION ALL
    
    SELECT 
        'students'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END)::NUMERIC / COUNT(*)) * 100, 
            2
        )
    FROM students
    
    UNION ALL
    
    SELECT 
        'study_logs'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END)::NUMERIC / COUNT(*)) * 100, 
            2
        )
    FROM study_logs
    
    UNION ALL
    
    SELECT 
        'messages'::TEXT,
        COUNT(*),
        COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END),
        ROUND(
            (COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END)::NUMERIC / COUNT(*)) * 100, 
            2
        )
    FROM messages;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 5. ROLLBACK FONKSİYONU
-- ==============================================

-- Gerekirse geri dönüş için
CREATE OR REPLACE FUNCTION rollback_migration()
RETURNS VOID AS $$
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
    
    -- Yedek tabloları geri yükle (isteğe bağlı)
    -- DELETE FROM user_profiles;
    -- INSERT INTO user_profiles SELECT * FROM backup_user_profiles;
    -- ... diğer tablolar için de aynı işlem
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 6. MİGRASYON ÇALIŞTIRMA
-- ==============================================

-- Migrasyonu çalıştır
SELECT 'Migration started' as status;

-- Migrasyon sonrası doğrulama
SELECT * FROM verify_migration();

-- ==============================================
-- 7. KULLANIM ÖRNEKLERİ
-- ==============================================

-- Migrasyon durumunu kontrol et
-- SELECT * FROM verify_migration();

-- Belirli bir kurumun üyelerini listele
-- SELECT * FROM get_institution_members('kurum-id-buraya');

-- Tüm kurumları listele
-- SELECT * FROM admin_institution_summary;

-- Sözleşme takibi
-- SELECT * FROM admin_contract_tracking;

