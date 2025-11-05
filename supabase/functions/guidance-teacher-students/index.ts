// Supabase Edge Function: Rehber Öğretmen Öğrencileri
// Bu fonksiyon, rehber öğretmenin kurumundaki tüm öğrencileri getirir

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
    // SUPABASE_URL otomatik olarak Supabase tarafından sağlanır
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

    // Request body'den institution_id'yi al
    const { institution_id } = await req.json();

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

    // Kurumdaki tüm öğrenci üyeliklerini getir
    const { data: memberships, error: membershipsError } = await supabaseAdmin
      .from('institution_memberships')
      .select('user_id')
      .eq('institution_id', institution_id)
      .eq('role', 'student')
      .eq('is_active', true);

    if (membershipsError) {
      return new Response(
        JSON.stringify({ error: 'Öğrenci üyelikleri alınamadı', details: membershipsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!memberships || memberships.length === 0) {
      return new Response(
        JSON.stringify({ data: [], error: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // user_id'leri al
    const userIds = memberships.map((m: any) => m.user_id).filter(Boolean);

    // students tablosundan öğrenci bilgilerini getir
    const { data: students, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id, user_id, name, email, grade, phone, parent_name, parent_phone, address, notes, created_at, updated_at')
      .in('user_id', userIds)
      .eq('institution_id', institution_id);

    if (studentsError) {
      return new Response(
        JSON.stringify({ error: 'Öğrenciler alınamadı', details: studentsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Öğrencileri formatla - user_id'yi ekle
    const formattedStudents = (students || []).map((student: any) => ({
      ...student,
      user_id: student.user_id, // students tablosundaki user_id zaten var
    })).filter((student: any) => student.id !== null && student.user_id !== null);

    return new Response(
      JSON.stringify({ data: formattedStudents, error: null }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Beklenmeyen hata', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

