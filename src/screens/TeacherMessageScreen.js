import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Container, Button, Input, Card } from '../components';
import * as teacherApi from '../lib/teacherApi';
import { sendMessage, getSentMessages, deleteMessage, deleteAllMessagesToStudent } from '../lib/messageApi';
import { supabase } from '../lib/supabase';
import { getGuidanceTeacherStudents, sendGuidanceTeacherMessage } from '../lib/adminApi';

const TeacherMessageScreen = () => {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [message, setMessage] = useState('');
  const [sentMessages, setSentMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState({}); // student_id -> expanded state
  const [institutionId, setInstitutionId] = useState(null); // Rehber öğretmen için kurum ID'si
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [isGuidanceTeacher, setIsGuidanceTeacher] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Toast state'leri
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success'); // success, error, info
  const toastAnim = useState(new Animated.Value(0))[0];
  
  // Onay modal state'leri
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmButtonText, setConfirmButtonText] = useState('Onayla');

  useEffect(() => {
    loadStudents();
    loadSentMessages();
  }, []);

  // Sayfa her odaklandığında state'leri temizle
  useFocusEffect(
    React.useCallback(() => {
      // Açık öğrenci kartlarını kapat
      setExpandedStudents({});
      // Seçili öğrenciyi temizle
      setSelectedStudent(null);
      // Mesaj input'unu temizle
      setMessage('');
      // Yeni mesaj gösterme durumunu kapat
      setShowNewMessage(false);
    }, [])
  );

  // Toast notification fonksiyonu
  const showToastNotification = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowToast(false);
    });
  };

  // Onay modal'ını aç
  const showConfirmDialog = (title, message, action, buttonText = 'Onayla') => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setConfirmButtonText(buttonText);
    setShowConfirmModal(true);
  };

  // Onay modal'ını kapat
  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setConfirmAction(null);
    setConfirmTitle('');
    setConfirmMessage('');
    setConfirmButtonText('Onayla');
  };

  // Onay verildiğinde çalışacak fonksiyon
  const handleConfirm = async () => {
    if (confirmAction) {
      await confirmAction();
    }
    closeConfirmModal();
  };

  const loadStudents = async () => {
    setLoading(true);
    try {
      // Öğretmenin öğrencilerini yükle
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Öğretmen ID'sini al
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (teacherError || !teacherData) {
        console.error('Öğretmen bulunamadı:', teacherError);
        Alert.alert('Hata', 'Öğretmen bilgisi bulunamadı');
        setLoading(false);
        return;
      }

      let studentIds = [];
      let isGuidanceTeacherLocal = false;

      // Rehber öğretmen kontrolü - Kurumunun rehber öğretmeni mi?
      const { data: institutionData, error: institutionError } = await supabase
        .from('institutions')
        .select('id, name')
        .eq('guidance_teacher_id', teacherData.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!institutionError && institutionData) {
        isGuidanceTeacherLocal = true;
        setIsGuidanceTeacher(true);
        setInstitutionId(institutionData.id); // Kurum ID'sini sakla
        
        // Rehber öğretmen - Edge Function ile kurumundaki tüm öğrencileri göster
        const result = await getGuidanceTeacherStudents(institutionData.id);
        
        if (result.error) {
          console.error('Rehber öğretmen öğrencileri yüklenirken hata:', result.error);
          Alert.alert('Hata', result.error.message || 'Öğrenciler yüklenemedi');
          setLoading(false);
          return;
        }

        // Edge Function'dan gelen öğrenci listesini formatla
        // Edge Function { data: [...], error: null } formatında döndürüyor
        // Supabase Functions bunu parse edip result.data olarak döndürüyor
        const studentsData = result.data?.data || result.data || [];
        const studentList = studentsData.map(student => ({
          id: student.user_id, // Mesaj göndermek için user_id kullanılmalı
          student_id: student.id, // students.id'yi saklamak için
          name: student.name || `Öğrenci ${student.id?.substring(0, 8) || ''}`,
          email: student.email || '',
          avatar: null // Edge Function'dan avatar bilgisi gelmiyor, gerekirse eklenebilir
        }));

        // Alfabetik sıralama (isme göre)
        studentList.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB, 'tr');
        });

        setStudents(studentList);
        setLoading(false);
        return;
      } else {
        setIsGuidanceTeacher(false);
        // Normal öğretmen - Bağlı öğrencileri al
        const { data: students, error: studentsError } = await supabase
          .from('student_teachers')
          .select('student_id')
          .eq('teacher_id', teacherData.id)
          .eq('is_active', true)
          .in('approval_status', ['approved', 'rejected']); // Onaylanmış ve reddedilen kesme istekleri

        if (studentsError) {
          console.error('Öğrenciler yüklenirken hata:', studentsError);
          Alert.alert('Hata', 'Öğrenciler yüklenemedi');
          setLoading(false);
          return;
        }

        studentIds = students?.map(student => student.student_id) || [];
      }

      if (studentIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }
      
      // Normal öğretmen için öğrenci profil verilerini al
      const { data: studentProfiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, selected_avatar, name, email')
        .in('user_id', studentIds);

      if (profileError) {
        console.error('Öğrenci profilleri yüklenirken hata:', profileError);
        Alert.alert('Hata', 'Öğrenci profilleri yüklenemedi');
        setLoading(false);
        return;
      }

      // Öğrenci listesini oluştur
      const studentList = studentProfiles?.map(profile => ({
        id: profile.user_id,
        name: profile.name || `Öğrenci ${profile.user_id.substring(0, 8)}`,
        email: profile.email || '',
        avatar: profile.selected_avatar
      })) || [];

      // Alfabetik sıralama (isme göre)
      studentList.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB, 'tr');
      });

      setStudents(studentList);
    } catch (error) {
      console.error('Öğrenciler yüklenirken hata:', error);
      Alert.alert('Hata', 'Öğrenciler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const loadSentMessages = async () => {
    try {
      const result = await getSentMessages();
      if (result.success) {
        setSentMessages(result.data);
      }
    } catch (error) {
      console.error('Gönderilen mesajlar yüklenemedi:', error);
    }
  };

  // Mesajları öğrenciye göre gruplandır
  const groupMessagesByStudent = (messages) => {
    const groups = {};
    
    messages.forEach(msg => {
      if (!groups[msg.receiver_id]) {
        groups[msg.receiver_id] = [];
      }
      groups[msg.receiver_id].push(msg);
    });
    
    return groups;
  };

  // Öğrenci için mesaj sayısını al
  const getStudentMessageCount = (studentId) => {
    return sentMessages.filter(msg => msg.receiver_id === studentId).length;
  };

  // Öğrenci için en son mesajı al
  const getStudentLastMessage = (studentId) => {
    const studentMessages = sentMessages.filter(msg => msg.receiver_id === studentId);
    return studentMessages.length > 0 ? studentMessages[0] : null;
  };

  const handleSendMessage = async (student) => {
    if (!student || !message.trim()) {
      showToastNotification('Lütfen öğrenci seçin ve mesaj yazın', 'error');
      return;
    }

    setSending(true);
    try {
      let result;
      
      // Rehber öğretmen ise Edge Function kullan
      if (isGuidanceTeacher && institutionId) {
        // student.id artık user_id, student.student_id ise students.id
        const studentIdForMessage = student.student_id || student.id;
        result = await sendGuidanceTeacherMessage(studentIdForMessage, institutionId, message.trim());
        
        if (result.error) {
          showToastNotification(`❌ ${result.error.message || 'Mesaj gönderilemedi'}`, 'error');
          setSending(false);
          return;
        }
      } else {
        // Normal öğretmen - normal sendMessage kullan
        result = await sendMessage(student.id, message.trim());
      }

      if (result.success || result.data) {
        showToastNotification('✅ Mesaj başarıyla gönderildi', 'success');
        setMessage('');
        setSelectedStudent(null);
        setShowNewMessage(false);
        loadSentMessages(); // Gönderilen mesajları yenile
      } else {
        showToastNotification(`❌ ${result.error || 'Mesaj gönderilemedi'}`, 'error');
      }
    } catch (error) {
      console.error('Mesaj gönderme hatası:', error);
      showToastNotification('❌ Mesaj gönderilemedi', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    // Onay modal'ını aç
    showConfirmDialog(
      'Mesajı Sil',
      'Bu mesajı silmek istediğinizden emin misiniz? Mesaj öğrenciden de silinecektir.',
      async () => {
        try {
          const result = await deleteMessage(messageId);
          if (result.success) {
            showToastNotification('🗑️ Mesaj silindi', 'success');
            loadSentMessages(); // Mesajları yenile
          } else {
            showToastNotification(`❌ ${result.error || 'Mesaj silinemedi'}`, 'error');
          }
        } catch (error) {
          showToastNotification('❌ Mesaj silinemedi', 'error');
        }
      },
      'Sil'
    );
  };

  const handleDeleteAllMessages = async (studentId, studentName) => {
    const messageCount = getStudentMessageCount(studentId);
    
    if (messageCount === 0) {
      showToastNotification('ℹ️ Bu öğrenciye gönderilen mesaj bulunmuyor', 'info');
      return;
    }

    // Onay modal'ını aç
    showConfirmDialog(
      'Tüm Mesajları Sil',
      `${studentName} öğrencisine gönderilen ${messageCount} mesajı silmek istediğinizden emin misiniz? Tüm mesajlar öğrenciden de silinecektir.`,
      async () => {
        try {
          const result = await deleteAllMessagesToStudent(studentId);
          if (result.success) {
            showToastNotification(`🗑️ ${messageCount} mesaj silindi`, 'success');
            loadSentMessages(); // Mesajları yenile
          } else {
            showToastNotification(`❌ ${result.error || 'Mesajlar silinemedi'}`, 'error');
          }
        } catch (error) {
          showToastNotification('❌ Mesajlar silinemedi', 'error');
        }
      }
    );
  };

  // Öğrenci kartı render et (modern tasarım)
  const renderStudentCard = (student) => {
    const messageCount = getStudentMessageCount(student.id);
    const lastMessage = getStudentLastMessage(student.id);
    const isExpanded = expandedStudents[student.id] || false;
    
    return (
      <View key={student.id} style={styles.studentCard}>
        <TouchableOpacity 
          style={styles.studentCardHeader}
          onPress={() => {
            setExpandedStudents(prev => ({
              ...prev,
              [student.id]: !prev[student.id]
            }));
          }}
        >
          <View style={styles.studentCardContent}>
            <View style={styles.studentAvatar}>
              <Text style={styles.studentAvatarText}>
                {student.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{student.name}</Text>
              <Text style={styles.studentSubtitle}>
                {messageCount} mesaj • {lastMessage ? 
                  new Date(lastMessage.created_at).toLocaleDateString('tr-TR') : 
                  'Henüz mesaj yok'
                }
              </Text>
            </View>
            <View style={styles.studentArrow}>
              <Text style={styles.expandIcon}>
                {isExpanded ? '▼' : '▶'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.studentMessagesContent}>
            {/* Yeni mesaj gönderme */}
            <View style={styles.newMessageSection}>
              <Text style={styles.newMessageTitle}>Yeni Mesaj Gönder</Text>
              <Input
                placeholder="Mesajınızı yazın..."
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={3}
                style={styles.messageInput}
              />
              <Button
                title={sending ? "Gönderiliyor..." : "Mesaj Gönder"}
                onPress={() => handleSendMessage(student)}
                disabled={sending || !message.trim()}
                style={styles.sendButton}
              />
            </View>
            
            {/* Öğrencinin mesajları */}
            {messageCount > 0 && (
              <View style={styles.messagesSection}>
                <View style={styles.messagesHeader}>
                  <Text style={styles.messagesTitle}>Gönderilen Mesajlar</Text>
                  <TouchableOpacity 
                    style={styles.deleteAllButton}
                    onPress={() => handleDeleteAllMessages(student.id, student.name)}
                  >
                    <Ionicons name="trash" size={16} color="#ff4444" />
                    <Text style={styles.deleteAllText}>Tümünü Sil</Text>
                  </TouchableOpacity>
                </View>
                {sentMessages
                  .filter(msg => msg.receiver_id === student.id)
                  .map(msg => (
                    <View key={msg.id} style={styles.messageItem}>
                      <View style={styles.messageBubble}>
                        <Text style={styles.messageText}>{msg.content}</Text>
                        <Text style={styles.messageTime}>
                          {new Date(msg.created_at).toLocaleString('tr-TR')}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.deleteButton}
                        onPress={() => handleDeleteMessage(msg.id)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#ff4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };


  if (loading) {
    return (
      <Container>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Öğrenciler yükleniyor...</Text>
        </View>
      </Container>
    );
  }

  // Filtrelenmiş öğrenci listesi
  const filteredStudents = students.filter(student => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      student.name?.toLowerCase().includes(query) ||
      student.email?.toLowerCase().includes(query)
    );
  });

  return (
    <Container>
      <View style={styles.container}>
        <Text style={styles.title}>Öğrencilere Mesaj Gönder</Text>
        
        {/* Arama Input */}
        {students.length > 0 && (
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Öğrenci adı ile ara..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearSearchButton}
                onPress={() => setSearchQuery('')}
              >
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        )}
        
        <FlatList
          data={filteredStudents}
          renderItem={({ item }) => renderStudentCard(item)}
          keyExtractor={(item) => item.id}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              {searchQuery.trim().length > 0 ? (
                <>
                  <Ionicons name="search-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>Arama sonucu bulunamadı</Text>
                  <Text style={styles.emptySubtext}>
                    "{searchQuery}" için öğrenci bulunamadı
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyText}>Henüz öğrenci yok</Text>
                  <Text style={styles.emptySubtext}>
                    {isGuidanceTeacher 
                      ? 'Kurumda öğrenci bulunmamaktadır'
                      : 'Öğrencilerinizle bağlantı kurduktan sonra mesaj gönderebilirsiniz'
                    }
                  </Text>
                </>
              )}
            </View>
          )}
        />
      </View>

      {/* Toast Notification */}
      {showToast && (
        <Animated.View 
          style={[
            styles.toastContainer,
            {
              opacity: toastAnim,
              transform: [{
                translateY: toastAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [100, 0],
                })
              }]
            }
          ]}
        >
          <View style={[
            styles.toast,
            { backgroundColor: toastType === 'success' ? '#28a745' : toastType === 'error' ? '#dc3545' : '#17a2b8' }
          ]}>
            <Ionicons 
              name={toastType === 'success' ? 'checkmark-circle' : toastType === 'error' ? 'close-circle' : 'information-circle'} 
              size={20} 
              color="#fff" 
            />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </Animated.View>
      )}

      {/* Onay Modal */}
      {showConfirmModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmHeader}>
              <Ionicons name="warning" size={24} color="#ff6b6b" />
              <Text style={styles.confirmTitle}>{confirmTitle}</Text>
            </View>
            
            <View style={styles.confirmContent}>
              <Text style={styles.confirmMessage}>{confirmMessage}</Text>
            </View>
            
            <View style={styles.confirmActions}>
              <TouchableOpacity 
                style={styles.confirmCancelButton}
                onPress={closeConfirmModal}
              >
                <Text style={styles.confirmCancelText}>İptal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.confirmDeleteButton}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmDeleteText}>{confirmButtonText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 4,
  },
  clearSearchButton: {
    marginLeft: 8,
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 50, // Nav bar için ekstra padding
  },
  // Öğrenci kartı stilleri
  studentCard: {
    marginBottom: 6,
  },
  studentCardHeader: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#e0e0e0',
  },
  studentCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  studentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  studentAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  studentSubtitle: {
    fontSize: 11,
    color: '#666',
  },
  studentArrow: {
    padding: 4,
  },
  expandIcon: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  // Mesaj içeriği stilleri
  studentMessagesContent: {
    backgroundColor: '#f8f9fa',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    padding: 12,
    paddingBottom: 30, // Nav bar için ekstra padding
  },
  newMessageSection: {
    marginBottom: 16,
  },
  newMessageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  messageInput: {
    marginBottom: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: '#28a745',
  },
  messagesSection: {
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    paddingTop: 16,
  },
  messagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  messagesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  deleteAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  deleteAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff4444',
    marginLeft: 4,
  },
  messageItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  messageBubble: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderTopLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  // Boş durum stilleri
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    maxWidth: 250,
    lineHeight: 20,
  },
  // Toast Notification Styles
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  toastText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  // Onay Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  confirmModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  confirmContent: {
    padding: 20,
  },
  confirmMessage: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  confirmActions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    gap: 12,
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  confirmCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
  },
  confirmDeleteButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#dc3545',
    alignItems: 'center',
  },
  confirmDeleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default TeacherMessageScreen;
