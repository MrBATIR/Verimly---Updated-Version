// Supabase Edge Function: Ana Admin - Bireysel Kullanıcılar
// Bu fonksiyon, "Bireysel Kullanıcılar" kurumuna ait kullanıcıları ve istatistikleri döndürür

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

    // "Bireysel Kullanıcılar" kurumunu bul
    const { data: individualInstitution, error: instError } = await supabaseAdmin
      .from('institutions')
      .select('id')
      .eq('name', 'Bireysel Kullanıcılar')
      .single();

    if (instError || !individualInstitution) {
      return new Response(
        JSON.stringify({ 
          data: {
            users: [],
            stats: {
              total_users: 0,
              total_students: 0,
              total_teachers: 0,
              active_users_today: 0,
              new_users_this_week: 0,
              new_users_this_month: 0,
            }
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Bu kuruma ait aktif üyeleri al
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('institution_memberships')
      .select('user_id, is_active')
      .eq('institution_id', individualInstitution.id)
      .eq('is_active', true);

    if (membershipError || !memberships || memberships.length === 0) {
      return new Response(
        JSON.stringify({ 
          data: {
            users: [],
            stats: {
              total_users: 0,
              total_students: 0,
              total_teachers: 0,
              active_users_today: 0,
              new_users_this_week: 0,
              new_users_this_month: 0,
            }
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // User ID'leri al
    const userIds = memberships.map(m => m.user_id).filter(Boolean);

    // User profiles ve detayları al
    const { data: userProfiles, error: profileFetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, name, email, user_type, created_at')
      .in('user_id', userIds);

    if (profileFetchError) {
      throw profileFetchError;
    }

    // Her kullanıcı için son giriş tarihini al (auth.users'dan)
    const usersWithDetails = await Promise.all(
      (userProfiles || []).map(async (profile) => {
        // Auth'dan last_sign_in_at al
        const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
        
        return {
          user_id: profile.user_id,
          name: profile.name,
          email: profile.email,
          user_type: profile.user_type,
          created_at: profile.created_at,
          last_login: authUserData?.user?.last_sign_in_at || profile.created_at,
        };
      })
    );

    // İstatistikleri hesapla
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const totalStudents = userProfiles?.filter(p => p.user_type === 'student').length || 0;
    const totalTeachers = userProfiles?.filter(p => p.user_type === 'teacher').length || 0;
    
    const activeToday = userProfiles?.filter(p => {
      const created = new Date(p.created_at);
      return created >= today;
    }).length || 0;

    const newThisWeek = userProfiles?.filter(p => {
      const created = new Date(p.created_at);
      return created >= weekAgo;
    }).length || 0;

    const newThisMonth = userProfiles?.filter(p => {
      const created = new Date(p.created_at);
      return created >= monthAgo;
    }).length || 0;

    const stats = {
      total_users: userProfiles?.length || 0,
      total_students: totalStudents,
      total_teachers: totalTeachers,
      active_users_today: activeToday,
      new_users_this_week: newThisWeek,
      new_users_this_month: newThisMonth,
    };

    return new Response(
      JSON.stringify({ 
        data: {
          users: usersWithDetails,
          stats
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


