-- MEVCUT VERİLERİN GÜVENLİ YEDEKLEMESİ
-- Bu dosya mevcut tüm verilerinizi yedekler

-- ==============================================
-- 1. YEDEKLEME TABLOLARI OLUŞTUR
-- ==============================================

-- user_profiles yedeği
CREATE TABLE IF NOT EXISTS backup_user_profiles AS 
SELECT *, NOW() as backup_created_at FROM user_profiles;

-- teachers yedeği
CREATE TABLE IF NOT EXISTS backup_teachers AS 
SELECT *, NOW() as backup_created_at FROM teachers;

-- students yedeği
CREATE TABLE IF NOT EXISTS backup_students AS 
SELECT *, NOW() as backup_created_at FROM students;

-- study_logs yedeği
CREATE TABLE IF NOT EXISTS backup_study_logs AS 
SELECT *, NOW() as backup_created_at FROM study_logs;

-- messages yedeği
CREATE TABLE IF NOT EXISTS backup_messages AS 
SELECT *, NOW() as backup_created_at FROM messages;

-- student_daily_plans yedeği
CREATE TABLE IF NOT EXISTS backup_student_daily_plans AS 
SELECT *, NOW() as backup_created_at FROM student_daily_plans;

-- student_weekly_plans yedeği
CREATE TABLE IF NOT EXISTS backup_student_weekly_plans AS 
SELECT *, NOW() as backup_created_at FROM student_weekly_plans;

-- teacher_student_requests yedeği
CREATE TABLE IF NOT EXISTS backup_teacher_student_requests AS 
SELECT *, NOW() as backup_created_at FROM teacher_student_requests;

-- user_ad_watches yedeği
CREATE TABLE IF NOT EXISTS backup_user_ad_watches AS 
SELECT *, NOW() as backup_created_at FROM user_ad_watches;

-- user_premium yedeği
CREATE TABLE IF NOT EXISTS backup_user_premium AS 
SELECT *, NOW() as backup_created_at FROM user_premium;

-- ==============================================
-- 2. YEDEKLEME DOĞRULAMA
-- ==============================================

-- Yedekleme durumunu kontrol et
CREATE OR REPLACE FUNCTION verify_backup()
RETURNS TABLE(
    table_name TEXT,
    original_count BIGINT,
    backup_count BIGINT,
    backup_success BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'user_profiles'::TEXT,
        (SELECT COUNT(*) FROM user_profiles),
        (SELECT COUNT(*) FROM backup_user_profiles),
        (SELECT COUNT(*) FROM user_profiles) = (SELECT COUNT(*) FROM backup_user_profiles)
    
    UNION ALL
    
    SELECT 
        'teachers'::TEXT,
        (SELECT COUNT(*) FROM teachers),
        (SELECT COUNT(*) FROM backup_teachers),
        (SELECT COUNT(*) FROM teachers) = (SELECT COUNT(*) FROM backup_teachers)
    
    UNION ALL
    
    SELECT 
        'students'::TEXT,
        (SELECT COUNT(*) FROM students),
        (SELECT COUNT(*) FROM backup_students),
        (SELECT COUNT(*) FROM students) = (SELECT COUNT(*) FROM backup_students)
    
    UNION ALL
    
    SELECT 
        'study_logs'::TEXT,
        (SELECT COUNT(*) FROM study_logs),
        (SELECT COUNT(*) FROM backup_study_logs),
        (SELECT COUNT(*) FROM study_logs) = (SELECT COUNT(*) FROM backup_study_logs)
    
    UNION ALL
    
    SELECT 
        'messages'::TEXT,
        (SELECT COUNT(*) FROM messages),
        (SELECT COUNT(*) FROM backup_messages),
        (SELECT COUNT(*) FROM messages) = (SELECT COUNT(*) FROM backup_messages);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 3. YEDEKLEME ÇALIŞTIRMA
-- ==============================================

-- Yedekleme durumunu kontrol et
SELECT 'Yedekleme başlatıldı' as status;

-- Yedekleme doğrulama
SELECT * FROM verify_backup();

-- ==============================================
-- 4. YEDEKLEME BİLGİLERİ
-- ==============================================

-- Yedeklenen veri sayıları
SELECT 
    'user_profiles' as table_name,
    COUNT(*) as record_count,
    MIN(backup_created_at) as backup_time
FROM backup_user_profiles

UNION ALL

SELECT 
    'teachers' as table_name,
    COUNT(*) as record_count,
    MIN(backup_created_at) as backup_time
FROM backup_teachers

UNION ALL

SELECT 
    'students' as table_name,
    COUNT(*) as record_count,
    MIN(backup_created_at) as backup_time
FROM backup_students

UNION ALL

SELECT 
    'study_logs' as table_name,
    COUNT(*) as record_count,
    MIN(backup_created_at) as backup_time
FROM backup_study_logs

UNION ALL

SELECT 
    'messages' as table_name,
    COUNT(*) as record_count,
    MIN(backup_created_at) as backup_time
FROM backup_messages;

