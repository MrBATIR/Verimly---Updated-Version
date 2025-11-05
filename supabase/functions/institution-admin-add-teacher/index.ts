// Supabase Edge Function: Kurum Admin - Öğretmen Ekleme
// Bu fonksiyon, kurum adminin kurumuna öğretmen eklemesini sağlar
// Mevcut çalışan addTeacher fonksiyonunu referans alarak yazılmıştır

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
      teacher_data,
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

    if (!institution_id || !teacher_data) {
      return new Response(
        JSON.stringify({ error: 'institution_id ve teacher_data gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Form validasyonu
    if (!teacher_data.firstName || !teacher_data.lastName || !teacher_data.email || !teacher_data.branch) {
      return new Response(
        JSON.stringify({ error: 'Ad, soyad, e-posta ve branş alanları zorunludur' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kurum admin kontrolü
    const { data: institutionData, error: institutionError } = await supabaseAdmin
      .from('institutions')
      .select('id, contact_email, max_teachers, name')
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

    // Kurum limit kontrolü (mevcut kodun aynısı)
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

      const currentTeacherCount = userProfiles?.filter(p => p.user_type === 'teacher').length || 0;

      if (currentTeacherCount >= institutionData.max_teachers) {
        return new Response(
          JSON.stringify({ 
            error: 'Öğretmen limiti aşıldı',
            limit_reached: true,
            current_count: currentTeacherCount,
            max_count: institutionData.max_teachers,
            institution_name: institutionData.name
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // E-posta ile mevcut kullanıcıyı bul (mevcut kodun aynısı)
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, email')
      .eq('email', teacher_data.email.toLowerCase().trim())
      .maybeSingle();

    let targetUserId: string | null = null;
    let isNewUser = false;

    if (existingProfile) {
      // Mevcut kullanıcı - mevcut kodun mantığı
      targetUserId = existingProfile.user_id;

      // Bu kullanıcının başka kurumlarda aktif üyeliği var mı kontrol et (mevcut kodun aynısı)
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
          // Frontend'de onay istenmesi gerekiyor (mevcut kodun Alert mekanizması)
          return new Response(
            JSON.stringify({ 
              requires_confirmation: true,
              other_institutions: otherInstitutions,
              message: `Bu öğretmen zaten "${otherInstitutions.join(', ')}" kurum(lar)ında aktif üyeliğe sahip. Önceki kurum üyelikleri pasif edilecek.`
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Onay verilmişse veya başka kurumda üyelik yoksa devam et (mevcut kodun aynısı)
        if (deactivate_other_institutions) {
          // Eski aktif üyelikleri pasif et (mevcut kodun aynısı)
          await supabaseAdmin
            .from('institution_memberships')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('user_id', targetUserId)
            .neq('institution_id', institution_id);
        }
      }

      // Bu kurumda pasif üyelik var mı kontrol et (mevcut kodun aynısı)
      const { data: currentInstitutionMembership } = await supabaseAdmin
        .from('institution_memberships')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('institution_id', institution_id)
        .maybeSingle();

      if (currentInstitutionMembership) {
        // Pasif üyeliği aktif et (mevcut kodun aynısı)
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

      // user_profiles tablosunda institution_id güncelle (mevcut kodun aynısı)
      const teacherName = `${teacher_data.firstName} ${teacher_data.lastName}`.trim();
      const { error: profileUpdateError } = await supabaseAdmin
        .from('user_profiles')
        .update({ 
          institution_id: institution_id,
          name: teacherName
        })
        .eq('user_id', targetUserId);

      if (profileUpdateError) {
        console.error('user_profiles institution_id güncelleme hatası:', profileUpdateError);
        // Kritik değil, devam et (mevcut kodun mantığı)
      }

      // Mevcut kullanıcı için teachers tablosunda kayıt var mı kontrol et (mevcut kodun aynısı)
      const { data: existingTeacher } = await supabaseAdmin
        .from('teachers')
        .select('id')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (!existingTeacher) {
        // Teachers tablosunda kayıt yoksa oluştur (mevcut kodun aynısı - teacher_code YOK)
        const { data: insertedTeacher, error: teacherError } = await supabaseAdmin
          .from('teachers')
          .insert({
            user_id: targetUserId,
            branch: teacher_data.branch,
            phone: teacher_data.phone || null,
            experience: teacher_data.experience || null,
            education: teacher_data.education || null,
            address: teacher_data.address || null,
            notes: teacher_data.notes || null,
            institution_id: institution_id
          })
          .select()
          .single();

        if (teacherError) {
          return new Response(
            JSON.stringify({ error: 'Öğretmen kaydı oluşturulamadı', details: teacherError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!insertedTeacher) {
          return new Response(
            JSON.stringify({ error: 'Öğretmen kaydı oluşturulamadı' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Varsa güncelle (mevcut kodun aynısı)
        const { error: updateError } = await supabaseAdmin
          .from('teachers')
          .update({
            branch: teacher_data.branch,
            phone: teacher_data.phone || null,
            experience: teacher_data.experience || null,
            education: teacher_data.education || null,
            address: teacher_data.address || null,
            notes: teacher_data.notes || null,
            institution_id: institution_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTeacher.id);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Öğretmen kaydı güncellenemedi', details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Başka kurumda aktif üyelik yoksa ve bu kurumda pasif üyelik de yoksa yeni üyelik oluştur (mevcut kodun aynısı)
      if (!currentInstitutionMembership) {
        const { error: membershipError } = await supabaseAdmin
          .from('institution_memberships')
          .insert({
            user_id: targetUserId,
            institution_id: institution_id,
            role: 'teacher',
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
            message: 'Öğretmen başarıyla eklendi'
          },
          error: null 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Yeni kullanıcı oluştur (mevcut kodun aynısı)
      const teacherName = `${teacher_data.firstName} ${teacher_data.lastName}`.trim();
      
      const { data: createdUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: teacher_data.email.toLowerCase().trim(),
        password: 'teacher123',
        email_confirm: true,
        user_metadata: {
          first_name: teacher_data.firstName,
          last_name: teacher_data.lastName,
          user_type: 'teacher',
          branch: teacher_data.branch,
          phone: teacher_data.phone,
          experience: teacher_data.experience,
          education: teacher_data.education,
          address: teacher_data.address,
          notes: teacher_data.notes
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

      // User profile oluştur veya güncelle (mevcut kodun aynısı)
      const { data: existingProfileAfterAuth } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (!existingProfileAfterAuth) {
        // Yeni profile oluştur (mevcut kodun aynısı)
        const { error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            user_id: targetUserId,
            name: teacherName,
            user_type: 'teacher',
            email: teacher_data.email.toLowerCase().trim(),
            institution_id: institution_id
          });

        if (profileError) {
          return new Response(
            JSON.stringify({ error: 'Profil oluşturulamadı', details: profileError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Mevcut profile'ı güncelle (mevcut kodun aynısı)
        const { error: updateError } = await supabaseAdmin
          .from('user_profiles')
          .update({
            name: teacherName,
            email: teacher_data.email.toLowerCase().trim(),
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

      // Teacher bilgilerini kaydet - önce varsa kontrol et (mevcut kodun aynısı)
      const { data: existingTeacher } = await supabaseAdmin
        .from('teachers')
        .select('id')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (!existingTeacher) {
        // Öğretmen kodu oluştur (benzersiz) - mevcut kodun aynısı
        const teacherCode = `T${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        
        const { data: insertedTeacher, error: teacherError } = await supabaseAdmin
          .from('teachers')
          .insert({
            user_id: targetUserId,
            name: teacherName, // Zorunlu alan
            email: teacher_data.email.toLowerCase().trim(), // Zorunlu olabilir
            branch: teacher_data.branch,
            phone: teacher_data.phone || null,
            experience: teacher_data.experience || null,
            education: teacher_data.education || null,
            address: teacher_data.address || null,
            notes: teacher_data.notes || null,
            institution_id: institution_id,
            teacher_code: teacherCode // Zorunlu alan
          })
          .select()
          .single();

        if (teacherError) {
          return new Response(
            JSON.stringify({ error: 'Öğretmen kaydı oluşturulamadı', details: teacherError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!insertedTeacher) {
          return new Response(
            JSON.stringify({ error: 'Öğretmen kaydı oluşturulamadı: Kayıt oluşturuldu ama geri döndürülemedi' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Zaten varsa güncelle (mevcut kodun aynısı)
        const { error: updateError } = await supabaseAdmin
          .from('teachers')
          .update({
            name: teacherName, // Zorunlu alan
            email: teacher_data.email.toLowerCase().trim(),
            branch: teacher_data.branch,
            phone: teacher_data.phone || null,
            experience: teacher_data.experience || null,
            education: teacher_data.education || null,
            address: teacher_data.address || null,
            notes: teacher_data.notes || null,
            institution_id: institution_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTeacher.id);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Öğretmen kaydı güncellenemedi', details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Kurum üyeliği oluştur (mevcut kodun createTeacherMembership fonksiyonu)
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
            role: 'teacher',
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
            message: 'Öğretmen başarıyla eklendi'
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
