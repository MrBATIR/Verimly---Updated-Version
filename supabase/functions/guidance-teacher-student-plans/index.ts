// Supabase Edge Function: Rehber Öğretmen Öğrenci Planları
// Bu fonksiyon, rehber öğretmenin kurumundaki bir öğrencinin planlarını getirir

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

    // Request'ten gelen authorization token'ı al
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header bulunamadı' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Token'ı doğrula ve kullanıcı bilgilerini al
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Geçersiz token', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Request body'den student_id ve institution_id'yi al
    const { student_id, institution_id } = await req.json();

    if (!student_id) {
      return new Response(
        JSON.stringify({ error: 'student_id gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!institution_id) {
      return new Response(
        JSON.stringify({ error: 'institution_id gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kullanıcının öğretmen olduğunu kontrol et
    const { data: teacherData, error: teacherError } = await supabaseAdmin
      .from('teachers')
      .select('id, institution_id')
      .eq('user_id', user.id)
      .single();

    if (teacherError || !teacherData) {
      return new Response(
        JSON.stringify({ error: 'Öğretmen bulunamadı', details: teacherError?.message }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rehber öğretmen kontrolü - institutions tablosunda guidance_teacher_id ile kontrol et
    const { data: institutionCheck, error: institutionCheckError } = await supabaseAdmin
      .from('institutions')
      .select('id')
      .eq('id', institution_id)
      .eq('guidance_teacher_id', teacherData.id)
      .eq('is_active', true)
      .single();

    if (institutionCheckError || !institutionCheck) {
      return new Response(
        JSON.stringify({ error: 'Bu kuruma erişim yetkiniz yok veya rehber öğretmen değilsiniz', details: institutionCheckError?.message }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Öğrencinin user_id'sini bul (student_id students tablosundaki id ise)
    // student_id hem students.id hem de students.user_id olabilir, kontrol edelim
    const { data: studentData, error: studentDataError } = await supabaseAdmin
      .from('students')
      .select('id, user_id')
      .or(`id.eq.${student_id},user_id.eq.${student_id}`)
      .eq('institution_id', institution_id)
      .maybeSingle();

    if (studentDataError) {
      return new Response(
        JSON.stringify({ error: 'Öğrenci bilgisi alınamadı', details: studentDataError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!studentData) {
      return new Response(
        JSON.stringify({ error: 'Öğrenci bulunamadı veya bu kuruma ait değil' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // student_daily_plans ve student_weekly_plans tablolarında student_id aslında user_id
    const studentUserId = studentData.user_id;

    // Günlük planları al
    const { data: dailyPlans, error: dailyError } = await supabaseAdmin
      .from('student_daily_plans')
      .select('*')
      .eq('student_id', studentUserId)
      .order('plan_date', { ascending: false });

    if (dailyError) {
      return new Response(
        JSON.stringify({ error: 'Günlük planlar alınamadı', details: dailyError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Haftalık planları al
    const { data: weeklyPlans, error: weeklyError } = await supabaseAdmin
      .from('student_weekly_plans')
      .select('*')
      .eq('student_id', studentUserId)
      .order('week_start_date', { ascending: false });

    if (weeklyError) {
      return new Response(
        JSON.stringify({ error: 'Haftalık planlar alınamadı', details: weeklyError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Planları zenginleştir - Hangi planların rehber öğretmen tarafından oluşturulduğunu işaretle
    const enrichedDailyPlans = (dailyPlans || []).map((plan: any) => {
      // Plan sadece bu rehber öğretmen tarafından oluşturulduysa isGuidanceTeacher: true
      const isCreatedByThisTeacher = plan.teacher_id === teacherData.id;
      return {
        ...plan,
        isGuidanceTeacher: isCreatedByThisTeacher, // Sadece bu rehber öğretmenin eklediği planlar
        isCreatedByMe: isCreatedByThisTeacher // Bu plan bu öğretmen tarafından oluşturuldu mu?
      };
    });

    const enrichedWeeklyPlans = (weeklyPlans || []).map((plan: any) => {
      // Plan sadece bu rehber öğretmen tarafından oluşturulduysa isGuidanceTeacher: true
      const isCreatedByThisTeacher = plan.teacher_id === teacherData.id;
      return {
        ...plan,
        isGuidanceTeacher: isCreatedByThisTeacher, // Sadece bu rehber öğretmenin eklediği planlar
        isCreatedByMe: isCreatedByThisTeacher // Bu plan bu öğretmen tarafından oluşturuldu mu?
      };
    });

    return new Response(
      JSON.stringify({ 
        data: {
          daily: enrichedDailyPlans,
          weekly: enrichedWeeklyPlans
        }, 
        error: null 
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

