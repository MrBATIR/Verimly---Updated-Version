-- Ahmet Kağan Sarı öğrencisinin çift üyelik sorununu düzelt
-- Sadece "Osman Batır - Özel Öğrenci" kurumunda kalacak
-- "İMİ Anadolu ve Fen Lisesi" kurumundaki üyeliği kaldırılacak

-- 1. Önce öğrencinin user_id'sini bul
DO $$
DECLARE
    student_user_id UUID;
    osman_batir_institution_id UUID;
    imi_institution_id UUID;
BEGIN
    -- Öğrencinin user_id'sini bul (isim ile)
    SELECT user_id INTO student_user_id
    FROM user_profiles
    WHERE LOWER(name) LIKE '%ahmet%kağan%sarı%'
       OR LOWER(name) LIKE '%ahmet kağan sarı%'
       OR (LOWER(name) LIKE '%ahmet%' AND LOWER(name) LIKE '%kağan%' AND LOWER(name) LIKE '%sarı%')
    LIMIT 1;

    -- Kurum ID'lerini bul
    SELECT id INTO osman_batir_institution_id
    FROM institutions
    WHERE name LIKE '%Osman Batır%Özel Öğrenci%'
       OR name LIKE '%Osman Batır - Özel Öğrenci%';

    SELECT id INTO imi_institution_id
    FROM institutions
    WHERE name LIKE '%İMİ Anadolu%'
       OR name LIKE '%İMİ Anadolu ve Fen Lisesi%';

    -- Kontrol: Eğer bulunamazsa hata ver
    IF student_user_id IS NULL THEN
        RAISE EXCEPTION 'Öğrenci bulunamadı: Ahmet Kağan Sarı';
    END IF;

    IF osman_batir_institution_id IS NULL THEN
        RAISE EXCEPTION 'Kurum bulunamadı: Osman Batır - Özel Öğrenci';
    END IF;

    IF imi_institution_id IS NULL THEN
        RAISE EXCEPTION 'Kurum bulunamadı: İMİ Anadolu ve Fen Lisesi';
    END IF;

    -- İMİ Anadolu ve Fen Lisesi kurumundaki üyeliği pasif et
    UPDATE institution_memberships
    SET is_active = false,
        updated_at = NOW()
    WHERE user_id = student_user_id
      AND institution_id = imi_institution_id
      AND role = 'student';

    -- Osman Batır - Özel Öğrenci kurumundaki üyeliği aktif et (varsa)
    UPDATE institution_memberships
    SET is_active = true,
        updated_at = NOW()
    WHERE user_id = student_user_id
      AND institution_id = osman_batir_institution_id
      AND role = 'student';

    -- Eğer Osman Batır kurumunda üyelik yoksa oluştur
    IF NOT EXISTS (
        SELECT 1 FROM institution_memberships
        WHERE user_id = student_user_id
          AND institution_id = osman_batir_institution_id
    ) THEN
        INSERT INTO institution_memberships (user_id, institution_id, role, is_active, joined_at)
        VALUES (student_user_id, osman_batir_institution_id, 'student', true, NOW());
    END IF;

    RAISE NOTICE 'İşlem tamamlandı! Ahmet Kağan Sarı artık sadece Osman Batır - Özel Öğrenci kurumunda.';
END $$;

-- Sonucu kontrol et
SELECT 
    up.name AS student_name,
    i.name AS institution_name,
    im.is_active,
    im.joined_at
FROM institution_memberships im
JOIN user_profiles up ON im.user_id = up.user_id
JOIN institutions i ON im.institution_id = i.id
WHERE LOWER(up.name) LIKE '%ahmet%kağan%sarı%'
   OR LOWER(up.name) LIKE '%ahmet kağan sarı%'
ORDER BY im.is_active DESC, i.name;

