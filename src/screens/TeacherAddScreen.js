import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_COLORS, COLORS } from '../constants/theme';
import { SIZES, SHADOWS } from '../constants/theme';
import Container from '../components/Container';
import Card from '../components/Card';
import { supabase } from '../lib/supabase';

const TeacherAddScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentAvatars, setStudentAvatars] = useState({});
  
  // Öğrenci detay modal state'leri
  const [showStudentDetailModal, setShowStudentDetailModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [loadingStudentDetail, setLoadingStudentDetail] = useState(false);
  
  // Ayarlar modal state'i
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  // Ekran her odaklandığında öğrencileri yenile
  useFocusEffect(
    React.useCallback(() => {
      loadStudents();
    }, [])
  );

  // Real-time güncelleme için interval ekle (şimdilik kapatıldı)
  // useEffect(() => {
  //   // Her 10 saniyede bir öğrencileri kontrol et (loading gösterme)
  //   const interval = setInterval(() => {
  //     loadStudents(false); // Loading gösterme
  //   }, 10000);

  //   return () => clearInterval(interval);
  // }, []);

  const loadStudents = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      // Öğretmenin öğrencilerini yükle
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Öğretmenin öğrencilerini getir
      const teacherResult = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      const { data: students, error: studentsError } = await supabase
        .from('student_teachers')
        .select(`
          id,
          student_id
        `)
        .eq('teacher_id', teacherResult.data?.id)
        .eq('is_active', true)
        .in('approval_status', ['approved', 'rejected']); // Onaylanmış ve reddedilen kesme istekleri

      if (studentsError) {
        console.error('Öğrenciler yüklenirken hata:', studentsError);
        return;
      }

      const connectedStudentIds = students?.map(student => student.student_id) || [];
      
      // Öğrenci profil verilerini al
      const { data: studentProfiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, selected_avatar')
        .in('user_id', connectedStudentIds);

      if (profileError) {
        console.error('Öğrenci profilleri yüklenirken hata:', profileError);
        return;
      }

      // Avatar verilerini state'e kaydet
      const avatarMap = {};
      studentProfiles?.forEach(profile => {
        avatarMap[profile.user_id] = profile.selected_avatar;
      });
      
      setStudentAvatars(avatarMap);

      // Öğrenci verilerini formatla - gerçek bilgileri kullan
      const formattedStudents = [];
      
      for (const studentId of connectedStudentIds) {
        // user_profiles tablosundan gerçek bilgileri çek
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_id, name, email')
          .eq('user_id', studentId)
          .single();
        
        // students tablosundan sınıf bilgisini çek
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('grade')
          .eq('email', profile?.email || '')
          .single();
        
        if (!profileError && profile) {
          formattedStudents.push({
            id: studentId,
            name: profile.name,
            email: profile.email,
            class: studentData?.grade || 'Belirtilmemiş'
          });
        } else {
          // Profil bulunamazsa temel bilgileri kullan
          formattedStudents.push({
            id: studentId,
            name: 'Öğrenci',
            email: 'Bilinmeyen',
            class: 'Belirtilmemiş'
          });
        }
      }

      setStudents(formattedStudents);
      if (showLoading) {
        setLoading(false);
      }
    } catch (error) {
      console.error('Öğrenciler yüklenirken hata:', error);
      if (showLoading) {
        setLoading(false);
      }
    }
  };


  // Öğrenci detaylarını yükle
  const loadStudentDetail = async (student) => {
    setSelectedStudent(student);
    setLoadingStudentDetail(true);
    setShowStudentDetailModal(true);

    try {
      // Students tablosundan detaylı bilgileri çek
      const { data: studentData, error } = await supabase
        .from('students')
        .select('*')
        .eq('email', student.email)
        .single();

      if (error) {
        console.error('Öğrenci detayları yüklenirken hata:', error);
        // Hata durumunda da modal'ı göster ama sadece temel bilgilerle
        setStudentDetail({
          name: student.name,
          email: student.email,
          school: 'Belirtilmemiş',
          grade: student.class || 'Belirtilmemiş',
          phone: 'Belirtilmemiş',
          parent_name: 'Belirtilmemiş',
          parent_phone: 'Belirtilmemiş',
          address: null,
          notes: null
        });
        return;
      }

      // Eksik alanları varsayılan değerlerle doldur
      const completeStudentData = {
        name: studentData.name || student.name,
        email: studentData.email || student.email,
        school: studentData.school || 'Belirtilmemiş',
        grade: studentData.grade || student.class || 'Belirtilmemiş',
        phone: studentData.phone || 'Belirtilmemiş',
        parent_name: studentData.parent_name || 'Belirtilmemiş',
        parent_phone: studentData.parent_phone || 'Belirtilmemiş',
        address: studentData.address || null,
        notes: studentData.notes || null
      };

      setStudentDetail(completeStudentData);
    } catch (error) {
      console.error('Öğrenci detayları yüklenirken hata:', error);
      // Hata durumunda da modal'ı göster
      const fallbackData = {
        name: student.name,
        email: student.email,
        school: 'Belirtilmemiş',
        grade: student.class || 'Belirtilmemiş',
        phone: 'Belirtilmemiş',
        parent_name: 'Belirtilmemiş',
        parent_phone: 'Belirtilmemiş',
        address: null,
        notes: null
      };
      setStudentDetail(fallbackData);
    } finally {
      setLoadingStudentDetail(false);
    }
  };

  const handleViewStudent = (student) => {
    // Öğrenci detaylarını görüntüle
  };

  return (
    <Container>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Öğrenci Yönetimi</Text>
          <Text style={styles.subtitle}>Öğrencilerinizi görüntüleyin ve yönetin</Text>
        </View>


        {/* Students List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mevcut Öğrenciler</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
          ) : students.length > 0 ? (
            <View style={styles.studentsList}>
              {students.map((student) => (
                <TouchableOpacity 
                  key={student.id} 
                  onPress={() => loadStudentDetail(student)}
                  style={styles.studentCardWrapper}
                >
                  <Card style={styles.studentCard}>
                    <View style={styles.studentInfo}>
                      <View style={styles.studentAvatar}>
                        <Text style={styles.studentAvatarEmoji}>
                          {studentAvatars[student.id] || '👤'}
                        </Text>
                      </View>
                      <View style={styles.studentDetails}>
                        <Text style={styles.studentName}>{student.name}</Text>
                        <Text style={styles.studentEmail}>{student.email}</Text>
                        <Text style={styles.studentClass}>{student.class}</Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.removeButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          // Öğrenciyi kaldır
                        }}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>Henüz öğrenci yok</Text>
              <Text style={styles.emptySubtext}>Öğrenciler öğretmen kodunuzu kullanarak bağlanacak</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
          
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickActionButton}>
              <Ionicons name="download-outline" size={24} color={colors.primary} />
              <Text style={styles.quickActionText}>Rapor İndir</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.quickActionButton}>
              <Ionicons name="mail-outline" size={24} color={colors.success} />
              <Text style={styles.quickActionText}>Toplu E-posta</Text>
            </TouchableOpacity>
            
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => setShowSettingsModal(true)}
        >
          <Ionicons name="settings-outline" size={24} color={colors.warning} />
          <Text style={styles.quickActionText}>Öğrenci Ayarları</Text>
        </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Ayarlar Modal */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Öğrenci Ayarları</Text>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowSettingsModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.surface} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>🎯 Öğrenci Hedefleri</Text>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Günlük Hedef</Text>
                <Text style={styles.settingValue}>30 dakika</Text>
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Haftalık Hedef</Text>
                <Text style={styles.settingValue}>3 saat</Text>
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Aylık Hedef</Text>
                <Text style={styles.settingValue}>12 saat</Text>
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>📈 Rapor Ayarları</Text>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Rapor Sıklığı</Text>
                <Text style={styles.settingValue}>Haftalık</Text>
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Rapor Formatı</Text>
                <Text style={styles.settingValue}>PDF</Text>
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Otomatik Rapor</Text>
                <Text style={styles.settingValue}>Açık</Text>
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>⚡ Hızlı İşlemler</Text>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="download-outline" size={20} color={colors.primary} />
                <Text style={styles.actionButtonText}>Rapor İndir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="send-outline" size={20} color={colors.success} />
                <Text style={styles.actionButtonText}>Test Gönder</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Yeni Öğrenci Detay Modal */}
      <Modal
        visible={showStudentDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStudentDetailModal(false)}
      >
        <View style={styles.newModalOverlay}>
          <View style={styles.newModalContent}>
            {/* Header */}
            <View style={styles.newModalHeader}>
              <Text style={styles.newModalTitle}>Öğrenci Detayları</Text>
              <TouchableOpacity
                onPress={() => setShowStudentDetailModal(false)}
                style={styles.newCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView 
              style={styles.newModalBody} 
              contentContainerStyle={styles.newScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {loadingStudentDetail ? (
                <View style={styles.newLoadingContainer}>
                  <Text style={styles.newLoadingText}>Yükleniyor...</Text>
                </View>
              ) : studentDetail ? (
                <View style={styles.newDetailContainer}>
                  {/* Öğrenci Bilgileri */}
                  <View style={styles.newDetailSection}>
                    <Text style={styles.newSectionTitle}>👤 Öğrenci Bilgileri</Text>
                    
                    <View style={styles.newDetailCard}>
                      <View style={styles.newDetailRow}>
                        <Ionicons name="person-outline" size={20} color={colors.primary} />
                        <View style={styles.newDetailInfo}>
                          <Text style={styles.newDetailLabel}>Ad Soyad</Text>
                          <Text style={styles.newDetailValue}>{studentDetail.name || 'Belirtilmemiş'}</Text>
                        </View>
                      </View>
                      
                      <View style={styles.newDetailRow}>
                        <Ionicons name="mail-outline" size={20} color={colors.primary} />
                        <View style={styles.newDetailInfo}>
                          <Text style={styles.newDetailLabel}>E-posta</Text>
                          <Text style={styles.newDetailValue}>{studentDetail.email || 'Belirtilmemiş'}</Text>
                        </View>
                      </View>
                      
                      <View style={styles.newDetailRow}>
                        <Ionicons name="school-outline" size={20} color={colors.primary} />
                        <View style={styles.newDetailInfo}>
                          <Text style={styles.newDetailLabel}>Okul</Text>
                          <Text style={styles.newDetailValue}>{studentDetail.school || 'Belirtilmemiş'}</Text>
                        </View>
                      </View>
                      
                      <View style={styles.newDetailRow}>
                        <Ionicons name="book-outline" size={20} color={colors.primary} />
                        <View style={styles.newDetailInfo}>
                          <Text style={styles.newDetailLabel}>Sınıf</Text>
                          <Text style={styles.newDetailValue}>{studentDetail.grade || 'Belirtilmemiş'}</Text>
                        </View>
                      </View>
                      
                      <View style={styles.newDetailRow}>
                        <Ionicons name="call-outline" size={20} color={colors.primary} />
                        <View style={styles.newDetailInfo}>
                          <Text style={styles.newDetailLabel}>Telefon</Text>
                          <Text style={styles.newDetailValue}>{studentDetail.phone || 'Belirtilmemiş'}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Veli Bilgileri */}
                  <View style={styles.newDetailSection}>
                    <Text style={styles.newSectionTitle}>👨‍👩‍👧‍👦 Veli Bilgileri</Text>
                    
                    <View style={styles.newDetailCard}>
                      <View style={styles.newDetailRow}>
                        <Ionicons name="person-outline" size={20} color={colors.primary} />
                        <View style={styles.newDetailInfo}>
                          <Text style={styles.newDetailLabel}>Veli Adı</Text>
                          <Text style={styles.newDetailValue}>{studentDetail.parent_name || 'Belirtilmemiş'}</Text>
                        </View>
                      </View>
                      
                      <View style={styles.newDetailRow}>
                        <Ionicons name="call-outline" size={20} color={colors.primary} />
                        <View style={styles.newDetailInfo}>
                          <Text style={styles.newDetailLabel}>Veli Telefonu</Text>
                          <Text style={styles.newDetailValue}>{studentDetail.parent_phone || 'Belirtilmemiş'}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Adres Bilgileri */}
                  {studentDetail.address && (
                    <View style={styles.newDetailSection}>
                      <Text style={styles.newSectionTitle}>📍 Adres Bilgileri</Text>
                      
                      <View style={styles.newDetailCard}>
                        <View style={styles.newDetailRow}>
                          <Ionicons name="location-outline" size={20} color={colors.primary} />
                          <View style={styles.newDetailInfo}>
                            <Text style={styles.newDetailLabel}>Adres</Text>
                            <Text style={styles.newDetailValue}>{studentDetail.address}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Notlar */}
                  {studentDetail.notes && (
                    <View style={styles.newDetailSection}>
                      <Text style={styles.newSectionTitle}>📝 Notlar</Text>
                      
                      <View style={styles.newDetailCard}>
                        <Text style={styles.newNotesText}>{studentDetail.notes}</Text>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.newEmptyState}>
                  <Text style={styles.newEmptyText}>Öğrenci detayları yüklenemedi</Text>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.newModalFooter}>
              <TouchableOpacity
                style={styles.newCloseModalButton}
                onPress={() => setShowStudentDetailModal(false)}
              >
                <Text style={styles.newCloseModalButtonText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </Container>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 100, // Alt boşluk ekle
    flexGrow: 1, // İçerik yeterince uzun değilse bile scroll yapabilir
  },
  header: {
    padding: SIZES.padding,
    alignItems: 'center',
  },
  title: {
    fontSize: SIZES.h2,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
  },
  section: {
    padding: SIZES.padding,
  },
  sectionTitle: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
  studentsList: {
    gap: 0,
  },
  studentCard: {
    padding: 8,
    marginBottom: 0,
    borderRadius: 4,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  studentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarEmoji: {
    fontSize: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  loadingText: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 0,
  },
  studentEmail: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 0,
  },
  studentClass: {
    fontSize: 10,
    color: colors.textLight,
  },
  removeButton: {
    backgroundColor: colors.error + '10',
    padding: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
  },
  emptyState: {
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  emptyText: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: SIZES.small,
    color: colors.textLight,
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionText: {
    fontSize: SIZES.small,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  // Öğrenci kart wrapper
  studentCardWrapper: {
    marginBottom: 12,
  },
  // Modal stilleri
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '90%',
    ...SHADOWS.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
    padding: 20,
    maxHeight: '80%',
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  closeModalButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  // Detay bölümleri
  detailSection: {
    marginBottom: 24,
  },
  detailCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  detailRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    gap: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    width: 100,
  },
  detailValue: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  notesText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  // Ayarlar modal stilleri
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  settingsSection: {
    marginBottom: 24,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  // Yeni Modal Stilleri
  newModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  newModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    height: '95%',
    maxHeight: '95%',
    ...SHADOWS.large,
  },
  newModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  newModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  newCloseButton: {
    padding: 4,
  },
  newModalBody: {
    flex: 1,
    padding: 12,
    paddingBottom: 40,
    minHeight: 400,
  },
  newScrollContent: {
    paddingBottom: 50,
    flexGrow: 1,
  },
  newModalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  newLoadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  newLoadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  newDetailContainer: {
    gap: 8,
    paddingBottom: 20,
  },
  newDetailSection: {
    gap: 6,
  },
  newSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  newDetailCard: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    minHeight: 80,
  },
  newDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 24,
    paddingVertical: 2,
  },
  newDetailInfo: {
    flex: 1,
  },
  newDetailLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 1,
  },
  newDetailValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  newNotesText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  newEmptyState: {
    alignItems: 'center',
    padding: 40,
  },
  newEmptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  newCloseModalButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  newCloseModalButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TeacherAddScreen;
