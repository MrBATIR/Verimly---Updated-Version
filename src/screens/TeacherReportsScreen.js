import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Platform,
  Animated,
  Alert,
  Modal,
  TextInput
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Container, StudyDetailModal } from '../components';
import { COLORS, DARK_COLORS, SIZES, SHADOWS } from '../constants/theme';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import TeacherStudentDetailScreen from './TeacherStudentDetailScreen';

export default function TeacherReportsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const [viewMode, setViewMode] = useState('daily'); // daily, weekly, monthly, custom
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [logs, setLogs] = useState([]);
  const [studentStats, setStudentStats] = useState({});
  const [showStudentDetail, setShowStudentDetail] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [stats, setStats] = useState({
    totalTime: 0,
    totalSessions: 0,
    avgFocus: 0,
  });
  const [selectedStudy, setSelectedStudy] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGuidanceTeacher, setIsGuidanceTeacher] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tema context'ini kullan
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);
  const [modalVisible, setModalVisible] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  
  // Toast notification state'leri
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastAnim = useState(new Animated.Value(0))[0];
  
  // Confirmation modal state'leri
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState(null);

  // Toast notification fonksiyonu
  const showToastNotification = (message) => {
    setToastMessage(message);
    setShowToast(true);
    
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowToast(false);
    });
  };

  // Kullanıcı durumunu kontrol et
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setIsDemo(!user); // Kullanıcı yoksa demo mod
    } catch (error) {
      setIsDemo(true); // Hata olursa demo mod
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedDate, viewMode]);

  // Ekran odaklandığında verileri yenile - SADECE BİR KEZ
  useFocusEffect(
    React.useCallback(() => {
      if (!isDemo) {
        fetchLogs();
      }
    }, [isDemo]) // selectedDate ve viewMode'u kaldırdık
  );

  // Interval kaldırıldı - gereksiz veri çekme ve raporların kaybolmasına neden oluyordu

  // Navigation listener kaldırıldı - useFocusEffect zaten var

  const loadDemoLogs = () => {
    // Demo veriler - bugün için
    const today = new Date();
    today.setHours(10, 30, 0, 0);

    const demoLogs = [
      {
        id: 1,
        subject: 'Matematik',
        study_type: 'test',
        topic: 'Türev ve İntegral',
        duration: 45,
        correct_answers: 18,
        wrong_answers: 2,
        empty_answers: 0,
        focus_level: 8,
        created_at: today.toISOString(),
        notes: 'Türev konusunu çalıştım, güzel gitti.',
      },
      {
        id: 2,
        subject: 'Fizik',
        study_type: 'video',
        topic: 'Newton Kanunları',
        duration: 60,
        correct_answers: null,
        wrong_answers: null,
        empty_answers: null,
        focus_level: 9,
        created_at: new Date(today.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        notes: 'Hareket konusunu bitirdim.',
      },
      {
        id: 3,
        subject: 'Kimya',
        study_type: 'topic',
        topic: 'Asit-Baz Dengeleri',
        duration: 30,
        correct_answers: null,
        wrong_answers: null,
        empty_answers: null,
        focus_level: 7,
        created_at: new Date(today.getTime() - 5 * 60 * 60 * 1000).toISOString(),
        notes: null,
      },
    ];

    setLogs(demoLogs);
    calculateStats(demoLogs);
  };

  const fetchLogs = async () => {
    try {
      
      // Loading state'i kontrol et - zaten yükleniyorsa tekrar başlatma
      if (isLoading) {
        return;
      }
      
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
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
        setIsLoading(false);
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
        setIsGuidanceTeacher(true);
        
        // Rehber öğretmen - Kurumundaki tüm öğrencilerin çalışmalarını göster
        const { data: institutionMemberships, error: membershipError } = await supabase
          .from('institution_memberships')
          .select('user_id')
          .eq('institution_id', institutionData.id)
          .eq('role', 'student')
          .eq('is_active', true);

        if (!membershipError && institutionMemberships?.length > 0) {
          studentIds = institutionMemberships.map(m => m.user_id).filter(Boolean);
        } else {
          console.warn('⚠️ Rehber öğretmen ama kurumunda aktif öğrenci bulunamadı');
        }
      } else {
        setIsGuidanceTeacher(false);
      }

      // Eğer rehber öğretmen değilse, bağlı öğrencileri göster
      if (!isGuidanceTeacherLocal && studentIds.length === 0) {
      // Bağlı öğrencileri al
      const { data: studentConnections, error: connectionsError } = await supabase
        .from('student_teachers')
        .select('student_id')
        .eq('teacher_id', teacherData.id)
        .eq('approval_status', 'approved')
        .eq('is_active', true);

      if (connectionsError || !studentConnections?.length) {
          console.warn('⚠️ Bağlı öğrenci bulunamadı');
        setLogs([]);
        calculateStats([]);
        setStudentStats({});
          setIsLoading(false);
        return;
      }

        studentIds = studentConnections.map(conn => conn.student_id).filter(Boolean);
      } else if (isGuidanceTeacherLocal && studentIds.length === 0) {
        // Rehber öğretmen ama kurumunda öğrenci yok
        setLogs([]);
        calculateStats([]);
        setStudentStats({});
        setIsLoading(false);
        return;
      }

      if (studentIds.length === 0) {
        setLogs([]);
        calculateStats([]);
        setStudentStats({});
        setIsLoading(false);
        return;
      }

      const { startDate, endDate } = getDateRange();
      
      // Rehber öğretmen için supabaseAdmin kullan (RLS'i bypass et)
      const queryClient = isGuidanceTeacherLocal ? supabaseAdmin : supabase;
      
      // Öğrencilerin çalışma loglarını al - UTC bazlı tam tarih aralığı
      const { data, error } = await queryClient
        .from('study_logs')
        .select('*')
        .in('user_id', studentIds)
        .gte('study_date', startDate.toISOString())
        .lte('study_date', endDate.toISOString())
        .order('study_date', { ascending: false });

      if (error) {
        console.error('Study logs query hatası:', error);
        throw error;
      }

      // Client-side'da kesin tarih filtrelemesi (ekstra güvenlik için)
      // selectedDate local timezone'da, veritabanı UTC'de saklanıyor
      // Ama öğrenci hangi tarihte kaydetti ise o tarihte görünmeli (local timezone)
      // Bu yüzden filtrelemeyi local timezone'a göre yapıyoruz
      const selectedYear = selectedDate.getFullYear();
      const selectedMonth = selectedDate.getMonth();
      const selectedDay = selectedDate.getDate();
      
      const filteredData = (data || []).filter(log => {
        if (!log.study_date) return false;
        
        const logDate = new Date(log.study_date);
        
        // viewMode'a göre filtreleme
        if (viewMode === 'daily') {
          // Günlük görünüm - Local timezone bazlı tarih karşılaştırması
          // Öğrenci hangi tarihte kaydetti ise o tarihte görünsün (local timezone)
        const logYear = logDate.getFullYear();
        const logMonth = logDate.getMonth();
        const logDay = logDate.getDate();
        
          // Local timezone'da tarih karşılaştırması
          return logYear === selectedYear && 
                 logMonth === selectedMonth && 
                 logDay === selectedDay;
        } else if (viewMode === 'weekly' || viewMode === 'monthly') {
          // Haftalık/aylık görünüm - zaman damgası bazlı aralık kontrolü
          const logTime = logDate.getTime();
          return logTime >= startDate.getTime() && logTime <= endDate.getTime();
        }
        
        // Diğer görünümler için veritabanı filtrelemesi yeterli
        return true;
      });
      
      setLogs(filteredData);
      calculateStats(filteredData);
      await calculateStudentStats(filteredData, studentIds, isGuidanceTeacherLocal);
      
    } catch (error) {
      console.error('fetchLogs hatası:', error);
      // Hata durumunda boş liste göster
      setLogs([]);
      calculateStats([]);
      setStudentStats({});
    } finally {
      setIsLoading(false);
    }
  };

  const getDateRange = () => {
    // selectedDate local timezone'da bir Date objesi
    // Kullanıcı "1 Kasım" seçtiyse, local timezone'da 1 Kasım'ı filtrelemeli
    // Öğrenci hangi tarihte kaydetti ise o tarihte görünsün (local timezone)
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = selectedDate.getMonth();
    const selectedDay = selectedDate.getDate();

    let start, end;

    if (viewMode === 'daily') {
      // Seçili günün başlangıcı ve sonu (local timezone)
      // Örneğin: 1 Kasım seçildiyse -> 1 Kasım 00:00:00 - 23:59:59 (local timezone)
      // Veritabanı sorgusu için UTC'ye çeviriyoruz ama filtreleme local timezone'da yapılacak
      const localStart = new Date(selectedYear, selectedMonth, selectedDay, 0, 0, 0, 0);
      const localEnd = new Date(selectedYear, selectedMonth, selectedDay, 23, 59, 59, 999);
      
      // Veritabanı sorgusu için UTC'ye çevir (geniş aralık için)
      // Local timezone'daki günün başı ve sonunun UTC karşılığını al
      // Türkiye'de 1 Kasım 00:00:00 (UTC+3) = UTC'de 31 Ekim 21:00:00
      // Türkiye'de 1 Kasım 23:59:59 (UTC+3) = UTC'de 1 Kasım 20:59:59
      // Bu yüzden biraz geniş bir aralık kullanmalıyız
      start = new Date(localStart);
      start.setHours(start.getHours() - 12); // 12 saat öncesi (buffer)
      end = new Date(localEnd);
      end.setHours(end.getHours() + 12); // 12 saat sonrası (buffer)
      
    } else if (viewMode === 'weekly') {
      // Seçili tarih baz alınarak 7 günlük aralık (local timezone)
      const weekStart = new Date(selectedYear, selectedMonth, selectedDay, 0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - 6); // 6 gün öncesi
      const localEnd = new Date(selectedYear, selectedMonth, selectedDay, 23, 59, 59, 999);
      
      // UTC buffer ekle
      start = new Date(weekStart);
      start.setHours(start.getHours() - 12);
      end = new Date(localEnd);
      end.setHours(end.getHours() + 12);
    } else if (viewMode === 'monthly') {
      // Ayın başından sonuna kadar (local timezone)
      const monthStart = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
      const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0);
      const monthEnd = new Date(selectedYear, selectedMonth, lastDayOfMonth.getDate(), 23, 59, 59, 999);
      
      // UTC buffer ekle
      start = new Date(monthStart);
      start.setHours(start.getHours() - 12);
      end = new Date(monthEnd);
      end.setHours(end.getHours() + 12);
    } else {
      // Fallback
      const localStart = new Date(selectedYear, selectedMonth, selectedDay, 0, 0, 0, 0);
      const localEnd = new Date(selectedYear, selectedMonth, selectedDay, 23, 59, 59, 999);
      start = new Date(localStart);
      start.setHours(start.getHours() - 12);
      end = new Date(localEnd);
      end.setHours(end.getHours() + 12);
    }

    return { startDate: start, endDate: end };
  };

  const calculateStats = (data) => {
    const totalTime = data.reduce((sum, log) => sum + (log.duration || 0), 0);
    const totalSessions = data.length;
    const avgFocus = totalSessions > 0 
      ? data.reduce((sum, log) => sum + (log.focus_level || 0), 0) / totalSessions 
      : 0;

    setStats({
      totalTime: Math.round(totalTime),
      totalSessions,
      avgFocus: Math.round(avgFocus * 10) / 10,
    });
  };

  const calculateStudentStats = async (data, studentIds, isGuidanceTeacher = false) => {
    try {
      let studentProfiles = [];
      
      // Rehber öğretmen değilse, bağlı öğrencilerin profil verilerini al
      if (!isGuidanceTeacher) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

        // Öğretmen ID'sini al
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (teacherData) {
      // Öğretmenin bağlı öğrencilerini al
      const { data: teacherConnections, error: connectionError } = await supabase
        .from('student_teachers')
            .select('student_id')
            .eq('teacher_id', teacherData.id)
            .eq('is_active', true)
        .eq('approval_status', 'approved');

      // Bağlı öğrencilerin profil verilerini al
          const connectedStudentIds = teacherConnections?.map(conn => conn.student_id).filter(Boolean) || [];
      
          if (connectedStudentIds.length > 0) {
            const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('user_id, selected_avatar')
        .in('user_id', connectedStudentIds);

            if (!error && profiles) {
              studentProfiles = profiles;
            }
          }
        }
      } else {
        // Rehber öğretmen için direkt studentIds kullan
        // Profilleri ayrı ayrı çekeceğiz (her öğrenci için)
      }
      

      // Gerçek öğrenci bilgilerini almak için auth.users tablosuna erişim
      // Bu sadece server-side'da çalışır, client-side'da çalışmaz
      // Bu yüzden study_logs tablosundan öğrenci bilgilerini çıkaralım
      
      const studentStatsMap = {};
      
      // Her öğrenci için istatistikleri hesapla
      // isGuidanceTeacher değerini yerel bir değişkene kopyala (closure sorununu önlemek için)
      const isGuidanceTeacherLocal = Boolean(isGuidanceTeacher);
      
      for (const studentId of studentIds) {
        try {
        const studentLogs = data.filter(log => log.user_id === studentId);
        const studentProfile = studentProfiles?.find(p => p.user_id === studentId);
        
        
        // Sadece veri olan öğrenciler için kart göster
        if (studentLogs.length === 0) {
          continue; // Bu öğrenciyi atla, diğerlerine devam et
        }
        
        const totalTime = studentLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
        const totalStudies = studentLogs.length;
        const totalQuestions = studentLogs.reduce((sum, log) => {
          const correct = log.correct_answers || 0;
          const wrong = log.wrong_answers || 0;
          const empty = log.empty_answers || 0;
          return sum + correct + wrong + empty;
        }, 0);

        // Gerçek öğrenci bilgilerini user_profiles tablosundan çek
        let studentName = 'Bilinmeyen Öğrenci';
        let studentEmail = 'email@example.com';
        
          // user_profiles tablosundan gerçek bilgileri çek - rehber öğretmen için supabaseAdmin kullan
          const profileClient = isGuidanceTeacherLocal ? supabaseAdmin : supabase;
          const { data: profile, error: profileError } = await profileClient
          .from('user_profiles')
            .select('user_id, name, email, selected_avatar')
          .eq('user_id', studentId)
            .maybeSingle();
        
        if (!profileError && profile) {
          studentName = profile.name;
          studentEmail = profile.email;
          } else if (profileError) {
            console.error('Profil bulunamadı, studentId:', studentId, 'error:', profileError);
        }


          // Avatar'ı profile'dan al, yoksa studentProfile'dan, yoksa default avatar kullan
          const avatar = profile?.selected_avatar || studentProfile?.selected_avatar || '👤';
        
        studentStatsMap[studentId] = {
          name: studentName,
          email: studentEmail,
          avatar: avatar,
          totalTime: Math.round(totalTime),
          totalStudies,
          totalQuestions,
        };
        } catch (studentError) {
          console.error('Öğrenci istatistiği hesaplanırken hata (studentId:', studentId, '):', studentError);
          // Bu öğrenciyi atla, diğerlerine devam et
          continue;
        }
      }

      setStudentStats(studentStatsMap);
    } catch (error) {
      console.error('calculateStudentStats hatası:', error);
      // Hata durumunda sessizce devam et - boş stats göster
      setStudentStats({});
    }
  };

  const formatDate = () => {
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    if (viewMode === 'daily') {
      return selectedDate.toLocaleDateString('tr-TR', options);
    } else if (viewMode === 'weekly') {
      const { startDate, endDate } = getDateRange();
      return `${startDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} - ${endDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`;
    } else {
      return selectedDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    }
  };

  const isToday = (date) => {
    const today = new Date();
    const checkDate = new Date(date);
    return checkDate.getDate() === today.getDate() &&
           checkDate.getMonth() === today.getMonth() &&
           checkDate.getFullYear() === today.getFullYear();
  };

  const changeDate = (direction) => {
    const newDate = new Date(selectedDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Bugünün sonu
    
    if (viewMode === 'daily') {
      newDate.setDate(newDate.getDate() + direction);
      // İleri tarihlere gitmeyi engelle
      if (newDate > today) {
        return;
      }
    } else if (viewMode === 'weekly') {
      // Haftalık görünümde seçili tarih baz alınarak 7 gün ileri/geri git
      newDate.setTime(selectedDate.getTime() + (direction * 7 * 24 * 60 * 60 * 1000));
      // Haftalık görünümde gelecek tarihlere gitmeyi engelle
      const today = new Date();
      if (newDate > today) {
        return;
      }
    } else if (viewMode === 'monthly') {
      newDate.setMonth(newDate.getMonth() + direction);
      // Aylık görünümde de gelecek tarihlere gitmeyi engelle
      if (newDate > today) {
        return;
      }
    }
    setSelectedDate(newDate);
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}s ${mins}dk`;
    }
    return `${mins}dk`;
  };

  const getCalendarDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const today = new Date();
    
    // Ayın ilk günü
    const firstDay = new Date(year, month, 1);
    
    // İlk haftanın başlangıcı (Pazartesi)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1));
    
    const days = [];
    const currentDate = new Date(startDate);
    
    // 42 gün (6 hafta) göster
    for (let i = 0; i < 42; i++) {
      const isCurrentMonth = currentDate.getMonth() === month;
      const isToday = currentDate.toDateString() === today.toDateString();
      
      // Seçilen tarihi doğru şekilde karşılaştır
      const isSelected = currentDate.getFullYear() === date.getFullYear() &&
                        currentDate.getMonth() === date.getMonth() &&
                        currentDate.getDate() === date.getDate();
      
      // Bitiş tarihi seçimi için kısıtlamalar
      const isFutureDate = currentDate > today;
      const isBeforeStartDate = viewMode === 'custom' && !isSelectingStartDate && 
                               customDateRange.startDate && currentDate < customDateRange.startDate;
      const isDisabled = viewMode === 'custom' && !isSelectingStartDate && (isFutureDate || isBeforeStartDate);
      
      days.push({
        day: currentDate.getDate(),
        month: currentDate.getMonth(),
        year: currentDate.getFullYear(),
        isCurrentMonth,
        isToday,
        isSelected,
        isDisabled,
        date: new Date(currentDate)
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  };

  const getFocusColor = (level) => {
    if (level >= 8) return colors.success;
    if (level >= 5) return colors.warning;
    return colors.error;
  };

  return (
    <>
      <Container>
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Öğrenci Raporları</Text>
          <Text style={styles.subtitle}>Bağlı öğrencilerinizin çalışma performanslarını görüntüleyin</Text>
        </View>

        {/* View Mode Selector */}
        <View style={styles.viewModeContainer}>
          <TouchableOpacity 
            style={[styles.viewModeButton, viewMode === 'daily' && styles.viewModeButtonActive]}
            onPress={() => {
              setViewMode('daily');
              setSelectedDate(new Date()); // Mevcut güne dön
            }}
          >
            <Ionicons 
              name="calendar-outline" 
              size={20} 
              color={viewMode === 'daily' ? colors.surface : colors.textSecondary} 
            />
            <Text style={[styles.viewModeText, viewMode === 'daily' && styles.viewModeTextActive]}>
              Günlük
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.viewModeButton, viewMode === 'weekly' && styles.viewModeButtonActive]}
            onPress={() => {
              setViewMode('weekly');
              setSelectedDate(new Date()); // Bugünün tarihi ile başla
            }}
          >
            <Ionicons 
              name="calendar-outline" 
              size={20} 
              color={viewMode === 'weekly' ? colors.surface : colors.textSecondary} 
            />
            <Text style={[styles.viewModeText, viewMode === 'weekly' && styles.viewModeTextActive]}>
              Haftalık
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.viewModeButton, viewMode === 'monthly' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('monthly')}
          >
            <Ionicons 
              name="calendar-outline" 
              size={20} 
              color={viewMode === 'monthly' ? colors.surface : colors.textSecondary} 
            />
            <Text style={[styles.viewModeText, viewMode === 'monthly' && styles.viewModeTextActive]}>
              Aylık
            </Text>
          </TouchableOpacity>

        </View>

        {/* Date Selector */}
        <View style={styles.dateSelector}>
          <TouchableOpacity 
            style={styles.dateArrow}
            onPress={() => changeDate(-1)}
          >
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.dateDisplay}
            onPress={() => setShowDatePicker(true)}
          >
              <Ionicons name="calendar" size={20} color={colors.primary} />
            <Text style={styles.dateText}>{formatDate()}</Text>
          </TouchableOpacity>

            {(viewMode === 'daily' && isToday(selectedDate)) || 
             (viewMode === 'weekly' && isToday(selectedDate)) || 
             (viewMode === 'monthly' && isToday(selectedDate)) ? (
              <View style={styles.dateArrow} />
            ) : (
          <TouchableOpacity 
            style={styles.dateArrow}
            onPress={() => changeDate(1)}
          >
                <Ionicons name="chevron-forward" size={24} color={colors.primary} />
          </TouchableOpacity>
            )}
        </View>


        {/* Öğrenci Performansları */}
        <View style={styles.logsSection}>
          <Text style={styles.sectionTitle}>Öğrenci Performansları</Text>
          
          {/* Arama Input */}
          {Object.keys(studentStats).length > 0 && (
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Öğrenci adı ile ara..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={colors.textSecondary}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.clearSearchButton}
                  onPress={() => setSearchQuery('')}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}
          
          {Object.keys(studentStats).length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={colors.textLight} />
              <Text style={styles.emptyText}>Bu tarihte çalışma yapan öğrenci yok</Text>
              <Text style={styles.emptySubtext}>Öğrencileriniz çalışmaya başladığında burada görünecek!</Text>
            </View>
          ) : (
             Object.entries(studentStats)
               .filter(([studentId, studentData]) => {
                 if (!searchQuery.trim()) return true;
                 const query = searchQuery.toLowerCase();
                 return (
                   studentData.name?.toLowerCase().includes(query) ||
                   studentData.email?.toLowerCase().includes(query)
                 );
               })
               .sort(([idA, dataA], [idB, dataB]) => {
                 const nameA = (dataA.name || '').toLowerCase();
                 const nameB = (dataB.name || '').toLowerCase();
                 return nameA.localeCompare(nameB, 'tr');
               })
               .map(([studentId, studentData]) => (
               <TouchableOpacity 
                 key={studentId} 
                 style={styles.studentCard}
                 onPress={() => {
                  // Öğrenci detay modalını aç - rehber öğretmen bilgisini de geçir
                  // selectedDate'i geçir - local timezone'daki yıl/ay/gün'ü koru
                  // toISOString() UTC'ye çevirir, bu yüzden local tarihin string formatını kullan
                  const dateStr = selectedDate 
                    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
                    : new Date().toISOString().split('T')[0];
                  
                  setSelectedStudent({ 
                    studentId, 
                    studentData, 
                    selectedDate: dateStr, 
                    viewMode,
                    isGuidanceTeacher: isGuidanceTeacher 
                  });
                   setShowStudentDetail(true);
                 }}
                 activeOpacity={0.7}
               >
                <View style={styles.studentHeader}>
                  <View style={styles.studentInfo}>
                    <View style={styles.studentAvatar}>
                      <Text style={styles.studentAvatarEmoji}>
                        {studentData.avatar || '👤'}
                      </Text>
                    </View>
                    <View style={styles.studentDetails}>
                      <Text style={styles.studentName}>{studentData.name || 'Bilinmeyen Öğrenci'}</Text>
                      <Text style={styles.studentEmail}>{studentData.email || 'Email yok'}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>

                <View style={styles.studentStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="book-outline" size={20} color={colors.primary} />
                    <Text style={styles.statValue}>{studentData.totalStudies}</Text>
                    <Text style={styles.statLabel}>Çalışma</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="time-outline" size={20} color={colors.success} />
                    <Text style={styles.statValue}>{formatDuration(studentData.totalTime)}</Text>
                    <Text style={styles.statLabel}>Süre</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="help-circle-outline" size={20} color={colors.warning} />
                    <Text style={styles.statValue}>{studentData.totalQuestions}</Text>
                    <Text style={styles.statLabel}>Soru</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
          
          {/* Arama sonucu bulunamadı */}
          {Object.keys(studentStats).length > 0 && 
           Object.entries(studentStats)
             .filter(([studentId, studentData]) => {
               if (!searchQuery.trim()) return false;
               const query = searchQuery.toLowerCase();
               return (
                 studentData.name?.toLowerCase().includes(query) ||
                 studentData.email?.toLowerCase().includes(query)
               );
             }).length === 0 && searchQuery.trim().length > 0 && (
            <View style={styles.emptySearchContainer}>
              <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptySearchText}>Arama sonucu bulunamadı</Text>
              <Text style={styles.emptySearchSubtext}>"{searchQuery}" için öğrenci bulunamadı</Text>
            </View>
          )}
        </View>
      </ScrollView>
      </Container>

      {/* Modals - Container dışında */}
      {showDatePicker && (
        <View style={styles.modalOverlay}>
          <View style={[styles.customDateModal, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Tarih Seçin
              </Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.customCalendar}>
              {/* Ay ve Yıl Başlığı */}
              <View style={[styles.calendarHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity 
                  style={styles.monthButton}
                  onPress={() => {
                    const newDate = new Date(selectedDate);
                    newDate.setMonth(newDate.getMonth() - 1);
                    setSelectedDate(newDate);
                  }}
                >
                  <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                
                <Text style={[styles.monthYearText, { color: colors.textPrimary }]}>
                  {selectedDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                </Text>
                
                <TouchableOpacity 
                  style={styles.monthButton}
                  onPress={() => {
                    const newDate = new Date(selectedDate);
                    newDate.setMonth(newDate.getMonth() + 1);
                    setSelectedDate(newDate);
                  }}
                >
                  <Ionicons name="chevron-forward" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              
              {/* Haftanın Günleri */}
              <View style={styles.weekDaysContainer}>
                {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day, index) => (
                  <Text key={index} style={[styles.weekDayText, { color: colors.textSecondary }]}>
                    {day}
                  </Text>
                ))}
              </View>
              
              {/* Takvim Günleri */}
              <View style={styles.calendarGrid}>
                {getCalendarDays(selectedDate).map((day, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.calendarDay,
                      day.isCurrentMonth && { backgroundColor: colors.surface },
                      day.isSelected && { backgroundColor: colors.primary },
                      day.isToday && !day.isSelected && { backgroundColor: colors.primary + '20' },
                      day.isDisabled && { backgroundColor: colors.border + '30' }
                    ]}
                    onPress={() => {
                      if (day.isCurrentMonth && !day.isDisabled) {
                        // En basit çözüm: day objesinden tarih oluştur
                        const newDate = new Date(day.year, day.month, day.day);
                        setSelectedDate(newDate);
                        setShowDatePicker(false); // Modal'ı kapat
                      }
                    }}
                    disabled={day.isDisabled}
                  >
                    <Text style={[
                      styles.calendarDayText,
                      { color: day.isCurrentMonth ? colors.textPrimary : colors.textLight },
                      day.isSelected && { color: colors.surface },
                      day.isToday && !day.isSelected && { color: colors.primary },
                      day.isDisabled && { color: colors.textLight + '50' }
                    ]}>
                      {day.day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: colors.border }]}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: colors.primary }]}
                onPress={() => {
                  // Özel tarih aralığı modunda ise doğru tarihi güncelle
                  if (viewMode === 'custom') {
                    if (isSelectingStartDate) {
                      // Başlangıç tarihi seçildi, bitiş tarihi seçimine geç
                      setCustomDateRange(prev => ({ ...prev, startDate: selectedDate }));
                      setIsSelectingStartDate(false);
                      setSelectedDate(customDateRange.endDate);
                      // Modal açık kalsın, sadece tarih değişsin
                      return;
                    } else {
                      // Bitiş tarihi seçildi, modalı kapat ve logları yenile
                      setCustomDateRange(prev => ({ ...prev, endDate: selectedDate }));
                      setShowDatePicker(false);
                      setTimeout(() => {
                        fetchLogs();
                      }, 100);
                      return;
                    }
                  }
                  
                  // Normal tarih seçimi için modalı kapat
                  setShowDatePicker(false);
                  setTimeout(() => {
                    fetchLogs();
                  }, 100);
                }}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary, { color: colors.surface }]}>Tamam</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}


      {/* Detaylı Çalışma Modal */}
      <StudyDetailModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedStudy(null);
        }}
        study={selectedStudy}
        onEdit={() => {
          setModalVisible(false);
          navigation.navigate('AddLog', { studyId: selectedStudy?.id });
        }}
        onDelete={() => {
          if (isDemo) {
            Alert.alert('Demo Modu', 'Demo modda silme yapılamaz.');
            return;
          }
          
          // StudyDetailModal'ı kapat ve confirmation modal'ı aç
          setModalVisible(false);
          
          // Kısa bir gecikme sonrası confirmation modal'ı aç
          setTimeout(() => {
            setConfirmData({
              title: 'Kaydı Sil',
              message: `${selectedStudy.subject} dersindeki çalışma kaydını silmek istediğinize emin misiniz?`,
              onConfirm: async () => {
                try {
                  const { error } = await supabase
                    .from('study_logs')
                    .delete()
                    .eq('id', selectedStudy.id);

                  if (error) throw error;

                  showToastNotification('🗑️ Çalışma kaydı silindi.');
                  fetchLogs(); // Listeyi yenile
                  setSelectedStudy(null);
                } catch (error) {
                  Alert.alert('Hata', 'Kayıt silinirken bir hata oluştu.');
                }
              }
            });
            setShowConfirmModal(true);
          }, 100);
        }}
      />
      
      {/* Öğrenci Detay Modal */}
      <Modal
        visible={showStudentDetail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStudentDetail(false)}
      >
        {selectedStudent && (
          <TeacherStudentDetailScreen
            route={{
              params: {
                studentId: selectedStudent.studentId,
                studentData: selectedStudent.studentData,
                selectedDate: selectedStudent.selectedDate,
                viewMode: selectedStudent.viewMode,
                isGuidanceTeacher: selectedStudent.isGuidanceTeacher || false
              }
            }}
            navigation={{
              goBack: () => setShowStudentDetail(false)
            }}
          />
        )}
      </Modal>

      {/* Toast Notification */}
      {showToast && (
        <Animated.View 
          style={[
            styles.toastContainer,
            {
              opacity: toastAnim,
              transform: [{
                translateY: toastAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0]
                })
              }]
            }
          ]}
        >
          <View style={[styles.toast, { backgroundColor: colors.success }]}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </Animated.View>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && confirmData && (
        <View style={styles.confirmModalOverlay}>
          <View style={[styles.confirmModal, { backgroundColor: colors.surface }]}>
            <View style={styles.confirmModalHeader}>
              <Text style={[styles.confirmModalTitle, { color: colors.textPrimary }]}>
                {confirmData.title}
              </Text>
            </View>
            
            <View style={styles.confirmModalBody}>
              <Text style={[styles.confirmModalMessage, { color: colors.textSecondary }]}>
                {confirmData.message}
              </Text>
            </View>
            
            <View style={styles.confirmModalActions}>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalButtonCancel, { borderColor: colors.border }]}
                onPress={() => {
                  setShowConfirmModal(false);
                  // İptal edildiğinde StudyDetailModal'ı tekrar aç
                  setModalVisible(true);
                }}
              >
                <Text style={[styles.confirmModalButtonText, { color: colors.textSecondary }]}>
                  İptal
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalButtonDelete, { backgroundColor: colors.error }]}
                onPress={() => {
                  confirmData.onConfirm();
                  setShowConfirmModal(false);
                }}
              >
                <Text style={[styles.confirmModalButtonText, { color: '#FFFFFF' }]}>
                  Sil
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: SIZES.padding,
    paddingTop: SIZES.padding * 1.5,
  },
  title: {
    fontSize: SIZES.h2,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginTop: 4,
  },
  
  // View Mode Selector
  viewModeContainer: {
    flexDirection: 'row',
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
    backgroundColor: colors.surface,
    borderRadius: SIZES.radius,
    padding: 4,
    ...SHADOWS.small,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: SIZES.radius - 2,
    gap: 6,
  },
  viewModeButtonActive: {
    backgroundColor: colors.primary,
  },
  viewModeText: {
    fontSize: SIZES.small,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  viewModeTextActive: {
    color: colors.surface,
  },

  // Date Selector
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16, // Sabit margin
    marginBottom: SIZES.padding,
    backgroundColor: colors.surface,
    borderRadius: SIZES.radius,
    padding: 12, // Daha küçük padding
    ...SHADOWS.small,
    height: 60, // Sabit yükseklik
  },
  dateArrow: {
    padding: 4,
    width: 36, // Daha küçük genişlik
    height: 36, // Daha küçük yükseklik
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledArrow: {
    opacity: 0.5,
  },
  dateDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36, // Daha küçük yükseklik
    marginHorizontal: 8, // Yan boşluklar
  },
  dateText: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    minWidth: 120, // Sabit genişlik
  },

  // Logs Section
  logsSection: {
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding * 2,
  },
  sectionTitle: {
    fontSize: SIZES.h4,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: SIZES.padding,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: SIZES.radius,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: SIZES.body,
    color: colors.textPrimary,
    paddingVertical: 4,
  },
  clearSearchButton: {
    marginLeft: 8,
    padding: 4,
  },
  emptySearchContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptySearchText: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 12,
  },
  emptySearchSubtext: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  
  // Student Card
  studentCard: {
    backgroundColor: colors.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  studentAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentInitial: {
    fontSize: SIZES.h4,
    fontWeight: 'bold',
    color: colors.primary,
  },
  studentAvatarEmoji: {
    fontSize: 24,
  },
  studentDetails: {
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
  studentStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: SIZES.h4,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 4,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: SIZES.tiny,
    color: colors.textSecondary,
  },

  // Log Card
  logCard: {
    backgroundColor: colors.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  logSubject: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  focusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  focusText: {
    fontSize: SIZES.tiny,
    fontWeight: '600',
  },
  logDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  logDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logDetailText: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
  },
  notesContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: SIZES.tiny,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  notesText: {
    fontSize: SIZES.small,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  
  // Question Stats
  questionStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  statBadgeText: {
    fontSize: SIZES.tiny,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  netBadge: {
    backgroundColor: colors.primary + '15',
  },
  netBadgeText: {
    fontSize: SIZES.tiny,
    color: colors.primary,
    fontWeight: '700',
  },
  studyTypeBadge: {
    backgroundColor: colors.primaryLight + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  studyTypeBadgeText: {
    fontSize: SIZES.tiny,
    color: colors.primary,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.padding * 3,
  },
  emptyText: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: SIZES.padding,
  },
  emptySubtext: {
    fontSize: SIZES.small,
    color: colors.textLight,
    marginTop: 8,
  },

  // Custom Date Range Styles
  customDateSelector: {
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
  },
  customDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customDateText: {
    fontSize: SIZES.body,
    color: colors.textPrimary,
    marginLeft: 8,
    fontWeight: '500',
  },

  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start', // Üst kısımda göster
    alignItems: 'center',
    zIndex: 1000,
    paddingTop: 200, // ViewModeContainer'ın altından başla
  },
  customRangeModal: {
    backgroundColor: colors.surface,
    borderRadius: SIZES.radius * 2,
    margin: SIZES.padding,
    maxWidth: 400,
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: SIZES.h4,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dateRangeContainer: {
    padding: SIZES.padding,
  },
  dateRangeItem: {
    marginBottom: SIZES.padding,
  },
  dateRangeLabel: {
    fontSize: SIZES.small,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  dateRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateRangeText: {
    fontSize: SIZES.body,
    color: colors.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalButton: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: 8,
    borderRadius: SIZES.radius,
    marginLeft: 8,
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonText: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  modalButtonTextPrimary: {
    color: colors.surface,
  },
  datePickerContainer: {
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    margin: SIZES.padding,
  },
  customDateModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: SIZES.radius * 2,
    overflow: 'hidden',
    ...SHADOWS.large,
  },
  datePickerContent: {
    padding: SIZES.padding,
    alignItems: 'center',
  },
  customCalendar: {
    padding: SIZES.padding,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SIZES.padding,
    borderBottomWidth: 1,
    marginBottom: SIZES.padding,
  },
  monthButton: {
    padding: 8,
    borderRadius: SIZES.radius,
  },
  monthYearText: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  weekDaysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SIZES.padding,
  },
  weekDayText: {
    fontSize: SIZES.tiny,
    fontWeight: '600',
    textAlign: 'center',
    width: 40,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  calendarDay: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: SIZES.radius,
    margin: 2,
  },
  calendarDayText: {
    fontSize: SIZES.body,
    fontWeight: '500',
  },
  // Toast Styles
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: SIZES.body,
    fontWeight: '600',
  },
  // Confirmation Modal Styles
  confirmModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20000,
  },
  confirmModal: {
    width: '85%',
    maxWidth: 400,
    borderRadius: SIZES.radius * 2,
    padding: 0,
    ...SHADOWS.large,
  },
  confirmModalHeader: {
    padding: SIZES.padding * 1.5,
    paddingBottom: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  confirmModalTitle: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  confirmModalBody: {
    padding: SIZES.padding * 1.5,
    paddingTop: SIZES.padding,
  },
  confirmModalMessage: {
    fontSize: SIZES.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  confirmModalActions: {
    flexDirection: 'row',
    padding: SIZES.padding * 1.5,
    paddingTop: SIZES.padding,
    gap: SIZES.padding,
  },
  confirmModalButton: {
    flex: 1,
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalButtonCancel: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  confirmModalButtonDelete: {
    // backgroundColor will be set dynamically
  },
  confirmModalButtonText: {
    fontSize: SIZES.body,
    fontWeight: '600',
  },
});