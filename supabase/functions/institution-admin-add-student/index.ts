// Supabase Edge Function: Kurum Admin - Öğrenci Ekleme
// Bu fonksiyon, kurum adminin kurumuna öğrenci eklemesini sağlar

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
      student_data,
      deactivate_other_institutions = false, // Başka kurumlardaki üyelikleri pasif etme onayı
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

    if (!institution_id || !student_data) {
      return new Response(
        JSON.stringify({ error: 'institution_id ve student_data gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Form validasyonu
    if (!student_data.firstName || !student_data.lastName || !student_data.email) {
      return new Response(
        JSON.stringify({ error: 'Ad, soyad ve e-posta alanları zorunludur' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kurum admin kontrolü
    const { data: institutionData, error: institutionError } = await supabaseAdmin
      .from('institutions')
      .select('id, contact_email, max_students, name')
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

    // Kurum limit kontrolü
    const { data: memberships } = await supabaseAdmin
      .from('institution_memberships')
      .select('user_id')
      .eq('institution_id', institution_id)
      .eq('is_active', true);

    if (memberships && memberships.length > 0) {
      const userIds = memberships.map(m => m.user_id).filter(Boolean);
      const { data: userProfiles } = await supabaseAdmin
        .from('user_profiles')
        .select('user_type')
        .in('user_id', userIds);

      const currentStudentCount = userProfiles?.filter(p => p.user_type === 'student').length || 0;

      if (currentStudentCount >= institutionData.max_students) {
        return new Response(
          JSON.stringify({ 
            error: 'Öğrenci limiti aşıldı',
            limit_reached: true,
            current_count: currentStudentCount,
            max_count: institutionData.max_students,
            institution_name: institutionData.name
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // E-posta ile mevcut kullanıcıyı bul
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, email')
      .eq('email', student_data.email.toLowerCase().trim())
      .maybeSingle();

    let targetUserId: string | null = null;
    let isNewUser = false;

    if (existingProfile) {
      // Mevcut kullanıcı
      targetUserId = existingProfile.user_id;

      // Bu kullanıcının başka kurumlarda aktif üyeliği var mı kontrol et
      const { data: existingMemberships } = await supabaseAdmin
        .from('institution_memberships')
        .select('institution_id, is_active, institutions(name)')
        .eq('user_id', targetUserId)
        .eq('is_active', true);

      if (existingMemberships && existingMemberships.length > 0) {
        const otherInstitutions = existingMemberships
          .filter(m => m.institution_id !== institution_id)
          .map(m => m.institutions?.name || 'Bilinmeyen Kurum');

        if (otherInstitutions.length > 0 && !deactivate_other_institutions) {
          // Frontend'de onay istenmesi gerekiyor
          return new Response(
            JSON.stringify({ 
              requires_confirmation: true,
              other_institutions: otherInstitutions,
              message: `Bu öğrenci zaten "${otherInstitutions.join(', ')}" kurum(lar)ında aktif üyeliğe sahip. Önceki kurum üyelikleri pasif edilecek.`
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Onay verilmişse veya başka kurumda üyelik yoksa devam et
        if (deactivate_other_institutions) {
          // Eski aktif üyelikleri pasif et
          await supabaseAdmin
            .from('institution_memberships')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('user_id', targetUserId)
            .neq('institution_id', institution_id);
        }
      }

      // Bu kurumda pasif üyelik var mı kontrol et
      const { data: currentInstitutionMembership } = await supabaseAdmin
        .from('institution_memberships')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('institution_id', institution_id)
        .maybeSingle();

      if (currentInstitutionMembership) {
        // Pasif üyeliği aktif et
        const { error: activateError } = await supabaseAdmin
          .from('institution_memberships')
          .update({ 
            is_active: true,
            joined_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', currentInstitutionMembership.id);

        if (activateError) {
          return new Response(
            JSON.stringify({ error: 'Pasif üyelik aktif edilirken hata', details: activateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // user_profiles tablosunda institution_id güncelle
      const studentName = `${student_data.firstName} ${student_data.lastName}`.trim();
      const { error: profileUpdateError } = await supabaseAdmin
        .from('user_profiles')
        .update({ 
          institution_id: institution_id,
          name: studentName
        })
        .eq('user_id', targetUserId);

      if (profileUpdateError) {
        console.error('user_profiles institution_id güncelleme hatası:', profileUpdateError);
        // Kritik değil, devam et
      }

      // Mevcut kullanıcı için students tablosunda kayıt var mı kontrol et
      const { data: existingStudent } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (!existingStudent) {
        // Students tablosunda kayıt yoksa oluştur
        const { data: insertedStudent, error: studentError } = await supabaseAdmin
          .from('students')
          .insert({
            user_id: targetUserId,
            name: studentName,
            email: student_data.email.toLowerCase().trim(),
            school: institutionData.name || '',
            grade: student_data.grade || null,
            phone: student_data.phone || null,
            parent_name: student_data.parentName || null,
            parent_phone: student_data.parentPhone || null,
            address: student_data.address || null,
            notes: student_data.notes || null,
            institution_id: institution_id
          })
          .select()
          .single();

        if (studentError) {
          return new Response(
            JSON.stringify({ error: 'Öğrenci kaydı oluşturulamadı', details: studentError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!insertedStudent) {
          return new Response(
            JSON.stringify({ error: 'Öğrenci kaydı oluşturulamadı' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Varsa güncelle
        const { error: updateError } = await supabaseAdmin
          .from('students')
          .update({
            name: studentName,
            email: student_data.email.toLowerCase().trim(),
            school: institutionData.name || '',
            grade: student_data.grade || null,
            phone: student_data.phone || null,
            parent_name: student_data.parentName || null,
            parent_phone: student_data.parentPhone || null,
            address: student_data.address || null,
            notes: student_data.notes || null,
            institution_id: institution_id
          })
          .eq('id', existingStudent.id);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Öğrenci kaydı güncellenemedi', details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Başka kurumda aktif üyelik yoksa ve bu kurumda pasif üyelik de yoksa yeni üyelik oluştur
      if (!currentInstitutionMembership) {
        const { error: membershipError } = await supabaseAdmin
          .from('institution_memberships')
          .insert({
            user_id: targetUserId,
            institution_id: institution_id,
            role: 'student',
            joined_at: new Date().toISOString()
          });

        if (membershipError) {
          return new Response(
            JSON.stringify({ error: 'Üyelik oluşturulamadı', details: membershipError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ 
          data: {
            is_new_user: false,
            message: 'Öğrenci başarıyla eklendi'
          },
          error: null 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Yeni kullanıcı oluştur
      const studentName = `${student_data.firstName} ${student_data.lastName}`.trim();
      
      const { data: createdUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: student_data.email.toLowerCase().trim(),
        password: 'student123',
        email_confirm: true,
        user_metadata: {
          first_name: student_data.firstName,
          last_name: student_data.lastName,
          user_type: 'student',
          school: institutionData.name || '',
          grade: student_data.grade,
          phone: student_data.phone,
          parent_name: student_data.parentName,
          parent_phone: student_data.parentPhone,
          address: student_data.address,
          notes: student_data.notes
        }
      });

      if (authError || !createdUser.user) {
        return new Response(
          JSON.stringify({ error: 'Kullanıcı oluşturulamadı', details: authError?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetUserId = createdUser.user.id;
      isNewUser = true;

      // User profile oluştur veya güncelle
      const { data: existingProfileAfterAuth } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (!existingProfileAfterAuth) {
        // Yeni profile oluştur
        const { error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            user_id: targetUserId,
            name: studentName,
            user_type: 'student',
            email: student_data.email.toLowerCase().trim(),
            institution_id: institution_id
          });

        if (profileError) {
          return new Response(
            JSON.stringify({ error: 'Profil oluşturulamadı', details: profileError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Mevcut profile'ı güncelle
        const { error: updateError } = await supabaseAdmin
          .from('user_profiles')
          .update({
            name: studentName,
            email: student_data.email.toLowerCase().trim(),
            institution_id: institution_id
          })
          .eq('user_id', targetUserId);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Profil güncellenemedi', details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Student bilgilerini kaydet - önce varsa kontrol et
      const { data: existingStudent } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (!existingStudent) {
        const { data: insertedStudent, error: studentError } = await supabaseAdmin
          .from('students')
          .insert({
            user_id: targetUserId,
            name: studentName,
            email: student_data.email.toLowerCase().trim(),
            school: institutionData.name || '',
            grade: student_data.grade || null,
            phone: student_data.phone || null,
            parent_name: student_data.parentName || null,
            parent_phone: student_data.parentPhone || null,
            address: student_data.address || null,
            notes: student_data.notes || null,
            institution_id: institution_id
          })
          .select()
          .single();

        if (studentError) {
          return new Response(
            JSON.stringify({ error: 'Öğrenci kaydı oluşturulamadı', details: studentError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!insertedStudent) {
          return new Response(
            JSON.stringify({ error: 'Öğrenci kaydı oluşturulamadı: Kayıt oluşturuldu ama geri döndürülemedi' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Zaten varsa güncelle
        const { error: updateError } = await supabaseAdmin
          .from('students')
          .update({
            name: studentName,
            email: student_data.email.toLowerCase().trim(),
            school: institutionData.name || '',
            grade: student_data.grade || null,
            phone: student_data.phone || null,
            parent_name: student_data.parentName || null,
            parent_phone: student_data.parentPhone || null,
            address: student_data.address || null,
            notes: student_data.notes || null,
            institution_id: institution_id
          })
          .eq('id', existingStudent.id);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Öğrenci kaydı güncellenemedi', details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Kurum üyeliği oluştur
      const { data: existingMembership } = await supabaseAdmin
        .from('institution_memberships')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('institution_id', institution_id)
        .maybeSingle();

      if (existingMembership) {
        // Zaten üyelik varsa aktif et
        const { error: updateError } = await supabaseAdmin
          .from('institution_memberships')
          .update({ 
            is_active: true, 
            joined_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMembership.id);
        
        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Üyelik aktif edilemedi', details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Yeni üyelik oluştur
        const { error: membershipError } = await supabaseAdmin
          .from('institution_memberships')
          .insert({
            user_id: targetUserId,
            institution_id: institution_id,
            role: 'student',
            joined_at: new Date().toISOString()
          });

        if (membershipError) {
          return new Response(
            JSON.stringify({ error: 'Üyelik oluşturulamadı', details: membershipError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ 
          data: {
            is_new_user: true,
            message: 'Öğrenci başarıyla eklendi'
          },
          error: null 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
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


