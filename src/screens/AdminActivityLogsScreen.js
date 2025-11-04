import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_COLORS, COLORS, SIZES, SHADOWS } from '../constants/theme';
import Container from '../components/Container';
import Card from '../components/Card';
import Select from '../components/Select';
import { supabaseAdmin } from '../lib/supabase';

const AdminActivityLogsScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterActionType, setFilterActionType] = useState('');
  const [filterTargetType, setFilterTargetType] = useState('');
  const [timeRange, setTimeRange] = useState('week'); // 'today', 'week', 'month', 'all'

  const actionTypes = [
    { label: 'Tümü', value: '' },
    { label: 'Kullanıcı Oluştur', value: 'user_create' },
    { label: 'Kullanıcı Sil', value: 'user_delete' },
    { label: 'Kullanıcı Taşı', value: 'user_move' },
    { label: 'Şifre Sıfırla', value: 'user_password_reset' },
    { label: 'Kurum Oluştur', value: 'institution_create' },
    { label: 'Kurum Güncelle', value: 'institution_update' },
    { label: 'Kurum Durum Değişikliği', value: 'institution_status_change' },
    { label: 'Sözleşme Güncelle', value: 'contract_update' },
    { label: 'Toplu İşlem', value: 'bulk_' },
  ];

  const targetTypes = [
    { label: 'Tümü', value: '' },
    { label: 'Kullanıcı', value: 'user' },
    { label: 'Kurum', value: 'institution' },
    { label: 'Sözleşme', value: 'contract' },
  ];

  useEffect(() => {
    loadLogs();
  }, [filterActionType, filterTargetType, timeRange]);

  const getDateRange = () => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let startDate = new Date();

    switch (timeRange) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'all':
        startDate = new Date(0);
        break;
    }

    return { startDate, endDate: now };
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      let query = supabaseAdmin
        .from('admin_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      // Tarih filtresi
      if (timeRange !== 'all') {
        query = query
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());
      }

      // Action type filtresi
      if (filterActionType) {
        if (filterActionType.startsWith('bulk_')) {
          query = query.like('action_type', 'bulk_%');
        } else {
          query = query.eq('action_type', filterActionType);
        }
      }

      // Target type filtresi
      if (filterTargetType) {
        query = query.eq('target_type', filterTargetType);
      }

      const { data: activityLogs, error } = await query;

      if (error) {
        // Tablo yoksa boş döndür (hata mesajı gösterme)
        if (error.code === '42P01') {
          setLogs([]);
          setLoading(false);
          return;
        }
        throw error;
      }

      // Admin kullanıcı bilgilerini al ve formatla
      const adminUserIds = [...new Set((activityLogs || [])
        .map(log => log.admin_user_id)
        .filter(Boolean))];

      const adminUsersMap = {};
      if (adminUserIds.length > 0) {
        const { data: adminUsers } = await supabaseAdmin
          .from('user_profiles')
          .select('user_id, name, email')
          .in('user_id', adminUserIds);

        if (adminUsers) {
          adminUsers.forEach(user => {
            adminUsersMap[user.user_id] = {
              name: user.name,
              email: user.email,
            };
          });
        }
      }

      // Logları formatla
      const formattedLogs = (activityLogs || []).map(log => {
        const adminUser = log.admin_user_id ? adminUsersMap[log.admin_user_id] : null;
        return {
          ...log,
          admin_name: adminUser?.name || 'Bilinmiyor',
          admin_email: adminUser?.email || '',
          details_parsed: log.details ? (typeof log.details === 'string' ? JSON.parse(log.details) : log.details) : null,
        };
      });

      setLogs(formattedLogs);
    } catch (error) {
      console.error('Aktivite logları yüklenirken hata:', error);
      if (error.code !== '42P01') {
        Alert.alert('Hata', 'Aktivite logları yüklenemedi: ' + error.message);
      }
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Bilinmiyor';
    const date = new Date(dateString);
    return date.toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionIcon = (actionType) => {
    if (actionType?.includes('create')) return 'add-circle';
    if (actionType?.includes('delete')) return 'trash';
    if (actionType?.includes('move')) return 'swap-horizontal';
    if (actionType?.includes('password')) return 'key';
    if (actionType?.includes('update')) return 'pencil';
    if (actionType?.includes('status')) return 'toggle';
    return 'information-circle';
  };

  const getActionColor = (actionType) => {
    if (actionType?.includes('create')) return colors.success;
    if (actionType?.includes('delete')) return colors.error;
    if (actionType?.includes('move')) return colors.warning;
    if (actionType?.includes('password')) return colors.info;
    return colors.primary;
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
          <Text style={styles.headerTitle}>Admin Aktivite Logları</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Filtreler */}
        <Card style={styles.filtersCard}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Zaman Aralığı:</Text>
            <Select
              value={timeRange}
              onValueChange={setTimeRange}
              options={[
                { label: 'Bugün', value: 'today' },
                { label: 'Son 7 Gün', value: 'week' },
                { label: 'Son 30 Gün', value: 'month' },
                { label: 'Tümü', value: 'all' },
              ]}
            />
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>İşlem Tipi:</Text>
            <Select
              value={filterActionType}
              onValueChange={setFilterActionType}
              options={actionTypes}
              placeholder="Tümü"
            />
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Hedef Tip:</Text>
            <Select
              value={filterTargetType}
              onValueChange={setFilterTargetType}
              options={targetTypes}
              placeholder="Tümü"
            />
          </View>
        </Card>

        {/* Log Listesi */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Yükleniyor...</Text>
          </View>
        ) : logs.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>Log Bulunamadı</Text>
            <Text style={styles.emptyText}>
              {timeRange === 'all' 
                ? 'Henüz hiçbir admin işlemi loglanmamış.' 
                : 'Seçilen zaman aralığında log bulunamadı.'}
            </Text>
            <Text style={styles.emptyHint}>
              Not: Log tablosu oluşturulmamış olabilir. SQL dosyasını çalıştırın.
            </Text>
          </Card>
        ) : (
          <ScrollView
            style={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          >
            {logs.map((log) => (
              <Card key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={styles.logIconContainer}>
                    <Ionicons
                      name={getActionIcon(log.action_type)}
                      size={24}
                      color={getActionColor(log.action_type)}
                    />
                  </View>
                  <View style={styles.logInfo}>
                    <Text style={styles.logDescription}>{log.description}</Text>
                    <Text style={styles.logMeta}>
                      {log.admin_name} • {formatDate(log.created_at)}
                    </Text>
                  </View>
                </View>

                <View style={styles.logDetails}>
                  <View style={styles.logDetailRow}>
                    <Text style={styles.logDetailLabel}>İşlem:</Text>
                    <Text style={styles.logDetailValue}>{log.action_type}</Text>
                  </View>
                  {log.target_type && (
                    <View style={styles.logDetailRow}>
                      <Text style={styles.logDetailLabel}>Hedef:</Text>
                      <Text style={styles.logDetailValue}>
                        {log.target_type} {log.target_id ? `(${log.target_id.substring(0, 8)}...)` : ''}
                      </Text>
                    </View>
                  )}
                  {log.details_parsed && (
                    <View style={styles.logDetailRow}>
                      <Text style={styles.logDetailLabel}>Detaylar:</Text>
                      <Text style={styles.logDetailValue}>
                        {JSON.stringify(log.details_parsed, null, 2)}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            ))}
          </ScrollView>
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
  headerRight: {
    width: 40,
  },
  filtersCard: {
    margin: 16,
    marginTop: 0,
    padding: 16,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
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
  content: {
    flex: 1,
    padding: 16,
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
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 12,
    color: colors.textSecondary + 'CC',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  logCard: {
    marginBottom: 12,
    padding: 16,
  },
  logHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  logIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logInfo: {
    flex: 1,
  },
  logDescription: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  logMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  logDetails: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logDetailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  logDetailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    width: 80,
  },
  logDetailValue: {
    fontSize: 12,
    color: colors.textPrimary,
    flex: 1,
  },
});

export default AdminActivityLogsScreen;

