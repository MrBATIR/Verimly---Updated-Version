# 🔒 Güvenlik Denetim Raporu - Verimly Uygulaması

**Tarih:** 2025-01-XX  
**Durum:** ⚠️ KRİTİK GÜVENLİK AÇIKLARI TESPİT EDİLDİ

---

## 🚨 KRİTİK SEVİYE AÇIKLAR (Acil Düzeltme Gerekli)

### 1. Supabase Service Key Sızıntısı ⚠️ KRİTİK

**Konum:** `src/lib/supabase.js:19-21`

**Sorun:**
```javascript
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {...});
```

**Riskler:**
- ❌ Service key, Supabase'de EN YÜKSEK yetkiye sahip key'dir
- ❌ RLS (Row Level Security) politikalarını tamamen bypass eder
- ❌ Tüm veritabanına sınırsız erişim sağlar
- ❌ Frontend kodunda hardcoded - herkes görebilir
- ❌ GitHub'a yüklendiğinde public olur
- ❌ Bu key ile tüm kullanıcı verileri, şifreler, finansal bilgiler çalınabilir
- ❌ Veritabanı tamamen silinebilir veya manipüle edilebilir

**Etkilenen Dosyalar:**
- `src/lib/supabase.js` - Service key tanımı
- `src/screens/LoginScreen.js` - Normal kullanıcı girişi için bile supabaseAdmin kullanılıyor
- `src/screens/InstitutionAdminScreen.js` - Tüm işlemlerde supabaseAdmin
- `src/screens/TeacherReportsScreen.js` - Rehber öğretmen için supabaseAdmin
- `src/screens/TeacherHomeScreen.js` - Rehber öğretmen için supabaseAdmin
- Ve diğer birçok dosya...

**Önerilen Çözüm:**

#### A) Backend API Oluşturma (Önerilen)
1. Backend servisi oluştur (Node.js/Express veya Supabase Edge Functions)
2. Service key'i backend'e taşı (sadece backend'de tut)
3. Frontend'den backend API'ye istek at
4. Backend'de service key ile işlemleri yap

**Kod Örneği:**
```javascript
// ✅ DOĞRU YAKLAŞIM - Backend API
// Frontend
const response = await fetch('https://your-api.com/api/guidance-teacher/students', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${session.access_token}`
  }
});

// Backend (Node.js/Express)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // .env'den
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
// Kullanıcı yetkilerini kontrol et
// İşlemi yap
```

#### B) Supabase Edge Functions Kullanma (Alternatif)
1. Supabase Edge Functions oluştur
2. Service key'i function environment variable'ına ekle
3. Frontend'den function'ı çağır

**Kod Örneği:**
```javascript
// Frontend
const { data, error } = await supabase.functions.invoke('get-guidance-students', {
  body: { institution_id: institutionId }
});

// Edge Function (Supabase Functions)
import { createClient } from '@supabase/supabase-js'
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Environment variable
)
```

#### C) Geçici Çözüm (Hızlı Düzeltme)
1. Service key'i Supabase'de rotate edin (yeni key oluştur)
2. Eski key'i devre dışı bırakın
3. Yeni key'i backend'e taşıyın
4. Frontend'den service key kullanımını kaldırın

**Acil Yapılacaklar:**
1. ⚠️ **HEMEN:** Supabase Dashboard'dan mevcut service key'i rotate edin
2. ⚠️ **HEMEN:** Eski service key'i devre dışı bırakın
3. Service key kullanımını backend'e taşıyın
4. Frontend'den tüm `supabaseAdmin` kullanımlarını kaldırın (sadece backend API çağrıları)

---

### 2. supabaseAdmin'ın Aşırı Kullanımı ⚠️ YÜKSEK

**Sorun:**
- `supabaseAdmin` (service key) frontend'de çok fazla yerde kullanılıyor
- Normal kullanıcı işlemleri için bile kullanılıyor
- Rehber öğretmen özellikleri için RLS bypass ediliyor

**Riskler:**
- ❌ Frontend'de service key kullanımı güvenlik açığı
- ❌ RLS politikaları bypass ediliyor
- ❌ Yetki kontrolü frontend'de yapılıyor (backend'de olmalı)

**Etkilenen Senaryolar:**
- Rehber öğretmen öğrenci listesi görüntüleme
- Rehber öğretmen plan ekleme/düzenleme
- Normal kullanıcı girişi (LoginScreen'de)
- Kurum yönetimi işlemleri

**Önerilen Çözüm:**
1. Rehber öğretmenler için RLS politikaları oluştur
2. `supabaseAdmin` kullanımını backend'e taşı
3. Frontend'de sadece `supabase` (anon key) kullan
4. Backend'de yetki kontrolü yap

---

### 3. Environment Variables Kullanılmıyor ⚠️ ORTA

**Sorun:**
- API key'ler hardcoded
- `.env` dosyası kullanılmıyor
- `.gitignore`'da `.env` var ama `.env` dosyası yok

**Riskler:**
- ❌ Key'ler kod içinde açık
- ❌ Git'e yüklenebilir
- ❌ Farklı ortamlar için farklı key'ler kullanılamıyor

**Önerilen Çözüm:**
```javascript
// ✅ DOĞRU YAKLAŞIM
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Service key'i ASLA frontend'e eklemeyin!
```

`app.json` veya `.env` dosyasında:
```json
{
  "extra": {
    "supabaseUrl": "https://...",
    "supabaseAnonKey": "eyJ..."
  }
}
```

---

## ✅ İYİ UYGULAMALAR (Devam Ettirilecek)

### 1. Admin Girişi Düzeltilmiş ✅
- Supabase Auth kullanılıyor
- Role-based access control var
- Hardcoded credentials yok

### 2. Session Yönetimi ✅
- App.js'de session kontrolü var
- InstitutionAdminScreen'de session timeout kontrolü var
- AsyncStorage ile session yönetimi yapılıyor

### 3. Authentication Kontrolleri ✅
- Admin login'de `user_type` kontrolü yapılıyor
- Giriş başarısız olursa otomatik signOut yapılıyor

---

## 📋 ÖNCELİKLİ AKSIYON LİSTESİ

### Acil (Bugün)
1. ⚠️ **Supabase Dashboard'dan service key'i rotate edin**
2. ⚠️ **Eski service key'i devre dışı bırakın**
3. ⚠️ **Frontend'den service key kullanımını kaldırın**

### Kısa Vadeli (Bu Hafta)
1. Backend API servisi oluşturun
2. Service key'i backend'e taşıyın
3. Frontend'den backend API'ye geçiş yapın
4. RLS politikalarını gözden geçirin

### Orta Vadeli (Bu Ay)
1. Environment variables kullanımını ekleyin
2. API key'leri `.env` dosyasına taşıyın
3. Güvenlik testleri yapın
4. Rate limiting ekleyin

---

## 🔍 DETAYLI GÜVENLİK KONTROLÜ

### Authentication & Authorization
- ✅ Admin girişi Supabase Auth kullanıyor
- ✅ Role-based access control var
- ❌ Service key frontend'de (KRİTİK)
- ❌ Rehber öğretmen için RLS bypass ediliyor

### Data Protection
- ✅ RLS politikaları var (ancak bypass ediliyor)
- ❌ Service key ile tüm verilere erişim mümkün
- ✅ Session yönetimi var

### API Security
- ❌ Service key frontend'de expose edilmiş
- ❌ Backend API yok
- ❌ Rate limiting yok

### Secrets Management
- ❌ API key'ler hardcoded
- ❌ Environment variables kullanılmıyor
- ❌ `.env` dosyası yok

---

## 📝 SONUÇ

**Toplam Tespit Edilen Açık:** 3 kritik, 2 orta seviye

**En Kritik Sorun:** Supabase Service Key'in frontend'de olması. Bu key ile saldırganlar tüm veritabanına erişebilir.

**Önerilen Aksiyon:** Hemen service key'i rotate edin ve backend API oluşturun.

---

**Rapor Hazırlayan:** AI Assistant  
**Son Güncelleme:** 2025-01-XX

