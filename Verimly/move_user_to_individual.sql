-- otbok@gmail.com kullanıcısını bireysel kullanıcılar kategorisine taşı

-- ==============================================
-- 1. BİREYSEL KULLANICI KURUMUNU KONTROL ET
-- ==============================================

-- Bireysel kullanıcılar kurumunu bul
DO $$
DECLARE
    individual_institution_id UUID;
    user_id_to_move UUID;
BEGIN
    -- Bireysel kullanıcılar kurumunu bul
    SELECT id INTO individual_institution_id
    FROM institutions
    WHERE name = 'Bireysel Kullanıcılar'
    LIMIT 1;
    
    -- Eğer bireysel kullanıcılar kurumu yoksa oluştur
    IF individual_institution_id IS NULL THEN
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
        ) VALUES (
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
        ) RETURNING id INTO individual_institution_id;
        
        RAISE NOTICE 'Bireysel kullanıcılar kurumu oluşturuldu: %', individual_institution_id;
    ELSE
        RAISE NOTICE 'Bireysel kullanıcılar kurumu bulundu: %', individual_institution_id;
    END IF;
    
    -- otbok@gmail.com kullanıcısını bul
    SELECT id INTO user_id_to_move
    FROM auth.users
    WHERE email = 'otbok@gmail.com'
    LIMIT 1;
    
    IF user_id_to_move IS NULL THEN
        RAISE NOTICE 'otbok@gmail.com kullanıcısı bulunamadı';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Kullanıcı bulundu: %', user_id_to_move;
    
    -- ==============================================
    -- 2. KULLANICIYI BİREYSEL KATEGORİSİNE TAŞI
    -- ==============================================
    
    -- Kullanıcının mevcut kurum üyeliğini kaldır
    DELETE FROM institution_memberships
    WHERE user_id = user_id_to_move;
    
    -- Kullanıcıyı bireysel kategorisine taşı
    UPDATE user_profiles
    SET institution_id = individual_institution_id,
        updated_at = NOW()
    WHERE user_id = user_id_to_move;
    
    -- Bireysel kategorisine üyelik oluştur
    INSERT INTO institution_memberships (institution_id, user_id, role, is_active)
    SELECT 
        individual_institution_id,
        user_id_to_move,
        up.user_type,
        true
    FROM user_profiles up
    WHERE up.user_id = user_id_to_move
    ON CONFLICT (institution_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        is_active = true,
        updated_at = NOW();
    
    RAISE NOTICE 'otbok@gmail.com kullanıcısı bireysel kategorisine taşındı';
    
    -- ==============================================
    -- 3. DOĞRULAMA
    -- ==============================================
    
    -- Kullanıcının yeni durumunu kontrol et
    PERFORM 
        up.name,
        up.email,
        up.user_type,
        i.name as institution_name,
        im.role,
        im.is_active
    FROM user_profiles up
    LEFT JOIN institutions i ON up.institution_id = i.id
    LEFT JOIN institution_memberships im ON up.user_id = im.user_id AND im.institution_id = up.institution_id
    WHERE up.user_id = user_id_to_move;
    
END $$;

-- ==============================================
-- 4. SONUÇ RAPORU
-- ==============================================

-- Bireysel kullanıcılar sayısını göster
SELECT 
    'Bireysel Kullanıcılar' as kategori,
    COUNT(*) as kullanici_sayisi
FROM user_profiles up
JOIN institutions i ON up.institution_id = i.id
WHERE i.name = 'Bireysel Kullanıcılar'

UNION ALL

SELECT 
    'Diğer Kurumlar' as kategori,
    COUNT(*) as kullanici_sayisi
FROM user_profiles up
JOIN institutions i ON up.institution_id = i.id
WHERE i.name != 'Bireysel Kullanıcılar';

-- otbok@gmail.com kullanıcısının durumunu göster
SELECT 
    up.name,
    up.email,
    up.user_type,
    i.name as institution_name,
    im.role,
    im.is_active,
    up.updated_at
FROM user_profiles up
LEFT JOIN institutions i ON up.institution_id = i.id
LEFT JOIN institution_memberships im ON up.user_id = im.user_id AND im.institution_id = up.institution_id
WHERE up.email = 'otbok@gmail.com';
