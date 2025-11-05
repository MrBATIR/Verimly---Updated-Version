// Supabase Edge Function: Kurum Admin - Kullanıcı Silme
// Bu fonksiyon, kurum adminin kurumundan bir kullanıcıyı (öğretmen/öğrenci) silmesini sağlar
// HARD-DELETE: Kullanıcıyı kurumdan ayırır ve auth kullanıcısını tamamen siler

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

    // Request body'den verileri al
    const { 
      institution_id, 
      user_id,
      user_type, // 'teacher' veya 'student'
      admin_username = null // Admin username (token yoksa kullanılır)
    } = await req.json();

    // Request'ten gelen authorization token'ı al (opsiyonel - admin_username varsa token gerekmez)
    const authHeader = req.headers.get('Authorization');
    let user = null;
    let userProfile = null;

    // Token ile doğrulama (varsa)
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user: authUser }, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (!userError && authUser) {
          user = authUser;
          // Kullanıcı profili al
          const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('email')
            .eq('user_id', user.id)
            .single();
          userProfile = profile;
        }
      } catch (error) {
        console.log('Token doğrulama hatası, admin_username ile devam ediliyor');
      }
    }

    if (!institution_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'institution_id ve user_id gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kurum admin kontrolü
    const { data: institutionData, error: institutionError } = await supabaseAdmin
      .from('institutions')
      .select('id, contact_email')
      .eq('id', institution_id)
      .eq('is_active', true)
      .single();

    if (institutionError || !institutionData) {
      return new Response(
        JSON.stringify({ error: 'Kurum bulunamadı veya erişim yetkiniz yok' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let isAdmin = false;

    // Token ile doğrulama (varsa)
    if (user && userProfile) {
      // institution_admin_credentials tablosundan kontrol et
      const { data: adminCredentials } = await supabaseAdmin
        .from('institution_admin_credentials')
        .select('institution_id')
        .eq('institution_id', institution_id)
        .eq('is_active', true)
        .maybeSingle();

      // Alternatif: E-posta ile kurum kontrolü
      isAdmin = adminCredentials || (userProfile.email === institutionData.contact_email);
    }

    // Token yoksa veya token doğrulaması başarısızsa, admin_username ile kontrol et
    if (!isAdmin && admin_username) {
      const { data: adminCredentials } = await supabaseAdmin
        .from('institution_admin_credentials')
        .select('institution_id, admin_username')
        .eq('institution_id', institution_id)
        .eq('admin_username', admin_username)
        .eq('is_active', true)
        .maybeSingle();

      isAdmin = !!adminCredentials;
    }

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Bu kuruma erişim yetkiniz yok' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kullanıcının kurumda olup olmadığını kontrol et
    const { data: membership, error: membershipCheckError } = await supabaseAdmin
      .from('institution_memberships')
      .select('id, role, is_active')
      .eq('user_id', user_id)
      .eq('institution_id', institution_id)
      .maybeSingle();


    if (membershipCheckError) {
      return new Response(
        JSON.stringify({ error: 'Üyelik kontrolü başarısız', details: membershipCheckError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'Kullanıcı bu kurumda bulunamadı' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kullanıcı tipini belirle (user_type parametresinden veya membership.role'den)
    const finalUserType = user_type || membership.role;

    // SOFT-DELETE: Kurumdan ayır ve erişimi engelle
    if (finalUserType === 'teacher') {
      // Öğretmen: teacher satırını çöz ve ilişikleri kes
      const { data: teacherRow } = await supabaseAdmin
        .from('teachers')
        .select('id')
        .eq('user_id', user_id)
        .maybeSingle();

      if (teacherRow?.id) {
        // student_teachers ilişkilerini sil
        const { error: studentTeachersError } = await supabaseAdmin
          .from('student_teachers')
          .delete()
          .eq('teacher_id', teacherRow.id);

        if (studentTeachersError) {
          console.error('student_teachers silme hatası:', studentTeachersError);
        }
      }

      // teachers.institution_id'yi null yap
      const { error: teacherUpdateError } = await supabaseAdmin
        .from('teachers')
        .update({ institution_id: null })
        .eq('user_id', user_id);

      if (teacherUpdateError) {
        return new Response(
          JSON.stringify({ error: 'Öğretmen kaydı güncellenemedi', details: teacherUpdateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Öğrenci: ilişikleri kes, kurum ID'yi boşalt
      // student_teachers ilişkilerini sil (student_id, user_id olarak kullanılıyor olabilir)
      const { error: studentTeachersError } = await supabaseAdmin
        .from('student_teachers')
        .delete()
        .eq('student_id', user_id);

      if (studentTeachersError) {
        console.error('student_teachers silme hatası:', studentTeachersError);
      }

      // students.institution_id'yi null yap
      const { error: studentUpdateError } = await supabaseAdmin
        .from('students')
        .update({ institution_id: null })
        .eq('user_id', user_id);

      if (studentUpdateError) {
        return new Response(
          JSON.stringify({ error: 'Öğrenci kaydı güncellenemedi', details: studentUpdateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Kurum üyeliğini kaldır (sil)
    const { error: membershipDeleteError } = await supabaseAdmin
      .from('institution_memberships')
      .delete()
      .eq('user_id', user_id)
      .eq('institution_id', institution_id);

    if (membershipDeleteError) {
      console.error('Membership silme hatası:', membershipDeleteError);
      // Devam et, auth kullanıcısını silmeye çalış
    }

    // Tüm ilişkili verileri sil
    try {
      // Study logs sil
      await supabaseAdmin
        .from('study_logs')
        .delete()
        .eq('user_id', user_id);

      // Daily plans sil
      await supabaseAdmin
        .from('daily_plans')
        .delete()
        .eq('user_id', user_id);

      // Weekly plans sil
      await supabaseAdmin
        .from('weekly_plans')
        .delete()
        .eq('user_id', user_id);

      // Messages sil (gönderen ve alıcı olarak)
      await supabaseAdmin
        .from('messages')
        .delete()
        .or(`sender_id.eq.${user_id},receiver_id.eq.${user_id}`);

      // User profiles sil
      await supabaseAdmin
        .from('user_profiles')
        .delete()
        .eq('user_id', user_id);

      // Students veya Teachers tablosunu sil (zaten institution_id null yapıldı, ama silmek daha temiz)
      if (finalUserType === 'teacher') {
        await supabaseAdmin
          .from('teachers')
          .delete()
          .eq('user_id', user_id);
      } else {
        await supabaseAdmin
          .from('students')
          .delete()
          .eq('user_id', user_id);
      }

      // Tüm institution memberships sil (diğer kurumlardaki üyelikler de)
      await supabaseAdmin
        .from('institution_memberships')
        .delete()
        .eq('user_id', user_id);

    } catch (cleanupError) {
      console.error('Veri temizleme hatası (devam ediliyor):', cleanupError);
      // Devam et, auth kullanıcısını silmeye çalış
    }

    // Auth kullanıcısını sil
    try {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

      if (authDeleteError) {
        console.error('Auth kullanıcı silme hatası:', authDeleteError);
        return new Response(
          JSON.stringify({ 
            error: 'Kullanıcı verileri silindi ancak auth kullanıcısı silinemedi', 
            details: authDeleteError.message,
            warning: 'Kullanıcı kurumdan kaldırıldı ancak auth hesabı hala aktif'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    } catch (authError) {
      console.error('Auth kullanıcı silme hatası (catch):', authError);
      return new Response(
        JSON.stringify({ 
          error: 'Kullanıcı verileri silindi ancak auth kullanıcısı silinemedi', 
          details: authError?.message || 'Bilinmeyen hata',
          warning: 'Kullanıcı kurumdan kaldırıldı ancak auth hesabı hala aktif'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        data: {
          message: 'Kullanıcı ve tüm verileri başarıyla silindi'
        },
        error: null 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // Beklenmeyen hataları detaylı log'la
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


