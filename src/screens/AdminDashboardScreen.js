import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_COLORS, COLORS } from '../constants/theme';
import { SIZES, SHADOWS } from '../constants/theme';
import Container from '../components/Container';
import Card from '../components/Card';
import { supabase } from '../lib/supabase';

const AdminDashboardScreen = ({ navigation }) => {
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

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Kurum istatistikleri
      const { data: institutions } = await supabase
        .from('institutions')
        .select('id, name, is_active, is_premium');

      const totalInstitutions = institutions?.length || 0;
      const activeInstitutions = institutions?.filter(inst => inst.is_active)?.length || 0;

      // Toplam öğretmen sayısı
      const { count: teachersCount } = await supabase
        .from('teachers')
        .select('*', { count: 'exact', head: true });

      // Toplam öğrenci sayısı
      const { count: studentsCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      // Bireysel kullanıcı sayısı
      const individualUsersResult = await AdSystem.getIndividualUsersStats();
      const individualUsers = individualUsersResult.success ? individualUsersResult.data.total_users : 0;

      // Toplam bağlantı sayısı
      const { count: connectionsCount } = await supabase
        .from('student_teachers')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'approved')
        .eq('is_active', true);

      setStats({
        totalInstitutions,
        activeInstitutions,
        totalTeachers: teachersCount || 0,
        totalStudents: studentsCount || 0,
        individualUsers,
        totalConnections: connectionsCount || 0,
      });

      // Kurum bazlı detaylı istatistikler
      await loadInstitutionStats();
    } catch (error) {
      console.error('İstatistikler yüklenirken hata:', error);
      Alert.alert('Hata', 'İstatistikler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const loadInstitutionStats = async () => {
    try {
      const { data: institutions } = await supabase
        .from('institutions')
        .select(`
          id,
          name,
          is_active,
          is_premium,
          teachers(count),
          students(count)
        `);

      const institutionStatsData = institutions?.map(inst => ({
        id: inst.id,
        name: inst.name,
        is_active: inst.is_active,
        is_premium: inst.is_premium,
        teacher_count: inst.teachers?.[0]?.count || 0,
        student_count: inst.students?.[0]?.count || 0,
      })) || [];

      setInstitutionStats(institutionStatsData);
    } catch (error) {
      console.error('Kurum istatistikleri yüklenirken hata:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Admin panelinden çıkmak istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Çıkış Yap', 
          style: 'destructive',
          onPress: () => navigation.navigate('AdminLogin')
        },
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
              <Card key={institution.id} style={styles.institutionCard}>
                <View style={styles.institutionHeader}>
                  <View style={styles.institutionInfo}>
                    <Text style={styles.institutionName}>{institution.name}</Text>
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
            ))}
          </View>

          {/* Yönetim Menüleri */}
          <View style={styles.menuContainer}>
            <Text style={styles.sectionTitle}>⚙️ Yönetim</Text>
            
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('AdminInstitutions')}
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
              onPress={() => navigation.navigate('AdminIndividualUsers')}
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
          </View>
        </ScrollView>
      </View>
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
  institutionName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
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
});

export default AdminDashboardScreen;
