// Supabase Edge Function: Kurum Admin - Rehber Öğretmen Bilgisi
// Bu fonksiyon, kurum adminin kurumundaki rehber öğretmen bilgisini getirir

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
    const { institution_id, admin_username } = await req.json();

    if (!institution_id) {
      return new Response(
        JSON.stringify({ error: 'institution_id gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kurum bilgisini kontrol et
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

    // Doğrulama: Token varsa kullan, yoksa admin_username ile kontrol et
    let isAdmin = false;
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader) {
      // Token ile doğrulama (normal kullanıcı)
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (!userError && user) {
          // Kullanıcının e-postasını al
          const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('email')
            .eq('user_id', user.id)
            .single();

          if (!profileError && userProfile) {
            // Kurum admin kontrolü - contact_email ile eşleşiyorsa veya institution_admin_credentials'de kayıt varsa
            const { data: adminCredentials } = await supabaseAdmin
              .from('institution_admin_credentials')
              .select('institution_id')
              .eq('institution_id', institution_id)
              .eq('is_active', true)
              .maybeSingle();

            isAdmin = adminCredentials || (userProfile.email === institutionData.contact_email);
          }
        }
      } catch (error) {
        // Token doğrulama hatası, admin_username ile devam et
        console.log('Token doğrulama hatası, admin_username ile devam ediliyor');
      }
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

    // Kurumun rehber öğretmen ID'sini al
    const { data: institutionWithGuidance, error: guidanceError } = await supabaseAdmin
      .from('institutions')
      .select('guidance_teacher_id')
      .eq('id', institution_id)
      .single();

    if (guidanceError || !institutionWithGuidance || !institutionWithGuidance.guidance_teacher_id) {
      return new Response(
        JSON.stringify({ data: null, error: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const guidanceTeacherId = institutionWithGuidance.guidance_teacher_id;

    // Öğretmen bilgisini al
    const { data: teacherData, error: teacherError } = await supabaseAdmin
      .from('teachers')
      .select('id, user_id, name, email')
      .eq('id', guidanceTeacherId)
      .maybeSingle();

    if (teacherError) {
      return new Response(
        JSON.stringify({ error: 'Öğretmen bilgisi alınamadı', details: teacherError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!teacherData) {
      return new Response(
        JSON.stringify({ data: null, error: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // user_profiles'den isim ve email bilgisini al (eğer teachers'da yoksa)
    let teacherName = teacherData.name;
    let teacherEmail = teacherData.email;

    if (!teacherName || !teacherEmail) {
      const { data: userProfileData, error: profileDataError } = await supabaseAdmin
        .from('user_profiles')
        .select('name, email')
        .eq('user_id', teacherData.user_id)
        .maybeSingle();

      if (!profileDataError && userProfileData) {
        teacherName = teacherName || userProfileData.name || 'Bilinmeyen Öğretmen';
        teacherEmail = teacherEmail || userProfileData.email || '';
      }
    }

    const guidanceTeacherData = {
      id: teacherData.id,
      user_id: teacherData.user_id,
      name: teacherName || 'Bilinmeyen Öğretmen',
      email: teacherEmail || '',
    };

    return new Response(
      JSON.stringify({ data: guidanceTeacherData, error: null }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Beklenmeyen hata', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

