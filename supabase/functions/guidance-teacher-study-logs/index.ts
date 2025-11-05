// Supabase Edge Function: Rehber Öğretmen Çalışma Kayıtları
// Bu fonksiyon, rehber öğretmenin kurumundaki tüm öğrencilerin çalışma kayıtlarını getirir

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

    // Request body'den institution_id ve opsiyonel parametreleri al
    const { institution_id, student_ids, start_date, end_date } = await req.json();

    if (!institution_id) {
      return new Response(
        JSON.stringify({ error: 'institution_id gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kullanıcının rehber öğretmen olup olmadığını ve ilgili kuruma erişimi olup olmadığını kontrol et
    const { data: teacherData, error: teacherError } = await supabaseAdmin
      .from('teachers')
      .select('id, institution_id')
      .eq('user_id', user.id)
      .single();

    if (teacherError || !teacherData) {
      return new Response(
        JSON.stringify({ error: 'Öğretmen bilgisi bulunamadı veya yetkisiz erişim' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: institutionCheck, error: institutionCheckError } = await supabaseAdmin
      .from('institutions')
      .select('id')
      .eq('id', institution_id)
      .eq('guidance_teacher_id', teacherData.id)
      .eq('is_active', true)
      .single();

    if (institutionCheckError || !institutionCheck) {
      return new Response(
        JSON.stringify({ error: 'Bu kuruma erişim yetkiniz yok veya rehber öğretmen değilsiniz' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kurumdaki öğrenci ID'lerini al (eğer student_ids belirtilmemişse)
    let studentUserIds: string[] = [];
    
    if (student_ids && Array.isArray(student_ids) && student_ids.length > 0) {
      // Belirtilen öğrenci ID'lerini kullan
      // student_ids students tablosundaki id'ler, user_id'leri bulmamız gerekiyor
      const { data: studentData, error: studentDataError } = await supabaseAdmin
        .from('students')
        .select('user_id')
        .in('id', student_ids)
        .eq('institution_id', institution_id);
      
      if (studentDataError) {
        return new Response(
          JSON.stringify({ error: 'Öğrenci bilgileri alınamadı', details: studentDataError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      studentUserIds = studentData.map((s: any) => s.user_id).filter(Boolean);
    } else {
      // Kurumdaki tüm öğrencilerin user_id'lerini al
      const { data: institutionMembers, error: membersError } = await supabaseAdmin
        .from('institution_memberships')
        .select('user_id')
        .eq('institution_id', institution_id)
        .eq('role', 'student')
        .eq('is_active', true);
      
      if (membersError) {
        return new Response(
          JSON.stringify({ error: 'Kurum üyelikleri alınamadı', details: membersError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      studentUserIds = institutionMembers.map((m: any) => m.user_id).filter(Boolean);
    }

    if (studentUserIds.length === 0) {
      return new Response(
        JSON.stringify({ data: [], error: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Öğrencilerin çalışma kayıtlarını getir
    let query = supabaseAdmin
      .from('study_logs')
      .select(`
        id,
        user_id,
        duration, 
        focus_level, 
        subject, 
        study_date,
        study_type,
        topic,
        correct_answers,
        wrong_answers,
        empty_answers,
        notes,
        created_at
      `)
      .in('user_id', studentUserIds);
    
    // Tarih aralığı filtresi ekle (varsa)
    if (start_date) {
      query = query.gte('study_date', start_date);
    }
    if (end_date) {
      query = query.lte('study_date', end_date);
    }
    
    const { data: studyLogs, error: studyLogsError } = await query
      .order('study_date', { ascending: false })
      .limit(1000); // Yeterince büyük limit

    if (studyLogsError) {
      return new Response(
        JSON.stringify({ error: 'Çalışma kayıtları alınamadı', details: studyLogsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ data: studyLogs || [], error: null }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Beklenmeyen hata', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

