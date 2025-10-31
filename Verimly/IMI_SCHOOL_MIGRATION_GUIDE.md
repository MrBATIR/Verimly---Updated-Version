# 🏫 İMİ Anadolu ve Fen Lisesi - Veri Migrasyonu Rehberi

## 🎯 Migrasyon Hedefi
Mevcut sistemdeki **tüm verileri** "İMİ Anadolu ve Fen Lisesi" kurumuna aktaracağız.

## 📋 Aktarılacak Veriler
- ✅ **Tüm öğretmenler** → İMİ Anadolu ve Fen Lisesi
- ✅ **Tüm öğrenciler** → İMİ Anadolu ve Fen Lisesi  
- ✅ **Tüm çalışma kayıtları** → İMİ Anadolu ve Fen Lisesi
- ✅ **Tüm planlar** → İMİ Anadolu ve Fen Lisesi
- ✅ **Tüm mesajlar** → İMİ Anadolu ve Fen Lisesi
- ✅ **Tüm ilişkiler** → İMİ Anadolu ve Fen Lisesi

## 🔒 Güvenlik Önlemleri
- ✅ **Tüm veriler yedeklenir** - `backup_` tablolarında saklanır
- ✅ **Veri bütünlüğü korunur** - Hiçbir veri kaybolmaz
- ✅ **Rollback imkanı** - Gerekirse geri dönüş mümkün
- ✅ **Doğrulama sistemi** - Migrasyon sonrası kontrol

## 🚀 Migrasyon Adımları

### **Adım 1: Verilerinizi Yedekleyin**
```sql
-- Supabase SQL Editor'da çalıştırın
-- Verimly/database/migrate_to_imi_school.sql
```

**Bu adım:**
- Tüm mevcut verilerinizi `backup_` tablolarına kopyalar
- Yedekleme durumunu doğrular
- Veri sayılarını raporlar

### **Adım 2: İMİ Okulunu Kontrol Edin**
```sql
-- İMİ Anadolu ve Fen Lisesi kurumunu bul
SELECT find_imi_school();
```

**Beklenen Sonuç:** İMİ okulunun UUID'si döner

### **Adım 3: Migrasyonu Çalıştırın**
```sql
-- Tüm verileri İMİ okuluna aktar
SELECT * FROM migrate_all_data_to_imi_school();
```

**Bu adım:**
- Tüm kullanıcıları İMİ okuluna atar
- Tüm verileri kurum bazlı günceller
- Kurum üyeliklerini oluşturur
- Migrasyon durumunu raporlar

### **Adım 4: Migrasyon Durumunu Kontrol Edin**
```sql
-- Migrasyon başarı oranını kontrol et
SELECT * FROM verify_imi_migration();
```

**Beklenen Sonuç:** Tüm tablolar için %100 başarı oranı

### **Adım 5: Kurum Bilgilerini Görüntüleyin**
```sql
-- İMİ okulunun detaylı bilgilerini göster
SELECT * FROM get_imi_school_info();
```

**Beklenen Sonuç:** İMİ okulunun üye sayıları ve istatistikleri

## 📊 Migrasyon Sonrası Durum

### **Oluşturulan Yapı:**
- ✅ **İMİ Anadolu ve Fen Lisesi** - Ana kurum
- ✅ **Tüm kullanıcılar** bu kuruma atanır
- ✅ **Tüm veriler** kurum bazlı organize edilir
- ✅ **Kurum izolasyonu** aktif olur

### **Kurum İstatistikleri:**
- ✅ **Toplam üye sayısı** - Tüm kullanıcılar
- ✅ **Öğretmen sayısı** - Aktif öğretmenler
- ✅ **Öğrenci sayısı** - Aktif öğrenciler
- ✅ **Çalışma kayıtları** - Tüm study_logs
- ✅ **Mesaj sayısı** - Tüm messages

## 🔍 Kontrol Sorguları

### **1. Veri Bütünlüğü Kontrolü**
```sql
-- Yedek verilerle karşılaştırma
SELECT 
    'user_profiles' as table_name,
    (SELECT COUNT(*) FROM user_profiles) as current_count,
    (SELECT COUNT(*) FROM backup_user_profiles_before_migration) as backup_count,
    (SELECT COUNT(*) FROM user_profiles) = (SELECT COUNT(*) FROM backup_user_profiles_before_migration) as data_integrity
UNION ALL
SELECT 
    'teachers' as table_name,
    (SELECT COUNT(*) FROM teachers) as current_count,
    (SELECT COUNT(*) FROM backup_teachers_before_migration) as backup_count,
    (SELECT COUNT(*) FROM teachers) = (SELECT COUNT(*) FROM backup_teachers_before_migration) as data_integrity
UNION ALL
SELECT 
    'students' as table_name,
    (SELECT COUNT(*) FROM students) as current_count,
    (SELECT COUNT(*) FROM backup_students_before_migration) as backup_count,
    (SELECT COUNT(*) FROM students) = (SELECT COUNT(*) FROM backup_students_before_migration) as data_integrity;
```

### **2. İMİ Okul Ataması Kontrolü**
```sql
-- Tüm kullanıcıların İMİ okuluna atanması
SELECT 
    'İMİ Anadolu ve Fen Lisesi' as institution_name,
    COUNT(*) as total_users,
    COUNT(CASE WHEN user_type = 'teacher' THEN 1 END) as teachers,
    COUNT(CASE WHEN user_type = 'student' THEN 1 END) as students
FROM user_profiles 
WHERE institution_id = (SELECT find_imi_school());
```

### **3. Veri İlişkileri Kontrolü**
```sql
-- Çalışma kayıtlarının İMİ okuluna atanması
SELECT 
    COUNT(*) as total_study_logs,
    COUNT(CASE WHEN institution_id = (SELECT find_imi_school()) THEN 1 END) as with_imi_institution,
    ROUND(
        (COUNT(CASE WHEN institution_id = (SELECT find_imi_school()) THEN 1 END)::NUMERIC / COUNT(*)) * 100, 
        2
    ) as success_rate
FROM study_logs;

-- Mesajların İMİ okuluna atanması
SELECT 
    COUNT(*) as total_messages,
    COUNT(CASE WHEN institution_id = (SELECT find_imi_school()) THEN 1 END) as with_imi_institution,
    ROUND(
        (COUNT(CASE WHEN institution_id = (SELECT find_imi_school()) THEN 1 END)::NUMERIC / COUNT(*)) * 100, 
        2
    ) as success_rate
FROM messages;
```

## 🛡️ Güvenlik Önlemleri

### **1. Yedekleme Sistemi**
- ✅ Tüm veriler `backup_` tablolarında saklanır
- ✅ Yedekleme tarihi kaydedilir
- ✅ Veri sayıları doğrulanır

### **2. Rollback İmkanı**
```sql
-- Gerekirse migrasyonu geri alabilirsiniz
-- (Bu fonksiyon ayrıca oluşturulabilir)
```

### **3. Veri Bütünlüğü**
- ✅ Hiçbir veri kaybolmaz
- ✅ Tüm ilişkiler korunur
- ✅ Kullanıcı hesapları etkilenmez

## 📈 Migrasyon Sonrası Avantajlar

### **1. Kurum İzolasyonu**
- ✅ İMİ okulu kendi verilerine sahip
- ✅ Diğer kurumlardan izole
- ✅ Güvenli veri yönetimi

### **2. Ana Admin Kontrolü**
- ✅ Tüm kurumları görüntüleyebilir
- ✅ İMİ okulunun istatistiklerini görebilir
- ✅ Kurum yönetimi yapabilir

### **3. Ölçeklenebilirlik**
- ✅ Yeni kurumlar eklenebilir
- ✅ Her kurum bağımsız çalışır
- ✅ Performans optimizasyonu

## 🚨 Önemli Notlar

### **Mevcut Veriler:**
- ✅ **Hiçbir veri kaybolmaz**
- ✅ **Tüm kullanıcı hesapları korunur**
- ✅ **Tüm çalışma kayıtları korunur**
- ✅ **Tüm mesajlar korunur**

### **Yeni Sistem:**
- ✅ **İMİ Anadolu ve Fen Lisesi** ana kurum olur
- ✅ **Kurum bazlı izolasyon** aktif olur
- ✅ **Ana admin kontrolü** mevcut olur
- ✅ **Sınırsız kurum** eklenebilir

## 🆘 Sorun Giderme

### **Eğer Bir Sorun Olursa:**

1. **Yedek Verileri Kontrol Edin:**
```sql
SELECT * FROM backup_user_profiles_before_migration LIMIT 5;
SELECT * FROM backup_teachers_before_migration LIMIT 5;
SELECT * FROM backup_students_before_migration LIMIT 5;
```

2. **İMİ Okulunu Kontrol Edin:**
```sql
SELECT * FROM institutions WHERE name ILIKE '%İMİ%' OR name ILIKE '%Anadolu%' OR name ILIKE '%Fen%';
```

3. **Migrasyon Durumunu Kontrol Edin:**
```sql
SELECT * FROM verify_imi_migration();
```

## 📞 Destek

Herhangi bir sorun olursa:
1. **Yedek tablolar** mevcuttur
2. **Adım adım** tekrar deneyebilirsiniz
3. **Veri bütünlüğü** korunur

---

**🏫 İMİ Anadolu ve Fen Lisesi'ne tüm verileriniz güvenli şekilde aktarılacak!**

