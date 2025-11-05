// Supabase Edge Function: Ana Admin - Kurum Güncelleme
// Bu fonksiyon, ana adminin kurum bilgilerini güncellemesini sağlar

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

    // Request body'den verileri al
    const { institution_id, ...updateData } = await req.json();

    if (!institution_id) {
      return new Response(
        JSON.stringify({ error: 'institution_id gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin şifresi ayrı tutulacak (varsa)
    const adminPassword = updateData.admin_password;
    delete updateData.admin_password; // institutions tablosundan çıkar

    // updated_at ekle
    updateData.updated_at = new Date().toISOString();

    // Kurum bilgilerini güncelle
    const { data: institutionData, error: updateError } = await supabaseAdmin
      .from('institutions')
      .update(updateData)
      .eq('id', institution_id)
      .select()
      .single();

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Kurum güncellenemedi: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin şifresi güncellenmişse, institution_admin_credentials tablosunu da güncelle
    if (adminPassword && adminPassword.trim() !== '') {
      // Önce mevcut kaydı kontrol et
      const { data: existingCreds } = await supabaseAdmin
        .from('institution_admin_credentials')
        .select('id')
        .eq('institution_id', institution_id)
        .maybeSingle();

      if (existingCreds) {
        // Mevcut kaydı güncelle
        const { error: credUpdateError } = await supabaseAdmin
          .from('institution_admin_credentials')
          .update({
            admin_password: adminPassword,
            updated_at: new Date().toISOString()
          })
          .eq('institution_id', institution_id);

        if (credUpdateError) {
          console.error('Admin credentials güncelleme hatası:', credUpdateError);
          // Hata olsa da devam et, kurum güncellendi
        }
      } else {
        // Yeni kayıt oluştur (admin_username institutions tablosundan alınabilir)
        const adminUsername = updateData.admin_username || institutionData.admin_username;
        if (adminUsername) {
          const { error: credInsertError } = await supabaseAdmin
            .from('institution_admin_credentials')
            .insert({
              institution_id: institution_id,
              admin_username: adminUsername,
              admin_password: adminPassword,
              is_active: true
            });

          if (credInsertError) {
            console.error('Admin credentials oluşturma hatası:', credInsertError);
            // Hata olsa da devam et, kurum güncellendi
          }
        }
      }

      // institutions tablosundaki admin_password'u da güncelle (backward compatibility için)
      await supabaseAdmin
        .from('institutions')
        .update({ admin_password: adminPassword })
        .eq('id', institution_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Kurum bilgileri güncellendi',
        institution: institutionData
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


