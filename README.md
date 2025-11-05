# Verimly - Öğrenci Çalışma Takip Uygulaması

Modern ve kullanıcı dostu bir React Native mobil uygulama. Öğrenciler ve öğretmenler için akıllı çalışma takip sistemi.

## 📱 Özellikler

### Öğrenci Özellikleri
- ✅ Çalışma logları ekleme ve takip etme
- ✅ Pomodoro timer ile çalışma sürelerini yönetme
- ✅ Günlük, haftalık ve aylık raporlar
- ✅ Öğretmenlerle mesajlaşma
- ✅ Çalışma planları oluşturma ve takip etme
- ✅ Profil yönetimi ve avatar seçimi
- ✅ Demo mod ile uygulamayı deneme

### Öğretmen Özellikleri
- ✅ Öğrenci çalışma loglarını görüntüleme
- ✅ Öğrencilerle mesajlaşma
- ✅ Öğrenci planları oluşturma ve yönetme
- ✅ Öğrenci bağlantı istekleri yönetme
- ✅ Rehber öğretmen özellikleri (kurum bazlı)

### Kurum Yönetimi
- ✅ Kurum yöneticisi paneli
- ✅ Öğretmen ve öğrenci yönetimi
- ✅ Kurum istatistikleri
- ✅ Rehber öğretmen atama
- ✅ Kullanıcı şifre sıfırlama ve yönetimi

### Ana Admin Özellikleri
- ✅ Tüm kurumları yönetme
- ✅ Kurum istatistikleri ve detaylı analizler
- ✅ Kullanıcı arama ve filtreleme
- ✅ Çalışma analitikleri
- ✅ Zaman bazlı istatistikler
- ✅ Bireysel kullanıcı yönetimi

## 🛠 Teknoloji Yığını

- **React Native** - Mobil uygulama framework'ü
- **Expo** - Geliştirme ve build aracı
- **React Navigation** - Navigasyon yönetimi
- **Supabase** - Backend servisi (Auth, Database, Storage)
- **Supabase Edge Functions** - Güvenli backend işlemleri
- **Expo Notifications** - Bildirim sistemi
- **React Native Gesture Handler** - Swipe özellikleri
- **AsyncStorage** - Yerel veri depolama

## 🚀 Kurulum

### Gereksinimler
- Node.js (LTS sürümü önerilir)
- npm veya yarn
- Expo Go uygulaması (mobil cihaz için)
- Git

### Projeyi Çalıştırma

1. **Projeyi klonlayın:**
   ```bash
   git clone https://github.com/MrBATIR/Verimly---Updated-Version.git
   cd Verimly---Updated-Version/Verimly
   ```

2. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

3. **Uygulamayı başlatın:**
   ```bash
   npm start
   ```

4. **Platform seçin:**
   - `a` - Android emulator'de aç
   - `i` - iOS simulator'de aç (sadece Mac)
   - Expo Go uygulamasıyla QR kod tarayın

## 📂 Proje Yapısı

```
Verimly/
├── src/
│   ├── components/         # Yeniden kullanılabilir bileşenler
│   │   ├── Button.js
│   │   ├── Card.js
│   │   ├── Input.js
│   │   ├── Container.js
│   │   ├── Select.js
│   │   ├── SwipeableRow.js
│   │   ├── AdBanner.js
│   │   ├── InterstitialAd.js
│   │   ├── RewardedAd.js
│   │   └── StudyDetailModal.js
│   ├── screens/           # Ana ekranlar
│   │   ├── DashboardScreen.js
│   │   ├── ReportsScreen.js
│   │   ├── AddLogScreen.js
│   │   ├── ProfileScreen.js
│   │   ├── LoginScreen.js
│   │   ├── RegisterScreen.js
│   │   ├── StudentPlanScreen.js
│   │   ├── StudentMessageScreen.js
│   │   ├── TeacherHomeScreen.js
│   │   ├── TeacherReportsScreen.js
│   │   ├── TeacherMessageScreen.js
│   │   ├── TeacherPlanScreen.js
│   │   ├── TeacherRequestsScreen.js
│   │   ├── AdminDashboardScreen.js
│   │   ├── AdminInstitutionsScreen.js
│   │   ├── AdminIndividualUsersScreen.js
│   │   ├── AdminUserSearchScreen.js
│   │   ├── AdminStudyAnalyticsScreen.js
│   │   ├── AdminTimeStatsScreen.js
│   │   ├── InstitutionAdminScreen.js
│   │   └── InstitutionAdminLoginScreen.js
│   ├── navigation/        # Navigasyon yapısı
│   │   ├── AppNavigator.js
│   │   ├── BottomTabNavigator.js
│   │   └── AuthNavigator.js
│   ├── constants/         # Sabitler (renkler, temalar)
│   │   └── theme.js
│   ├── contexts/          # React Context'ler
│   │   └── ThemeContext.js
│   └── lib/              # Kütüphaneler ve API'ler
│       ├── supabase.js
│       ├── adminApi.js
│       ├── messageApi.js
│       └── teacherApi.js
├── supabase/
│   └── functions/        # Supabase Edge Functions
│       ├── institution-admin-*
│       ├── admin-*
│       └── ...
├── database/             # Veritabanı şemaları ve SQL dosyaları
├── assets/               # Görseller ve ikonlar
├── App.js
├── app.json
└── package.json
```

## 🔒 Güvenlik

- **Supabase Service Role Key** frontend'de kullanılmıyor
- Tüm admin işlemleri **Supabase Edge Functions** ile yapılıyor
- Row Level Security (RLS) politikaları aktif
- Güvenli authentication ve authorization

## 📱 Özellikler Detayı

### Çalışma Takibi
- ✅ Çalışma logları ekleme (test, konu çalışması, video, vb.)
- ✅ Odaklanma seviyesi takibi
- ✅ Doğru/yanlış/boş soru sayıları
- ✅ Çalışma notları

### Pomodoro Timer
- ✅ Özelleştirilebilir çalışma ve mola süreleri
- ✅ Otomatik bildirimler
- ✅ Çalışma oturumu yönetimi
- ✅ Duraklatma ve devam etme

### Raporlar ve Analitikler
- ✅ Günlük, haftalık, aylık raporlar
- ✅ İstatistikler ve grafikler
- ✅ Çalışma analitikleri
- ✅ Zaman bazlı istatistikler

### Mesajlaşma
- ✅ Öğrenci-öğretmen mesajlaşma
- ✅ Gerçek zamanlı mesaj güncellemeleri
- ✅ Okunmamış mesaj sayısı

### Planlar
- ✅ Günlük ve haftalık planlar
- ✅ Plan tamamlama takibi
- ✅ Öğretmen tarafından plan oluşturma

## 🎨 Tasarım Özellikleri

- ✅ Modern ve temiz kullanıcı arayüzü
- ✅ Karanlık mod desteği
- ✅ Responsive tasarım
- ✅ Türkçe dil desteği
- ✅ Smooth animasyonlar
- ✅ Swipe-to-delete/edit özelliği

## 📝 Geliştirme Notları

### Önemli Dosyalar
- Supabase yapılandırması: `src/lib/supabase.js`
- Admin API: `src/lib/adminApi.js`
- Edge Functions: `supabase/functions/`
- Tema ayarları: `src/constants/theme.js`

### Yapılandırma
- Supabase URL ve API key'leri `app.json` dosyasındaki `extra` bölümünden alınır
- Environment variables için `.env` dosyası kullanılabilir
- Edge Functions için `supabase/functions/` klasörüne bakın

### Commit Kuralları
- Her commit öncesi test yapılmalı
- Değişiklikler anlamlı commit mesajları ile yapılmalı
- Türkçe commit mesajları kullanılabilir

## 🔧 Build ve Deployment

### Development Build
```bash
npx expo run:ios
npx expo run:android
```

### Production Build (EAS)
```bash
eas build --platform ios
eas build --platform android
```

### Prebuild (Native kodları oluştur)
```bash
npx expo prebuild
```

## 📄 Lisans

Bu proje özel bir projedir.

## 👨‍💻 Geliştirici

Osman Batır

## 📞 İletişim

Proje hakkında sorularınız için GitHub Issues kullanabilirsiniz.

## 🙏 Teşekkürler

- Expo ekibine harika geliştirme araçları için
- Supabase ekibine backend servisleri için
- React Native topluluğuna desteği için
