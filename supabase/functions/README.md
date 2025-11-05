# Supabase Edge Functions

Bu klasör, Supabase Edge Functions içindir. Bu fonksiyonlar, frontend'de Service Key kullanımını önlemek için oluşturulmuştur.

## Kurulum

1. **Supabase CLI Kurulumu:**
   ```bash
   npm install -g supabase
   ```

2. **Supabase Projesine Bağlan:**
   ```bash
   supabase login
   supabase link --project-ref jxxtdljuarnxsmqstzyy
   ```

3. **Service Key'i Secret Olarak Ekle:**
   Supabase Dashboard > Edge Functions > Secrets kısmından:
   - `SUPABASE_SERVICE_ROLE_KEY` adıyla service key'i ekle
   - Veya CLI ile:
   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_key_here
   ```

4. **Fonksiyonları Deploy Et:**
   ```bash
   supabase functions deploy guidance-teacher-students
   ```

## Mevcut Fonksiyonlar

### guidance-teacher-students
Rehber öğretmen için kurumdaki tüm öğrencileri getirir.

**Request:**
```json
{
  "institution_id": "uuid"
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Öğrenci Adı",
      "email": "email@example.com",
      "grade": "10",
      ...
    }
  ],
  "error": null
}
```

## Yeni Fonksiyon Ekleme

1. `supabase/functions/function-name/index.ts` dosyası oluştur
2. Fonksiyonu yaz (yukarıdaki örnekleri referans al)
3. Deploy et: `supabase functions deploy function-name`

## Güvenlik Notları

- ✅ Service Key sadece Edge Functions'da kullanılıyor (backend'de)
- ✅ Her fonksiyon kullanıcı token'ını doğruluyor
- ✅ Yetki kontrolü her fonksiyonda yapılıyor
- ✅ CORS headers eklendi

