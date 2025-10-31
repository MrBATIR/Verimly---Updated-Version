-- Bireysel Kullanıcılar kurumundaki öğrencilerin institution_id'sini düzelt

-- 1. Önce institution_id'si NULL olan öğrencileri bul
SELECT 
    s.id,
    s.name,
    s.email,
    s.institution_id,
    s.user_id
FROM students s
WHERE s.institution_id IS NULL;

-- 2. Bu öğrencilerin institution_memberships tablosundaki kurum bilgilerini al
SELECT 
    s.id as student_id,
    s.name,
    s.email,
    s.user_id,
    im.institution_id,
    im.role
FROM students s
JOIN institution_memberships im ON s.user_id = im.user_id
WHERE s.institution_id IS NULL
  AND im.institution_id = '6cc4ae9f-2b2f-4015-b90e-248d11a2df94'; -- Bireysel Kullanıcılar kurumu ID'si

-- 3. Institution_id'si NULL olan öğrencileri düzelt
UPDATE students 
SET institution_id = '6cc4ae9f-2b2f-4015-b90e-248d11a2df94'
WHERE institution_id IS NULL 
  AND user_id IN (
    SELECT user_id 
    FROM institution_memberships 
    WHERE institution_id = '6cc4ae9f-2b2f-4015-b90e-248d11a2df94'
  );

-- 4. Düzeltme sonrası kontrol
SELECT 
    COUNT(*) as total_students,
    COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END) as with_institution,
    COUNT(CASE WHEN institution_id IS NULL THEN 1 END) as without_institution
FROM students;

-- 5. Bireysel Kullanıcılar kurumundaki öğrenci sayısını kontrol et
SELECT COUNT(*) as bireysel_kullanici_ogrenci_sayisi
FROM students 
WHERE institution_id = '6cc4ae9f-2b2f-4015-b90e-248d11a2df94';
