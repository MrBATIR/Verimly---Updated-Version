// Supabase Edge Function: Ana Admin - Kurum Ekleme
// Bu fonksiyon, ana adminin yeni bir kurum eklemesini sağlar

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

  try {
    // Supabase client oluştur (Service Key ile)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 
      Deno.env.get('SUPABASE_PROJECT_URL') ||
      'https://jxxtdljuarnxsmqstzyy.supabase.co';
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');
    
    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Service Role Key secret bulunamadı. Lütfen secrets kontrol edin.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Request'ten gelen authorization token'ı al (gerekli)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header gerekli' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: 'Geçersiz token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin kontrolü
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('user_type')
      .eq('user_id', authUser.id)
      .single();
    
    if (!profile || profile.user_type !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin yetkisi gerekli' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Request body'den verileri al
    const { 
      name,
      type,
      contact_email,
      contact_phone,
      address,
      admin_username,
      admin_password
    } = await req.json();

    if (!name || !contact_email || !admin_username || !admin_password) {
      return new Response(
        JSON.stringify({ error: 'Kurum adı, e-posta, admin kullanıcı adı ve şifre gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kurum oluştur
    const { data: institutionData, error: institutionError } = await supabaseAdmin
      .from('institutions')
      .insert({
        name,
        type: type || 'school',
        contact_email,
        contact_phone: contact_phone || null,
        address: address || null,
        is_active: false, // Başlangıçta pasif
        is_premium: false,
        auto_renewal: false,
        renewal_type: 'manual',
        payment_status: 'pending',
        admin_username,
        admin_password, // Plain text - güvenlik için bcrypt ile hash'lenmeli
      })
      .select()
      .single();

    if (institutionError) {
      return new Response(
        JSON.stringify({ error: 'Kurum oluşturulamadı', details: institutionError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kurum admin giriş bilgilerini institution_admin_credentials tablosuna da kaydet
    let credentialsData = null;
    try {
      const { data: credsData, error: credentialsError } = await supabaseAdmin
        .from('institution_admin_credentials')
        .insert({
          institution_id: institutionData.id,
          admin_username,
          admin_password, // Plain text - güvenlik için bcrypt ile hash'lenmeli
          is_active: true
        })
        .select()
        .single();

      if (credentialsError) {
        console.warn('Admin credentials tablosuna kayıt hatası:', credentialsError);
        // Devam et, kurum oluşturuldu
      } else {
        credentialsData = credsData;
      }
    } catch (credentialsErr) {
      console.error('Admin credentials oluşturma hatası:', credentialsErr);
      // Devam et, kurum oluşturuldu
    }

    return new Response(
      JSON.stringify({ 
        data: {
          institution: institutionData,
          credentials: credentialsData,
          message: 'Kurum başarıyla oluşturuldu'
        },
        error: null 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
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


