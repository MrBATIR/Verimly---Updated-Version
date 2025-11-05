/**
 * Admin API Helper
 * 
 * Bu dosya, Supabase Edge Functions üzerinden admin işlemlerini yapmak için
 * helper fonksiyonlar içerir. Service Key artık frontend'de tutulmuyor,
 * tüm admin işlemleri backend Edge Functions üzerinden yapılıyor.
 * 
 * ÖNEMLİ: Service Key'i Supabase Dashboard > Edge Functions > Secrets
 * kısmına SUPABASE_SERVICE_ROLE_KEY adıyla eklemeniz gerekiyor.
 */

import { supabase } from './supabase';

/**
 * Edge Function çağrısı yapar
 * @param {string} functionName - Çağrılacak Edge Function adı
 * @param {Object} body - Request body
 * @param {Object} options - Ek seçenekler (headers, etc.)
 * @returns {Promise<{data: any, error: any}>}
 */
async function invokeEdgeFunction(functionName, body = {}, options = {}) {
  try {
    // Mevcut session'ı al
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      return { data: null, error: { message: 'Session alınamadı', details: sessionError } };
    }

    // Session yoksa hata verme, sadece token'ı gönderme (kurum admin için)
    const headers = {
      ...options.headers,
    };
    
    if (session && !sessionError) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    // Edge Function'ı çağır - try-catch ile sarmalayarak error objelerini güvenli handle et
    let data, error;
    try {
      const result = await supabase.functions.invoke(functionName, {
        body,
        headers,
      });
      
      // Debug: result objesini log'la
      console.log(`[DEBUG] Edge Function ${functionName} result:`, {
        hasData: !!result.data,
        hasError: !!result.error,
        dataType: typeof result.data,
        errorType: typeof result.error,
        errorMessage: result.error?.message,
        errorContext: result.error?.context,
        errorStatus: result.error?.status,
        fullError: result.error ? JSON.stringify(result.error, Object.getOwnPropertyNames(result.error)) : null
      });
      
      data = result.data;
      error = result.error;
      
      // Supabase functions.invoke bazen error objesi yerine direkt hata döndürebilir
      // Eğer error varsa ve mesajı "non-2xx status code" ise, response body'yi kontrol et
      if (error && error.message && error.message.includes('non-2xx status code')) {
        // ÖNEMLİ: Supabase 401, 403, 404 gibi non-2xx status code'larında data'yı null yapabilir
        // Ama error objesinde response body olabilir veya data hala mevcut olabilir
        
        // Önce data'yı kontrol et (bazen data hala mevcut olabilir)
        if (data && typeof data === 'object') {
          if (data.error) {
            error = typeof data.error === 'string' ? { message: data.error } : data.error;
          } else if (data.message) {
            error = { message: data.message };
          } else if (data.details) {
            error = { message: data.details, details: data.details };
          }
        } else if (!data || data === null) {
          // Response body null ise, error objesinin context'inde veya status'unda bilgi olabilir
          const errorContext = error?.context;
          const errorStatus = error?.status;
          const errorMessage = error?.message;
          
          // Error objesinin tüm property'lerini kontrol et
          const errorKeys = error ? Object.keys(error) : [];
          console.error(`[ERROR] Edge Function ${functionName} response body null. Error detayları:`, {
            errorMessage,
            errorName: error?.name,
            errorCode: error?.code,
            errorStatus,
            errorKeys,
            errorContext: errorContext ? JSON.stringify(errorContext) : null,
            fullError: error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : null
          });
          
          // Eğer error context'inde response body varsa, onu kullan
          if (errorContext && typeof errorContext === 'object') {
            if (errorContext.error) {
              error = typeof errorContext.error === 'string' ? { message: errorContext.error } : errorContext.error;
            } else if (errorContext.message) {
              error = { message: errorContext.message };
            } else if (errorContext.details) {
              error = { message: errorContext.details, details: errorContext.details };
            }
          }
          
          // Eğer hala error mesajı yoksa, status code'a göre genel mesaj ver
          if (!error || (error.message && error.message.includes('non-2xx'))) {
            let statusMessage = 'Bilinmeyen hata';
            if (errorStatus === 401) {
              statusMessage = 'Mevcut şifre yanlış';
            } else if (errorStatus === 403) {
              statusMessage = 'Erişim yetkiniz yok';
            } else if (errorStatus === 404) {
              statusMessage = 'Kayıt bulunamadı';
            } else if (errorStatus === 400) {
              statusMessage = 'Geçersiz istek';
            } else if (errorStatus === 500) {
              statusMessage = 'Sunucu hatası';
            }
            
            error = { 
              message: statusMessage,
              details: errorStatus ? `HTTP Status: ${errorStatus}` : 'Response body null veya boş'
            };
          }
        }
      }
    } catch (invokeError) {
      // Supabase invoke çağrısı sırasında hata oluşursa
      // Error objesini direkt log'lamadan önce sadece mesajını al
      let invokeErrorMessage = 'Edge Function çağrısı başarısız';
      try {
        if (typeof invokeError === 'string') {
          invokeErrorMessage = invokeError;
        } else if (invokeError?.message) {
          invokeErrorMessage = String(invokeError.message);
        } else if (invokeError?.toString) {
          invokeErrorMessage = String(invokeError.toString());
        }
      } catch (e) {
        // Hata log'lanırken bile hata oluşursa, varsayılan mesajı kullan
      }
      console.error(`[ERROR] Edge Function ${functionName} invoke hatası:`, invokeErrorMessage);
      return { data: null, error: { message: invokeErrorMessage } };
    }

    if (error) {
      // Error objesini direkt log'lamak yerine sadece mesajı log'la (synthetic event uyarılarını önlemek için)
      // Error objesi içinde nested event objeleri olabilir, bu yüzden sadece string değerleri kullan
      let errorMessage = 'Bilinmeyen hata';
      let errorCode = null;
      let errorName = null;
      
      try {
        if (typeof error === 'string') {
          errorMessage = error;
        } else {
          // Error objesinden sadece primitive değerleri al
          if (error.message) {
            errorMessage = String(error.message);
          } else if (error.toString && typeof error.toString === 'function') {
            try {
              errorMessage = String(error.toString());
            } catch (e) {
              // toString çağrısı başarısız olursa
            }
          }
          
          // Sadece primitive değerleri kopyala
          if (error.code && typeof error.code !== 'object') {
            errorCode = String(error.code);
          }
          if (error.name && typeof error.name !== 'object') {
            errorName = String(error.name);
          }
        }
      } catch (e) {
        // Error objesini parse ederken hata oluşursa, varsayılan mesajı kullan
        errorMessage = 'Hata log\'lanırken bir sorun oluştu';
      }
      
      console.error(`[ERROR] Edge Function ${functionName} hatası:`, errorMessage);
      
      // Error objesini temizle - sadece mesaj ve code gibi güvenli alanları döndür
      const safeError = {
        message: errorMessage,
      };
      
      if (errorCode) {
        safeError.code = errorCode;
      }
      if (errorName) {
        safeError.name = errorName;
      }
      
      return { data: null, error: safeError };
    }

    // Edge Function'lar genellikle { data: ..., error: null } formatında döner
    // supabase.functions.invoke bunu direkt döndürür
    // Ancak Edge Function JSON.stringify({ data: {...}, error: null }) döndürüyor
    // ve supabase.functions.invoke bunu parse ediyor, bu yüzden nested yapı oluşuyor
    
    // Önce nested yapıyı kontrol et ve düzelt
    if (data && typeof data === 'object') {
      // Eğer data içinde data ve error varsa (Edge Function'dan gelen format)
      if ('data' in data && 'error' in data) {
        const innerData = data.data;
        // Eğer innerData içinde de data ve error varsa (çok nested)
        if (innerData && typeof innerData === 'object' && 'data' in innerData && 'error' in innerData) {
          return { data: innerData.data, error: innerData.error || null };
        }
        // Normal nested yapı - data.data'yı kullan
        return { data: innerData, error: data.error || null };
      }
      
      // Eğer data içinde sadece data var (nested ama error yok)
      if ('data' in data && typeof data.data === 'object') {
        // Eğer data.data içinde de data varsa (çok nested)
        if ('data' in data.data && typeof data.data.data === 'object') {
          return { data: data.data.data, error: null };
        }
        // Normal nested yapı
        return { data: data.data, error: null };
      }
    }

    // Normal durum - data direkt kullanılabilir (Edge Function direkt veri döndürüyorsa)
    return { data, error: null };
  } catch (error) {
    // Error objesini direkt log'lamak yerine sadece mesajı log'la (synthetic event uyarılarını önlemek için)
    // Error objesi içinde nested event objeleri olabilir, bu yüzden sadece string değerleri kullan
    let errorMessage = 'Bilinmeyen hata';
    let errorStack = '';
    try {
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = String(error.message);
        errorStack = String(error.stack || '');
      } else if (error?.toString) {
        errorMessage = String(error.toString());
      } else {
        // Error objesini JSON'a çevirmeyi dene ama sadece primitive değerleri al
        const errorObj = {};
        if (error.name) errorObj.name = String(error.name);
        if (error.message) errorObj.message = String(error.message);
        if (error.code) errorObj.code = String(error.code);
        errorMessage = JSON.stringify(errorObj) || 'Bilinmeyen hata';
        errorStack = String(error.stack || '');
      }
    } catch (e) {
      errorMessage = 'Hata log\'lanırken bir sorun oluştu';
    }
    
    console.error(`[ERROR] Edge Function ${functionName} çağrı hatası:`, errorMessage);
    if (errorStack) {
      console.error(`[ERROR] Stack trace:`, errorStack);
    }
    return { data: null, error: { message: errorMessage, details: errorMessage } };
  }
}

// ============================================
// REHBER ÖĞRETMEN İŞLEMLERİ
// ============================================

/**
 * Rehber öğretmen için kurumdaki tüm öğrencileri getirir
 * @param {string} institutionId - Kurum ID
 * @returns {Promise<{data: Array, error: any}>}
 */
export async function getGuidanceTeacherStudents(institutionId) {
  return invokeEdgeFunction('guidance-teacher-students', {
    institution_id: institutionId,
  });
}

// ============================================
// KURUM YÖNETİMİ İŞLEMLERİ
// ============================================

/**
 * Kurum yönetimi için öğrenci ekler
 * @param {Object} studentData - Öğrenci bilgileri
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function addInstitutionStudent(studentData) {
  return invokeEdgeFunction('institution-add-student', {
    student: studentData,
  });
}

/**
 * Kurum yönetimi için öğretmen ekler
 * @param {Object} teacherData - Öğretmen bilgileri
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function addInstitutionTeacher(teacherData) {
  return invokeEdgeFunction('institution-add-teacher', {
    teacher: teacherData,
  });
}

/**
 * Kurum yönetimi için rehber öğretmen atar
 * @param {string} institutionId - Kurum ID
 * @param {string} teacherId - Öğretmen ID
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function setGuidanceTeacher(institutionId, teacherId) {
  return invokeEdgeFunction('institution-set-guidance-teacher', {
    institution_id: institutionId,
    teacher_id: teacherId,
  });
}

/**
 * Kurum yönetimi için öğrenci üyeliği oluşturur
 * @param {Object} membershipData - Üyelik bilgileri
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function createStudentMembership(membershipData) {
  return invokeEdgeFunction('institution-create-student-membership', {
    membership: membershipData,
  });
}

// ============================================
// ADMIN İŞLEMLERİ
// ============================================

/**
 * Admin aktivite logu ekler
 * @param {Object} logData - Log bilgileri
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function logAdminActivity(logData) {
  return invokeEdgeFunction('admin-log-activity', {
    log: logData,
  });
}

// ============================================
// ÖĞRETMEN RAPORLARI
// ============================================

/**
 * Rehber öğretmen için öğrenci istatistiklerini getirir
 * @param {string} institutionId - Kurum ID
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function getGuidanceTeacherStudentStats(institutionId) {
  return invokeEdgeFunction('guidance-teacher-student-stats', {
    institution_id: institutionId,
  });
}

/**
 * Rehber öğretmen için öğrencilerin çalışma kayıtlarını getirir
 * @param {string} institutionId - Kurum ID
 * @param {Array<string>} studentIds - Öğrenci ID'leri (opsiyonel, tüm kurum öğrencileri için boş bırakılabilir)
 * @param {string} startDate - Başlangıç tarihi (ISO string, opsiyonel)
 * @param {string} endDate - Bitiş tarihi (ISO string, opsiyonel)
 * @returns {Promise<{data: Array, error: any}>}
 */
export async function getGuidanceTeacherStudyLogs(institutionId, studentIds = null, startDate = null, endDate = null) {
  return invokeEdgeFunction('guidance-teacher-study-logs', {
    institution_id: institutionId,
    student_ids: studentIds,
    start_date: startDate,
    end_date: endDate,
  });
}

/**
 * Rehber öğretmen için öğrenci planlarını getirir
 * @param {string} studentId - Öğrenci ID (students.id veya students.user_id)
 * @param {string} institutionId - Kurum ID
 * @returns {Promise<{data: {daily: Array, weekly: Array}, error: any}>}
 */
export async function getGuidanceTeacherStudentPlans(studentId, institutionId) {
  return invokeEdgeFunction('guidance-teacher-student-plans', {
    student_id: studentId,
    institution_id: institutionId,
  });
}

/**
 * Rehber öğretmen için öğrenci planı oluşturur
 * @param {string} studentId - Öğrenci ID (students.id veya students.user_id)
 * @param {string} institutionId - Kurum ID
 * @param {string} title - Plan başlığı
 * @param {string} description - Plan açıklaması
 * @param {string} planDate - Plan tarihi (YYYY-MM-DD formatında)
 * @param {string} planType - Plan türü ('daily' veya 'weekly')
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function createGuidanceTeacherStudentPlan(studentId, institutionId, title, description, planDate, planType = 'daily') {
  return invokeEdgeFunction('guidance-teacher-create-plan', {
    student_id: studentId,
    institution_id: institutionId,
    title: title,
    description: description,
    plan_date: planDate,
    plan_type: planType,
  });
}

/**
 * Rehber öğretmen için öğrenci planı günceller
 * @param {string} planId - Plan ID
 * @param {string} institutionId - Kurum ID
 * @param {string} planType - Plan türü ('daily' veya 'weekly')
 * @param {Object} updateData - Güncellenecek veriler (title, description, plan_date)
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function updateGuidanceTeacherStudentPlan(planId, institutionId, planType, updateData) {
  return invokeEdgeFunction('guidance-teacher-update-plan', {
    plan_id: planId,
    institution_id: institutionId,
    plan_type: planType,
    title: updateData.title,
    description: updateData.description,
    plan_date: updateData.plan_date,
  });
}

/**
 * Rehber öğretmen için öğrenci planını/planlarını siler
 * @param {Array<string>} planIds - Plan ID'leri (array)
 * @param {string} institutionId - Kurum ID
 * @param {string} planType - Plan türü ('daily' veya 'weekly')
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function deleteGuidanceTeacherStudentPlans(planIds, institutionId, planType) {
  return invokeEdgeFunction('guidance-teacher-delete-plan', {
    plan_ids: planIds,
    institution_id: institutionId,
    plan_type: planType,
  });
}

/**
 * Rehber öğretmen için plan tamamlama durumunu günceller
 * @param {string} planId - Plan ID
 * @param {string} institutionId - Kurum ID
 * @param {boolean} isCompleted - Tamamlandı mı?
 * @param {string} planType - Plan türü ('daily' veya 'weekly')
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function updateGuidanceTeacherPlanCompletion(planId, institutionId, isCompleted, planType) {
  return invokeEdgeFunction('guidance-teacher-update-plan-completion', {
    plan_id: planId,
    institution_id: institutionId,
    is_completed: isCompleted,
    plan_type: planType,
  });
}

/**
 * Rehber öğretmen için öğrenciye mesaj gönderir
 * @param {string} studentId - Öğrenci ID (students.id veya students.user_id)
 * @param {string} institutionId - Kurum ID
 * @param {string} message - Mesaj içeriği
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function sendGuidanceTeacherMessage(studentId, institutionId, message) {
  return invokeEdgeFunction('guidance-teacher-send-message', {
    student_id: studentId,
    institution_id: institutionId,
    message: message,
  });
}

// ============================================
// KURUM ADMIN İŞLEMLERİ
// ============================================

/**
 * Kurum admin için rehber öğretmen bilgisini getirir
 * @param {string} institutionId - Kurum ID
 * @param {string} adminUsername - Admin kullanıcı adı (opsiyonel, token yoksa gerekli)
 * @returns {Promise<{data: Object|null, error: any}>}
 */
export async function getInstitutionAdminGuidanceTeacher(institutionId, adminUsername = null) {
  return invokeEdgeFunction('institution-admin-get-guidance-teacher', {
    institution_id: institutionId,
    admin_username: adminUsername,
  });
}

/**
 * Kurum admin için rehber öğretmen atar veya kaldırır
 * @param {string} institutionId - Kurum ID
 * @param {string|null} teacherId - Öğretmen ID (null ise kaldırma)
 * @param {string|null} adminUsername - Admin kullanıcı adı (opsiyonel, token yoksa gerekli)
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function setInstitutionAdminGuidanceTeacher(institutionId, teacherId, adminUsername = null) {
  return invokeEdgeFunction('institution-admin-set-guidance-teacher', {
    institution_id: institutionId,
    teacher_id: teacherId,
    admin_username: adminUsername,
  });
}

/**
 * Kurum admin için öğretmen ekler
 * @param {string} institutionId - Kurum ID
 * @param {Object} teacherData - Öğretmen bilgileri (firstName, lastName, email, branch, phone, experience, education, address, notes)
 * @param {boolean} deactivateOtherInstitutions - Başka kurumlardaki üyelikleri pasif etme onayı
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function addInstitutionAdminTeacher(institutionId, teacherData, deactivateOtherInstitutions = false, adminUsername = null) {
  return invokeEdgeFunction('institution-admin-add-teacher', {
    institution_id: institutionId,
    teacher_data: teacherData,
    deactivate_other_institutions: deactivateOtherInstitutions,
    admin_username: adminUsername,
  });
}

/**
 * Rehber öğretmen için öğrenci detaylarını getirir
 * @param {string} studentId - Öğrenci ID (students.id, students.user_id veya email)
 * @param {string} institutionId - Kurum ID
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function getGuidanceTeacherStudentDetail(studentId, institutionId) {
  return invokeEdgeFunction('guidance-teacher-student-detail', {
    student_id: studentId,
    institution_id: institutionId,
  });
}

/**
 * Kurum admin için öğrenci ekler
 * @param {string} institutionId - Kurum ID
 * @param {Object} studentData - Öğrenci bilgileri (firstName, lastName, email, grade, phone, parentName, parentPhone, address, notes)
 * @param {boolean} deactivateOtherInstitutions - Başka kurumlardaki üyelikleri pasif etme onayı
 * @param {string|null} adminUsername - Admin kullanıcı adı (opsiyonel, token yoksa gerekli)
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function addInstitutionAdminStudent(institutionId, studentData, deactivateOtherInstitutions = false, adminUsername = null) {
  return invokeEdgeFunction('institution-admin-add-student', {
    institution_id: institutionId,
    student_data: studentData,
    deactivate_other_institutions: deactivateOtherInstitutions,
    admin_username: adminUsername,
  });
}

/**
 * Kurum admin için kullanıcı siler (soft delete: kurumdan ayırır)
 * @param {string} institutionId - Kurum ID
 * @param {string} userId - Kullanıcı ID (user_id)
 * @param {string} userType - Kullanıcı tipi ('teacher' veya 'student')
 * @param {string|null} adminUsername - Admin kullanıcı adı (opsiyonel, token yoksa gerekli)
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function deleteInstitutionAdminUser(institutionId, userId, userType, adminUsername = null) {
  return invokeEdgeFunction('institution-admin-delete-user', {
    institution_id: institutionId,
    user_id: userId,
    user_type: userType,
    admin_username: adminUsername,
  });
}

/**
 * Kurum admin için kullanıcı şifresini sıfırlar
 * @param {string} institutionId - Kurum ID
 * @param {string} userId - Kullanıcı ID (user_id)
 * @param {string|null} adminUsername - Admin kullanıcı adı (opsiyonel, token yoksa gerekli)
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function resetInstitutionAdminUserPassword(institutionId, userId, adminUsername = null) {
  return invokeEdgeFunction('institution-admin-reset-password', {
    institution_id: institutionId,
    user_id: userId,
    admin_username: adminUsername,
  });
}

/**
 * Kurum admin için kullanıcı bilgilerini günceller
 * @param {string} institutionId - Kurum ID
 * @param {string} userId - Kullanıcı ID (user_id)
 * @param {string} userType - Kullanıcı tipi ('teacher' veya 'student')
 * @param {Object} userData - Güncellenecek kullanıcı bilgileri (name, email, branch/grade, phone)
 * @param {string|null} adminUsername - Admin kullanıcı adı (opsiyonel, token yoksa gerekli)
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function updateInstitutionAdminUser(institutionId, userId, userType, userData, adminUsername = null) {
  return invokeEdgeFunction('institution-admin-update-user', {
    institution_id: institutionId,
    user_id: userId,
    user_type: userType,
    name: userData.name,
    email: userData.email,
    branch: userData.branch || null,
    grade: userData.grade || null,
    phone: userData.phone || null,
    admin_username: adminUsername,
  });
}

/**
 * Kurum admin için şifre değiştirme
 * @param {string} institutionId - Kurum ID
 * @param {string} adminUsername - Admin kullanıcı adı
 * @param {string} currentPassword - Mevcut şifre
 * @param {string} newPassword - Yeni şifre
 * @param {string} confirmPassword - Şifre onayı
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function changeInstitutionAdminPassword(institutionId, adminUsername, currentPassword, newPassword, confirmPassword) {
  return invokeEdgeFunction('institution-admin-change-password', {
    institution_id: institutionId,
    admin_username: adminUsername,
    current_password: currentPassword,
    new_password: newPassword,
    confirm_password: confirmPassword,
  });
}

/**
 * Ana admin için istatistikler
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function getAdminStats() {
  return invokeEdgeFunction('admin-get-stats', {});
}

/**
 * Ana admin için kurum detayları (öğretmen ve öğrenci listesi)
 * @param {string} institutionId - Kurum ID
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function getAdminInstitutionDetails(institutionId) {
  return invokeEdgeFunction('admin-get-institution-details', {
    institution_id: institutionId,
  });
}

/**
 * Ana admin için kurum listesi (taşıma modalı için)
 * @returns {Promise<{data: Array, error: any}>}
 */
export async function getAdminInstitutions() {
  return invokeEdgeFunction('admin-get-institutions', {});
}

/**
 * Ana admin için kullanıcıyı kuruma taşıma
 * @param {string} userId - Kullanıcı ID (user_id)
 * @param {string} targetInstitutionId - Hedef kurum ID
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function moveAdminUserToInstitution(userId, targetInstitutionId) {
  return invokeEdgeFunction('admin-move-user-to-institution', {
    user_id: userId,
    target_institution_id: targetInstitutionId,
  });
}

/**
 * Ana admin için kullanıcı şifresini sıfırlar
 * @param {string} userId - Kullanıcı ID (user_id)
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function resetAdminUserPassword(userId) {
  return invokeEdgeFunction('admin-reset-password', {
    user_id: userId,
  });
}

/**
 * Ana admin için kullanıcıyı kurumdan ayırır (soft delete)
 * @param {string} userId - Kullanıcı ID (user_id)
 * @param {string|null} institutionId - Kurum ID (opsiyonel, null ise tüm kurumlardan ayırır)
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function deleteAdminUser(userId, institutionId = null) {
  return invokeEdgeFunction('admin-delete-user', {
    user_id: userId,
    institution_id: institutionId,
  });
}

/**
 * Ana admin için kurum ekler
 * @param {Object} institutionData - Kurum bilgileri (name, type, contact_email, contact_phone, address, admin_username, admin_password)
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function addAdminInstitution(institutionData) {
  return invokeEdgeFunction('admin-add-institution', {
    name: institutionData.name,
    type: institutionData.type || 'school',
    contact_email: institutionData.contact_email,
    contact_phone: institutionData.contact_phone || null,
    address: institutionData.address || null,
    admin_username: institutionData.admin_username,
    admin_password: institutionData.admin_password,
  });
}

/**
 * Ana admin için kurum durumunu aktif/pasif yapar
 * @param {string} institutionId - Kurum ID
 * @param {boolean} isActive - Aktif mi? (true/false)
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function toggleAdminInstitutionStatus(institutionId, isActive) {
  console.log('[DEBUG] toggleAdminInstitutionStatus called:', {
    institutionId,
    isActive,
    isActiveType: typeof isActive
  });
  
  const result = await invokeEdgeFunction('admin-toggle-institution-status', {
    institution_id: institutionId,
    is_active: isActive,
  });
  
  console.log('[DEBUG] toggleAdminInstitutionStatus result:', {
    hasError: !!result.error,
    error: result.error,
    hasData: !!result.data,
    data: result.data
  });
  
  return result;
}

/**
 * Ana admin için sözleşme günceller
 * @param {string} institutionId - Kurum ID
 * @param {Object} contractData - Sözleşme bilgileri (contract_start_date, contract_end_date, payment_status, notes)
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function updateAdminContract(institutionId, contractData) {
  return invokeEdgeFunction('admin-update-contract', {
    institution_id: institutionId,
    contract_start_date: contractData.contract_start_date || null,
    contract_end_date: contractData.contract_end_date || null,
    payment_status: contractData.payment_status || 'pending',
    notes: contractData.notes || null,
  });
}

/**
 * Ana admin için kurum bilgilerini günceller
 * @param {string} institutionId - Kurum ID
 * @param {Object} institutionData - Kurum bilgileri (name, type, contact_email, contact_phone, address, max_teachers, max_students, notes, admin_username, admin_password)
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function updateAdminInstitution(institutionId, institutionData) {
  return invokeEdgeFunction('admin-update-institution', {
    institution_id: institutionId,
    name: institutionData.name,
    type: institutionData.type || 'school',
    contact_email: institutionData.contact_email,
    contact_phone: institutionData.contact_phone || null,
    address: institutionData.address || null,
    max_teachers: institutionData.max_teachers || 50,
    max_students: institutionData.max_students || 500,
    notes: institutionData.notes || null,
    admin_username: institutionData.admin_username || null,
    admin_password: institutionData.admin_password || null, // Sadece değiştirilecekse dolu gönderilmeli
  });
}

/**
 * Ana admin için bireysel kullanıcıları getirir
 * @returns {Promise<{data: {users: Array, stats: Object}, error: any}>}
 */
export async function getAdminIndividualUsers() {
  return invokeEdgeFunction('admin-get-individual-users', {});
}

/**
 * Ana admin için tüm kullanıcıları getirir (arama ve filtreleme için)
 * @returns {Promise<{data: Array, error: any}>}
 */
export async function searchAdminUsers() {
  return invokeEdgeFunction('admin-search-users', {});
}

/**
 * Ana admin için çalışma analitiklerini getirir
 * @param {string|null} institutionId - Kurum ID (opsiyonel, null ise tüm kurumlar)
 * @param {string} timeRange - Zaman aralığı ('today', 'week', 'month', 'all')
 * @returns {Promise<{data: {study_logs: Array, user_ids: Array, institutions: Array}, error: any}>}
 */
export async function getAdminStudyAnalytics(institutionId = null, timeRange = 'month') {
  return invokeEdgeFunction('admin-get-study-analytics', {
    institution_id: institutionId,
    time_range: timeRange,
  });
}

/**
 * Ana admin için zaman bazlı istatistikleri getirir
 * @param {string} timeRange - Zaman aralığı ('week', 'month', 'quarter', 'year')
 * @returns {Promise<{data: {user_profiles: Array, institutions: Array, start_date: string, end_date: string}, error: any}>}
 */
export async function getAdminTimeStats(timeRange = 'month') {
  return invokeEdgeFunction('admin-get-time-stats', {
    time_range: timeRange,
  });
}

