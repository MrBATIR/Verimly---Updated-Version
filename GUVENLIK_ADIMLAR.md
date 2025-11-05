# 🔒 Güvenlik İyileştirme Adımları - Checklist

## ✅ Tamamlanan Adımlar

- [x] **Adım 1:** Service key'i frontend'den kaldırıldı (`src/lib/supabase.js`)
- [x] **Adım 2:** Supabase CLI kuruldu ve projeye bağlanıldı

## 📋 Devam Eden Adımlar

### ⚠️ Adım 3: Service Key'i Rotate Et (KRİTİK - Manuel)

**Neden önemli?**
- Eski service key frontend kodunda hardcoded olarak bulunuyordu
- GitHub'a yüklenmiş olabilir veya başkaları tarafından görülmüş olabilir
- Yeni key ile eski key artık çalışmayacak

**Nasıl yapılır:**
1. Supabase Dashboard'a gidin: https://supabase.com/dashboard
2. Projenizi seçin
3. **Settings > API** bölümüne gidin
4. **Service Role Key** kısmını bulun
5. **"Reset service role key"** butonuna tıklayın
6. ⚠️ **UYARI:** Eski key artık çalışmayacak!
7. Yeni key'i kopyalayın ve güvenli bir yerde saklayın

**Yeni key formatı:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4eHRkbGp1YXJueHNtcXN0enl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6...
```

---

### 📋 Adım 4: Service Key'i Edge Functions Secrets'a Ekle

**Seçenek A - CLI ile (Önerilen):**
```bash
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=yeni_key_buraya
```

**Seçenek B - Dashboard'dan:**
1. Supabase Dashboard > **Edge Functions > Secrets**
2. **"Add new secret"** butonuna tıklayın
3. **Name:** `SUPABASE_SERVICE_ROLE_KEY`
4. **Value:** Yeni service key'i yapıştırın
5. **Save** butonuna tıklayın

---

### 📋 Adım 5: Edge Function'ı Deploy Et

```bash
npx supabase functions deploy guidance-teacher-students
```

Başarılı olursa şöyle bir çıktı göreceksiniz:
```
Function guidance-teacher-students deployed successfully
```

---

### 📋 Adım 6: Test Et (Opsiyonel)

Deploy edilen fonksiyonu test etmek için:
```bash
# Remote test (curl ile)
curl -X POST https://jxxtdljuarnxsmqstzyy.supabase.co/functions/v1/guidance-teacher-students \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"institution_id": "your-institution-id"}'
```

---

## 🚀 Sonraki Adımlar (Kod Güncellemeleri)

Edge Functions deploy edildikten sonra:
1. Frontend kodlarını güncelleyeceğiz (19 dosya)
2. `supabaseAdmin` kullanımlarını `adminApi.js` çağrılarına çevireceğiz
3. Test edip çalıştığından emin olacağız

---

## ⚠️ Önemli Notlar

- **Service Key'i asla frontend'e geri eklemeyin!**
- Service Key sadece Edge Functions'da kullanılmalı
- Eski key'i kullanan hiçbir kod çalışmamalı
- Yeni key'i sadece Supabase Dashboard'dan görebilirsiniz (bir kez gösterilir)

