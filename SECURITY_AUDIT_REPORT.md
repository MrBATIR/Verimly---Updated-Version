# 🔒 Güvenlik Denetim Raporu - Verimly Uygulaması

**Tarih:** 2025-01-XX  
**Durum:** ⚠️ KRİTİK GÜVENLİK AÇIKLARI TESPİT EDİLDİ

---

## 🚨 KRİTİK SEVİYE AÇIKLAR (Acil Düzeltme Gerekli)

### 1. Ana Admin Girişi - Hardcoded Credentials ⚠️ KRİTİK

**Konum:** `src/screens/LoginScreen.js:1368-1387`

**Sorun:**
```javascript
const handleAdminLogin = async () => {
  if (adminUsername === 'admin' && adminPassword === 'admin123') {
    // Direkt giriş yapıyor, backend doğrulaması yok!
  }
}
```

**Riskler:**
- ❌ Şifre kod içinde açık şekilde görünüyor
- ❌ Herkes kaynak kodunu görüntüleyerek admin şifresini öğrenebilir
- ❌ Backend doğrulaması yok - sadece frontend kontrolü var
- ❌ Rate limiting yok - brute force saldırılarına açık
- ❌ Session/token yönetimi yok

**Önerilen Çözüm:**
1. Supabase Auth kullanarak admin kullanıcısı oluşturun
2. Normal kullanıcı girişi gibi JWT token ile kimlik doğrulama yapın
3. Role-based access control (RBAC) ekleyin

**Kod Örneği:**
```javascript
// ✅ DOĞRU YAKLAŞIM
const handleAdminLogin = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: adminUsername, // admin@verimly.com gibi
    password: adminPassword
  });
  
  if (error) {
    Alert.alert('Hata', 'Geçersiz giriş bilgileri');
    return;
  }
  
  // Admin rolünü kontrol et
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('user_type')
    .eq('user_id', data.user.id)
    .single();
    
  if (profile?.user_type !== 'admin') {
    Alert.alert('Hata', 'Yetkiniz yok');
    return;
  }
  
  // Admin paneline yönlendir
};
```

---

### 2. Supabase Service Key Sızıntısı ⚠️ KRİTİK

**Konum:** `src/lib/supabase.js:19`

**Sorun:**
```javascript
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
// Bu key frontend kodunda açık!
```

**Riskler:**
- ❌ Service key, Supabase'de EN YÜKSEK yetkiye sahip key'dir
- ❌ Bu key ile herkes database'deki TÜM verilere erişebilir
- ❌ Tüm tabloları okuyabilir, değiştirebilir, silebilir
- ❌ Row Level Security (RLS) politikalarını bypass edebilir
- ❌ Herkes admin yetkisine sahip olabilir

**Önerilen Çözüm:**
1. **SERVICE KEY'İ DERHAL DEĞİŞTİRİN** (Supabase Dashboard > Settings > API)
2. Service key'i frontend kodundan tamamen kaldırın
3. Backend API (Node.js, Python, vb.) oluşturun
4. Admin işlemlerini backend üzerinden yapın
5. Service key'i sadece backend ortam değişkenlerinde saklayın

**Acil Adımlar:**
```bash
# 1. Supabase Dashboard'a gidin
# 2. Settings > API > Service Role Key
# 3. "Reset service role key" butonuna tıklayın
# 4. Yeni key'i backend .env dosyasına ekleyin
```

**Mimari Değişiklik:**
```
❌ ÖNCEKİ:
Frontend → supabaseAdmin (service key) → Database

✅ YENİ:
Frontend → Backend API → supabaseAdmin (service key) → Database
```

---

### 3. Kurum Admin Şifreleri Plain Text ⚠️ KRİTİK

**Konum:** `database/ad_system_tables.sql:647-669`

**Sorun:**
```sql
CREATE OR REPLACE FUNCTION verify_institution_admin_login(
  p_admin_username VARCHAR(50),
  p_admin_password VARCHAR(255)
) AS $$
BEGIN
  RETURN QUERY
  SELECT ...
  WHERE iac.admin_password = p_admin_password  -- Direkt string karşılaştırma!
END;
```

**Riskler:**
- ❌ Şifreler veritabanında hash'lenmeden saklanıyor
- ❌ Veritabanına erişen herkes (DBA, backup erişimi, vb.) tüm şifreleri görebilir
- ❌ Şifre değiştirildiğinde eski şifreler de görünür durumda kalır
- ❌ GDPR/KVKK ihlali riski

**Önerilen Çözüm:**
1. Şifreleri bcrypt veya argon2 ile hash'leyin
2. Karşılaştırma işlemini hash üzerinden yapın

**Kod Örneği:**
```sql
-- ✅ DOĞRU YAKLAŞIM
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Şifre hash'leme fonksiyonu
CREATE OR REPLACE FUNCTION hash_password(p_password TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN crypt(p_password, gen_salt('bf'));
END;
$$ LANGUAGE plpgsql;

-- Karşılaştırma fonksiyonu
CREATE OR REPLACE FUNCTION verify_password(
  p_plain_password TEXT,
  p_hashed_password TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_hashed_password = crypt(p_plain_password, p_hashed_password);
END;
$$ LANGUAGE plpgsql;

-- Güncellenmiş login fonksiyonu
CREATE OR REPLACE FUNCTION verify_institution_admin_login(
  p_admin_username VARCHAR(50),
  p_admin_password VARCHAR(255)
) RETURNS TABLE(...) AS $$
BEGIN
  RETURN QUERY
  SELECT ...
  FROM institution_admin_credentials iac
  JOIN institutions i ON iac.institution_id = i.id
  WHERE iac.admin_username = p_admin_username
    AND verify_password(p_admin_password, iac.admin_password)  -- ✅ Hash karşılaştırma
    AND iac.is_active = true
    AND i.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mevcut şifreleri hash'le (migration)
UPDATE institution_admin_credentials
SET admin_password = crypt(admin_password, gen_salt('bf'))
WHERE admin_password NOT LIKE '$2%';  -- Zaten hash'lenmiş olanları atla
```

---

## ⚠️ ORTA SEVİYE AÇIKLAR

### 4. Varsayılan Zayıf Şifreler

**Konum:** `src/screens/LoginScreen.js:1343, 2157`

**Sorun:**
- Şifre sıfırlama işleminde "user123", "student123" gibi zayıf şifreler kullanılıyor

**Önerilen Çözüm:**
1. Rastgele güçlü şifreler oluşturun (min 12 karakter, büyük/küçük harf, sayı, özel karakter)
2. İlk girişte şifre değiştirme zorunluluğu ekleyin

---

### 5. Oturum Yönetimi Eksiklikleri

**Sorun:**
- Admin paneline erişim için sürekli kimlik doğrulama kontrolü yok
- Session timeout yok

**Önerilen Çözüm:**
1. Her admin işlemi öncesinde token geçerliliğini kontrol edin
2. Session timeout ekleyin (örn: 30 dakika)
3. Kritik işlemler için çok faktörlü kimlik doğrulama (2FA) ekleyin

---

## 📋 DÜZELTME ÖNCELİK SIRASI

1. **🔴 ACİL (Hemen):**
   - Service key'i Supabase'de değiştirin
   - Service key'i frontend kodundan kaldırın
   - Backend API oluşturun

2. **🟠 YÜKSEK (Bu Hafta):**
   - Ana admin girişini Supabase Auth'a taşıyın
   - Kurum admin şifrelerini hash'leyin
   - Mevcut şifreleri hash'leyin (migration)

3. **🟡 ORTA (Bu Ay):**
   - Varsayılan şifreleri güçlendirin
   - Oturum yönetimi ekleyin
   - Rate limiting ekleyin

---

## 🔐 GÜVENLİK BEST PRACTICES

### Şifre Yönetimi:
- ✅ Minimum 12 karakter
- ✅ Büyük/küçük harf, sayı, özel karakter karışımı
- ✅ bcrypt veya argon2 hash algoritması kullanın
- ✅ Salt kullanın (bcrypt otomatik yapar)
- ✅ Şifre güçlülük kontrolü yapın

### Kimlik Doğrulama:
- ✅ JWT token kullanın
- ✅ Token expiration ekleyin
- ✅ Refresh token mekanizması
- ✅ Rate limiting (örn: 5 deneme/saat)

### Veri Güvenliği:
- ✅ Tüm hassas verileri şifreleyin
- ✅ RLS (Row Level Security) politikalarını kullanın
- ✅ Service key'leri sadece backend'de saklayın
- ✅ Environment variables kullanın (.env dosyaları)

---

## 📞 SONUÇ

**Durum:** ⚠️ Uygulamada ciddi güvenlik açıkları tespit edilmiştir.

**Önerilen Aksiyon Planı:**
1. Service key'i derhal değiştirin ve backend'e taşıyın
2. Admin giriş sistemini Supabase Auth ile entegre edin
3. Şifre hash'leme sistemini implement edin
4. Güvenlik testlerini yapın

**Not:** Bu açıklar production ortamında kullanılmadan önce mutlaka düzeltilmelidir.

