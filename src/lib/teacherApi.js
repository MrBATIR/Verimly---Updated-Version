import { supabase } from './supabase';

// ========================================
// ÖĞRETMEN-ÖĞRENCİ BAĞLANTI API FONKSİYONLARI
// ========================================

/**
 * Öğretmen kodu ile öğretmen bilgilerini getir
 * @param {string} teacherCode - Öğretmen kodu
 * @returns {Object} Öğretmen bilgileri
 */
export const getTeacherByCode = async (teacherCode) => {
  try {
    const { data, error } = await supabase
      .from('teachers')
      .select(`
        id,
        name,
        email,
        branch,
        teacher_code,
        is_active
      `)
      .eq('teacher_code', teacherCode)
      .eq('is_active', true)
      .single();

    if (error) {
      return { success: false, error: 'Öğretmen bulunamadı veya kod geçersiz.' };
    }
    
    if (!data) {
      return { success: false, error: 'Öğretmen bulunamadı veya kod geçersiz.' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('getTeacherByCode error:', error);
    return { success: false, error: 'Bir hata oluştu.' };
  }
};

/**
 * Öğrenci-öğretmen bağlantısı oluştur
 * @param {string} teacherId - Öğretmen ID'si
 * @returns {Object} Bağlantı sonucu
 */
export const connectToTeacher = async (teacherId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Kullanıcı giriş yapmamış');
    }

    // Önce mevcut bağlantıyı kontrol et
    const { data: existingConnection } = await supabase
      .from('student_teachers')
      .select('id, approval_status, is_active')
      .eq('student_id', user.id)
      .eq('teacher_id', teacherId)
      .single();

    if (existingConnection) {
      if (existingConnection.approval_status === 'approved' && existingConnection.is_active) {
        throw new Error('Bu öğretmene zaten bağlısınız');
      } else if (existingConnection.approval_status === 'pending') {
        throw new Error('Bu öğretmene zaten bağlantı isteği gönderdiniz. Onay bekleniyor.');
      } else {
        // Diğer tüm durumlar (rejected, approved ama inactive) için yeni istek gönder
        const { error: updateError } = await supabase
          .from('student_teachers')
          .update({
            is_active: false,
            approval_status: 'pending',
            request_type: 'connect' // Yeni bağlantı isteği
          })
          .eq('id', existingConnection.id);

        if (updateError) {
          console.error('❌ Eski kayıt güncellenirken hata:', updateError);
          throw new Error('Eski kayıt güncellenemedi');
        }

        return { success: true, message: 'Bağlantı isteği gönderildi.' };
      }
    }

    // Bağlantıyı oluştur (onay bekler)
    const { data, error } = await supabase
      .from('student_teachers')
      .insert({
        student_id: user.id,
        teacher_id: teacherId,
        is_active: false, // Onay beklerken aktif değil
        approval_status: 'pending',
        request_type: 'connect' // İstek türü: bağlantı
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Bağlantı oluşturma hatası:', error);
      throw new Error(`Bağlantı oluşturulamadı: ${error.message}`);
    }

    return { success: true, data };
  } catch (error) {
    console.error('Öğretmen bağlantı hatası:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Öğrencinin bağlı olduğu öğretmenleri getir
 * @returns {Array} Öğretmen listesi
 */
export const getStudentTeachers = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Kullanıcı giriş yapmamış');
    }

    const { data, error } = await supabase
      .from('student_teachers')
      .select(`
        id,
        join_date,
        is_active,
        approval_status,
        request_type,
        teachers (
          id,
          name,
          email,
          branch,
          schools (
            name
          )
        )
      `)
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });


    if (error) {
      console.error('❌ getStudentTeachers hatası:', error);
      throw new Error(`Öğretmenler getirilemedi: ${error.message}`);
    }

    return { success: true, data };
  } catch (error) {
    console.error('Öğretmen listesi hatası:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Öğretmenin öğrencilerini getir
 * @returns {Array} Öğrenci listesi
 */
export const getTeacherStudents = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Kullanıcı giriş yapmamış');
    }

    // Önce öğretmen ID'sini al
    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (teacherError || !teacher) {
      throw new Error('Öğretmen bulunamadı');
    }

    // Öğrencileri getir
    const { data, error } = await supabase
      .from('student_teachers')
      .select(`
        id,
        join_date,
        is_active,
        students:student_id (
          id,
          email,
          user_profiles (
            selected_avatar,
            created_at
          )
        )
      `)
      .eq('teacher_id', teacher.id)
      .eq('is_active', true)
      .order('join_date', { ascending: false });

    if (error) {
      throw new Error('Öğrenciler getirilemedi');
    }

    return { success: true, data };
  } catch (error) {
    console.error('Öğrenci listesi hatası:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Öğrenci-öğretmen bağlantısını kes
 * @param {string} connectionId - Bağlantı ID'si
 * @returns {Object} Bağlantı kesme sonucu
 */
export const disconnectFromTeacher = async (connectionId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Kullanıcı giriş yapmamış');
    }

    const { error } = await supabase
      .from('student_teachers')
      .update({ 
        is_active: false,
        approval_status: 'rejected'
      })
      .eq('id', connectionId)
      .eq('student_id', user.id);

    if (error) {
      throw new Error('Bağlantı kesilemedi');
    }

    return { success: true };
  } catch (error) {
    console.error('Bağlantı kesme hatası:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bağlantı kesme isteği gönder (öğretmen onayı gerekli)
 * @param {string} connectionId - Bağlantı ID'si
 * @returns {Object} İstek sonucu
 */
export const requestDisconnection = async (connectionId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Kullanıcı giriş yapmamış');
    }

    // Mevcut bağlantıyı kesme isteği olarak güncelle
    const { error: updateError } = await supabase
      .from('student_teachers')
      .update({ 
        approval_status: 'pending', // Kesme isteği için pending
        request_type: 'disconnect', // İstek türü: kesme
        is_active: true // Kesme isteği sırasında hala aktif (onay beklerken)
      })
      .eq('id', connectionId)
      .eq('student_id', user.id)
      .in('approval_status', ['approved', 'rejected']); // Onaylanmış ve reddedilen bağlantılar için

    if (updateError) {
      console.error('❌ Bağlantı kesme isteği hatası:', updateError);
      throw new Error(`Bağlantı kesme isteği gönderilemedi: ${updateError.message}`);
    }


    return { success: true, message: 'Bağlantı kesme isteği gönderildi.' };
  } catch (error) {
    console.error('Bağlantı kesme isteği hatası:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bekleyen öğretmen isteğini geri çek
 * @param {string} connectionId - Bağlantı ID'si
 * @returns {Object} Geri çekme sonucu
 */
export const cancelPendingRequest = async (connectionId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Kullanıcı giriş yapmamış');
    }

    // Önce mevcut bağlantının durumunu kontrol et
    const { data: connection, error: fetchError } = await supabase
      .from('student_teachers')
      .select('id, approval_status, request_type, is_active')
      .eq('id', connectionId)
      .eq('student_id', user.id)
      .single();

    if (fetchError || !connection) {
      throw new Error('Bağlantı bulunamadı');
    }

    // Eğer bağlantı kesme isteği ise, öğretmeni tekrar bağlı duruma döndür
    if (connection.request_type === 'disconnect' && connection.approval_status === 'pending') {
      const { error: updateError } = await supabase
        .from('student_teachers')
        .update({ 
          approval_status: 'approved',
          is_active: true,
          request_type: 'connect'
        })
        .eq('id', connectionId)
        .eq('student_id', user.id);

      if (updateError) {
        console.error('❌ Bağlantı geri döndürme hatası:', updateError);
        throw new Error(`Bağlantı geri döndürülemedi: ${updateError.message}`);
      }

      return { success: true, message: 'Bağlantı kesme isteği geri çekildi. Öğretmen tekrar bağlı duruma döndü.' };
    }

    // Eğer bağlantı isteği ise, isteği iptal et
    if (connection.request_type === 'connect' && connection.approval_status === 'pending') {
      const { error: deleteError } = await supabase
        .from('student_teachers')
        .delete()
        .eq('id', connectionId)
        .eq('student_id', user.id);

      if (deleteError) {
        // RLS policy nedeniyle silme başarısız, UPDATE ile iptal et
        const { error: updateError } = await supabase
          .from('student_teachers')
          .update({ 
            is_active: false,
            approval_status: 'rejected'
          })
          .eq('id', connectionId)
          .eq('student_id', user.id);

        if (updateError) {
          console.error('❌ İstek iptal etme hatası:', updateError);
          throw new Error(`İstek iptal edilemedi: ${updateError.message}`);
        }
      }

      return { success: true, message: 'Bağlantı isteği geri çekildi.' };
    }

    throw new Error('Geçersiz bağlantı durumu');
  } catch (error) {
    console.error('İstek geri çekme hatası:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bağlantı kesme isteğini onayla
 * @param {string} connectionId - Bağlantı ID'si
 * @returns {Object} Sonuç
 */
export const approveDisconnectionRequest = async (connectionId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Kullanıcı giriş yapmamış');
    }

    // Önce öğretmen ID'sini al
    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (teacherError || !teacher) {
      throw new Error('Öğretmen bulunamadı');
    }

    // Bağlantı kesme isteğini onayla (is_active = false, approval_status = 'rejected')
    const { error } = await supabase
      .from('student_teachers')
      .update({
        is_active: false,
        approval_status: 'rejected'
      })
      .eq('id', connectionId)
      .eq('teacher_id', teacher.id)
      .eq('approval_status', 'pending'); // Sadece bekleyen kesme istekleri için

    if (error) {
      console.error('❌ Kesme isteği onaylama hatası:', error);
      throw new Error(`Kesme isteği onaylanamadı: ${error.message}`);
    }

    return { success: true, message: 'Bağlantı başarıyla kesildi.' };
  } catch (error) {
    console.error('Kesme isteği onaylama hatası:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Öğrencinin çalışma verilerini getir (öğretmen için)
 * @param {string} studentId - Öğrenci ID'si
 * @param {Object} dateRange - Tarih aralığı
 * @returns {Array} Çalışma verileri
 */
export const getStudentStudyData = async (studentId, dateRange) => {
  try {
    const { data, error } = await supabase
      .from('study_logs')
      .select('*')
      .eq('user_id', studentId)
      .gte('study_date', dateRange.start)
      .lte('study_date', dateRange.end)
      .order('study_date', { ascending: false });

    if (error) {
      throw new Error('Çalışma verileri getirilemedi');
    }

    return { success: true, data };
  } catch (error) {
    console.error('Çalışma verisi hatası:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Öğretmen kodu oluştur (admin için)
 * @returns {string} Benzersiz öğretmen kodu
 */
export const generateTeacherCode = () => {
  const prefix = 'TCH';
  const randomNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${randomNumber}`;
};

/**
 * Öğretmen kodu doğrula (format kontrolü)
 * @param {string} teacherCode - Öğretmen kodu
 * @returns {boolean} Geçerli mi
 */
export const validateTeacherCode = (teacherCode) => {
  const pattern = /^TCH\d{4}$/;
  return pattern.test(teacherCode);
};

/**
 * Öğretmenin onay bekleyen öğrenci isteklerini getir
 * @returns {Object} Onay bekleyen istekler
 */
export const getPendingRequests = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Kullanıcı oturumu bulunamadı.' };

    // Öğretmen ID'sini al
    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (teacherError || !teacher) {
      return { success: false, error: 'Öğretmen bilgisi bulunamadı.' };
    }

    // Onay bekleyen ve reddedilen istekleri getir
    const { data, error } = await supabase
      .from('student_teachers')
      .select(`
        id,
        student_id,
        approval_status,
        request_type,
        created_at
      `)
      .eq('teacher_id', teacher.id)
      .in('approval_status', ['pending', 'rejected']) // Hem pending hem rejected
      .order('created_at', { ascending: false });


    if (error) {
      console.error('Onay bekleyen istekler getirilirken hata:', error);
      return { success: false, error: 'İstekler getirilemedi.' };
    }

    // Her öğrenci için gerçek bilgileri çek
    const enrichedData = [];
    for (const request of data || []) {
      try {
        // user_profiles tablosundan öğrenci bilgilerini çek
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_id, name, email, selected_avatar')
          .eq('user_id', request.student_id)
          .single();

        if (!profileError && profile) {
          enrichedData.push({
            ...request,
            students: {
              id: request.student_id,
              email: profile.email,
              name: profile.name,
              selected_avatar: profile.selected_avatar,
              user_metadata: { 
                full_name: profile.name
              }
            }
          });
        } else {
          // Profil bulunamazsa temel bilgileri kullan
          enrichedData.push({
            ...request,
            students: {
              id: request.student_id,
              email: 'Bilinmeyen',
              name: 'Öğrenci',
              user_metadata: { 
                full_name: 'Öğrenci'
              }
            }
          });
        }
      } catch (error) {
        console.error('Öğrenci bilgisi çekilirken hata:', error);
        // Hata durumunda temel bilgileri kullan
        enrichedData.push({
          ...request,
          students: {
            id: request.student_id,
            email: 'Bilinmeyen',
            name: 'Öğrenci',
            user_metadata: { 
              full_name: 'Öğrenci'
            }
          }
        });
      }
    }

    return { success: true, data: enrichedData };
  } catch (e) {
    console.error('getPendingRequests exception:', e);
    return { success: false, error: 'Bir hata oluştu.' };
  }
};

/**
 * Öğrenci isteğini onayla
 * @param {string} requestId - İstek ID'si
 * @returns {Object} Onay sonucu
 */
export const approveStudentRequest = async (requestId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Kullanıcı oturumu bulunamadı.' };

    // Önce isteğin türünü kontrol et
    const { data: request, error: requestError } = await supabase
      .from('student_teachers')
      .select('request_type')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      return { success: false, error: 'İstek bulunamadı.' };
    }

    // Bağlantı kesme isteği onaylandığında bağlantı kesilmeli
    const isDisconnectRequest = request.request_type === 'disconnect';
    
    const { error } = await supabase
      .from('student_teachers')
      .update({
        approval_status: 'approved',
        is_active: isDisconnectRequest ? false : true, // Kesme isteği onaylanırsa bağlantı kes
        request_type: null // İstek türünü temizle
      })
      .eq('id', requestId);

    if (error) {
      console.error('İstek onaylanırken hata:', error);
      return { success: false, error: 'İstek onaylanamadı.' };
    }

    const message = isDisconnectRequest 
      ? 'Bağlantı kesme isteği onaylandı. Bağlantı kesildi.' 
      : 'Bağlantı isteği onaylandı.';

    return { success: true, message };
  } catch (e) {
    console.error('approveStudentRequest exception:', e);
    return { success: false, error: 'Bir hata oluştu.' };
  }
};


/**
 * Öğrenci isteğini reddet
 * @param {string} requestId - İstek ID'si
 * @returns {Object} Red sonucu
 */
export const rejectStudentRequest = async (requestId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Kullanıcı oturumu bulunamadı.' };

    // Önce isteğin türünü kontrol et
    const { data: request, error: requestError } = await supabase
      .from('student_teachers')
      .select('request_type, approval_status, is_active')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      return { success: false, error: 'İstek bulunamadı.' };
    }

    
    // Bağlantı kesme isteği reddedildiğinde öğrenci bağlı kalmalı
    const isDisconnectRequest = request.request_type === 'disconnect';
    
    const updateData = {
      approval_status: 'rejected',
      is_active: isDisconnectRequest ? true : false, // Kesme isteği reddedilirse bağlı kal
      request_type: null // İstek türünü temizle
    };
    
    
    const { error } = await supabase
      .from('student_teachers')
      .update(updateData)
      .eq('id', requestId);

    if (error) {
      console.error('İstek reddedilirken hata:', error);
      return { success: false, error: 'İstek reddedilemedi.' };
    }

    const message = isDisconnectRequest 
      ? 'Bağlantı kesme isteği reddedildi. Öğrenci bağlı kaldı.' 
      : 'Bağlantı isteği reddedildi.';

    return { success: true, message };
  } catch (e) {
    console.error('rejectStudentRequest exception:', e);
    return { success: false, error: 'Bir hata oluştu.' };
  }
};

/**
 * Öğretmenin bağlı öğrencilerini getir
 * @returns {Object} Öğrenci listesi
 */
export const getStudents = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Kullanıcı oturumu bulunamadı.' };

    // Önce öğretmen ID'sini al
    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (teacherError || !teacher) {
      console.error('Öğretmen bulunamadı:', teacherError);
      return { success: false, error: 'Öğretmen bulunamadı.' };
    }

    const { data, error } = await supabase
      .from('student_teachers')
      .select(`
        id,
        student_id,
        approval_status,
        is_active
      `)
      .eq('teacher_id', teacher.id)
      .eq('is_active', true)
      .in('approval_status', ['approved', 'rejected']); // Onaylanmış ve reddedilen kesme istekleri


    if (error) {
      console.error('Öğrenciler yüklenirken hata:', error);
      return { success: false, error: 'Öğrenciler yüklenemedi.' };
    }

    // Her öğrenci için bilgileri al
    const students = [];
    for (const item of data) {
      // Önce user_profiles'den dene
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, name, email')
        .eq('user_id', item.student_id)
        .single();
      
      if (!profileError && profile) {
        students.push({
          id: profile.user_id,
          name: profile.name,
          email: profile.email,
          connection_id: item.id,
          approval_status: item.approval_status,
          is_active: item.is_active
        });
      } else {
        // user_profiles'de yoksa manuel olarak ekle
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: item.student_id,
            user_type: 'student',
            selected_avatar: null,
            name: 'Öğrenci',
            email: 'bilinmeyen@example.com'
          });
        
        // Temel bilgileri kullan
        students.push({
          id: item.student_id,
          name: 'Öğrenci',
          email: 'Bilinmeyen',
          connection_id: item.id,
          approval_status: item.approval_status,
          is_active: item.is_active
        });
      }
    }
    
    return { success: true, data: students };
  } catch (e) {
    console.error('getStudents exception:', e);
    return { success: false, error: 'Bir hata oluştu.' };
  }
};

/**
 * Öğretmen öğrenci için plan oluştur
 * @param {string} studentId - Öğrenci ID'si
 * @param {string} title - Plan başlığı
 * @param {string} description - Plan açıklaması
 * @param {Date} planDate - Plan tarihi
 * @returns {Object} Plan oluşturma sonucu
 */
export const createStudentPlan = async (studentId, title, description, planDate, planType = 'daily') => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Kullanıcı giriş yapmamış');
    }

    // Öğretmen ID'sini al
    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (teacherError || !teacher) {
      throw new Error('Öğretmen bulunamadı');
    }

    // Plan oluştur
    let data, error;
    
    if (planType === 'daily') {
      const result = await supabase
        .from('student_daily_plans')
        .insert({
          student_id: studentId,
          teacher_id: teacher.id,
          title: title,
          description: description,
          plan_date: planDate.toISOString().split('T')[0], // YYYY-MM-DD formatında
          is_completed: false
        })
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Haftalık plan için haftanın başlangıç tarihini hesapla
      const weekStart = new Date(planDate);
      const day = weekStart.getDay();
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // Pazartesi
      weekStart.setDate(diff);
      
      const result = await supabase
        .from('student_weekly_plans')
        .insert({
          student_id: studentId,
          teacher_id: teacher.id,
          title: title,
          description: description,
          week_start_date: weekStart.toISOString().split('T')[0], // YYYY-MM-DD formatında
          is_completed: false
        })
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Plan oluşturulurken hata:', error);
      throw new Error(`Plan oluşturulamadı: ${error.message}`);
    }

    return { success: true, data, message: 'Plan başarıyla oluşturuldu.' };
  } catch (error) {
    console.error('createStudentPlan hatası:', error);
    return { success: false, error: error.message };
  }
};
