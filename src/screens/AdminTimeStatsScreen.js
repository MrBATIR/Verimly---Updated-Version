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
import { DARK_COLORS, COLORS, SIZES, SHADOWS } from '../constants/theme';
import Container from '../components/Container';
import Card from '../components/Card';
import Select from '../components/Select';
import { supabaseAdmin } from '../lib/supabase';

const AdminTimeStatsScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month'); // 'week', 'month', 'quarter', 'year'
  
  // İstatistikler
  const [userGrowth, setUserGrowth] = useState([]);
  const [institutionGrowth, setInstitutionGrowth] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    newUsers: 0,
    newInstitutions: 0,
    activeUsers: 0,
    growthRate: 0,
  });

  useEffect(() => {
    loadTimeStats();
  }, [timeRange]);

  const getDateRange = () => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let startDate = new Date();

    switch (timeRange) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    startDate.setHours(0, 0, 0, 0);
    return { startDate, endDate: now };
  };

  const loadTimeStats = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      // Kullanıcı kayıt trendi
      const { data: userProfiles, error: usersError } = await supabaseAdmin
        .from('user_profiles')
        .select('created_at, user_type')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (usersError) throw usersError;

      // Kurum kayıt trendi
      const { data: institutions, error: instError } = await supabaseAdmin
        .from('institutions')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (instError) throw instError;

      // Günlük istatistikler hesapla
      calculateDailyStats(userProfiles || [], institutions || [], startDate, endDate);
      calculateUserGrowth(userProfiles || [], startDate, endDate);
      calculateInstitutionGrowth(institutions || [], startDate, endDate);
      calculateSummaryStats(userProfiles || [], institutions || [], startDate);

    } catch (error) {
      console.error('Zaman bazlı istatistikler yüklenirken hata:', error);
      Alert.alert('Hata', 'İstatistikler yüklenemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateDailyStats = (users, institutions, startDate, endDate) => {
    const dayMap = {};
    const currentDate = new Date(startDate);

    // Tüm günleri başlat
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dayMap[dateKey] = {
        date: dateKey,
        newUsers: 0,
        newStudents: 0,
        newTeachers: 0,
        newInstitutions: 0,
      };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Kullanıcıları günlere dağıt
    users.forEach(user => {
      const dateKey = new Date(user.created_at).toISOString().split('T')[0];
      if (dayMap[dateKey]) {
        dayMap[dateKey].newUsers += 1;
        if (user.user_type === 'student') {
          dayMap[dateKey].newStudents += 1;
        } else if (user.user_type === 'teacher') {
          dayMap[dateKey].newTeachers += 1;
        }
      }
    });

    // Kurumları günlere dağıt
    institutions.forEach(inst => {
      const dateKey = new Date(inst.created_at).toISOString().split('T')[0];
      if (dayMap[dateKey]) {
        dayMap[dateKey].newInstitutions += 1;
      }
    });

    const stats = Object.values(dayMap)
      .map(day => ({
        ...day,
        dateLabel: new Date(day.date).toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'short',
        }),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setDailyStats(stats);
  };

  const calculateUserGrowth = (users, startDate, endDate) => {
    const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const periodCount = Math.min(periodDays, 30); // Maksimum 30 periyot
    
    const interval = Math.ceil(periodDays / periodCount);
    const growthData = [];

    for (let i = 0; i < periodCount; i++) {
      const periodStart = new Date(startDate);
      periodStart.setDate(periodStart.getDate() + (i * interval));
      
      let periodEnd = new Date(startDate);
      periodEnd.setDate(periodEnd.getDate() + ((i + 1) * interval) - 1);
      periodEnd.setHours(23, 59, 59, 999);

      if (periodEnd > endDate) periodEnd = new Date(endDate);

      const periodUsers = users.filter(user => {
        const userDate = new Date(user.created_at);
        return userDate >= periodStart && userDate <= periodEnd;
      });

      growthData.push({
        period: i + 1,
        startDate: periodStart.toISOString().split('T')[0],
        endDate: periodEnd.toISOString().split('T')[0],
        label: new Date(periodStart).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
        count: periodUsers.length,
      });
    }

    setUserGrowth(growthData);
  };

  const calculateInstitutionGrowth = (institutions, startDate, endDate) => {
    const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const periodCount = Math.min(periodDays, 12); // Maksimum 12 periyot
    
    const interval = Math.ceil(periodDays / periodCount);
    const growthData = [];

    for (let i = 0; i < periodCount; i++) {
      const periodStart = new Date(startDate);
      periodStart.setDate(periodStart.getDate() + (i * interval));
      
      let periodEnd = new Date(startDate);
      periodEnd.setDate(periodEnd.getDate() + ((i + 1) * interval) - 1);
      periodEnd.setHours(23, 59, 59, 999);

      if (periodEnd > endDate) periodEnd = new Date(endDate);

      const periodInstitutions = institutions.filter(inst => {
        const instDate = new Date(inst.created_at);
        return instDate >= periodStart && instDate <= periodEnd;
      });

      growthData.push({
        period: i + 1,
        startDate: periodStart.toISOString().split('T')[0],
        endDate: periodEnd.toISOString().split('T')[0],
        label: new Date(periodStart).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
        count: periodInstitutions.length,
      });
    }

    setInstitutionGrowth(growthData);
  };

  const calculateSummaryStats = async (users, institutions, startDate) => {
    try {
      const newUsers = users.length;
      const newStudents = users.filter(u => u.user_type === 'student').length;
      const newTeachers = users.filter(u => u.user_type === 'teacher').length;
      const newInstitutions = institutions.length;

      // Önceki periyottaki kullanıcı sayısı
      const previousStart = new Date(startDate);
      const periodDays = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24));
      
      if (timeRange === 'week') {
        previousStart.setDate(previousStart.getDate() - 7);
      } else if (timeRange === 'month') {
        previousStart.setMonth(previousStart.getMonth() - 1);
      } else if (timeRange === 'quarter') {
        previousStart.setMonth(previousStart.getMonth() - 3);
      } else if (timeRange === 'year') {
        previousStart.setFullYear(previousStart.getFullYear() - 1);
      }

      const { count: previousUsersCount } = await supabaseAdmin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', previousStart.toISOString())
        .lt('created_at', startDate.toISOString());

      // Aktif kullanıcılar (son 30 günde giriş yapan)
      const activeDate = new Date();
      activeDate.setDate(activeDate.getDate() - 30);
      
      // Bu kısım auth.users'dan alınmalı ama şimdilik sadece bu periyotta kayıt olanları sayalım
      const activeUsers = newUsers;

      // Büyüme oranı
      const growthRate = previousUsersCount && previousUsersCount > 0
        ? Math.round(((newUsers - previousUsersCount) / previousUsersCount) * 100)
        : newUsers > 0 ? 100 : 0;

      setSummaryStats({
        newUsers,
        newStudents,
        newTeachers,
        newInstitutions,
        activeUsers,
        growthRate,
      });
    } catch (error) {
      console.error('Özet istatistikler hesaplanırken hata:', error);
    }
  };

  const getMaxValue = (data) => {
    if (!data || data.length === 0) return 1;
    return Math.max(...data.map(d => d.count), 1);
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
          <Text style={styles.headerTitle}>Zaman Bazlı İstatistikler</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Filtre */}
        <Card style={styles.filtersCard}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Zaman Aralığı:</Text>
            <Select
              value={timeRange}
              onValueChange={setTimeRange}
              options={[
                { label: 'Son 7 Gün', value: 'week' },
                { label: 'Son 30 Gün', value: 'month' },
                { label: 'Son 3 Ay', value: 'quarter' },
                { label: 'Son 1 Yıl', value: 'year' },
              ]}
            />
          </View>
        </Card>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Yükleniyor...</Text>
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Özet İstatistikler */}
            <Card style={styles.statsCard}>
              <Text style={styles.cardTitle}>📈 Özet İstatistikler</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Ionicons name="person-add-outline" size={24} color={colors.primary} />
                  <Text style={styles.summaryNumber}>{summaryStats.newUsers}</Text>
                  <Text style={styles.summaryLabel}>Yeni Kullanıcı</Text>
                  <Text style={styles.summarySubLabel}>
                    {summaryStats.newStudents} öğrenci, {summaryStats.newTeachers} öğretmen
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Ionicons name="business-outline" size={24} color={colors.warning} />
                  <Text style={styles.summaryNumber}>{summaryStats.newInstitutions}</Text>
                  <Text style={styles.summaryLabel}>Yeni Kurum</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Ionicons name="trending-up-outline" size={24} color={colors.success} />
                  <Text style={styles.summaryNumber}>
                    {summaryStats.growthRate > 0 ? '+' : ''}{summaryStats.growthRate}%
                  </Text>
                  <Text style={styles.summaryLabel}>Büyüme Oranı</Text>
                </View>
              </View>
            </Card>

            {/* Kullanıcı Büyüme Trendi */}
            {userGrowth.length > 0 && (
              <Card style={styles.statsCard}>
                <Text style={styles.cardTitle}>👥 Kullanıcı Büyüme Trendi</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chartContainer}>
                    {userGrowth.map((period) => {
                      const maxValue = getMaxValue(userGrowth);
                      const barHeight = maxValue > 0 ? (period.count / maxValue) * 100 : 0;
                      
                      return (
                        <View key={period.period} style={styles.chartItem}>
                          <View style={styles.barContainer}>
                            <View
                              style={[
                                styles.bar,
                                {
                                  height: `${barHeight}%`,
                                  backgroundColor: colors.primary,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.barLabel}>{period.label}</Text>
                          <Text style={styles.barValue}>{period.count}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </Card>
            )}

            {/* Kurum Büyüme Trendi */}
            {institutionGrowth.length > 0 && (
              <Card style={styles.statsCard}>
                <Text style={styles.cardTitle}>🏢 Kurum Büyüme Trendi</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chartContainer}>
                    {institutionGrowth.map((period) => {
                      const maxValue = getMaxValue(institutionGrowth);
                      const barHeight = maxValue > 0 ? (period.count / maxValue) * 100 : 0;
                      
                      return (
                        <View key={period.period} style={styles.chartItem}>
                          <View style={styles.barContainer}>
                            <View
                              style={[
                                styles.bar,
                                {
                                  height: `${barHeight}%`,
                                  backgroundColor: colors.warning,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.barLabel}>{period.label}</Text>
                          <Text style={styles.barValue}>{period.count}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </Card>
            )}

            {/* Günlük Detay */}
            {dailyStats.length > 0 && (
              <Card style={styles.statsCard}>
                <Text style={styles.cardTitle}>📅 Günlük Detay</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.dailyContainer}>
                    {dailyStats.slice(-14).map((day) => {
                      const maxUsers = Math.max(...dailyStats.slice(-14).map(d => d.newUsers), 1);
                      const maxInstitutions = Math.max(...dailyStats.slice(-14).map(d => d.newInstitutions), 1);
                      
                      return (
                        <View key={day.date} style={styles.dailyItem}>
                          <Text style={styles.dailyDate}>{day.dateLabel}</Text>
                          <View style={styles.dailyBars}>
                            <View style={styles.dailyBarContainer}>
                              <View
                                style={[
                                  styles.dailyBar,
                                  {
                                    height: `${(day.newUsers / maxUsers) * 100}%`,
                                    backgroundColor: colors.primary,
                                  },
                                ]}
                              />
                            </View>
                            <View style={styles.dailyBarContainer}>
                              <View
                                style={[
                                  styles.dailyBar,
                                  {
                                    height: `${maxInstitutions > 0 ? (day.newInstitutions / maxInstitutions) * 100 : 0}%`,
                                    backgroundColor: colors.warning,
                                  },
                                ]}
                              />
                            </View>
                          </View>
                          <Text style={styles.dailyUsersValue}>{day.newUsers}</Text>
                          <Text style={styles.dailyInstValue}>{day.newInstitutions}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: colors.primary }]} />
                    <Text style={styles.legendText}>Kullanıcılar</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: colors.warning }]} />
                    <Text style={styles.legendText}>Kurumlar</Text>
                  </View>
                </View>
              </Card>
            )}
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
  statsCard: {
    marginBottom: 16,
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    marginBottom: 12,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  summarySubLabel: {
    fontSize: 10,
    color: colors.textSecondary + 'CC',
    textAlign: 'center',
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 16,
    minHeight: 200,
  },
  chartItem: {
    alignItems: 'center',
    marginRight: 8,
    minWidth: 50,
  },
  barContainer: {
    width: 30,
    height: 120,
    backgroundColor: colors.background,
    borderRadius: 4,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  barValue: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  dailyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 16,
    minHeight: 200,
  },
  dailyItem: {
    alignItems: 'center',
    marginRight: 8,
    minWidth: 50,
  },
  dailyDate: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  dailyBars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  dailyBarContainer: {
    width: 15,
    height: 120,
    backgroundColor: colors.background,
    borderRadius: 2,
    justifyContent: 'flex-end',
  },
  dailyBar: {
    width: '100%',
    borderRadius: 2,
    minHeight: 4,
  },
  dailyUsersValue: {
    fontSize: 9,
    color: colors.primary,
    fontWeight: '500',
  },
  dailyInstValue: {
    fontSize: 9,
    color: colors.warning,
    fontWeight: '500',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default AdminTimeStatsScreen;

