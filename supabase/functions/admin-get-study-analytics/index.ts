// Supabase Edge Function: Ana Admin - Çalışma Analitikleri
// Bu fonksiyon, çalışma loglarını ve öğrenci verilerini döndürür

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
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_type')
      .eq('user_id', authUser.id)
      .single();

    if (profileError || !profile || profile.user_type !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin yetkisi gerekli' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Request body'den parametreleri al
    const { institution_id, time_range } = await req.json();

    // Tarih aralığını hesapla
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let startDate = new Date();

    switch (time_range) {
      case 'today':
        startDate = new Date(now);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'all':
        startDate = new Date(0);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    // Kullanıcı ID'lerini al (seçili kuruma göre)
    let userIds = [];

    if (institution_id) {
      // Seçili kurumun üyelerini al
      const { data: memberships, error: membershipError } = await supabaseAdmin
        .from('institution_memberships')
        .select('user_id, is_active')
        .eq('institution_id', institution_id);

      if (membershipError) {
        throw membershipError;
      }

      // Sadece öğrencileri al
      if (memberships && memberships.length > 0) {
        const membershipUserIds = memberships.map(m => m.user_id).filter(Boolean);

        if (membershipUserIds.length > 0) {
          const { data: userProfiles, error: profilesError } = await supabaseAdmin
            .from('user_profiles')
            .select('user_id, user_type')
            .in('user_id', membershipUserIds);

          if (profilesError) {
            throw profilesError;
          }

          // Öğrencileri filtrele
          const students = (userProfiles || []).filter(p => p.user_type === 'student');
          userIds = students.map(p => p.user_id).filter(Boolean);
        }
      }
    } else {
      // Tüm öğrencileri al
      const { data: allStudents, error: studentsError } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id')
        .eq('user_type', 'student');

      if (studentsError) {
        throw studentsError;
      }

      userIds = allStudents?.map(p => p.user_id).filter(Boolean) || [];
    }

    // Study logs'ları al
    let query = supabaseAdmin
      .from('study_logs')
      .select('*')
      .in('user_id', userIds.length > 0 ? userIds : ['']); // Empty array için placeholder

    if (time_range !== 'all') {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = now.toISOString().split('T')[0];
      query = query
        .gte('study_date', startDateStr)
        .lte('study_date', endDateStr);
    }

    const { data: studyLogs, error: logsError } = await query.order('study_date', { ascending: false });

    if (logsError) {
      throw logsError;
    }

    // Kurum karşılaştırması için tüm kurumları al (sadece tüm kurumlar seçiliyse)
    let institutions = [];
    if (!institution_id) {
      const { data: allInstitutions, error: instError } = await supabaseAdmin
        .from('institutions')
        .select('id, name')
        .neq('name', 'Bireysel Kullanıcılar');

      if (instError) {
        console.warn('Kurumlar alınamadı:', instError);
      } else {
        institutions = allInstitutions || [];
      }
    }

    return new Response(
      JSON.stringify({ 
        data: {
          study_logs: studyLogs || [],
          user_ids: userIds,
          institutions: institutions,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge Function hatası:', error);
    return new Response(
      JSON.stringify({ error: `Beklenmeyen hata: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


