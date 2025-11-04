import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_COLORS, COLORS, SIZES, SHADOWS } from '../constants/theme';
import Container from '../components/Container';
import { Card, Button, Input } from '../components';
import { supabase, supabaseAdmin } from '../lib/supabase';

const AdminIndividualUsersScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);
  
  const [individualUsers, setIndividualUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [loadingMove, setLoadingMove] = useState(false);

  useEffect(() => {
    loadIndividualUsers();
    loadStats();
    loadInstitutions();
  }, []);

  const loadIndividualUsers = async () => {
    try {
      setLoading(true);
      
      // "Bireysel Kullanıcılar" kurumunu bul
      const { data: individualInstitution, error: instError } = await supabaseAdmin
        .from('institutions')
        .select('id')
        .eq('name', 'Bireysel Kullanıcılar')
        .single();

      if (instError || !individualInstitution) {
        setIndividualUsers([]);
        setLoading(false);
        return;
      }

      // Bu kuruma ait aktif üyeleri al
      const { data: memberships, error: membershipError } = await supabaseAdmin
        .from('institution_memberships')
        .select('user_id, is_active')
        .eq('institution_id', individualInstitution.id)
        .eq('is_active', true);

      if (membershipError || !memberships || memberships.length === 0) {
        setIndividualUsers([]);
        setLoading(false);
        return;
      }

      // User ID'leri al
      const userIds = memberships.map(m => m.user_id).filter(Boolean);

      // User profiles ve detayları al
      const { data: userProfiles, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, name, email, user_type, created_at')
        .in('user_id', userIds);

      if (profileError) {
        throw profileError;
      }

      // Her kullanıcı için son giriş tarihini al (auth.users'dan)
      const usersWithDetails = await Promise.all(
        (userProfiles || []).map(async (profile) => {
          // Auth'dan last_sign_in_at al
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
          
          return {
            user_id: profile.user_id,
            name: profile.name,
            email: profile.email,
            user_type: profile.user_type,
            created_at: profile.created_at,
            last_login: authUser?.user?.last_sign_in_at || profile.created_at,
          };
        })
      );

      setIndividualUsers(usersWithDetails);
    } catch (error) {
      console.error('Bireysel kullanıcılar yükleme hatası:', error);
      Alert.alert('Hata', 'Bireysel kullanıcılar yüklenirken bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // "Bireysel Kullanıcılar" kurumunu bul
      const { data: individualInstitution } = await supabaseAdmin
        .from('institutions')
        .select('id')
        .eq('name', 'Bireysel Kullanıcılar')
        .single();

      if (!individualInstitution) {
        setStats({
          total_users: 0,
          total_students: 0,
          total_teachers: 0,
          active_users_today: 0,
          new_users_this_week: 0,
          new_users_this_month: 0,
        });
        return;
      }

      // Aktif üyeleri say
      const { count: totalUsers } = await supabaseAdmin
        .from('institution_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', individualInstitution.id)
        .eq('is_active', true);

      // Öğrenci ve öğretmen sayılarını hesapla
      const { data: memberships } = await supabaseAdmin
        .from('institution_memberships')
        .select('user_id')
        .eq('institution_id', individualInstitution.id)
        .eq('is_active', true);

      if (memberships && memberships.length > 0) {
        const userIds = memberships.map(m => m.user_id).filter(Boolean);
        const { data: userProfiles } = await supabaseAdmin
          .from('user_profiles')
          .select('user_type, created_at')
          .in('user_id', userIds);

        const totalStudents = userProfiles?.filter(p => p.user_type === 'student').length || 0;
        const totalTeachers = userProfiles?.filter(p => p.user_type === 'teacher').length || 0;

        // Bugün aktif kullanıcılar (basit bir tahmin - son 24 saat içinde giriş yapanlar)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const activeToday = userProfiles?.filter(p => {
          const created = new Date(p.created_at);
          return created >= today;
        }).length || 0;

        // Bu hafta yeni kullanıcılar
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const newThisWeek = userProfiles?.filter(p => {
          const created = new Date(p.created_at);
          return created >= weekAgo;
        }).length || 0;

        // Bu ay yeni kullanıcılar
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        const newThisMonth = userProfiles?.filter(p => {
          const created = new Date(p.created_at);
          return created >= monthAgo;
        }).length || 0;

        setStats({
          total_users: totalUsers || 0,
          total_students: totalStudents,
          total_teachers: totalTeachers,
          active_users_today: activeToday,
          new_users_this_week: newThisWeek,
          new_users_this_month: newThisMonth,
        });
      } else {
        setStats({
          total_users: 0,
          total_students: 0,
          total_teachers: 0,
          active_users_today: 0,
          new_users_this_week: 0,
          new_users_this_month: 0,
        });
      }
    } catch (error) {
      console.error('İstatistik yükleme hatası:', error);
      setStats(null);
    }
  };

  const loadInstitutions = async () => {
    try {
      const { data: institutionsData, error } = await supabaseAdmin
        .from('institutions')
        .select('id, name, type')
        .neq('name', 'Bireysel Kullanıcılar')
        .order('name');

      if (error) {
        console.error('Kurumlar yükleme hatası:', error);
        return;
      }

      setInstitutions(institutionsData || []);
    } catch (error) {
      console.error('Kurumlar yükleme hatası:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadIndividualUsers(),
      loadStats(),
      loadInstitutions()
    ]);
    setRefreshing(false);
  };

  const handleMoveToInstitution = async () => {
    if (!selectedUser || !selectedInstitution) {
      Alert.alert('Hata', 'Lütfen kullanıcı ve kurum seçin');
      return;
    }

    setLoadingMove(true);
    try {
      const userId = selectedUser.user_id;
      const userType = selectedUser.user_type; // 'teacher' veya 'student'

      // 1. Eski kurumdaki (Bireysel Kullanıcılar) institution_memberships kaydını sil
      const { error: deleteError } = await supabaseAdmin
        .from('institution_memberships')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        throw new Error('Eski üyelik silinemedi: ' + deleteError.message);
      }

      // 2. Yeni kuruma institution_memberships ekle
      const { error: insertError } = await supabaseAdmin
        .from('institution_memberships')
        .insert({
          institution_id: selectedInstitution,
          user_id: userId,
          role: userType,
          is_active: true
        });

      if (insertError) {
        throw new Error('Yeni üyelik eklenemedi: ' + insertError.message);
      }

      // 3. teachers veya students tablosundaki institution_id'yi güncelle
      if (userType === 'teacher') {
        const { error: teacherUpdateError } = await supabaseAdmin
          .from('teachers')
          .update({ institution_id: selectedInstitution })
          .eq('user_id', userId);

        if (teacherUpdateError) {
          console.warn('Öğretmen institution_id güncellenemedi:', teacherUpdateError);
        }
      } else if (userType === 'student') {
        const { error: studentUpdateError } = await supabaseAdmin
          .from('students')
          .update({ institution_id: selectedInstitution })
          .eq('user_id', userId);

        if (studentUpdateError) {
          console.warn('Öğrenci institution_id güncellenemedi:', studentUpdateError);
        }
      }

      const targetInstitution = institutions.find(inst => inst.id === selectedInstitution);
      Alert.alert('Başarılı', `Kullanıcı "${targetInstitution?.name}" kurumuna taşındı`);
      setShowMoveModal(false);
      setSelectedUser(null);
      setSelectedInstitution('');
      loadIndividualUsers();
      loadStats();
    } catch (error) {
      console.error('Kullanıcı taşıma hatası:', error);
      Alert.alert('Hata', 'Kullanıcı taşınamadı: ' + error.message);
    } finally {
      setLoadingMove(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Bilinmiyor';
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const renderUserItem = ({ item }) => (
    <Card style={styles.userCard}>
      <View style={styles.userInfo}>
        <View style={styles.userHeader}>
          <View style={styles.userIcon}>
            <Ionicons 
              name={item.user_type === 'teacher' ? 'person' : 'school'} 
              size={24} 
              color={colors.primary} 
            />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{item.name || 'İsimsiz'}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
            <Text style={styles.userType}>
              {item.user_type === 'teacher' ? 'Öğretmen' : 'Öğrenci'}
            </Text>
          </View>
        </View>
        
        <View style={styles.userMeta}>
          <Text style={styles.metaText}>
            Kayıt: {formatDate(item.created_at)}
          </Text>
          <Text style={styles.metaText}>
            Son Giriş: {formatDate(item.last_login)}
          </Text>
        </View>
      </View>
      
      <View style={styles.userActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setSelectedUser(item);
            setShowMoveModal(true);
          }}
        >
          <Ionicons name="arrow-forward" size={20} color={colors.primary} />
          <Text style={styles.actionText}>Kuruma Taşı</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  const renderStatsCard = () => {
    if (!stats) return null;

    return (
      <Card style={styles.statsCard}>
        <Text style={styles.statsTitle}>Bireysel Kullanıcı İstatistikleri</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total_users || 0}</Text>
            <Text style={styles.statLabel}>Toplam Kullanıcı</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total_students || 0}</Text>
            <Text style={styles.statLabel}>Öğrenci</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total_teachers || 0}</Text>
            <Text style={styles.statLabel}>Öğretmen</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.active_users_today || 0}</Text>
            <Text style={styles.statLabel}>Bugün Aktif</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.new_users_this_week || 0}</Text>
            <Text style={styles.statLabel}>Bu Hafta</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.new_users_this_month || 0}</Text>
            <Text style={styles.statLabel}>Bu Ay</Text>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <Container>
      <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bireysel Kullanıcılar</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderStatsCard()}

        <Card style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={24} color={colors.primary} />
            <Text style={styles.infoTitle}>Bireysel Kullanıcılar</Text>
          </View>
          <Text style={styles.infoText}>
            Bu kullanıcılar Play Store ve App Store üzerinden doğrudan kayıt olan, 
            herhangi bir kuruma bağlı olmayan kullanıcılardır. Bu kullanıcıları 
            istediğiniz kuruma taşıyabilirsiniz.
          </Text>
        </Card>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            Kullanıcılar ({individualUsers.length})
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Yükleniyor...</Text>
          </View>
        ) : individualUsers.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>Bireysel Kullanıcı Bulunamadı</Text>
            <Text style={styles.emptyText}>
              Henüz bireysel kullanıcı kaydolmamış.
            </Text>
          </Card>
        ) : (
          <FlatList
            data={individualUsers}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.user_id}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          />
        )}
      </ScrollView>

      {/* Kuruma Taşıma Modal */}
      <Modal
        visible={showMoveModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMoveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kullanıcıyı Kuruma Taşı</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowMoveModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <View style={styles.selectedUserInfo}>
                <Text style={styles.selectedUserName}>{selectedUser.name}</Text>
                <Text style={styles.selectedUserEmail}>{selectedUser.email}</Text>
                <Text style={styles.selectedUserType}>
                  {selectedUser.user_type === 'teacher' ? 'Öğretmen' : 'Öğrenci'}
                </Text>
              </View>
            )}

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Hedef Kurum:</Text>
              <ScrollView style={styles.institutionList}>
                {institutions.map((institution) => (
                  <TouchableOpacity
                    key={institution.id}
                    style={[
                      styles.institutionItem,
                      selectedInstitution === institution.id && styles.selectedInstitution
                    ]}
                    onPress={() => setSelectedInstitution(institution.id)}
                  >
                    <Text style={styles.institutionName}>{institution.name}</Text>
                    <Text style={styles.institutionType}>{institution.type}</Text>
                    {selectedInstitution === institution.id && (
                      <Ionicons name="checkmark" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalActions}>
              <Button
                title="İptal"
                onPress={() => setShowMoveModal(false)}
                style={styles.cancelButton}
                textStyle={styles.cancelButtonText}
              />
              <Button
                title={loadingMove ? "Taşınıyor..." : "Taşı"}
                onPress={handleMoveToInstitution}
                style={styles.confirmButton}
                textStyle={styles.confirmButtonText}
                disabled={loadingMove}
              />
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </Container>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsCard: {
    marginBottom: 16,
    padding: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  infoCard: {
    marginBottom: 16,
    padding: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  listHeader: {
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  userCard: {
    marginBottom: 12,
    padding: 16,
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  userType: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  userMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary + '20',
    borderRadius: 8,
  },
  actionText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    width: '100%',
    maxHeight: '80%',
    ...SHADOWS.large,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  selectedUserInfo: {
    padding: 16,
    backgroundColor: colors.background,
    margin: 16,
    borderRadius: 8,
  },
  selectedUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  selectedUserEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  selectedUserType: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  modalBody: {
    padding: 16,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  institutionList: {
    maxHeight: 200,
  },
  institutionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedInstitution: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  institutionName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  institutionType: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.textSecondary + '20',
  },
  cancelButtonText: {
    color: colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  confirmButtonText: {
    color: colors.surface,
  },
});

export default AdminIndividualUsersScreen;
