-- ==============================================
-- OSMAN BATIR ÇOKLU KURUM ÜYELİĞİ DÜZELTMESİ
-- ==============================================
-- Bu script Osman Batır öğretmenini hem İMİ Anadolu ve Fen Lisesi
-- hem de Osman Batır- Özel Öğrenci kurumunda görünecek şekilde ayarlar

DO $$
DECLARE
    osman_user_id UUID;
    imi_institution_id UUID;
    osman_private_institution_id UUID;
    current_institution_id UUID;
BEGIN
    -- ==============================================
    -- 1. KULLANICI VE KURUMLARI BUL
    -- ==============================================
    
    -- Osman Batır kullanıcısını bul
    SELECT id INTO osman_user_id
    FROM auth.users
    WHERE email = 'osmanbatir@imikoleji.k12.tr'
    LIMIT 1;
    
    IF osman_user_id IS NULL THEN
        RAISE NOTICE 'Osman Batır kullanıcısı bulunamadı (osmanbatir@imikoleji.k12.tr)';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Osman Batır kullanıcısı bulundu: %', osman_user_id;
    
    -- İMİ Anadolu ve Fen Lisesi kurumunu bul
    SELECT id INTO imi_institution_id
    FROM institutions
    WHERE name ILIKE '%İMİ%' OR name ILIKE '%Anadolu%' OR name ILIKE '%Fen%'
    LIMIT 1;
    
    IF imi_institution_id IS NULL THEN
        RAISE NOTICE 'İMİ Anadolu ve Fen Lisesi kurumu bulunamadı';
        RETURN;
    END IF;
    
    RAISE NOTICE 'İMİ Anadolu ve Fen Lisesi kurumu bulundu: %', imi_institution_id;
    
    -- Osman Batır- Özel Öğrenci kurumunu bul
    SELECT id INTO osman_private_institution_id
    FROM institutions
    WHERE name ILIKE '%Osman%' OR name ILIKE '%Batır%' OR name ILIKE '%Özel%'
    LIMIT 1;
    
    IF osman_private_institution_id IS NULL THEN
        RAISE NOTICE 'Osman Batır- Özel Öğrenci kurumu bulunamadı';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Osman Batır- Özel Öğrenci kurumu bulundu: %', osman_private_institution_id;
    
    -- ==============================================
    -- 2. MEVCUT DURUMU KONTROL ET
    -- ==============================================
    
    -- Kullanıcının mevcut kurumunu kontrol et
    SELECT institution_id INTO current_institution_id
    FROM user_profiles
    WHERE user_id = osman_user_id;
    
    RAISE NOTICE 'Osman Batır''ın mevcut kurumu: %', current_institution_id;
    
    -- ==============================================
    -- 3. ÇOKLU KURUM ÜYELİĞİ OLUŞTUR
    -- ==============================================
    
    -- İMİ Anadolu ve Fen Lisesi'ne üyelik ekle
    INSERT INTO institution_memberships (institution_id, user_id, role, is_active, joined_at)
    VALUES (imi_institution_id, osman_user_id, 'teacher', true, NOW())
    ON CONFLICT (institution_id, user_id) DO UPDATE SET
        role = 'teacher',
        is_active = true,
        updated_at = NOW();
    
    RAISE NOTICE 'İMİ Anadolu ve Fen Lisesi üyeliği eklendi/güncellendi';
    
    -- Osman Batır- Özel Öğrenci kurumuna üyelik ekle
    INSERT INTO institution_memberships (institution_id, user_id, role, is_active, joined_at)
    VALUES (osman_private_institution_id, osman_user_id, 'teacher', true, NOW())
    ON CONFLICT (institution_id, user_id) DO UPDATE SET
        role = 'teacher',
        is_active = true,
        updated_at = NOW();
    
    RAISE NOTICE 'Osman Batır- Özel Öğrenci kurumu üyeliği eklendi/güncellendi';
    
    -- ==============================================
    -- 4. USER_PROFILES GÜNCELLEME
    -- ==============================================
    
    -- Ana kurum olarak İMİ Anadolu ve Fen Lisesi'ni ayarla
    UPDATE user_profiles
    SET institution_id = imi_institution_id,
        updated_at = NOW()
    WHERE user_id = osman_user_id;
    
    RAISE NOTICE 'User profile ana kurum olarak İMİ Anadolu ve Fen Lisesi olarak güncellendi';
    
    -- ==============================================
    -- 5. DOĞRULAMA
    -- ==============================================
    
    -- Sonucu kontrol et
    RAISE NOTICE '=== OSMAN BATIR ÇOKLU KURUM ÜYELİĞİ SONUCU ===';
    
    -- User profile bilgisi
    PERFORM 
        up.name,
        up.email,
        up.user_type,
        i.name as primary_institution
    FROM user_profiles up
    LEFT JOIN institutions i ON up.institution_id = i.id
    WHERE up.user_id = osman_user_id;
    
    -- Tüm kurum üyelikleri
    PERFORM 
        im.institution_id,
        i.name as institution_name,
        im.role,
        im.is_active,
        im.joined_at
    FROM institution_memberships im
    LEFT JOIN institutions i ON im.institution_id = i.id
    WHERE im.user_id = osman_user_id
    ORDER BY im.joined_at;
    
    RAISE NOTICE 'Osman Batır artık her iki kurumda da görünecek!';
    
END $$;
