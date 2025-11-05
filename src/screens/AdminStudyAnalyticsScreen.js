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
import { supabase } from '../lib/supabase';
import { getAdminStudyAnalytics, getAdminInstitutions } from '../lib/adminApi';

const AdminStudyAnalyticsScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month'); // 'today', 'week', 'month', 'all'
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [institutions, setInstitutions] = useState([]);
  
  // İstatistikler
  const [overallStats, setOverallStats] = useState({
    totalStudyHours: 0,
    totalSessions: 0,
    averageSessionDuration: 0,
    totalStudents: 0,
    averageSuccessRate: 0,
  });

  const [subjectStats, setSubjectStats] = useState([]);
  const [institutionComparison, setInstitutionComparison] = useState([]);
  const [dailyTrend, setDailyTrend] = useState([]);

  useEffect(() => {
    loadInstitutions();
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange, selectedInstitution]);

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

  const getDateRange = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let startDate = new Date();

    switch (timeRange) {
      case 'today':
        startDate = new Date(now);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'all':
        startDate = new Date(0); // Başlangıç
        break;
    }

    return { startDate, endDate: now };
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const result = await getAdminStudyAnalytics(selectedInstitution || null, timeRange);

      if (result.error) {
        throw new Error(result.error?.message || result.error || 'Analitikler yüklenemedi');
      }

      const studyLogs = result.data?.study_logs || [];
      const userIds = result.data?.user_ids || [];

      if (userIds.length === 0) {
        setOverallStats({
          totalStudyHours: 0,
          totalSessions: 0,
          averageSessionDuration: 0,
          totalStudents: 0,
          averageSuccessRate: 0,
        });
        setSubjectStats([]);
        setInstitutionComparison([]);
        setDailyTrend([]);
        setLoading(false);
        return;
      }

      calculateOverallStats(studyLogs, userIds);
      calculateSubjectStats(studyLogs);
      
      if (!selectedInstitution) {
        // Kurum karşılaştırması için institutions verisini kullan
        const institutions = result.data?.institutions || [];
        calculateInstitutionComparisonWithData(studyLogs, institutions);
      }
      
      calculateDailyTrend(studyLogs);

    } catch (error) {
      console.error('Analitikler yüklenirken hata:', error);
      Alert.alert('Hata', `Analitikler yüklenemedi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateOverallStats = (logs, userIds) => {
    const totalMinutes = logs.reduce((sum, log) => sum + (log.duration || 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    const totalSessions = logs.length;
    const averageSessionDuration = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;

    // Başarı oranı (toplam doğru / (doğru + yanlış))
    const totalCorrect = logs.reduce((sum, log) => sum + (log.correct_answers || 0), 0);
    const totalWrong = logs.reduce((sum, log) => sum + (log.wrong_answers || 0), 0);
    const totalAnswers = totalCorrect + totalWrong;
    const averageSuccessRate = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

    setOverallStats({
      totalStudyHours: totalHours,
      totalSessions,
      averageSessionDuration,
      totalStudents: userIds.length,
      averageSuccessRate,
    });
  };

  const calculateSubjectStats = (logs) => {
    const subjectMap = {};

    logs.forEach(log => {
      const subject = log.subject || 'Belirtilmemiş';
      if (!subjectMap[subject]) {
        subjectMap[subject] = {
          subject,
          totalMinutes: 0,
          sessionCount: 0,
          totalCorrect: 0,
          totalWrong: 0,
        };
      }

      subjectMap[subject].totalMinutes += log.duration || 0;
      subjectMap[subject].sessionCount += 1;
      subjectMap[subject].totalCorrect += log.correct_answers || 0;
      subjectMap[subject].totalWrong += log.wrong_answers || 0;
    });

    const stats = Object.values(subjectMap).map(stat => ({
      ...stat,
      totalHours: Math.round((stat.totalMinutes / 60) * 10) / 10,
      averageDuration: stat.sessionCount > 0 ? Math.round(stat.totalMinutes / stat.sessionCount) : 0,
      successRate: (stat.totalCorrect + stat.totalWrong) > 0
        ? Math.round((stat.totalCorrect / (stat.totalCorrect + stat.totalWrong)) * 100)
        : 0,
    }));

    // En çok çalışılan derslere göre sırala
    stats.sort((a, b) => b.totalMinutes - a.totalMinutes);

    setSubjectStats(stats);
  };

  const calculateInstitutionComparisonWithData = async (logs, institutions) => {
    try {
      if (!institutions || institutions.length === 0) {
        setInstitutionComparison([]);
        return;
      }

      // Kurum karşılaştırması için her kurumun öğrencilerini bulup hesaplama yap
      // Bu işlem için Edge Function'dan gelen verileri kullanıyoruz
      // Ancak kurum üyelerini frontend'de hesaplamak yerine, basitleştirilmiş bir yaklaşım kullanıyoruz
      
      // Şimdilik kurum karşılaştırmasını devre dışı bırakıyoruz
      // Gelecekte Edge Function'a kurum üyelerini de ekleyebiliriz
      setInstitutionComparison([]);
    } catch (error) {
      console.error('Kurum karşılaştırması hesaplanırken hata:', error);
      setInstitutionComparison([]);
    }
  };

  const calculateDailyTrend = (logs) => {
    const dayMap = {};

    logs.forEach(log => {
      const date = new Date(log.study_date);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!dayMap[dateKey]) {
        dayMap[dateKey] = {
          date: dateKey,
          totalMinutes: 0,
          sessionCount: 0,
        };
      }

      dayMap[dateKey].totalMinutes += log.duration || 0;
      dayMap[dateKey].sessionCount += 1;
    });

    const trend = Object.values(dayMap)
      .map(day => ({
        ...day,
        totalHours: Math.round((day.totalMinutes / 60) * 10) / 10,
        dateLabel: new Date(day.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setDailyTrend(trend);
  };

  const formatMinutes = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}s ${mins}dk`;
    }
    return `${mins}dk`;
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
          <Text style={styles.headerTitle}>Çalışma Analitikleri</Text>
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
        </Card>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Yükleniyor...</Text>
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Genel İstatistikler */}
            <Card style={styles.statsCard}>
              <Text style={styles.cardTitle}>📊 Genel İstatistikler</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Ionicons name="time-outline" size={24} color={colors.primary} />
                  <Text style={styles.statNumber}>{overallStats.totalStudyHours}</Text>
                  <Text style={styles.statLabel}>Toplam Çalışma Saati</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="calendar-outline" size={24} color={colors.success} />
                  <Text style={styles.statNumber}>{overallStats.totalSessions}</Text>
                  <Text style={styles.statLabel}>Toplam Oturum</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="hourglass-outline" size={24} color={colors.warning} />
                  <Text style={styles.statNumber}>{formatMinutes(overallStats.averageSessionDuration)}</Text>
                  <Text style={styles.statLabel}>Ortalama Süre</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="school-outline" size={24} color={colors.info} />
                  <Text style={styles.statNumber}>{overallStats.totalStudents}</Text>
                  <Text style={styles.statLabel}>Aktif Öğrenci</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="trophy-outline" size={24} color={colors.success} />
                  <Text style={styles.statNumber}>%{overallStats.averageSuccessRate}</Text>
                  <Text style={styles.statLabel}>Ortalama Başarı</Text>
                </View>
              </View>
            </Card>

            {/* Ders Bazlı İstatistikler */}
            <Card style={styles.statsCard}>
              <Text style={styles.cardTitle}>📚 Ders Bazlı Raporlar</Text>
              {subjectStats.length === 0 ? (
                <Text style={styles.emptyText}>Veri bulunamadı</Text>
              ) : (
                subjectStats.slice(0, 10).map((stat, index) => (
                  <View key={stat.subject} style={styles.subjectRow}>
                    <View style={styles.subjectRank}>
                      <Text style={styles.rankNumber}>#{index + 1}</Text>
                    </View>
                    <View style={styles.subjectInfo}>
                      <Text style={styles.subjectName}>{stat.subject}</Text>
                      <View style={styles.subjectMeta}>
                        <Text style={styles.subjectMetaText}>
                          {stat.totalHours}s • {stat.sessionCount} oturum
                        </Text>
                        <Text style={styles.subjectMetaText}>
                          Başarı: %{stat.successRate}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </Card>

            {/* Kurum Karşılaştırması */}
            {!selectedInstitution && institutionComparison.length > 0 && (
              <Card style={styles.statsCard}>
                <Text style={styles.cardTitle}>🏫 Kurum Karşılaştırması</Text>
                {institutionComparison.slice(0, 5).map((inst, index) => (
                  <View key={inst.institutionName} style={styles.institutionRow}>
                    <View style={styles.institutionRank}>
                      <Text style={styles.rankNumber}>#{index + 1}</Text>
                    </View>
                    <View style={styles.institutionInfo}>
                      <Text style={styles.institutionName}>{inst.institutionName}</Text>
                      <View style={styles.institutionMeta}>
                        <Text style={styles.institutionMetaText}>
                          {inst.totalHours}s • {inst.sessionCount} oturum • {inst.studentCount} öğrenci
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </Card>
            )}

            {/* Günlük Trend */}
            {dailyTrend.length > 0 && (
              <Card style={styles.statsCard}>
                <Text style={styles.cardTitle}>📈 Günlük Trend</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.trendContainer}>
                    {dailyTrend.slice(-14).map((day) => (
                      <View key={day.date} style={styles.trendItem}>
                        <Text style={styles.trendDate}>{day.dateLabel}</Text>
                        <View style={styles.trendBarContainer}>
                          <View
                            style={[
                              styles.trendBar,
                              {
                                height: `${Math.min((day.totalHours / Math.max(...dailyTrend.map(d => d.totalHours))) * 100, 100)}%`,
                                backgroundColor: colors.primary,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.trendHours}>{day.totalHours}s</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: 16,
  },
  subjectRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subjectRank: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subjectMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subjectMetaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  institutionRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  institutionRank: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  institutionInfo: {
    flex: 1,
  },
  institutionName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  institutionMeta: {
    flexDirection: 'row',
  },
  institutionMetaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 16,
  },
  trendItem: {
    alignItems: 'center',
    marginRight: 8,
    minWidth: 50,
  },
  trendDate: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  trendBarContainer: {
    width: 30,
    height: 100,
    backgroundColor: colors.background,
    borderRadius: 4,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  trendBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  trendHours: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});

export default AdminStudyAnalyticsScreen;

