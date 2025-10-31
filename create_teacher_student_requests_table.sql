-- Öğretmen-öğrenci istekleri tablosu
CREATE TABLE IF NOT EXISTS teacher_student_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL, -- 'connect', 'disconnect'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) politikaları
ALTER TABLE teacher_student_requests ENABLE ROW LEVEL SECURITY;

-- Öğretmenler kendi isteklerini görebilir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_student_requests' AND policyname = 'Teachers can view own requests') THEN
        CREATE POLICY "Teachers can view own requests" ON teacher_student_requests
            FOR SELECT USING (auth.uid() = teacher_id);
    END IF;
END $$;

-- Öğretmenler kendi isteklerini güncelleyebilir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_student_requests' AND policyname = 'Teachers can update own requests') THEN
        CREATE POLICY "Teachers can update own requests" ON teacher_student_requests
            FOR UPDATE USING (auth.uid() = teacher_id);
    END IF;
END $$;

-- Öğrenciler kendilerine gelen istekleri görebilir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_student_requests' AND policyname = 'Students can view own requests') THEN
        CREATE POLICY "Students can view own requests" ON teacher_student_requests
            FOR SELECT USING (auth.uid() = student_id);
    END IF;
END $$;

-- Öğrenciler kendilerine gelen istekleri güncelleyebilir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_student_requests' AND policyname = 'Students can update own requests') THEN
        CREATE POLICY "Students can update own requests" ON teacher_student_requests
            FOR UPDATE USING (auth.uid() = student_id);
    END IF;
END $$;

-- Herkes istek oluşturabilir (öğretmen ve öğrenci)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_student_requests' AND policyname = 'Anyone can insert requests') THEN
        CREATE POLICY "Anyone can insert requests" ON teacher_student_requests
            FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_teacher_student_requests_teacher_id ON teacher_student_requests(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_student_requests_student_id ON teacher_student_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_teacher_student_requests_status ON teacher_student_requests(status);
CREATE INDEX IF NOT EXISTS idx_teacher_student_requests_type ON teacher_student_requests(request_type);

-- Updated_at trigger'ı
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_teacher_student_requests_updated_at') THEN
        CREATE TRIGGER update_teacher_student_requests_updated_at 
            BEFORE UPDATE ON teacher_student_requests 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
