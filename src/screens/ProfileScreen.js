import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Linking, Modal, TextInput, Clipboard, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import { Container, Button, Input, Card } from '../components';
import { COLORS, DARK_COLORS, SIZES, SHADOWS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { getUnreadMessageCount } from '../lib/messageApi';
import * as teacherApi from '../lib/teacherApi';

export default function ProfileScreen({ route, navigation }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [userType, setUserType] = useState('student');
  const [teacherCode, setTeacherCode] = useState('');
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showGuideDetailModal, setShowGuideDetailModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [currentGuideTitle, setCurrentGuideTitle] = useState('');
  const [currentGuideContent, setCurrentGuideContent] = useState('');
  
  // Öğretmen kodu ile ilgili state'ler (sadece öğrenciler için)
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [connectedTeachers, setConnectedTeachers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  
  // Öğretmen için öğrenci listesi state'leri
  const [connectedStudents, setConnectedStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  // Ayarlar state'leri
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastAnim = useState(new Animated.Value(0))[0];
  const isDemo = route?.params?.isDemo || false;
  
  // Mesaj sayısı state'i
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  
  // Premium durumu state'leri
  const [isPremium, setIsPremium] = useState(false);
  const [isInstitutionPremium, setIsInstitutionPremium] = useState(false);
  const [isIndividualUser, setIsIndividualUser] = useState(false); // Varsayılan false, yüklendikten sonra güncellenecek
  const [isIndividualUserLoaded, setIsIndividualUserLoaded] = useState(false); // İlk yükleme tamamlandı mı?
  const [institutionName, setInstitutionName] = useState('');
  const [premiumEndDate, setPremiumEndDate] = useState(null);
  const [autoRenewal, setAutoRenewal] = useState(true);
  
  // Öğrenci bilgilerini düzenleme state'leri
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [editStudentForm, setEditStudentForm] = useState({
    name: '',
    school: '',
    grade: '',
    phone: ''
  });
  const [savingStudentInfo, setSavingStudentInfo] = useState(false);
  
  // Öğretmen detay modal state'leri
  const [showTeacherDetailModal, setShowTeacherDetailModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherDetail, setTeacherDetail] = useState(null);
  const [loadingTeacherDetail, setLoadingTeacherDetail] = useState(false);
  
  // Öğretmen bilgilerini düzenleme state'leri
  const [showEditTeacherModal, setShowEditTeacherModal] = useState(false);
  const [editTeacherForm, setEditTeacherForm] = useState({
    branch: '',
    phone: ''
  });
  const [savingTeacherInfo, setSavingTeacherInfo] = useState(false);
  
  // Şifre değiştirme state'leri
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Tema context'ini kullan
  const { isDark, themeMode, toggleTheme } = useTheme();
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


  // Kullanıcı profilini yükle
  const loadUserProfile = async (showLoading = false) => {
    if (showLoading && !user) {
      setLoading(true);
    }
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      // Session kontrolü - eğer kullanıcı yoksa veya hata varsa login'e yönlendir
      if (authError || !authUser) {
        console.log('Kullanıcı oturumu geçersiz, login ekranına yönlendiriliyor');
        if (showLoading) {
          setLoading(false);
        }
        // Session'ı temizle
        await supabase.auth.signOut();
        // Login ekranına yönlendir
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          })
        );
        return;
      }
      
      if (authUser) {
        // Profiles tablosundan detaylı bilgileri çek
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

          // User_profiles tablosundan user_type bilgisini çek
          const { data: userProfile, error: userProfileError } = await supabase
            .from('user_profiles')
            .select('user_type')
            .eq('user_id', authUser.id)
            .single();

          // Eğer user_profiles'de kayıt yoksa ve kullanıcı veritabanından silinmişse
          // Kullanıcıyı login ekranına yönlendir
          if (userProfileError) {
            if (userProfileError.code === 'PGRST116' || userProfileError.message?.includes('0 rows')) {
              console.log('Kullanıcı veritabanında bulunamadı, login ekranına yönlendiriliyor');
              if (showLoading) {
                setLoading(false);
              }
              await supabase.auth.signOut();
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                })
              );
              return;
            }
            // Diğer hatalar için devam et (kullanıcı bilgisi yoksa varsayılan değerler kullanılacak)
          }

        // Öğretmenler için teachers tablosundan branş bilgisini çek
        let teacherInfo = null;
        if (userProfile && userProfile.user_type === 'teacher') {
          const { data: teacherData, error: teacherError } = await supabase
            .from('teachers')
            .select('name, branch, phone, institution_id')
            .eq('user_id', authUser.id)
            .maybeSingle(); // single() yerine maybeSingle() kullan - kayıt yoksa hata vermez
          
          if (teacherError && teacherError.code !== 'PGRST116') {
            // PGRST116 hatası kayıt bulunamadı demektir, bu normal olabilir
            console.error('Öğretmen bilgisi yüklenirken hata:', teacherError);
          }
          
          teacherInfo = teacherData || {};
          
          // user_profiles tablosundan tam ad bilgisini çek (eğer varsa ve daha tam ise)
          const { data: userProfileData, error: userProfileDataError } = await supabase
            .from('user_profiles')
            .select('name')
            .eq('user_id', authUser.id)
            .maybeSingle();
          
          // Eğer user_profiles'da name varsa ve teachers.name'den daha uzunsa (tam ad içeriyorsa), onu kullan
          if (!userProfileDataError && userProfileData?.name) {
            const teacherName = teacherData?.name || '';
            const profileName = userProfileData.name || '';
            
            // Eğer profile name daha uzunsa veya teacher name boşsa, profile name'i kullan
            if (profileName.length > teacherName.length || !teacherName) {
              teacherInfo.name = profileName;
            } else if (teacherName) {
              teacherInfo.name = teacherName;
            }
          } else if (teacherData?.name) {
            teacherInfo.name = teacherData.name;
          } else if (userProfileData?.name) {
            teacherInfo.name = userProfileData.name;
          }
          
          // Öğretmenin kurum bilgisini yükle (önce teachers tablosundan)
          if (teacherData?.institution_id) {
            const { data: institutionData } = await supabase
              .from('institutions')
              .select('name')
              .eq('id', teacherData.institution_id)
              .single();
            
            if (institutionData) {
              teacherInfo.school = institutionData.name;
            }
          } else {
            // Fallback: institution_memberships tablosundan yükle
            const { data: institutionMembership } = await supabase
              .from('institution_memberships')
              .select(`
                institutions (
                  name
                )
              `)
              .eq('user_id', authUser.id)
              .eq('role', 'teacher')
              .single();
            
            if (institutionMembership?.institutions) {
              teacherInfo.school = institutionMembership.institutions.name;
            }
          }
        }

        // Öğrenciler için students tablosundan okul, sınıf, telefon bilgisini çek
        let studentInfo = null;
        if (userProfile?.user_type === 'student') {
          const { data: studentData, error: studentError } = await supabase
            .from('students')
            .select('name, school, grade, phone, parent_name, parent_phone, address, notes, institution_id')
            .eq('user_id', authUser.id)
            .maybeSingle();
          
          if (studentError) {
            console.error('Öğrenci bilgileri yükleme hatası:', studentError);
          } else if (studentData) {
            studentInfo = studentData;
            
            // Öğrenci için kurum bilgisini kontrol et
            if (studentData.institution_id) {
              const { data: institutionData } = await supabase
                .from('institutions')
                .select('name')
                .eq('id', studentData.institution_id)
                .single();
              
              if (institutionData) {
                if (institutionData.name === 'Bireysel Kullanıcılar') {
                  setIsIndividualUser(true);
                } else {
                  setIsIndividualUser(false);
                }
                setInstitutionName(institutionData.name);
                setIsIndividualUserLoaded(true);
              }
            } else {
              // institution_memberships üzerinden kontrol et
              const { data: membership } = await supabase
                .from('institution_memberships')
                .select(`
                  institutions (
                    name
                  )
                `)
                .eq('user_id', authUser.id)
                .eq('role', 'student')
                .maybeSingle();
              
              if (membership?.institutions) {
                if (membership.institutions.name === 'Bireysel Kullanıcılar') {
                  setIsIndividualUser(true);
                } else {
                  setIsIndividualUser(false);
                }
                setInstitutionName(membership.institutions.name);
                setIsIndividualUserLoaded(true);
              } else {
                // Hiç kurum bilgisi yoksa, institution_memberships'ten tüm kayıtları kontrol et
                const { data: allMemberships } = await supabase
                  .from('institution_memberships')
                  .select(`
                    institutions (
                      name
                    )
                  `)
                  .eq('user_id', authUser.id);
                
                if (allMemberships && allMemberships.length > 0) {
                  const hasOnlyIndividual = allMemberships.every(m => 
                    m.institutions && m.institutions.name === 'Bireysel Kullanıcılar'
                  );
                  setIsIndividualUser(hasOnlyIndividual);
                  if (hasOnlyIndividual && allMemberships[0]?.institutions) {
                    setInstitutionName(allMemberships[0].institutions.name);
                  }
                } else {
                  setIsIndividualUser(false);
                }
                setIsIndividualUserLoaded(true);
              }
            }
          } else {
            // studentData yoksa da institution_memberships'ten kontrol et
            const { data: allMemberships } = await supabase
              .from('institution_memberships')
              .select(`
                institutions (
                  name
                )
              `)
              .eq('user_id', authUser.id);
            
            if (allMemberships && allMemberships.length > 0) {
              const hasOnlyIndividual = allMemberships.every(m => 
                m.institutions && m.institutions.name === 'Bireysel Kullanıcılar'
              );
              setIsIndividualUser(hasOnlyIndividual);
              if (hasOnlyIndividual && allMemberships[0]?.institutions) {
                setInstitutionName(allMemberships[0].institutions.name);
              } else if (allMemberships[0]?.institutions) {
                setIsIndividualUser(false);
                setInstitutionName(allMemberships[0].institutions.name);
              }
            } else {
              setIsIndividualUser(false);
            }
            setIsIndividualUserLoaded(true);
          }
        }
        
        // Öğrenci değilse de yükleme işaretini koy
        if (userProfile?.user_type !== 'student') {
          setIsIndividualUserLoaded(true);
        }

          setUser({ 
            ...authUser, 
            profile: {
              ...profile,
              ...teacherInfo,
              ...studentInfo
            }
          });
          setUserType(userProfile?.user_type || 'student');
          
          // Kurum adını yükle
          if (teacherInfo?.school) {
            setInstitutionName(teacherInfo.school);
          } else if (studentInfo?.school) {
            setInstitutionName(studentInfo.school);
          }
        setIsPremium(false);
        
        // Kullanıcı bilgisi geldiyse loading'i kapat
        if (showLoading) {
          setLoading(false);
        }
      } else {
        // Kullanıcı yoksa login'e yönlendir
        console.log('Kullanıcı bulunamadı, login ekranına yönlendiriliyor');
        if (showLoading) {
          setLoading(false);
        }
        await supabase.auth.signOut();
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          })
        );
      }
    } catch (error) {
      console.error('Profil yükleme hatası:', error);
      if (showLoading) {
        setLoading(false);
      }
      // Hata durumunda da session'ı temizle ve login'e yönlendir
      try {
        await supabase.auth.signOut();
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          })
        );
      } catch (signOutError) {
        console.error('Sign out hatası:', signOutError);
      }
    }
  };

  useEffect(() => {
    if (!isDemo) {
      loadUserProfile(true); // İlk yüklemede loading göster
      // Sadece öğrenciler için bağlı öğretmenleri yükle
      if (userType === 'student') {
        loadConnectedTeachers();
        loadUnreadMessageCount();
      }
      if (userType === 'teacher') {
        loadTeacherCode();
        loadConnectedStudents();
      }
    }
    loadSelectedAvatar();
  }, [isDemo, userType]);

  // Ekran her odaklandığında bağlı öğretmenleri yenile
  useFocusEffect(
    React.useCallback(() => {
      if (!isDemo) {
        // Öğrenciler için bireysel kullanıcı kontrolünü ve bağlı öğretmenleri yenile
        if (userType === 'student') {
          loadUserProfile(false); // Arka planda yükle, loading gösterme
          loadConnectedTeachers();
          loadUnreadMessageCount();
        }
        loadPremiumStatus();
      }
    }, [isDemo, userType])
  );

  // Real-time güncelleme için interval ekle
  useEffect(() => {
    if (isDemo) return;

    // Her 5 saniyede bir bağlı öğretmenleri kontrol et (sadece öğrenciler için)
    const interval = setInterval(() => {
      if (userType === 'student') {
        loadConnectedTeachers();
        loadUnreadMessageCount();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isDemo, userType]);

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
    }
  };

  // Hayvan avatar seçenekleri
  const animalAvatars = [
    '🐱', '🐶', '🐰', '🐻', '🐼', '🐨', '🦊', '🐸', '🐯', '🦁',
    '🐮', '🐷', '🐭', '🐹', '🐨', '🐵', '🐔', '🐧', '🐦', '🦆',
    '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜'
  ];

  const saveSelectedAvatar = async (avatar) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Önce AsyncStorage'a kaydet (hızlı erişim için)
      const userAvatarKey = `selectedAvatar_${user.id}`;
      await AsyncStorage.setItem(userAvatarKey, avatar);
      setSelectedAvatar(avatar);
      setShowAvatarModal(false);

      // Sonra veritabanına kaydet (cihazlar arası senkronizasyon için)
      
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          selected_avatar: avatar,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select();

      // Avatar'ı study_logs tablosuna da kaydet (öğretmen erişimi için)
      if (!error && data) {
        // Bu sadece bilgi amaçlı - gerçek avatar verisi user_profiles'de
        // Öğretmen modülünde avatar görünmesi için alternatif çözüm
      }

      if (error) {
        Alert.alert('Hata', 'Avatar kaydedilirken bir hata oluştu.');
        return;
      }
      
    } catch (error) {
      Alert.alert('Hata', 'Avatar kaydedilirken bir hata oluştu.');
    }
  };

  const getUserProfile = async () => {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      // Session kontrolü - eğer kullanıcı yoksa veya hata varsa login'e yönlendir
      if (authError || !authUser) {
        console.log('Kullanıcı oturumu geçersiz, login ekranına yönlendiriliyor');
        // Session'ı temizle
        await supabase.auth.signOut();
        // Login ekranına yönlendir
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          })
        );
        return;
      }
      
      if (authUser) {
        // Profiles tablosundan detaylı bilgileri çek
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        // User_profiles tablosundan user_type bilgisini çek
        const { data: userProfile, error: userProfileError } = await supabase
          .from('user_profiles')
          .select('user_type')
          .eq('user_id', authUser.id)
          .single();

        if (userProfileError) {
          // Eğer user_profiles'de kayıt yoksa ve kullanıcı veritabanından silinmişse
          // Kullanıcıyı login ekranına yönlendir
          if (userProfileError.code === 'PGRST116' || userProfileError.message?.includes('0 rows')) {
            console.log('Kullanıcı veritabanında bulunamadı, login ekranına yönlendiriliyor');
            await supabase.auth.signOut();
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              })
            );
            return;
          }
          
          // Eğer sadece user_profiles'de kayıt yoksa, varsayılan olarak student olarak ekle
          const { error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              user_id: authUser.id,
              user_type: 'student',
              selected_avatar: 'student',
              name: authUser.email?.split('@')[0] || 'Kullanıcı',
              email: authUser.email
            });
          
          if (insertError) {
            // Ekleme hatası varsa da login'e yönlendir
            console.log('User profile oluşturulamadı, login ekranına yönlendiriliyor');
            await supabase.auth.signOut();
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              })
            );
            return;
          }
          
          setUser(authUser);
        } else {
          // Öğretmenler için teachers tablosundan branş bilgisini çek
          let teacherInfo = null;
        if (userProfile?.user_type === 'teacher') {
          console.log('Öğretmen bilgileri yükleniyor...');
          const { data: teacherData, error: teacherError } = await supabase
            .from('teachers')
            .select('branch, phone, institution_id')
            .eq('user_id', authUser.id)
            .maybeSingle(); // single() yerine maybeSingle() kullan - kayıt yoksa hata vermez
          
          if (teacherError && teacherError.code !== 'PGRST116') {
            // PGRST116 hatası kayıt bulunamadı demektir, bu normal olabilir
            console.error('Öğretmen bilgisi yüklenirken hata:', teacherError);
          }
          
          console.log('Teachers tablosu sorgusu sonucu:', teacherData, 'Error:', teacherError);
            teacherInfo = teacherData;
            
            // Öğretmenin kurum bilgisini yükle (önce teachers tablosundan)
            console.log('Öğretmen bilgileri:', teacherData);
            if (teacherData?.institution_id) {
              console.log('Teachers tablosundan institution_id bulundu:', teacherData.institution_id);
              const { data: institutionData } = await supabase
                .from('institutions')
                .select('name')
                .eq('id', teacherData.institution_id)
                .single();
              
              console.log('Kurum bilgisi:', institutionData);
              if (institutionData) {
                teacherInfo.school = institutionData.name;
              }
              } else {
                // Fallback: institution_memberships tablosundan yükle
                const { data: institutionMembership } = await supabase
                  .from('institution_memberships')
                  .select(`
                    institutions (
                      name
                    )
                  `)
                  .eq('user_id', authUser.id)
                  .eq('role', 'teacher')
                  .single();
                
                if (institutionMembership?.institutions) {
                  teacherInfo.school = institutionMembership.institutions.name;
                }
              }
          }

          // Öğrenciler için students tablosundan okul, sınıf, telefon bilgisini çek
          let studentInfo = null;
          if (userProfile?.user_type === 'student') {
            const { data: studentData } = await supabase
              .from('students')
              .select('school, grade, phone')
              .eq('email', authUser.email)
              .single();
            studentInfo = studentData;
          }

          // Auth user ile profile bilgilerini birleştir, user_type ekle
          const userWithType = { 
            ...authUser, 
            profile: {
              ...profile,
              ...(teacherInfo && {
                branch: teacherInfo.branch,
                phone: teacherInfo.phone
              }),
              ...(studentInfo && {
                school: studentInfo.school,
                grade: studentInfo.grade,
                phone: studentInfo.phone
              })
            },
            user_type: userProfile?.user_type || 'student' // Varsayılan olarak student
          };
          setUser(userWithType);
          setUserType(userProfile?.user_type || 'student');
        }
      } else {
        // Kullanıcı yoksa login'e yönlendir
        console.log('Kullanıcı bulunamadı, login ekranına yönlendiriliyor');
        await supabase.auth.signOut();
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          })
        );
      }
    } catch (error) {
      console.error('getUserProfile hatası:', error);
      // Hata durumunda da session'ı temizle ve login'e yönlendir
      try {
        await supabase.auth.signOut();
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          })
        );
      } catch (signOutError) {
        console.error('Sign out hatası:', signOutError);
      }
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(true);
  };

  const loadPremiumStatus = async () => {
    try {
      if (isDemo) return;
      
      // AdSystem kaldırıldı - varsayılan değerler
      setIsPremium(false);
      setPremiumEndDate(null);
      setAutoRenewal(false);
      setIsIndividualUser(false);
      
      // Kurum premium kontrolü
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: institutionData, error: institutionError } = await supabase
          .rpc('check_institution_access', { p_user_id: user.id });

        if (!institutionError && institutionData) {
          setIsInstitutionPremium(true);
          
          // Kurum adını almak için institutions tablosundan sorgula
          try {
            // Önce institution_memberships üzerinden kontrol et
            const { data: membership } = await supabase
              .from('institution_memberships')
              .select('institution_id, role')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .maybeSingle();
            
            if (membership?.institution_id) {
              const { data: institutionInfo } = await supabase
                .from('institutions')
                .select('name')
                .eq('id', membership.institution_id)
                .single();
              
              if (institutionInfo) {
                setInstitutionName(institutionInfo.name);
                if (institutionInfo.name === 'Bireysel Kullanıcılar') {
                  setIsIndividualUser(true);
                } else {
                  setIsIndividualUser(false);
                }
              } else {
                setInstitutionName('Kurumunuz');
                setIsIndividualUser(false);
              }
            } else {
              // Fallback: students veya teachers tablosundan institution_id kontrol et
              const { data: studentData } = await supabase
                .from('students')
                .select('institution_id')
                .eq('user_id', user.id)
                .maybeSingle();
              
              if (studentData?.institution_id) {
                const { data: institutionInfo } = await supabase
                  .from('institutions')
                  .select('name')
                  .eq('id', studentData.institution_id)
                  .single();
                
                if (institutionInfo) {
                  setInstitutionName(institutionInfo.name);
                  if (institutionInfo.name === 'Bireysel Kullanıcılar') {
                    setIsIndividualUser(true);
                  } else {
                    setIsIndividualUser(false);
                  }
                } else {
                  setInstitutionName('Kurumunuz');
                  setIsIndividualUser(false);
                }
              } else {
                setInstitutionName('Kurumunuz');
                setIsIndividualUser(false);
              }
            }
          } catch (error) {
            setInstitutionName('Kurumunuz');
            setIsIndividualUser(false);
          }
        } else {
          setIsInstitutionPremium(false);
          setIsIndividualUser(false);
        }
      }
      
      // Kurum premium değilse user.profile.school'dan kurum adını al
      if (user?.profile?.school) {
        setInstitutionName(user.profile.school);
      }
    } catch (error) {
      console.error('Premium durumu yüklenirken hata:', error);
      setIsPremium(false);
      setIsInstitutionPremium(false);
      setPremiumEndDate(null);
    }
  };


  // Öğrenci bilgilerini düzenleme fonksiyonları
  const openEditStudentModal = () => {
    // Ad soyad bilgisini al - önce profile'dan, sonra user_metadata'dan
    const currentName = user?.profile?.name || 
                       (user?.profile?.first_name && user?.profile?.last_name 
                         ? `${user.profile.first_name} ${user.profile.last_name}`.trim()
                         : '') ||
                       (user?.user_metadata?.first_name && user?.user_metadata?.last_name
                         ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`.trim()
                         : '');
    
    setEditStudentForm({
      name: currentName,
      school: user?.profile?.school || '',
      grade: user?.profile?.grade || '',
      phone: user?.profile?.phone || ''
    });
    setShowEditStudentModal(true);
  };

  // Öğretmen bilgilerini düzenleme fonksiyonları
  const openEditTeacherModal = () => {
    setEditTeacherForm({
      branch: user?.profile?.branch || '',
      phone: user?.profile?.phone || ''
    });
    setShowEditTeacherModal(true);
  };

  const saveStudentInfo = async () => {
    if (!user?.id) {
      Alert.alert('Hata', 'Kullanıcı bilgisi bulunamadı');
      return;
    }

    // Ad soyad validasyonu
    if (!editStudentForm.name || editStudentForm.name.trim().length === 0) {
      Alert.alert('Hata', 'Ad soyad boş olamaz');
      return;
    }

    // Telefon numarası validasyonu
    if (editStudentForm.phone) {
      if (!editStudentForm.phone.startsWith('0')) {
        Alert.alert('Hata', 'Telefon numarası 0 ile başlamalıdır');
        return;
      }
      if (editStudentForm.phone.length !== 11) {
        Alert.alert('Hata', 'Telefon numarası 11 haneli olmalıdır');
        return;
      }
    }

    setSavingStudentInfo(true);
    try {
      const trimmedName = editStudentForm.name.trim();
      console.log('Öğrenci bilgileri güncelleniyor:', {
        user_id: user.id,
        name: trimmedName,
        school: editStudentForm.school,
        grade: editStudentForm.grade,
        phone: editStudentForm.phone
      });
      
      // Önce mevcut kaydı kontrol et
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      let result;
      if (existingStudent) {
        // Kayıt varsa güncelle
        console.log('Mevcut öğrenci kaydı güncelleniyor');
        result = await supabase
          .from('students')
          .update({
            name: trimmedName,
            school: editStudentForm.school,
            grade: editStudentForm.grade,
            phone: editStudentForm.phone
          })
          .eq('user_id', user.id)
          .select();
      } else {
        // Kayıt yoksa oluştur
        console.log('Yeni öğrenci kaydı oluşturuluyor');
        result = await supabase
          .from('students')
          .insert({
            user_id: user.id,
            email: user.email,
            name: trimmedName,
            school: editStudentForm.school,
            grade: editStudentForm.grade,
            phone: editStudentForm.phone
          })
          .select();
      }

      // user_profiles tablosunu da güncelle
      if (result.data && result.data.length > 0) {
        const nameParts = trimmedName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        await supabase
          .from('user_profiles')
          .update({
            name: trimmedName,
            first_name: firstName,
            last_name: lastName
          })
          .eq('user_id', user.id);
      }

      if (result.error) {
        console.error('Öğrenci bilgileri güncelleme hatası:', result.error);
        Alert.alert('Hata', `Bilgiler güncellenemedi: ${result.error.message}`);
        return;
      }
      
      console.log('Öğrenci bilgileri güncellendi:', result.data);

      // Kullanıcı profilini yeniden yükle
      await loadUserProfile();
      
      setShowEditStudentModal(false);
      showToastNotification('Bilgiler başarıyla güncellendi!');
    } catch (error) {
      Alert.alert('Hata', 'Bilgiler güncellenemedi');
    } finally {
      setSavingStudentInfo(false);
    }
  };


  const saveTeacherInfo = async () => {
    if (!user?.id) {
      Alert.alert('Hata', 'Kullanıcı bilgisi bulunamadı');
      return;
    }

    setSavingTeacherInfo(true);
    try {
      const { error } = await supabase
        .from('teachers')
        .update({
          branch: editTeacherForm.branch,
          phone: editTeacherForm.phone
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Öğretmen bilgileri güncelleme hatası:', error);
        Alert.alert('Hata', `Bilgiler güncellenemedi: ${error.message}`);
        return;
      }

      // Kullanıcı profilini yeniden yükle
      await loadUserProfile();
      
      setShowEditTeacherModal(false);
      showToastNotification('Bilgiler başarıyla güncellendi!');
    } catch (error) {
      Alert.alert('Hata', 'Bilgiler güncellenemedi');
    } finally {
      setSavingTeacherInfo(false);
    }
  };

  // Öğretmen kodu ile ilgili fonksiyonlar
  const loadTeacherCode = async () => {
    if (isDemo || userType !== 'teacher') return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: teacher, error } = await supabase
        .from('teachers')
        .select('teacher_code')
        .eq('user_id', user.id)
        .single();

      if (error) {
        return;
      }

      setTeacherCode(teacher?.teacher_code || '');
    } catch (error) {
    }
  };

  // Öğretmen detaylarını yükle
  const loadTeacherDetail = async (connection) => {
    setSelectedTeacher(connection);
    setLoadingTeacherDetail(true);
    setShowTeacherDetailModal(true);

    try {
      // Debug: connection objesini kontrol et
      
      if (!connection.teachers?.id) {
        Alert.alert('Hata', 'Öğretmen bilgisi bulunamadı');
        setLoadingTeacherDetail(false);
        return;
      }

      // Teachers tablosundan detaylı bilgileri çek
      const { data: teacherData, error } = await supabase
        .from('teachers')
        .select(`
          *,
          schools (name)
        `)
        .eq('id', connection.teachers.id)
        .single();

      if (error) {
        Alert.alert('Hata', 'Öğretmen detayları yüklenemedi');
        return;
      }

      setTeacherDetail(teacherData);
    } catch (error) {
      Alert.alert('Hata', 'Öğretmen detayları yüklenemedi');
    } finally {
      setLoadingTeacherDetail(false);
    }
  };

  const loadConnectedTeachers = async () => {
    if (isDemo) return;
    
    try {
      setLoadingTeachers(true);
      const result = await teacherApi.getStudentTeachers();
      
      if (result.success) {
        // Bağlı öğretmenleri göster (onaylanmış ve aktif olanlar + reddedilen kesme istekleri)
        const approvedTeachers = (result.data || []).filter(connection => 
          (connection.approval_status === 'approved' && connection.is_active) ||
          (connection.approval_status === 'rejected' && connection.is_active) // Reddedilen kesme istekleri
        );
        
        
        
        setConnectedTeachers(approvedTeachers);
        
        // Bekleyen istekleri göster
        const pendingRequests = (result.data || []).filter(connection => 
          connection.approval_status === 'pending'
        );
        setPendingRequests(pendingRequests);
      } else {
      }
    } catch (error) {
    } finally {
      setLoadingTeachers(false);
    }
  };

  const loadConnectedStudents = async () => {
    if (isDemo) return;
    
    try {
      setLoadingStudents(true);
      const result = await teacherApi.getStudents();
      
      if (result.success) {
        setConnectedStudents(result.data || []);
      } else {
      }
    } catch (error) {
    } finally {
      setLoadingStudents(false);
    }
  };

  const loadUnreadMessageCount = async () => {
    if (isDemo || userType !== 'student') return;
    
    try {
      // Kullanıcı oturumu kontrolü
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.log('loadUnreadMessageCount - Kullanıcı oturumu bulunamadı');
        return;
      }

      const result = await getUnreadMessageCount();
      if (result.success) {
        setUnreadMessageCount(result.count);
      }
    } catch (error) {
      console.error('Okunmamış mesaj sayısı alma hatası:', error);
    }
  };


  const handleTeacherCodeSubmit = async () => {
    if (!teacherCode.trim()) {
      Alert.alert('Hata', 'Lütfen öğretmen kodunu girin.');
      return;
    }

    try {
      // Öğretmen kodunu doğrula
      const teacherResult = await teacherApi.getTeacherByCode(teacherCode.trim());
      
      if (!teacherResult.success) {
        Alert.alert('Hata', teacherResult.error);
        return;
      }

      // Öğretmene bağlan
      const connectResult = await teacherApi.connectToTeacher(teacherResult.data.id);
      
      if (connectResult.success) {
        const teacher = teacherResult.data;
        Alert.alert(
          'Başarılı! 🎉', 
          `Öğretmen bağlantı isteği gönderildi!\n\n` +
          `👨‍🏫 Öğretmen: ${teacher.name}\n` +
          `📚 Branş: ${teacher.branch}\n` +
          `📧 E-posta: ${teacher.email}\n\n` +
          `İsteğiniz öğretmen tarafından onaylandıktan sonra bağlantı aktif olacak.`
        );
        setTeacherCode('');
        setShowTeacherModal(false);
        loadConnectedTeachers(); // Bağlı öğretmenleri yeniden yükle
      } else {
        Alert.alert('Hata', connectResult.error);
      }
    } catch (error) {
      Alert.alert('Hata', 'Bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  const handleDisconnectTeacher = async (connectionId, teacherName) => {
    Alert.alert(
      'Bağlantı Kesme İsteği',
      `${teacherName} öğretmeni ile bağlantınızı kesmek için öğretmeninizin onayı gerekiyor. Kesme isteği gönderilsin mi?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'İstek Gönder',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await teacherApi.requestDisconnection(connectionId);
              
              if (result.success) {
                Alert.alert(
                  'İstek Gönderildi! 📤', 
                  `${teacherName} öğretmenine bağlantı kesme isteği gönderildi. Öğretmeniniz onayladıktan sonra bağlantı kesilecek.`
                );
                loadConnectedTeachers(); // Bağlı öğretmenleri yeniden yükle
              } else {
                Alert.alert('Hata', result.error);
              }
            } catch (error) {
              Alert.alert('Hata', 'Bir hata oluştu. Lütfen tekrar deneyin.');
            }
          }
        }
      ]
    );
  };

  const handleCancelPendingRequest = async (connectionId, teacherName) => {
    Alert.alert(
      'İsteği Geri Çek',
      `${teacherName} öğretmenine gönderilen isteği geri çekmek istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Geri Çek',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await teacherApi.cancelPendingRequest(connectionId);
              
              if (result.success) {
                Alert.alert('Başarılı', result.message);
                // Listeyi hemen yenile
                await loadConnectedTeachers();
              } else {
                Alert.alert('Hata', result.error);
              }
            } catch (error) {
              Alert.alert('Hata', 'Bir hata oluştu.');
            }
          },
        },
      ]
    );
  };

  // Şifre değiştirme fonksiyonu
  const handleChangePassword = async () => {
    // Validasyon
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      Alert.alert('Hata', 'Tüm alanları doldurun');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert('Hata', 'Yeni şifreler eşleşmiyor');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      Alert.alert('Hata', 'Yeni şifre en az 6 karakter olmalıdır');
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      Alert.alert('Hata', 'Yeni şifre mevcut şifre ile aynı olamaz');
      return;
    }

    setChangingPassword(true);
    try {
      // Mevcut kullanıcı bilgilerini al
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        throw new Error('Kullanıcı oturumu bulunamadı');
      }

      // Mevcut şifreyi doğrula - kullanıcıyı yeniden authenticate et
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.currentPassword
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          throw new Error('Mevcut şifre yanlış');
        }
        throw new Error('Mevcut şifre doğrulanamadı: ' + signInError.message);
      }

      // Şifreyi güncelle
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (updateError) {
        throw new Error('Şifre güncellenemedi: ' + updateError.message);
      }

      Alert.alert('Başarılı', 'Şifreniz başarıyla güncellendi');
      setShowChangePasswordModal(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      Alert.alert('Hata', error.message || 'Şifre değiştirilemedi');
    } finally {
      setChangingPassword(false);
    }
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
            setLoading(true);
            try {
              const { error } = await supabase.auth.signOut();
              if (error) throw error;
              
              // Login ekranına yönlendir
              navigation.navigate('Login');
            } catch (error) {
              Alert.alert('Hata', 'Çıkış yapılırken bir hata oluştu.');
            } finally {
              setLoading(false);
            }
  };

  const handleSettings = () => {
    setShowSettingsModal(true);
  };

  const handleNotificationToggle = async () => {
    if (!notificationsEnabled) {
      // Bildirim izni iste
      Alert.alert(
        'Bildirim İzni',
        'Verimly size çalışma hatırlatıcıları gönderebilsin mi?',
        [
          {
            text: 'İzin Verme',
            style: 'cancel',
            onPress: () => setNotificationsEnabled(false),
          },
          {
            text: 'İzin Ver',
            onPress: () => {
              // Burada gerçek bildirim izni istenebilir
              setNotificationsEnabled(true);
              Alert.alert('Başarılı', 'Bildirim izni verildi!');
          },
        },
      ]
    );
    } else {
      setNotificationsEnabled(false);
    }
  };

  const handleThemeChange = () => {
    setShowThemeModal(true);
  };

  const selectTheme = async (theme) => {
    setShowThemeModal(false);
    await toggleTheme(theme);
  };

  const selectAvatar = () => {
    setShowAvatarModal(true);
  };


  const handleHelpSupport = () => {
    setShowHelpModal(true);
  };

  const handleAppIssues = () => {
    Alert.alert(
      'Uygulama Sorunları',
      'Sorununuzu bildirmek için aşağıdaki seçeneklerden birini kullanın:',
      [
        {
          text: 'E-posta Gönder',
          onPress: () => {
            const subject = 'Verimly - Uygulama Sorunu';
            const body = 'Merhaba,\nUygulama ile ilgili yaşadığım sorun:\n[Buraya sorununuzu detaylı bir şekilde yazın]\nTeşekkürler.';
            const emailUrl = `mailto:osman.batir@hotmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            Linking.openURL(emailUrl).catch(() => {
              Alert.alert('Hata', 'E-posta uygulaması açılamadı.');
            });
          },
        },
        {
          text: 'İptal',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleSendSuggestion = () => {
    const subject = 'Verimly - Öneri';
    const body = 'Merhaba,\nUygulama için önerim:\n[Buraya önerinizi detaylı bir şekilde yazın]\nTeşekkürler.';
    const emailUrl = `mailto:osman.batir@hotmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    Linking.openURL(emailUrl).catch(() => {
      Alert.alert('Hata', 'E-posta uygulaması açılamadı.');
    });
  };

  const handleUserGuide = () => {
    setShowGuideModal(true);
  };

  const showGuide = (title, content) => {
    Alert.alert(title, content, [{ text: 'Tamam' }]);
  };

  const handleContactInfo = () => {
    setShowContactModal(true);
  };

  if (isDemo) {
    return (
      <Container>
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person-circle" size={80} color={colors.textLight} />
            </View>
            <Text style={styles.name}>Demo Kullanıcı</Text>
            <Text style={styles.email}>Hesabın yok</Text>
          </View>

          <View style={styles.demoInfo}>
            <Ionicons name="information-circle" size={48} color={colors.primary} />
            <Text style={styles.demoTitle}>Demo Modundasın</Text>
            <Text style={styles.demoText}>
              Tüm özellikleri deneyebilirsin. Verilerini kaydetmek için hesap oluştur!
            </Text>
          </View>

          <View style={styles.demoActions}>
            <Button
              title="Hesap Oluştur"
              onPress={() => navigation.getParent()?.navigate('Register')}
              icon={<Ionicons name="person-add-outline" size={20} color={colors.surface} />}
              style={styles.registerDemoButton}
            />

            <Button
              title="Giriş Yap"
              onPress={() => navigation.getParent()?.navigate('Login')}
              variant="outline"
              icon={<Ionicons name="log-in-outline" size={20} color={colors.primary} />}
              style={styles.loginDemoButton}
            />
          </View>

          <View style={styles.features}>
            <Text style={styles.featuresTitle}>Demo Modda Neler Yapabilirsin?</Text>
            
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text style={styles.featureText}>Çalışma ekleyebilirsin (kayıt olmaz)</Text>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text style={styles.featureText}>Raporları görüntüleyebilirsin</Text>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text style={styles.featureText}>Arayüzü keşfedebilirsin</Text>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="close-circle" size={24} color={colors.error} />
              <Text style={styles.featureText}>Veriler kayıt edilmez</Text>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="close-circle" size={24} color={colors.error} />
              <Text style={styles.featureText}>İlerleme takip edilmez</Text>
            </View>
          </View>
        </ScrollView>
      </Container>
    );
  }

  // Yükleme durumunda loading ekranı göster
  if (loading && !user) {
    return (
      <Container>
        <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textPrimary }]}>Profil yükleniyor...</Text>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.profileCard}>
          <View style={styles.profileContent}>
            <TouchableOpacity style={styles.avatarContainer} onPress={selectAvatar}>
              {selectedAvatar && selectedAvatar !== 'teacher' && selectedAvatar !== 'student' ? (
                <View style={styles.avatarDisplay}>
                  <Text style={styles.avatarEmoji}>{selectedAvatar}</Text>
                </View>
              ) : (
                <Ionicons name="person-circle" size={60} color={colors.primary} />
              )}
              <View style={styles.editIcon}>
                <Ionicons name="pencil" size={16} color={colors.surface} />
              </View>
              {/* Mesaj sayısı badge'i - sadece öğrenciler için */}
              {user?.user_type === 'student' && unreadMessageCount > 0 && (
                <View style={styles.messageBadge}>
                  <Text style={styles.messageBadgeText}>
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            
            <View style={styles.profileDetails}>
              <Text style={styles.name}>
                {user?.profile?.name || user?.profile?.first_name || user?.user_metadata?.first_name || 'Kullanıcı'}
              </Text>
              <Text style={styles.email}>{user?.email || user?.profile?.email}</Text>
              
              {/* Bireysel kullanıcı göstergesi */}
              {isIndividualUserLoaded && isIndividualUser && (
                <View style={styles.individualBadge}>
                  <Text style={styles.individualBadgeText}>Bireysel Kullanıcı</Text>
                </View>
              )}
            </View>
          </View>
        </Card>

        <View style={styles.infoSection}>

          {/* Öğretmenler için branş ve telefon bilgisi */}
          {user?.user_type === 'teacher' ? (
            <>
              <View style={styles.infoCard}>
                <Ionicons name="library-outline" size={24} color={colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Branş</Text>
                  <Text style={styles.infoValue}>
                    {user?.profile?.branch || user?.user_metadata?.branch || 'Belirtilmemiş'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="call-outline" size={24} color={colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Telefon</Text>
                  <Text style={styles.infoValue}>
                    {user?.profile?.phone || user?.user_metadata?.phone || 'Belirtilmemiş'}
                  </Text>
                </View>
              </View>

              {/* Düzenleme Butonu */}
              <TouchableOpacity 
                style={styles.editButton}
                onPress={openEditTeacherModal}
              >
                <Ionicons name="create-outline" size={20} color={colors.primary} />
                <Text style={styles.editButtonText}>Bilgileri Düzenle</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
                {/* Öğrenciler için sınıf bilgisi - Sadece öğrenciler için */}
                {userType === 'student' && (
                  <View style={styles.infoCard}>
                    <Ionicons name="book-outline" size={24} color={colors.primary} />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Sınıf</Text>
                      <Text style={styles.infoValue}>
                        {(() => {
                          const grade = user?.profile?.grade || user?.user_metadata?.grade;
                          if (grade === 'graduate') return 'Mezun';
                          return grade || 'Belirtilmemiş';
                        })()}
                      </Text>
                    </View>
                  </View>
                )}

              {/* Telefon bilgisi - Hem öğretmenler hem öğrenciler için */}
              <View style={styles.infoCard}>
                <Ionicons name="call-outline" size={24} color={colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Telefon</Text>
                  <Text style={styles.infoValue}>
                    {user?.profile?.phone || user?.user_metadata?.phone || 'Belirtilmemiş'}
                  </Text>
                </View>
                {/* Öğretmenler için düzenleme ikonu */}
                {userType === 'teacher' && (
                  <TouchableOpacity 
                    style={styles.inlineEditButton}
                    onPress={openEditTeacherModal}
                  >
                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Bireysel kullanıcılar için düzenleme butonu */}
              {userType === 'student' && isIndividualUserLoaded && isIndividualUser && (
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={openEditStudentModal}
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                  <Text style={styles.editButtonText}>Bilgileri Düzenle</Text>
                </TouchableOpacity>
              )}
            </>
          )}


          {/* Kurum Premium Bilgi Kartı - Kurum premium kullanıcılar için */}
          {isInstitutionPremium && (
            <Card style={[styles.institutionCard, { 
              backgroundColor: colors.surface,
              borderColor: colors.primary,
              borderWidth: 1,
              ...SHADOWS.medium
            }]}>
              <View style={styles.institutionCardContent}>
                <View style={[styles.institutionIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="school" size={28} color={colors.primary} />
                </View>
                <View style={styles.institutionText}>
                  <Text style={[styles.institutionTitle, { color: colors.textPrimary }]}>
                    {institutionName || 'Kurumunuz'}
                  </Text>
                  <Text style={[styles.institutionSubtitle, { color: colors.textSecondary }]}>
                    Kurum Üyesi
                  </Text>
                </View>
                <View style={[styles.institutionBadge, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="checkmark" size={16} color={colors.primary} />
                </View>
              </View>
            </Card>
          )}

        </View>

          {/* Öğretmen Bağlantı Kodu Bölümü - Sadece öğretmenler için */}
          {userType === 'teacher' && (
          <Card style={styles.teacherCodeSection}>
            <View style={styles.teacherCodeHeader}>
              <View style={styles.teacherCodeHeaderLeft}>
                <View style={styles.teacherCodeIconContainer}>
                  <Ionicons name="key" size={20} color={colors.primary} />
                </View>
                <Text style={styles.teacherCodeSectionTitle}>Bağlantı Kodunuz</Text>
              </View>
            </View>
            
            <View style={styles.teacherCodeContent}>
              <View style={styles.teacherCodeDisplay}>
                <Text style={styles.teacherCodeLabel}>Öğrenciler bu kodu kullanarak size bağlanabilir:</Text>
                <View style={styles.teacherCodeValueContainer}>
                  <Text style={styles.teacherCodeValue}>{teacherCode}</Text>
                  <TouchableOpacity 
                    style={styles.copyButton}
                    onPress={() => {
                      Clipboard.setString(teacherCode);
                      showToastNotification('📋 Bağlantı kodu kopyalandı!');
                    }}
                  >
                    <Ionicons name="copy-outline" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Card>
        )}

        {/* Öğretmen Kodu Bölümü - Sadece öğrenciler için (bireysel kullanıcılar hariç) */}
        {userType === 'student' && isIndividualUserLoaded && !isIndividualUser && (
          <Card style={styles.teacherSection}>
            <View style={styles.teacherHeader}>
              <View style={styles.teacherHeaderLeft}>
                <View style={styles.teacherIconContainer}>
                  <Ionicons name="people" size={20} color={colors.primary} />
                </View>
                <Text style={styles.teacherSectionTitle}>Öğretmen Bağlantıları</Text>
              </View>
              <TouchableOpacity
                style={styles.addTeacherButton}
                onPress={() => setShowTeacherModal(true)}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.addTeacherText}>Ekle</Text>
              </TouchableOpacity>
            </View>
            
            {/* Bekleyen İstekler */}
            {pendingRequests.length > 0 && (
              <View style={styles.pendingSection}>
                <Text style={styles.pendingTitle}>⏳ Onay Bekleyen İstekler</Text>
                {pendingRequests.map((request) => (
                  <View key={request.id} style={styles.pendingCard}>
                    <View style={styles.pendingContent}>
                      <View style={styles.pendingHeader}>
                        <Ionicons name="person-outline" size={16} color={colors.primary} />
                        <Text style={styles.pendingTeacherName}>
                          {request.teachers?.name || 'Öğretmen'}
                        </Text>
                      </View>
                      <View style={styles.pendingDetails}>
                        <Text style={styles.pendingBranch}>
                          {request.teachers?.branch || 'Branş bilgisi yok'}
                        </Text>
                      <Text style={styles.pendingStatus}>
                        {request.request_type === 'connect' ? 'Bağlantı isteği gönderildi' : 'Bağlantı kesme isteği gönderildi'}
                      </Text>
                      </View>
                    </View>
                    <View style={styles.pendingActions}>
                      <TouchableOpacity
                        style={styles.cancelRequestButton}
                        onPress={() => handleCancelPendingRequest(request.id, request.teachers?.name || 'Öğretmen')}
                      >
                        <Ionicons name="close" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Bağlı Öğretmenler (Sadece Öğrenciler için) */}
            {userType === 'student' && connectedTeachers.length > 0 ? (
              <View style={styles.connectedTeachers}>
                {connectedTeachers.map((connection) => (
                  <TouchableOpacity 
                    key={connection.id} 
                    onPress={() => loadTeacherDetail(connection)}
                    style={styles.teacherCardWrapper}
                  >
                    <View style={styles.teacherCard}>
                      <View style={styles.teacherCardLeft}>
                        <View style={styles.teacherAvatar}>
                          <Ionicons name="person" size={16} color={colors.primary} />
                        </View>
                        <View style={styles.teacherInfo}>
                          <Text style={styles.teacherName}>{connection.teachers.name}</Text>
                          <Text style={styles.teacherDetails}>
                            {connection.teachers.branch} • {connection.teachers.schools?.name || 'Okul bilgisi yok'}
                          </Text>
                        </View>
                      </View>
                      {(connection.approval_status === 'approved' || connection.approval_status === 'rejected') && (
                        <TouchableOpacity
                          style={styles.disconnectButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDisconnectTeacher(connection.id, connection.teachers.name);
                          }}
                        >
                          <Ionicons name="close" size={16} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : userType === 'student' && pendingRequests.length === 0 && (
              <View style={styles.noTeachers}>
                <Ionicons name="people-outline" size={20} color={colors.textLight} />
                <Text style={styles.noTeachersText}>Henüz öğretmen bağlantınız yok</Text>
              </View>
            )}

            {/* Bağlı Öğrenciler (Sadece Öğretmenler için) */}
            {userType === 'teacher' && (
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="people" size={20} color={colors.primary} />
                  <Text style={styles.cardTitle}>Bağlı Öğrenciler</Text>
                </View>
                
                {loadingStudents ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingText}>Öğrenciler yükleniyor...</Text>
                  </View>
                ) : connectedStudents.length > 0 ? (
                  <View style={styles.connectedStudents}>
                    {connectedStudents.map((student) => (
                      <View key={student.id} style={styles.studentCard}>
                        <View style={styles.studentCardLeft}>
                          <View style={styles.studentAvatar}>
                            <Ionicons name="person" size={16} color={colors.primary} />
                          </View>
                          <View style={styles.studentInfo}>
                            <Text style={styles.studentName}>{student.name}</Text>
                            <Text style={styles.studentDetails}>{student.email}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.noStudents}>
                    <Ionicons name="people-outline" size={20} color={colors.textLight} />
                    <Text style={styles.noStudentsText}>Henüz öğrenci bağlantınız yok</Text>
                  </View>
                )}
              </Card>
            )}
          </Card>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleSettings}>
            <Ionicons name="settings-outline" size={24} color={colors.textPrimary} />
            <Text style={styles.actionText}>Ayarlar</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleHelpSupport}>
            <Ionicons name="help-circle-outline" size={24} color={colors.textPrimary} />
            <Text style={styles.actionText}>Yardım & Destek</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="information-circle-outline" size={24} color={colors.textPrimary} />
            <Text style={styles.actionText}>Hakkında</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Çıkış Yap Butonu - Modern Tasarım */}
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: colors.error }]}
            onPress={handleLogout}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.surface} />
            <Text style={[styles.logoutButtonText, { color: colors.surface }]}>
              {loading ? 'Çıkış yapılıyor...' : 'Çıkış Yap'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Yardım & Destek Modal */}
      <Modal
        visible={showHelpModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowHelpModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Yardım & Destek</Text>
            <Text style={styles.modalSubtitle}>Size nasıl yardımcı olabiliriz?</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => {
                  setShowHelpModal(false);
                  handleAppIssues();
                }}
              >
                <Ionicons name="bug-outline" size={24} color={colors.primary} />
                <Text style={styles.modalButtonText}>Uygulama Sorunları</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => {
                  setShowHelpModal(false);
                  handleUserGuide();
                }}
              >
                <Ionicons name="book-outline" size={24} color={colors.primary} />
                <Text style={styles.modalButtonText}>Kullanım Rehberi</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => {
                  setShowHelpModal(false);
                  handleSendSuggestion();
                }}
              >
                <Ionicons name="bulb-outline" size={24} color={colors.primary} />
                <Text style={styles.modalButtonText}>Öneri Gönder</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => {
                  setShowHelpModal(false);
                  handleContactInfo();
                }}
              >
                <Ionicons name="call-outline" size={24} color={colors.primary} />
                <Text style={styles.modalButtonText}>İletişim</Text>
              </TouchableOpacity>
            </View>

          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Ayarlar Modal */}
      <Modal
        visible={showSettingsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSettingsModal(false)}
        >
          <TouchableOpacity 
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.settingsHeader}>
              <View style={styles.settingsTitleContainer}>
                <View style={[styles.settingsIconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="settings" size={24} color={colors.primary} />
                </View>
                <View style={styles.settingsTitleText}>
                  <Text style={[styles.settingsMainTitle, { color: colors.textPrimary }]}>Ayarlar</Text>
                  <Text style={[styles.settingsSubTitle, { color: colors.textSecondary }]}>Uygulama ayarlarınızı düzenleyin</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.settingsContainer}>
              {/* Şifre Değiştir */}
              <TouchableOpacity 
                style={[styles.modernSettingItem, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setShowChangePasswordModal(true)}
              >
                <View style={[styles.settingIconWrapper, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="key" size={20} color={colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={[styles.modernSettingTitle, { color: colors.textPrimary }]}>Şifre Değiştir</Text>
                  <Text style={[styles.modernSettingSubtitle, { color: colors.textSecondary }]}>Giriş şifrenizi güncelleyin</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Bildirimler */}
              <View style={[styles.modernSettingItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[styles.settingIconWrapper, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="notifications" size={20} color={colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={[styles.modernSettingTitle, { color: colors.textPrimary }]}>Bildirimler</Text>
                  <Text style={[styles.modernSettingSubtitle, { color: colors.textSecondary }]}>Çalışma hatırlatıcıları ve bildirimler</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.modernToggle, { backgroundColor: notificationsEnabled ? colors.primary : colors.border }]}
                  onPress={handleNotificationToggle}
                >
                  <View style={[styles.modernToggleThumb, { 
                    backgroundColor: colors.surface,
                    transform: [{ translateX: notificationsEnabled ? 20 : 2 }]
                  }]} />
                </TouchableOpacity>
              </View>

              {/* Tema */}
              <TouchableOpacity 
                style={[styles.modernSettingItem, { backgroundColor: colors.background, borderColor: colors.border }]} 
                onPress={handleThemeChange}
              >
                <View style={[styles.settingIconWrapper, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="color-palette" size={20} color={colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={[styles.modernSettingTitle, { color: colors.textPrimary }]}>Tema</Text>
                  <Text style={[styles.modernSettingSubtitle, { color: colors.textSecondary }]}>
                    {themeMode === 'light' && 'Açık Tema'}
                    {themeMode === 'dark' && 'Koyu Tema'}
                    {themeMode === 'system' && 'Sistem Varsayılanı'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Bireysel kullanıcılar için öğretmen bağlantıları */}
              {isIndividualUserLoaded && isIndividualUser && (
                <TouchableOpacity 
                  style={[styles.modernSettingItem, { backgroundColor: colors.background, borderColor: colors.border }]} 
                  onPress={() => {
                    setShowSettingsModal(false);
                    setShowTeacherModal(true);
                  }}
                >
                  <View style={[styles.settingIconWrapper, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="people" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={[styles.modernSettingTitle, { color: colors.textPrimary }]}>Öğretmen Bağlantıları</Text>
                    <Text style={[styles.modernSettingSubtitle, { color: colors.textSecondary }]}>
                      Öğretmeninizle bağlantı kurun ve çalışmalarınızı paylaşın
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Kullanım Rehberi Modal */}
      <Modal
        visible={showGuideModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGuideModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => {
                  setShowGuideModal(false);
                  setShowHelpModal(true);
                }}
              >
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>📚 Kullanım Rehberi</Text>
              <View style={styles.placeholder} />
            </View>
            <Text style={styles.modalSubtitle}>Verimly nasıl kullanılır?</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => {
                  setCurrentGuideTitle('➕ Çalışma Ekleme');
                  setCurrentGuideContent('1. Alt menüden "Ekle" butonuna basın\n2. Ders adını yazın\n3. Çalışma türünü seçin\n4. Konu başlığını girin\n5. Süreyi belirtin\n6. Odaklanma seviyesini seçin\n7. Notlarınızı ekleyin\n8. "Kaydet" butonuna basın');
                  setShowGuideDetailModal(true);
                }}
              >
                <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                <Text style={styles.modalButtonText}>Çalışma Ekleme</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => {
                  setCurrentGuideTitle('📊 Raporları İnceleme');
                  setCurrentGuideContent('1. "Raporlar" sekmesine gidin\n2. Günlük/Haftalık/Aylık görünümü seçin\n3. Tarih değiştirmek için ok butonlarını kullanın\n4. Çalışma detaylarını görmek için üzerine tıklayın\n5. Özel tarih aralığı için "Özel" seçeneğini kullanın');
                  setShowGuideDetailModal(true);
                }}
              >
                <Ionicons name="bar-chart-outline" size={24} color={colors.primary} />
                <Text style={styles.modalButtonText}>Raporları İnceleme</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => {
                  setCurrentGuideTitle('👤 Profil Yönetimi');
                  setCurrentGuideContent('1. "Profil" sekmesine gidin\n2. Kişisel bilgilerinizi görüntüleyin\n3. Çıkış yapmak için "Çıkış Yap" butonunu kullanın');
                  setShowGuideDetailModal(true);
                }}
              >
                <Ionicons name="person-outline" size={24} color={colors.primary} />
                <Text style={styles.modalButtonText}>Profil Yönetimi</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setShowGuideModal(false)}
              >
                <Ionicons name="close-outline" size={24} color={colors.textSecondary} />
                <Text style={styles.modalButtonText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* İletişim Bilgileri Modal */}
      <Modal
        visible={showContactModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowContactModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => {
                  setShowContactModal(false);
                  setShowHelpModal(true);
                }}
              >
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>📞 İletişim Bilgileri</Text>
              <View style={styles.placeholder} />
            </View>
            <Text style={styles.modalSubtitle}>👤 Osman BATIR{'\n'}📧 osman.batir@hotmail.com{'\n'}🕐 09:00-18:00</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => {
                  setShowContactModal(false);
                  const emailUrl = `mailto:osman.batir@hotmail.com?subject=Verimly - Destek`;
                  Linking.openURL(emailUrl);
                }}
              >
                <Ionicons name="mail-outline" size={24} color={colors.primary} />
                <Text style={styles.modalButtonText}>E-posta Gönder</Text>
              </TouchableOpacity>


              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => {
                  setShowContactModal(false);
                  const instagramUrl = `https://instagram.com/osman_batir`;
                  Linking.openURL(instagramUrl).catch(() => {
                    Alert.alert('Hata', 'Instagram açılamadı.');
                  });
                }}
              >
                <Ionicons name="logo-instagram" size={24} color="#E4405F" />
                <Text style={styles.modalButtonText}>Instagram</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.closeButtonContainer}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowContactModal(false)}
              >
                <Ionicons name="close-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.closeButtonText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Kullanım Rehberi Detay Modal */}
      <Modal
        visible={showGuideDetailModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGuideDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => {
                  setShowGuideDetailModal(false);
                  setShowGuideModal(true);
                }}
              >
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{currentGuideTitle}</Text>
              <View style={styles.placeholder} />
            </View>
            <Text style={styles.guideContent}>{currentGuideContent}</Text>
          </View>
        </View>
      </Modal>

      {/* Çıkış Yap Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.logoutModal, { backgroundColor: colors.surface }]}>
            <View style={[styles.logoutHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.logoutTitle, { color: colors.textPrimary }]}>Çıkış Yap</Text>
            </View>
            
            <View style={styles.logoutContent}>
              <Text style={[styles.logoutMessage, { color: colors.textSecondary }]}>
                Çıkış yapmak istediğinizden emin misiniz?
              </Text>
            </View>
            
            <View style={[styles.logoutActions, { borderTopColor: colors.border }]}>
              <TouchableOpacity 
                style={[styles.logoutModalButton, { backgroundColor: colors.background }]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={[styles.logoutModalButtonText, { color: colors.textSecondary }]}>İptal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.logoutModalButton, styles.logoutModalButtonDanger, { backgroundColor: colors.error }]}
                onPress={confirmLogout}
              >
                <Text style={[styles.logoutModalButtonText, styles.logoutModalButtonTextDanger, { color: colors.surface }]}>Çıkış Yap</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Şifre Değiştirme Modal */}
      <Modal
        visible={showChangePasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowChangePasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.passwordModal, { backgroundColor: colors.surface }]}>
            <View style={[styles.passwordHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.passwordTitle, { color: colors.textPrimary }]}>🔐 Şifre Değiştir</Text>
              <TouchableOpacity 
                onPress={() => setShowChangePasswordModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.passwordContent}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Mevcut Şifre</Text>
                <TextInput
                  style={[styles.passwordInput, { 
                    backgroundColor: colors.background, 
                    borderColor: colors.border,
                    color: colors.textPrimary 
                  }]}
                  placeholder="Mevcut şifrenizi girin"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={true}
                  value={passwordForm.currentPassword}
                  onChangeText={(text) => setPasswordForm(prev => ({ ...prev, currentPassword: text }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Yeni Şifre</Text>
                <TextInput
                  style={[styles.passwordInput, { 
                    backgroundColor: colors.background, 
                    borderColor: colors.border,
                    color: colors.textPrimary 
                  }]}
                  placeholder="Yeni şifrenizi girin"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={true}
                  value={passwordForm.newPassword}
                  onChangeText={(text) => setPasswordForm(prev => ({ ...prev, newPassword: text }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Yeni Şifre Tekrar</Text>
                <TextInput
                  style={[styles.passwordInput, { 
                    backgroundColor: colors.background, 
                    borderColor: colors.border,
                    color: colors.textPrimary 
                  }]}
                  placeholder="Yeni şifrenizi tekrar girin"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={true}
                  value={passwordForm.confirmPassword}
                  onChangeText={(text) => setPasswordForm(prev => ({ ...prev, confirmPassword: text }))}
                />
              </View>
            </View>
            
            <View style={[styles.passwordActions, { borderTopColor: colors.border }]}>
              <TouchableOpacity 
                style={[styles.passwordModalButton, { backgroundColor: colors.background }]}
                onPress={() => setShowChangePasswordModal(false)}
              >
                <Text style={[styles.passwordModalButtonText, { color: colors.textSecondary }]}>İptal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.passwordModalButton, styles.passwordModalButtonPrimary, { 
                  backgroundColor: changingPassword ? colors.border : colors.primary 
                }]}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                <Text style={[styles.passwordModalButtonText, styles.passwordModalButtonTextPrimary, { 
                  color: changingPassword ? colors.textSecondary : colors.surface 
                }]}>
                  {changingPassword ? 'Güncelleniyor...' : 'Güncelle'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Avatar Seçimi Modal */}
      <Modal
        visible={showAvatarModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAvatarModal(false)}
        >
          <TouchableOpacity
            style={[styles.avatarModal, { backgroundColor: colors.surface }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.avatarHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.avatarTitle, { color: colors.textPrimary }]}>Avatar Seç</Text>
            </View>
            
            <ScrollView style={styles.avatarGrid} showsVerticalScrollIndicator={false}>
              <View style={styles.avatarRow}>
                {animalAvatars.map((avatar, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.avatarOption,
                      { 
                        borderColor: selectedAvatar === avatar ? colors.primary : colors.border,
                        backgroundColor: selectedAvatar === avatar ? colors.primary + '20' : 'transparent'
                      }
                    ]}
                    onPress={() => saveSelectedAvatar(avatar)}
                  >
                    <Text style={styles.avatarOptionEmoji}>{avatar}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>


      {/* Tema Seçimi Modal */}
      <Modal
        visible={showThemeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowThemeModal(false)}
        >
          <TouchableOpacity 
            style={[styles.themeModal, { backgroundColor: colors.surface }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.themeHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.themeTitle, { color: colors.textPrimary }]}>🎨 Tema Seçimi</Text>
              <Text style={[styles.themeSubtitle, { color: colors.textSecondary }]}>Hangi temayı kullanmak istiyorsunuz?</Text>
            </View>
            
            <View style={styles.themeOptions}>
              {/* Açık Tema */}
              <TouchableOpacity 
                style={[styles.themeOption, { borderBottomColor: colors.border }]}
                onPress={() => selectTheme('light')}
              >
                <View style={styles.themeOptionInfo}>
                  <Ionicons name="sunny-outline" size={24} color={colors.warning} />
                  <View style={styles.themeOptionText}>
                    <Text style={[styles.themeOptionTitle, { color: colors.textPrimary }]}>Açık Tema</Text>
                    <Text style={[styles.themeOptionSubtitle, { color: colors.textSecondary }]}>Her zaman açık tema kullan</Text>
                  </View>
                </View>
                {themeMode === 'light' && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
              </TouchableOpacity>

              {/* Koyu Tema */}
              <TouchableOpacity 
                style={[styles.themeOption, { borderBottomColor: colors.border }]}
                onPress={() => selectTheme('dark')}
              >
                <View style={styles.themeOptionInfo}>
                  <Ionicons name="moon-outline" size={24} color={colors.primary} />
                  <View style={styles.themeOptionText}>
                    <Text style={[styles.themeOptionTitle, { color: colors.textPrimary }]}>Koyu Tema</Text>
                    <Text style={[styles.themeOptionSubtitle, { color: colors.textSecondary }]}>Her zaman koyu tema kullan</Text>
                  </View>
                </View>
                {themeMode === 'dark' && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
              </TouchableOpacity>

            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Öğretmen Kodu Ekleme Modalı */}
      <Modal
        visible={showTeacherModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTeacherModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTeacherModal(false)}
        >
          <TouchableOpacity
            style={[styles.teacherModal, { backgroundColor: colors.surface }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.teacherModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.teacherModalTitle, { color: colors.textPrimary }]}>Öğretmen Kodu Ekle</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowTeacherModal(false)}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.teacherModalContent}>
              <Text style={[styles.teacherModalSubtitle, { color: colors.textSecondary }]}>
                Öğretmeninizden aldığınız kodu girin
              </Text>
              
              <Input
                placeholder="Öğretmen kodu (örn: TCH1234)"
                value={teacherCode}
                onChangeText={setTeacherCode}
                style={styles.teacherCodeInput}
                autoCapitalize="characters"
                maxLength={7}
              />
              
              <View style={styles.teacherModalButtons}>
                <TouchableOpacity
                  style={[styles.teacherModalCancelButton, { backgroundColor: colors.border }]}
                  onPress={() => setShowTeacherModal(false)}
                >
                  <Text style={[styles.teacherModalCancelText, { color: colors.textSecondary }]}>İptal</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.teacherModalSubmitButton, { backgroundColor: colors.primary }]}
                  onPress={handleTeacherCodeSubmit}
                >
                  <Text style={[styles.teacherModalSubmitText, { color: colors.surface }]}>Bağlan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Öğrenci Bilgilerini Düzenleme Modal */}
      <Modal
        visible={showEditStudentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditStudentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bilgileri Düzenle</Text>
              <TouchableOpacity
                onPress={() => setShowEditStudentModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Ad Soyad</Text>
                <Input
                  value={editStudentForm.name}
                  onChangeText={(text) => {
                    setEditStudentForm(prev => ({ ...prev, name: text }));
                  }}
                  placeholder="Adınız Soyadınız"
                  style={styles.formInput}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Telefon</Text>
                <Input
                  value={editStudentForm.phone}
                  onChangeText={(text) => {
                    // Sadece rakam kabul et
                    const numericText = text.replace(/[^0-9]/g, '');
                    setEditStudentForm(prev => ({ ...prev, phone: numericText }));
                  }}
                  placeholder="05426129386"
                  keyboardType="phone-pad"
                  maxLength={11}
                  style={styles.formInput}
                />
                <Text style={[styles.formHelperText, { color: colors.textSecondary }]}>
                  0 ile başlayan 11 haneli telefon numarası girin (örn: 05xxxxxxxxx)
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="İptal"
                onPress={() => setShowEditStudentModal(false)}
                variant="ghost"
                style={styles.cancelButton}
              />
              <Button
                title="Kaydet"
                onPress={saveStudentInfo}
                loading={savingStudentInfo}
                style={styles.saveButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Öğretmen Bilgilerini Düzenleme Modal */}
      <Modal
        visible={showEditTeacherModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditTeacherModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bilgileri Düzenle</Text>
              <TouchableOpacity
                onPress={() => setShowEditTeacherModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Branş</Text>
                <TextInput
                  style={[styles.formInput, styles.textInput]}
                  value={editTeacherForm.branch}
                  onChangeText={(text) => setEditTeacherForm(prev => ({ ...prev, branch: text }))}
                  placeholder="Branş bilgisini girin"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Telefon</Text>
                <TextInput
                  style={[styles.formInput, styles.textInput]}
                  value={editTeacherForm.phone}
                  onChangeText={(text) => setEditTeacherForm(prev => ({ ...prev, phone: text }))}
                  placeholder="Telefon numarasını girin"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="İptal"
                onPress={() => setShowEditTeacherModal(false)}
                variant="ghost"
                style={styles.cancelButton}
              />
              <Button
                title="Kaydet"
                onPress={saveTeacherInfo}
                loading={savingTeacherInfo}
                style={styles.saveButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Öğretmen Detay Modal */}
      <Modal
        visible={showTeacherDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTeacherDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Öğretmen Detayları</Text>
              <TouchableOpacity
                onPress={() => setShowTeacherDetailModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {loadingTeacherDetail ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Yükleniyor...</Text>
                </View>
              ) : teacherDetail ? (
                <>
                  {/* Öğretmen Bilgileri */}
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>👨‍🏫 Öğretmen Bilgileri</Text>
                    
                    <View style={styles.detailCard}>
                      <View style={styles.detailRow}>
                        <Ionicons name="person-outline" size={20} color={colors.primary} />
                        <Text style={styles.detailLabel}>Ad Soyad:</Text>
                        <Text style={styles.detailValue}>{teacherDetail.name || 'Belirtilmemiş'}</Text>
                      </View>
                      
                      <View style={styles.detailRow}>
                        <Ionicons name="mail-outline" size={20} color={colors.primary} />
                        <Text style={styles.detailLabel}>E-posta:</Text>
                        <Text style={styles.detailValue}>{teacherDetail.email || 'Belirtilmemiş'}</Text>
                      </View>
                      
                      <View style={styles.detailRow}>
                        <Ionicons name="library-outline" size={20} color={colors.primary} />
                        <Text style={styles.detailLabel}>Branş:</Text>
                        <Text style={styles.detailValue}>{teacherDetail.branch || 'Belirtilmemiş'}</Text>
                      </View>
                      
                      <View style={styles.detailRow}>
                        <Ionicons name="school-outline" size={20} color={colors.primary} />
                        <Text style={styles.detailLabel}>Okul:</Text>
                        <Text style={styles.detailValue}>{teacherDetail.schools?.name || 'Belirtilmemiş'}</Text>
                      </View>
                      
                      <View style={styles.detailRow}>
                        <Ionicons name="call-outline" size={20} color={colors.primary} />
                        <Text style={styles.detailLabel}>Telefon:</Text>
                        <Text style={styles.detailValue}>{teacherDetail.phone || 'Belirtilmemiş'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Bağlantı Bilgileri */}
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>🔗 Bağlantı Bilgileri</Text>
                    
                    <View style={styles.detailCard}>
                      <View style={styles.detailRow}>
                        <Ionicons name="key-outline" size={20} color={colors.primary} />
                        <Text style={styles.detailLabel}>Öğretmen Kodu:</Text>
                        <Text style={styles.detailValue}>{teacherDetail.teacher_code || 'Belirtilmemiş'}</Text>
                      </View>
                      
                      <View style={styles.detailRow}>
                        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                        <Text style={styles.detailLabel}>Bağlantı Tarihi:</Text>
                        <Text style={styles.detailValue}>
                          {selectedTeacher?.created_at ? 
                            new Date(selectedTeacher.created_at).toLocaleDateString('tr-TR') : 
                            'Belirtilmemiş'
                          }
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Öğretmen detayları yüklenemedi</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setShowTeacherDetailModal(false)}
              >
                <Text style={styles.closeModalButtonText}>Kapat</Text>
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
                  outputRange: [100, 0],
                })
              }]
            }
          ]}
        >
          <View style={styles.toast}>
            <Ionicons name="checkmark-circle" size={20} color={colors.surface} />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </Animated.View>
      )}
    </Container>
  );
}

const createStyles = (colors) => StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: SIZES.body,
    fontWeight: '500',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 100, // Navbar için yeterli boşluk
  },
  header: {
    alignItems: 'center',
    paddingVertical: SIZES.padding * 2,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...SHADOWS.medium,
  },
  avatarContainer: {
    marginBottom: SIZES.padding,
    position: 'relative',
  },
  avatarDisplay: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 40,
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  messageBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.error,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
    paddingHorizontal: 6,
  },
  messageBadgeText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: 'bold',
  },
  name: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  email: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
  },
  infoSection: {
    padding: SIZES.padding,
    gap: 12,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    gap: 16,
    ...SHADOWS.small,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: SIZES.tiny,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  actions: {
    padding: SIZES.padding,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    gap: 12,
    ...SHADOWS.small,
  },
  actionText: {
    flex: 1,
    fontSize: SIZES.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: 'center',
    minWidth: 200,
    gap: 8,
    ...SHADOWS.medium,
  },
  logoutButtonText: {
    fontSize: SIZES.body,
    fontWeight: '600',
    marginLeft: 0,
  },
  demoInfo: {
    alignItems: 'center',
    padding: SIZES.padding * 2,
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
    backgroundColor: colors.primaryLight + '15',
    borderRadius: SIZES.radius,
  },
  demoTitle: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: SIZES.padding,
    marginBottom: 8,
  },
  demoText: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  demoActions: {
    paddingHorizontal: SIZES.padding,
    gap: 12,
    marginBottom: SIZES.padding * 2,
  },
  registerDemoButton: {
    marginBottom: 0,
  },
  loginDemoButton: {
    marginBottom: 0,
  },
  features: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.padding * 2,
  },
  featuresTitle: {
    fontSize: SIZES.h4,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: SIZES.padding,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    backgroundColor: colors.surface,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    ...SHADOWS.small,
  },
  featureText: {
    flex: 1,
    fontSize: SIZES.body,
    color: colors.textPrimary,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: SIZES.radius * 2,
    padding: SIZES.padding * 2,
    width: '100%',
    maxWidth: 400,
    ...SHADOWS.large,
  },
  modalTitle: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: SIZES.padding / 2,
  },
  modalSubtitle: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: SIZES.padding * 2,
  },
  modalButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SIZES.padding,
  },
  modalButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.small,
    minHeight: 100,
  },
  modalButtonText: {
    fontSize: SIZES.caption,
    color: colors.textPrimary,
    marginTop: SIZES.padding / 2,
    textAlign: 'center',
    fontWeight: '500',
    flex: 1,
    textAlignVertical: 'center',
  },
  modalCloseButton: {
    marginTop: SIZES.padding * 2,
    padding: SIZES.padding,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  // Modal header styles
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SIZES.padding,
  },
  backButton: {
    padding: SIZES.padding / 2,
    borderRadius: SIZES.radius,
    backgroundColor: colors.background,
    ...SHADOWS.small,
  },
  placeholder: {
    width: 40, // Geri butonu ile aynı genişlik
  },
  guideContent: {
    fontSize: SIZES.body,
    color: colors.textPrimary,
    lineHeight: 24,
    textAlign: 'left',
  },
  closeButtonContainer: {
    alignItems: 'center',
    marginTop: SIZES.padding,
  },
  closeButton: {
    backgroundColor: colors.background,
    borderRadius: SIZES.radius,
    padding: SIZES.padding / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.small,
    minHeight: 60,
    width: 120, // Sabit genişlik
  },
  closeButtonText: {
    fontSize: SIZES.caption,
    color: colors.textSecondary,
    marginTop: SIZES.padding / 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  // Ayarlar stilleri
  settingsHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  settingsTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTitleText: {
    flex: 1,
  },
  settingsMainTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  settingsSubTitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  settingsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  modernSettingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.small,
  },
  settingIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  modernSettingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  modernSettingSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  modernToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  modernToggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  premiumBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumContent: {
    padding: 20,
  },
  premiumActiveContainer: {
    alignItems: 'center',
  },
  premiumPurchaseContainer: {
    alignItems: 'center',
  },
  premiumIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  premiumTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  premiumDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  premiumBenefits: {
    width: '100%',
    marginBottom: 30,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  benefitText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  premiumPricing: {
    alignItems: 'center',
    marginBottom: 20,
  },
  priceLabel: {
    fontSize: 14,
    marginBottom: 5,
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  premiumExpiryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  premiumExpiryText: {
    fontSize: 14,
    marginLeft: 8,
    textAlign: 'center',
  },
  premiumAutoRenewalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  premiumAutoRenewalText: {
    fontSize: 14,
    marginLeft: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  premiumCard: {
    marginHorizontal: SIZES.padding,
    marginVertical: SIZES.padding,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
  },
  premiumCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  premiumCardIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZES.padding,
  },
  premiumCardText: {
    flex: 1,
  },
  premiumCardTitle: {
    fontSize: SIZES.h4,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  premiumCardSubtitle: {
    fontSize: SIZES.small,
    lineHeight: 20,
  },
  premiumCardBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBanner: {
    marginHorizontal: SIZES.padding,
    marginVertical: SIZES.padding,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    height: 60,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    ...SHADOWS.small,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SIZES.padding,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: SIZES.caption,
    color: colors.textSecondary,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
  },
  toggleButtonActive: {
    alignSelf: 'flex-end',
  },
  logoutModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    overflow: 'hidden',
    ...SHADOWS.large,
  },
  logoutHeader: {
    padding: 20,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  logoutTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  logoutContent: {
    padding: 20,
    alignItems: 'center',
  },
  logoutMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  logoutActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    padding: 0,
  },
  logoutModalButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    marginHorizontal: 0,
  },
  logoutModalButtonDanger: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  logoutModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  logoutModalButtonTextDanger: {
    color: colors.surface,
  },
  avatarModal: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: SIZES.radius * 2,
    overflow: 'hidden',
    ...SHADOWS.large,
  },
  avatarHeader: {
    padding: SIZES.padding,
    borderBottomWidth: 1,
  },
  avatarTitle: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  avatarGrid: {
    maxHeight: 400,
    padding: SIZES.padding,
  },
  avatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  avatarOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarOptionEmoji: {
    fontSize: 30,
  },
  themeModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: SIZES.radius * 2,
    overflow: 'hidden',
    ...SHADOWS.large,
  },
  themeHeader: {
    padding: SIZES.padding,
    borderBottomWidth: 1,
  },
  themeTitle: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  themeSubtitle: {
    fontSize: SIZES.body,
    textAlign: 'center',
  },
  themeOptions: {
    padding: SIZES.padding,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
  },
  themeOptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  themeOptionText: {
    marginLeft: SIZES.padding,
    flex: 1,
  },
  themeOptionTitle: {
    fontSize: SIZES.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  themeOptionSubtitle: {
    fontSize: SIZES.tiny,
  },
  // Öğretmen bölümü stilleri
  teacherSection: {
    marginBottom: 24,
    marginHorizontal: SIZES.padding,
  },
  teacherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  teacherHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teacherIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherSectionTitle: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  addTeacherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primary + '15',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    gap: 6,
  },
  addTeacherText: {
    fontSize: SIZES.small,
    fontWeight: '500',
    color: colors.primary,
  },
  connectedTeachers: {
    gap: 8,
  },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.small,
  },
  teacherCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  teacherAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherInfo: {
    flex: 1,
  },
  teacherName: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  teacherDetails: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
  },
  disconnectButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noTeachers: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: 8,
  },
  noTeachersText: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    flex: 1,
  },
  // Öğretmen kodu stilleri
  teacherCodeSection: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
  teacherCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  teacherCodeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teacherCodeIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherCodeSectionTitle: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  teacherCodeContent: {
    gap: 12,
  },
  teacherCodeDisplay: {
    gap: 8,
  },
  teacherCodeLabel: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
  },
  teacherCodeValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teacherCodeValue: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: colors.primary,
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.primary + '15',
  },
  // Bekleyen istekler stilleri
  pendingSection: {
    marginBottom: 16,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.small,
  },
  pendingContent: {
    flex: 1,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pendingTeacherName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pendingDetails: {
    gap: 2,
  },
  pendingBranch: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  pendingStatus: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  pendingActions: {
    marginLeft: 12,
  },
  cancelRequestButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Öğretmen modal stilleri
  teacherModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: SIZES.radius * 2,
    overflow: 'hidden',
    ...SHADOWS.large,
  },
  teacherModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SIZES.padding,
    borderBottomWidth: 1,
  },
  teacherModalTitle: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  teacherModalContent: {
    padding: SIZES.padding,
  },
  teacherModalSubtitle: {
    fontSize: SIZES.body,
    marginBottom: 16,
    textAlign: 'center',
  },
  teacherCodeInput: {
    marginBottom: 20,
  },
  teacherModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  teacherModalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: SIZES.radius,
    alignItems: 'center',
  },
  teacherModalCancelText: {
    fontSize: SIZES.body,
    fontWeight: '500',
  },
  teacherModalSubmitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: SIZES.radius,
    alignItems: 'center',
  },
  teacherModalSubmitText: {
    fontSize: SIZES.body,
    fontWeight: '600',
  },
  // Toast Notification Styles
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  toast: {
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
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
    color: colors.surface,
    fontSize: SIZES.body,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  // Öğrenci listesi stilleri
  connectedStudents: {
    marginTop: 12,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: 8,
  },
  studentCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  studentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  studentDetails: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  noStudents: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noStudentsText: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 8,
  },
  // Öğrenci düzenleme butonu stilleri
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 8,
  },
  // Modal stilleri
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    ...SHADOWS.large,
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
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  // Şifre değiştirme modal stilleri
  passwordModal: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
    ...SHADOWS.large,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  passwordTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  passwordContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: colors.background,
    borderColor: colors.border,
    color: colors.textPrimary,
  },
  passwordActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  passwordModalButton: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  passwordModalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  passwordModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  passwordModalButtonTextPrimary: {
    color: colors.surface,
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: colors.background,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
  // Öğretmen kart wrapper
  teacherCardWrapper: {
    marginBottom: 8,
  },
  // Kurum kartı stilleri
  institutionCard: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  institutionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  institutionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  institutionText: {
    flex: 1,
    alignItems: 'center',
  },
  institutionTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  institutionSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },
  institutionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  // Bireysel kullanıcı kartı stilleri
  individualCard: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  individualCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  individualIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  individualText: {
    flex: 1,
    alignItems: 'center',
  },
  individualTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  individualSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },
  individualBadge: {
    alignSelf: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surface,
    ...SHADOWS.small,
  },
  individualBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.surface,
    letterSpacing: 0.5,
  },
  // Modern profil kartı stilleri
  profileCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.medium,
  },
  profileContent: {
    alignItems: 'center',
    gap: 4,
  },
  profileDetails: {
    alignItems: 'center',
    gap: 2,
  },
  // Öğretmen detay modal stilleri
  closeModalButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  // Detay bölümleri
  detailSection: {
    marginBottom: 24,
  },
  detailCard: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    minWidth: 100,
  },
  detailValue: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  // Inline edit button
  inlineEditButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHelperText: {
    fontSize: SIZES.tiny,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
});

