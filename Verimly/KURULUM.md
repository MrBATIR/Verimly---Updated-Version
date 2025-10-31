# Verimly - Kurulum Talimatları

## 🚀 Supabase Veritabanı Kurulumu

Uygulamanın çalışması için Supabase veritabanında `study_logs` tablosunu oluşturmanız gerekiyor.

### Adımlar:

1. **Supabase Dashboard'a gidin**: https://supabase.com
2. Projenizi açın
3. Sol menüden **SQL Editor** seçeneğine tıklayın
4. `supabase_setup.sql` dosyasının içeriğini kopyalayıp SQL Editor'e yapıştırın
5. **Run** butonuna tıklayarak SQL komutlarını çalıştırın

### ✅ Oluşturulan Tablo Yapısı

`study_logs` tablosu şu alanları içerir:

- **id**: Benzersiz kayıt ID'si (UUID)
- **user_id**: Kullanıcı ID'si (auth.users'a referans)
- **subject**: Ders adı (Matematik, Fizik, vb.)
- **duration**: Çalışma süresi (dakika)
- **correct_answers**: Doğru soru sayısı
- **wrong_answers**: Yanlış soru sayısı
- **empty_answers**: Boş soru sayısı
- **focus_level**: Odaklanma seviyesi (1-10)
- **notes**: Notlar (opsiyonel)
- **study_date**: Çalışma tarihi
- **created_at**: Kayıt oluşturulma zamanı
- **updated_at**: Kayıt güncellenme zamanı

### 🔒 Güvenlik (Row Level Security)

Tablo otomatik olarak Row Level Security (RLS) ile korunur:
- Her kullanıcı **sadece kendi kayıtlarını** görebilir, ekleyebilir, güncelleyebilir ve silebilir
- Başka kullanıcıların verileri görülemez

### 📊 Performans

Aşağıdaki index'ler oluşturularak sorgu performansı optimize edilir:
- `user_id` index'i
- `study_date` index'i
- `user_id + study_date` birleşik index'i

---

## 📱 Uygulamayı Çalıştırma

### 1. Bağımlılıkları yükleyin:
\`\`\`bash
npm install
\`\`\`

### 2. Uygulamayı başlatın:
\`\`\`bash
npm start
\`\`\`

### 3. Expo Go ile test edin:
- Telefonunuza **Expo Go** uygulamasını indirin
- QR kodu tarayın
- Uygulamayı kullanmaya başlayın!

---

## 🎯 Özellikler

### Demo Mod 🎨
- Kayıt olmadan uygulamayı keşfedebilirsiniz
- Örnek verilerle tüm özellikleri görebilirsiniz
- Demo modda ekleme/silme/düzenleme yapılamaz

### Kullanıcı Modu 👤
- Kayıt olun ve giriş yapın
- Kendi çalışma verilerinizi ekleyin
- İstatistiklerinizi takip edin
- Geçmiş çalışmalarınızı görüntüleyin
- Kayıtlarınızı düzenleyin veya silin

### Özellikler:
- ✅ Kullanıcı kaydı ve girişi (Supabase Auth)
- ✅ Çalışma kaydı ekleme
- ✅ Günlük/haftalık/aylık raporlar
- ✅ Soru istatistikleri (doğru/yanlış/boş/net)
- ✅ Odaklanma seviyesi takibi
- ✅ Kaydırarak silme/düzenleme
- ✅ Demo mod

---

## 🛠️ Teknik Detaylar

- **Framework**: React Native (Expo)
- **Veritabanı**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Navigation**: React Navigation
- **State Management**: React Hooks

---

## ❓ Sorun mu yaşıyorsunuz?

### Supabase bağlantı hatası:
- `src/lib/supabase.js` dosyasındaki `supabaseUrl` ve `supabaseAnonKey` değerlerinin doğru olduğundan emin olun
- Supabase projenizin aktif olduğunu kontrol edin

### Tablo oluşturulamıyor:
- SQL komutlarını tek tek çalıştırmayı deneyin
- SQL Editor'de hata mesajlarını kontrol edin

### Veri gözükmüyor:
- Çalışma ekle sayfasından yeni bir kayıt ekleyin
- Dashboard sayfasını yenilemek için aşağı çekin (pull to refresh)

---

Herhangi bir sorunla karşılaşırsanız, lütfen destek isteyin! 🚀

