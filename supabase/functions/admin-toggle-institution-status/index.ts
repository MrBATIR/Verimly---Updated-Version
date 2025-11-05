// Supabase Edge Function: Ana Admin - Kurum Durumunu Aktif/Pasif Yapma
// Bu fonksiyon, ana adminin bir kurumun durumunu aktif/pasif yapmasını sağlar

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

    // Request body'den verileri al
    const { institution_id, is_active } = await req.json();

    console.log('[DEBUG] admin-toggle-institution-status:', {
      institution_id,
      is_active,
      is_active_type: typeof is_active
    });

    if (!institution_id || typeof is_active !== 'boolean') {
      console.error('[ERROR] Invalid parameters:', {
        institution_id,
        is_active,
        is_active_type: typeof is_active
      });
      return new Response(
        JSON.stringify({ error: 'institution_id ve is_active (boolean) gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kurumun mevcut durumunu kontrol et
    const { data: currentInstitution, error: fetchError } = await supabaseAdmin
      .from('institutions')
      .select('id, is_active, contract_start_date, contract_end_date')
      .eq('id', institution_id)
      .single();

    if (fetchError || !currentInstitution) {
      console.error('[ERROR] Institution not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Kurum bulunamadı', details: fetchError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[DEBUG] Current institution:', {
      id: currentInstitution.id,
      current_is_active: currentInstitution.is_active,
      new_is_active: is_active,
      contract_start_date: currentInstitution.contract_start_date,
      contract_end_date: currentInstitution.contract_end_date
    });

    // Kurum durumunu güncelle
    // NOT: Bu fonksiyon manuel durum değişikliği için kullanılıyor, 
    // sözleşme tarihlerini göz ardı eder ve direkt olarak durumu değiştirir
    const { data: institutionData, error: updateError } = await supabaseAdmin
      .from('institutions')
      .update({ 
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', institution_id)
      .select()
      .single();

    if (updateError) {
      console.error('[ERROR] Update failed:', updateError);
      return new Response(
        JSON.stringify({ error: 'Kurum durumu güncellenemedi', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[DEBUG] Institution updated:', {
      id: institutionData.id,
      is_active: institutionData.is_active
    });

    // Kurum üyelerinin erişimini de güncelle
    if (institutionData) {
      const { error: membershipError } = await supabaseAdmin
        .from('institution_memberships')
        .update({
          is_active,
          updated_at: new Date().toISOString()
        })
        .eq('institution_id', institution_id);

      if (membershipError) {
        console.error('[ERROR] Membership update failed:', membershipError);
        // Hata olsa da devam et, kurum durumu güncellendi
      } else {
        console.log('[DEBUG] Memberships updated for institution:', institution_id);
      }
    }

    return new Response(
      JSON.stringify({ 
        data: {
          institution: institutionData,
          message: `Kurum ${is_active ? 'aktif' : 'pasif'} edildi`
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

