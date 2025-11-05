import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Platform,
  Animated,
  Alert,
  Modal
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Container, StudyDetailModal, AdBanner, Card } from '../components';
import { COLORS, DARK_COLORS, SIZES, SHADOWS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';

export default function ReportsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const [viewMode, setViewMode] = useState('daily'); // daily, weekly, monthly, custom
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
  });
  const [showCustomRangePicker, setShowCustomRangePicker] = useState(false);
  const [isSelectingStartDate, setIsSelectingStartDate] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    totalTime: 0,
    totalSessions: 0,
    totalQuestions: 0,
  });
  const [selectedStudy, setSelectedStudy] = useState(null);
  
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
  const [showDetailModal, setShowDetailModal] = useState(false);

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
      // Demo mod kontrolü - route params'tan isDemo'yu al
      const routeIsDemo = route?.params?.isDemo || false;
      
      // Eğer demo moddaysa, auth kontrolü yapma
      if (routeIsDemo) {
        setIsDemo(true);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      setIsDemo(!user); // Kullanıcı yoksa demo mod
    } catch (error) {
      console.error('Auth check error:', error);
      setIsDemo(true); // Hata olursa demo mod
    }
  };

  useEffect(() => {
    if (isDemo) {
      loadDemoLogs();
    } else {
    fetchLogs();
    }
  }, [selectedDate, viewMode, isDemo]);

  // Sayfa focus olduğunda verileri yenile
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      if (!isDemo) {
        fetchLogs();
      }
    });

    return unsubscribe;
  }, [navigation, isDemo]);

  const loadDemoLogs = () => {
    // Demo veriler - son 7 gün için zengin veri
    const today = new Date();
    today.setHours(10, 30, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const fourDaysAgo = new Date(today);
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const sixDaysAgo = new Date(today);
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

    const demoLogs = [
      // Bugün
      {
        id: 1,
        subject: 'Matematik',
        study_type: 'test',
        topic: 'Türev ve İntegral',
        duration: 45,
        correct_answers: 18,
        wrong_answers: 2,
        empty_answers: 0,
        focus_level: 9,
        created_at: today.toISOString(),
        notes: 'Türev konusunu çok iyi anladım!',
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
        focus_level: 8,
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
        created_at: new Date(today.getTime() - 4 * 60 * 60 * 1000).toISOString(),
        notes: 'Asit-baz konusunu pekiştirdim.',
      },
      {
        id: 4,
        subject: 'Biyoloji',
        study_type: 'test',
        topic: 'Hücre Bölünmesi',
        duration: 40,
        correct_answers: 20,
        wrong_answers: 4,
        empty_answers: 1,
        focus_level: 8,
        created_at: new Date(today.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        notes: 'Mitoz ve mayoz farkını öğrendim.',
      },
      
      // Dün
      {
        id: 5,
        subject: 'Matematik',
        study_type: 'test',
        topic: 'Limit ve Süreklilik',
        duration: 50,
        correct_answers: 22,
        wrong_answers: 3,
        empty_answers: 0,
        focus_level: 9,
        created_at: yesterday.toISOString(),
        notes: 'Limit konusunda çok başarılıyım!',
      },
      {
        id: 6,
        subject: 'Türkçe',
        study_type: 'topic',
        topic: 'Paragraf Analizi',
        duration: 35,
        correct_answers: null,
        wrong_answers: null,
        empty_answers: null,
        focus_level: 7,
        created_at: new Date(yesterday.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        notes: 'Paragraf sorularında daha dikkatli olmalıyım.',
      },
      {
        id: 7,
        subject: 'Tarih',
        study_type: 'video',
        topic: 'Osmanlı Devleti Kuruluşu',
        duration: 25,
        correct_answers: null,
        wrong_answers: null,
        empty_answers: null,
        focus_level: 8,
        created_at: new Date(yesterday.getTime() - 5 * 60 * 60 * 1000).toISOString(),
        notes: 'Tarih videoları çok eğlenceli.',
      },
      
      // 2 gün önce
      {
        id: 8,
        subject: 'Coğrafya',
        study_type: 'test',
        topic: 'İklim Tipleri',
        duration: 40,
        correct_answers: 19,
        wrong_answers: 4,
        empty_answers: 1,
        focus_level: 8,
        created_at: twoDaysAgo.toISOString(),
        notes: 'İklim konusunu pekiştirdim.',
      },
      {
        id: 9,
        subject: 'Edebiyat',
        study_type: 'topic',
        topic: 'Divan Edebiyatı',
        duration: 30,
        correct_answers: null,
        wrong_answers: null,
        empty_answers: null,
        focus_level: 7,
        created_at: new Date(twoDaysAgo.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        notes: 'Klasik edebiyat çok zor.',
      },
      
      // 3 gün önce
      {
        id: 10,
        subject: 'Matematik',
        study_type: 'test',
        topic: 'Fonksiyonlar',
        duration: 55,
        correct_answers: 24,
        wrong_answers: 1,
        empty_answers: 0,
        focus_level: 9,
        created_at: threeDaysAgo.toISOString(),
        notes: 'Fonksiyonlarda çok iyiyim!',
      },
      {
        id: 11,
        subject: 'Fizik',
        study_type: 'video',
        topic: 'Elektrik ve Manyetizma',
        duration: 45,
        correct_answers: null,
        wrong_answers: null,
        empty_answers: null,
        focus_level: 8,
        created_at: new Date(threeDaysAgo.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        notes: 'Elektrik konusu ilginç.',
      },
      
      // 4 gün önce
      {
        id: 12,
        subject: 'Kimya',
        study_type: 'test',
        topic: 'Organik Kimya',
        duration: 35,
        correct_answers: 16,
        wrong_answers: 3,
        empty_answers: 1,
        focus_level: 7,
        created_at: fourDaysAgo.toISOString(),
        notes: 'Organik kimya biraz zor.',
      },
      {
        id: 13,
        subject: 'Biyoloji',
        study_type: 'topic',
        topic: 'Genetik',
        duration: 40,
        correct_answers: null,
        wrong_answers: null,
        empty_answers: null,
        focus_level: 8,
        created_at: new Date(fourDaysAgo.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        notes: 'Genetik konusu çok ilginç.',
      },
      
      // 5 gün önce
      {
        id: 14,
        subject: 'Matematik',
        study_type: 'test',
        topic: 'Trigonometri',
        duration: 50,
        correct_answers: 21,
        wrong_answers: 2,
        empty_answers: 0,
        focus_level: 9,
        created_at: fiveDaysAgo.toISOString(),
        notes: 'Trigonometri konusunda çok başarılıyım!',
      },
      {
        id: 15,
        subject: 'Fizik',
        study_type: 'video',
        topic: 'Dalga Hareketi',
        duration: 30,
        correct_answers: null,
        wrong_answers: null,
        empty_answers: null,
        focus_level: 8,
        created_at: new Date(fiveDaysAgo.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        notes: 'Dalga konusu güzel.',
      },
      
      // 6 gün önce
      {
        id: 16,
        subject: 'Türkçe',
        study_type: 'test',
        topic: 'Dil Bilgisi',
        duration: 25,
        correct_answers: 12,
        wrong_answers: 3,
        empty_answers: 0,
        focus_level: 7,
        created_at: sixDaysAgo.toISOString(),
        notes: 'Dil bilgisi konusunda daha çok çalışmalıyım.',
      },
      {
        id: 17,
        subject: 'Tarih',
        study_type: 'topic',
        topic: 'İlk Çağ Medeniyetleri',
        duration: 35,
        correct_answers: null,
        wrong_answers: null,
        empty_answers: null,
        focus_level: 8,
        created_at: new Date(sixDaysAgo.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        notes: 'Antik medeniyetler çok etkileyici.',
      }
    ];

    setLogs(demoLogs);
    calculateStats(demoLogs);
  };

  const fetchLogs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { startDate, endDate } = getDateRange();
      
      // Tarihleri local timezone'da filtrele
      const { data, error } = await supabase
        .from('study_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('study_date', startDate.toISOString())
        .lte('study_date', endDate.toISOString())
        .order('study_date', { ascending: false });

      if (error) throw error;

      // Client-side'da tarih filtrelemesi yap (timezone güvenli)
      const filteredData = (data || []).filter(log => {
        const logDate = new Date(log.study_date);
        const logLocalDate = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
        const selectedLocalDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        
        if (viewMode === 'daily') {
          return logLocalDate.getTime() === selectedLocalDate.getTime();
        } else if (viewMode === 'weekly') {
          const weekStart = new Date(startDate);
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(endDate);
          weekEnd.setHours(23, 59, 59, 999);
          return logLocalDate >= new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()) &&
                 logLocalDate <= new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate());
        } else {
          return logLocalDate.getMonth() === selectedLocalDate.getMonth() &&
                 logLocalDate.getFullYear() === selectedLocalDate.getFullYear();
        }
      });
      
      setLogs(filteredData);
      calculateStats(filteredData);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const getDateRange = () => {
    if (viewMode === 'custom') {
      // Özel tarih aralığı
      const start = new Date(customDateRange.startDate);
      const end = new Date(customDateRange.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }

    const start = new Date(selectedDate);
    const end = new Date(selectedDate);

    if (viewMode === 'daily') {
      // Timezone buffer için 1 gün önce ve 1 gün sonra
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + 1);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'weekly') {
      // Seçili tarihten 6 gün öncesinden başlayarak 7 günlük aralık
      start.setDate(start.getDate() - 6); // 6 gün öncesi
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999); // Seçili tarih dahil
    } else if (viewMode === 'monthly') {
      start.setDate(0); // Önceki ayın son günü (buffer)
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(1); // Sonraki ayın ilk günü (buffer)
      end.setHours(23, 59, 59, 999);
    }

    return { startDate: start, endDate: end };
  };

  const calculateStats = (data) => {
    const totalTime = data.reduce((sum, log) => sum + (log.duration || 0), 0);
    const totalSessions = data.length;
    const totalQuestions = data.reduce((sum, log) => {
      const correct = log.correct_answers || 0;
      const wrong = log.wrong_answers || 0;
      const empty = log.empty_answers || 0;
      return sum + correct + wrong + empty;
    }, 0);

    setStats({
      totalTime: Math.round(totalTime),
      totalSessions,
      totalQuestions,
    });
  };

  const formatDate = () => {
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    if (viewMode === 'daily') {
      return selectedDate.toLocaleDateString('tr-TR', options);
    } else if (viewMode === 'weekly') {
      const { startDate, endDate } = getDateRange();
      return `${startDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}`;
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
      newDate.setDate(newDate.getDate() + (direction * 7));
      // Haftalık görünümde de gelecek tarihlere gitmeyi engelle
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

  // Ders bazında süre analizi
  const getSubjectDurationAnalysis = () => {
    const subjectData = {};
    
    logs.forEach(log => {
      const subject = log.subject;
      if (!subjectData[subject]) {
        subjectData[subject] = 0;
      }
      subjectData[subject] += log.duration || 0;
    });
    
    const totalDuration = Object.values(subjectData).reduce((sum, duration) => sum + duration, 0);
    
    return Object.entries(subjectData)
      .map(([subject, duration]) => ({
        subject,
        duration,
        percentage: totalDuration > 0 ? Math.round((duration / totalDuration) * 100) : 0
      }))
      .sort((a, b) => b.duration - a.duration);
  };

  // Ders bazında soru analizi
  const getSubjectQuestionAnalysis = () => {
    const subjectData = {};
    
    logs.filter(log => log.study_type === 'test').forEach(log => {
      const subject = log.subject;
      if (!subjectData[subject]) {
        subjectData[subject] = 0;
      }
      const correct = log.correct_answers || 0;
      const wrong = log.wrong_answers || 0;
      const empty = log.empty_answers || 0;
      subjectData[subject] += correct + wrong + empty;
    });
    
    const totalQuestions = Object.values(subjectData).reduce((sum, questions) => sum + questions, 0);
    
    return Object.entries(subjectData)
      .map(([subject, questions]) => ({
        subject,
        questions,
        percentage: totalQuestions > 0 ? Math.round((questions / totalQuestions) * 100) : 0
      }))
      .sort((a, b) => b.questions - a.questions);
  };

  // Ders renkleri için sabit palet
  const getSubjectColors = () => {
    return [
      '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#E67E22',
      '#1ABC9C', '#34495E', '#E91E63', '#FF5722', '#795548', '#607D8B'
    ];
  };

  // Tüm dersleri birleştir (süre ve soru analizlerinden)
  const getAllSubjects = () => {
    const durationSubjects = getSubjectDurationAnalysis().map(item => item.subject);
    const questionSubjects = getSubjectQuestionAnalysis().map(item => item.subject);
    const allSubjects = [...new Set([...durationSubjects, ...questionSubjects])];
    return allSubjects;
  };

  const getColorForSubject = (subjectName) => {
    const colors = getSubjectColors();
    const allSubjects = getAllSubjects();
    const subjectIndex = allSubjects.indexOf(subjectName);
    return colors[subjectIndex % colors.length];
  };

  // Haftalık verileri işle
  const getWeeklyData = () => {
    const weeklyData = [];
    
    // Seçili tarihten 6 gün öncesinden başlayarak 7 günlük aralık oluştur
    const startDate = new Date(selectedDate);
    startDate.setDate(startDate.getDate() - 6); // 6 gün öncesi
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const dayLogs = logs.filter(log => {
        const logDate = new Date(log.study_date);
        const logDateOnly = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
        const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        return logDateOnly.getTime() === dateOnly.getTime();
      });
      
      const totalDuration = dayLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
      const totalQuestions = dayLogs
        .filter(log => log.study_type === 'test')
        .reduce((sum, log) => {
          const correct = log.correct_answers || 0;
          const wrong = log.wrong_answers || 0;
          const empty = log.empty_answers || 0;
          return sum + correct + wrong + empty;
        }, 0);
      
      weeklyData.push({
        date: date,
        dayName: date.toLocaleDateString('tr-TR', { weekday: 'short' }),
        duration: totalDuration,
        questions: totalQuestions,
        studyCount: dayLogs.length
      });
    }
    
    return weeklyData;
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
          <Text style={styles.title}>Raporlarım</Text>
          <Text style={styles.subtitle}>Çalışma geçmişini incele</Text>
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
            onPress={() => setViewMode('weekly')}
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

        {/* Günlük/Haftalık Kartları ile Tarih Kartı Arası Banner Reklam */}
        <AdBanner 
          style={styles.reportsBanner}
          onAdLoaded={() => console.log('Reports banner ad loaded')}
          onAdFailedToLoad={(error) => console.log('Reports banner ad failed:', error)}
        />

        {/* Date Selector */}
        {viewMode === 'custom' ? (
          <View style={styles.customDateSelector}>
            <TouchableOpacity 
              style={styles.customDateButton}
              onPress={() => setShowCustomRangePicker(true)}
            >
              <Ionicons name="calendar" size={20} color={colors.primary} />
              <Text style={styles.customDateText}>
                {customDateRange.startDate.toLocaleDateString('tr-TR')} - {customDateRange.endDate.toLocaleDateString('tr-TR')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
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
        )}

        {showDatePicker && (
          <View style={styles.modalOverlay}>
            <View style={[styles.customDateModal, { backgroundColor: colors.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {viewMode === 'custom' 
                    ? (isSelectingStartDate ? 'Başlangıç Tarihi Seçin' : 'Bitiş Tarihi Seçin')
                    : 'Tarih Seçin'
                  }
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
                          const newDate = new Date(day.date);
                          setSelectedDate(newDate);
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

        {/* Custom Date Range Picker Modal */}
        {showCustomRangePicker && (
          <View style={styles.modalOverlay}>
            <View style={styles.customRangeModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Tarih Aralığı Seçin</Text>
                <TouchableOpacity onPress={() => setShowCustomRangePicker(false)}>
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.dateRangeContainer}>
                <View style={styles.dateRangeItem}>
                  <Text style={styles.dateRangeLabel}>Başlangıç Tarihi</Text>
                  <TouchableOpacity 
                    style={styles.dateRangeButton}
                    onPress={() => {
                      setShowCustomRangePicker(false);
                      // Başlangıç tarihi seçimi için işaretle
                      setIsSelectingStartDate(true);
                      setSelectedDate(customDateRange.startDate);
                      setShowDatePicker(true);
                    }}
                  >
                    <Text style={styles.dateRangeText}>
                      {customDateRange.startDate.toLocaleDateString('tr-TR')}
                    </Text>
                    <Ionicons name="calendar" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.dateRangeItem}>
                  <Text style={styles.dateRangeLabel}>Bitiş Tarihi</Text>
                  <TouchableOpacity 
                    style={styles.dateRangeButton}
                    onPress={() => {
                      setShowCustomRangePicker(false);
                      // Bitiş tarihi seçimi için işaretle
                      setIsSelectingStartDate(false);
                      setSelectedDate(customDateRange.endDate);
                      setShowDatePicker(true);
                    }}
                  >
                    <Text style={styles.dateRangeText}>
                      {customDateRange.endDate.toLocaleDateString('tr-TR')}
                    </Text>
                    <Ionicons name="calendar" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalButton}
                  onPress={() => setShowCustomRangePicker(false)}
                >
                  <Text style={styles.modalButtonText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={() => {
                    setShowCustomRangePicker(false);
                    fetchLogs();
                  }}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Uygula</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Statistics Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: isDark ? colors.primary + '20' : '#F3F4F6' }]}>
            <Ionicons name="time-outline" size={28} color={isDark ? colors.primary : '#6366F1'} />
            <Text style={[styles.statValue, { color: isDark ? colors.textPrimary : '#1F2937' }]}>{formatDuration(stats.totalTime)}</Text>
            <Text style={[styles.statLabel, { color: isDark ? colors.textSecondary : '#6B7280' }]}>Toplam Süre</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: isDark ? colors.success + '20' : '#F0FDF4' }]}>
            <Ionicons name="book-outline" size={28} color={isDark ? colors.success : '#10B981'} />
            <Text style={[styles.statValue, { color: isDark ? colors.textPrimary : '#1F2937' }]}>{stats.totalSessions}</Text>
            <Text style={[styles.statLabel, { color: isDark ? colors.textSecondary : '#6B7280' }]}>Çalışma Sayısı</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: isDark ? colors.info + '20' : '#DBEAFE' }]}>
            <Ionicons name="list-circle-outline" size={28} color={isDark ? colors.info : '#3B82F6'} />
            <Text style={[styles.statValue, { color: isDark ? colors.textPrimary : '#1F2937' }]}>{stats.totalQuestions}</Text>
            <Text style={[styles.statLabel, { color: isDark ? colors.textSecondary : '#6B7280' }]}>Toplam Soru</Text>
          </View>
        </View>

        {/* Haftalık Performans Grafiği */}
        {viewMode === 'weekly' && logs.length > 0 && (
          <Card style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Haftalık Performans</Text>
            </View>
            <View style={styles.chartContainer}>
              {(() => {
                const weeklyData = getWeeklyData();
                // Tüm değerleri birleştir ve ortak maksimum bul
                const allDurations = weeklyData.map(day => day.duration);
                const allQuestions = weeklyData.map(day => day.questions);
                const allValues = [...allDurations, ...allQuestions];
                const globalMax = Math.max(...allValues, 1);
                const maxBarHeight = 80;
                
                return weeklyData.map((day, index) => {
                  return (
                    <View key={index} style={styles.chartDay}>
                      <View style={styles.chartBars}>
                        {/* Süre çubuğu */}
                        <View style={styles.durationBarContainer}>
                          {/* Süre sayısı - çubuğun üstünde */}
                          <View style={styles.valueContainer}>
                            <Text style={styles.durationNumberText}>
                              {day.duration > 0 ? `${day.duration}` : '0'}
                            </Text>
                            <Text style={styles.durationUnitText}>dk</Text>
                          </View>
                          <View 
                            style={[
                              styles.durationBar, 
                              { 
                                height: Math.max(4, (day.duration / globalMax) * maxBarHeight),
                                backgroundColor: colors.primary
                              }
                            ]} 
                          />
                        </View>
                        
                        {/* Soru çubuğu */}
                        <View style={styles.questionsBarContainer}>
                          {/* Soru sayısı - çubuğun üstünde */}
                          <View style={styles.valueContainer}>
                            <Text style={styles.questionsNumberText}>
                              {day.questions > 0 ? `${day.questions}` : '0'}
                            </Text>
                            <Text style={styles.questionsUnitText}>soru</Text>
                          </View>
                          <View 
                            style={[
                              styles.questionsBar, 
                              { 
                                height: Math.max(4, (day.questions / globalMax) * maxBarHeight),
                                backgroundColor: colors.warning
                              }
                            ]} 
                          />
                        </View>
                      </View>
                      
                      <Text style={styles.chartDayLabel}>{day.dayName}</Text>
                    </View>
                  );
                });
              })()}
            </View>
            
            {/* Grafik açıklaması */}
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: colors.primary }]} />
                <Text style={styles.legendText}>Süre (dk)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: colors.warning }]} />
                <Text style={styles.legendText}>Soru</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Detaylı Görünüm Butonu */}
        {logs.length > 0 && (
          <View style={styles.detailViewContainer}>
            <TouchableOpacity 
              style={styles.detailViewButton}
              onPress={() => setShowDetailModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="analytics-outline" size={20} color={colors.primary} />
              <Text style={styles.detailViewButtonText}>Detaylı Görünüm</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Study Logs List */}
        <View style={styles.logsSection}>
          <Text style={styles.sectionTitle}>Çalışma Detayları</Text>
          
          {logs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color={colors.textLight} />
              <Text style={styles.emptyText}>Bu tarihte çalışma kaydı yok</Text>
              <Text style={styles.emptySubtext}>Çalışmaya başla ve ilerlemeini takip et!</Text>
            </View>
          ) : (
            logs.map((log) => {
              // Net hesaplama
              const totalQuestions = (log.correct_answers || 0) + (log.wrong_answers || 0) + (log.empty_answers || 0);
              const netScore = totalQuestions > 0 ? ((log.correct_answers || 0) - (log.wrong_answers || 0) / 4).toFixed(2) : null;
              
              return (
                <TouchableOpacity 
                  key={log.id} 
                  style={styles.logCard}
                  onPress={() => {
                    setSelectedStudy({
                      ...log,
                      correct: log.correct_answers,
                      wrong: log.wrong_answers,
                      empty: log.empty_answers,
                      focusLevel: log.focus_level,
                      study_type: log.study_type,
                      topic: log.topic,
                      notes: log.notes,
                      subject: log.subject,
                      duration: log.duration,
                    });
                    setModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                <View style={styles.logHeader}>
                  <View style={styles.logTitleContainer}>
                      <Ionicons name="book" size={20} color={colors.primary} />
                    <Text style={styles.logSubject}>{log.subject}</Text>
                  </View>
                  <View style={[styles.focusBadge, { backgroundColor: getFocusColor(log.focus_level) + '20' }]}>
                    <Ionicons name="flame" size={14} color={getFocusColor(log.focus_level)} />
                    <Text style={[styles.focusText, { color: getFocusColor(log.focus_level) }]}>
                      {log.focus_level}/10
                    </Text>
                  </View>
                </View>

                <View style={styles.logDetails}>
                  <View style={styles.logDetail}>
                      <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.logDetailText}>{formatDuration(log.duration)}</Text>
                  </View>
                  <View style={styles.logDetail}>
                      <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.logDetailText}>
                      {new Date(log.created_at).toLocaleTimeString('tr-TR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Text>
                  </View>
                </View>

                  {/* Soru İstatistikleri - Sadece test türündeyse */}
                  {log.study_type === 'test' && totalQuestions > 0 ? (
                    <View style={styles.questionStats}>
                      <View style={styles.statBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={styles.statBadgeText}>{log.correct_answers || 0} Doğru</Text>
                      </View>
                      <View style={styles.statBadge}>
                        <Ionicons name="close-circle" size={16} color={colors.error} />
                        <Text style={styles.statBadgeText}>{log.wrong_answers || 0} Yanlış</Text>
                      </View>
                      <View style={styles.statBadge}>
                        <Ionicons name="remove-circle" size={16} color={colors.textLight} />
                        <Text style={styles.statBadgeText}>{log.empty_answers || 0} Boş</Text>
                      </View>
                      {netScore && (
                        <View style={[styles.statBadge, styles.netBadge]}>
                          <Text style={styles.netBadgeText}>🎯 {netScore} Net</Text>
                        </View>
                      )}
                    </View>
                  ) : log.study_type && log.study_type !== 'test' ? (
                    <View style={styles.questionStats}>
                      <View style={[styles.statBadge, styles.studyTypeBadge]}>
                        <Text style={styles.studyTypeBadgeText}>
                          {log.study_type === 'topic' && '📖 Konu Çalışması'}
                          {log.study_type === 'video' && '🎥 Video İzleme'}
                          {log.study_type === 'lecture' && '👨‍🏫 Ders Dinleme'}
                          {log.study_type === 'reading' && '📚 Kitap Okuma'}
                          {log.study_type === 'other' && '✏️ Diğer'}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                {log.notes && (
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesLabel}>Notlar:</Text>
                    <Text style={styles.notesText}>{log.notes}</Text>
                  </View>
                )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
      </Container>

      {/* Modals - Container dışında */}
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
                  console.error('Silme hatası:', error);
                  Alert.alert('Hata', 'Kayıt silinirken bir hata oluştu.');
                }
              }
            });
            setShowConfirmModal(true);
          }, 100);
        }}
      />

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

      {/* Detaylı Görünüm Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detaylı Görünüm</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowDetailModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {/* Ders Bazında Süre Analizi */}
            <View style={styles.analysisCard}>
              <Text style={styles.analysisTitle}>Ders Bazında Çalışılan Süre</Text>
              <Text style={styles.analysisSubtitle}>Hangi derse ne kadar vakit ayırdınız?</Text>
              
              {getSubjectDurationAnalysis().length > 0 ? (
                <View style={styles.analysisList}>
                  {getSubjectDurationAnalysis().map((item, index) => (
                    <View key={index} style={styles.subjectRow}>
                      <View style={styles.subjectInfo}>
                        <View style={[styles.subjectColorDot, { backgroundColor: getColorForSubject(item.subject) }]} />
                        <Text style={styles.subjectName}>{item.subject}</Text>
                      </View>
                      <View style={styles.subjectStats}>
                        <Text style={styles.subjectPercentage}>{item.percentage}%</Text>
                        <Text style={styles.subjectValue}>{Math.round(item.duration)} dk</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyAnalysis}>
                  <Ionicons name="time-outline" size={48} color={colors.textLight} />
                  <Text style={styles.emptyAnalysisText}>Henüz çalışma kaydı yok</Text>
                </View>
              )}
            </View>

            {/* Ders Bazında Soru Analizi */}
            <View style={styles.analysisCard}>
              <Text style={styles.analysisTitle}>Ders Bazında Çözülen Sorular</Text>
              <Text style={styles.analysisSubtitle}>Hangi dersten daha çok soru çözdünüz?</Text>
              
              {getSubjectQuestionAnalysis().length > 0 ? (
                <View style={styles.analysisList}>
                  {getSubjectQuestionAnalysis().map((item, index) => (
                    <View key={index} style={styles.subjectRow}>
                      <View style={styles.subjectInfo}>
                        <View style={[styles.subjectColorDot, { backgroundColor: getColorForSubject(item.subject) }]} />
                        <Text style={styles.subjectName}>{item.subject}</Text>
                      </View>
                      <View style={styles.subjectStats}>
                        <Text style={styles.subjectPercentage}>{item.percentage}%</Text>
                        <Text style={styles.subjectValue}>{item.questions} soru</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyAnalysis}>
                  <Ionicons name="help-circle-outline" size={48} color={colors.textLight} />
                  <Text style={styles.emptyAnalysisText}>Henüz test çözülmedi</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

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

  // Statistics
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    ...SHADOWS.small,
  },
  statValue: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: SIZES.tiny,
    color: colors.textSecondary,
    marginTop: 4,
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
  reportsBanner: {
    marginHorizontal: SIZES.padding,
    marginVertical: SIZES.padding,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    height: 60,
  },
  // Detaylı Görünüm Stilleri
  detailViewContainer: {
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
  },
  detailViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    ...SHADOWS.small,
  },
  detailViewButtonText: {
    flex: 1,
    marginLeft: 12,
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
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
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: SIZES.padding,
  },
  analysisCard: {
    backgroundColor: colors.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.padding,
    ...SHADOWS.small,
  },
  analysisTitle: {
    fontSize: SIZES.h4,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  analysisSubtitle: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginBottom: SIZES.padding,
  },
  analysisList: {
    marginTop: 8,
  },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subjectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subjectColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  subjectName: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subjectStats: {
    alignItems: 'flex-end',
  },
  subjectPercentage: {
    fontSize: SIZES.h4,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 2,
  },
  subjectValue: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
  },
  emptyAnalysis: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.padding * 2,
  },
  emptyAnalysisText: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    marginTop: 12,
  },
  // Haftalık Performans Grafik Stilleri
  chartCard: {
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
    padding: SIZES.padding,
    ...SHADOWS.small,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: SIZES.h4,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    minHeight: 100,
    marginBottom: 16,
    paddingBottom: 8,
  },
  chartDay: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 60,
    marginBottom: 8,
    flex: 1,
  },
  valueContainer: {
    alignItems: 'center',
    marginBottom: 2,
  },
  durationNumberText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
  },
  durationUnitText: {
    fontSize: 7,
    fontWeight: '500',
    color: colors.primary,
    textAlign: 'center',
  },
  questionsNumberText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.warning,
    textAlign: 'center',
  },
  questionsUnitText: {
    fontSize: 6,
    fontWeight: '500',
    color: colors.warning,
    textAlign: 'center',
  },
  durationBarContainer: {
    width: 12,
    minHeight: 60,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginRight: 2,
    flex: 1,
  },
  durationBar: {
    width: 12,
    borderRadius: 6,
    minHeight: 4,
  },
  questionsBarContainer: {
    width: 12,
    minHeight: 60,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginLeft: 2,
    flex: 1,
  },
  questionsBar: {
    width: 12,
    borderRadius: 6,
    minHeight: 4,
  },
  chartDayLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});


