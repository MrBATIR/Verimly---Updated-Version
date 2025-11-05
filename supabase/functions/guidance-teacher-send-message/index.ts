// Supabase Edge Function: Rehber Öğretmen Mesaj Gönderme
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

    const { student_id, institution_id, message } = await req.json();
    if (!student_id || !institution_id || !message) {
      return new Response(JSON.stringify({ error: 'student_id, institution_id ve message gerekli' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: teacherData, error: teacherError } = await supabaseAdmin.from('teachers').select('id').eq('user_id', user.id).single();
    if (teacherError || !teacherData) {
      return new Response(JSON.stringify({ error: 'Öğretmen bulunamadı' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: institutionCheck } = await supabaseAdmin.from('institutions').select('id').eq('id', institution_id).eq('guidance_teacher_id', teacherData.id).eq('is_active', true).single();
    if (!institutionCheck) {
      return new Response(JSON.stringify({ error: 'Bu kuruma erişim yetkiniz yok veya rehber öğretmen değilsiniz' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Öğrencinin user_id'sini bul (student_id students.id veya students.user_id olabilir)
    const { data: studentData, error: studentDataError } = await supabaseAdmin.from('students').select('id, user_id').or(`id.eq.${student_id},user_id.eq.${student_id}`).eq('institution_id', institution_id).maybeSingle();
    if (studentDataError || !studentData) {
      return new Response(JSON.stringify({ error: 'Öğrenci bulunamadı veya bu kuruma ait değil' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Mesaj gönder (receiver_id = user_id)
    const { data, error } = await supabaseAdmin.from('messages').insert([{
      sender_id: user.id,
      receiver_id: studentData.user_id,
      content: message,
    }]).select().single();

    if (error) {
      return new Response(JSON.stringify({ error: 'Mesaj gönderilemedi', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ data, error: null, message: 'Mesaj başarıyla gönderildi.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Beklenmeyen hata', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

