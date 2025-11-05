// Supabase Edge Function: Kurum Admin - Rehber Öğretmen Atama/Kaldırma
// Bu fonksiyon, kurum adminin kurumundaki rehber öğretmeni atar veya kaldırır

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

    // Request body'den institution_id, teacher_id ve admin_username'i al
    const { institution_id, teacher_id, admin_username } = await req.json();

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

    if (!institution_id) {
      return new Response(
        JSON.stringify({ error: 'institution_id gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kurum bilgilerini al
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

    // teacher_id null ise rehber öğretmen kaldırma işlemi
    // teacher_id varsa ama geçersiz bir değerse hata ver
    if (teacher_id !== null && teacher_id !== undefined && !teacher_id) {
      return new Response(
        JSON.stringify({ error: 'Geçersiz teacher_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Öğretmenin bu kuruma ait olduğunu kontrol et (eğer teacher_id varsa)
    if (teacher_id) {
      const { data: teacherData, error: teacherCheckError } = await supabaseAdmin
        .from('teachers')
        .select('id, institution_id')
        .eq('id', teacher_id)
        .single();

      if (teacherCheckError || !teacherData) {
        return new Response(
          JSON.stringify({ error: 'Öğretmen bulunamadı' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Öğretmenin bu kuruma ait olduğunu kontrol et
      if (teacherData.institution_id !== institution_id) {
        return new Response(
          JSON.stringify({ error: 'Öğretmen bu kuruma ait değil' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Kurumun rehber öğretmen ID'sini güncelle
    const { data: updatedInstitution, error: updateError } = await supabaseAdmin
      .from('institutions')
      .update({ 
        guidance_teacher_id: teacher_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', institution_id)
      .select()
      .single();

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Rehber öğretmen atanırken hata oluştu', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        data: updatedInstitution, 
        error: null,
        message: teacher_id ? 'Rehber öğretmen atandı' : 'Rehber öğretmen kaldırıldı'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Beklenmeyen hata', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

