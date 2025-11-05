// Supabase Edge Function: Kurum Admin - Şifre Değiştirme
// Bu fonksiyon, kurum adminin kendi şifresini değiştirmesini sağlar

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Fonksiyonun başladığını log'la
  console.log('[DEBUG] Edge Function başlatıldı:', { method: req.method, url: req.url });

  try {
    // Supabase client oluştur (Service Key ile)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 
      Deno.env.get('SUPABASE_PROJECT_URL') ||
      'https://jxxtdljuarnxsmqstzyy.supabase.co';
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');
    
    if (!supabaseServiceKey) {
      console.error('[ERROR] Service Role Key secret bulunamadı');
      return new Response(
        JSON.stringify({ error: 'Service Role Key secret bulunamadı. Lütfen secrets kontrol edin.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Request body'den verileri al
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      console.error('[ERROR] Request body parse hatası:', jsonError);
      return new Response(
        JSON.stringify({ error: 'Geçersiz request body', details: jsonError?.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      institution_id, 
      admin_username,
      current_password,
      new_password,
      confirm_password
    } = requestBody;

    console.log('[DEBUG] Şifre değiştirme isteği:', {
      hasInstitutionId: !!institution_id,
      hasAdminUsername: !!admin_username,
      hasCurrentPassword: !!current_password,
      hasNewPassword: !!new_password,
      hasConfirmPassword: !!confirm_password
    });

    if (!institution_id || !admin_username || !current_password || !new_password || !confirm_password) {
      return new Response(
        JSON.stringify({ error: 'Tüm alanlar gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Yeni şifre ve onay şifresi eşleşmeli
    if (new_password !== confirm_password) {
      return new Response(
        JSON.stringify({ error: 'Yeni şifre ve şifre onayı eşleşmiyor' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Şifre uzunluk kontrolü
    if (new_password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Yeni şifre en az 6 karakter olmalıdır' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kurum admin kontrolü
    console.log('[DEBUG] Kurum kontrolü başlatılıyor:', { institution_id });
    let institutionData, institutionError;
    try {
      const result = await supabaseAdmin
        .from('institutions')
        .select('id, contact_email')
        .eq('id', institution_id)
        .eq('is_active', true)
        .single();
      institutionData = result.data;
      institutionError = result.error;
    } catch (queryError) {
      console.error('[ERROR] Kurum sorgusu exception:', queryError);
      institutionError = queryError;
    }

    console.log('[DEBUG] Kurum kontrolü sonucu:', {
      hasInstitutionData: !!institutionData,
      hasInstitutionError: !!institutionError,
      institutionError: institutionError?.message
    });

    if (institutionError || !institutionData) {
      const errorMessage = institutionError?.message || 'Kurum bulunamadı';
      console.log('[DEBUG] Kurum bulunamadı, hata döndürülüyor');
      return new Response(
        JSON.stringify({ error: 'Kurum bulunamadı veya erişim yetkiniz yok', details: errorMessage }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin credentials kontrolü
    console.log('[DEBUG] Admin credentials kontrolü başlatılıyor:', { institution_id, admin_username });
    let adminCredentials, credentialsError;
    try {
      const result = await supabaseAdmin
        .from('institution_admin_credentials')
        .select('id, admin_username, admin_password')
        .eq('institution_id', institution_id)
        .eq('admin_username', admin_username)
        .eq('is_active', true)
        .maybeSingle();
      adminCredentials = result.data;
      credentialsError = result.error;
    } catch (queryError) {
      console.error('[ERROR] Admin credentials sorgusu exception:', queryError);
      credentialsError = queryError;
    }

    console.log('[DEBUG] Admin credentials kontrolü:', {
      hasCredentials: !!adminCredentials,
      credentialsError: credentialsError?.message,
      hasError: !!credentialsError
    });

    if (credentialsError) {
      console.error('[ERROR] Admin credentials sorgu hatası:', credentialsError);
      return new Response(
        JSON.stringify({ error: 'Admin bilgileri kontrol edilemedi', details: credentialsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!adminCredentials) {
      console.log('[DEBUG] Admin credentials bulunamadı:', { institution_id, admin_username });
      return new Response(
        JSON.stringify({ error: 'Admin kullanıcı adı bulunamadı' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mevcut şifre kontrolü - HEM institution_admin_credentials HEM institutions tablosundan kontrol et
    console.log('[DEBUG] Şifre karşılaştırması başlatılıyor');
    
    // 1. institution_admin_credentials tablosundan şifre kontrolü
    const credentialsPasswordMatch = adminCredentials.admin_password === current_password;
    
    // 2. institutions tablosundan şifre kontrolü (eğer varsa)
    let institutionPasswordMatch = false;
    let institutionPassword = null;
    try {
      const { data: institutionData, error: instError } = await supabaseAdmin
        .from('institutions')
        .select('admin_password')
        .eq('id', institution_id)
        .single();
      
      if (!instError && institutionData && institutionData.admin_password) {
        institutionPassword = institutionData.admin_password;
        institutionPasswordMatch = institutionData.admin_password === current_password;
      }
    } catch (instQueryError) {
      console.log('[DEBUG] institutions tablosundan şifre kontrolü yapılamadı:', instQueryError);
    }

    console.log('[DEBUG] Şifre karşılaştırması sonucu:', {
      credentialsPasswordLength: adminCredentials.admin_password?.length || 0,
      institutionPasswordLength: institutionPassword?.length || 0,
      currentPasswordLength: current_password?.length || 0,
      credentialsPasswordMatch,
      institutionPasswordMatch,
      finalMatch: credentialsPasswordMatch || institutionPasswordMatch
    });

    // Her iki tablodan biri eşleşiyorsa kabul et (geriye uyumluluk için)
    if (!credentialsPasswordMatch && !institutionPasswordMatch) {
      return new Response(
        JSON.stringify({ error: 'Mevcut şifre yanlış' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Yeni şifre eski şifre ile aynı olamaz
    if (current_password === new_password) {
      return new Response(
        JSON.stringify({ error: 'Yeni şifre mevcut şifre ile aynı olamaz' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Şifreyi güncelle - HEM institution_admin_credentials HEM institutions tablosunda
    console.log('[DEBUG] Şifre güncelleme başlatılıyor:', { adminCredentialsId: adminCredentials.id, institutionId: institution_id });
    
    // 1. institution_admin_credentials tablosunu güncelle
    let updateData, updateError;
    try {
      const result = await supabaseAdmin
        .from('institution_admin_credentials')
        .update({
          admin_password: new_password,
          updated_at: new Date().toISOString()
        })
        .eq('id', adminCredentials.id)
        .select();
      updateData = result.data;
      updateError = result.error;
    } catch (updateQueryError) {
      console.error('[ERROR] institution_admin_credentials güncelleme sorgusu exception:', updateQueryError);
      updateError = updateQueryError;
    }

    console.log('[DEBUG] institution_admin_credentials güncelleme sonucu:', {
      hasUpdateData: !!updateData,
      hasUpdateError: !!updateError,
      updateError: updateError?.message
    });

    if (updateError) {
      console.error('[ERROR] institution_admin_credentials güncelleme hatası:', updateError);
      return new Response(
        JSON.stringify({ error: 'Şifre güncellenemedi', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. institutions tablosundaki admin_password'u da güncelle (eğer varsa)
    console.log('[DEBUG] institutions tablosu güncelleme başlatılıyor');
    let institutionUpdateError;
    try {
      const institutionResult = await supabaseAdmin
        .from('institutions')
        .update({
          admin_password: new_password,
          updated_at: new Date().toISOString()
        })
        .eq('id', institution_id);

      institutionUpdateError = institutionResult.error;
      
      if (institutionUpdateError) {
        console.error('[ERROR] institutions tablosu güncelleme hatası:', institutionUpdateError);
        // institutions tablosunda admin_password alanı yoksa veya başka bir hata varsa, 
        // hata verme ama log'la (geriye uyumluluk için)
        console.log('[WARN] institutions tablosu güncellenemedi, ancak institution_admin_credentials güncellendi');
      } else {
        console.log('[DEBUG] institutions tablosu başarıyla güncellendi');
      }
    } catch (institutionUpdateQueryError) {
      console.error('[ERROR] institutions tablosu güncelleme sorgusu exception:', institutionUpdateQueryError);
      // Exception olsa da devam et, institution_admin_credentials güncellendi
      console.log('[WARN] institutions tablosu güncellenirken exception oluştu, ancak institution_admin_credentials güncellendi');
    }

    console.log('[DEBUG] Şifre başarıyla güncellendi');
    return new Response(
      JSON.stringify({ 
        data: {
          message: 'Şifre başarıyla değiştirildi'
        },
        error: null 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // Beklenmeyen hataları detaylı log'la
    console.error('Edge Function beklenmeyen hata:', {
      errorMessage: error?.message,
      errorName: error?.name,
      errorStack: error?.stack
    });
    
    return new Response(
      JSON.stringify({ 
        error: 'Beklenmeyen hata', 
        details: error?.message || 'Bilinmeyen hata oluştu',
        errorType: error?.name || 'UnknownError'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

