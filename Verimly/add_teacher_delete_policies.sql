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

-- Günlük planlar için öğretmen güncelleme policy'si
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_daily_plans' AND policyname = 'Teachers can update own daily plans') THEN
        CREATE POLICY "Teachers can update own daily plans" ON student_daily_plans
            FOR UPDATE USING (
                teacher_id IS NOT NULL AND
                EXISTS (
                    SELECT 1 FROM teachers t
                    WHERE t.id = student_daily_plans.teacher_id
                    AND t.user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- Haftalık planlar için öğretmen güncelleme policy'si
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_weekly_plans' AND policyname = 'Teachers can update own weekly plans') THEN
        CREATE POLICY "Teachers can update own weekly plans" ON student_weekly_plans
            FOR UPDATE USING (
                teacher_id IS NOT NULL AND
                EXISTS (
                    SELECT 1 FROM teachers t
                    WHERE t.id = student_weekly_plans.teacher_id
                    AND t.user_id = auth.uid()
                )
            );
    END IF;
END $$;

SELECT 'Öğretmen plan silme policy''leri eklendi' as result;
