// Supabase Edge Function: Rehber Öğretmen Öğrenci Detayı
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_PROJECT_URL') || 'https://jxxtdljuarnxsmqstzyy.supabase.co';
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');
    
    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Service Role Key secret bulunamadı' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header bulunamadı' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Geçersiz token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { student_id, institution_id } = await req.json();
    if (!student_id || !institution_id) {
      return new Response(JSON.stringify({ error: 'student_id ve institution_id gerekli' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: teacherData, error: teacherError } = await supabaseAdmin.from('teachers').select('id').eq('user_id', user.id).single();
    if (teacherError || !teacherData) {
      return new Response(JSON.stringify({ error: 'Öğretmen bulunamadı' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: institutionCheck } = await supabaseAdmin.from('institutions').select('id').eq('id', institution_id).eq('guidance_teacher_id', teacherData.id).eq('is_active', true).single();
    if (!institutionCheck) {
      return new Response(JSON.stringify({ error: 'Bu kuruma erişim yetkiniz yok veya rehber öğretmen değilsiniz' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Öğrenci bilgilerini al (student_id hem students.id hem students.user_id olabilir, email ile de arama yapılabilir)
    let studentData = null;
    
    // Önce ID ile dene
    const { data: studentById, error: studentByIdError } = await supabaseAdmin
      .from('students')
      .select('*')
      .or(`id.eq.${student_id},user_id.eq.${student_id}`)
      .eq('institution_id', institution_id)
      .maybeSingle();
    
    if (!studentByIdError && studentById) {
      studentData = studentById;
    } else {
      // Email ile dene (eğer student_id email ise)
      const { data: studentByEmail, error: studentByEmailError } = await supabaseAdmin
        .from('students')
        .select('*')
        .eq('email', student_id)
        .eq('institution_id', institution_id)
        .maybeSingle();
      
      if (!studentByEmailError && studentByEmail) {
        studentData = studentByEmail;
      }
    }

    if (!studentData) {
      return new Response(JSON.stringify({ error: 'Öğrenci bulunamadı veya bu kuruma ait değil' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ data: studentData, error: null }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Beklenmeyen hata', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

