import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, Animated, Modal, Alert, Image, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_COLORS, COLORS } from '../constants/theme';
import { SIZES, SHADOWS } from '../constants/theme';
import Container from '../components/Container';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { StudyDetailModal } from '../components';
import { supabase } from '../lib/supabase';
import * as teacherApi from '../lib/teacherApi';
import { getGuidanceTeacherStudyLogs, getGuidanceTeacherStudents, getGuidanceTeacherStudentPlans, deleteGuidanceTeacherStudentPlans } from '../lib/adminApi';

// ActivityCard Component
const ActivityCard = ({ activity, onPress }) => {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };
  
  return (
    <Animated.View 
      style={[
        styles.activityTouchable,
        { transform: [{ scale: scaleAnim }] }
      ]}
    >
      <Pressable 
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.activityPressable,
          pressed && styles.activityPressed
        ]}
      >
        <Card style={styles.activityCard}>
          <View style={styles.activityInfo}>
            <Text style={styles.activityStudent}>{activity.studentName}</Text>
            <Text style={styles.activitySubject}>{activity.subject}</Text>
            <Text style={styles.activityTime}>{activity.time}</Text>
          </View>
          <View style={styles.activityStats}>
            <Text style={styles.activityDuration}>{activity.duration}dk</Text>
            <Text style={styles.activityFocus}>Odak: {activity.focus}/10</Text>
          </View>
        </Card>
      </Pressable>
    </Animated.View>
  );
};

const TeacherHomeScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const [stats, setStats] = useState({
    totalStudents: 0,
    weeklyStudies: 0,
    avgFocus: 0,
    todayStudies: 0
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedStudy, setSelectedStudy] = useState(null);
  const [teacherName, setTeacherName] = useState('Öğretmen');
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [teacherBranch, setTeacherBranch] = useState('');
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [students, setStudents] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [planTitle, setPlanTitle] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planDate, setPlanDate] = useState(new Date());
  const [planType, setPlanType] = useState('daily'); // 'daily' or 'weekly'
  const [showStudentPlansModal, setShowStudentPlansModal] = useState(false);
  const [studentPlans, setStudentPlans] = useState([]);
  const [studentPlansLoading, setStudentPlansLoading] = useState(false);
  const [showCompletedDailyPlans, setShowCompletedDailyPlans] = useState(false);
  const [showCompletedWeeklyPlans, setShowCompletedWeeklyPlans] = useState(false);
  const [expandedPlans, setExpandedPlans] = useState(new Set());
  const [planSearchQuery, setPlanSearchQuery] = useState('');
  const [isGuidanceTeacher, setIsGuidanceTeacher] = useState(false);

  useEffect(() => {
    loadTeacherData();
    loadPendingRequestsCount();
  }, []);

  // Her 30 saniyede bir istek sayısını kontrol et
  useEffect(() => {
    const interval = setInterval(() => {
      loadPendingRequestsCount();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Sayfa her odaklandığında verileri yenile
  useFocusEffect(
    React.useCallback(() => {
      loadTeacherData();
    }, [])
  );

  // Real-time güncelleme için interval ekle
  useEffect(() => {
    // Her 60 saniyede bir verileri kontrol et
    const interval = setInterval(() => {
      loadTeacherData();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const loadPendingRequests = async () => {
    try {
      setRequestsLoading(true);
      const result = await teacherApi.getPendingRequests();
      
      if (result.success) {
        setPendingRequests(result.data || []);
      } else {
        console.error('İstekler yüklenirken hata:', result.error);
        Alert.alert('Hata', result.error);
      }
    } catch (error) {
      console.error('İstekler yüklenirken hata:', error);
      Alert.alert('Hata', 'Bir hata oluştu.');
    } finally {
      setRequestsLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      setPlansLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı');
        setPlansLoading(false);
        return;
      }

      // Öğretmen ID'sini al
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (teacherError || !teacherData) {
        console.error('Öğretmen bulunamadı:', teacherError);
        Alert.alert('Hata', 'Öğretmen bilgisi bulunamadı');
        setPlansLoading(false);
        return;
      }

      let studentIds = [];
      let isGuidanceTeacherLocal = false;

      // Rehber öğretmen kontrolü - Kurumunun rehber öğretmeni mi?
      const { data: institutionData, error: institutionError } = await supabase
        .from('institutions')
        .select('id, name')
        .eq('guidance_teacher_id', teacherData.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!institutionError && institutionData) {
        isGuidanceTeacherLocal = true;
        
        // Rehber öğretmen - Kurumundaki tüm öğrencilerin planlarını göster
        const { data: institutionMemberships, error: membershipError } = await supabase
          .from('institution_memberships')
          .select('user_id')
          .eq('institution_id', institutionData.id)
          .eq('role', 'student')
          .eq('is_active', true);

        if (!membershipError && institutionMemberships?.length > 0) {
          studentIds = institutionMemberships.map(m => m.user_id).filter(Boolean);
        }
      } else {
        // Normal öğretmen - Bağlı öğrencileri al
        const { data: studentConnections, error: studentsError } = await supabase
          .from('student_teachers')
          .select('student_id')
          .eq('teacher_id', teacherData.id)
          .eq('is_active', true)
          .order('join_date', { ascending: false });

        if (studentsError) {
          console.error('Öğrenciler yüklenirken hata:', studentsError);
          Alert.alert('Hata', 'Bağlı öğrenciler yüklenemedi: ' + studentsError.message);
          setPlansLoading(false);
          return;
        }

        if (!studentConnections || studentConnections.length === 0) {
          setStudents([]);
          setPlansLoading(false);
          return;
        }

        // Öğrenci ID'lerini al
        const studentIds = studentConnections.map(conn => conn.student_id).filter(Boolean);

        // Öğrenci profil verilerini al
        const { data: studentProfiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_id, name, email, selected_avatar')
          .in('user_id', studentIds);

        if (profileError) {
          console.error('Öğrenci profilleri yüklenirken hata:', profileError);
          Alert.alert('Hata', 'Öğrenci profilleri yüklenemedi: ' + profileError.message);
          setPlansLoading(false);
          return;
        }

        // Öğrenci verilerini formatla
        const studentsData = (studentProfiles || []).map(profile => ({
          id: profile.user_id,
          name: profile.name || 'İsimsiz Öğrenci',
          email: profile.email || '',
          avatar_url: profile.selected_avatar || null,
        }));

        setStudents(studentsData);
        setPlansLoading(false);
        return;
      }

      if (studentIds.length === 0) {
        setStudents([]);
        setPlansLoading(false);
        return;
      }

      // Öğrenci profil verilerini al
      // Rehber öğretmen için Edge Function kullan, normal öğretmen için normal supabase
      let studentProfiles = [];
      let profileError = null;
      
      if (isGuidanceTeacherLocal && institutionData) {
        // Rehber öğretmen - Edge Function ile öğrencileri getir
        const result = await getGuidanceTeacherStudents(institutionData.id);
        
        if (result.error) {
          console.error('Rehber öğretmen öğrencileri yüklenirken hata:', result.error);
          profileError = result.error;
        } else {
          const studentsData = result.data?.data || result.data || [];
          // Edge Function'dan gelen öğrenci verilerini user_profiles formatına çevir
          // Edge Function artık user_id alanını da döndürüyor (institution_memberships'ten)
          studentProfiles = studentsData.map(student => ({
            user_id: student.user_id || student.id, // user_id artık direkt geliyor
            name: student.name || 'İsimsiz Öğrenci',
            email: student.email || '',
            selected_avatar: null, // Edge Function'dan avatar bilgisi gelmiyor, gerekirse eklenebilir
          }));
        }
      } else {
        // Normal öğretmen - Normal supabase kullan
        const { data, error } = await supabase
          .from('user_profiles')
          .select('user_id, name, email, selected_avatar')
          .in('user_id', studentIds);
        
        studentProfiles = data || [];
        profileError = error;
      }

      if (profileError) {
        console.error('Öğrenci profilleri yüklenirken hata:', profileError);
        Alert.alert('Hata', 'Öğrenci profilleri yüklenemedi: ' + profileError.message);
        setPlansLoading(false);
        return;
      }

      const studentsData = (studentProfiles || []).map(profile => ({
        id: profile.user_id,
        name: profile.name || 'İsimsiz Öğrenci',
        email: profile.email,
        avatar_url: profile.selected_avatar || null,
      }));

      setStudents(studentsData);
    } catch (error) {
      console.error('Öğrenciler yüklenirken hata:', error);
      Alert.alert('Hata', 'Öğrenciler yüklenirken bir hata oluştu: ' + error.message);
    } finally {
      setPlansLoading(false);
    }
  };

  const handleCreatePlan = (student) => {
    setSelectedStudent(student);
    setPlanTitle('Bu gün yapılacaklar'); // Default to daily
    setPlanDescription('');
    setPlanDate(new Date());
    setPlanType('daily'); // Default to daily
    setShowPlanForm(true);
  };

  const handleViewStudentPlans = (student) => {
    setSelectedStudent(student);
    setShowStudentPlansModal(true);
    loadStudentPlans(student.id);
  };

  const loadStudentPlans = async (studentId) => {
    setStudentPlansLoading(true);
    try {
      // Rehber öğretmen kontrolü yap
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStudentPlansLoading(false);
        return;
      }

      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (teacherError || !teacherData) {
        console.error('Öğretmen bulunamadı:', teacherError);
        setStudentPlansLoading(false);
        return;
      }

      // Rehber öğretmen kontrolü
      let isGuidanceTeacherLocal = false;
      const { data: institutionData } = await supabase
        .from('institutions')
        .select('id')
        .eq('guidance_teacher_id', teacherData.id)
        .eq('is_active', true)
        .maybeSingle();

      if (institutionData) {
        isGuidanceTeacherLocal = true;
        setIsGuidanceTeacher(true);
      }

      // Planları al - Rehber öğretmen için Edge Function kullan
      if (isGuidanceTeacherLocal && institutionData) {
        // Rehber öğretmen - Edge Function kullan
        const result = await getGuidanceTeacherStudentPlans(studentId, institutionData.id);
        
        if (result.error) {
          console.error('Rehber öğretmen planları yüklenirken hata:', result.error);
          setStudentPlans({
            daily: [],
            weekly: []
          });
        } else {
          const plansData = result.data?.data || result.data || { daily: [], weekly: [] };
          setStudentPlans({
            daily: plansData.daily || [],
            weekly: plansData.weekly || []
          });
        }
      } else {
        // Normal öğretmen - Normal supabase kullan
        const queryClient = supabase;

        // Günlük planları al
        const { data: dailyPlans, error: dailyError } = await queryClient
          .from('student_daily_plans')
          .select('*')
          .eq('student_id', studentId)
          .order('plan_date', { ascending: false });

        if (dailyError) {
          console.error('Günlük planlar yüklenirken hata:', dailyError);
        }

        // Haftalık planları al
        const { data: weeklyPlans, error: weeklyError } = await queryClient
          .from('student_weekly_plans')
          .select('*')
          .eq('student_id', studentId)
          .order('week_start_date', { ascending: false });

        if (weeklyError) {
          console.error('Haftalık planlar yüklenirken hata:', weeklyError);
        }

        // Rehber öğretmen kontrolü - Planları yükledikten sonra her plan için rehber öğretmen kontrolü yap
        const enrichedDailyPlans = await Promise.all((dailyPlans || []).map(async (plan) => {
          if (plan.teacher_id) {
            const { data: guidanceInstitution } = await supabase
              .from('institutions')
              .select('id')
              .eq('guidance_teacher_id', plan.teacher_id)
              .eq('is_active', true)
              .maybeSingle();
            
            return {
              ...plan,
              isGuidanceTeacher: !!guidanceInstitution
            };
          }
          return plan;
        }));

        const enrichedWeeklyPlans = await Promise.all((weeklyPlans || []).map(async (plan) => {
          if (plan.teacher_id) {
            const { data: guidanceInstitution } = await supabase
              .from('institutions')
              .select('id')
              .eq('guidance_teacher_id', plan.teacher_id)
              .eq('is_active', true)
              .maybeSingle();
            
            return {
              ...plan,
              isGuidanceTeacher: !!guidanceInstitution
            };
          }
          return plan;
        }));

        setStudentPlans({
          daily: enrichedDailyPlans || [],
          weekly: enrichedWeeklyPlans || []
        });
      }
    } catch (error) {
      console.error('Öğrenci planları yüklenirken hata:', error);
      Alert.alert('Hata', 'Öğrenci planları yüklenemedi');
    } finally {
      setStudentPlansLoading(false);
    }
  };

  // Öğrenci planları için realtime güncelleme
  useEffect(() => {
    if (!showStudentPlansModal || !selectedStudent) return;
    
    // Rehber öğretmen için realtime kontrolü devre dışı bırak (Edge Function kullanıldığı için)
    // Normal öğretmenler için de interval süresini artır (10 saniye)
    if (isGuidanceTeacher) {
      return; // Rehber öğretmen için realtime kontrolü yapma
    }
    
    let lastCheckTime = Date.now();
    const interval = setInterval(async () => {
      try {
        // Sadece plan sayısını ve tamamlanma durumunu kontrol et
        const { data: dailyPlans } = await supabase
          .from('student_daily_plans')
          .select('id, is_completed')
          .eq('student_id', selectedStudent.id);

        const { data: weeklyPlans } = await supabase
          .from('student_weekly_plans')
          .select('id, is_completed')
          .eq('student_id', selectedStudent.id);

        // Mevcut planlarla karşılaştır (studentPlans state'ini direkt kullanmak yerine callback kullan)
        setStudentPlans(prevPlans => {
          const currentDaily = prevPlans.daily || [];
          const currentWeekly = prevPlans.weekly || [];

          // Değişiklik var mı kontrol et
          const dailyChanged = dailyPlans?.length !== currentDaily.length || 
            dailyPlans?.some(plan => {
              const current = currentDaily.find(p => p.id === plan.id);
              return current && current.is_completed !== plan.is_completed;
            });

          const weeklyChanged = weeklyPlans?.length !== currentWeekly.length || 
            weeklyPlans?.some(plan => {
              const current = currentWeekly.find(p => p.id === plan.id);
              return current && current.is_completed !== plan.is_completed;
            });

          // Değişiklik varsa tam yükleme yap
          if (dailyChanged || weeklyChanged) {
            // setTimeout ile asenkron yükleme yap (sonsuz döngüyü önlemek için)
            setTimeout(() => {
              loadStudentPlans(selectedStudent.id);
            }, 100);
          }

          return prevPlans; // State'i değiştirme, sadece kontrol et
        });
      } catch (error) {
        // Hata durumunda sessizce devam et
        console.error('Plan kontrolü hatası:', error);
      }
    }, 10000); // 10 saniyede bir kontrol et (3 saniye çok sık)

    return () => clearInterval(interval);
  }, [showStudentPlansModal, selectedStudent?.id, isGuidanceTeacher]); // studentPlans'ı dependency'den kaldır

  const handleSavePlan = async () => {
    if (!planTitle.trim() || !planDescription.trim()) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
      return;
    }

    try {
      const result = await teacherApi.createStudentPlan(
        selectedStudent.id,
        planTitle,
        planDescription,
        planDate,
        planType
      );

      if (result.success) {
        Alert.alert('Başarılı', `${selectedStudent.name} için ${planType === 'daily' ? 'günlük' : 'haftalık'} plan oluşturuldu!`);
        setShowPlanForm(false);
        setSelectedStudent(null);
        setPlanTitle('');
        setPlanDescription('');
        setPlanType('daily');
      } else {
        Alert.alert('Hata', result.error);
      }
    } catch (error) {
      Alert.alert('Hata', 'Plan oluşturulurken bir hata oluştu.');
    }
  };

  const togglePlanExpansion = (planId) => {
    setExpandedPlans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(planId)) {
        newSet.delete(planId);
      } else {
        newSet.add(planId);
      }
      return newSet;
    });
  };

  const handleDeleteTeacherPlan = async (plan, planType) => {
    Alert.alert(
      'Planı Sil',
      'Bu planı silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              // Öğretmen ID'sini al
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) {
                Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı');
                return;
              }

              const { data: teacherData } = await supabase
                .from('teachers')
                .select('id')
                .eq('user_id', user.id)
                .single();

              // Rehber öğretmen kontrolü
              let institutionData = null;
              if (isGuidanceTeacher && teacherData) {
                const { data: instData } = await supabase
                  .from('institutions')
                  .select('id')
                  .eq('guidance_teacher_id', teacherData.id)
                  .eq('is_active', true)
                  .maybeSingle();
                institutionData = instData;
              }

              // Rehber öğretmen ise Edge Function kullan
              if (isGuidanceTeacher && institutionData) {
                const result = await deleteGuidanceTeacherStudentPlans([plan.id], institutionData.id, planType);
                
                if (result.error) {
                  throw new Error(result.error.message || 'Plan silinemedi');
                }
              } else {
                // Normal öğretmen
                const tableName = planType === 'daily' ? 'student_daily_plans' : 'student_weekly_plans';
                const { error } = await supabase
                  .from(tableName)
                  .delete()
                  .eq('id', plan.id)
                  .select();

                if (error) throw error;
              }

              Alert.alert('Başarılı', 'Plan silindi!');
              loadStudentPlans(selectedStudent.id);
            } catch (error) {
              console.error('Plan silinirken hata:', error);
              Alert.alert('Hata', `Plan silinemedi: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const handleDeleteAllCompletedPlans = async (planType) => {
    const completedPlans = planType === 'daily' 
      ? studentPlans.daily?.filter(plan => plan.is_completed && plan.teacher_id) || []
      : studentPlans.weekly?.filter(plan => plan.is_completed && plan.teacher_id) || [];

    if (completedPlans.length === 0) {
      Alert.alert('Bilgi', 'Silinecek tamamlanan plan bulunamadı.');
      return;
    }

    Alert.alert(
      'Tüm Tamamlanan Planları Sil',
      `${completedPlans.length} adet tamamlanan ${planType === 'daily' ? 'günlük' : 'haftalık'} planı silmek istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Tümünü Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              // Öğretmen ID'sini al
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) {
                Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı');
                return;
              }

              const { data: teacherData } = await supabase
                .from('teachers')
                .select('id')
                .eq('user_id', user.id)
                .single();

              // Rehber öğretmen kontrolü
              let institutionData = null;
              if (isGuidanceTeacher && teacherData) {
                const { data: instData } = await supabase
                  .from('institutions')
                  .select('id')
                  .eq('guidance_teacher_id', teacherData.id)
                  .eq('is_active', true)
                  .maybeSingle();
                institutionData = instData;
              }

              const planIds = completedPlans.map(plan => plan.id);

              // Rehber öğretmen ise Edge Function kullan
              if (isGuidanceTeacher && institutionData) {
                const result = await deleteGuidanceTeacherStudentPlans(planIds, institutionData.id, planType);
                
                if (result.error) {
                  throw new Error(result.error.message || 'Planlar silinemedi');
                }
              } else {
                // Normal öğretmen
                const tableName = planType === 'daily' ? 'student_daily_plans' : 'student_weekly_plans';
                const { error } = await supabase
                  .from(tableName)
                  .delete()
                  .in('id', planIds)
                  .select();

                if (error) throw error;
              }

              Alert.alert('Başarılı', `${completedPlans.length} adet plan silindi!`);
              loadStudentPlans(selectedStudent.id);
            } catch (error) {
              console.error('Planlar silinirken hata:', error);
              Alert.alert('Hata', `Planlar silinemedi: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const handleApproveRequest = async (requestId, studentName, requestType) => {
    const isConnectRequest = requestType === 'connect';
    Alert.alert(
      isConnectRequest ? 'Bağlantı İsteğini Onayla' : 'Bağlantı Kesme İsteğini Onayla',
      `${studentName} öğrencisinin ${isConnectRequest ? 'bağlantı' : 'bağlantı kesme'} isteğini onaylamak istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Onayla',
          onPress: async () => {
            try {
              const result = await teacherApi.approveStudentRequest(requestId);
              
              if (result.success) {
                Alert.alert('Başarılı', result.message);
                loadPendingRequests(); // İstekleri yenile
                loadPendingRequestsCount(); // Sayacı güncelle
              } else {
                Alert.alert('Hata', result.error);
              }
            } catch (error) {
              Alert.alert('Hata', 'Bir hata oluştu.');
            }
          }
        }
      ]
    );
  };

  const handleRejectRequest = async (requestId, studentName, requestType) => {
    const isConnectRequest = requestType === 'connect';
    Alert.alert(
      isConnectRequest ? 'Bağlantı İsteğini Reddet' : 'Bağlantı Kesme İsteğini Reddet',
      `${studentName} öğrencisinin ${isConnectRequest ? 'bağlantı' : 'bağlantı kesme'} isteğini reddetmek istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Reddet',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await teacherApi.rejectStudentRequest(requestId);
              
              if (result.success) {
                Alert.alert('Başarılı', result.message);
                loadPendingRequests(); // İstekleri yenile
                loadPendingRequestsCount(); // Sayacı güncelle
              } else {
                Alert.alert('Hata', result.error);
              }
            } catch (error) {
              Alert.alert('Hata', 'Bir hata oluştu.');
            }
          }
        }
      ]
    );
  };

  const loadPendingRequestsCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return;
      }


      // Önce öğretmen ID'sini al
      const { data: teacher, error: teacherError } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (teacherError || !teacher) {
        return;
      }

      const { count, error } = await supabase
        .from('student_teachers')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', teacher.id)
        .eq('approval_status', 'pending');

      if (error) {
        console.error('İstek sayısı yüklenirken hata:', error);
        return;
      }

      setPendingRequestsCount(count || 0);
    } catch (error) {
      console.error('İstek sayısı yüklenirken hata:', error);
    }
  };

  const loadTeacherData = async () => {
    try {
      setLoading(true);
      
      // Öğretmenin öğrencilerini yükle
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Öğretmen bilgilerini al
      const teacherResult = await supabase
        .from('teachers')
        .select('id, name, branch')
        .eq('user_id', user.id)
        .single();
      
      if (!teacherResult.data) {
        setLoading(false);
        return;
      }

      // Öğretmen adını ve branşını set et
      if (teacherResult.data?.name) {
        setTeacherName(teacherResult.data.name);
      }
      if (teacherResult.data?.branch) {
        setTeacherBranch(teacherResult.data.branch);
      }
      
      let connectedStudentIds = [];
      let isGuidanceTeacher = false;

      // Rehber öğretmen kontrolü - Kurumunun rehber öğretmeni mi?
      const { data: institutionData, error: institutionError } = await supabase
        .from('institutions')
        .select('id, name')
        .eq('guidance_teacher_id', teacherResult.data.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!institutionError && institutionData) {
        isGuidanceTeacher = true;
        
        // Rehber öğretmen - Edge Function ile kurumundaki tüm öğrencileri göster
        const result = await getGuidanceTeacherStudents(institutionData.id);
        
        if (result.error) {
          console.error('Rehber öğretmen öğrencileri yüklenirken hata:', result.error);
          setLoading(false);
          return;
        }

        // Edge Function'dan gelen öğrenci listesini formatla
        const studentsData = result.data?.data || result.data || [];
        connectedStudentIds = studentsData.map(s => s.user_id).filter(Boolean);
      } else {
        // Normal öğretmen - Bağlı öğrencileri al
        const { data: students, error: studentsError } = await supabase
          .from('student_teachers')
          .select(`
            id,
            student_id
          `)
          .eq('teacher_id', teacherResult.data.id)
          .eq('is_active', true);

        if (studentsError) {
          console.error('Öğrenciler yüklenirken hata:', studentsError);
          setLoading(false);
          return;
        }

        connectedStudentIds = students?.map(student => student.student_id) || [];
      }
      
      // Öğrenci yoksa istatistikleri sıfırla ve çık
      if (connectedStudentIds.length === 0) {
        setStats({
          totalStudents: 0,
          weeklyStudies: 0,
          avgFocus: 0,
          todayStudies: 0
        });
        setRecentActivities([]);
        setLoading(false);
        return;
      }

      // Öğrenci profil verilerini al
      // Rehber öğretmen için Edge Function'dan gelen veriler zaten name ve email içeriyor
      // Normal öğretmen için normal supabase kullan
      let studentProfiles = [];
      
      if (isGuidanceTeacher) {
        // Rehber öğretmen - Edge Function'dan gelen verileri kullan
        const result = await getGuidanceTeacherStudents(institutionData.id);
        if (!result.error && result.data) {
          const studentsData = result.data?.data || result.data || [];
          studentProfiles = studentsData.map(s => ({
            user_id: s.user_id,
            name: s.name,
            email: s.email
          }));
        }
      } else {
        // Normal öğretmen - Normal supabase kullan
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_id, name, email')
          .in('user_id', connectedStudentIds);

        if (profileError) {
          console.error('Öğrenci profilleri yüklenirken hata:', profileError);
        } else {
          studentProfiles = profiles || [];
        }
      }

      // Gerçek istatistikleri hesapla
      let totalStudies = 0;
      let totalTime = 0;
      let totalFocus = 0;
      const recentActivities = [];

      // Bugünün tarih aralığını hesapla (timezone sorununu çözmek için)
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      // Rehber öğretmen için Edge Function kullan, normal öğretmen için normal supabase
      if (isGuidanceTeacher && institutionData) {
        // Rehber öğretmen - Edge Function ile tüm kurum öğrencilerinin çalışma kayıtlarını getir
        const result = await getGuidanceTeacherStudyLogs(institutionData.id);
        
        if (result.error) {
          console.error('Rehber öğretmen çalışma kayıtları yüklenirken hata:', result.error);
        } else {
          const allStudyLogs = result.data?.data || result.data || [];
          
          // İstatistikleri topla
          totalStudies = allStudyLogs.length;
          totalTime = allStudyLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
          totalFocus = allStudyLogs.reduce((sum, log) => sum + (log.focus_level || 0), 0);
          
          // Son aktiviteleri ekle
          allStudyLogs.forEach(log => {
            // Gerçek öğrenci ismini user_profiles'den çek
            const studentProfile = studentProfiles?.find(p => p.user_id === log.user_id);
            const studentName = studentProfile?.name || 'Öğrenci';
            
            recentActivities.push({
              id: log.id,
              studentName: studentName,
              subject: log.subject || 'Bilinmeyen',
              time: new Date(log.study_date).toLocaleDateString('tr-TR') + ' ' + new Date(log.study_date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
              duration: log.duration || 0,
              focus: log.focus_level || 0,
              // Modal için gerekli ek alanlar
              study_type: log.study_type || 'test',
              topic: log.topic || '',
              correct: log.correct_answers || 0,
              wrong: log.wrong_answers || 0,
              empty: log.empty_answers || 0,
              focus_level: log.focus_level || 0,
              notes: log.notes || '',
              study_date: log.study_date,
              created_at: log.created_at
            });
          });
        }
      } else {
        // Normal öğretmen - Her öğrenci için ayrı ayrı çalışma verilerini getir
        for (const studentId of connectedStudentIds) {
          const { data: studyLogs, error: studyError } = await supabase
            .from('study_logs')
            .select(`
              id,
              duration, 
              focus_level, 
              subject, 
              study_date,
              study_type,
              topic,
              correct_answers,
              wrong_answers,
              empty_answers,
              notes,
              created_at
            `)
            .eq('user_id', studentId)
            .order('study_date', { ascending: false })
            .limit(100);

          if (studyError) {
            console.error(`Öğrenci ${studentId} için çalışma verileri yüklenirken hata:`, studyError);
            continue;
          }

          // İstatistikleri topla
          totalStudies += studyLogs?.length || 0;
          totalTime += studyLogs?.reduce((sum, log) => sum + (log.duration || 0), 0) || 0;
          totalFocus += studyLogs?.reduce((sum, log) => sum + (log.focus_level || 0), 0) || 0;

          // Son aktiviteleri ekle
          studyLogs?.forEach(log => {
            // Gerçek öğrenci ismini user_profiles'den çek
            const studentProfile = studentProfiles?.find(p => p.user_id === studentId);
            const studentName = studentProfile?.name || 'Öğrenci';
            
            recentActivities.push({
              id: log.id,
              studentName: studentName,
              subject: log.subject || 'Bilinmeyen',
              time: new Date(log.study_date).toLocaleDateString('tr-TR') + ' ' + new Date(log.study_date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
              duration: log.duration || 0,
              focus: log.focus_level || 0,
              // Modal için gerekli ek alanlar
              study_type: log.study_type || 'test',
              topic: log.topic || '',
              correct: log.correct_answers || 0,
              wrong: log.wrong_answers || 0,
              empty: log.empty_answers || 0,
              focus_level: log.focus_level || 0,
              notes: log.notes || '',
              study_date: log.study_date,
              created_at: log.created_at
            });
          });
        }
      }

      // Son 1 haftadaki odaklanma ortalamasını hesapla
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 7);
      
      const weeklyActivities = recentActivities.filter(activity => {
        const activityDate = new Date(activity.created_at);
        return activityDate >= weekStart;
      });
      
      const weeklyFocus = weeklyActivities.reduce((sum, activity) => sum + (activity.focus || 0), 0);
      const avgFocus = weeklyActivities.length > 0 ? weeklyFocus / weeklyActivities.length : 0;

      // Bugünkü çalışma sayısını hesapla
      const todayStudies = recentActivities.filter(activity => {
        const activityDate = new Date(activity.created_at);
        return activityDate.toDateString() === today.toDateString();
      }).length;

      // Bu haftaki çalışma sayısını hesapla
      const weeklyStudies = weeklyActivities.length;

      // İstatistikleri güncelle
      setStats(prev => ({
        ...prev,
        totalStudents: connectedStudentIds.length,
        weeklyStudies,
        avgFocus: Number(avgFocus.toFixed(1)),
        todayStudies
      }));

      // Son aktiviteleri güncelle - En son 10 aktiviteyi göster
      const sortedActivities = recentActivities
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10);
      setRecentActivities(sortedActivities);

      setLoading(false);
    } catch (error) {
      console.error('Öğretmen verileri yüklenirken hata:', error);
      setLoading(false);
    }
  };

  return (
    <Container>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerInfo}>
              <Text style={styles.greeting}>Merhaba, {teacherName}!</Text>
              {teacherBranch && (
                <Text style={styles.branch}>{teacherBranch} Öğretmeni</Text>
              )}
              <Text style={styles.subtitle}>Öğrenci takip sisteminiz</Text>
            </View>
            <View style={styles.headerRight}>
              {/* İstek Bildirimi - Sadece istek olduğunda görünür */}
              {pendingRequestsCount > 0 && (
                <TouchableOpacity 
                  style={styles.requestNotification}
                  onPress={() => {
                    setShowRequestsModal(true);
                    loadPendingRequests();
                  }}
                >
                  <Ionicons name="mail" size={20} color="#fff" />
                  <View style={styles.requestBadge}>
                    <Text style={styles.requestBadgeText}>
                      {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              
              <View style={styles.avatarContainer}>
                <Ionicons name="school" size={32} color={colors.primary} />
              </View>
            </View>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Ionicons name="people-outline" size={24} color={colors.primary} />
            <Text style={styles.statValue}>{stats.totalStudents}</Text>
            <Text style={styles.statLabel}>Toplam Öğrenci</Text>
          </Card>
          
          <Card style={styles.statCard}>
            <Ionicons name="book-outline" size={24} color={colors.success} />
            <Text style={styles.statValue}>{stats.weeklyStudies}</Text>
            <Text style={styles.statLabel}>Bu Haftaki Çalışma</Text>
          </Card>
        </View>

        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Ionicons name="flame-outline" size={24} color={colors.warning} />
            <Text style={styles.statValue}>{stats.avgFocus.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Ort. Odaklanma</Text>
          </Card>
          
          <Card style={styles.statCard}>
            <Ionicons name="today-outline" size={24} color={colors.info} />
            <Text style={styles.statValue}>{stats.todayStudies}</Text>
            <Text style={styles.statLabel}>Bugünkü Çalışma</Text>
          </Card>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hızlı Eylemler</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => {
                setShowPlansModal(true);
                loadStudents();
              }}
            >
              <Ionicons name="calendar-outline" size={24} color={colors.primary} />
              <Text style={styles.quickActionText}>Öğrenci Planları</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('TeacherMessage')}
            >
              <Ionicons name="chatbubbles-outline" size={24} color={colors.primary} />
              <Text style={styles.quickActionText}>Mesajlar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('TeacherReports')}
            >
              <Ionicons name="bar-chart-outline" size={24} color={colors.primary} />
              <Text style={styles.quickActionText}>Raporlar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('TeacherAdd')}
            >
              <Ionicons name="people-outline" size={24} color={colors.primary} />
              <Text style={styles.quickActionText}>Öğrenciler</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Son Aktiviteler</Text>
          
          {recentActivities.length > 0 ? (
            <ScrollView 
              style={styles.activitiesList}
              contentContainerStyle={styles.activitiesContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {recentActivities.map((activity, index) => (
                <ActivityCard 
                  key={index}
                  activity={activity}
                  onPress={() => {
                    setSelectedStudy(activity);
                    setModalVisible(true);
                  }}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>Henüz aktivite yok</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Detaylı Çalışma Modal */}
      <StudyDetailModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedStudy(null);
        }}
        study={selectedStudy}
        isDemo={false}
      />

      {/* İstekler Modal */}
      <Modal
        visible={showRequestsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRequestsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.requestsModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bekleyen İstekler</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowRequestsModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {requestsLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>İstekler yükleniyor...</Text>
              </View>
            ) : pendingRequests.filter(req => req.approval_status === 'pending').length > 0 ? (
              <ScrollView style={styles.requestsList} showsVerticalScrollIndicator={false}>
                {pendingRequests.filter(req => req.approval_status === 'pending').map((request) => (
                  <Card key={request.id} style={styles.requestCard}>
                    <View style={styles.requestHeader}>
                      <View style={styles.studentInfo}>
                        <View style={styles.avatarContainer}>
                          {request.students?.selected_avatar ? (
                            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                              <Text style={styles.avatarText}>
                                {request.students.selected_avatar}
                              </Text>
                            </View>
                          ) : (
                            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                              <Ionicons name="person" size={20} color="#fff" />
                            </View>
                          )}
                        </View>
                        <View style={styles.studentDetails}>
                          <Text style={styles.studentName}>
                            {request.students?.name || request.students?.user_metadata?.full_name || 'Bilinmeyen Öğrenci'}
                          </Text>
                          <Text style={styles.requestType}>
                            {request.request_type === 'connect' ? 'Bağlantı İsteği' : 'Bağlantı Kesme İsteği'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.requestActions}>
                      <Button
                        title="Onayla"
                        onPress={() => handleApproveRequest(request.id, request.students?.name || 'Öğrenci', request.request_type)}
                        style={styles.approveButton}
                      />
                      <Button
                        title="Reddet"
                        onPress={() => handleRejectRequest(request.id, request.students?.name || 'Öğrenci', request.request_type)}
                        variant="ghost"
                        style={styles.rejectButton}
                      />
                    </View>
                  </Card>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                <Text style={styles.emptyText}>Bekleyen istek yok</Text>
                <Text style={styles.emptySubtext}>Tüm istekler işlendi</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Öğrenci Planları Modal */}
      <Modal
        visible={showPlansModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPlansModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.plansModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Öğrenci Planları</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowPlansModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.plansContent}>
              {plansLoading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Öğrenciler yükleniyor...</Text>
                </View>
              ) : students.length > 0 ? (
                <>
                  {/* Arama Input */}
                  <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Öğrenci adı ile ara..."
                      value={planSearchQuery}
                      onChangeText={setPlanSearchQuery}
                      placeholderTextColor={colors.textSecondary}
                    />
                    {planSearchQuery.length > 0 && (
                      <TouchableOpacity
                        style={styles.clearSearchButton}
                        onPress={() => setPlanSearchQuery('')}
                      >
                        <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <ScrollView style={styles.studentsList} showsVerticalScrollIndicator={false}>
                    {students
                      .filter(student =>
                        student.name.toLowerCase().includes(planSearchQuery.toLowerCase()) ||
                        student.email?.toLowerCase().includes(planSearchQuery.toLowerCase())
                      )
                      .map((student) => (
                    <View key={student.id} style={styles.studentCard}>
                      <View style={styles.studentInfo}>
                        <View style={styles.avatarContainer}>
                          <Ionicons name="person" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.studentDetails}>
                          <Text style={styles.studentName}>{student.name}</Text>
                          <Text style={styles.studentEmail}>{student.email}</Text>
                        </View>
                      </View>
                    <TouchableOpacity
                      style={styles.planButton}
                      onPress={() => handleCreatePlan(student)}
                    >
                      <Ionicons name="add" size={16} color="#fff" />
                      <Text style={styles.planButtonText}>Plan Oluştur</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.viewPlanButton}
                      onPress={() => handleViewStudentPlans(student)}
                    >
                      <Ionicons name="eye" size={16} color={colors.primary} />
                      <Text style={styles.viewPlanButtonText}>Planları Gör</Text>
                    </TouchableOpacity>
                    </View>
                      ))}
                  </ScrollView>
                  
                  {students.filter(student =>
                    student.name.toLowerCase().includes(planSearchQuery.toLowerCase()) ||
                    student.email?.toLowerCase().includes(planSearchQuery.toLowerCase())
                  ).length === 0 && planSearchQuery.length > 0 && (
                    <View style={styles.emptySearchContainer}>
                      <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
                      <Text style={styles.emptySearchText}>Arama sonucu bulunamadı</Text>
                      <Text style={styles.emptySearchSubtext}>"{planSearchQuery}" için öğrenci bulunamadı</Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people" size={64} color={colors.textSecondary} />
                  <Text style={styles.emptyText}>
                    {students.length === 0 && !plansLoading ? 'Öğrenci bulunamadı' : 'Bağlı öğrenci yok'}
                  </Text>
                  <Text style={styles.emptySubtext}>
                    {students.length === 0 && !plansLoading 
                      ? 'Kurumunuzda henüz öğrenci kaydı bulunmuyor' 
                      : 'Öğrenciler bağlandığında burada görünecek'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Plan Oluşturma Formu Modal */}
      <Modal
        visible={showPlanForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPlanForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.planFormModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedStudent ? `${selectedStudent.name} için Plan Oluştur` : 'Plan Oluştur'}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowPlanForm(false)}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.planFormContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Plan Türü</Text>
                <View style={styles.planTypeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.planTypeButton,
                      planType === 'daily' && styles.planTypeButtonActive
                    ]}
                    onPress={() => {
                      setPlanType('daily');
                      setPlanTitle('Bu gün yapılacaklar');
                    }}
                  >
                    <Ionicons 
                      name="calendar-outline" 
                      size={20} 
                      color={planType === 'daily' ? '#fff' : colors.primary} 
                    />
                    <Text style={[
                      styles.planTypeText,
                      planType === 'daily' && styles.planTypeTextActive
                    ]}>
                      Günlük Plan
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.planTypeButton,
                      planType === 'weekly' && styles.planTypeButtonActive
                    ]}
                    onPress={() => {
                      setPlanType('weekly');
                      setPlanTitle('Bu hafta yapılacaklar');
                    }}
                  >
                    <Ionicons 
                      name="calendar" 
                      size={20} 
                      color={planType === 'weekly' ? '#fff' : colors.primary} 
                    />
                    <Text style={[
                      styles.planTypeText,
                      planType === 'weekly' && styles.planTypeTextActive
                    ]}>
                      Haftalık Plan
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Plan Başlığı</Text>
                <Input
                  placeholder="Plan başlığını girin"
                  value={planTitle}
                  onChangeText={setPlanTitle}
                  style={[styles.formInput, styles.readOnlyInput]}
                  editable={false}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Plan Açıklaması</Text>
                <Input
                  placeholder="Plan açıklamasını girin"
                  value={planDescription}
                  onChangeText={setPlanDescription}
                  multiline
                  numberOfLines={4}
                  style={[styles.formInput, styles.textArea]}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {planType === 'daily' ? 'Plan Tarihi (Otomatik)' : 'Hafta Başlangıcı (Otomatik)'}
                </Text>
                <View style={[styles.dateButton, styles.readOnlyInput]}>
                  <Ionicons name="calendar" size={20} color={colors.textSecondary} />
                  <Text style={[styles.dateText, styles.readOnlyText]}>
                    {planType === 'daily' 
                      ? planDate.toLocaleDateString('tr-TR')
                      : `${planDate.toLocaleDateString('tr-TR')} - ${new Date(planDate.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR')}`
                    }
                  </Text>
                </View>
              </View>

              <View style={styles.formActions}>
                <Button
                  title="İptal"
                  variant="ghost"
                  onPress={() => setShowPlanForm(false)}
                  style={styles.cancelButton}
                />
                <Button
                  title="Plan Oluştur"
                  onPress={handleSavePlan}
                  style={styles.saveButton}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Öğrenci Planları Görüntüleme Modal */}
      <Modal
        visible={showStudentPlansModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStudentPlansModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.studentPlansModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedStudent ? `${selectedStudent.name} - Planları` : 'Öğrenci Planları'}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowStudentPlansModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.studentPlansContent} showsVerticalScrollIndicator={false}>
              {studentPlansLoading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Planlar yükleniyor...</Text>
                </View>
              ) : (
                <>
                  {/* Günlük Planlar */}
                  <View style={[styles.planSection, styles.dailyPlanSection]}>
                    <View style={styles.planSectionHeader}>
                      <Ionicons name="calendar-outline" size={20} color="#9C27B0" />
                      <Text style={[styles.planSectionTitle, styles.dailyPlanTitle]}>Günlük Planlar</Text>
                    </View>
                    {studentPlans.daily?.filter(plan => !plan.is_completed).length > 0 ? (
                      studentPlans.daily.filter(plan => !plan.is_completed).map((plan) => {
                        const isTeacherPlan = plan.teacher_id;
                        return (
                          <View key={plan.id} style={[
                            styles.planItem, 
                            isTeacherPlan ? styles.teacherPlanItem : styles.studentPlanItem,
                            styles.dailyPlanItem
                          ]}>
                          <View style={styles.planItemHeader}>
                            <View style={styles.planTitleContainer}>
                              <Text style={styles.planItemTitle}>{plan.title}</Text>
                              {/* Plan türü badge'i */}
                              <View style={[
                                isTeacherPlan ? styles.teacherPlanBadge : styles.studentPlanBadge,
                                plan.isGuidanceTeacher && styles.guidanceTeacherPlanBadge
                              ]}>
                                <Ionicons 
                                  name={plan.isGuidanceTeacher ? "shield-checkmark" : (isTeacherPlan ? "school" : "person")} 
                                  size={10} 
                                  color="#fff" 
                                />
                                <Text style={styles.planBadgeText}>
                                  {plan.isGuidanceTeacher 
                                    ? 'Rehber Öğretmen' 
                                    : (isTeacherPlan ? 'Öğretmen' : 'Öğrenci')
                                  }
                                </Text>
                              </View>
                            </View>
                            <View style={styles.planStatus}>
                              <Ionicons 
                                name={plan.is_completed ? "checkmark-circle" : "ellipse-outline"} 
                                size={20} 
                                color={plan.is_completed ? "#4CAF50" : "#ccc"} 
                              />
                              <Text style={[
                                styles.planStatusText,
                                plan.is_completed && styles.completedStatusText
                              ]}>
                                {plan.is_completed ? 'Tamamlandı' : 'Bekliyor'}
                              </Text>
                              
                              {/* Öğretmen planları için silme butonu */}
                              {isTeacherPlan && (
                                <TouchableOpacity
                                  style={styles.deletePlanButton}
                                  onPress={() => handleDeleteTeacherPlan(plan, 'daily')}
                                >
                                  <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                          {plan.description && (
                            <Text style={styles.planItemDescription}>{plan.description}</Text>
                          )}
                          <Text style={styles.planItemDate}>
                            {new Date(plan.plan_date).toLocaleDateString('tr-TR')}
                          </Text>
                        </View>
                        );
                      })
                    ) : (
                      <Text style={styles.noPlansText}>Günlük plan yok</Text>
                    )}
                    
          {/* Tamamlanan Günlük Planlar */}
          {studentPlans.daily?.filter(plan => plan.is_completed).length > 0 && (
            <View style={styles.completedPlansSection}>
              <TouchableOpacity 
                style={styles.completedPlansHeader}
                onPress={() => setShowCompletedDailyPlans(!showCompletedDailyPlans)}
              >
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.completedPlansTitle}>
                  Tamamlanan Günlük Planlar ({studentPlans.daily.filter(plan => plan.is_completed).length})
                </Text>
                <Ionicons 
                  name={showCompletedDailyPlans ? "chevron-up" : "chevron-down"} 
                  size={16} 
                  color="#4CAF50" 
                />
              </TouchableOpacity>
              
              {/* Toplu silme butonu - başlığın altında */}
              {showCompletedDailyPlans && studentPlans.daily.filter(plan => plan.is_completed && plan.teacher_id).length > 0 && (
                <View style={styles.deleteAllButtonContainer}>
                  <TouchableOpacity
                    style={styles.deleteAllButton}
                    onPress={() => handleDeleteAllCompletedPlans('daily')}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                    <Text style={styles.deleteAllButtonText}>Tümünü Sil</Text>
                  </TouchableOpacity>
                </View>
              )}
                        {showCompletedDailyPlans && (
                          <View style={styles.completedPlansList}>
                            {studentPlans.daily.filter(plan => plan.is_completed).map((plan) => {
                              const isTeacherPlan = plan.teacher_id;
                              return (
                                <View key={plan.id} style={[
                                  styles.planItem, 
                                  styles.completedPlanItem,
                                  isTeacherPlan ? styles.teacherPlanItem : styles.studentPlanItem,
                                  styles.dailyPlanItem
                                ]}>
                                  <View style={styles.planItemHeader}>
                                    <View style={styles.planTitleContainer}>
                                      <Text style={styles.planItemTitle}>{plan.title}</Text>
                                      <View style={isTeacherPlan ? styles.teacherPlanBadge : styles.studentPlanBadge}>
                                        <Ionicons 
                                          name={isTeacherPlan ? "school" : "person"} 
                                          size={10} 
                                          color="#fff" 
                                        />
                                        <Text style={styles.planBadgeText}>
                                          {isTeacherPlan ? 'Öğretmen' : 'Öğrenci'}
                                        </Text>
                                      </View>
                                    </View>
                                    <View style={styles.planStatus}>
                                      <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                                      <Text style={[styles.planStatusText, styles.completedStatusText]}>
                                        Tamamlandı
                                      </Text>
                                      
                                      {/* Öğretmen planları için silme butonu */}
                                      {isTeacherPlan && (
                                        <TouchableOpacity
                                          style={styles.deletePlanButton}
                                          onPress={() => handleDeleteTeacherPlan(plan, 'daily')}
                                        >
                                          <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                  </View>
                                  {plan.description && (
                                    <Text style={styles.planItemDescription}>{plan.description}</Text>
                                  )}
                                  <Text style={styles.planItemDate}>
                                    {new Date(plan.plan_date).toLocaleDateString('tr-TR')}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Haftalık Planlar */}
                  <View style={[styles.planSection, styles.weeklyPlanSection]}>
                    <View style={styles.planSectionHeader}>
                      <Ionicons name="calendar" size={20} color="#4A90E2" />
                      <Text style={[styles.planSectionTitle, styles.weeklyPlanTitle]}>Haftalık Planlar</Text>
                    </View>
                    {studentPlans.weekly?.filter(plan => !plan.is_completed).length > 0 ? (
                      studentPlans.weekly.filter(plan => !plan.is_completed).map((plan) => {
                        const isTeacherPlan = plan.teacher_id;
                        return (
                          <View key={plan.id} style={[
                            styles.planItem, 
                            isTeacherPlan ? styles.teacherPlanItem : styles.studentPlanItem,
                            styles.weeklyPlanItem
                          ]}>
                          <View style={styles.planItemHeader}>
                            <View style={styles.planTitleContainer}>
                              <Text style={styles.planItemTitle}>{plan.title}</Text>
                              {/* Plan türü badge'i */}
                              <View style={[
                                isTeacherPlan ? styles.teacherPlanBadge : styles.studentPlanBadge,
                                plan.isGuidanceTeacher && styles.guidanceTeacherPlanBadge
                              ]}>
                                <Ionicons 
                                  name={plan.isGuidanceTeacher ? "shield-checkmark" : (isTeacherPlan ? "school" : "person")} 
                                  size={10} 
                                  color="#fff" 
                                />
                                <Text style={styles.planBadgeText}>
                                  {plan.isGuidanceTeacher 
                                    ? 'Rehber Öğretmen' 
                                    : (isTeacherPlan ? 'Öğretmen' : 'Öğrenci')
                                  }
                                </Text>
                              </View>
                            </View>
                            <View style={styles.planStatus}>
                              <Ionicons 
                                name={plan.is_completed ? "checkmark-circle" : "ellipse-outline"} 
                                size={20} 
                                color={plan.is_completed ? "#4CAF50" : "#ccc"} 
                              />
                              <Text style={[
                                styles.planStatusText,
                                plan.is_completed && styles.completedStatusText
                              ]}>
                                {plan.is_completed ? 'Tamamlandı' : 'Bekliyor'}
                              </Text>
                              
                              {/* Öğretmen planları için silme butonu */}
                              {isTeacherPlan && (
                                <TouchableOpacity
                                  style={styles.deletePlanButton}
                                  onPress={() => handleDeleteTeacherPlan(plan, 'weekly')}
                                >
                                  <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                          {plan.description && (
                            <Text style={styles.planItemDescription}>{plan.description}</Text>
                          )}
                          <Text style={styles.planItemDate}>
                            {new Date(plan.week_start_date).toLocaleDateString('tr-TR')} - {new Date(new Date(plan.week_start_date).getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR')}
                          </Text>
                        </View>
                        );
                      })
                    ) : (
                      <Text style={styles.noPlansText}>Haftalık plan yok</Text>
                    )}
                    
          {/* Tamamlanan Haftalık Planlar */}
          {studentPlans.weekly?.filter(plan => plan.is_completed).length > 0 && (
            <View style={styles.completedPlansSection}>
              <TouchableOpacity 
                style={styles.completedPlansHeader}
                onPress={() => setShowCompletedWeeklyPlans(!showCompletedWeeklyPlans)}
              >
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.completedPlansTitle}>
                  Tamamlanan Haftalık Planlar ({studentPlans.weekly.filter(plan => plan.is_completed).length})
                </Text>
                <Ionicons 
                  name={showCompletedWeeklyPlans ? "chevron-up" : "chevron-down"} 
                  size={16} 
                  color="#4CAF50" 
                />
              </TouchableOpacity>
              
              {/* Toplu silme butonu - başlığın altında */}
              {showCompletedWeeklyPlans && studentPlans.weekly.filter(plan => plan.is_completed && plan.teacher_id).length > 0 && (
                <View style={styles.deleteAllButtonContainer}>
                  <TouchableOpacity
                    style={styles.deleteAllButton}
                    onPress={() => handleDeleteAllCompletedPlans('weekly')}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                    <Text style={styles.deleteAllButtonText}>Tümünü Sil</Text>
                  </TouchableOpacity>
                </View>
              )}
                        {showCompletedWeeklyPlans && (
                          <View style={styles.completedPlansList}>
                            {studentPlans.weekly.filter(plan => plan.is_completed).map((plan) => {
                              const isTeacherPlan = plan.teacher_id;
                              return (
                                <View key={plan.id} style={[
                                  styles.planItem, 
                                  styles.completedPlanItem,
                                  isTeacherPlan ? styles.teacherPlanItem : styles.studentPlanItem,
                                  styles.weeklyPlanItem
                                ]}>
                                  <View style={styles.planItemHeader}>
                                    <View style={styles.planTitleContainer}>
                                      <Text style={styles.planItemTitle}>{plan.title}</Text>
                                      <View style={isTeacherPlan ? styles.teacherPlanBadge : styles.studentPlanBadge}>
                                        <Ionicons 
                                          name={isTeacherPlan ? "school" : "person"} 
                                          size={10} 
                                          color="#fff" 
                                        />
                                        <Text style={styles.planBadgeText}>
                                          {isTeacherPlan ? 'Öğretmen' : 'Öğrenci'}
                                        </Text>
                                      </View>
                                    </View>
                                    <View style={styles.planStatus}>
                                      <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                                      <Text style={[styles.planStatusText, styles.completedStatusText]}>
                                        Tamamlandı
                                      </Text>
                                      
                                      {/* Öğretmen planları için silme butonu */}
                                      {isTeacherPlan && (
                                        <TouchableOpacity
                                          style={styles.deletePlanButton}
                                          onPress={() => handleDeleteTeacherPlan(plan, 'weekly')}
                                        >
                                          <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                  </View>
                                  {plan.description && (
                                    <Text style={styles.planItemDescription}>{plan.description}</Text>
                                  )}
                                  <Text style={styles.planItemDate}>
                                    {new Date(plan.week_start_date).toLocaleDateString('tr-TR')} - {new Date(new Date(plan.week_start_date).getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR')}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
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
  header: {
    padding: SIZES.padding,
    backgroundColor: colors.primary + '10',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerInfo: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requestNotification: {
    position: 'relative',
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 8,
    ...SHADOWS.small,
  },
  requestBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  requestBadgeText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: 'bold',
  },
  greeting: {
    fontSize: SIZES.h2,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  branch: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.padding,
    gap: 12,
    marginBottom: 16,
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
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    ...SHADOWS.small,
  },
  quickActionText: {
    fontSize: SIZES.small,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestsModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
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
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    marginTop: 10,
  },
  requestsList: {
    maxHeight: 400,
  },
  requestCard: {
    margin: 16,
    marginBottom: 8,
  },
  requestHeader: {
    marginBottom: 12,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  studentDetails: {
    marginLeft: 12,
    flex: 1,
  },
  studentName: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  requestType: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  approveButton: {
    flex: 1,
  },
  rejectButton: {
    flex: 1,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: SIZES.h4,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  activitiesList: {
    maxHeight: 400, // Maksimum yükseklik sınırı
  },
  activitiesContent: {
    paddingBottom: 30, // Alt padding
  },
  activityTouchable: {
    marginBottom: 12, // Kartlar arası boşluk
  },
  activityPressable: {
    borderRadius: 12, // Modern yuvarlak köşeler
    overflow: 'hidden', // İçerik taşmasını önle
  },
  activityPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)', // Çok hafif arka plan rengi
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SIZES.padding,
  },
  activityInfo: {
    flex: 1,
  },
  activityStudent: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  activitySubject: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: SIZES.tiny,
    color: colors.textLight,
  },
  activityStats: {
    alignItems: 'flex-end',
  },
  activityDuration: {
    fontSize: SIZES.small,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 2,
  },
  activityFocus: {
    fontSize: SIZES.tiny,
    color: colors.textSecondary,
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
  plansModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  plansContent: {
    maxHeight: 400,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: SIZES.body,
    color: colors.textPrimary,
  },
  clearSearchButton: {
    padding: 4,
  },
  emptySearchContainer: {
    alignItems: 'center',
    padding: 40,
    justifyContent: 'center',
  },
  emptySearchText: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySearchSubtext: {
    fontSize: SIZES.small,
    color: colors.textLight,
    marginTop: 8,
    textAlign: 'center',
  },
  studentsList: {
    maxHeight: 300,
  },
  studentCard: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    ...SHADOWS.small,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  studentDetails: {
    marginLeft: 12,
    flex: 1,
  },
  studentName: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  studentEmail: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
  },
  planButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  planButtonText: {
    color: '#fff',
    fontSize: SIZES.small,
    fontWeight: '600',
  },
  planFormModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  planFormContent: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: SIZES.body,
    color: colors.textPrimary,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  dateText: {
    fontSize: SIZES.body,
    color: colors.textPrimary,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
  readOnlyInput: {
    backgroundColor: colors.background,
    opacity: 0.7,
  },
  readOnlyText: {
    color: colors.textSecondary,
  },
  planTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  planTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#fff',
  },
  planTypeButtonActive: {
    backgroundColor: colors.primary,
  },
  planTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
    marginLeft: 8,
  },
  planTypeTextActive: {
    color: '#fff',
  },
  planButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  viewPlanButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#fff',
    gap: 4,
  },
  viewPlanButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
  },
  studentPlansModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 0,
    width: '98%',
    maxWidth: 600,
    height: '80%',
  },
  studentPlansContent: {
    flex: 1,
    padding: 20,
  },
  planSection: {
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
  },
  planSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  planSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  dailyPlanSection: {
    backgroundColor: '#F8F9FA',
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
  dailyPlanTitle: {
    color: '#9C27B0',
  },
  weeklyPlanSection: {
    backgroundColor: '#F8F9FA',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  weeklyPlanTitle: {
    color: '#4CAF50',
  },
  planItem: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  dailyPlanItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#9C27B0',
  },
  weeklyPlanItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  // Plan türü stilleri
  teacherPlanItem: {
    backgroundColor: '#F3E5F5',
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
  studentPlanItem: {
    backgroundColor: '#E8F5E8',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  planTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  teacherPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9C27B0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  guidanceTeacherPlanBadge: {
    backgroundColor: '#673AB7', // Daha koyu mor rehber öğretmen için
  },
  studentPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  planBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },
  planItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  planItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  completedPlansSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  completedPlansHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F0F8F0',
    borderRadius: 6,
    marginBottom: 8,
  },
  completedPlansTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 6,
    flex: 1,
  },
  completedPlansList: {
    marginTop: 8,
  },
  completedPlanItem: {
    opacity: 0.8,
    marginBottom: 6,
  },
  planStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deletePlanButton: {
    marginLeft: 8,
    padding: 4,
  },
  deleteAllButtonContainer: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  deleteAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 4,
  },
  deleteAllButtonText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '500',
    marginLeft: 2,
  },
  planStatusText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  completedStatusText: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  planItemDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
    lineHeight: 16,
  },
  planItemDate: {
    fontSize: 11,
    color: '#999',
  },
  noPlansText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
});

export default TeacherHomeScreen;
