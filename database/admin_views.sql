-- Ana Admin İçin Özel Görünümler
-- Ana admin tüm kurumları görebilir ama detaylı verilere erişemez

-- ==============================================
-- 1. KURUM ÖZET GÖRÜNÜMÜ
-- ==============================================

CREATE OR REPLACE VIEW admin_institution_summary AS
SELECT 
    i.id,
    i.name,
    i.type,
    i.contact_email,
    i.contact_phone,
    i.is_active,
    i.is_premium,
    i.contract_start_date,
    i.contract_end_date,
    i.payment_status,
    i.created_at,
    -- Kurum istatistikleri
    COUNT(DISTINCT im.user_id) as total_members,
    COUNT(DISTINCT CASE WHEN im.role = 'teacher' THEN im.user_id END) as teacher_count,
    COUNT(DISTINCT CASE WHEN im.role = 'student' THEN im.user_id END) as student_count,
    COUNT(DISTINCT CASE WHEN im.role = 'admin' THEN im.user_id END) as admin_count,
    -- Aktif üye sayısı
    COUNT(DISTINCT CASE WHEN im.is_active = true THEN im.user_id END) as active_members
FROM institutions i
LEFT JOIN institution_memberships im ON i.id = im.institution_id
GROUP BY i.id, i.name, i.type, i.contact_email, i.contact_phone, 
         i.is_active, i.is_premium, i.contract_start_date, i.contract_end_date, 
         i.payment_status, i.created_at;

-- ==============================================
-- 2. KURUM ÜYE LİSTESİ GÖRÜNÜMÜ
-- ==============================================

CREATE OR REPLACE VIEW admin_institution_members AS
SELECT 
    i.id as institution_id,
    i.name as institution_name,
    im.user_id,
    up.name as user_name,
    up.email as user_email,
    im.role,
    im.is_active,
    im.joined_at,
    -- Kullanıcı tipi
    CASE 
        WHEN t.user_id IS NOT NULL THEN 'teacher'
        WHEN s.user_id IS NOT NULL THEN 'student'
        ELSE 'other'
    END as user_type
FROM institutions i
JOIN institution_memberships im ON i.id = im.institution_id
JOIN user_profiles up ON im.user_id = up.user_id
LEFT JOIN teachers t ON im.user_id = t.user_id
LEFT JOIN students s ON im.user_id = s.user_id
ORDER BY i.name, im.role, up.name;

-- ==============================================
-- 3. KURUM AKTİVİTE GÖRÜNÜMÜ
-- ==============================================

CREATE OR REPLACE VIEW admin_institution_activity AS
SELECT 
    i.id as institution_id,
    i.name as institution_name,
    -- Son 30 günlük aktivite
    COUNT(DISTINCT sl.id) as study_logs_count,
    COUNT(DISTINCT m.id) as messages_count,
    COUNT(DISTINCT sdp.id) as daily_plans_count,
    COUNT(DISTINCT swp.id) as weekly_plans_count,
    -- Son aktivite tarihi
    MAX(GREATEST(
        COALESCE(sl.created_at, '1900-01-01'::timestamp),
        COALESCE(m.created_at, '1900-01-01'::timestamp),
        COALESCE(sdp.created_at, '1900-01-01'::timestamp),
        COALESCE(swp.created_at, '1900-01-01'::timestamp)
    )) as last_activity
FROM institutions i
LEFT JOIN user_profiles up ON i.id = up.institution_id
LEFT JOIN study_logs sl ON up.user_id = sl.user_id AND sl.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN messages m ON up.user_id = m.sender_id AND m.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN student_daily_plans sdp ON up.user_id = sdp.student_id AND sdp.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN student_weekly_plans swp ON up.user_id = swp.student_id AND swp.created_at >= NOW() - INTERVAL '30 days'
GROUP BY i.id, i.name;

-- ==============================================
-- 4. KURUM SÖZLEŞME TAKİP GÖRÜNÜMÜ
-- ==============================================

CREATE OR REPLACE VIEW admin_contract_tracking AS
SELECT 
    i.id as institution_id,
    i.name as institution_name,
    i.contract_start_date,
    i.contract_end_date,
    i.payment_status,
    i.is_active,
    -- Sözleşme durumu
    CASE 
        WHEN i.contract_end_date IS NULL THEN 'Sözleşme Yok'
        WHEN i.contract_end_date < CURRENT_DATE THEN 'Süresi Dolmuş'
        WHEN i.contract_end_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Yakında Dolacak'
        ELSE 'Aktif'
    END as contract_status,
    -- Kalan gün sayısı
    CASE 
        WHEN i.contract_end_date IS NOT NULL THEN 
            EXTRACT(DAY FROM i.contract_end_date - CURRENT_DATE)
        ELSE NULL
    END as days_remaining
FROM institutions i
ORDER BY i.contract_end_date ASC;

-- ==============================================
-- 5. KURUM PERFORMANS GÖRÜNÜMÜ
-- ==============================================

CREATE OR REPLACE VIEW admin_institution_performance AS
SELECT 
    i.id as institution_id,
    i.name as institution_name,
    i.type,
    -- Üye sayıları
    COUNT(DISTINCT im.user_id) as total_members,
    COUNT(DISTINCT CASE WHEN im.role = 'teacher' AND im.is_active = true THEN im.user_id END) as active_teachers,
    COUNT(DISTINCT CASE WHEN im.role = 'student' AND im.is_active = true THEN im.user_id END) as active_students,
    -- Son 30 günlük aktivite
    COUNT(DISTINCT sl.id) as study_logs_30d,
    COUNT(DISTINCT m.id) as messages_30d,
    -- Ortalama çalışma süresi (son 30 gün)
    AVG(sl.duration) as avg_study_duration_30d,
    -- Toplam çalışma süresi (son 30 gün)
    SUM(sl.duration) as total_study_duration_30d
FROM institutions i
LEFT JOIN institution_memberships im ON i.id = im.institution_id
LEFT JOIN user_profiles up ON im.user_id = up.user_id
LEFT JOIN study_logs sl ON up.user_id = sl.user_id AND sl.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN messages m ON up.user_id = m.sender_id AND m.created_at >= NOW() - INTERVAL '30 days'
GROUP BY i.id, i.name, i.type;

-- ==============================================
-- 6. ANA ADMIN İÇİN ÖZEL FONKSİYONLAR
-- ==============================================

-- Kurum detaylarını getir (üye listesi ile)
CREATE OR REPLACE FUNCTION get_institution_details(p_institution_id UUID)
RETURNS TABLE(
    institution_id UUID,
    institution_name VARCHAR(255),
    institution_type VARCHAR(50),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    is_active BOOLEAN,
    is_premium BOOLEAN,
    contract_start_date DATE,
    contract_end_date DATE,
    payment_status VARCHAR(20),
    total_members BIGINT,
    active_members BIGINT,
    teacher_count BIGINT,
    student_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.name,
        i.type,
        i.contact_email,
        i.contact_phone,
        i.is_active,
        i.is_premium,
        i.contract_start_date,
        i.contract_end_date,
        i.payment_status,
        COUNT(DISTINCT im.user_id) as total_members,
        COUNT(DISTINCT CASE WHEN im.is_active = true THEN im.user_id END) as active_members,
        COUNT(DISTINCT CASE WHEN im.role = 'teacher' THEN im.user_id END) as teacher_count,
        COUNT(DISTINCT CASE WHEN im.role = 'student' THEN im.user_id END) as student_count
    FROM institutions i
    LEFT JOIN institution_memberships im ON i.id = im.institution_id
    WHERE i.id = p_institution_id
    GROUP BY i.id, i.name, i.type, i.contact_email, i.contact_phone, 
             i.is_active, i.is_premium, i.contract_start_date, i.contract_end_date, 
             i.payment_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kurum üyelerini listele
CREATE OR REPLACE FUNCTION get_institution_members(p_institution_id UUID)
RETURNS TABLE(
    user_id UUID,
    user_name VARCHAR(255),
    user_email VARCHAR(255),
    role VARCHAR(20),
    is_active BOOLEAN,
    joined_at TIMESTAMP WITH TIME ZONE,
    user_type VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        im.user_id,
        up.name as user_name,
        up.email as user_email,
        im.role,
        im.is_active,
        im.joined_at,
        CASE 
            WHEN t.user_id IS NOT NULL THEN 'teacher'
            WHEN s.user_id IS NOT NULL THEN 'student'
            ELSE 'other'
        END as user_type
    FROM institution_memberships im
    JOIN user_profiles up ON im.user_id = up.user_id
    LEFT JOIN teachers t ON im.user_id = t.user_id
    LEFT JOIN students s ON im.user_id = s.user_id
    WHERE im.institution_id = p_institution_id
    ORDER BY im.role, up.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 7. GÜVENLİK POLİTİKALARI
-- ==============================================

-- Ana admin görünümlerine erişim politikaları
-- Bu görünümler sadece ana admin tarafından kullanılabilir
-- Gerçek uygulamada ana admin kullanıcı ID'si ile kontrol edilmeli

-- ==============================================
-- 8. KULLANIM ÖRNEKLERİ
-- ==============================================

-- Tüm kurumları listele
-- SELECT * FROM admin_institution_summary ORDER BY created_at DESC;

-- Belirli bir kurumun detaylarını getir
-- SELECT * FROM get_institution_details('kurum-id-buraya');

-- Belirli bir kurumun üyelerini listele
-- SELECT * FROM get_institution_members('kurum-id-buraya');

-- Sözleşme takibi
-- SELECT * FROM admin_contract_tracking WHERE contract_status = 'Yakında Dolacak';

-- Kurum performansı
-- SELECT * FROM admin_institution_performance ORDER BY total_study_duration_30d DESC;

