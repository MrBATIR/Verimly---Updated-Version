// Supabase Edge Function: Ana Admin - Şifre Sıfırlama
// Bu fonksiyon, ana adminin herhangi bir kullanıcının şifresini sıfırlamasını sağlar

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
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('user_type')
      .eq('user_id', authUser.id)
      .single();
    
    if (!profile || profile.user_type !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin yetkisi gerekli' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Request body'den user_id'yi al
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kullanıcının email'ini al
    let userEmail = null;
    try {
      const { data: userProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('email')
        .eq('user_id', user_id)
        .maybeSingle();
      
      userEmail = userProfile?.email || null;
      
      if (!userEmail) {
        const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(user_id);
        userEmail = authUserData?.user?.email || 'Bilinmiyor';
      }
    } catch (error) {
      console.error('Email alınamadı:', error);
      userEmail = 'Bilinmiyor';
    }

    // Şifreyi sıfırla (user123)
    const newPassword = 'user123';
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: newPassword
    });

    if (updateError) {
      // Fallback: RPC fonksiyonu ile şifre sıfırlama (eğer varsa)
      try {
        const { data, error: rpcError } = await supabaseAdmin.rpc('reset_user_password_admin', {
          target_user_id: user_id,
          new_password: newPassword
        });

        if (rpcError) {
          return new Response(
            JSON.stringify({ error: 'Şifre sıfırlanamadı', details: rpcError.message || updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (rpcError) {
        return new Response(
          JSON.stringify({ error: 'Şifre sıfırlanamadı', details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        data: {
          message: 'Şifre başarıyla sıfırlandı',
          email: userEmail,
          new_password: newPassword
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


