import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_COLORS, COLORS } from '../constants/theme';
import { SIZES, SHADOWS } from '../constants/theme';
import Container from '../components/Container';
import Card from '../components/Card';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';
import { getAdminStats, getAdminInstitutionDetails, getAdminInstitutions, moveAdminUserToInstitution, resetAdminUserPassword, deleteAdminUser } from '../lib/adminApi';
// ⚠️ supabaseAdmin artık kullanılmıyor - Edge Functions kullanılmalı
import AdminInstitutionsScreen from './AdminInstitutionsScreen';
import AdminIndividualUsersScreen from './AdminIndividualUsersScreen';
import AdminUserSearchScreen from './AdminUserSearchScreen';
import AdminStudyAnalyticsScreen from './AdminStudyAnalyticsScreen';
import AdminTimeStatsScreen from './AdminTimeStatsScreen';

const AdminDashboardScreen = ({ navigation: propNavigation }) => {
  // useNavigation hook'u ile root navigator'a eriş
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const [stats, setStats] = useState({
    totalInstitutions: 0,
    activeInstitutions: 0,
    totalTeachers: 0,
    totalStudents: 0,
    individualUsers: 0,
    totalConnections: 0,
  });
  const [institutionStats, setInstitutionStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInstitutionDetails, setShowInstitutionDetails] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [institutionTeachers, setInstitutionTeachers] = useState([]);
  const [institutionStudents, setInstitutionStudents] = useState([]);
  const [loadingInstitutionDetails, setLoadingInstitutionDetails] = useState(false);
  const [showMoveUserModal, setShowMoveUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [availableInstitutions, setAvailableInstitutions] = useState([]);
  const [loadingMoveUser, setLoadingMoveUser] = useState(false);
  const [showInstitutionManagement, setShowInstitutionManagement] = useState(false);
  const [showIndividualUsers, setShowIndividualUsers] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showStudyAnalytics, setShowStudyAnalytics] = useState(false);
  const [showTimeStats, setShowTimeStats] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const result = await getAdminStats();

      if (result.error) {
        throw new Error(result.error?.message || result.error || 'İstatistikler alınamadı');
      }

      if (result.data) {
        // Genel istatistikleri set et
        setStats(result.data.general || {
          totalInstitutions: 0,
          activeInstitutions: 0,
          totalTeachers: 0,
          totalStudents: 0,
          individualUsers: 0,
          totalConnections: 0,
        });

        // Kurum bazlı detaylı istatistikleri set et
        setInstitutionStats(result.data.institutionStats || []);
      }
    } catch (error) {
      console.error('İstatistikler yüklenirken hata:', error);
      Alert.alert('Hata', `İstatistikler yüklenemedi: ${error?.message || 'Bilinmeyen hata'}`);
    } finally {
      setLoading(false);
    }
  };

  // loadInstitutionStats artık loadStats içinde Edge Function'dan alınıyor
  // Bu fonksiyon artık kullanılmıyor, geriye uyumluluk için kaldırıldı

  const handleLogout = async () => {
    Alert.alert(
      'Çıkış Yap',
      'Admin panelinden çıkmak istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Çıkış Yap', 
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            navigation.navigate('Auth', { screen: 'AdminLogin' });
          }
        },
      ]
    );
  };

  // Kurum detaylarını yükle (öğretmenler ve öğrenciler)
  const loadInstitutionDetails = async (institutionId) => {
    if (!institutionId) {
      console.error('loadInstitutionDetails: institutionId is null or undefined');
      Alert.alert('Hata', 'Geçersiz kurum ID');
      return;
    }
    setLoadingInstitutionDetails(true);
    try {
      const result = await getAdminInstitutionDetails(institutionId);

      if (result.error) {
        throw new Error(result.error?.message || result.error || 'Kurum detayları alınamadı');
      }

      if (result.data) {
        setInstitutionTeachers(result.data.teachers || []);
        setInstitutionStudents(result.data.students || []);
      }
    } catch (error) {
      console.error('Kurum detayları yüklenirken hata:', error);
      Alert.alert('Hata', `Kurum detayları yüklenemedi: ${error?.message || 'Bilinmeyen hata'}`);
    } finally {
      setLoadingInstitutionDetails(false);
    }
  };

  const handleInstitutionClick = async (institution) => {
    setSelectedInstitution(institution);
    setShowInstitutionDetails(true);
    await loadInstitutionDetails(institution.id);
  };

  // Kurumları yükle (taşıma modalı için)
  const loadAvailableInstitutions = async () => {
    try {
      const result = await getAdminInstitutions();

      if (result.error) {
        console.error('Kurumlar yüklenirken hata:', result.error);
        return;
      }

      setAvailableInstitutions(result.data || []);
    } catch (error) {
      console.error('Kurumlar yüklenirken hata:', error);
    }
  };

  // Kullanıcıyı başka kuruma taşı
  const moveUserToInstitution = async (targetInstitutionId) => {
    if (!selectedUser || !targetInstitutionId) return;

    setLoadingMoveUser(true);
    try {
      const userId = selectedUser.user_id || selectedUser.id;
      if (!userId) {
        Alert.alert('Hata', 'Kullanıcı ID bulunamadı');
        return;
      }

      const result = await moveAdminUserToInstitution(userId, targetInstitutionId);

      if (result.error) {
        throw new Error(result.error?.message || result.error || 'Kullanıcı taşınamadı');
      }

      // Başarılı mesajı
      const targetInstitution = availableInstitutions.find(inst => inst.id === targetInstitutionId);
      const targetInstitutionName = result.data?.target_institution_name || targetInstitution?.name || 'Kurum';
      
      Alert.alert(
        'Başarılı!',
        `${selectedUser.name} başarıyla "${targetInstitutionName}" kurumuna taşındı.`,
        [{ text: 'Tamam' }]
      );

      // Modal'ları kapat ve listeyi yenile
      setShowMoveUserModal(false);
      setSelectedUser(null);
      
      // Kurum detaylarını yeniden yükle
      if (selectedInstitution) {
        // Kurum detaylarını yükle (liste için)
        await loadInstitutionDetails(selectedInstitution.id);
      }
      
      // Ana dashboard istatistiklerini yenile
      await loadStats();
    } catch (error) {
      console.error('Kullanıcı taşıma hatası:', error);
      Alert.alert('Hata', `Kullanıcı taşınamadı: ${error?.message || 'Bilinmeyen hata'}`);
    } finally {
      setLoadingMoveUser(false);
    }
  };

  const openMoveUserModal = async (user) => {
    setSelectedUser(user);
    await loadAvailableInstitutions();
    setShowMoveUserModal(true);
  };

  // Şifre sıfırlama
  const resetUserPassword = async (user, userEmail) => {
    const userId = user.user_id || user.id;
    if (!userId) {
      Alert.alert('Hata', 'Kullanıcı ID bulunamadı');
      return;
    }

    Alert.alert(
      'Şifre Sıfırla',
      `${user.name} kullanıcısının şifresini sıfırlamak istediğinizden emin misiniz?\n\nE-posta: ${userEmail}\nYeni şifre: user123`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await resetAdminUserPassword(userId);

              if (result.error) {
                throw new Error(result.error?.message || result.error || 'Şifre sıfırlanamadı');
              }

              const email = result.data?.email || userEmail || 'Bilinmiyor';
              Alert.alert(
                'Başarılı!', 
                `${user.name} kullanıcısının şifresi sıfırlandı.\n\nE-posta: ${email}\nYeni şifre: user123\n\nBu şifreyi kullanıcıya iletin.`
              );
            } catch (error) {
              console.error('Şifre sıfırlama hatası:', error);
              Alert.alert('Hata', `Şifre sıfırlanırken bir hata oluştu: ${error?.message || 'Bilinmeyen hata'}`);
            }
          }
        }
      ]
    );
  };

  // Kullanıcı silme
  const deleteUser = (user) => {
    Alert.alert(
      'Kullanıcı Sil',
      `${user.name} kullanıcısını kurumdan kaldırmak istediğinizden emin misiniz?\n\nBu işlem geri alınamaz!`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              const institutionId = selectedInstitution?.id;
              const targetUserId = user?.user_id || user?.id;
              
              if (!targetUserId) {
                Alert.alert('Hata', 'Kullanıcı ID bulunamadı');
                return;
              }

              const result = await deleteAdminUser(targetUserId, institutionId);

              if (result.error) {
                throw new Error(result.error?.message || result.error || 'Kullanıcı silinemedi');
              }

              Alert.alert('Başarılı!', `${user.name} kurumdan kaldırıldı.`);
              
              // Listeyi yenile
              if (selectedInstitution) {
                // Kurum detaylarını yükle (liste için)
                await loadInstitutionDetails(selectedInstitution.id);
              }
              
              // Ana dashboard istatistiklerini yenile
              await loadStats();
            } catch (error) {
              console.error('Kullanıcı silme hatası:', error);
              Alert.alert('Hata', `Kullanıcı silinirken bir hata oluştu: ${error?.message || 'Bilinmeyen hata'}`);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <Container>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Admin Paneli</Text>
            <Text style={styles.subtitle}>Sistem Yönetimi</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={colors.error} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Genel İstatistikler */}
          <View style={styles.statsContainer}>
            <Text style={styles.sectionTitle}>📊 Sistem Genel Bakış</Text>
            <View style={styles.statsGrid}>
              <Card style={styles.statCard}>
                <Ionicons name="business" size={32} color={colors.warning} />
                <Text style={styles.statNumber}>{stats.totalInstitutions}</Text>
                <Text style={styles.statLabel}>Toplam Kurum</Text>
                <Text style={styles.statSubLabel}>({stats.activeInstitutions} aktif)</Text>
              </Card>
              
              <Card style={styles.statCard}>
                <Ionicons name="people" size={32} color={colors.primary} />
                <Text style={styles.statNumber}>{stats.totalTeachers}</Text>
                <Text style={styles.statLabel}>Toplam Öğretmen</Text>
              </Card>
              
              <Card style={styles.statCard}>
                <Ionicons name="school" size={32} color={colors.success} />
                <Text style={styles.statNumber}>{stats.totalStudents}</Text>
                <Text style={styles.statLabel}>Toplam Öğrenci</Text>
              </Card>
              
              <Card style={styles.statCard}>
                <Ionicons name="person-add" size={32} color={colors.info} />
                <Text style={styles.statNumber}>{stats.individualUsers}</Text>
                <Text style={styles.statLabel}>Bireysel Kullanıcı</Text>
              </Card>
            </View>
          </View>

          {/* Kurum Detayları */}
          <View style={styles.institutionContainer}>
            <Text style={styles.sectionTitle}>🏢 Kurum Detayları</Text>
            {institutionStats.map((institution) => (
              <TouchableOpacity 
                key={institution.id} 
                onPress={() => handleInstitutionClick(institution)}
                activeOpacity={0.7}
              >
                <Card style={styles.institutionCard}>
                  <View style={styles.institutionHeader}>
                    <View style={styles.institutionInfo}>
                      <View style={styles.institutionNameRow}>
                        <Text style={styles.institutionName}>{institution.name}</Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                      </View>
                      <View style={styles.institutionStatus}>
                        <View style={[
                          styles.statusBadge,
                          { backgroundColor: institution.is_active ? colors.success + '20' : colors.error + '20' }
                        ]}>
                          <Text style={[
                            styles.statusText,
                            { color: institution.is_active ? colors.success : colors.error }
                          ]}>
                            {institution.is_active ? 'Aktif' : 'Pasif'}
                          </Text>
                        </View>
                        {institution.is_premium && (
                          <View style={[styles.premiumBadge, { backgroundColor: colors.warning + '20' }]}>
                            <Text style={[styles.premiumText, { color: colors.warning }]}>Premium</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={styles.institutionStats}>
                    <View style={styles.statItem}>
                      <Ionicons name="people" size={16} color={colors.primary} />
                      <Text style={styles.statItemText}>{institution.teacher_count} Öğretmen</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="school" size={16} color={colors.success} />
                      <Text style={styles.statItemText}>{institution.student_count} Öğrenci</Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>

          {/* Raporlar ve Analitikler */}
          <View style={styles.menuContainer}>
            <Text style={styles.sectionTitle}>📊 Raporlar ve Analitikler</Text>
            
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowStudyAnalytics(true)}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="bar-chart" size={24} color={colors.success} />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Çalışma Analitikleri</Text>
                  <Text style={styles.menuItemSubtitle}>Ders bazlı raporlar ve istatistikler</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowTimeStats(true)}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="trending-up" size={24} color={colors.primary} />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Zaman Bazlı İstatistikler</Text>
                  <Text style={styles.menuItemSubtitle}>Büyüme trendleri ve zaman analizleri</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Yönetim Menüleri */}
          <View style={styles.menuContainer}>
            <Text style={styles.sectionTitle}>⚙️ Yönetim</Text>
            
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowInstitutionManagement(true)}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="business" size={24} color={colors.warning} />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Kurum Yönetimi</Text>
                  <Text style={styles.menuItemSubtitle}>Kurum ekle, düzenle, sözleşme takibi</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowIndividualUsers(true)}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="person-add" size={24} color={colors.info} />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Bireysel Kullanıcılar</Text>
                  <Text style={styles.menuItemSubtitle}>Play Store/App Store kullanıcıları</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowUserSearch(true)}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="search" size={24} color={colors.primary} />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Kullanıcı Arama</Text>
                  <Text style={styles.menuItemSubtitle}>Gelişmiş arama ve filtreleme</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Kurum Detayları Modal */}
      <Modal
        visible={showInstitutionDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowInstitutionDetails(false);
          setSelectedInstitution(null);
          setInstitutionTeachers([]);
          setInstitutionStudents([]);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedInstitution?.name || 'Kurum Detayları'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowInstitutionDetails(false);
                  setSelectedInstitution(null);
                  setInstitutionTeachers([]);
                  setInstitutionStudents([]);
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              {/* Öğretmenler */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>
                  👨‍🏫 Öğretmenler ({institutionTeachers.length})
                </Text>
                {loadingInstitutionDetails ? (
                  <ActivityIndicator size="small" color={colors.primary} style={styles.loadingIndicator} />
                ) : institutionTeachers.length > 0 ? (
                  institutionTeachers.map((teacher) => (
                    <Card key={teacher.user_id} style={styles.userCard}>
                      <View style={styles.userCardHeader}>
                        <View style={styles.userCardInfo}>
                          <Text style={styles.userName}>{teacher.name}</Text>
                          <Text style={styles.userDetail}>📧 {teacher.email}</Text>
                          <Text style={styles.userDetail}>📚 {teacher.branch}</Text>
                          {teacher.phone && teacher.phone !== '-' && (
                            <Text style={styles.userDetail}>📞 {teacher.phone}</Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.userCardActions}>
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.warning + '20' }]}
                          onPress={() => resetUserPassword(teacher, teacher.email)}
                        >
                          <Ionicons name="key-outline" size={18} color={colors.warning} />
                          <Text style={[styles.actionButtonText, { color: colors.warning }]}>Şifre</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.info + '20' }]}
                          onPress={() => openMoveUserModal({ ...teacher, branch: teacher.branch })}
                        >
                          <Ionicons name="swap-horizontal-outline" size={18} color={colors.info} />
                          <Text style={[styles.actionButtonText, { color: colors.info }]}>Taşı</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
                          onPress={() => deleteUser({ ...teacher, branch: teacher.branch })}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                          <Text style={[styles.actionButtonText, { color: colors.error }]}>Sil</Text>
                        </TouchableOpacity>
                      </View>
                    </Card>
                  ))
                ) : (
                  <Text style={styles.emptyText}>Bu kurumda öğretmen bulunmuyor</Text>
                )}
              </View>

              {/* Öğrenciler */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>
                  🎓 Öğrenciler ({institutionStudents.length})
                </Text>
                {loadingInstitutionDetails ? (
                  <ActivityIndicator size="small" color={colors.primary} style={styles.loadingIndicator} />
                ) : institutionStudents.length > 0 ? (
                  institutionStudents.map((student) => (
                    <Card key={student.user_id} style={styles.userCard}>
                      <View style={styles.userCardHeader}>
                        <View style={styles.userCardInfo}>
                          <Text style={styles.userName}>{student.name}</Text>
                          <Text style={styles.userDetail}>📧 {student.email}</Text>
                          <Text style={styles.userDetail}>📚 Sınıf: {student.grade}</Text>
                          {student.phone && student.phone !== '-' && (
                            <Text style={styles.userDetail}>📞 {student.phone}</Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.userCardActions}>
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.warning + '20' }]}
                          onPress={() => resetUserPassword(student, student.email)}
                        >
                          <Ionicons name="key-outline" size={18} color={colors.warning} />
                          <Text style={[styles.actionButtonText, { color: colors.warning }]}>Şifre</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.info + '20' }]}
                          onPress={() => openMoveUserModal(student)}
                        >
                          <Ionicons name="swap-horizontal-outline" size={18} color={colors.info} />
                          <Text style={[styles.actionButtonText, { color: colors.info }]}>Taşı</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
                          onPress={() => deleteUser(student)}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                          <Text style={[styles.actionButtonText, { color: colors.error }]}>Sil</Text>
                        </TouchableOpacity>
                      </View>
                    </Card>
                  ))
                ) : (
                  <Text style={styles.emptyText}>Bu kurumda öğrenci bulunmuyor</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Kurum Değiştirme Modal */}
      <Modal
        visible={showMoveUserModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowMoveUserModal(false);
          setSelectedUser(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedUser?.name} - Kurum Değiştir
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowMoveUserModal(false);
                  setSelectedUser(null);
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              <Text style={styles.modalSubtitle}>
                Kullanıcıyı taşımak istediğiniz kurumu seçin:
              </Text>

              {availableInstitutions.length > 0 ? (
                availableInstitutions.map((institution) => (
                  <TouchableOpacity
                    key={institution.id}
                    style={styles.institutionOption}
                    onPress={() => moveUserToInstitution(institution.id)}
                    disabled={loadingMoveUser}
                  >
                    <Ionicons name="business" size={20} color={colors.primary} />
                    <Text style={styles.institutionOptionText}>{institution.name}</Text>
                    {loadingMoveUser && (
                      <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyText}>Kurum bulunamadı</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Kurum Yönetimi Modal (AdminInstitutionsScreen) */}
      <Modal
        visible={showInstitutionManagement}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowInstitutionManagement(false)}
      >
        <AdminInstitutionsScreen 
          navigation={{
            ...navigation,
            goBack: () => setShowInstitutionManagement(false),
          }}
        />
      </Modal>

      {/* Bireysel Kullanıcılar Modal (AdminIndividualUsersScreen) */}
      <Modal
        visible={showIndividualUsers}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowIndividualUsers(false)}
      >
        <AdminIndividualUsersScreen 
          navigation={{
            ...navigation,
            goBack: () => setShowIndividualUsers(false),
          }}
        />
      </Modal>

      {/* Kullanıcı Arama Modal (AdminUserSearchScreen) */}
      <Modal
        visible={showUserSearch}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowUserSearch(false)}
      >
        <AdminUserSearchScreen 
          navigation={{
            ...navigation,
            goBack: () => setShowUserSearch(false),
          }}
        />
      </Modal>

      {/* Çalışma Analitikleri Modal (AdminStudyAnalyticsScreen) */}
      <Modal
        visible={showStudyAnalytics}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowStudyAnalytics(false)}
      >
        <AdminStudyAnalyticsScreen 
          navigation={{
            ...navigation,
            goBack: () => setShowStudyAnalytics(false),
          }}
        />
      </Modal>

      {/* Zaman Bazlı İstatistikler Modal (AdminTimeStatsScreen) */}
      <Modal
        visible={showTimeStats}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowTimeStats(false)}
      >
        <AdminTimeStatsScreen 
          navigation={{
            ...navigation,
            goBack: () => setShowTimeStats(false),
          }}
        />
      </Modal>
    </Container>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statSubLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  institutionContainer: {
    marginBottom: 24,
  },
  institutionCard: {
    marginBottom: 12,
    padding: 16,
  },
  institutionHeader: {
    marginBottom: 12,
  },
  institutionInfo: {
    flex: 1,
  },
  institutionNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  institutionName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  institutionStatus: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  premiumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  premiumText: {
    fontSize: 12,
    fontWeight: '500',
  },
  institutionStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statItemText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  menuContainer: {
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    marginBottom: 12,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    marginLeft: 16,
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
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
    maxWidth: 500,
    maxHeight: '80%',
    padding: 0,
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
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalScrollView: {
    maxHeight: 500,
    padding: 20,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  userCard: {
    padding: 12,
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  userDetail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  loadingIndicator: {
    marginVertical: 20,
  },
  userCardHeader: {
    marginBottom: 12,
  },
  userCardInfo: {
    flex: 1,
  },
  userCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  institutionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  institutionOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
  },
});

export default AdminDashboardScreen;
