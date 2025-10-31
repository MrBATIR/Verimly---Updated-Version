# 📚 Toplu Öğretmen Ekleme Kılavuzu

Bu kılavuz, 30+ öğretmeni tek seferde sisteme eklemenizi sağlar.

## 🚀 Hızlı Başlangıç

### 1️⃣ Gerekli Paketleri Yükleyin

```bash
npm install @supabase/supabase-js csv-parser
```

### 2️⃣ CSV Dosyasını Hazırlayın

`ogretmen_listesi.csv` adında bir dosya oluşturun:

```csv
firstName,lastName,email,branch,phone
Ahmet,Yılmaz,ahmet.yilmaz@okul.com,Matematik,5551234567
Ayşe,Demir,ayse.demir@okul.com,Türkçe,5551234568
Mehmet,Kaya,mehmet.kaya@okul.com,Fen Bilgisi,5551234569
```

**Alternatif Türkçe başlıklar da kullanabilirsiniz:**

```csv
Ad,Soyad,E-posta,Branş,Telefon
Ahmet,Yılmaz,ahmet.yilmaz@okul.com,Matematik,5551234567
Ayşe,Demir,ayse.demir@okul.com,Türkçe,5551234568
```

### 3️⃣ Script'i Yapılandırın

`bulk_add_teachers_from_csv.js` dosyasını açın ve şu bilgileri güncelleyin:

```javascript
// Supabase bağlantı bilgileri
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_SERVICE_KEY = 'your-service-role-key';

// Kurum ID'si
const INSTITUTION_ID = 'your-institution-id';
```

#### 📝 Bilgileri Nereden Bulabilirim?

**SUPABASE_URL ve SUPABASE_SERVICE_KEY:**
1. Supabase Dashboard'a gidin
2. Settings > API bölümüne gidin
3. Project URL'i kopyalayın (SUPABASE_URL)
4. service_role key'i kopyalayın (SUPABASE_SERVICE_KEY)

**INSTITUTION_ID:**
1. Ana admin olarak giriş yapın
2. "Kurum Yönetimi" > "Kurum Listesi"ne gidin
3. İlgili kurumun ID'sini kopyalayın
   - VEYA Supabase Dashboard'da `institutions` tablosundan kurum ID'sini bulun

### 4️⃣ Script'i Çalıştırın

```bash
node bulk_add_teachers_from_csv.js
```

## 📊 Örnek Çıktı

```
🚀 CSV dosyası okunuyor: ./ogretmen_listesi.csv

📊 30 öğretmen bulundu

[1/30] Ahmet Yılmaz ekleniyor...
✅ Ahmet Yılmaz başarıyla eklendi (3%)
[2/30] Ayşe Demir ekleniyor...
✅ Ayşe Demir başarıyla eklendi (7%)
...
[30/30] Zeynep Koç ekleniyor...
✅ Zeynep Koç başarıyla eklendi (100%)

============================================================
📊 İşlem Tamamlandı!
============================================================
✅ Başarılı: 30
❌ Hatalı: 0

✅ Eklenen Öğretmenler:
   1. Ahmet Yılmaz
      E-posta: ahmet.yilmaz@okul.com
      Şifre: teacher123
   2. Ayşe Demir
      E-posta: ayse.demir@okul.com
      Şifre: teacher123
   ...

🔑 Tüm öğretmenlerin varsayılan şifresi: teacher123
💡 Öğretmenler ilk girişte şifrelerini değiştirebilirler.

✅ Script başarıyla tamamlandı!
```

## 🎯 CSV Formatı

### Zorunlu Alanlar:
- `firstName` veya `Ad`: Öğretmenin adı
- `lastName` veya `Soyad`: Öğretmenin soyadı
- `email` veya `E-posta`: E-posta adresi (benzersiz olmalı)

### Opsiyonel Alanlar:
- `branch` veya `Branş`: Branş bilgisi
- `phone` veya `Telefon`: Telefon numarası

## ⚠️ Önemli Notlar

1. **E-posta Adresleri Benzersiz Olmalı**: Her öğretmen için farklı bir e-posta adresi kullanın
2. **Varsayılan Şifre**: Tüm öğretmenlerin şifresi `teacher123` olarak ayarlanır
3. **Rate Limiting**: Script her öğretmen arasında 500ms bekler (Supabase limitlerini aşmamak için)
4. **Hata Yönetimi**: Bir öğretmen eklenirken hata olursa, diğerleri eklenmeye devam eder

## 🔧 Alternatif: Manuel Script

CSV dosyası yerine doğrudan JavaScript dizisi kullanmak isterseniz `bulk_add_teachers.js` dosyasını kullanın:

```javascript
const teachers = [
  {
    firstName: 'Ahmet',
    lastName: 'Yılmaz',
    email: 'ahmet.yilmaz@okul.com',
    branch: 'Matematik',
    phone: '5551234567'
  },
  // ... daha fazla öğretmen
];
```

Sonra çalıştırın:

```bash
node bulk_add_teachers.js
```

## 📞 Sorun Giderme

### "CSV dosyası okunamadı" hatası:
- `ogretmen_listesi.csv` dosyasının script ile aynı klasörde olduğundan emin olun
- Dosya adının doğru olduğunu kontrol edin

### "Auth hatası: User already registered":
- Bu e-posta adresi zaten kullanılıyor
- Farklı bir e-posta adresi kullanın

### "Rate limit exceeded":
- Script'teki bekleme süresini artırın (500ms → 1000ms)

## 💡 İpuçları

1. **Önce Test Edin**: İlk olarak 2-3 öğretmen ile test edin
2. **Yedek Alın**: İşlem öncesi veritabanı yedeği alın
3. **CSV Kontrolü**: Excel'de açıp kontrol edin, ardından "CSV (Comma delimited)" olarak kaydedin
4. **Şifre Paylaşımı**: Script çıktısını kaydedin, öğretmenlere şifrelerini iletin

## 🎓 Öğrenci İçin de Kullanabilir miyim?

Evet! Aynı mantıkla `bulk_add_students_from_csv.js` oluşturabilirsiniz. Sadece:
- `user_type: 'student'` olarak değiştirin
- `teachers` tablosu yerine `students` tablosunu kullanın
- `grade` (sınıf) alanını ekleyin

---

**Sorularınız için:** Bu script'i çalıştırdıktan sonra tüm öğretmenler sisteme eklenmiş olacak ve kurum yönetim panelinden görüntüleyebileceksiniz! 🎉

