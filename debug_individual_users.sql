-- Bireysel Kullanıcılar kurumunun durumunu kontrol et

-- 1. Bireysel Kullanıcılar kurumunun ID'sini bul
SELECT id, name, is_active, is_premium 
FROM institutions 
WHERE name = 'Bireysel Kullanıcılar';

-- 2. Bu kuruma bağlı öğrencileri say
SELECT COUNT(*) as student_count
FROM students 
WHERE institution_id = (
    SELECT id FROM institutions WHERE name = 'Bireysel Kullanıcılar'
);

-- 3. Bu kuruma bağlı öğrencilerin detaylarını göster
SELECT 
    s.id,
    s.name,
    s.email,
    s.institution_id,
    s.created_at
FROM students s
WHERE s.institution_id = (
    SELECT id FROM institutions WHERE name = 'Bireysel Kullanıcılar'
)
ORDER BY s.created_at DESC;

-- 4. Institution memberships tablosunda bu kurumun üyeleri var mı?
SELECT COUNT(*) as membership_count
FROM institution_memberships 
WHERE institution_id = (
    SELECT id FROM institutions WHERE name = 'Bireysel Kullanıcılar'
);

-- 5. User profiles tablosunda bu kurumun üyeleri var mı?
SELECT COUNT(*) as profile_count
FROM user_profiles 
WHERE institution_id = (
    SELECT id FROM institutions WHERE name = 'Bireysel Kullanıcılar'
);

-- 6. Tüm kurumların öğrenci sayılarını karşılaştır
SELECT 
    i.name as kurum_adi,
    COUNT(s.id) as ogrenci_sayisi
FROM institutions i
LEFT JOIN students s ON i.id = s.institution_id
GROUP BY i.name
ORDER BY ogrenci_sayisi DESC;
