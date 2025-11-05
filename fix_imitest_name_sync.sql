-- imitest@imitest.com kullanıcısının name alanlarını senkronize et
-- students.name'i user_profiles.name'e göre güncelle (veya tersi)

-- Önce mevcut durumu kontrol et
SELECT 
  'BEFORE FIX' as status,
  up.user_id,
  up.name as user_profiles_name,
  s.name as students_name
FROM user_profiles up
LEFT JOIN students s ON s.user_id = up.user_id
WHERE up.email = 'imitest@imitest.com';

-- Seçenek 1: students.name'i user_profiles.name'e göre güncelle (eğer user_profiles doğruysa)
-- UPDATE students s
-- SET name = up.name
-- FROM user_profiles up
-- WHERE s.user_id = up.user_id
--   AND up.email = 'imitest@imitest.com'
--   AND s.name != up.name;

-- Seçenek 2: user_profiles.name'i students.name'e göre güncelle (eğer students doğruysa)
-- UPDATE user_profiles up
-- SET name = s.name
-- FROM students s
-- WHERE up.user_id = s.user_id
--   AND up.email = 'imitest@imitest.com'
--   AND up.name != s.name;

-- Sonra durumu kontrol et
SELECT 
  'AFTER FIX' as status,
  up.user_id,
  up.name as user_profiles_name,
  s.name as students_name,
  CASE 
    WHEN up.name = s.name THEN 'Synced' 
    ELSE 'Still Different' 
  END as sync_status
FROM user_profiles up
LEFT JOIN students s ON s.user_id = up.user_id
WHERE up.email = 'imitest@imitest.com';

