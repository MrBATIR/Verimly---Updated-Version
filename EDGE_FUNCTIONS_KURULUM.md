# 🔒 Supabase Edge Functions Kurulum Rehberi

Bu rehber, Service Key'i frontend'den backend'e taşımak için Supabase Edge Functions kurulumunu anlatır.

## 📋 Adım 1: Supabase CLI Kurulumu

⚠️ **NOT:** Supabase CLI artık `npm install -g` ile kurulmuyor. Windows için aşağıdaki yöntemlerden birini kullanın:

### Yöntem 1: Scoop ile Kurulum (Önerilen - Windows için)

```powershell
# Scoop yüklü değilse önce Scoop'u kurun:
# https://scoop.sh/ adresinden kurulum talimatlarını takip edin

# Supabase CLI'yi kur:
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Yöntem 2: npx ile Çalıştırma (Kurulum gerektirmez) ✅ ÖNERİLEN

Her komut için `npx supabase` kullanın. İlk çalıştırmada otomatik olarak indirilecektir:
```bash
npx supabase login
npx supabase link --project-ref jxxtdljuarnxsmqstzyy
npx supabase functions deploy guidance-teacher-students
```

**Not:** `npx` her seferinde paketi kontrol eder, bu yüzden ilk çalıştırmada biraz zaman alabilir.

### Yöntem 3: GitHub'dan Binary İndirme

1. https://github.com/supabase/cli/releases adresinden en son release'i indirin
2. Windows için `.exe` dosyasını indirin
3. PATH'e ekleyin veya doğrudan çalıştırın

## 📋 Adım 2: Supabase Projesine Bağlan

```bash
# Supabase'e giriş yap (tarayıcı açılacak, giriş yapın)
npx supabase login

# Projeye bağlan (project-ref, Supabase Dashboard > Settings > API > Reference ID)
npx supabase link --project-ref jxxtdljuarnxsmqstzyy
```

**Not:** `supabase login` komutu tarayıcınızı açacak ve Supabase hesabınızla giriş yapmanızı isteyecektir.

## 📋 Adım 3: Service Key'i Secret Olarak Ekle

⚠️ **ÖNEMLİ:** Service Key'i Supabase Dashboard'dan alın:
1. Supabase Dashboard > Settings > API
2. "service_role" key'i kopyalayın
3. Aşağıdaki komutla secret olarak ekleyin:

```bash
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**VEYA** Supabase Dashboard'dan:
- Edge Functions > Secrets > Add new secret
- Name: `SUPABASE_SERVICE_ROLE_KEY`
- Value: Service key'inizi yapıştırın

## 📋 Adım 4: Edge Functions'ı Deploy Et

```bash
# Tek bir fonksiyon deploy et
npx supabase functions deploy guidance-teacher-students

# Tüm fonksiyonları deploy et
npx supabase functions deploy
```

## 📋 Adım 5: Test Et

Deploy edilen fonksiyonu test etmek için:

```bash
# Local test
npx supabase functions serve guidance-teacher-students
```

# Remote test
curl -X POST https://jxxtdljuarnxsmqstzyy.supabase.co/functions/v1/guidance-teacher-students \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"institution_id": "your-institution-id"}'
```

## 🔄 Mevcut Service Key'i Rotate Etme

**⚠️ KRİTİK GÜVENLİK ADIMI:**

1. Supabase Dashboard > Settings > API > Service Role Key
2. "Reset service role key" butonuna tıklayın
3. Yeni key'i kopyalayın
4. Eski key'i artık kullanamazsınız
5. Yeni key'i Edge Functions secrets'a ekleyin (Adım 3)

## 📝 Notlar

- Edge Functions, Deno runtime kullanır
- Her fonksiyon otomatik olarak CORS headers ekler
- Kullanıcı token'ı her istekte kontrol edilir
- Service Key sadece Edge Functions'da kullanılır (frontend'de değil)

## 🚀 Sonraki Adımlar

1. ✅ Service Key'i rotate edin (yukarıdaki adım)
2. ✅ Edge Functions'ı deploy edin
3. ✅ Frontend kodunu güncelleyin (adminApi.js kullanarak)
4. ✅ Tüm `supabaseAdmin` kullanımlarını Edge Function çağrılarına çevirin

