// Supabase Edge Function: Ana Admin - Kullanıcı Arama
// Bu fonksiyon, tüm kullanıcıları kurum bilgileriyle birlikte döndürür

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

    // Tüm kullanıcı profillerini al
    const { data: userProfiles, error: profileFetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, name, email, user_type, created_at, institution_id');

    if (profileFetchError) {
      throw profileFetchError;
    }

    // Her kullanıcı için kurum bilgisini ve son giriş tarihini al
    const usersWithDetails = await Promise.all(
      (userProfiles || []).map(async (profile) => {
        // Kurum bilgisi
        let institutionName = 'Bireysel Kullanıcılar';
        let institutionId = null;

        if (profile.institution_id) {
          const { data: institution } = await supabaseAdmin
            .from('institutions')
            .select('id, name')
            .eq('id', profile.institution_id)
            .single();
          
          if (institution) {
            institutionName = institution.name;
            institutionId = institution.id;
          }
        } else {
          // institution_memberships'den kontrol et
          const { data: membership } = await supabaseAdmin
            .from('institution_memberships')
            .select('institution_id')
            .eq('user_id', profile.user_id)
            .eq('is_active', true)
            .maybeSingle();

          if (membership) {
            const { data: institution } = await supabaseAdmin
              .from('institutions')
              .select('id, name')
              .eq('id', membership.institution_id)
              .single();
            
            if (institution) {
              institutionName = institution.name;
              institutionId = institution.id;
            }
          }
        }

        // Son giriş tarihi
        let lastLogin = profile.created_at;
        try {
          const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
          lastLogin = authUserData?.user?.last_sign_in_at || profile.created_at;
        } catch (error) {
          // Auth hatası olursa created_at kullan
        }

        // Aktif kurum üyeliği kontrolü
        let hasActiveMembership = false;
        if (institutionId) {
          const { data: activeMembership } = await supabaseAdmin
            .from('institution_memberships')
            .select('is_active')
            .eq('user_id', profile.user_id)
            .eq('institution_id', institutionId)
            .eq('is_active', true)
            .maybeSingle();
          
          hasActiveMembership = !!activeMembership;
        } else {
          const { data: anyActiveMembership } = await supabaseAdmin
            .from('institution_memberships')
            .select('is_active')
            .eq('user_id', profile.user_id)
            .eq('is_active', true)
            .maybeSingle();
          
          hasActiveMembership = !!anyActiveMembership;
        }

        // Aktif/pasif durumu: Aktif kurum üyeliği var ve son 30 gün içinde giriş yapmış
        const hasRecentLogin = lastLogin && new Date(lastLogin) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const isActive = hasActiveMembership && hasRecentLogin;

        return {
          user_id: profile.user_id,
          name: profile.name,
          email: profile.email,
          user_type: profile.user_type,
          created_at: profile.created_at,
          last_login: lastLogin,
          institution_id: institutionId,
          institution_name: institutionName,
          is_active: isActive,
        };
      })
    );

    // Alfabetik sıralama
    usersWithDetails.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

    return new Response(
      JSON.stringify({ 
        data: usersWithDetails
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


