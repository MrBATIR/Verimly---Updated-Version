// Supabase Edge Function: Ana Admin - Sözleşme Güncelleme
// Bu fonksiyon, ana adminin bir kurumun sözleşme bilgilerini güncellemesini sağlar
// Sözleşme tarihlerine göre kurum durumunu otomatik olarak ayarlar

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
    const { 
      institution_id,
      contract_start_date,
      contract_end_date,
      payment_status,
      notes
    } = await req.json();

    if (!institution_id) {
      return new Response(
        JSON.stringify({ error: 'institution_id gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Güncelleme verilerini hazırla
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (contract_start_date !== undefined) {
      updateData.contract_start_date = contract_start_date || null;
    }
    if (contract_end_date !== undefined) {
      updateData.contract_end_date = contract_end_date || null;
    }
    if (payment_status !== undefined) {
      updateData.payment_status = payment_status;
    }
    if (notes !== undefined) {
      updateData.notes = notes || null;
    }

    // Sözleşme tarihlerine göre kurum durumunu belirle
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDate = updateData.contract_start_date 
      ? new Date(updateData.contract_start_date)
      : null;
    if (startDate) {
      startDate.setHours(0, 0, 0, 0);
    }
    
    const endDate = updateData.contract_end_date 
      ? new Date(updateData.contract_end_date)
      : null;
    if (endDate) {
      endDate.setHours(0, 0, 0, 0);
    }

    // Kurumun mevcut durumunu al
    const { data: currentInstitution } = await supabaseAdmin
      .from('institutions')
      .select('is_active, contract_start_date, contract_end_date')
      .eq('id', institution_id)
      .single();

    // Tarih kontrolleri ve kurum durumu belirleme
    let shouldBeActive = false;
    let message = 'Sözleşme bilgileri güncellendi';

    if (startDate && endDate) {
      // Başlangıç tarihi gelecekte -> pasif
      if (startDate > today) {
        shouldBeActive = false;
        message = 'Sözleşme başlangıç tarihi gelecekte. Kurum sözleşme başlangıcına kadar pasif kalacak.';
      }
      // Başlangıç <= bugün <= bitiş -> aktif
      else if (startDate <= today && endDate >= today) {
        shouldBeActive = true;
        message = 'Sözleşme geçerli. Kurum aktif edildi.';
      }
      // Bitiş < bugün -> pasif
      else if (endDate < today) {
        shouldBeActive = false;
        updateData.is_premium = false;
        message = 'Sözleşme bitiş tarihi geçmiş. Kurum pasif edildi.';
      }
    } else if (endDate) {
      // Sadece bitiş tarihi var
      if (endDate < today) {
        shouldBeActive = false;
        updateData.is_premium = false;
        message = 'Sözleşme bitiş tarihi geçmiş. Kurum pasif edildi.';
      } else {
        // Bitiş tarihi gelecekte, mevcut durumu koru (veya aktif et)
        shouldBeActive = currentInstitution?.is_active || true;
      }
    } else if (startDate) {
      // Sadece başlangıç tarihi var
      if (startDate > today) {
        shouldBeActive = false;
        message = 'Sözleşme başlangıç tarihi gelecekte. Kurum sözleşme başlangıcına kadar pasif kalacak.';
      } else {
        shouldBeActive = true;
        message = 'Sözleşme başlangıç tarihi geçmiş/bugün. Kurum aktif edildi.';
      }
    }

    // Kurum durumunu güncelle
    updateData.is_active = shouldBeActive;

    // Kurum bilgilerini güncelle
    const { data: institutionData, error: updateError } = await supabaseAdmin
      .from('institutions')
      .update(updateData)
      .eq('id', institution_id)
      .select()
      .single();

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Sözleşme güncellenemedi', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kurum üyelerinin erişimini güncelle
    await supabaseAdmin
      .from('institution_memberships')
      .update({
        is_active: shouldBeActive,
        updated_at: new Date().toISOString()
      })
      .eq('institution_id', institution_id);

    return new Response(
      JSON.stringify({ 
        data: {
          institution: institutionData,
          message
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


