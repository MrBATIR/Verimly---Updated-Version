// Supabase Edge Function: Ana Admin - Kurum Detayları
// Bu fonksiyon, bir kurumun öğretmen ve öğrenci listesini döndürür

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

    // Request body'den institution_id'yi al
    const { institution_id } = await req.json();

    if (!institution_id) {
      return new Response(
        JSON.stringify({ error: 'institution_id gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Önce institution_memberships tablosundan user_id'leri al
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('institution_memberships')
      .select('user_id')
      .eq('institution_id', institution_id)
      .eq('is_active', true);

    if (membershipError) {
      return new Response(
        JSON.stringify({ error: 'Üyelik bilgileri alınamadı', details: membershipError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!memberships || memberships.length === 0) {
      return new Response(
        JSON.stringify({ 
          data: {
            teachers: [],
            students: []
          },
          error: null 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userIds = memberships.map(m => m.user_id).filter(Boolean);

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          data: {
            teachers: [],
            students: []
          },
          error: null 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Bu kullanıcıların user_profiles bilgilerini al
    const { data: userProfiles, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, name, user_type, email')
      .in('user_id', userIds);

    if (profilesError) {
      return new Response(
        JSON.stringify({ error: 'Kullanıcı profilleri alınamadı', details: profilesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Öğretmenleri ve öğrencileri filtrele
    const teachers = [];
    const students = [];

    for (const profile of userProfiles || []) {
      if (profile.user_type === 'teacher') {
        // Öğretmenin branch bilgisini al
        const { data: teacherData } = await supabaseAdmin
          .from('teachers')
          .select('branch')
          .eq('user_id', profile.user_id)
          .maybeSingle();

        teachers.push({
          id: profile.user_id,
          user_id: profile.user_id,
          name: profile.name,
          email: profile.email,
          branch: teacherData?.branch || null,
        });
      } else if (profile.user_type === 'student') {
        // Öğrencinin grade bilgisini al
        const { data: studentData } = await supabaseAdmin
          .from('students')
          .select('grade')
          .eq('user_id', profile.user_id)
          .maybeSingle();

        students.push({
          id: profile.user_id,
          user_id: profile.user_id,
          name: profile.name,
          email: profile.email,
          grade: studentData?.grade || null,
        });
      }
    }

    // İsimlerine göre sırala
    teachers.sort((a, b) => a.name.localeCompare(b.name));
    students.sort((a, b) => a.name.localeCompare(b.name));

    return new Response(
      JSON.stringify({ 
        data: {
          teachers,
          students
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


