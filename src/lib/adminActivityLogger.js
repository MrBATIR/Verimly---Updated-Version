/**
 * Admin Aktivite Logger
 * Admin panelindeki işlemleri loglamak için yardımcı fonksiyonlar
 */

import { supabaseAdmin } from './supabase';

/**
 * Admin aktivite logu ekle
 * @param {string} actionType - İşlem tipi ('user_create', 'user_delete', 'user_move', etc.)
 * @param {string} targetType - Hedef tip ('user', 'institution', 'contract', etc.)
 * @param {string} targetId - Hedef ID (UUID)
 * @param {string} description - İşlem açıklaması
 * @param {Object} details - Ek detaylar (JSON)
 * @param {string} adminUserId - Admin kullanıcı ID'si (opsiyonel, auth.uid() kullanılır)
 */
export const logAdminActivity = async (
  actionType,
  targetType,
  targetId,
  description,
  details = null,
  adminUserId = null
) => {
  try {
    // Admin user ID'yi al
    let finalAdminUserId = adminUserId;
    
    if (!finalAdminUserId) {
      // Auth'dan mevcut kullanıcıyı al
      const { data: { user } } = await supabaseAdmin.auth.getUser();
      finalAdminUserId = user?.id || null;
    }

    // Log kaydı oluştur
    const { data, error } = await supabaseAdmin
      .from('admin_activity_logs')
      .insert({
        admin_user_id: finalAdminUserId,
        action_type: actionType,
        target_type: targetType,
        target_id: targetId,
        description: description,
        details: details ? JSON.stringify(details) : null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Admin aktivite logu eklenirken hata:', error);
      return null;
    }

    return data?.id;
  } catch (error) {
    console.error('Admin aktivite logu eklenirken hata:', error);
    return null;
  }
};

/**
 * Önceden tanımlanmış log fonksiyonları
 */

// Kullanıcı işlemleri
export const logUserCreate = async (userId, userName, institutionId = null) => {
  return logAdminActivity(
    'user_create',
    'user',
    userId,
    `${userName} kullanıcısı oluşturuldu`,
    { user_name: userName, institution_id: institutionId }
  );
};

export const logUserDelete = async (userId, userName, institutionId = null) => {
  return logAdminActivity(
    'user_delete',
    'user',
    userId,
    `${userName} kullanıcısı silindi`,
    { user_name: userName, institution_id: institutionId }
  );
};

export const logUserMove = async (userId, userName, fromInstitutionId, toInstitutionId) => {
  return logAdminActivity(
    'user_move',
    'user',
    userId,
    `${userName} kullanıcısı bir kurumdan diğerine taşındı`,
    {
      user_name: userName,
      from_institution_id: fromInstitutionId,
      to_institution_id: toInstitutionId,
    }
  );
};

export const logUserPasswordReset = async (userId, userName, newPassword) => {
  return logAdminActivity(
    'user_password_reset',
    'user',
    userId,
    `${userName} kullanıcısının şifresi sıfırlandı`,
    { user_name: userName }
  );
};

// Kurum işlemleri
export const logInstitutionCreate = async (institutionId, institutionName) => {
  return logAdminActivity(
    'institution_create',
    'institution',
    institutionId,
    `${institutionName} kurumu oluşturuldu`,
    { institution_name: institutionName }
  );
};

export const logInstitutionUpdate = async (institutionId, institutionName, changes) => {
  return logAdminActivity(
    'institution_update',
    'institution',
    institutionId,
    `${institutionName} kurumu güncellendi`,
    { institution_name: institutionName, changes }
  );
};

export const logInstitutionStatusChange = async (institutionId, institutionName, newStatus) => {
  return logAdminActivity(
    'institution_status_change',
    'institution',
    institutionId,
    `${institutionName} kurumunun durumu ${newStatus ? 'aktif' : 'pasif'} yapıldı`,
    { institution_name: institutionName, is_active: newStatus }
  );
};

export const logContractUpdate = async (institutionId, institutionName, contractData) => {
  return logAdminActivity(
    'contract_update',
    'institution',
    institutionId,
    `${institutionName} kurumunun sözleşmesi güncellendi`,
    { institution_name: institutionName, contract_data: contractData }
  );
};

// Toplu işlemler
export const logBulkAction = async (actionType, targetType, count, details = {}) => {
  return logAdminActivity(
    `bulk_${actionType}`,
    targetType,
    null,
    `${count} ${targetType} için toplu işlem yapıldı`,
    { count, ...details }
  );
};


