-- Işıl Çimenci'yi students tablosuna ekle
-- user_id: 6a74b18c-fa0c-4de5-9643-b5919839b810

INSERT INTO students (
    user_id,
    email,
    name,
    grade,
    phone,
    school,
    address,
    parent_name,
    parent_phone,
    notes
) VALUES (
    '6a74b18c-fa0c-4de5-9643-b5919839b810',
    'isilcimenci06@gmail.com',
    'Işıl Çimenci',
    '12. Sınıf',
    '05314718376',
    'Osman Batır - Özel Öğrenci',
    'Milas',
    'Işıl Çimenci Veli',
    '05314718376',
    'Özel öğrenci'
);

-- Kontrol et
SELECT * FROM students WHERE user_id = '6a74b18c-fa0c-4de5-9643-b5919839b810';
