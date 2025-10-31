-- Manuel olarak eklenen planı sil
-- Bu plan teacher_id kolonu olmadan oluşturulmuş ve plan türü seçimi yoktu

DELETE FROM student_daily_plans 
WHERE teacher_id IS NULL 
AND title = 'Bu hafta yapılacaklar'
AND description IS NOT NULL;

-- Silinen kayıt sayısını göster
SELECT 'Manuel plan silindi' as result;
