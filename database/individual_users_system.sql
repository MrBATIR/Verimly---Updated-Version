-- Bireysel Kullanıcılar Sistemi
-- Kuruma bağlı olmayan, doğrudan uygulamayı kullanan kullanıcılar için

-- ==============================================
-- 1. BİREYSEL KULLANICI KATEGORİSİ
-- ==============================================

-- Bireysel kullanıcılar için özel kurum oluştur
-- Bireysel kullanıcılar kurumunu oluştur (eğer yoksa)
INSERT INTO institutions (
    id,
    name,
    type,
    contact_email,
    contact_phone,
    address,
    admin_user_id,
    is_premium,
    is_active,
    premium_start_date,
    premium_end_date,
    auto_renewal,
    max_teachers,
    max_students,
    contract_start_date,
    contract_end_date,
    payment_status,
    notes,
    created_at,
    updated_at
) 
SELECT 
    gen_random_uuid(),
    'Bireysel Kullanıcılar',
    'individual',
    'support@verimly.com',
    NULL,
    'Bireysel kullanıcılar için özel kategori',
    NULL,
    false,
    true,
    NULL,
    NULL,
    false,
    0,
    0,
    NULL,
    NULL,
    'active',
    'Play Store ve App Store üzerinden kayıt olan bireysel kullanıcılar',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM institutions WHERE name = 'Bireysel Kullanıcılar'
);

-- ==============================================
-- 2. BİREYSEL KULLANICI TANIMLAMA
-- ==============================================

-- Bireysel kullanıcıları tanımlayan fonksiyon
CREATE OR REPLACE FUNCTION is_individual_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_institution_id UUID;
    institution_name VARCHAR(255);
BEGIN
    -- Kullanıcının kurumunu bul
    SELECT up.institution_id, i.name
    INTO user_institution_id, institution_name
    FROM user_profiles up
    LEFT JOIN institutions i ON up.institution_id = i.id
    WHERE up.user_id = p_user_id;
    
    -- Bireysel kullanıcılar kurumuna atanmış mı kontrol et
    RETURN institution_name = 'Bireysel Kullanıcılar';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bireysel kullanıcıları listele
CREATE OR REPLACE FUNCTION get_individual_users()
RETURNS TABLE(
    user_id UUID,
    name VARCHAR(255),
    email VARCHAR(255),
    user_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.user_id,
        up.name,
        up.email,
        up.user_type,
        up.created_at,
        up.updated_at as last_login
    FROM user_profiles up
    JOIN institutions i ON up.institution_id = i.id
    WHERE i.name = 'Bireysel Kullanıcılar'
    ORDER BY up.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 3. BİREYSEL KULLANICI İSTATİSTİKLERİ
-- ==============================================

-- Bireysel kullanıcı istatistikleri
CREATE OR REPLACE FUNCTION get_individual_users_stats()
RETURNS TABLE(
    total_users BIGINT,
    total_students BIGINT,
    total_teachers BIGINT,
    active_users_today BIGINT,
    new_users_this_week BIGINT,
    new_users_this_month BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN up.user_type = 'student' THEN 1 END) as total_students,
        COUNT(CASE WHEN up.user_type = 'teacher' THEN 1 END) as total_teachers,
        COUNT(CASE WHEN up.updated_at >= CURRENT_DATE THEN 1 END) as active_users_today,
        COUNT(CASE WHEN up.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_users_this_week,
        COUNT(CASE WHEN up.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_this_month
    FROM user_profiles up
    JOIN institutions i ON up.institution_id = i.id
    WHERE i.name = 'Bireysel Kullanıcılar';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 4. BİREYSEL KULLANICI YÖNETİMİ
-- ==============================================

-- Bireysel kullanıcıyı kuruma taşı
CREATE OR REPLACE FUNCTION move_individual_user_to_institution(
    p_user_id UUID,
    p_institution_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    individual_institution_id UUID;
BEGIN
    -- Bireysel kullanıcılar kurumunu bul
    SELECT id INTO individual_institution_id
    FROM institutions
    WHERE name = 'Bireysel Kullanıcılar'
    LIMIT 1;
    
    -- Kullanıcının bireysel kullanıcı olduğunu kontrol et
    IF NOT is_individual_user(p_user_id) THEN
        RAISE EXCEPTION 'Kullanıcı bireysel kullanıcı değil';
    END IF;
    
    -- Kullanıcıyı yeni kuruma taşı
    UPDATE user_profiles
    SET institution_id = p_institution_id,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Kurum üyeliği oluştur
    INSERT INTO institution_memberships (institution_id, user_id, role, is_active)
    SELECT 
        p_institution_id,
        p_user_id,
        up.user_type,
        true
    FROM user_profiles up
    WHERE up.user_id = p_user_id
    ON CONFLICT (institution_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        is_active = true,
        updated_at = NOW();
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bireysel kullanıcıyı geri bireysel kategorisine taşı
CREATE OR REPLACE FUNCTION move_user_to_individual(
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    individual_institution_id UUID;
BEGIN
    -- Bireysel kullanıcılar kurumunu bul
    SELECT id INTO individual_institution_id
    FROM institutions
    WHERE name = 'Bireysel Kullanıcılar'
    LIMIT 1;
    
    -- Kullanıcıyı bireysel kategorisine taşı
    UPDATE user_profiles
    SET institution_id = individual_institution_id,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Eski kurum üyeliğini kaldır
    DELETE FROM institution_memberships
    WHERE user_id = p_user_id;
    
    -- Bireysel kategorisine üyelik oluştur
    INSERT INTO institution_memberships (institution_id, user_id, role, is_active)
    SELECT 
        individual_institution_id,
        p_user_id,
        up.user_type,
        true
    FROM user_profiles up
    WHERE up.user_id = p_user_id
    ON CONFLICT (institution_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        is_active = true,
        updated_at = NOW();
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 5. MEVCUT BİREYSEL KULLANICILARI TAŞI
-- ==============================================

-- Mevcut bireysel kullanıcıları (kuruma atanmamış) bireysel kategorisine taşı
DO $$
DECLARE
    individual_institution_id UUID;
    user_record RECORD;
BEGIN
    -- Bireysel kullanıcılar kurumunu bul
    SELECT id INTO individual_institution_id
    FROM institutions
    WHERE name = 'Bireysel Kullanıcılar'
    LIMIT 1;
    
    -- Kuruma atanmamış kullanıcıları bul ve taşı
    FOR user_record IN 
        SELECT up.user_id, up.user_type
        FROM user_profiles up
        WHERE up.institution_id IS NULL
    LOOP
        -- Kullanıcıyı bireysel kategorisine taşı
        UPDATE user_profiles
        SET institution_id = individual_institution_id,
            updated_at = NOW()
        WHERE user_id = user_record.user_id;
        
        -- Bireysel kategorisine üyelik oluştur
        INSERT INTO institution_memberships (institution_id, user_id, role, is_active)
        VALUES (individual_institution_id, user_record.user_id, user_record.user_type, true)
        ON CONFLICT (institution_id, user_id) DO UPDATE SET
            role = user_record.user_type,
            is_active = true,
            updated_at = NOW();
    END LOOP;
    
    RAISE NOTICE 'Bireysel kullanıcılar taşındı';
END $$;

-- ==============================================
-- 6. BİREYSEL KULLANICI RAPORLARI
-- ==============================================

-- Bireysel kullanıcı detay raporu
CREATE OR REPLACE FUNCTION get_individual_user_report()
RETURNS TABLE(
    report_type TEXT,
    total_count BIGINT,
    percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH total_users AS (
        SELECT COUNT(*) as total FROM user_profiles
    ),
    individual_users AS (
        SELECT COUNT(*) as individual_count
        FROM user_profiles up
        JOIN institutions i ON up.institution_id = i.id
        WHERE i.name = 'Bireysel Kullanıcılar'
    ),
    institution_users AS (
        SELECT COUNT(*) as institution_count
        FROM user_profiles up
        JOIN institutions i ON up.institution_id = i.id
        WHERE i.name != 'Bireysel Kullanıcılar'
    )
    SELECT 
        'Bireysel Kullanıcılar'::TEXT,
        individual_users.individual_count,
        ROUND((individual_users.individual_count::NUMERIC / total_users.total) * 100, 2)
    FROM individual_users, total_users
    
    UNION ALL
    
    SELECT 
        'Kurum Kullanıcıları'::TEXT,
        institution_users.institution_count,
        ROUND((institution_users.institution_count::NUMERIC / total_users.total) * 100, 2)
    FROM institution_users, total_users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 7. BİREYSEL KULLANICI ÖZELLİKLERİ
-- ==============================================

-- Bireysel kullanıcılar için özel özellikler
CREATE OR REPLACE FUNCTION get_individual_user_features(p_user_id UUID)
RETURNS TABLE(
    feature_name TEXT,
    is_available BOOLEAN,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'Reklam İzleme'::TEXT,
        true,
        'Bireysel kullanıcılar reklam izleyerek premium özellikler kazanabilir'::TEXT
    
    UNION ALL
    
    SELECT 
        'Premium Satın Alma'::TEXT,
        true,
        'Bireysel kullanıcılar premium üyelik satın alabilir'::TEXT
    
    UNION ALL
    
    SELECT 
        'Kurum Bağlantısı'::TEXT,
        false,
        'Bireysel kullanıcılar kuruma bağlanamaz'::TEXT
    
    UNION ALL
    
    SELECT 
        'Öğretmen Bağlantısı'::TEXT,
        true,
        'Bireysel öğrenciler öğretmenlere bağlanabilir'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 8. SONUÇ VE DOĞRULAMA
-- ==============================================

-- Bireysel kullanıcılar sistemini doğrula
SELECT 
    'Bireysel Kullanıcılar Sistemi Kuruldu' as status,
    (SELECT COUNT(*) FROM institutions WHERE name = 'Bireysel Kullanıcılar') as institution_created,
    (SELECT COUNT(*) FROM user_profiles up 
     JOIN institutions i ON up.institution_id = i.id 
     WHERE i.name = 'Bireysel Kullanıcılar') as individual_users_count,
    (SELECT COUNT(*) FROM institutions WHERE name != 'Bireysel Kullanıcılar') as other_institutions_count;

-- Bireysel kullanıcı istatistiklerini göster
SELECT * FROM get_individual_users_stats();

-- Bireysel kullanıcı raporunu göster
SELECT * FROM get_individual_user_report();
