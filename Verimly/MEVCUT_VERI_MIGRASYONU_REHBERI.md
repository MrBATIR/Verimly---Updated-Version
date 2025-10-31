# 🔒 Mevcut Veri Migrasyonu - Güvenli Geçiş Rehberi

## ⚠️ ÖNEMLİ UYARI
**Bu rehber mevcut verilerinizi ASLA kaybetmeyecek şekilde tasarlanmıştır. Tüm verileriniz güvenli bir şekilde yedeklenir ve yeni sisteme aktarılır.**

## 🎯 Migrasyon Hedefi
- ✅ **Mevcut verilerinizi koruyun**
- ✅ **Yeni kurum yapısına aktarın**
- ✅ **"Mevcut Kullanıcılar" adında varsayılan kurum oluşturun**
- ✅ **Tüm kullanıcıları bu kuruma atayın**
- ✅ **Veri bütünlüğünü koruyun**

## 📋 Adım Adım Migrasyon

### **Adım 1: Mevcut Verilerinizi Yedekleyin**

```sql
-- Supabase SQL Editor'da çalıştırın
-- Verimly/database/backup_existing_data.sql
```

**Bu adım:**
- Tüm mevcut verilerinizi `backup_` ön ekli tablolara kopyalar
- Yedekleme durumunu doğrular
- Veri sayılarını raporlar

### **Adım 2: Güvenli Migrasyonu Çalıştırın**

```sql
-- Supabase SQL Editor'da çalıştırın
-- Verimly/database/safe_data_migration.sql
```

**Bu adım:**
- "Mevcut Kullanıcılar" adında varsayılan kurum oluşturur
- Tüm kullanıcıları bu kuruma atar
- Tüm verileri kurum bazlı günceller
- Migrasyon durumunu doğrular

### **Adım 3: Migrasyon Durumunu Kontrol Edin**

```sql
-- Migrasyon başarı oranını kontrol edin
SELECT * FROM verify_migration_success();
```

**Beklenen Sonuç:** Tüm tablolar için %100 başarı oranı

## 🔍 Migrasyon Sonrası Kontroller

### **1. Veri Bütünlüğü Kontrolü**

```sql
-- Yedek verilerle karşılaştırma
SELECT 
    'user_profiles' as table_name,
    (SELECT COUNT(*) FROM user_profiles) as current_count,
    (SELECT COUNT(*) FROM backup_user_profiles) as backup_count,
    (SELECT COUNT(*) FROM user_profiles) = (SELECT COUNT(*) FROM backup_user_profiles) as data_integrity
UNION ALL
SELECT 
    'teachers' as table_name,
    (SELECT COUNT(*) FROM teachers) as current_count,
    (SELECT COUNT(*) FROM backup_teachers) as backup_count,
    (SELECT COUNT(*) FROM teachers) = (SELECT COUNT(*) FROM backup_teachers) as data_integrity
UNION ALL
SELECT 
    'students' as table_name,
    (SELECT COUNT(*) FROM students) as current_count,
    (SELECT COUNT(*) FROM backup_students) as backup_count,
    (SELECT COUNT(*) FROM students) = (SELECT COUNT(*) FROM backup_students) as data_integrity;
```

### **2. Kurum Ataması Kontrolü**

```sql
-- Tüm kullanıcıların kurum ataması
SELECT 
    'Mevcut Kullanıcılar' as institution_name,
    COUNT(*) as total_users,
    COUNT(CASE WHEN user_type = 'teacher' THEN 1 END) as teachers,
    COUNT(CASE WHEN user_type = 'student' THEN 1 END) as students
FROM user_profiles 
WHERE institution_id = (
    SELECT id FROM institutions WHERE name = 'Mevcut Kullanıcılar'
);
```

### **3. Veri İlişkileri Kontrolü**

```sql
-- Çalışma kayıtlarının kurum ataması
SELECT 
    COUNT(*) as total_study_logs,
    COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END) as with_institution,
    ROUND(
        (COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END)::NUMERIC / COUNT(*)) * 100, 
        2
    ) as success_rate
FROM study_logs;

-- Mesajların kurum ataması
SELECT 
    COUNT(*) as total_messages,
    COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END) as with_institution,
    ROUND(
        (COUNT(CASE WHEN institution_id IS NOT NULL THEN 1 END)::NUMERIC / COUNT(*)) * 100, 
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
SELECT * FROM rollback_migration_safe();
```

### **3. Veri Bütünlüğü**
- ✅ Hiçbir veri kaybolmaz
- ✅ Tüm ilişkiler korunur
- ✅ Kullanıcı hesapları etkilenmez

## 📊 Migrasyon Sonrası Durum

### **Oluşturulan Yapı:**
- ✅ **"Mevcut Kullanıcılar"** adında varsayılan kurum
- ✅ **Tüm kullanıcılar** bu kuruma atanır
- ✅ **Tüm veriler** kurum bazlı organize edilir
- ✅ **Kurum izolasyonu** aktif olur

### **Ana Admin Yetkileri:**
- ✅ Tüm kurumları görüntüleyebilir
- ✅ Kurum istatistiklerini görebilir
- ✅ Üye sayılarını takip edebilir
- ✅ Sözleşme takibi yapabilir

## 🚀 Sonraki Adımlar

### **1. Yeni Kurumlar Oluşturun**
- Ana admin panelinden yeni kurumlar ekleyin
- Her kurum kendi admin paneline sahip olur
- Kurumlar birbirlerini göremez

### **2. Kullanıcıları Yeni Kurumlara Taşıyın**
```sql
-- Kullanıcıyı yeni kuruma taşıma
SELECT add_user_to_institution(
    'kullanici-id-buraya',
    'yeni-kurum-id-buraya',
    'student' -- veya 'teacher'
);
```

### **3. İzolasyonu Test Edin**
- Farklı kurumlardan giriş yapın
- Kurumlar birbirlerinin verilerini görememeli
- Ana admin tüm kurumları görebilmeli

## ⚠️ Önemli Notlar

### **Mevcut Veriler:**
- ✅ **Hiçbir veri kaybolmaz**
- ✅ **Tüm kullanıcı hesapları korunur**
- ✅ **Tüm çalışma kayıtları korunur**
- ✅ **Tüm mesajlar korunur**

### **Yeni Sistem:**
- ✅ **Kurum bazlı izolasyon** aktif olur
- ✅ **Ana admin kontrolü** mevcut olur
- ✅ **Sınırsız kurum** eklenebilir
- ✅ **Performans optimizasyonu** sağlanır

## 🆘 Sorun Giderme

### **Eğer Bir Sorun Olursa:**

1. **Rollback Yapın:**
```sql
SELECT * FROM rollback_migration_safe();
```

2. **Yedek Verileri Kontrol Edin:**
```sql
SELECT * FROM backup_user_profiles LIMIT 5;
SELECT * FROM backup_teachers LIMIT 5;
SELECT * FROM backup_students LIMIT 5;
```

3. **Tekrar Deneyin:**
- Rollback sonrası tekrar migrasyonu çalıştırın
- Tüm adımları sırayla takip edin

## 📞 Destek

Herhangi bir sorun olursa:
1. **Rollback** yapabilirsiniz
2. **Yedek tablolar** mevcuttur
3. **Adım adım** tekrar deneyebilirsiniz

---

**🔒 Mevcut verileriniz %100 güvenli ve hiçbir veri kaybolmayacak!**
