// Supabase Edge Function: Ana Admin - Kullanıcı Silme (Soft Delete)
// Bu fonksiyon, ana adminin bir kullanıcıyı kurumdan ayırmasını sağlar (soft delete)
// Ana admin herhangi bir kurumdan kullanıcı silebilir

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
    const { user_id, institution_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id gerekli' }),
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

    // Soft delete: Kurumdan ayırma işlemleri
    if (userType === 'teacher') {
      // Öğretmen: teacher satırını çöz ve ilişikleri kes
      const { data: teacherRow } = await supabaseAdmin
        .from('teachers')
        .select('id')
        .eq('user_id', user_id)
        .maybeSingle();

      if (teacherRow?.id) {
        // student_teachers ilişkilerini sil
        await supabaseAdmin
          .from('student_teachers')
          .delete()
          .eq('teacher_id', teacherRow.id);
      }
      
      // teachers tablosundaki institution_id'yi null yap
      await supabaseAdmin
        .from('teachers')
        .update({ institution_id: null })
        .eq('user_id', user_id);
    } else if (userType === 'student') {
      // Öğrenci: ilişikleri kes, kurum ID'yi boşalt
      await supabaseAdmin
        .from('student_teachers')
        .delete()
        .eq('student_id', user_id);
      
      await supabaseAdmin
        .from('students')
        .update({ institution_id: null })
        .eq('user_id', user_id);
    }

    // Kurum üyeliğini kaldır
    if (institution_id) {
      await supabaseAdmin
        .from('institution_memberships')
        .delete()
        .match({ user_id: user_id, institution_id: institution_id });
    } else {
      // Tüm kurum üyeliklerini kaldır
      await supabaseAdmin
        .from('institution_memberships')
        .delete()
        .eq('user_id', user_id);
    }

    return new Response(
      JSON.stringify({ 
        data: {
          message: 'Kullanıcı başarıyla kurumdan kaldırıldı'
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


