-- Students tablosuna user_id kolonu ekleme
-- Bu script students tablosuna user_id kolonu ekler

-- ==============================================
-- 1. STUDENTS TABLOSUNA USER_ID EKLE
-- ==============================================

-- students tablosuna user_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'students' AND column_name = 'user_id') THEN
        ALTER TABLE students 
        ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'students tablosuna user_id sütunu eklendi';
    ELSE
        RAISE NOTICE 'students tablosunda user_id sütunu zaten mevcut';
    END IF;
END $$;

-- ==============================================
-- 2. MEVCUT KAYITLARI GÜNCELLE
-- ==============================================

-- Mevcut students kayıtlarını user_id ile güncelle
-- Email ile eşleştirme yaparak user_id'leri doldur
UPDATE students 
SET user_id = (
    SELECT id 
    FROM auth.users 
    WHERE auth.users.email = students.email
)
WHERE user_id IS NULL 
AND email IS NOT NULL 
AND email != '';

-- ==============================================
-- 3. KONTROL
-- ==============================================

-- Güncellenen kayıt sayısını kontrol et
SELECT 
    COUNT(*) as total_students,
    COUNT(user_id) as students_with_user_id,
    COUNT(*) - COUNT(user_id) as students_without_user_id
FROM students;
