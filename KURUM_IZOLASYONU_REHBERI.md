# 🏢 Kurum İzolasyonu Sistemi - Kurulum Rehberi

## 📋 Genel Bakış

Bu sistem, her kurumun kendi verilerine sahip olduğu, birbirlerini göremediği ayrı bir yapı oluşturur. Mevcut verileriniz korunur ve varsayılan bir kuruma atanır.

## 🎯 Sistem Özellikleri

### ✅ **Kurum İzolasyonu**
- Her kurum sadece kendi verilerini görebilir
- Kurumlar birbirlerinin öğrenci/öğretmen bilgilerini göremez
- Kurumlar birbirlerinin çalışma kayıtlarını göremez
- Kurumlar birbirlerinin mesajlarını göremez

### ✅ **Ana Admin Kontrolü**
- Ana admin tüm kurumları görebilir
- Ana admin kurum istatistiklerini görebilir
- Ana admin kurum üyelerini listeleyebilir
- Ana admin sözleşme takibi yapabilir

### ✅ **Veri Güvenliği**
- Mevcut verileriniz korunur
- Yedekleme sistemi mevcuttur
- Rollback (geri dönüş) imkanı vardır

## 🚀 Kurulum Adımları

### **Adım 1: Mevcut Veritabanını Analiz Et**

```sql
-- Bu dosyayı Supabase SQL Editor'da çalıştırın
-- Verimly/analyze_current_database.sql
```

### **Adım 2: Kurum İzolasyonu Sistemini Kur**

```sql
-- Bu dosyayı Supabase SQL Editor'da çalıştırın
-- Verimly/database/institution_isolation_system.sql
```

### **Adım 3: Ana Admin Görünümlerini Kur**

```sql
-- Bu dosyayı Supabase SQL Editor'da çalıştırın
-- Verimly/database/admin_views.sql
```

### **Adım 4: Veri Migrasyonunu Çalıştır**

```sql
-- Bu dosyayı Supabase SQL Editor'da çalıştırın
-- Verimly/database/data_migration_plan.sql
```

## 📊 Kurulum Sonrası Kontroller

### **1. Migrasyon Durumunu Kontrol Et**

```sql
SELECT * FROM verify_migration();
```

**Beklenen Sonuç:** Tüm tablolar için %100 başarı oranı

### **2. Kurum Listesini Görüntüle**

```sql
SELECT * FROM admin_institution_summary;
```

**Beklenen Sonuç:** En az bir "Mevcut Kullanıcılar" kurumu olmalı

### **3. Kurum Üyelerini Listele**

```sql
SELECT * FROM admin_institution_members;
```

**Beklenen Sonuç:** Tüm mevcut kullanıcılar "Mevcut Kullanıcılar" kurumunda olmalı

## 🔧 Sistem Kullanımı

### **Ana Admin Paneli**

#### **Kurum Yönetimi**
```sql
-- Tüm kurumları listele
SELECT * FROM admin_institution_summary;

-- Belirli kurum detayları
SELECT * FROM get_institution_details('kurum-id-buraya');

-- Kurum üyelerini listele
SELECT * FROM get_institution_members('kurum-id-buraya');
```

#### **Sözleşme Takibi**
```sql
-- Sözleşme durumları
SELECT * FROM admin_contract_tracking;

-- Yakında dolacak sözleşmeler
SELECT * FROM admin_contract_tracking 
WHERE contract_status = 'Yakında Dolacak';
```

#### **Kurum Performansı**
```sql
-- Kurum performans raporu
SELECT * FROM admin_institution_performance;
```

### **Yeni Kurum Oluşturma**

1. **Ana Admin** olarak giriş yapın
2. **Kurum Yönetimi** → **Yeni Kurum Ekle**
3. **Kurum bilgilerini** doldurun
4. **Admin kullanıcı adı/şifre** belirleyin
5. **Sözleşme tarihlerini** ayarlayın

### **Kullanıcıları Kuruma Ekleme**

```sql
-- Kullanıcıyı kuruma ekle
SELECT add_user_to_institution(
    'kullanici-id-buraya',
    'kurum-id-buraya',
    'student' -- veya 'teacher', 'admin'
);
```

## 🛡️ Güvenlik Özellikleri

### **Kurum Bazlı Erişim Kontrolü**
- Her kullanıcı sadece kendi kurumunun verilerini görebilir
- Farklı kurumlar birbirlerinin verilerine erişemez
- RLS (Row Level Security) politikaları otomatik çalışır

### **Ana Admin Özel Yetkileri**
- Tüm kurumları görüntüleyebilir
- Kurum istatistiklerini görebilir
- Sözleşme takibi yapabilir
- Detaylı verilere erişemez (güvenlik)

## 🔄 Rollback (Geri Dönüş)

Eğer bir sorun olursa:

```sql
-- Migrasyonu geri al
SELECT rollback_migration();
```

**Dikkat:** Bu işlem tüm kurum atamalarını kaldırır.

## 📈 Sistem Avantajları

### **1. Veri Güvenliği**
- Her kurum kendi verilerine sahip
- Kurumlar birbirlerini göremez
- Ana admin kontrolü mevcut

### **2. Ölçeklenebilirlik**
- Sınırsız kurum eklenebilir
- Her kurum bağımsız çalışır
- Performans optimizasyonu

### **3. Yönetim Kolaylığı**
- Ana admin tek yerden kontrol
- Kurum bazlı raporlama
- Sözleşme takibi

## 🚨 Önemli Notlar

### **Mevcut Veriler**
- Tüm mevcut verileriniz korunur
- "Mevcut Kullanıcılar" adında varsayılan kurum oluşturulur
- Tüm kullanıcılar bu kuruma atanır

### **Yeni Kurumlar**
- Yeni kurumlar tamamen ayrı çalışır
- Mevcut kullanıcılar etkilenmez
- Her kurum kendi admin paneline sahip

### **Ana Admin**
- Ana admin tüm kurumları görebilir
- Detaylı verilere erişemez (güvenlik)
- Sadece istatistik ve üye listesi

## 🎯 Sonraki Adımlar

1. **Kurulumu tamamlayın**
2. **Test edin** - farklı kurumlar oluşturun
3. **Kullanıcıları** yeni kurumlara ekleyin
4. **İzolasyonu test edin** - kurumlar birbirlerini görememeli

## 📞 Destek

Herhangi bir sorun olursa:
1. **Rollback** yapabilirsiniz
2. **Yedek tablolar** mevcuttur
3. **Adım adım** tekrar kurulum yapabilirsiniz

---

**🎉 Kurulum tamamlandıktan sonra her kurum kendi verilerine sahip, güvenli ve izole bir sistem çalışacak!**

