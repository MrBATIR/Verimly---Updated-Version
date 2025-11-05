-- imitest@imitest.com kullanıcısının tüm bilgilerini kontrol et

-- 1. Auth kullanıcısı bilgileri
SELECT 
  'Auth User' as table_name,
  id,
  email,
  created_at,
  updated_at
FROM auth.users
WHERE email = 'imitest@imitest.com';

-- 2. User Profiles tablosu
SELECT 
  'User Profiles' as table_name,
  up.user_id,
  up.name,
  up.email,
  up.user_type,
  up.created_at,
  up.updated_at
FROM user_profiles up
WHERE up.email = 'imitest@imitest.com';

-- 3. Students tablosu
SELECT 
  'Students' as table_name,
  s.id,
  s.user_id,
  s.name,
  s.email,
  s.school,
  s.grade,
  s.phone,
  s.parent_name,
  s.parent_phone,
  s.address,
  s.notes,
  s.institution_id,
  s.created_at,
  s.updated_at
FROM students s
WHERE s.email = 'imitest@imitest.com'
   OR s.user_id IN (
     SELECT user_id FROM user_profiles WHERE email = 'imitest@imitest.com'
   );

-- 4. Institution Memberships
SELECT 
  'Institution Memberships' as table_name,
  im.id,
  im.user_id,
  im.institution_id,
  im.role,
  im.is_active,
  im.joined_at,
  im.created_at
FROM institution_memberships im
WHERE im.user_id IN (
  SELECT user_id FROM user_profiles WHERE email = 'imitest@imitest.com'
)
AND im.is_active = true;

-- 5. Kurum bilgileri
SELECT 
  'Institution' as table_name,
  i.id,
  i.name as institution_name,
  i.contact_email,
  i.is_active,
  i.is_premium
FROM institutions i
WHERE i.id IN (
  SELECT institution_id FROM institution_memberships 
  WHERE user_id IN (
    SELECT user_id FROM user_profiles WHERE email = 'imitest@imitest.com'
  )
  AND is_active = true
);

-- 6. Karşılaştırma: user_profiles.name vs students.name
SELECT 
  'Comparison' as table_name,
  up.user_id,
  up.name as user_profiles_name,
  up.email as user_profiles_email,
  s.name as students_name,
  s.email as students_email,
  CASE 
    WHEN up.name = s.name THEN 'Match' 
    ELSE 'MISMATCH - FIX NEEDED' 
  END as name_match_status,
  up.updated_at as user_profiles_updated,
  s.updated_at as students_updated
FROM user_profiles up
LEFT JOIN students s ON s.user_id = up.user_id
WHERE up.email = 'imitest@imitest.com';

