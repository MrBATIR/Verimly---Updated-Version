import { supabase } from './supabase';

// Mesaj gönder
export const sendMessage = async (receiverId, message) => {
  try {
    // Mevcut kullanıcının ID'sini al
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          sender_id: user.id,
          receiver_id: receiverId,
          content: message,
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Mesaj gönderme hatası:', error);
    return { success: false, error: error.message };
  }
};

// Mesajları al (öğrenci için)
export const getMessages = async () => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('getMessages - Kullanıcı oturumu bulunamadı');
      return { success: false, error: 'Kullanıcı oturumu bulunamadı' };
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('receiver_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Mesaj alma hatası:', error);
    return { success: false, error: error.message };
  }
};

// Okunmamış mesaj sayısını al
export const getUnreadMessageCount = async () => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('getUnreadMessageCount - Kullanıcı oturumu bulunamadı');
      return { success: false, count: 0 };
    }

    const { data, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('receiver_id', user.id)
      .eq('is_read', false);

    if (error) throw error;
    return { success: true, count: data?.length || 0 };
  } catch (error) {
    console.error('Okunmamış mesaj sayısı alma hatası:', error);
    return { success: false, count: 0 };
  }
};

// Mesajı okundu olarak işaretle
export const markMessageAsRead = async (messageId) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('markMessageAsRead - Kullanıcı oturumu bulunamadı');
      return { success: false, error: 'Kullanıcı oturumu bulunamadı' };
    }

    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('id', messageId)
      .eq('receiver_id', user.id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Mesaj okundu işaretleme hatası:', error);
    return { success: false, error: error.message };
  }
};

// Tüm mesajları okundu olarak işaretle
export const markAllMessagesAsRead = async () => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('markAllMessagesAsRead - Kullanıcı oturumu bulunamadı');
      return { success: false, error: 'Kullanıcı oturumu bulunamadı' };
    }

    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Tüm mesajları okundu işaretleme hatası:', error);
    return { success: false, error: error.message };
  }
};

// Öğretmen için gönderilen mesajları al
export const getSentMessages = async () => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('sender_id', (await supabase.auth.getUser()).data.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Gönderilen mesajları alma hatası:', error);
    return { success: false, error: error.message };
  }
};

// Mesaj sil
export const deleteMessage = async (messageId) => {
  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', (await supabase.auth.getUser()).data.user.id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Mesaj silme hatası:', error);
    return { success: false, error: error.message };
  }
};

// Öğrenciye gönderilen tüm mesajları sil
export const deleteAllMessagesToStudent = async (studentId) => {
  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('receiver_id', studentId)
      .eq('sender_id', (await supabase.auth.getUser()).data.user.id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Tüm mesajları silme hatası:', error);
    return { success: false, error: error.message };
  }
};