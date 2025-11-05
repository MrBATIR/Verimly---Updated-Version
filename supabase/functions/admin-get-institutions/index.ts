// Supabase Edge Function: Ana Admin - Kurum Listesi
// Bu fonksiyon, ana admin için kurum listesini döndürür (taşıma modalı için)

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

    // Kurum listesini al
    // AdminInstitutionsScreen için tüm kurum bilgilerini döndür
    const { data: institutions, error: institutionsError } = await supabaseAdmin
      .from('institutions')
      .select('*')
      .order('created_at', { ascending: false });

    if (institutionsError) {
      return new Response(
        JSON.stringify({ error: 'Kurumlar alınamadı', details: institutionsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        data: institutions || [],
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

