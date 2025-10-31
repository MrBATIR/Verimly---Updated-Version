# Verimly - Öğrenci Çalışma Takip Uygulaması

Modern ve kullanıcı dostu bir React Native mobil uygulama.

## 📱 Özellikler

- ✅ Modern ve temiz kullanıcı arayüzü
- ✅ Bottom Tab Navigation ile kolay gezinme
- ✅ Reusable componentler (Button, Card, Input, Container, Select, SwipeableRow)
- ✅ Ana sayfa (Dashboard) ile çalışma özeti
- ✅ Swipe-to-delete/edit özelliği
- ✅ Kullanıcı kayıt ve giriş sistemi
- ✅ Responsive ve performanslı tasarım

## 🛠 Teknoloji Yığını

- **React Native** - Mobil uygulama framework'ü
- **Expo** - Geliştirme ve build aracı
- **React Navigation** - Navigasyon yönetimi
- **Supabase** - Backend servisi (yakında)
- **Gesture Handler** - Swipe özellikleri

## 🚀 Kurulum

### Gereksinimler
- Node.js (LTS)
- Expo Go uygulaması (mobil cihaz için)
- Git

### Projeyi Çalıştırma

1. **Projeyi klonlayın:**
   ```bash
   git clone https://github.com/KULLANICI_ADINIZ/Verimly.git
   cd Verimly/Verimly
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
│   ├── components/         # Reusable componentler
│   │   ├── Button.js
│   │   ├── Card.js
│   │   ├── Input.js
│   │   ├── Container.js
│   │   ├── Select.js
│   │   └── SwipeableRow.js
│   ├── screens/           # Ana ekranlar
│   │   ├── DashboardScreen.js
│   │   ├── ReportsScreen.js
│   │   ├── AddLogScreen.js
│   │   ├── ProfileScreen.js
│   │   ├── LoginScreen.js
│   │   └── RegisterScreen.js
│   ├── navigation/        # Navigation yapısı
│   │   ├── AppNavigator.js
│   │   ├── BottomTabNavigator.js
│   │   └── AuthNavigator.js
│   ├── constants/         # Sabitler (renkler, temalar)
│   │   └── theme.js
│   └── lib/              # Supabase ve diğer kütüphaneler
│       └── supabase.js
├── App.js
└── package.json
```

## 🎨 Özellikler

✅ Form validasyonu (gerçek zamanlı)
✅ Hata mesajları Türkçe
✅ Responsive tasarım
✅ Keyboard aware scroll
✅ Modal presentation (Auth ekranları)
✅ Swipe-to-delete/edit
✅ Loading states

## 📝 Geliştirme Notları

- Supabase URL ve API key'leri `src/lib/supabase.js` dosyasından güncellenmeli
- Her commit öncesi test yapılmalı
- Değişiklikler anlamlı commit mesajları ile yapılmalı

## 📄 Lisans

Bu proje özel bir projedir.

## 👨‍💻 Geliştirici

Osman Batır
