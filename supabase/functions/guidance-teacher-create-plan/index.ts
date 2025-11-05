// Supabase Edge Function: Rehber Öğretmen Plan Oluşturma
// Bu fonksiyon, rehber öğretmenin öğrenci için plan oluşturmasını sağlar

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

    // Request body'den plan bilgilerini al
    const { student_id, institution_id, title, description, plan_date, plan_type } = await req.json();

    if (!student_id || !institution_id || !title || !plan_date || !plan_type) {
      return new Response(
        JSON.stringify({ error: 'Eksik parametreler: student_id, institution_id, title, plan_date ve plan_type gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kullanıcının öğretmen olduğunu kontrol et
    const { data: teacherData, error: teacherError } = await supabaseAdmin
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (teacherError || !teacherData) {
      return new Response(
        JSON.stringify({ error: 'Öğretmen bulunamadı', details: teacherError?.message }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rehber öğretmen kontrolü
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

    // Öğrencinin user_id'sini bul
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

    // Plan oluştur
    let data, error;
    
    if (plan_type === 'daily') {
      const result = await supabaseAdmin
        .from('student_daily_plans')
        .insert({
          student_id: studentUserId,
          teacher_id: teacherData.id,
          title: title,
          description: description || null,
          plan_date: plan_date instanceof Date ? plan_date.toISOString().split('T')[0] : plan_date,
          is_completed: false
        })
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Haftalık plan için haftanın başlangıç tarihini hesapla
      const planDateObj = plan_date instanceof Date ? plan_date : new Date(plan_date);
      const weekStart = new Date(planDateObj);
      const day = weekStart.getDay();
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // Pazartesi
      weekStart.setDate(diff);
      
      const result = await supabaseAdmin
        .from('student_weekly_plans')
        .insert({
          student_id: studentUserId,
          teacher_id: teacherData.id,
          title: title,
          description: description || null,
          week_start_date: weekStart.toISOString().split('T')[0],
          is_completed: false
        })
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Plan oluşturulamadı', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ data, error: null, message: 'Plan başarıyla oluşturuldu.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Beklenmeyen hata', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

