-- Kurumlara rehber öğretmen özelliği ekle
-- Her kurumun bir rehber öğretmeni olabilir ve bu öğretmen kurumundaki tüm öğrencilerin çalışmalarını görebilir

-- 1. institutions tablosuna guidance_teacher_id field'ı ekle
ALTER TABLE institutions
ADD COLUMN IF NOT EXISTS guidance_teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL;

-- 2. Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_institutions_guidance_teacher_id ON institutions(guidance_teacher_id);

-- 3. Açıklama ekle
COMMENT ON COLUMN institutions.guidance_teacher_id IS 'Kurumun rehber öğretmeni. Bu öğretmen kurumundaki tüm öğrencilerin çalışmalarını görüntüleyebilir.';

SELECT 'Rehber öğretmen özelliği başarıyla eklendi!' as result;


