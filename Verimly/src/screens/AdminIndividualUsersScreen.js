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
import { Card, Button, Input } from '../components';
import { colors, SHADOWS } from '../constants/theme';

const AdminIndividualUsersScreen = ({ navigation }) => {
  const [individualUsers, setIndividualUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [selectedInstitution, setSelectedInstitution] = useState('');

  useEffect(() => {
    loadIndividualUsers();
    loadStats();
    loadInstitutions();
  }, []);

  const loadIndividualUsers = async () => {
    try {
      setLoading(true);
      const result = await AdSystem.getIndividualUsers();
      
      if (result.success) {
        setIndividualUsers(result.data || []);
      } else {
        Alert.alert('Hata', result.error || 'Bireysel kullanıcılar yüklenemedi');
      }
    } catch (error) {
      console.error('Bireysel kullanıcılar yükleme hatası:', error);
      Alert.alert('Hata', 'Bireysel kullanıcılar yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const result = await AdSystem.getIndividualUsersStats();
      
      if (result.success) {
        setStats(result.data?.[0] || null);
      }
    } catch (error) {
      console.error('İstatistik yükleme hatası:', error);
    }
  };

  const loadInstitutions = async () => {
    try {
      const result = await AdSystem.getAllInstitutions();
      
      if (result.success) {
        // Bireysel kullanıcılar kurumunu filtrele
        const filteredInstitutions = result.data?.filter(
          inst => inst.name !== 'Bireysel Kullanıcılar'
        ) || [];
        setInstitutions(filteredInstitutions);
      }
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

    try {
      const result = await AdSystem.moveIndividualUserToInstitution(
        selectedUser.user_id,
        selectedInstitution
      );

      if (result.success) {
        Alert.alert('Başarılı', 'Kullanıcı kuruma taşındı');
        setShowMoveModal(false);
        setSelectedUser(null);
        setSelectedInstitution('');
        loadIndividualUsers();
        loadStats();
      } else {
        Alert.alert('Hata', result.error || 'Kullanıcı taşınamadı');
      }
    } catch (error) {
      console.error('Kullanıcı taşıma hatası:', error);
      Alert.alert('Hata', 'Kullanıcı taşınırken bir hata oluştu');
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
                title="Taşı"
                onPress={handleMoveToInstitution}
                style={styles.confirmButton}
                textStyle={styles.confirmButtonText}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
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
