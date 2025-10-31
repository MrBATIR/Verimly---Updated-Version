import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_COLORS, COLORS } from '../constants/theme';
import { SIZES, SHADOWS } from '../constants/theme';
import Container from '../components/Container';
import Card from '../components/Card';
import { supabase } from '../lib/supabase';

const TeacherDashboardScreen = () => {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentAvatars, setStudentAvatars] = useState({});

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      
      // Öğretmenin bağlı öğrencilerini yükle
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Öğretmenin öğrencilerini getir
      const { data: teacherConnections, error: connectionError } = await supabase
        .from('student_teachers')
        .select(`
          student_id,
          teachers!inner(user_id)
        `)
        .eq('teachers.user_id', user.id)
        .eq('approval_status', 'approved');

      if (connectionError) {
        console.error('Connection error:', connectionError);
        return;
      }

      const connectedStudentIds = teacherConnections?.map(conn => conn.student_id) || [];
      
      // Öğrenci profil verilerini al
      const { data: studentProfiles, error } = await supabase
        .from('user_profiles')
        .select('user_id, selected_avatar')
        .in('user_id', connectedStudentIds);

      if (error) {
        console.error('Öğrenci profilleri yüklenirken hata:', error);
        return;
      }

      // Avatar verilerini state'e kaydet
      const avatarMap = {};
      studentProfiles?.forEach(profile => {
        avatarMap[profile.user_id] = profile.selected_avatar;
      });
      
      setStudentAvatars(avatarMap);

      // Öğrenci verilerini formatla (şimdilik demo veri)
      const formattedStudents = connectedStudentIds.map((studentId, index) => ({
        id: studentId,
        name: `Öğrenci ${index + 1}`,
        email: `ogrenci${index + 1}@example.com`,
        class: '12. Sınıf'
      }));

      setStudents(formattedStudents);
      setLoading(false);
    } catch (error) {
      console.error('Öğrenciler yüklenirken hata:', error);
      setLoading(false);
    }
  };

  return (
    <Container>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Öğretmen Dashboard</Text>
          <Text style={styles.subtitle}>Öğrenci Takip Sistemi</Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Ionicons name="people-outline" size={24} color={colors.primary} />
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Toplam Öğrenci</Text>
          </Card>
          
          <Card style={styles.statCard}>
            <Ionicons name="book-outline" size={24} color={colors.success} />
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Toplam Çalışma</Text>
          </Card>
        </View>

        {/* Students List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bağlı Öğrenciler</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
          ) : students.length > 0 ? (
            <View style={styles.studentsList}>
              {students.map((student) => (
                <Card key={student.id} style={styles.studentCard}>
                  <View style={styles.studentInfo}>
                    <View style={styles.studentAvatar}>
                      <Text style={styles.studentAvatarEmoji}>
                        {studentAvatars[student.id] || '👤'}
                      </Text>
                    </View>
                    <View style={styles.studentDetails}>
                      <Text style={styles.studentName}>{student.name}</Text>
                      <Text style={styles.studentEmail}>{student.email}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.viewButton}>
                    <Ionicons name="eye-outline" size={20} color={colors.primary} />
                    <Text style={styles.viewButtonText}>Görüntüle</Text>
                  </TouchableOpacity>
                </Card>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>Henüz bağlı öğrenci yok</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Container>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.padding,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: SIZES.padding,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: SIZES.h2,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    padding: SIZES.padding,
  },
  sectionTitle: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  studentsList: {
    gap: 12,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SIZES.padding,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarEmoji: {
    fontSize: 20,
  },
  studentDetails: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  loadingText: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
  },
  studentName: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: SIZES.radius,
    gap: 6,
  },
  viewButtonText: {
    fontSize: SIZES.small,
    fontWeight: '500',
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  emptyText: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    marginTop: 12,
  },
});

export default TeacherDashboardScreen;
