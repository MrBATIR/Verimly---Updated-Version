import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, TextInput, Modal, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Container, Card, Button, SwipeableRow, StudyDetailModal, AdBanner } from '../components';
import { useRewardedAdNew } from '../components/AdRewardedNew';
import { COLORS, DARK_COLORS, SIZES, SHADOWS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import * as Notifications from 'expo-notifications';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';

export default function DashboardScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedStudy, setSelectedStudy] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  
  // Toast notification state'leri
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastAnim = useState(new Animated.Value(0))[0];
  
  // Confirmation modal state'leri
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState(null);

  // Rewarded reklam hook'u - screen name ile
  const rewardedAd = useRewardedAdNew();
  const { showAd: showRewardedAd, isLoaded: isRewardedLoaded, shouldShow: shouldShowRewardedAd } = rewardedAd;

  // Pomodoro Timer state'leri
  const [timerState, setTimerState] = useState('idle'); // idle, working, paused, break, completed
  const [workDuration, setWorkDuration] = useState(30); // dakika
  const [breakDuration, setBreakDuration] = useState(5); // dakika
  const [timeLeft, setTimeLeft] = useState(30 * 60); // saniye
  const [currentSession, setCurrentSession] = useState(null); // Mevcut çalışma oturumu
  const [completedSessions, setCompletedSessions] = useState([]); // Tamamlanan çalışmalar ve molalar
  const [sessionName, setSessionName] = useState(''); // Çalışma adı düzenleme
  const [showNameEditModal, setShowNameEditModal] = useState(false);
  const [showSessionNameModal, setShowSessionNameModal] = useState(false); // Çalışma başlatmadan önce ad sor
  const [newSessionName, setNewSessionName] = useState(''); // Yeni çalışma için ad
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const timerIntervalRef = useRef(null);
  const viewShotRef = useRef(null);

  // Motivasyon sözleri
  const motivationQuotes = [
    'Her adım bir ilerlemedir 🚀',
    'Başarı senin ellerinde 💪',
    'Azimle devam et 🌟',
    'Bugün senin günün ✨',
    'Hedefine odaklan 🎯',
    'Çalışmak güzeldir 📚',
    'Zamanın değerini bil ⏰',
    'İlerleme kaydediyorsun 📈',
    'Güçlü kal 💎',
    'Başarı yakın 🏆',
    'Durmak yok, yola devam 🔥',
    'Her dakika değerli ⭐',
    'Hedefine yaklaşıyorsun 🎓',
    'Çalışma ruhu yüksek 💡',
    'Başarıya odaklan 🌈',
    'Mükemmellik senin içinde ✊',
  ];

  // Dakikaya göre motivasyon sözü seç
  const getMotivationQuote = () => {
    const minutesLeft = Math.floor(timeLeft / 60);
    const quoteIndex = minutesLeft % motivationQuotes.length;
    return motivationQuotes[quoteIndex];
  };

  
  // Reklam sistemi state'leri
  const [adCount, setAdCount] = useState({ interstitial_count: 0 });
  const [isPremium, setIsPremium] = useState(false);
  const [adsRemoved, setAdsRemoved] = useState(false);
  
  // Tema context'ini kullan
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

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
    loadSelectedAvatar();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadSelectedAvatar();
    });

    return unsubscribe;
  }, [navigation]);

  // Bildirim izni kontrolü
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        // Bildirim izni iste
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        // İzin yoksa sessizce devam et (hata verme)
        if (finalStatus !== 'granted') {
          console.log('Bildirim izni verilmedi, bildirimler gösterilmeyecek');
          return;
        }
        
        // Bildirim handler'ı ayarla
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
      } catch (error) {
        // Hata durumunda sessizce devam et
        console.log('Bildirim kurulumu hatası:', error);
      }
    };
    
    setupNotifications();
  }, []);

  // Timer interval yönetimi
  useEffect(() => {
    if (timerState === 'working' || timerState === 'break') {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerState, handleTimerComplete]);

  // Bildirim gönderme fonksiyonu - hata kontrolü ile
  const sendNotification = async (title, body) => {
    try {
      // İzin kontrolü
      const { status } = await Notifications.getPermissionsAsync();
      
      if (status !== 'granted') {
        // İzin yoksa sessizce çık (hata verme)
        console.log('Bildirim izni yok, bildirim gönderilemedi');
        return;
      }
      
      // Bildirim gönder - icon ile
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          // Android için icon (production build'de çalışır)
          // iOS otomatik olarak app icon'unu kullanır
        },
        trigger: null, // Anında gönder
      });
    } catch (error) {
      // Hata durumunda sessizce devam et (kullanıcıya gösterme)
      console.log('Bildirim gönderme hatası:', error);
    }
  };

  // Timer başlatma
  const startTimer = () => {
    if (timerState === 'idle' || timerState === 'paused') {
      // Çalışmayı direkt başlat (varsayılan "Çalışma" adıyla)
      setCompletedSessions((prev) => {
        const sessionId = Date.now();
        const newSession = {
          id: sessionId,
          type: 'work',
          name: 'Çalışma',
          startTime: new Date(),
          duration: 0,
          totalSeconds: 0,
          completed: false,
          pauseStartTime: null,
          totalPauseSeconds: 0,
        };
        setCurrentSession(newSession);
        setTimeLeft(workDuration * 60);
        setTimerState('working');
        return prev;
      });
    } else if (timerState === 'completed') {
      // Mola başlat - mola için session oluştur
      const breakSession = {
        id: Date.now(),
        type: 'break',
        name: 'Mola',
        startTime: new Date(),
        duration: 0,
        totalSeconds: 0,
        completed: false,
        pauseStartTime: null,
        totalPauseSeconds: 0,
      };
      setCurrentSession(breakSession);
      setTimerState('break');
      setTimeLeft(breakDuration * 60);
      sendNotification('Mola Zamanı! 🎉', `${breakDuration} dakika mola ver.`);
    }
  };

  // Timer duraklatma
  const pauseTimer = () => {
    if (timerState === 'working' || timerState === 'break') {
      // Duraklatma başladığında zamanı kaydet
      if (currentSession) {
        setCurrentSession({
          ...currentSession,
          pauseStartTime: new Date(),
        });
      }
      setTimerState('paused');
    }
  };

  // Timer devam ettirme
  const resumeTimer = () => {
    if (timerState === 'paused' && currentSession) {
      // Duraklatma süresini hesapla ve ekle
      let pauseDuration = 0;
      if (currentSession.pauseStartTime) {
        pauseDuration = Math.floor((new Date() - currentSession.pauseStartTime) / 1000);
      }
      const updatedSession = {
        ...currentSession,
        totalPauseSeconds: (currentSession.totalPauseSeconds || 0) + pauseDuration,
        pauseStartTime: null,
      };
      setCurrentSession(updatedSession);
      const prevState = currentSession.type === 'work' ? 'working' : 'break';
      setTimerState(prevState);
    }
  };

  // Çalışma durdurulduğunda ad alındıktan sonra kaydet ve mola başlat
  const stopWorkSessionWithName = (name) => {
    if (!currentSession || currentSession.type !== 'work') return;
    
    // Eğer hala duraklatılmışsa, son duraklatma süresini de ekle
    let finalPauseSeconds = currentSession.totalPauseSeconds || 0;
    if (currentSession.pauseStartTime) {
      const lastPauseDuration = Math.floor((new Date() - currentSession.pauseStartTime) / 1000);
      finalPauseSeconds += lastPauseDuration;
    }
    const totalSeconds = Math.floor((new Date() - currentSession.startTime) / 1000) - finalPauseSeconds;
    const duration = Math.floor(totalSeconds / 60);
    
    // Adı güncelle (boş bırakılırsa "Çalışma" olarak kal)
    const sessionNameToUse = name.trim() || 'Çalışma';
    const updatedSession = {
      ...currentSession,
      name: sessionNameToUse,
      duration,
      totalSeconds,
      totalPauseSeconds: finalPauseSeconds,
      completed: false,
    };
    setCompletedSessions([...completedSessions, updatedSession]);
    
    // Çalışma durdurulduğunda direkt mola başlat - mola için session oluştur
    const breakSession = {
      id: Date.now(),
      type: 'break',
      name: 'Mola',
      startTime: new Date(),
      duration: 0,
      totalSeconds: 0,
      completed: false,
      pauseStartTime: null,
      totalPauseSeconds: 0,
    };
    setCurrentSession(breakSession);
    setTimerState('break');
    setTimeLeft(breakDuration * 60);
    sendNotification('Mola Zamanı! 🎉', `${breakDuration} dakika mola ver.`);
    
    setShowSessionNameModal(false);
    setNewSessionName('');
  };

  // Timer durdurma
  const stopTimer = () => {
    // Çalışma durduruluyor (working veya paused durumunda)
    if ((timerState === 'working' || timerState === 'paused') && currentSession && currentSession.type === 'work') {
      // Çalışma adını sor
      setNewSessionName(currentSession.name === 'Çalışma' ? '' : currentSession.name);
      setShowSessionNameModal(true);
    } else if ((timerState === 'break' || timerState === 'paused') && currentSession && currentSession.type === 'break') {
      // Mola durduruluyor - mola süresini hesapla ve kaydet
      // Eğer hala duraklatılmışsa, son duraklatma süresini de ekle
      let finalPauseSeconds = currentSession.totalPauseSeconds || 0;
      if (currentSession.pauseStartTime) {
        const lastPauseDuration = Math.floor((new Date() - currentSession.pauseStartTime) / 1000);
        finalPauseSeconds += lastPauseDuration;
      }
      const totalSeconds = Math.floor((new Date() - currentSession.startTime) / 1000) - finalPauseSeconds;
      const duration = Math.floor(totalSeconds / 60);
      const updatedBreakSession = {
        ...currentSession,
        duration,
        totalSeconds,
        totalPauseSeconds: finalPauseSeconds,
        completed: false,
        endTime: new Date(),
      };
      setCompletedSessions([...completedSessions, updatedBreakSession]);
      setCurrentSession(null);
      // Mola durdurulduğunda idle'e dön
      setTimerState('idle');
      setTimeLeft(workDuration * 60);
    } else {
      // Diğer durumlar için idle'e dön
      setTimerState('idle');
      setTimeLeft(workDuration * 60);
    }
  };

  // Timer tamamlanma
  const handleTimerComplete = useCallback(() => {
    setTimerState((prevState) => {
      if (prevState === 'working') {
        setCurrentSession((session) => {
          if (session) {
            // Son duraklatma süresini kontrol et
            let finalPauseSeconds = session.totalPauseSeconds || 0;
            if (session.pauseStartTime) {
              const lastPauseDuration = Math.floor((new Date() - session.pauseStartTime) / 1000);
              finalPauseSeconds += lastPauseDuration;
            }
            // Toplam süre = workDuration * 60 - duraklatma süreleri
            const totalSeconds = (workDuration * 60) - finalPauseSeconds;
            const duration = Math.floor(totalSeconds / 60);
            const completedSession = {
              ...session,
              duration,
              totalSeconds,
              totalPauseSeconds: finalPauseSeconds,
              completed: true,
              endTime: new Date(),
            };
            setCompletedSessions((prev) => [...prev, completedSession]);
            sendNotification('Çalışma Tamamlandı! 🎊', 'Mola zamanı geldi.');
            return null;
          }
          return session;
        });
        return 'completed';
      } else if (prevState === 'break') {
        setCurrentSession((session) => {
          if (session && session.type === 'break') {
            // Son duraklatma süresini kontrol et
            let finalPauseSeconds = session.totalPauseSeconds || 0;
            if (session.pauseStartTime) {
              const lastPauseDuration = Math.floor((new Date() - session.pauseStartTime) / 1000);
              finalPauseSeconds += lastPauseDuration;
            }
            // Toplam süre = breakDuration * 60 - duraklatma süreleri
            const totalSeconds = (breakDuration * 60) - finalPauseSeconds;
            const duration = Math.floor(totalSeconds / 60);
            const completedBreakSession = {
              ...session,
              duration,
              totalSeconds,
              totalPauseSeconds: finalPauseSeconds,
              completed: true,
              endTime: new Date(),
            };
            setCompletedSessions((prev) => [...prev, completedBreakSession]);
            sendNotification('Mola Bitti! ⏰', 'Yeni çalışmaya başlayabilirsin.');
            setTimeLeft(workDuration * 60);
            return null;
          } else {
            // Session yoksa oluştur (duraklatma olmadan)
            const totalSeconds = breakDuration * 60;
            const duration = breakDuration;
            const breakSession = {
              id: Date.now(),
              type: 'break',
              name: 'Mola',
              duration,
              totalSeconds,
              totalPauseSeconds: 0,
              completed: true,
              endTime: new Date(),
            };
            setCompletedSessions((prev) => [...prev, breakSession]);
            sendNotification('Mola Bitti! ⏰', 'Yeni çalışmaya başlayabilirsin.');
            setTimeLeft(workDuration * 60);
            return null;
          }
        });
        return 'idle';
      }
      return prevState;
    });
  }, [workDuration, breakDuration]);

  // Çalışma adını güncelleme
  const updateSessionName = (sessionId, newName) => {
    setCompletedSessions(completedSessions.map(s => 
      s.id === sessionId ? { ...s, name: newName } : s
    ));
    setShowNameEditModal(false);
    setSessionName('');
  };

  // Çalışma özetini paylaşma
  const shareSummary = async () => {
    try {
      if (viewShotRef.current && completedSessions.length > 0) {
        const uri = await viewShotRef.current.capture();
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri);
        } else {
          Alert.alert('Hata', 'Paylaşım bu cihazda desteklenmiyor.');
        }
      }
    } catch (error) {
      console.error('Paylaşım hatası:', error);
      Alert.alert('Hata', 'Paylaşım sırasında bir hata oluştu.');
    }
  };


  const loadSelectedAvatar = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Önce AsyncStorage'dan kontrol et (hızlı erişim için)
      const userAvatarKey = `selectedAvatar_${user.id}`;
      const savedAvatar = await AsyncStorage.getItem(userAvatarKey);
      if (savedAvatar) {
        setSelectedAvatar(savedAvatar);
        return;
      }

      // AsyncStorage'da yoksa veritabanından yükle
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('selected_avatar')
        .eq('user_id', user.id)
        .single();

      if (!error && profile?.selected_avatar) {
        setSelectedAvatar(profile.selected_avatar);
        // AsyncStorage'a da kaydet (hızlı erişim için)
        await AsyncStorage.setItem(userAvatarKey, profile.selected_avatar);
      }
    } catch (error) {
      console.error('Avatar yüklenirken hata:', error);
    }
  };

  const checkAuthStatus = async () => {
    try {
      // Demo mod kontrolü - route params'tan isDemo'yu al
      const routeIsDemo = route?.params?.isDemo || false;
      
      // Eğer demo moddaysa, auth kontrolü yapma
      if (routeIsDemo) {
        setIsDemo(true);
        loadDemoData();
        return;
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      // Session kontrolü - eğer kullanıcı yoksa veya hata varsa demo moda geç veya login'e yönlendir
      if (authError || !user) {
        setIsDemo(true);
        // Eğer demo modda değilse ve navigation varsa login'e yönlendir
        if (navigation && navigation.dispatch) {
          await supabase.auth.signOut();
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            })
          );
        } else {
          loadDemoData();
        }
        return;
      }
      
      setIsDemo(false);
      getUserProfile();
      fetchRecentLogs();
    } catch (error) {
      console.error('Auth check error:', error);
      setIsDemo(true);
      try {
        await supabase.auth.signOut();
        if (navigation && navigation.dispatch) {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            })
          );
        } else {
          loadDemoData();
        }
      } catch (signOutError) {
        loadDemoData();
      }
    }
  };

  useEffect(() => {
    // Route params'tan isDemo'yu kontrol et
    const routeIsDemo = route?.params?.isDemo || false;
    
    if (!routeIsDemo && !isDemo) {
      getUserProfile();
      fetchRecentLogs();
    } else {
      setIsDemo(true);
      loadDemoData();
    }
  }, [isDemo, route?.params?.isDemo]);

  // Sayfa focus olduğunda verileri yenile
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Route params'tan isDemo'yu kontrol et
      const routeIsDemo = route?.params?.isDemo || false;
      
      if (!routeIsDemo && !isDemo) {
        getUserProfile(); // Profil bilgilerini de yenile (güncel ad soyad için)
        fetchRecentLogs();
      }
    });

    return unsubscribe;
  }, [navigation, isDemo, route?.params?.isDemo]);

  const getUserProfile = async () => {
    try {
      // Demo mod kontrolü - route params'tan isDemo'yu al
      const routeIsDemo = route?.params?.isDemo || false;
      
      // Eğer demo moddaysa, auth kontrolü yapma
      if (routeIsDemo || isDemo) {
        return;
      }

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      // Session kontrolü - eğer kullanıcı yoksa veya hata varsa login'e yönlendir
      if (authError || !authUser) {
        console.log('Kullanıcı oturumu geçersiz, login ekranına yönlendiriliyor');
        await supabase.auth.signOut();
        if (navigation && navigation.dispatch) {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            })
          );
        }
        return;
      }
      
      if (authUser) {
        // user_profiles tablosundan detaylı bilgileri çek
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single();

        if (profileError) {
          // Eğer user_profiles'de kayıt yoksa ve kullanıcı veritabanından silinmişse
          if (profileError.code === 'PGRST116' || profileError.message?.includes('0 rows')) {
            console.log('Kullanıcı veritabanında bulunamadı, login ekranına yönlendiriliyor');
            await supabase.auth.signOut();
            if (navigation && navigation.dispatch) {
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                })
              );
            }
            return;
          }
          console.error('User profile bulunamadı:', profileError);
          // Profile bulunamazsa sadece auth user'ı kullan
          setUser({ ...authUser, profile: null });
        } else {
          // Öğrenci ise students tablosundan güncel name bilgisini al
          let updatedProfile = { ...profile };
          if (profile.user_type === 'student') {
            const { data: studentData } = await supabase
              .from('students')
              .select('name')
              .eq('user_id', authUser.id)
              .maybeSingle();
            
            if (studentData?.name) {
              // students tablosundaki name'i profile'a ekle (öncelikli)
              updatedProfile.name = studentData.name;
              // first_name ve last_name'i de name'den parse et
              const nameParts = studentData.name.split(' ');
              updatedProfile.first_name = nameParts[0] || '';
              updatedProfile.last_name = nameParts.slice(1).join(' ') || '';
            }
          }
          
          setUser({ ...authUser, profile: updatedProfile });
        }
      } else {
        // Kullanıcı yoksa login'e yönlendir
        console.log('Kullanıcı bulunamadı, login ekranına yönlendiriliyor');
        await supabase.auth.signOut();
        if (navigation && navigation.dispatch) {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            })
          );
        }
      }
    } catch (error) {
      console.error('Kullanıcı bilgisi alınamadı:', error);
      // Hata durumunda loading'i kapat ve login'e yönlendir
      setLoading(false);
      try {
        await supabase.auth.signOut();
        if (navigation && navigation.dispatch) {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            })
          );
        }
      } catch (signOutError) {
        console.error('Sign out hatası:', signOutError);
      }
    }
  };

  const fetchRecentLogs = async () => {
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setLoading(false);
        return;
      }

      // Son 7 günün verilerini çek
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('study_logs')
        .select('*')
        .eq('user_id', authUser.id)
        .gte('study_date', sevenDaysAgo.toISOString())
        .order('study_date', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Study logs yükleme hatası:', error);
        setRecentLogs([]);
        setLoading(false);
        return;
      }

      // Verileri formatla
      const formattedLogs = (data || []).map(log => {
        const logDate = new Date(log.study_date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let dateLabel = '';
        if (logDate.toDateString() === today.toDateString()) {
          dateLabel = 'Bugün';
        } else if (logDate.toDateString() === yesterday.toDateString()) {
          dateLabel = 'Dün';
        } else {
          dateLabel = formatDateShort(logDate);
        }

        return {
          id: log.id,
          subject: log.subject,
          study_type: log.study_type,
          topic: log.topic,
          duration: log.duration,
          date: dateLabel,
          fullDate: logDate,
          correct: (log.correct_answers !== null && log.correct_answers !== undefined) ? log.correct_answers : 0,
          wrong: (log.wrong_answers !== null && log.wrong_answers !== undefined) ? log.wrong_answers : 0,
          empty: (log.empty_answers !== null && log.empty_answers !== undefined) ? log.empty_answers : 0,
          focusLevel: log.focus_level,
          notes: log.notes,
        };
      });

      setRecentLogs(formattedLogs);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDemoData = () => {
    // Demo mod - zengin örnek veriler
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const demoLogs = [
      // Bugünkü çalışmalar
      { 
        id: 1, 
        subject: 'Matematik', 
        study_type: 'test', 
        topic: 'Türev ve İntegral', 
        duration: 45, 
        date: 'Bugün', 
        fullDate: today, 
        correct: 18, 
        wrong: 2, 
        empty: 0,
        focus_level: 9,
        notes: 'Türev konusunu çok iyi anladım!'
      },
      { 
        id: 2, 
        subject: 'Fizik', 
        study_type: 'topic', 
        topic: 'Newton Kanunları', 
        duration: 60, 
        date: 'Bugün', 
        fullDate: today, 
        correct: 25, 
        wrong: 3, 
        empty: 2,
        focus_level: 8,
        notes: 'Hareket konusunu bitirdim.'
      },
      { 
        id: 3, 
        subject: 'Kimya', 
        study_type: 'video', 
        topic: 'Asit-Baz Tepkimeleri', 
        duration: 30, 
        date: 'Bugün', 
        fullDate: today, 
        correct: 15, 
        wrong: 1, 
        empty: 0,
        focus_level: 7,
        notes: 'Video çok faydalıydı.'
      },
      { 
        id: 4, 
        subject: 'Biyoloji', 
        study_type: 'topic', 
        topic: 'Hücre Bölünmesi', 
        duration: 40, 
        date: 'Bugün', 
        fullDate: today, 
        correct: 20, 
        wrong: 4, 
        empty: 1,
        focus_level: 8,
        notes: 'Mitoz ve mayoz farkını öğrendim.'
      },
      
      // Dünkü çalışmalar
      { 
        id: 5, 
        subject: 'Matematik', 
        study_type: 'test', 
        topic: 'Limit ve Süreklilik', 
        duration: 50, 
        date: 'Dün', 
        fullDate: yesterday, 
        correct: 22, 
        wrong: 3, 
        empty: 0,
        focus_level: 9,
        notes: 'Limit konusunda çok başarılıyım!'
      },
      { 
        id: 6, 
        subject: 'Türkçe', 
        study_type: 'topic', 
        topic: 'Paragraf Analizi', 
        duration: 35, 
        date: 'Dün', 
        fullDate: yesterday, 
        correct: 16, 
        wrong: 2, 
        empty: 2,
        focus_level: 7,
        notes: 'Paragraf sorularında daha dikkatli olmalıyım.'
      },
      { 
        id: 7, 
        subject: 'Tarih', 
        study_type: 'video', 
        topic: 'Osmanlı Devleti Kuruluşu', 
        duration: 25, 
        date: 'Dün', 
        fullDate: yesterday, 
        correct: 12, 
        wrong: 1, 
        empty: 0,
        focus_level: 8,
        notes: 'Tarih videoları çok eğlenceli.'
      },
      
      // 2 gün önceki çalışmalar
      { 
        id: 8, 
        subject: 'Coğrafya', 
        study_type: 'test', 
        topic: 'İklim Tipleri', 
        duration: 40, 
        date: '2 gün önce', 
        fullDate: twoDaysAgo, 
        correct: 19, 
        wrong: 4, 
        empty: 1,
        focus_level: 8,
        notes: 'İklim konusunu pekiştirdim.'
      },
      { 
        id: 9, 
        subject: 'Edebiyat', 
        study_type: 'topic', 
        topic: 'Divan Edebiyatı', 
        duration: 30, 
        date: '2 gün önce', 
        fullDate: twoDaysAgo, 
        correct: 14, 
        wrong: 3, 
        empty: 0,
        focus_level: 7,
        notes: 'Klasik edebiyat çok zor.'
      },
      
      // 3 gün önceki çalışmalar
      { 
        id: 10, 
        subject: 'Matematik', 
        study_type: 'test', 
        topic: 'Fonksiyonlar', 
        duration: 55, 
        date: '3 gün önce', 
        fullDate: threeDaysAgo, 
        correct: 24, 
        wrong: 1, 
        empty: 0,
        focus_level: 9,
        notes: 'Fonksiyonlarda çok iyiyim!'
      },
      { 
        id: 11, 
        subject: 'Fizik', 
        study_type: 'video', 
        topic: 'Elektrik ve Manyetizma', 
        duration: 45, 
        date: '3 gün önce', 
        fullDate: threeDaysAgo, 
        correct: 18, 
        wrong: 2, 
        empty: 1,
        focus_level: 8,
        notes: 'Elektrik konusu ilginç.'
      }
    ];

    setRecentLogs(demoLogs);
    setLoading(false);
  };
  
  const formatDate = (date) => {
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  
  const formatDateShort = (date) => {
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Timer için zaman formatı
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Süre formatı (dakika ve saniye)
  const formatDuration = (totalSeconds) => {
    if (!totalSeconds && totalSeconds !== 0) return '0 dk 0 sn';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins === 0) {
      return `${secs} sn`;
    } else if (secs === 0) {
      return `${mins} dk`;
    } else {
      return `${mins} dk ${secs} sn`;
    }
  };

  // Toplam süre hesaplama (saniye cinsinden)
  const getTotalWorkTime = () => {
    return completedSessions
      .filter(s => s.type === 'work')
      .reduce((sum, s) => sum + (s.totalSeconds || s.duration * 60 || 0), 0);
  };

  const getTotalBreakTime = () => {
    return completedSessions
      .filter(s => s.type === 'break')
      .reduce((sum, s) => sum + (s.totalSeconds || s.duration * 60 || 0), 0);
  };

  const getBreakCount = () => {
    return completedSessions.filter(s => s.type === 'break').length;
  };

  const getWorkCount = () => {
    return completedSessions.filter(s => s.type === 'work').length;
  };

  // Oturum verilerini temizleme
  const clearSessionData = () => {
    Alert.alert(
      'Oturumu Temizle',
      'Bu oturumdaki tüm çalışma ve mola verilerini silmek istediğinize emin misiniz?',
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: () => {
            setCompletedSessions([]);
            setCurrentSession(null);
            showToastNotification('Oturum verileri temizlendi.');
          },
        },
      ]
    );
  };

  // Bugünkü çalışma istatistiklerini hesapla
  const todayStudy = useMemo(() => {
    const todayLogs = recentLogs.filter(log => log.date === 'Bugün');
    
    // Pomodoro timer'dan bugünkü çalışmaları hesapla
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayPomodoroWork = completedSessions.filter(s => {
      if (s.type !== 'work') return false;
      const sessionDate = s.endTime 
        ? new Date(s.endTime) 
        : (s.startTime ? new Date(s.startTime) : now);
      const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
      return sessionDay.getTime() === today.getTime();
    });
    
    const todayPomodoroMinutes = todayPomodoroWork.reduce((sum, s) => {
      const seconds = s.totalSeconds || s.duration * 60 || 0;
      return sum + Math.floor(seconds / 60);
    }, 0);
    
    // Devam eden çalışmayı da ekle (eğer bugün başladıysa)
    let currentWorkMinutes = 0;
    if (currentSession && currentSession.type === 'work' && currentSession.startTime) {
      const sessionDate = new Date(currentSession.startTime);
      const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
      if (sessionDay.getTime() === today.getTime()) {
        const elapsedSeconds = Math.floor((now - sessionDate) / 1000);
        const pauseSeconds = currentSession.totalPauseSeconds || 0;
        currentWorkMinutes = Math.floor((elapsedSeconds - pauseSeconds) / 60);
      }
    }
    
    return {
      totalMinutes: todayLogs.reduce((sum, log) => sum + (Number(log.duration) || 0), 0) + todayPomodoroMinutes + currentWorkMinutes,
      totalQuestions: todayLogs.reduce((sum, log) => sum + ((Number(log.correct) || 0) + (Number(log.wrong) || 0) + (Number(log.empty) || 0)), 0),
      correctAnswers: todayLogs.reduce((sum, log) => {
        const val = Number(log.correct);
        return sum + (isNaN(val) ? 0 : val);
      }, 0),
      wrongAnswers: todayLogs.reduce((sum, log) => {
        const val = Number(log.wrong);
        return sum + (isNaN(val) ? 0 : val);
      }, 0),
      emptyAnswers: todayLogs.reduce((sum, log) => {
        const val = Number(log.empty);
        return sum + (isNaN(val) ? 0 : val);
      }, 0),
    };
  }, [recentLogs, completedSessions, currentSession]);

  const handleEdit = (log) => {
    if (isDemo) {
      Alert.alert('Demo Modu', 'Demo modda düzenleme yapılamaz. Kayıt olmak için giriş ekranına dönün!');
      return;
    }
    navigation.navigate('AddLog', { studyId: log.id });
  };

  const handleDelete = async (log) => {
    if (isDemo) {
      Alert.alert('Demo Modu', 'Demo modda silme yapılamaz. Kayıt olmak için giriş ekranına dönün!');
      return;
    }

    setConfirmData({
      title: 'Kaydı Sil',
      message: `${log.subject} dersindeki çalışma kaydını silmek istediğinize emin misiniz?`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('study_logs')
            .delete()
            .eq('id', log.id);

          if (error) throw error;

          showToastNotification('🗑️ Çalışma kaydı silindi.');
          fetchRecentLogs(); // Listeyi yenile
        } catch (error) {
          console.error('Silme hatası:', error);
          Alert.alert('Hata', 'Kayıt silinirken bir hata oluştu.');
        }
      }
    });
    setShowConfirmModal(true);
  };

  return (
    <>
    <Container>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
        <Text style={styles.greeting}>
          {isDemo 
            ? 'Demo Görüntüleme 🎯' 
            : `Merhaba ${user?.profile?.name || user?.profile?.first_name || user?.user_metadata?.first_name || 'Öğrenci'} 👋`
          }
        </Text>
            <Text style={styles.subtitle}>
              {isDemo 
                ? 'Tüm özellikleri keşfet!' 
                : 'Bugün nasıl gidiyor?'
              }
            </Text>
          </View>
          {isDemo ? (
            <TouchableOpacity 
              style={styles.registerButton}
              onPress={() => setShowAuthModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="log-in-outline" size={20} color={colors.surface} />
              <Text style={styles.registerText}>Giriş</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.profileImageContainer}
              onPress={() => navigation.navigate('Profile')}
            >
              {selectedAvatar ? (
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarEmoji}>{selectedAvatar}</Text>
                </View>
              ) : (
                <View style={styles.defaultProfileContainer}>
                  <Ionicons name="person" size={24} color={colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>


        {/* Bugünkü Özet */}
        <Card style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Bugünkü Çalışma</Text>
            <View style={styles.timeBadge}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={styles.timeText}>{todayStudy.totalMinutes} dk</Text>
            </View>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: colors.success + '20' }]}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                </View>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>{String(todayStudy.correctAnswers ?? 0)}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Doğru</Text>
              </View>

              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: colors.error + '20' }]}>
                  <Ionicons name="close-circle" size={24} color={colors.error} />
                </View>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>{String(todayStudy.wrongAnswers ?? 0)}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Yanlış</Text>
              </View>

              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: colors.textLight + '20' }]}>
                  <Ionicons name="remove-circle" size={24} color={colors.textLight} />
                </View>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>{String(todayStudy.emptyAnswers ?? 0)}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Boş</Text>
              </View>

              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: colors.info + '20' }]}>
                  <Ionicons name="list-circle" size={24} color={colors.info} />
                </View>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>{String(todayStudy.totalQuestions ?? 0)}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Toplam</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Pomodoro Timer */}
        <View style={styles.pomodoroContainer}>
          <Card style={styles.pomodoroCard}>
            <LinearGradient
              colors={timerState === 'working' 
                ? isDark
                  ? ['#A5B4FC', '#818CF8'] // Soft indigo (koyu tema)
                  : ['#C7D2FE', '#A5B4FC'] // Soft indigo (açık tema)
                : timerState === 'break'
                ? isDark
                  ? ['#6EE7B7', '#34D399'] // Soft yeşil (koyu tema)
                  : ['#A7F3D0', '#6EE7B7'] // Soft yeşil (açık tema)
                : isDark 
                  ? ['#818CF8', '#6366F1'] // Soft indigo (koyu tema - idle)
                  : ['#A5B4FC', '#818CF8']} // Soft indigo (açık tema - idle)
              style={styles.pomodoroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.pomodoroHeader}>
                <View style={styles.settingsIconButtonPlaceholder} />
                <Text style={styles.pomodoroTitle}>
                  {timerState === 'working' ? 'Çalışıyorsun' : timerState === 'break' ? 'Mola Zamanı' : timerState === 'paused' ? 'Duraklatıldı' : timerState === 'completed' ? 'Çalışma Tamamlandı!' : 'Verimly Çalışma'}
                </Text>
                <TouchableOpacity
                  style={styles.settingsIconButton}
                  onPress={() => setShowSettingsModal(true)}
                >
                  <Ionicons name="settings-outline" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>

              {/* Motivasyon Sözü */}
              {(timerState === 'working' || timerState === 'break') && (
                <Text style={styles.motivationQuote}>
                  {getMotivationQuote()}
                </Text>
              )}

              {/* Timer Display */}
              <View style={styles.timerDisplay}>
                <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                <Text style={styles.timerSubtext}>
                  {timerState === 'working' ? 'Çalışma Süresi' : timerState === 'break' ? 'Mola Süresi' : 'Hazır'}
                </Text>
              </View>

              {/* Timer Controls */}
              <View style={styles.timerControls}>
                {timerState === 'idle' || timerState === 'completed' ? (
                  <TouchableOpacity
                    style={styles.startButton}
                    onPress={startTimer}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={isDark 
                        ? ['#6EE7B7', '#34D399'] // Soft yeşil (koyu tema)
                        : ['#A7F3D0', '#6EE7B7']} // Soft yeşil (açık tema)
                      style={styles.startButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <View style={styles.startButtonContent}>
                        <Ionicons name="play" size={20} color="#FFF" />
                        <Text style={styles.startButtonText}>Başlat</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : timerState === 'paused' ? (
                  <View style={styles.controlRow}>
                    <TouchableOpacity
                      style={[styles.timerButton, styles.resumeButton]}
                      onPress={resumeTimer}
                    >
                      <Ionicons name="play" size={20} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.timerButton, styles.stopButton]}
                      onPress={stopTimer}
                    >
                      <Ionicons name="stop" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.controlRow}>
                    <TouchableOpacity
                      style={[styles.timerButton, styles.pauseButton]}
                      onPress={pauseTimer}
                    >
                      <Ionicons name="pause" size={20} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.timerButton, styles.stopButton]}
                      onPress={stopTimer}
                    >
                      <Ionicons name="stop" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>


              {/* Session Statistics */}
              {completedSessions.length > 0 && (
                <View style={styles.sessionStats}>
                  <View style={styles.statsHeader}>
                    <Text style={styles.statsTitle}>Bu Oturum</Text>
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={clearSessionData}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FFF" />
                      <Text style={styles.clearButtonText}>Temizle</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.sessionStatsRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{formatDuration(getTotalWorkTime())}</Text>
                      <Text style={styles.statLabel}>Çalışma Süresi</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{formatDuration(getTotalBreakTime()) || '0 dk 0 sn'}</Text>
                      <Text style={styles.statLabel}>Mola Süresi</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{String(getWorkCount() || 0)}</Text>
                      <Text style={styles.statLabel}>Çalışma Sayısı</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{String(getBreakCount() || 0)}</Text>
                      <Text style={styles.statLabel}>Mola Sayısı</Text>
                    </View>
                  </View>
                  
                  {/* Completed Sessions List */}
                  <ScrollView style={styles.completedSessionsList} nestedScrollEnabled>
                    {completedSessions.map((session) => (
                      <View key={session.id} style={styles.sessionItem}>
                        <TouchableOpacity
                          style={styles.sessionItemContent}
                          onPress={() => {
                            if (session.type === 'work') {
                              setSessionName(session.name);
                              setShowNameEditModal(session);
                            }
                          }}
                        >
                          <View style={styles.sessionInfo}>
                            <Ionicons 
                              name={session.type === 'work' ? 'book' : 'cafe'} 
                              size={16} 
                              color={session.type === 'work' ? colors.primary : colors.secondary} 
                            />
                            <View style={styles.sessionNameContainer}>
                              <View style={styles.sessionNameRow}>
                                <Text style={styles.sessionName}>
                                  {session.type === 'work' ? session.name : 'Mola'}
                                </Text>
                                {session.type === 'work' && (
                                  <Ionicons 
                                    name="create-outline" 
                                    size={12} 
                                    color="#FFF" 
                                    style={styles.editIcon}
                                  />
                                )}
                              </View>
                              {session.totalPauseSeconds > 0 && (
                                <Text style={styles.sessionPause}>
                                  ⏸️ Duraklatma: {formatDuration(session.totalPauseSeconds)}
                                </Text>
                              )}
                            </View>
                          </View>
                          <View style={styles.sessionDurationContainer}>
                            <Text style={styles.sessionDuration}>
                              {formatDuration(session.totalSeconds || session.duration * 60)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>

                  {/* Share Button */}
                  {completedSessions.some(s => s.type === 'work') && (
                    <TouchableOpacity
                      style={styles.shareButton}
                      onPress={() => setShowShareModal(true)}
                    >
                      <Ionicons name="share-social" size={20} color="#FFF" />
                      <Text style={styles.shareButtonText}>Paylaş</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </LinearGradient>
          </Card>
        </View>

        {/* Son Çalışmalar */}
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Son Çalışmalar</Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('Reports')}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAll}>Tümünü Gör</Text>
            </TouchableOpacity>
          </View>

          {recentLogs.slice(0, 7).map((log) => (
            <SwipeableRow
              key={log.id}
              onEdit={() => handleEdit(log)}
              onDelete={() => handleDelete(log)}
            >
              <Card 
                style={styles.logCard}
                onPress={() => {
                  setSelectedStudy(log);
                  setModalVisible(true);
                }}
              >
                <View style={styles.logHeader}>
                  <View style={styles.logTitleContainer}>
                    <View style={styles.subjectIcon}>
                      <Ionicons name="book" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.logInfo}>
                      <Text style={styles.logSubject}>{log.subject}</Text>
                      <Text style={styles.logDate}>
                        {log.date} • {formatDateShort(log.fullDate)}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.logBottom}>
                  {/* Sadece test türündeyse soru istatistiklerini göster */}
                  {log.study_type === 'test' && (log.correct > 0 || log.wrong > 0 || log.empty > 0) ? (
                    <View style={styles.logStats}>
                      <View style={styles.logStat}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={styles.logStatText}>{log.correct} Doğru</Text>
                      </View>
                      <View style={styles.logStat}>
                        <Ionicons name="close-circle" size={16} color={colors.error} />
                        <Text style={styles.logStatText}>{log.wrong} Yanlış</Text>
                      </View>
                      <View style={styles.logStat}>
                        <Text style={styles.netText}>Net: {(log.correct - log.wrong / 4).toFixed(2)}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.logStats}>
                      <View style={styles.studyTypeIndicator}>
                        <Text style={styles.studyTypeText}>
                          {log.study_type === 'topic' && '📖 Konu Çalışması'}
                          {log.study_type === 'video' && '🎥 Video İzleme'}
                          {log.study_type === 'lecture' && '👨‍🏫 Ders Dinleme'}
                          {log.study_type === 'reading' && '📚 Kitap Okuma'}
                          {log.study_type === 'other' && '✏️ Diğer'}
                        </Text>
                      </View>
                    </View>
                  )}
                  <View style={styles.durationBadge}>
                    <Ionicons name="time" size={14} color={colors.textSecondary} />
                    <Text style={styles.durationText}>{log.duration} dk</Text>
                  </View>
                </View>
              </Card>
            </SwipeableRow>
          ))}
        </View>

        {/* Banner Reklam */}
        <AdBanner 
          style={styles.bannerAd}
          screenName="dashboard"
        />

      </ScrollView>

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
                  fetchRecentLogs(); // Listeyi yenile
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
    </Container>

      {/* Çalışma Adı Sorma Modal (Başlatmadan Önce) */}
      <Modal
        visible={showSessionNameModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowSessionNameModal(false);
          setNewSessionName('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Çalışma Adı
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Bu çalışma için bir ad belirleyin (boş bırakılırsa "Çalışma" olarak kaydedilir)
            </Text>
            <TextInput
              style={[styles.nameInput, { 
                backgroundColor: colors.background, 
                color: colors.textPrimary,
                borderColor: colors.border 
              }]}
              value={newSessionName}
              onChangeText={setNewSessionName}
              placeholder="Örn: Matematik"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { borderColor: colors.border }]}
                onPress={() => {
                  setShowSessionNameModal(false);
                  setNewSessionName('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>
                  İptal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: colors.primary }]}
                onPress={() => {
                  stopWorkSessionWithName(newSessionName);
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#FFF' }]}>
                  Kaydet
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Name Edit Modal */}
      <Modal
        visible={showNameEditModal !== false}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowNameEditModal(false);
          setSessionName('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Çalışma Adını Düzenle
            </Text>
            <TextInput
              style={[styles.nameInput, { 
                backgroundColor: colors.background, 
                color: colors.textPrimary,
                borderColor: colors.border 
              }]}
              value={sessionName}
              onChangeText={setSessionName}
              placeholder="Örn: Matematik"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { borderColor: colors.border }]}
                onPress={() => {
                  setShowNameEditModal(false);
                  setSessionName('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>
                  İptal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (showNameEditModal && sessionName.trim()) {
                    updateSessionName(showNameEditModal.id, sessionName.trim());
                  }
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#FFF' }]}>
                  Kaydet
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Verimly Çalışma Ayarları
              </Text>
              <TouchableOpacity
                onPress={() => setShowSettingsModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.settingsContent}>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Çalışma Süresi:</Text>
                <View style={styles.settingButtons}>
                  <TouchableOpacity
                    style={styles.settingButton}
                    onPress={() => setWorkDuration(Math.max(5, workDuration - 5))}
                  >
                    <Ionicons name="remove" size={16} color={colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={[styles.settingValue, { color: colors.textPrimary }]}>{workDuration} dk</Text>
                  <TouchableOpacity
                    style={styles.settingButton}
                    onPress={() => setWorkDuration(Math.min(120, workDuration + 5))}
                  >
                    <Ionicons name="add" size={16} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Mola Süresi:</Text>
                <View style={styles.settingButtons}>
                  <TouchableOpacity
                    style={styles.settingButton}
                    onPress={() => setBreakDuration(Math.max(1, breakDuration - 1))}
                  >
                    <Ionicons name="remove" size={16} color={colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={[styles.settingValue, { color: colors.textPrimary }]}>{breakDuration} dk</Text>
                  <TouchableOpacity
                    style={styles.settingButton}
                    onPress={() => setBreakDuration(Math.min(30, breakDuration + 1))}
                  >
                    <Ionicons name="add" size={16} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: colors.primary }]}
                onPress={() => setShowSettingsModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: '#FFF' }]}>
                  Tamam
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.shareModalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Çalışma Özeti
            </Text>
            <ViewShot
              ref={viewShotRef}
              options={{ format: 'png', quality: 0.9 }}
              style={styles.shareViewShot}
            >
              <View style={[styles.shareSummary, { backgroundColor: colors.surface }]}>
                <Text style={[styles.shareTitle, { color: colors.textPrimary }]}>
                  Verimly Çalışma Özeti
                </Text>
                <View style={styles.shareStatsContainer}>
                  <View style={styles.shareStatItem}>
                    <Text style={[styles.shareStatValue, { color: colors.primary }]}>
                      {formatDuration(getTotalWorkTime())}
                    </Text>
                    <Text style={[styles.shareStatLabel, { color: colors.textSecondary }]}>
                      Çalışma Süresi
                    </Text>
                  </View>
                  <View style={styles.shareStatItem}>
                    <Text style={[styles.shareStatValue, { color: colors.secondary }]}>
                      {formatDuration(getTotalBreakTime())}
                    </Text>
                    <Text style={[styles.shareStatLabel, { color: colors.textSecondary }]}>
                      Mola Süresi
                    </Text>
                  </View>
                  <View style={styles.shareStatItem}>
                    <Text style={[styles.shareStatValue, { color: colors.textPrimary }]}>
                      {getBreakCount()}
                    </Text>
                    <Text style={[styles.shareStatLabel, { color: colors.textSecondary }]}>
                      Mola Sayısı
                    </Text>
                  </View>
                </View>
                <View style={styles.shareSessionsList}>
                  {completedSessions.filter(s => s.type === 'work').map((session) => (
                    <View key={session.id} style={styles.shareSessionItem}>
                      <View style={styles.shareSessionInfo}>
                        <Text style={[styles.shareSessionName, { color: colors.textPrimary }]}>
                          {session.name}
                        </Text>
                        {session.totalPauseSeconds > 0 && (
                          <Text style={[styles.shareSessionPause, { color: colors.textSecondary }]}>
                            ⏸️ Duraklatma: {formatDuration(session.totalPauseSeconds)}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.shareSessionDuration, { color: colors.textSecondary }]}>
                        {formatDuration(session.totalSeconds || session.duration * 60)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </ViewShot>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { borderColor: colors.border }]}
                onPress={() => setShowShareModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>
                  İptal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: colors.primary }]}
                onPress={shareSummary}
              >
                <Ionicons name="share-social" size={18} color="#FFF" />
                <Text style={[styles.modalButtonText, { color: '#FFF', marginLeft: 8 }]}>
                  Paylaş
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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

      {/* Giriş/Kayıt Modal */}
      <Modal
        visible={showAuthModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAuthModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAuthModal(false)}
        >
          <TouchableOpacity 
            style={[styles.authModalContent, { backgroundColor: colors.surface }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.authModalHeader}>
              <Text style={[styles.authModalTitle, { color: colors.textPrimary }]}>
                Hesabınıza Giriş Yapın
              </Text>
              <TouchableOpacity 
                onPress={() => setShowAuthModal(false)}
                style={styles.authModalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.authModalSubtitle, { color: colors.textSecondary }]}>
              Uygulamayı kullanmaya devam etmek için hesabınıza giriş yapın veya yeni hesap oluşturun.
            </Text>

            <View style={styles.authModalButtons}>
              <TouchableOpacity
                style={[styles.authModalButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowAuthModal(false);
                  navigation.getParent()?.navigate('Login');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="log-in-outline" size={24} color={colors.surface} />
                <Text style={[styles.authModalButtonText, { color: colors.surface }]}>
                  Giriş Yap
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.authModalButton, styles.authModalButtonSecondary, { borderColor: colors.primary }]}
                onPress={() => {
                  setShowAuthModal(false);
                  navigation.getParent()?.navigate('Register');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="person-add-outline" size={24} color={colors.primary} />
                <Text style={[styles.authModalButtonText, styles.authModalButtonTextSecondary, { color: colors.primary }]}>
                  Kayıt Ol
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const createStyles = (colors) => StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: SIZES.padding,
    paddingTop: SIZES.padding * 1.5,
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: SIZES.h2,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginTop: 4,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 160,
  },
  registerText: {
    fontSize: SIZES.small,
    fontWeight: '600',
    color: colors.surface,
  },
  profileImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 24,
  },
  defaultProfileContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.margin,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: SIZES.h4,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  timeText: {
    fontSize: SIZES.small,
    fontWeight: '600',
    color: colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: SIZES.tiny,
    color: colors.textSecondary,
    marginTop: 4,
  },
  pomodoroContainer: {
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.margin,
  },
  pomodoroCard: {
    overflow: 'hidden',
    borderRadius: SIZES.radius * 1.5,
    ...SHADOWS.medium,
  },
  pomodoroGradient: {
    padding: SIZES.padding * 1.5,
    borderRadius: SIZES.radius * 1.5,
  },
  pomodoroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pomodoroTitle: {
    fontSize: SIZES.h4,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    flex: 1,
  },
  settingsIconButtonPlaceholder: {
    width: 26,
    height: 26,
  },
  settingsIconButton: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motivationQuote: {
    fontSize: SIZES.tiny,
    color: '#FFF',
    opacity: 0.8,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 12,
    fontWeight: '400',
  },
  timerDisplay: {
    alignItems: 'center',
    marginVertical: 24,
  },
  timerText: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 2,
  },
  timerSubtext: {
    fontSize: SIZES.small,
    color: '#FFF',
    opacity: 0.9,
    marginTop: 8,
  },
  timerControls: {
    alignItems: 'center',
    marginVertical: 16,
  },
  timerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: SIZES.radius,
    gap: 8,
  },
  startButton: {
    minWidth: 120,
    borderRadius: 25,
    overflow: 'hidden',
    ...SHADOWS.medium,
    elevation: 8,
  },
  startButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  startButtonText: {
    fontSize: SIZES.body,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  pauseButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  resumeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  stopButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginLeft: 12,
  },
  timerButtonText: {
    fontSize: SIZES.body,
    fontWeight: '700',
    color: colors.primary,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingsContent: {
    paddingVertical: 16,
  },
  timerSettings: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: '#FFF',
  },
  settingButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: SIZES.radius,
  },
  settingButton: {
    padding: 4,
  },
  settingValue: {
    fontSize: SIZES.body,
    fontWeight: '700',
    color: '#FFF',
    minWidth: 50,
    textAlign: 'center',
  },
  sessionStats: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsTitle: {
    fontSize: SIZES.h4,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: SIZES.radius,
    gap: 6,
  },
  clearButtonText: {
    fontSize: SIZES.small,
    fontWeight: '600',
    color: '#FFF',
  },
  sessionStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 12,
    borderRadius: SIZES.radius,
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: SIZES.tiny,
    color: '#FFF',
    opacity: 0.9,
    marginTop: 4,
    textAlign: 'center',
  },
  completedSessionsList: {
    maxHeight: 150,
    marginTop: 12,
  },
  sessionItem: {
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: SIZES.radius,
    overflow: 'hidden',
  },
  sessionItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sessionNameContainer: {
    flex: 1,
  },
  sessionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionName: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: '#FFF',
  },
  editIcon: {
    opacity: 0.7,
  },
  sessionPause: {
    fontSize: SIZES.tiny,
    color: '#FFF',
    opacity: 0.7,
    marginTop: 2,
  },
  sessionDurationContainer: {
    alignItems: 'flex-end',
  },
  sessionDuration: {
    fontSize: SIZES.small,
    fontWeight: '600',
    color: '#FFF',
    opacity: 0.9,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: SIZES.radius,
    marginTop: 16,
    gap: 8,
  },
  shareButtonText: {
    fontSize: SIZES.body,
    fontWeight: '700',
    color: '#FFF',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: SIZES.radius * 2,
    padding: SIZES.padding * 1.5,
    ...SHADOWS.large,
  },
  modalTitle: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: SIZES.padding,
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    fontSize: SIZES.body,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  modalButton: {
    flex: 1,
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minWidth: 100,
  },
  modalButtonCancel: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  modalButtonSecondary: {
    // backgroundColor set dynamically
  },
  modalButtonConfirm: {
    // backgroundColor set dynamically
  },
  modalButtonText: {
    fontSize: SIZES.body,
    fontWeight: '600',
  },
  shareModalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: SIZES.radius * 2,
    padding: SIZES.padding * 1.5,
    ...SHADOWS.large,
  },
  shareViewShot: {
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    marginVertical: 16,
  },
  shareSummary: {
    padding: SIZES.padding * 1.5,
    borderRadius: SIZES.radius,
  },
  shareTitle: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  shareStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  shareStatItem: {
    alignItems: 'center',
  },
  shareStatValue: {
    fontSize: SIZES.h2,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  shareStatLabel: {
    fontSize: SIZES.small,
  },
  shareSessionsList: {
    marginTop: 12,
  },
  shareSessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  shareSessionInfo: {
    flex: 1,
  },
  shareSessionName: {
    fontSize: SIZES.body,
    fontWeight: '600',
  },
  shareSessionPause: {
    fontSize: SIZES.tiny,
    marginTop: 2,
  },
  shareSessionDuration: {
    fontSize: SIZES.body,
  },
  sectionTitle: {
    fontSize: SIZES.h4,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  recentSection: {
    paddingHorizontal: SIZES.padding,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAll: {
    fontSize: SIZES.small,
    color: colors.primary,
    fontWeight: '600',
  },
  logCard: {
    marginBottom: 12,
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
    gap: 12,
    flex: 1,
  },
  logInfo: {
    flex: 1,
  },
  subjectIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logSubject: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  logDate: {
    fontSize: SIZES.tiny,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  durationText: {
    fontSize: SIZES.tiny,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  logStats: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  logStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logStatText: {
    fontSize: SIZES.tiny,
    color: colors.textSecondary,
  },
  netText: {
    fontSize: SIZES.tiny,
    fontWeight: '600',
    color: colors.primary,
  },
  studyTypeIndicator: {
    backgroundColor: colors.primaryLight + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  studyTypeText: {
    fontSize: SIZES.tiny,
    color: colors.primary,
    fontWeight: '600',
  },
  // Minimal Ödül Kazan Kartı
  minimalActionCard: {
    flex: 1,
    padding: SIZES.padding * 0.6,
    marginHorizontal: SIZES.padding * 0.5,
    marginVertical: SIZES.padding * 0.5,
    backgroundColor: colors.surface,
    borderRadius: SIZES.radius * 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    position: 'relative',
    ...SHADOWS.small,
  },
  horizontalContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topRightCounter: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  counterText: {
    fontSize: SIZES.tiny,
    color: colors.primary,
    fontWeight: '700',
  },
  minimalActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimalActionText: {
    fontSize: SIZES.caption,
    fontWeight: '600',
    color: colors.text,
  },
  minimalDescription: {
    fontSize: SIZES.tiny,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
    paddingHorizontal: 4,
    lineHeight: 14,
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
  bannerAd: {
    marginHorizontal: SIZES.padding,
    marginVertical: SIZES.padding / 2,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
  },
  quickActionsBanner: {
    marginHorizontal: SIZES.padding,
    marginVertical: SIZES.padding,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    height: 60,
  },
  // Auth Modal Styles
  authModalContent: {
    width: '85%',
    maxWidth: 400,
    borderRadius: SIZES.radius * 2,
    padding: SIZES.padding * 1.5,
    ...SHADOWS.large,
  },
  authModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.padding,
  },
  authModalTitle: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    flex: 1,
  },
  authModalCloseButton: {
    padding: 4,
  },
  authModalSubtitle: {
    fontSize: SIZES.body,
    lineHeight: 22,
    marginBottom: SIZES.padding * 1.5,
    textAlign: 'center',
  },
  authModalButtons: {
    gap: 12,
  },
  authModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding * 1.5,
    borderRadius: SIZES.radius,
    gap: 8,
  },
  authModalButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  authModalButtonText: {
    fontSize: SIZES.body,
    fontWeight: '600',
  },
  authModalButtonTextSecondary: {
    // color will be set dynamically
  },
});

