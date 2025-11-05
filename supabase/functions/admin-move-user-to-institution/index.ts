// Supabase Edge Function: Ana Admin - Kullanıcıyı Kuruma Taşıma
// Bu fonksiyon, bir kullanıcıyı bir kurumdan başka bir kuruma taşır

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

    // Request'ten gelen authorization token'ı al (opsiyonel)
    const authHeader = req.headers.get('Authorization');
    let user = null;

    // Token ile doğrulama (varsa)
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (!authError && authUser) {
        user = authUser;
        
        // Admin kontrolü
        const { data: profile } = await supabaseAdmin
          .from('user_profiles')
          .select('user_type')
          .eq('user_id', user.id)
          .single();
        
        if (!profile || profile.user_type !== 'admin') {
          return new Response(
            JSON.stringify({ error: 'Admin yetkisi gerekli' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Request body'den verileri al
    const { user_id, target_institution_id } = await req.json();

    if (!user_id || !target_institution_id) {
      return new Response(
        JSON.stringify({ error: 'user_id ve target_institution_id gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kullanıcının user_type'ını al
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_type')
      .eq('user_id', user_id)
      .single();

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: 'Kullanıcı profili bulunamadı', details: profileError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userType = userProfile.user_type; // 'teacher' veya 'student'

    // 1. Eski kurumdaki tüm institution_memberships kayıtlarını sil
    const { error: deleteError } = await supabaseAdmin
      .from('institution_memberships')
      .delete()
      .eq('user_id', user_id);

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: 'Eski kurum üyeliği silinemedi', details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Yeni kuruma institution_memberships ekle
    const { error: insertError } = await supabaseAdmin
      .from('institution_memberships')
      .insert({
        institution_id: target_institution_id,
        user_id: user_id,
        role: userType,
        is_active: true
      });

    if (insertError) {
      return new Response(
        JSON.stringify({ error: 'Yeni kuruma üyelik eklenemedi', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. teachers veya students tablosundaki institution_id'yi güncelle
    if (userType === 'teacher') {
      const { error: teacherUpdateError } = await supabaseAdmin
        .from('teachers')
        .update({ institution_id: target_institution_id })
        .eq('user_id', user_id);

      if (teacherUpdateError) {
        console.error('Öğretmen güncelleme hatası:', teacherUpdateError);
        // Hata olsa da devam et, üyelik zaten güncellendi
      }
    } else if (userType === 'student') {
      const { error: studentUpdateError } = await supabaseAdmin
        .from('students')
        .update({ institution_id: target_institution_id })
        .eq('user_id', user_id);

      if (studentUpdateError) {
        console.error('Öğrenci güncelleme hatası:', studentUpdateError);
        // Hata olsa da devam et, üyelik zaten güncellendi
      }
    }

    // Hedef kurumun adını al (başarı mesajı için)
    const { data: targetInstitution } = await supabaseAdmin
      .from('institutions')
      .select('name')
      .eq('id', target_institution_id)
      .single();

    return new Response(
      JSON.stringify({ 
        data: {
          message: 'Kullanıcı başarıyla taşındı',
          target_institution_name: targetInstitution?.name || 'Bilinmeyen Kurum'
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


