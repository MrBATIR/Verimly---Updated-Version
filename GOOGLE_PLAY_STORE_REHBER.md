# Google Play Store'a Uygulama Yükleme Rehberi

## 📋 Ön Hazırlık

### 1. Google Play Console Hesabı
- [Google Play Console](https://play.google.com/console) adresinden hesap oluşturun
- **Önemli**: Bir kerelik 25$ kayıt ücreti ödemeniz gerekiyor
- Google hesabınızla giriş yapın

### 2. Gerekli Dosyalar ve Yapılandırmalar

#### ✅ Kontrol Listesi:
- [ ] Google Play Console hesabı oluşturuldu
- [ ] EAS CLI kurulu (`npm install -g eas-cli`)
- [ ] Expo hesabınız var (`expo login`)
- [ ] `app.json` yapılandırması kontrol edildi
- [ ] Uygulama ikonları ve splash screen hazır
- [ ] Privacy Policy URL'i hazır (zorunlu)

## 🚀 Adım Adım Süreç

### ADIM 1: EAS CLI Kurulumu ve Giriş

```bash
# EAS CLI'yi global olarak kurun
npm install -g eas-cli

# Expo hesabınıza giriş yapın
eas login

# Eğer hesabınız yoksa
expo register
```

### ADIM 2: Google Play Console'da Uygulama Oluşturma

1. [Google Play Console](https://play.google.com/console) adresine gidin
2. **"Uygulama oluştur"** butonuna tıklayın
3. Uygulama bilgilerini girin:
   - **Uygulama adı**: Verimly
   - **Varsayılan dil**: Türkçe
   - **Uygulama veya oyun**: Uygulama
   - **Ücretsiz mi, yoksa ücretli mi?**: Ücretsiz
   - **Kullanıcı verileri toplama beyanı**: Evet (Supabase kullanıyorsunuz)
   - **COVID-19 uygulama beyanı**: Hayır
4. **"Oluştur"** butonuna tıklayın

### ADIM 3: Uygulama Yapılandırmasını Kontrol Edin

`app.json` dosyanızda şunlar olmalı:
- ✅ `package`: "com.verimly.app" (Android için benzersiz paket adı)
- ✅ `versionCode`: 1 (her yeni sürümde artırılmalı)
- ✅ `version`: "1.0.0" (kullanıcıya gösterilen versiyon)
- ✅ `adaptiveIcon`: İkon dosyaları hazır

### ADIM 4: Production Build Oluşturma

```bash
# Proje dizinine gidin
cd Verimly

# Production build başlatın
eas build --platform android --profile production
```

**Not**: İlk build 15-30 dakika sürebilir. Build tamamlandığında:
- Build URL'i gösterilecek
- E-posta ile bildirim alacaksınız
- Build tamamlandıktan sonra indirme linki verilecek

### ADIM 5: Google Play Console'da Uygulama Bilgilerini Doldurma

1. **Mağaza listesi** sekmesine gidin

2. **Uygulama adı**: Verimly
3. **Kısa açıklama** (80 karakter max):
   ```
   Öğrenci ve öğretmenler için akıllı çalışma takip uygulaması
   ```

4. **Tam açıklama** (4000 karakter max):
   ```
   Verimly, öğrenciler ve öğretmenler için tasarlanmış modern bir çalışma takip uygulamasıdır.

   ÖĞRENCI ÖZELLİKLERİ:
   • Çalışma logları ekleme ve takip etme
   • Pomodoro timer ile verimli çalışma
   • Günlük, haftalık ve aylık raporlar
   • Öğretmenlerle mesajlaşma
   • Çalışma planları oluşturma
   • Profil yönetimi ve avatar seçimi

   ÖĞRETMEN ÖZELLİKLERİ:
   • Öğrenci çalışma loglarını görüntüleme
   • Öğrencilerle mesajlaşma
   • Öğrenci planları oluşturma ve yönetme
   • Rehber öğretmen özellikleri

   KURUM YÖNETİMİ:
   • Kurum yöneticisi paneli
   • Öğretmen ve öğrenci yönetimi
   • Kurum istatistikleri
   • Rehber öğretmen atama

   Verimly ile çalışmalarınızı takip edin, hedefler belirleyin ve başarınızı artırın!
   ```

5. **Görseller**:
   - **Uygulama ikonu**: 512x512 px (PNG, şeffaf arka plan YOK)
   - **Özellik grafiği** (zorunlu): 1024x500 px (PNG veya JPG)
   - **Telefon ekran görüntüleri** (en az 2, en fazla 8):
     - Minimum: 320px
     - Maksimum: 3840px
     - En-boy oranı: 16:9 veya 9:16
   - **7 inç tablet ekran görüntüleri** (opsiyonel)
   - **10 inç tablet ekran görüntüleri** (opsiyonel)

### ADIM 6: İçerik Derecelendirme

1. **İçerik derecelendirme** sekmesine gidin
2. Anketi doldurun:
   - **Kategori**: Eğitim
   - **Şiddet**: Hayır
   - **Kumar**: Hayır
   - **Cinsel içerik**: Hayır
   - **Kullanıcı tarafından oluşturulan içerik**: Evet (mesajlaşma var)
   - **Kişisel bilgiler**: Evet (kullanıcı profilleri)
3. **Derecelendirme al** butonuna tıklayın

### ADIM 7: Gizlilik Politikası

**ZORUNLU**: Google Play Store, kullanıcı verileri toplayan uygulamalar için gizlilik politikası URL'i ister.

**Seçenekler**:
1. **Ücretsiz**: GitHub Pages, Netlify, Vercel gibi platformlarda statik sayfa oluşturun
2. **Ücretli**: Kendi web sitenizde yayınlayın

**Gizlilik Politikası Örneği**:
- Kullanıcı verileri nasıl toplanıyor?
- Hangi veriler toplanıyor? (email, profil bilgileri, çalışma logları)
- Veriler nerede saklanıyor? (Supabase)
- Veriler üçüncü taraflarla paylaşılıyor mu?
- Kullanıcı hakları nelerdir?

**Örnek URL**: `https://yourwebsite.com/privacy-policy` veya `https://github.com/MrBATIR/Verimly---Updated-Version/blob/main/PRIVACY_POLICY.md`

### ADIM 8: App Bundle Yükleme

1. **Üretim** sekmesine gidin
2. **Yeni sürüm oluştur** butonuna tıklayın
3. **App Bundle veya APK yükle** butonuna tıklayın
4. EAS Build ile oluşturduğunuz `.aab` dosyasını yükleyin
   - Build tamamlandıktan sonra indirme linkinden indirin
   - Veya `eas build:list` komutu ile indirme linkini görebilirsiniz

### ADIM 9: Sürüm Notları

Her yeni sürüm için sürüm notları ekleyin:

**Örnek**:
```
İlk sürüm - Verimly 1.0.0

Özellikler:
• Çalışma logları ekleme ve takip
• Pomodoro timer
• Öğrenci-öğretmen mesajlaşma
• Çalışma planları
• Kurum yönetim paneli
• Demo mod desteği
```

### ADIM 10: Hedef Kitle ve İçerik

1. **Hedef kitle ve içerik** sekmesine gidin
2. **Hedef kitle seviyesi**: Genel kitle
3. **Kategori**: Eğitim
4. **Uygulama erişilebilirliği**: Evet (engelli kullanıcılar için)

### ADIM 11: Fiyatlandırma ve Dağıtım

1. **Fiyatlandırma ve dağıtım** sekmesine gidin
2. **Ücretsiz** seçeneğini seçin
3. **Ülke/alan**: Tüm ülkeler veya belirli ülkeler seçin
4. **Kullanıcı verileri beyanı**:
   - Veri toplama: Evet
   - Veri paylaşımı: Hayır (sadece kendi sunucularınızda)
   - Veri güvenliği: Evet (Supabase kullanıyorsunuz)

### ADIM 12: İnceleme için Gönder

1. Tüm bilgileri kontrol edin
2. **İnceleme için gönder** butonuna tıklayın
3. Google incelemesi 1-3 gün sürebilir
4. İnceleme sırasında e-posta bildirimleri alacaksınız

## 📝 Önemli Notlar

### Version Code Yönetimi
Her yeni sürüm için `app.json`'da `versionCode`'u artırın:
```json
"android": {
  "versionCode": 2,  // 1'den 2'ye, sonra 3'e...
  "version": "1.0.1"  // Kullanıcıya gösterilen versiyon
}
```

### Gizlilik Politikası
- **ZORUNLU**: Google Play Store gizlilik politikası URL'i ister
- GitHub README'de bir bölüm olabilir
- Veya ayrı bir web sayfası oluşturun

### Test
- İlk yayınlamadan önce **Internal Testing** veya **Closed Testing** ile test edin
- Test kullanıcıları ekleyin ve geri bildirim alın

## 🔧 EAS Build Komutları

```bash
# Production build
eas build --platform android --profile production

# Build durumunu kontrol et
eas build:list

# Build indirme
eas build:download [BUILD_ID]

# Build loglarını görüntüle
eas build:view [BUILD_ID]
```

## ❓ Sık Sorulan Sorular

**S: Build başarısız olursa ne yapmalıyım?**
C: `eas build:view [BUILD_ID]` ile logları kontrol edin. Genellikle yapılandırma hatası olur.

**S: Kaç kez güncelleme yapabilirim?**
C: Sınırsız. Her güncellemede `versionCode` artırılmalı.

**S: İnceleme reddedilirse?**
C: Google gerekçe verir. Sorunları düzeltip tekrar gönderin.

**S: APK mı yoksa AAB mi?**
C: Google Play Store için **AAB (Android App Bundle)** kullanın. EAS otomatik olarak AAB oluşturur.

## 📞 Yardım

Sorun yaşarsanız:
- [EAS Build Dokümantasyonu](https://docs.expo.dev/build/introduction/)
- [Google Play Console Yardım](https://support.google.com/googleplay/android-developer)
- [Expo Discord](https://chat.expo.dev/)

