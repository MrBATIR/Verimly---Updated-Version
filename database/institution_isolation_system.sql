-- Kurum İzolasyonu Sistemi
-- Her kurumun kendi verilerine sahip olduğu, birbirlerini göremediği sistem

-- ==============================================
-- 1. MEVCUT TABLOLARI KURUM BAZLI GÜNCELLEME
-- ==============================================

-- user_profiles tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'institution_id') THEN
        ALTER TABLE user_profiles 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- teachers tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'teachers' AND column_name = 'institution_id') THEN
        ALTER TABLE teachers 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- students tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'students' AND column_name = 'institution_id') THEN
        ALTER TABLE students 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- study_logs tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'study_logs' AND column_name = 'institution_id') THEN
        ALTER TABLE study_logs 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- messages tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'institution_id') THEN
        ALTER TABLE messages 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- student_daily_plans tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'student_daily_plans' AND column_name = 'institution_id') THEN
        ALTER TABLE student_daily_plans 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- student_weekly_plans tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'student_weekly_plans' AND column_name = 'institution_id') THEN
        ALTER TABLE student_weekly_plans 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- teacher_student_requests tablosuna institution_id ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'teacher_student_requests' AND column_name = 'institution_id') THEN
        ALTER TABLE teacher_student_requests 
        ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ==============================================
-- 2. KURUM BAZLI RLS POLİTİKALARI
-- ==============================================

-- Kullanıcının kurumunu kontrol eden fonksiyon
CREATE OR REPLACE FUNCTION get_user_institution_id(p_user_id UUID)
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT institution_id 
        FROM user_profiles 
        WHERE user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kurum üyelerinin aynı kurumda olduğunu kontrol eden fonksiyon
CREATE OR REPLACE FUNCTION users_in_same_institution(p_user1_id UUID, p_user2_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT COUNT(*) = 1
        FROM (
            SELECT institution_id 
            FROM user_profiles 
            WHERE user_id IN (p_user1_id, p_user2_id)
            GROUP BY institution_id
            HAVING COUNT(*) = 2
        ) same_institution
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 3. KURUM BAZLI ERİŞİM POLİTİKALARI
-- ==============================================

-- user_profiles için kurum bazlı RLS
DO $$
BEGIN
    -- Mevcut politikaları temizle
    DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
    
    -- Yeni kurum bazlı politikalar
    CREATE POLICY "Users can view same institution profiles" ON user_profiles
        FOR SELECT USING (
            auth.uid() = user_id OR 
            get_user_institution_id(auth.uid()) = institution_id
        );
    
    CREATE POLICY "Users can update own profile" ON user_profiles
        FOR UPDATE USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can insert own profile" ON user_profiles
        FOR INSERT WITH CHECK (auth.uid() = user_id);
END $$;

-- teachers için kurum bazlı RLS
DO $$
BEGIN
    -- Mevcut politikaları temizle
    DROP POLICY IF EXISTS "Teachers can view own data" ON teachers;
    DROP POLICY IF EXISTS "Teachers can update own data" ON teachers;
    
    -- Yeni kurum bazlı politikalar
    CREATE POLICY "Teachers can view same institution" ON teachers
        FOR SELECT USING (
            auth.uid() = user_id OR 
            get_user_institution_id(auth.uid()) = institution_id
        );
    
    CREATE POLICY "Teachers can update own data" ON teachers
        FOR UPDATE USING (auth.uid() = user_id);
    
    CREATE POLICY "Teachers can insert own data" ON teachers
        FOR INSERT WITH CHECK (auth.uid() = user_id);
END $$;

-- students için kurum bazlı RLS
DO $$
BEGIN
    -- Mevcut politikaları temizle
    DROP POLICY IF EXISTS "Students can view own data" ON students;
    DROP POLICY IF EXISTS "Students can update own data" ON students;
    
    -- Yeni kurum bazlı politikalar
    CREATE POLICY "Students can view same institution" ON students
        FOR SELECT USING (
            auth.uid() = user_id OR 
            get_user_institution_id(auth.uid()) = institution_id
        );
    
    CREATE POLICY "Students can update own data" ON students
        FOR UPDATE USING (auth.uid() = user_id);
    
    CREATE POLICY "Students can insert own data" ON students
        FOR INSERT WITH CHECK (auth.uid() = user_id);
END $$;

-- study_logs için kurum bazlı RLS
DO $$
BEGIN
    -- Mevcut politikaları temizle
    DROP POLICY IF EXISTS "Users can view own study logs" ON study_logs;
    DROP POLICY IF EXISTS "Users can insert own study logs" ON study_logs;
    DROP POLICY IF EXISTS "Users can update own study logs" ON study_logs;
    DROP POLICY IF EXISTS "Users can delete own study logs" ON study_logs;
    
    -- Yeni kurum bazlı politikalar
    CREATE POLICY "Users can view same institution study logs" ON study_logs
        FOR SELECT USING (
            auth.uid() = user_id OR 
            get_user_institution_id(auth.uid()) = institution_id
        );
    
    CREATE POLICY "Users can insert own study logs" ON study_logs
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can update own study logs" ON study_logs
        FOR UPDATE USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can delete own study logs" ON study_logs
        FOR DELETE USING (auth.uid() = user_id);
END $$;

-- messages için kurum bazlı RLS
DO $$
BEGIN
    -- Mevcut politikaları temizle
    DROP POLICY IF EXISTS "Users can view own messages" ON messages;
    DROP POLICY IF EXISTS "Users can insert own messages" ON messages;
    DROP POLICY IF EXISTS "Users can update own messages" ON messages;
    
    -- Yeni kurum bazlı politikalar
    CREATE POLICY "Users can view same institution messages" ON messages
        FOR SELECT USING (
            auth.uid() = sender_id OR 
            auth.uid() = receiver_id OR 
            get_user_institution_id(auth.uid()) = institution_id
        );
    
    CREATE POLICY "Users can insert same institution messages" ON messages
        FOR INSERT WITH CHECK (
            auth.uid() = sender_id AND 
            users_in_same_institution(auth.uid(), receiver_id)
        );
    
    CREATE POLICY "Users can update own messages" ON messages
        FOR UPDATE USING (auth.uid() = sender_id);
END $$;

-- student_daily_plans için kurum bazlı RLS
DO $$
BEGIN
    -- Mevcut politikaları temizle
    DROP POLICY IF EXISTS "Students can view own daily plans" ON student_daily_plans;
    DROP POLICY IF EXISTS "Students can insert own daily plans" ON student_daily_plans;
    DROP POLICY IF EXISTS "Students can update own daily plans" ON student_daily_plans;
    DROP POLICY IF EXISTS "Students can delete own daily plans" ON student_daily_plans;
    
    -- Yeni kurum bazlı politikalar
    CREATE POLICY "Users can view same institution daily plans" ON student_daily_plans
        FOR SELECT USING (
            auth.uid() = student_id OR 
            auth.uid() = teacher_id OR 
            get_user_institution_id(auth.uid()) = institution_id
        );
    
    CREATE POLICY "Users can insert same institution daily plans" ON student_daily_plans
        FOR INSERT WITH CHECK (
            (auth.uid() = student_id OR auth.uid() = teacher_id) AND 
            get_user_institution_id(auth.uid()) = institution_id
        );
    
    CREATE POLICY "Users can update same institution daily plans" ON student_daily_plans
        FOR UPDATE USING (
            auth.uid() = student_id OR 
            auth.uid() = teacher_id OR 
            get_user_institution_id(auth.uid()) = institution_id
        );
    
    CREATE POLICY "Users can delete same institution daily plans" ON student_daily_plans
        FOR DELETE USING (
            auth.uid() = student_id OR 
            auth.uid() = teacher_id OR 
            get_user_institution_id(auth.uid()) = institution_id
        );
END $$;

-- student_weekly_plans için kurum bazlı RLS
DO $$
BEGIN
    -- Mevcut politikaları temizle
    DROP POLICY IF EXISTS "Students can view own weekly plans" ON student_weekly_plans;
    DROP POLICY IF EXISTS "Students can insert own weekly plans" ON student_weekly_plans;
    DROP POLICY IF EXISTS "Students can update own weekly plans" ON student_weekly_plans;
    DROP POLICY IF EXISTS "Students can delete own weekly plans" ON student_weekly_plans;
    
    -- Yeni kurum bazlı politikalar
    CREATE POLICY "Users can view same institution weekly plans" ON student_weekly_plans
        FOR SELECT USING (
            auth.uid() = student_id OR 
            auth.uid() = teacher_id OR 
            get_user_institution_id(auth.uid()) = institution_id
        );
    
    CREATE POLICY "Users can insert same institution weekly plans" ON student_weekly_plans
        FOR INSERT WITH CHECK (
            (auth.uid() = student_id OR auth.uid() = teacher_id) AND 
            get_user_institution_id(auth.uid()) = institution_id
        );
    
    CREATE POLICY "Users can update same institution weekly plans" ON student_weekly_plans
        FOR UPDATE USING (
            auth.uid() = student_id OR 
            auth.uid() = teacher_id OR 
            get_user_institution_id(auth.uid()) = institution_id
        );
    
    CREATE POLICY "Users can delete same institution weekly plans" ON student_weekly_plans
        FOR DELETE USING (
            auth.uid() = student_id OR 
            auth.uid() = teacher_id OR 
            get_user_institution_id(auth.uid()) = institution_id
        );
END $$;

-- teacher_student_requests için kurum bazlı RLS
DO $$
BEGIN
    -- Mevcut politikaları temizle
    DROP POLICY IF EXISTS "Teachers can view own requests" ON teacher_student_requests;
    DROP POLICY IF EXISTS "Teachers can update own requests" ON teacher_student_requests;
    DROP POLICY IF EXISTS "Students can view own requests" ON teacher_student_requests;
    DROP POLICY IF EXISTS "Students can update own requests" ON teacher_student_requests;
    DROP POLICY IF EXISTS "Anyone can insert requests" ON teacher_student_requests;
    
    -- Yeni kurum bazlı politikalar
    CREATE POLICY "Users can view same institution requests" ON teacher_student_requests
        FOR SELECT USING (
            auth.uid() = teacher_id OR 
            auth.uid() = student_id OR 
            get_user_institution_id(auth.uid()) = institution_id
        );
    
    CREATE POLICY "Users can update same institution requests" ON teacher_student_requests
        FOR UPDATE USING (
            auth.uid() = teacher_id OR 
            auth.uid() = student_id OR 
            get_user_institution_id(auth.uid()) = institution_id
        );
    
    CREATE POLICY "Users can insert same institution requests" ON teacher_student_requests
        FOR INSERT WITH CHECK (
            (auth.uid() = teacher_id OR auth.uid() = student_id) AND 
            get_user_institution_id(auth.uid()) = institution_id
        );
END $$;

-- ==============================================
-- 4. ANA ADMIN İÇİN ÖZEL POLİTİKALAR
-- ==============================================

-- Ana admin (admin/admin123) tüm kurumları görebilir
CREATE OR REPLACE FUNCTION is_main_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Ana admin kullanıcı ID'sini buraya ekleyin
    -- Bu ID'yi auth.users tablosundan alabilirsiniz
    RETURN auth.uid() = '00000000-0000-0000-0000-000000000000'::UUID; -- Placeholder
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ana admin için özel politikalar (gelecekte eklenebilir)
-- Şimdilik kurum bazlı politikalar yeterli

-- ==============================================
-- 5. VERİ MİGRASYONU FONKSİYONLARI
-- ==============================================

-- Mevcut kullanıcıları varsayılan kuruma atama
CREATE OR REPLACE FUNCTION assign_users_to_default_institution()
RETURNS VOID AS $$
DECLARE
    default_institution_id UUID;
BEGIN
    -- Varsayılan kurum oluştur (eğer yoksa)
    INSERT INTO institutions (name, type, is_active, is_premium)
    VALUES ('Genel Kurum', 'individual', true, false)
    ON CONFLICT DO NOTHING
    RETURNING id INTO default_institution_id;
    
    -- Eğer kurum zaten varsa ID'sini al
    IF default_institution_id IS NULL THEN
        SELECT id INTO default_institution_id 
        FROM institutions 
        WHERE name = 'Genel Kurum' 
        LIMIT 1;
    END IF;
    
    -- Tüm kullanıcıları varsayılan kuruma ata
    UPDATE user_profiles 
    SET institution_id = default_institution_id 
    WHERE institution_id IS NULL;
    
    UPDATE teachers 
    SET institution_id = default_institution_id 
    WHERE institution_id IS NULL;
    
    UPDATE students 
    SET institution_id = default_institution_id 
    WHERE institution_id IS NULL;
    
    UPDATE study_logs 
    SET institution_id = (
        SELECT institution_id 
        FROM user_profiles 
        WHERE user_profiles.user_id = study_logs.user_id
    )
    WHERE institution_id IS NULL;
    
    UPDATE messages 
    SET institution_id = (
        SELECT institution_id 
        FROM user_profiles 
        WHERE user_profiles.user_id = messages.sender_id
    )
    WHERE institution_id IS NULL;
    
    UPDATE student_daily_plans 
    SET institution_id = (
        SELECT institution_id 
        FROM user_profiles 
        WHERE user_profiles.user_id = student_daily_plans.student_id
    )
    WHERE institution_id IS NULL;
    
    UPDATE student_weekly_plans 
    SET institution_id = (
        SELECT institution_id 
        FROM user_profiles 
        WHERE user_profiles.user_id = student_weekly_plans.student_id
    )
    WHERE institution_id IS NULL;
    
    UPDATE teacher_student_requests 
    SET institution_id = (
        SELECT institution_id 
        FROM user_profiles 
        WHERE user_profiles.user_id = teacher_student_requests.teacher_id
    )
    WHERE institution_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 6. KURUM YÖNETİMİ FONKSİYONLARI
-- ==============================================

-- Kullanıcıyı kuruma ekleme
CREATE OR REPLACE FUNCTION add_user_to_institution(
    p_user_id UUID,
    p_institution_id UUID,
    p_role VARCHAR(20) DEFAULT 'student'
)
RETURNS BOOLEAN AS $$
BEGIN
    -- user_profiles'ı güncelle
    UPDATE user_profiles 
    SET institution_id = p_institution_id 
    WHERE user_id = p_user_id;
    
    -- institution_memberships'e ekle
    INSERT INTO institution_memberships (institution_id, user_id, role)
    VALUES (p_institution_id, p_user_id, p_role)
    ON CONFLICT (institution_id, user_id) DO UPDATE SET
        role = p_role,
        is_active = true,
        updated_at = NOW();
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kullanıcıyı kurumdan çıkarma
CREATE OR REPLACE FUNCTION remove_user_from_institution(
    p_user_id UUID,
    p_institution_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    -- institution_memberships'i deaktif et
    UPDATE institution_memberships 
    SET is_active = false, updated_at = NOW()
    WHERE user_id = p_user_id AND institution_id = p_institution_id;
    
    -- user_profiles'dan kurum ID'sini kaldır
    UPDATE user_profiles 
    SET institution_id = NULL 
    WHERE user_id = p_user_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 7. İNDEXLER
-- ==============================================

-- Kurum bazlı sorgular için indexler
CREATE INDEX IF NOT EXISTS idx_user_profiles_institution_id ON user_profiles(institution_id);
CREATE INDEX IF NOT EXISTS idx_teachers_institution_id ON teachers(institution_id);
CREATE INDEX IF NOT EXISTS idx_students_institution_id ON students(institution_id);
CREATE INDEX IF NOT EXISTS idx_study_logs_institution_id ON study_logs(institution_id);
CREATE INDEX IF NOT EXISTS idx_messages_institution_id ON messages(institution_id);
CREATE INDEX IF NOT EXISTS idx_student_daily_plans_institution_id ON student_daily_plans(institution_id);
CREATE INDEX IF NOT EXISTS idx_student_weekly_plans_institution_id ON student_weekly_plans(institution_id);
CREATE INDEX IF NOT EXISTS idx_teacher_student_requests_institution_id ON teacher_student_requests(institution_id);

-- ==============================================
-- 8. VERİ MİGRASYONU ÇALIŞTIRMA
-- ==============================================

-- Mevcut kullanıcıları varsayılan kuruma ata
SELECT assign_users_to_default_institution();

