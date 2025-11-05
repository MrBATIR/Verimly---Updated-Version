import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  Alert,
  TouchableOpacity,
  Animated
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Container, Input, Button, Select, AdBanner, InterstitialAd } from '../components';
import { COLORS, DARK_COLORS, SIZES } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';

export default function AddLogScreen({ navigation, route }) {
  const editStudyId = route?.params?.studyId; // Düzenleme için ID
  const editMode = !!editStudyId; // Düzenleme modu mu?
  
  // Animasyon değerleri
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scrollViewRef = useRef(null);
  
  // Demo mod kontrolü - route params'tan isDemo'yu al
  const isDemo = route?.params?.isDemo || false;
  
  // Tema context'ini kullan
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);
  
  const [subject, setSubject] = useState('');
  const [studyType, setStudyType] = useState('test'); // test, topic, video, lecture, reading, other
  const [topic, setTopic] = useState(''); // Konu başlığı
  const [duration, setDuration] = useState('');
  const [correct, setCorrect] = useState('');
  const [wrong, setWrong] = useState('');
  const [empty, setEmpty] = useState('');
  const [focusLevel, setFocusLevel] = useState('5');
  const [notes, setNotes] = useState('');
  const [studyDate, setStudyDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [previousSubjects, setPreviousSubjects] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Interstitial reklam hook'u
  const { showAd: showInterstitialAd, isLoaded: isInterstitialLoaded } = InterstitialAd();
  
  // Toast notification state'leri
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastAnim = useState(new Animated.Value(0))[0];

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

  // Sayfa açılınca animasyon başlat ve scroll'u en üste getir
  useEffect(() => {
    // Scroll'u en üste getir
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    
    // Animasyonları başlat
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Kullanıcı durumunu kontrol et
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Ekran her açıldığında kontrol et - Yeni ekleme ise formu temizle
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Scroll'u en üste getir
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      
      const currentEditId = route?.params?.studyId;
      
      if (!currentEditId) {
        // Yeni ekleme modu - formu temizle
        clearForm();
      } else if (currentEditId !== editStudyId) {
        // Farklı bir çalışma düzenleniyor - veriyi yükle
        loadStudyData();
      }
    });

    return unsubscribe;
  }, [navigation, route?.params?.studyId]);

  // Düzenleme modunda veriyi yükle
  useEffect(() => {
    if (editMode && editStudyId) {
      loadStudyData();
    } else if (!editMode) {
      clearForm();
    }
  }, [editMode, editStudyId]);

  const clearForm = () => {
    setSubject('');
    setStudyType('test');
    setTopic('');
    setDuration('');
    setCorrect('');
    setWrong('');
    setEmpty('');
    setFocusLevel('5');
    setNotes('');
    setStudyDate(new Date());
    setErrors({});
    setShowSuggestions(false);
  };

  const checkAuthStatus = async () => {
    try {
      // Demo mod kontrolü - route params'tan isDemo'yu al
      const routeIsDemo = route?.params?.isDemo || false;
      
      // Eğer demo moddaysa, auth kontrolü yapma
      if (routeIsDemo) {
        setPreviousSubjects(['Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Türkçe']);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        fetchPreviousSubjects();
      } else {
        setPreviousSubjects(['Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Türkçe']);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setPreviousSubjects(['Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Türkçe']);
    }
  };

  const loadStudyData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('study_logs')
        .select('*')
        .eq('id', editStudyId)
        .single();

      if (error) throw error;

      if (data) {
        setSubject(data.subject || '');
        setStudyType(data.study_type || 'test');
        setTopic(data.topic || '');
        setDuration(data.duration?.toString() || '');
        setCorrect(data.correct_answers?.toString() || '');
        setWrong(data.wrong_answers?.toString() || '');
        setEmpty(data.empty_answers?.toString() || '');
        setFocusLevel(data.focus_level?.toString() || '5');
        setNotes(data.notes || '');
        setStudyDate(new Date(data.study_date));
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      Alert.alert('Hata', 'Çalışma verisi yüklenirken bir hata oluştu.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Daha önce eklenen dersleri yükle
  useEffect(() => {
    if (!isDemo) {
      fetchPreviousSubjects();
    } else {
      // Demo mod için örnek dersler
      setPreviousSubjects(['Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Türkçe']);
    }
  }, [isDemo]);

  const fetchPreviousSubjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Kullanıcının daha önce eklediği benzersiz ders adlarını çek
      const { data, error } = await supabase
        .from('study_logs')
        .select('subject')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Benzersiz ders adlarını al ve sırala
      const uniqueSubjects = [...new Set(data.map(log => log.subject))];
      setPreviousSubjects(uniqueSubjects);
    } catch (error) {
      console.error('Dersler yüklenirken hata:', error);
    }
  };

  // Çalışma türleri
  const studyTypes = [
    { label: '📝 Test/Soru Çözümü', value: 'test' },
    { label: '📖 Konu Çalışması', value: 'topic' },
    { label: '🎥 Video İzleme', value: 'video' },
    { label: '👨‍🏫 Ders Dinleme', value: 'lecture' },
    { label: '📚 Kitap Okuma', value: 'reading' },
    { label: '✏️ Diğer', value: 'other' },
  ];

  // Odaklanma seviyeleri - açıklamalı
  const focusLevels = [
    { label: '1 - Çok Dağınık', value: '1' },
    { label: '2 - Dağınık', value: '2' },
    { label: '3 - Oldukça Dağınık', value: '3' },
    { label: '4 - Az Dağınık', value: '4' },
    { label: '5 - Orta', value: '5' },
    { label: '6 - İyi', value: '6' },
    { label: '7 - Çok İyi', value: '7' },
    { label: '8 - Mükemmel', value: '8' },
    { label: '9 - Harika', value: '9' },
    { label: '10 - Zirve Konsantrasyon', value: '10' },
  ];

  // Ders adını Title Case formatına çevir
  const toTitleCase = (str) => {
    if (!str || str.trim() === '') return str;
    
    return str
      .toLowerCase()
      .trim()
      .split(' ')
      .filter(word => word.length > 0) // Boş kelimeleri filtrele
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleSubjectChange = (text) => {
    // Kullanıcı yazarken olduğu gibi kabul et
    // Formatlamayı kaydetme anında yapacağız
    setSubject(text);
    setErrors({ ...errors, subject: '' });
    
    // Önerileri göster
    if (text.length > 0) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectSubject = (selectedSubject) => {
    setSubject(selectedSubject);
    setShowSuggestions(false);
    setErrors({ ...errors, subject: '' });
  };

  // Filtrelenmiş öneriler - yazılan metne göre
  const filteredSuggestions = previousSubjects.filter(subj => 
    subj.toLowerCase().includes(subject.toLowerCase()) && subj.toLowerCase() !== subject.toLowerCase()
  );

  const validateForm = () => {
    const newErrors = {};
    
    // Ders adı kontrolü (zorunlu)
    if (!subject || subject.trim() === '') {
      newErrors.subject = 'Ders adı zorunludur';
    }

    // Çalışma türü kontrolü (zorunlu)
    if (!studyType) {
      newErrors.studyType = 'Çalışma türü seçiniz';
    }

    // Konu başlığı kontrolü (zorunlu)
    if (!topic || topic.trim() === '') {
      newErrors.topic = 'Konu başlığı zorunludur';
    }

    // Süre kontrolü (zorunlu ve pozitif olmalı)
    if (!duration || duration.trim() === '') {
      newErrors.duration = 'Süre giriniz';
    } else if (parseInt(duration) <= 0) {
      newErrors.duration = 'Geçerli bir süre giriniz (0\'dan büyük olmalı)';
    }

    // Odaklanma seviyesi kontrolü (zorunlu)
    if (!focusLevel || focusLevel.trim() === '') {
      newErrors.focusLevel = 'Odaklanma seviyesi seçiniz';
    } else {
      const level = parseInt(focusLevel);
      if (level < 1 || level > 10) {
        newErrors.focusLevel = 'Odaklanma seviyesi 1-10 arası olmalıdır';
      }
    }

    // Tarih kontrolü (zorunlu)
    if (!studyDate) {
      newErrors.studyDate = 'Çalışma tarihi seçiniz';
    }
    
    // Test türündeyse soru istatistikleri kontrol et
    if (studyType === 'test') {
      const correctNum = correct ? parseInt(correct) : 0;
      const wrongNum = wrong ? parseInt(wrong) : 0;
      const emptyNum = empty ? parseInt(empty) : 0;

      // Negatif değer kontrolü
      if (correct && correctNum < 0) {
        newErrors.correct = 'Negatif değer girilemez';
      }
      if (wrong && wrongNum < 0) {
        newErrors.wrong = 'Negatif değer girilemez';
      }
      if (empty && emptyNum < 0) {
        newErrors.empty = 'Negatif değer girilemez';
      }

      // Test türündeyse en az bir soru istatistiği girilmeli
      if (correctNum === 0 && wrongNum === 0 && emptyNum === 0) {
        newErrors.correct = 'Test çözdüyseniz en az bir soru istatistiği giriniz';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (isDemo) {
      Alert.alert(
        'Demo Modu',
        'Demo modda veri kaydedilmez. Kayıt olmak için giriş ekranına dönün!',
        [
          { text: 'Tamam' },
          { 
            text: 'Kayıt Ol', 
            onPress: () => navigation.getParent()?.navigate('Login')
          }
        ]
      );
      return;
    }

    if (!validateForm()) return;

    // Önce interstitial reklam göster
    if (isInterstitialLoaded) {
      showInterstitialAd();
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı.');
        return;
      }

      // Ders adını formatla - her kelimenin ilk harfi büyük
      const formattedSubject = toTitleCase(subject.trim());
      const formattedTopic = topic ? toTitleCase(topic.trim()) : null;

      const logData = {
        user_id: user.id,
        subject: formattedSubject, // Formatlanmış ders adı
        study_type: studyType, // Çalışma türü
        topic: formattedTopic, // Konu başlığı
        duration: parseInt(duration),
        correct_answers: studyType === 'test' ? (correct ? parseInt(correct) : 0) : null,
        wrong_answers: studyType === 'test' ? (wrong ? parseInt(wrong) : 0) : null,
        empty_answers: studyType === 'test' ? (empty ? parseInt(empty) : 0) : null,
        focus_level: parseInt(focusLevel),
        notes: notes ? notes.trim() : null,
        study_date: studyDate.toISOString(),
      };

      let error;
      
      if (editMode) {
        // Güncelleme
        const updateResult = await supabase
          .from('study_logs')
          .update(logData)
          .eq('id', editStudyId);
        error = updateResult.error;
      } else {
        // Ekleme
        const insertResult = await supabase
          .from('study_logs')
          .insert([logData]);
        error = insertResult.error;
      }

      if (error) throw error;

      // Ders listesini güncelle - yeni eklenen ders önerilere dahil olsun (formatlanmış haliyle)
      if (!editMode && !previousSubjects.includes(formattedSubject)) {
        setPreviousSubjects([formattedSubject, ...previousSubjects]);
      }

      showToastNotification(
        editMode ? '✅ Çalışma kaydın başarıyla güncellendi!' : '✅ Çalışma kaydın başarıyla eklendi!'
      );
      
      // 2 saniye sonra geri dön
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
      
    } catch (error) {
      console.error('Kayıt hatası:', error);
      Alert.alert('Hata', 'Çalışma kaydı eklenirken bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Container>
      <Animated.View 
        style={[
          styles.animatedContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView 
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
          <View style={styles.header}>
            <Text style={styles.title}>
              {editMode ? 'Çalışmayı Düzenle ✏️' : 'Yeni Çalışma Ekle 📚'}
            </Text>
            <Text style={styles.subtitle}>
              {editMode ? 'Çalışma bilgilerini güncelle' : 'Bugünkü çalışmanı kaydet'}
            </Text>
          </View>

          {isDemo && (
            <View style={styles.demoWarning}>
              <Ionicons name="information-circle" size={20} color={colors.warning} />
              <Text style={styles.demoWarningText}>
                Demo moddasınız. Veriler kaydedilmeyecek.
              </Text>
            </View>
          )}

          <View style={styles.form}>
            {/* Ders Adı - Serbest yazılabilir */}
            <View style={styles.subjectContainer}>
              <Input
                label="Ders Adı"
                value={subject}
                onChangeText={handleSubjectChange}
                onFocus={() => subject.length > 0 && setShowSuggestions(true)}
                placeholder="Örn: matematik, türk dili ve edebiyatı..."
                error={errors.subject}
              />
              
              {/* Daha önce kullanılan dersler - Öneri Listesi */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.suggestionsTitle}>Daha önce eklediğiniz dersler:</Text>
                  <ScrollView style={styles.suggestionsList} nestedScrollEnabled>
                    {filteredSuggestions.map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => handleSelectSubject(suggestion)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="book-outline" size={18} color={colors.primary} />
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                        <Ionicons name="arrow-forward" size={16} color={colors.textLight} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              
              {/* Eğer hiç ders eklenmemişse veya yazı yoksa, popüler öneriler göster */}
              {showSuggestions && filteredSuggestions.length === 0 && previousSubjects.length > 0 && subject.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.suggestionsTitle}>Daha önce eklediğiniz tüm dersler:</Text>
                  <ScrollView style={styles.suggestionsList} nestedScrollEnabled>
                    {previousSubjects.slice(0, 5).map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => handleSelectSubject(suggestion)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="book-outline" size={18} color={colors.primary} />
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                        <Ionicons name="arrow-forward" size={16} color={colors.textLight} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Ders Adı ile Çalışma Türü Arası Banner Reklam */}
            <AdBanner 
              style={styles.addLogBanner}
            />

            {/* Çalışma Türü */}
            <Select
              label="Çalışma Türü"
              value={studyType}
              onValueChange={(value) => {
                setStudyType(value);
                setErrors({ ...errors, studyType: '' });
              }}
              options={studyTypes}
              placeholder="Seçiniz"
              error={errors.studyType}
            />

            {/* Konu Başlığı */}
            <Input
              label="Konu Başlığı"
              value={topic}
              onChangeText={(text) => {
                setTopic(text);
                setErrors({ ...errors, topic: '' });
              }}
              placeholder="Örn: Türev ve İntegral, Newton Kanunları..."
              error={errors.topic}
            />

            {/* Tarih */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Çalışma Tarihi</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <Text style={styles.dateButtonText}>
                  {studyDate.toLocaleDateString('tr-TR', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={studyDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (date) setStudyDate(date);
                }}
                maximumDate={new Date()}
              />
            )}

            {/* Süre */}
            <Input
              label="Çalışma Süresi (dakika)"
              value={duration}
              onChangeText={(text) => {
                setDuration(text.replace(/[^0-9]/g, ''));
                setErrors({ ...errors, duration: '' });
              }}
              placeholder="Örn: 45"
              keyboardType="numeric"
              error={errors.duration}
            />

            {/* Soru İstatistikleri - Sadece test türündeyken */}
            {studyType === 'test' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Soru İstatistikleri (Opsiyonel)</Text>
              
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <Input
                    label="Doğru"
                    value={correct}
                    onChangeText={(text) => {
                      setCorrect(text.replace(/[^0-9]/g, ''));
                      setErrors({ ...errors, correct: '' });
                    }}
                    placeholder="0"
                    keyboardType="numeric"
                    error={errors.correct}
                  />
                </View>
                
                <View style={styles.rowItem}>
                  <Input
                    label="Yanlış"
                    value={wrong}
                    onChangeText={(text) => {
                      setWrong(text.replace(/[^0-9]/g, ''));
                      setErrors({ ...errors, wrong: '' });
                    }}
                    placeholder="0"
                    keyboardType="numeric"
                    error={errors.wrong}
                  />
                </View>

                <View style={styles.rowItem}>
                  <Input
                    label="Boş"
                    value={empty}
                    onChangeText={(text) => {
                      setEmpty(text.replace(/[^0-9]/g, ''));
                      setErrors({ ...errors, empty: '' });
                    }}
                    placeholder="0"
                    keyboardType="numeric"
                    error={errors.empty}
                  />
                </View>
              </View>

              {/* Net Hesaplama */}
              {(correct || wrong) && (
                <View style={styles.netInfo}>
                  <Text style={styles.netLabel}>Net: </Text>
                  <Text style={styles.netValue}>
                    {(
                      parseInt(correct || 0) - 
                      parseInt(wrong || 0) / 4
                    ).toFixed(2)}
                  </Text>
                </View>
              )}
              </View>
            )}

            {/* Odaklanma Seviyesi */}
            <Select
              label="Odaklanma Seviyesi"
              value={focusLevel}
              onValueChange={(value) => {
                setFocusLevel(value);
                setErrors({ ...errors, focusLevel: '' });
              }}
              options={studyType === 'test' ? focusLevels : focusLevels}
              placeholder="Seçiniz"
              error={errors.focusLevel}
            />

            {/* Notlar */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notlar (Opsiyonel)</Text>
              <View style={styles.textAreaContainer}>
                <Input
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Çalışma hakkında notlarınız..."
                  multiline
                  numberOfLines={4}
                  style={styles.textArea}
                />
              </View>
            </View>

            {/* Kaydet/Güncelle Butonu */}
            <Button
              title={isDemo ? 'Demo Moddasınız' : editMode ? 'Güncelle' : 'Kaydet'}
              onPress={handleSubmit}
              loading={loading}
              style={styles.submitButton}
            />

            <Button
              title="İptal"
              onPress={() => navigation.goBack()}
              variant="ghost"
            />
      </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </Animated.View>
    </Container>

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
  </>
  );
}

const createStyles = (colors) => StyleSheet.create({
  animatedContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: SIZES.padding,
  },
  header: {
    marginBottom: 24,
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
  subjectContainer: {
    marginBottom: 16,
    zIndex: 10,
  },
  suggestionsContainer: {
    backgroundColor: colors.surface,
    borderRadius: SIZES.radius,
    marginTop: -8,
    paddingTop: 12,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    maxHeight: 200,
  },
  suggestionsTitle: {
    fontSize: SIZES.tiny,
    color: colors.textSecondary,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  suggestionsList: {
    maxHeight: 160,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  suggestionText: {
    flex: 1,
    fontSize: SIZES.body,
    color: colors.textPrimary,
  },
  demoWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    padding: 12,
    borderRadius: SIZES.radius,
    marginBottom: 16,
    gap: 8,
  },
  demoWarningText: {
    flex: 1,
    fontSize: SIZES.small,
    color: colors.warning,
    fontWeight: '600',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: SIZES.small,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  dateButtonText: {
    fontSize: SIZES.body,
    color: colors.textPrimary,
    flex: 1,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  rowItem: {
    flex: 1,
  },
  netInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '10',
    padding: 12,
    borderRadius: SIZES.radius,
  },
  netLabel: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
  },
  netValue: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: colors.primary,
  },
  textAreaContainer: {
    minHeight: 100,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginTop: 8,
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
  addLogBanner: {
    marginHorizontal: SIZES.padding,
    marginVertical: SIZES.padding,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    height: 60,
  },
});

