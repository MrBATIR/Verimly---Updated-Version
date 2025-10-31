-- Öğrenci Planlama Sistemi Tabloları
-- Bu dosya Supabase SQL Editor'da çalıştırılmalıdır

-- Öğrenci günlük planları tablosu
CREATE TABLE IF NOT EXISTS student_daily_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    plan_date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Öğrenci haftalık planları tablosu
CREATE TABLE IF NOT EXISTS student_weekly_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL, -- Haftanın başlangıç tarihi (Pazartesi)
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index'ler ekle
CREATE INDEX IF NOT EXISTS idx_student_daily_plans_student_date ON student_daily_plans(student_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_student_weekly_plans_student_week ON student_weekly_plans(student_id, week_start_date);

-- RLS (Row Level Security) politikaları
ALTER TABLE student_daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_weekly_plans ENABLE ROW LEVEL SECURITY;

-- Öğrenciler sadece kendi planlarını görebilir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_daily_plans' AND policyname = 'Students can view own daily plans') THEN
        CREATE POLICY "Students can view own daily plans" ON student_daily_plans
            FOR SELECT USING (auth.uid() = student_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_daily_plans' AND policyname = 'Students can insert own daily plans') THEN
        CREATE POLICY "Students can insert own daily plans" ON student_daily_plans
            FOR INSERT WITH CHECK (auth.uid() = student_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_daily_plans' AND policyname = 'Students can update own daily plans') THEN
        CREATE POLICY "Students can update own daily plans" ON student_daily_plans
            FOR UPDATE USING (auth.uid() = student_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_daily_plans' AND policyname = 'Students can delete own daily plans') THEN
        CREATE POLICY "Students can delete own daily plans" ON student_daily_plans
            FOR DELETE USING (auth.uid() = student_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_weekly_plans' AND policyname = 'Students can view own weekly plans') THEN
        CREATE POLICY "Students can view own weekly plans" ON student_weekly_plans
            FOR SELECT USING (auth.uid() = student_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_weekly_plans' AND policyname = 'Students can insert own weekly plans') THEN
        CREATE POLICY "Students can insert own weekly plans" ON student_weekly_plans
            FOR INSERT WITH CHECK (auth.uid() = student_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_weekly_plans' AND policyname = 'Students can update own weekly plans') THEN
        CREATE POLICY "Students can update own weekly plans" ON student_weekly_plans
            FOR UPDATE USING (auth.uid() = student_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_weekly_plans' AND policyname = 'Students can delete own weekly plans') THEN
        CREATE POLICY "Students can delete own weekly plans" ON student_weekly_plans
            FOR DELETE USING (auth.uid() = student_id);
    END IF;
END $$;

-- Öğretmenler bağlı öğrencilerinin planlarını görebilir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_daily_plans' AND policyname = 'Teachers can view student daily plans') THEN
        CREATE POLICY "Teachers can view student daily plans" ON student_daily_plans
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM student_teachers st
                    JOIN teachers t ON t.id = st.teacher_id
                    WHERE st.student_id = student_daily_plans.student_id
                    AND t.user_id = auth.uid()
                    AND st.approval_status = 'approved'
                )
            );
    END IF;
END $$;

-- Öğretmenler bağlı öğrencileri için plan oluşturabilir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_daily_plans' AND policyname = 'Teachers can create student daily plans') THEN
        CREATE POLICY "Teachers can create student daily plans" ON student_daily_plans
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM student_teachers st
                    JOIN teachers t ON t.id = st.teacher_id
                    WHERE st.student_id = student_daily_plans.student_id
                    AND t.user_id = auth.uid()
                    AND st.approval_status = 'approved'
                )
            );
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_weekly_plans' AND policyname = 'Teachers can view student weekly plans') THEN
        CREATE POLICY "Teachers can view student weekly plans" ON student_weekly_plans
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM student_teachers st
                    JOIN teachers t ON t.id = st.teacher_id
                    WHERE st.student_id = student_weekly_plans.student_id
                    AND t.user_id = auth.uid()
                    AND st.approval_status = 'approved'
                )
            );
    END IF;
END $$;

-- Öğretmenler bağlı öğrencileri için haftalık plan oluşturabilir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_weekly_plans' AND policyname = 'Teachers can create student weekly plans') THEN
        CREATE POLICY "Teachers can create student weekly plans" ON student_weekly_plans
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM student_teachers st
                    JOIN teachers t ON t.id = st.teacher_id
                    WHERE st.student_id = student_weekly_plans.student_id
                    AND t.user_id = auth.uid()
                    AND st.approval_status = 'approved'
                )
            );
    END IF;
END $$;

-- Updated_at trigger'ları
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_student_daily_plans_updated_at') THEN
        CREATE TRIGGER update_student_daily_plans_updated_at 
            BEFORE UPDATE ON student_daily_plans 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_student_weekly_plans_updated_at') THEN
        CREATE TRIGGER update_student_weekly_plans_updated_at 
            BEFORE UPDATE ON student_weekly_plans 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Öğretmenlerin kendi oluşturdukları planları silebilmesi için RLS policy'leri

-- Günlük planlar için öğretmen silme policy'si
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_daily_plans' AND policyname = 'Teachers can delete own daily plans') THEN
        CREATE POLICY "Teachers can delete own daily plans" ON student_daily_plans
            FOR DELETE USING (
                teacher_id IS NOT NULL AND
                EXISTS (
                    SELECT 1 FROM teachers t
                    WHERE t.id = student_daily_plans.teacher_id
                    AND t.user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- Haftalık planlar için öğretmen silme policy'si
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_weekly_plans' AND policyname = 'Teachers can delete own weekly plans') THEN
        CREATE POLICY "Teachers can delete own weekly plans" ON student_weekly_plans
            FOR DELETE USING (
                teacher_id IS NOT NULL AND
                EXISTS (
                    SELECT 1 FROM teachers t
                    WHERE t.id = student_weekly_plans.teacher_id
                    AND t.user_id = auth.uid()
                )
            );
    END IF;
END $$;

SELECT 'Öğrenci planları tabloları ve policy''leri başarıyla oluşturuldu' as result;
