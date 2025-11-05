import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_COLORS, COLORS, SIZES, SHADOWS } from '../constants/theme';
import Container from '../components/Container';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import { supabase } from '../lib/supabase';
import { searchAdminUsers, getAdminInstitutions, resetAdminUserPassword } from '../lib/adminApi';

const AdminUserSearchScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [selectedUserType, setSelectedUserType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'week', 'month'
  const [institutions, setInstitutions] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [loadingBulk, setLoadingBulk] = useState(false);

  useEffect(() => {
    loadInstitutions();
    loadUsers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedInstitution, selectedUserType, selectedStatus, dateFilter, users]);

  const loadInstitutions = async () => {
    try {
      const result = await getAdminInstitutions();

      if (result.error) {
        console.error('Kurumlar yükleme hatası:', result.error);
        return;
      }

      setInstitutions([{ id: '', name: 'Tüm Kurumlar' }, ...(result.data || [])]);
    } catch (error) {
      console.error('Kurumlar yükleme hatası:', error);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await searchAdminUsers();

      if (result.error) {
        throw new Error(result.error?.message || result.error || 'Kullanıcılar yüklenemedi');
      }

      const usersWithDetails = result.data || [];
      setUsers(usersWithDetails);
      setFilteredUsers(usersWithDetails);
    } catch (error) {
      console.error('Kullanıcılar yüklenirken hata:', error);
      Alert.alert('Hata', `Kullanıcılar yüklenemedi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...users];

    // Arama sorgusu (isim veya email)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        user =>
          user.name?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query)
      );
    }

    // Kurum filtresi
    if (selectedInstitution) {
      filtered = filtered.filter(user => user.institution_id === selectedInstitution);
    }

    // Kullanıcı tipi filtresi
    if (selectedUserType) {
      filtered = filtered.filter(user => user.user_type === selectedUserType);
    }

    // Durum filtresi (aktif/pasif)
    if (selectedStatus) {
      if (selectedStatus === 'active') {
        filtered = filtered.filter(user => user.is_active);
      } else if (selectedStatus === 'inactive') {
        filtered = filtered.filter(user => !user.is_active);
      }
    }

    // Tarih filtresi
    if (dateFilter !== 'all') {
      const now = new Date();
      let filterDate = new Date();

      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(user => new Date(user.created_at) >= filterDate);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter(user => new Date(user.created_at) >= filterDate);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(user => new Date(user.created_at) >= filterDate);
          break;
      }
    }

    setFilteredUsers(filtered);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Bilinmiyor';
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const selectAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.user_id));
    }
  };

  const handleBulkPasswordReset = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('Uyarı', 'Lütfen en az bir kullanıcı seçin');
      return;
    }

    Alert.alert(
      'Toplu Şifre Sıfırlama',
      `${selectedUsers.length} kullanıcının şifresi "user123" olarak sıfırlanacak. Devam etmek istiyor musunuz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            setLoadingBulk(true);
            try {
              let successCount = 0;
              let failCount = 0;

              for (const userId of selectedUsers) {
                try {
                  const result = await resetAdminUserPassword(userId);

                  if (result.error) {
                    throw new Error(result.error?.message || result.error || 'Şifre sıfırlanamadı');
                  }
                  successCount++;
                } catch (error) {
                  console.error(`Kullanıcı ${userId} şifre sıfırlama hatası:`, error);
                  failCount++;
                }
              }

              Alert.alert(
                'Tamamlandı',
                `${successCount} kullanıcının şifresi sıfırlandı.${failCount > 0 ? ` ${failCount} kullanıcı için hata oluştu.` : ''}`
              );

              setSelectedUsers([]);
              loadUsers();
            } catch (error) {
              Alert.alert('Hata', `Toplu şifre sıfırlama sırasında bir hata oluştu: ${error.message}`);
            } finally {
              setLoadingBulk(false);
              setShowBulkActions(false);
            }
          },
        },
      ]
    );
  };

  const handleBulkMove = () => {
    if (selectedUsers.length === 0) {
      Alert.alert('Uyarı', 'Lütfen en az bir kullanıcı seçin');
      return;
    }
    // Bu özellik için ayrı bir modal eklenebilir
    Alert.alert('Bilgi', 'Toplu taşıma özelliği yakında eklenecek');
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedInstitution('');
    setSelectedUserType('');
    setSelectedStatus('');
    setDateFilter('all');
    setSelectedUsers([]);
  };

  const renderUserCard = ({ item }) => {
    const isSelected = selectedUsers.includes(item.user_id);

    return (
      <TouchableOpacity
        onPress={() => toggleUserSelection(item.user_id)}
        onLongPress={() => {
          // Uzun basınca kullanıcı detayları gösterilebilir
        }}
      >
        <Card style={[styles.userCard, isSelected && styles.selectedUserCard]}>
          <View style={styles.userCardHeader}>
            <View style={styles.userInfo}>
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
                <View style={styles.userMeta}>
                  <Text style={styles.userType}>
                    {item.user_type === 'teacher' ? 'Öğretmen' : 'Öğrenci'}
                  </Text>
                  <Text style={styles.institutionName}>• {item.institution_name}</Text>
                </View>
              </View>
            </View>
            {isSelected && (
              <View style={styles.selectedIcon}>
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              </View>
            )}
          </View>

          <View style={styles.userCardFooter}>
            <View style={styles.statusBadge}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: item.is_active ? colors.success : colors.textSecondary },
                ]}
              />
              <Text style={styles.statusText}>
                {item.is_active ? 'Aktif' : 'Pasif'}
              </Text>
            </View>
            <Text style={styles.dateText}>Kayıt: {formatDate(item.created_at)}</Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <Container>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Kullanıcı Arama</Text>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons
              name={showFilters ? 'filter' : 'filter-outline'}
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Arama Çubuğu */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="İsim veya e-posta ile ara..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtreler */}
        {showFilters && (
          <Card style={styles.filtersCard}>
            <Text style={styles.filtersTitle}>Filtreler</Text>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Kurum:</Text>
              <Select
                value={selectedInstitution}
                onValueChange={setSelectedInstitution}
                options={institutions.map(inst => ({
                  label: inst.name,
                  value: inst.id,
                }))}
                placeholder="Tüm Kurumlar"
              />
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Kullanıcı Tipi:</Text>
              <Select
                value={selectedUserType}
                onValueChange={setSelectedUserType}
                options={[
                  { label: 'Tümü', value: '' },
                  { label: 'Öğretmen', value: 'teacher' },
                  { label: 'Öğrenci', value: 'student' },
                ]}
                placeholder="Tümü"
              />
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Durum:</Text>
              <Select
                value={selectedStatus}
                onValueChange={setSelectedStatus}
                options={[
                  { label: 'Tümü', value: '' },
                  { label: 'Aktif', value: 'active' },
                  { label: 'Pasif', value: 'inactive' },
                ]}
                placeholder="Tümü"
              />
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Kayıt Tarihi:</Text>
              <Select
                value={dateFilter}
                onValueChange={setDateFilter}
                options={[
                  { label: 'Tümü', value: 'all' },
                  { label: 'Bugün', value: 'today' },
                  { label: 'Son 7 Gün', value: 'week' },
                  { label: 'Son 30 Gün', value: 'month' },
                ]}
              />
            </View>

            <View style={styles.filterActions}>
              <Button
                title="Filtreleri Sıfırla"
                onPress={resetFilters}
                style={styles.resetButton}
                textStyle={styles.resetButtonText}
              />
            </View>
          </Card>
        )}

        {/* Seçim ve Toplu İşlemler */}
        {selectedUsers.length > 0 && (
          <Card style={styles.bulkActionsCard}>
            <View style={styles.bulkActionsHeader}>
              <Text style={styles.bulkActionsText}>
                {selectedUsers.length} kullanıcı seçildi
              </Text>
              <TouchableOpacity onPress={selectAllUsers}>
                <Text style={styles.selectAllText}>
                  {selectedUsers.length === filteredUsers.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bulkActionsButtons}>
              <Button
                title="Şifre Sıfırla"
                onPress={handleBulkPasswordReset}
                style={styles.bulkButton}
                disabled={loadingBulk}
              />
              <Button
                title="Kuruma Taşı"
                onPress={handleBulkMove}
                style={[styles.bulkButton, styles.bulkButtonSecondary]}
              />
            </View>
          </Card>
        )}

        {/* Sonuç Sayısı */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsText}>
            {filteredUsers.length} kullanıcı bulundu
          </Text>
          {loading && <ActivityIndicator size="small" color={colors.primary} />}
        </View>

        {/* Kullanıcı Listesi */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Yükleniyor...</Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>Kullanıcı bulunamadı</Text>
            <Text style={styles.emptyText}>
              Filtreleri değiştirerek tekrar deneyin
            </Text>
          </Card>
        ) : (
          <FlatList
            data={filteredUsers}
            renderItem={renderUserCard}
            keyExtractor={(item) => item.user_id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
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
    flex: 1,
    marginLeft: 16,
  },
  filterButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
  filtersCard: {
    margin: 16,
    marginTop: 0,
    padding: 16,
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  filterActions: {
    marginTop: 8,
  },
  resetButton: {
    backgroundColor: colors.textSecondary + '20',
  },
  resetButtonText: {
    color: colors.textSecondary,
  },
  bulkActionsCard: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: colors.primary + '10',
  },
  bulkActionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bulkActionsText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  selectAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  bulkActionsButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  bulkButton: {
    flex: 1,
  },
  bulkButtonSecondary: {
    backgroundColor: colors.textSecondary + '20',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultsText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    margin: 16,
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
  listContent: {
    padding: 16,
  },
  userCard: {
    marginBottom: 12,
    padding: 16,
  },
  selectedUserCard: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
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
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  userType: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  institutionName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  selectedIcon: {
    marginLeft: 12,
  },
  userCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default AdminUserSearchScreen;

