// Supabase Edge Function: Ana Admin - İstatistikler
// Bu fonksiyon, ana admin için genel ve kurum bazlı istatistikleri döndürür

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

    // 1. Genel İstatistikler
    // Kurum istatistikleri
    const { data: institutions, error: institutionsError } = await supabaseAdmin
      .from('institutions')
      .select('id, name, is_active, is_premium');

    if (institutionsError) {
      return new Response(
        JSON.stringify({ error: 'Kurum istatistikleri alınamadı', details: institutionsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const totalInstitutions = institutions?.length || 0;
    const activeInstitutions = institutions?.filter(inst => inst.is_active)?.length || 0;

    // Toplam öğretmen sayısı
    const { count: teachersCount, error: teachersError } = await supabaseAdmin
      .from('teachers')
      .select('*', { count: 'exact', head: true });

    if (teachersError) {
      return new Response(
        JSON.stringify({ error: 'Öğretmen sayısı alınamadı', details: teachersError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Toplam öğrenci sayısı
    const { count: studentsCount, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true });

    if (studentsError) {
      return new Response(
        JSON.stringify({ error: 'Öğrenci sayısı alınamadı', details: studentsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Bireysel kullanıcı sayısı - "Bireysel Kullanıcılar" kurumuna ait kullanıcılar
    const { data: individualInstitution, error: individualInstError } = await supabaseAdmin
      .from('institutions')
      .select('id')
      .eq('name', 'Bireysel Kullanıcılar')
      .maybeSingle();

    let individualUsers = 0;
    if (!individualInstError && individualInstitution) {
      const { count: individualUsersCount, error: individualUsersError } = await supabaseAdmin
        .from('institution_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', individualInstitution.id)
        .eq('is_active', true);
      
      if (!individualUsersError) {
        individualUsers = individualUsersCount || 0;
      }
    }

    // Toplam bağlantı sayısı
    const { count: connectionsCount, error: connectionsError } = await supabaseAdmin
      .from('student_teachers')
      .select('*', { count: 'exact', head: true })
      .eq('approval_status', 'approved')
      .eq('is_active', true);

    if (connectionsError) {
      return new Response(
        JSON.stringify({ error: 'Bağlantı sayısı alınamadı', details: connectionsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Kurum Bazlı Detaylı İstatistikler
    const { data: allInstitutions, error: allInstitutionsError } = await supabaseAdmin
      .from('institutions')
      .select('id, name, is_active, is_premium, contract_start_date, contract_end_date, payment_status');

    let institutionStats = [];
    if (!allInstitutionsError && allInstitutions && allInstitutions.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      institutionStats = await Promise.all(
        allInstitutions.map(async (inst) => {
          // Kurumun tüm üyelerini al
          const { data: memberships } = await supabaseAdmin
            .from('institution_memberships')
            .select('user_id, role')
            .eq('institution_id', inst.id)
            .eq('is_active', true);

          // Premium durumunu sözleşme durumuna göre belirle
          let isPremium = false;
          if (inst.contract_start_date && inst.contract_end_date && inst.payment_status === 'paid') {
            const contractStart = new Date(inst.contract_start_date);
            const contractEnd = new Date(inst.contract_end_date);
            contractStart.setHours(0, 0, 0, 0);
            contractEnd.setHours(23, 59, 59, 999);

            if (today >= contractStart && today <= contractEnd) {
              isPremium = true;
            }
          }

          if (!memberships || memberships.length === 0) {
            return {
              id: inst.id,
              name: inst.name,
              is_active: inst.is_active,
              is_premium: isPremium,
              teacher_count: 0,
              student_count: 0,
            };
          }

          // User ID'lerden user_type'ları al
          const userIds = memberships.map(m => m.user_id).filter(Boolean);
          const { data: userProfiles } = await supabaseAdmin
            .from('user_profiles')
            .select('user_id, user_type')
            .in('user_id', userIds);

          // Sayıları hesapla
          const teacher_count = userProfiles?.filter(p => p.user_type === 'teacher').length || 0;
          const student_count = userProfiles?.filter(p => p.user_type === 'student').length || 0;

          return {
            id: inst.id,
            name: inst.name,
            is_active: inst.is_active,
            is_premium: isPremium,
            teacher_count,
            student_count,
          };
        })
      );
    }

    return new Response(
      JSON.stringify({ 
        data: {
          general: {
            totalInstitutions,
            activeInstitutions,
            totalTeachers: teachersCount || 0,
            totalStudents: studentsCount || 0,
            individualUsers,
            totalConnections: connectionsCount || 0,
          },
          institutionStats,
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


