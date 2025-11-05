-- imitest@imitest.com için name senkronizasyonu
-- students.name'i user_profiles.name'e göre güncelle (students.name doğru görünüyor)

-- Önce mevcut durumu göster
SELECT 
  'BEFORE FIX' as status,
  up.user_id,
  up.name as user_profiles_name,
  s.name as students_name
FROM user_profiles up
LEFT JOIN students s ON s.user_id = up.user_id
WHERE up.email = 'imitest@imitest.com';

-- user_profiles.name'i students.name'e göre güncelle
UPDATE user_profiles up
SET name = s.name,
    updated_at = NOW()
FROM students s
WHERE up.user_id = s.user_id
  AND up.email = 'imitest@imitest.com'
  AND up.name != s.name;

-- Sonra durumu kontrol et
SELECT 
  'AFTER FIX' as status,
  up.user_id,
  up.name as user_profiles_name,
  s.name as students_name,
  CASE 
    WHEN up.name = s.name THEN 'Synced ✓' 
    ELSE 'Still Different ✗' 
  END as sync_status
FROM user_profiles up
LEFT JOIN students s ON s.user_id = up.user_id
WHERE up.email = 'imitest@imitest.com';


