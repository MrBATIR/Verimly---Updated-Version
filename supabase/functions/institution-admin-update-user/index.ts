// Supabase Edge Function: Kurum Admin - Kullanıcı Güncelleme
// Bu fonksiyon, kurum adminin kurumundaki bir kullanıcının bilgilerini güncellemesini sağlar

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

    // Request body'den verileri al
    const { 
      institution_id, 
      user_id,
      user_type, // 'teacher' veya 'student'
      name,
      email,
      branch, // Öğretmen için
      grade, // Öğrenci için
      phone,
      admin_username = null // Admin username (token yoksa kullanılır)
    } = await req.json();

    // Request'ten gelen authorization token'ı al (opsiyonel - admin_username varsa token gerekmez)
    const authHeader = req.headers.get('Authorization');
    let user = null;
    let userProfile = null;

    // Token ile doğrulama (varsa)
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user: authUser }, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (!userError && authUser) {
          user = authUser;
          // Kullanıcı profili al
          const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('email')
            .eq('user_id', user.id)
            .single();
          userProfile = profile;
        }
      } catch (error) {
        console.log('Token doğrulama hatası, admin_username ile devam ediliyor');
      }
    }

    if (!institution_id || !user_id || !name || !email) {
      return new Response(
        JSON.stringify({ error: 'institution_id, user_id, name ve email gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kurum admin kontrolü
    const { data: institutionData, error: institutionError } = await supabaseAdmin
      .from('institutions')
      .select('id, contact_email')
      .eq('id', institution_id)
      .eq('is_active', true)
      .single();

    if (institutionError || !institutionData) {
      return new Response(
        JSON.stringify({ error: 'Kurum bulunamadı veya erişim yetkiniz yok' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let isAdmin = false;

    // Token ile doğrulama (varsa)
    if (user && userProfile) {
      // institution_admin_credentials tablosundan kontrol et
      const { data: adminCredentials } = await supabaseAdmin
        .from('institution_admin_credentials')
        .select('institution_id')
        .eq('institution_id', institution_id)
        .eq('is_active', true)
        .maybeSingle();

      // Alternatif: E-posta ile kurum kontrolü
      isAdmin = adminCredentials || (userProfile.email === institutionData.contact_email);
    }

    // Token yoksa veya token doğrulaması başarısızsa, admin_username ile kontrol et
    if (!isAdmin && admin_username) {
      const { data: adminCredentials } = await supabaseAdmin
        .from('institution_admin_credentials')
        .select('institution_id, admin_username')
        .eq('institution_id', institution_id)
        .eq('admin_username', admin_username)
        .eq('is_active', true)
        .maybeSingle();

      isAdmin = !!adminCredentials;
    }

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Bu kuruma erişim yetkiniz yok' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kullanıcının kurumda olup olmadığını kontrol et
    const { data: membership } = await supabaseAdmin
      .from('institution_memberships')
      .select('id, role')
      .eq('user_id', user_id)
      .eq('institution_id', institution_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'Kullanıcı bu kurumda bulunamadı' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // user_profiles tablosunu güncelle
    const { error: profileUpdateError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        name: name,
        email: email.toLowerCase().trim()
      })
      .eq('user_id', user_id);

    if (profileUpdateError) {
      return new Response(
        JSON.stringify({ error: 'User profile güncellenemedi', details: profileUpdateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Öğretmen veya öğrenci tablosunu güncelle
    if (user_type === 'teacher') {
      const { error: teacherError } = await supabaseAdmin
        .from('teachers')
        .update({
          name: name,
          email: email.toLowerCase().trim(),
          branch: branch || null,
          phone: phone || null
        })
        .eq('user_id', user_id);

      if (teacherError) {
        return new Response(
          JSON.stringify({ error: 'Öğretmen bilgileri güncellenemedi', details: teacherError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Öğrenci
      const { error: studentError } = await supabaseAdmin
        .from('students')
        .update({
          name: name,
          email: email.toLowerCase().trim(),
          grade: grade || null,
          phone: phone || null
        })
        .eq('user_id', user_id);

      if (studentError) {
        return new Response(
          JSON.stringify({ error: 'Öğrenci bilgileri güncellenemedi', details: studentError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        data: {
          message: 'Kullanıcı bilgileri başarıyla güncellendi'
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


