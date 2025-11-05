import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  BackHandler,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_COLORS, COLORS } from '../constants/theme';
import { SIZES, SHADOWS } from '../constants/theme';
import Container from '../components/Container';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';
import { getInstitutionAdminGuidanceTeacher, setInstitutionAdminGuidanceTeacher, addInstitutionAdminTeacher, addInstitutionAdminStudent, deleteInstitutionAdminUser, resetInstitutionAdminUserPassword, updateInstitutionAdminUser, changeInstitutionAdminPassword } from '../lib/adminApi';
// ⚠️ supabaseAdmin artık kullanılmıyor - InstitutionAdminScreen için Edge Functions kullanılmalı

const InstitutionAdminScreen = ({ route }) => {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  // States
  const [loading, setLoading] = useState(false);
  const [institution, setInstitution] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showTeacherList, setShowTeacherList] = useState(false);
  const [showStudentList, setShowStudentList] = useState(false);

  // Form states
  const [teacherForm, setTeacherForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    branch: '',
    phone: '',
    experience: '',
    education: '',
    address: '',
    notes: ''
  });

  const [studentForm, setStudentForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    grade: '',
    phone: '',
    parentName: '',
    parentPhone: '',
    address: '',
    notes: ''
  });

  const [teacherLoading, setTeacherLoading] = useState(false);
  const [studentLoading, setStudentLoading] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [stats, setStats] = useState({
    totalTeachers: 0,
    totalStudents: 0,
  });
  const [guidanceTeacher, setGuidanceTeacher] = useState(null);

  // Edit user states
  const [showEditUser, setShowEditUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    branch: '',
    phone: '',
    grade: ''
  });
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false); // Logout durumu için flag
  
  // Şifre değiştirme states
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    checkSessionAndLoadData();
  }, []);

  // Sayfa focus olduğunda session kontrolü yap ve verileri yenile
  useEffect(() => {
    const unsubscribe = navigation?.addListener('focus', async () => {
      // Logout durumunda session kontrolü yapma
      if (isLoggingOut) {
        return;
      }
      // checkSessionAndLoadData zaten tüm verileri yüklüyor, tekrar yüklemeye gerek yok
      await checkSessionAndLoadData();
    });

    return unsubscribe;
  }, [navigation, isLoggingOut]);

  // Android geri tuşu ve swipe back davranışını kontrol et
  useEffect(() => {
    // Logout durumunda listener'ları devre dışı bırak
    if (isLoggingOut) {
      return;
    }

    // Geri tuşu davranışını engelle ve çıkış yap
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isLoggingOut) {
        handleLogout(true); // Geri tuşu için direkt çıkış
        return true; // Event'i işledik, default davranışı engelle
      }
      return false;
    });

    // React Navigation'ın beforeRemove event'ini dinle
    const unsubscribe = navigation?.addListener('beforeRemove', (e) => {
      // Logout durumunda event'i engelleme
      if (isLoggingOut) {
        return;
      }
      // Prevent default behavior of leaving the screen
      e.preventDefault();
      handleLogout(true); // Swipe back için direkt çıkış
    });

    return () => {
      backHandler.remove();
      unsubscribe?.();
    };
  }, [navigation, handleLogout, isLoggingOut]);

  // Session kontrolü ve kurum verilerini yükle
  const checkSessionAndLoadData = async () => {
    // Logout durumunda session kontrolü yapma
    if (isLoggingOut) {
      return;
    }

    try {
      // AsyncStorage'dan session'ı kontrol et
      const sessionData = await AsyncStorage.getItem('institutionAdminSession');
      
      if (!sessionData) {
        // Session yoksa login ekranına yönlendir
        Alert.alert('Oturum Süresi Doldu', 'Lütfen tekrar giriş yapın.');
        if (navigation) {
          navigation.navigate('InstitutionAdminLogin');
        }
        return;
      }

      const session = JSON.parse(sessionData);
      
      // Session süresi kontrolü (24 saat)
      const loginTime = new Date(session.loginTime);
      const now = new Date();
      const hoursDiff = (now - loginTime) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        // Session süresi dolmuş
        await AsyncStorage.removeItem('institutionAdminSession');
        Alert.alert('Oturum Süresi Doldu', 'Lütfen tekrar giriş yapın.');
        if (navigation) {
          navigation.navigate('InstitutionAdminLogin');
        }
        return;
      }

      // Kurum aktiflik kontrolü
      if (session.isActive === false) {
        await AsyncStorage.removeItem('institutionAdminSession');
        Alert.alert('Erişim Engellendi', 'Kurumunuz pasif durumda.');
        if (navigation) {
          navigation.navigate('InstitutionAdminLogin');
        }
        return;
      }

      // Sözleşme bitiş tarihi kontrolü
      if (session.contractEndDate) {
        const contractEnd = new Date(session.contractEndDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        contractEnd.setHours(0, 0, 0, 0);
        
        if (contractEnd < today) {
          await AsyncStorage.removeItem('institutionAdminSession');
          Alert.alert('Erişim Engellendi', 'Kurumunuzun sözleşmesi sona ermiş.');
          if (navigation) {
            navigation.navigate('InstitutionAdminLogin');
          }
          return;
        }
      }

      // Session geçerli, verileri yükle
      const institutionId = await loadInstitutionData();
      
      // Kurum bilgileri yüklendikten sonra verileri yükle
      if (institutionId) {
        // Önce istatistikleri yükle
        await loadStatsData(institutionId);
        // Sonra listeleri yükle
        await loadTeachers();
        await loadStudents();
      }
    } catch (error) {
      console.error('Session kontrol hatası:', error);
      await AsyncStorage.removeItem('institutionAdminSession');
      Alert.alert('Hata', 'Oturum kontrolü sırasında bir hata oluştu.');
      if (navigation) {
        navigation.navigate('InstitutionAdminLogin');
      }
    }
  };

  const loadInstitutionData = async () => {
    setLoading(true);
    try {
      // Önce AsyncStorage'dan kurum ID'sini al
      const sessionData = await AsyncStorage.getItem('institutionAdminSession');
      let institutionId = null;

      if (sessionData) {
        const session = JSON.parse(sessionData);
        institutionId = session.institutionId;
      }

      // Route parametrelerinden kurum bilgilerini al (varsa)
      if (route?.params?.institutionData) {
        const institutionData = route.params.institutionData;
        setInstitution(institutionData);
        institutionId = institutionData.institution_id || institutionData.id;
        setLoading(false);
        return institutionId; // institutionId'yi döndür ki çağıran fonksiyon loadStatsData'yı çağırabilsin
      }

      // Session'dan kurum ID varsa, kurum bilgilerini yükle
      if (institutionId) {
        const { data: institutionData, error } = await supabase
          .from('institutions')
          .select('*')
          .eq('id', institutionId)
          .single();

        if (error) {
          console.error('Kurum bilgisi yükleme hatası:', error);
        } else if (institutionData) {
          setInstitution(institutionData);
          
          // Rehber öğretmen bilgisini yükle
          await loadGuidanceTeacher();
        }
      }
      
      return institutionId; // institutionId'yi döndür
    } catch (error) {
      console.error('Kurum bilgileri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // İstatistikleri yükle
  const loadStatsData = async (institutionId) => {
    if (!institutionId) return;

    try {
      // Tüm aktif üyelikleri al
      const { data: memberships, error: membershipError } = await supabase
        .from('institution_memberships')
        .select('user_id')
        .eq('institution_id', institutionId)
        .eq('is_active', true);

      if (membershipError) {
        console.error('Membership query error:', membershipError);
      }

      if (!memberships || memberships.length === 0) {
        setStats({ totalTeachers: 0, totalStudents: 0 });
        return;
      }

      const userIds = memberships.map(m => m.user_id).filter(Boolean);
      
      if (userIds.length === 0) {
        setStats({ totalTeachers: 0, totalStudents: 0 });
        return;
      }

      // Öğretmen sayısı
      const { data: teacherProfiles, error: teacherError } = await supabase
        .from('user_profiles')
        .select('user_id')
        .in('user_id', userIds)
        .eq('user_type', 'teacher');

      if (teacherError) {
        console.error('Teacher query error:', teacherError);
      }

      // Öğrenci sayısı
      const { data: studentProfiles, error: studentError } = await supabase
        .from('user_profiles')
        .select('user_id')
        .in('user_id', userIds)
        .eq('user_type', 'student');

      if (studentError) {
        console.error('Student query error:', studentError);
      }

      setStats({
        totalTeachers: teacherProfiles?.length || 0,
        totalStudents: studentProfiles?.length || 0,
      });
    } catch (error) {
      console.error('İstatistik yükleme hatası:', error);
    }
  };

  // Rehber öğretmen bilgisini yükle
  const loadGuidanceTeacher = async () => {
    try {
      // Kurum ID'sini al
      let institutionId = institution?.id || institution?.institution_id;
      if (!institutionId) {
        const sessionData = await AsyncStorage.getItem('institutionAdminSession');
        if (sessionData) {
          const session = JSON.parse(sessionData);
          institutionId = session.institutionId;
        }
      }

      if (!institutionId) {
        console.error('loadGuidanceTeacher: institutionId bulunamadı');
        setGuidanceTeacher(null);
        return;
      }

      // Edge Function kullan - session'dan admin username'i al
      let adminUsername = null;
      const sessionData = await AsyncStorage.getItem('institutionAdminSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        adminUsername = session.adminUsername || null;
      }
      
      const result = await getInstitutionAdminGuidanceTeacher(institutionId, adminUsername);
      
      if (result.error) {
        console.error('Rehber öğretmen yükleme hatası:', result.error);
        setGuidanceTeacher(null);
        return;
      }

      // Edge Function'dan dönen veriyi kontrol et
      const guidanceTeacherData = result.data;
      
      if (guidanceTeacherData && !guidanceTeacherData.name) {
        console.warn('Rehber öğretmen verisi name alanı eksik:', guidanceTeacherData);
      }
      
      setGuidanceTeacher(guidanceTeacherData);
    } catch (error) {
      console.error('Rehber öğretmen yükleme hatası:', error);
      setGuidanceTeacher(null);
    }
  };

  // Rehber öğretmen ata/değiştir
  const setGuidanceTeacherId = async (teacherId) => {
    let institutionId = institution?.id || institution?.institution_id;
    
    // InstitutionId yoksa session'dan al
    if (!institutionId) {
      const sessionData = await AsyncStorage.getItem('institutionAdminSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        institutionId = session?.institutionId;
      }
    }
    
    if (!institutionId) {
      Alert.alert('Hata', 'Kurum bilgisi bulunamadı.');
      return;
    }

    // teacherId null ise rehber öğretmen kaldırma işlemi yapılacak, bu geçerli bir durum
    // teacherId varsa ama geçersiz bir değerse hata ver
    if (teacherId !== null && teacherId !== undefined && !teacherId) {
      Alert.alert('Hata', 'Öğretmen bilgisi bulunamadı.');
      return;
    }

    try {
      // Admin username'i al (session'dan)
      let adminUsername = null;
      const sessionData = await AsyncStorage.getItem('institutionAdminSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        adminUsername = session.adminUsername || null;
      }

      // Edge Function kullan
      const result = await setInstitutionAdminGuidanceTeacher(institutionId, teacherId, adminUsername);

      if (result.error) {
        console.error('Rehber öğretmen atama hatası:', result.error);
        Alert.alert('Hata', result.error.message || 'Rehber öğretmen atanırken bir hata oluştu');
        return;
      }

      // Institution state'ini güncelle
      if (result.data) {
        setInstitution(prev => ({ ...prev, guidance_teacher_id: teacherId }));
      }

      // Rehber öğretmen bilgisini yenile
      await loadGuidanceTeacher();
      
      // Biraz bekle ve tekrar kontrol et (state güncellenmesi için)
      setTimeout(async () => {
        await loadGuidanceTeacher();
      }, 500);

      // Kurum bilgilerini yenile
      const { data: updatedInstitution } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', institutionId)
        .single();
      
      if (updatedInstitution) {
        setInstitution(updatedInstitution);
      }

      // Öğretmen listesini yenile (rehber öğretmen badge'lerini güncellemek için)
      await loadTeachers();

      Alert.alert('Başarılı!', teacherId ? 'Rehber öğretmen atandı.' : 'Rehber öğretmen kaldırıldı.');
    } catch (error) {
      console.error('Rehber öğretmen atama hatası:', error);
      Alert.alert('Hata', `Rehber öğretmen atanırken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`);
    }
  };

  const loadTeachers = async () => {
    let institutionId = institution?.id || institution?.institution_id;
    
    if (!institutionId) {
      // Institution yoksa session'dan al
      const sessionData = await AsyncStorage.getItem('institutionAdminSession');
      if (!sessionData) return;
      
      const session = JSON.parse(sessionData);
      institutionId = session.institutionId;
      
      if (!institutionId) return;
      
      // Kurum bilgilerini yükle
      const { data: institutionData, error } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', institutionId)
        .single();
      
      if (error) {
        console.error('loadTeachers: Institution yükleme hatası:', error);
      }
      
      if (!institutionData) return;
      setInstitution(institutionData);
      
      // Rehber öğretmen bilgisini yükle
      if (institutionData.guidance_teacher_id) {
        await loadGuidanceTeacher(institutionData.guidance_teacher_id);
      } else {
        setGuidanceTeacher(null);
      }
    }
    
    setLoadingTeachers(true);
    try {
      const { data: memberships } = await supabase
        .from('institution_memberships')
        .select('user_id')
        .eq('institution_id', institutionId)
        .eq('is_active', true);

      if (memberships && memberships.length > 0) {
        const userIds = memberships.map(m => m.user_id).filter(Boolean).filter(id => id !== 'null' && id !== null);
        
        if (userIds.length === 0) {
          setTeachers([]);
          setLoadingTeachers(false);
          return;
        }
        
        const { data: userProfiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_id, name, user_type, email')
          .in('user_id', userIds)
          .eq('user_type', 'teacher');

        if (profileError) {
          console.error('loadTeachers: userProfiles query error:', profileError);
        }

        if (userProfiles && userProfiles.length > 0) {
          const teacherData = await Promise.all(
            userProfiles.map(async (profile) => {
              // Önce tüm alanları al (hem subject hem branch, id dahil)
              const { data: teacherInfo, error: teacherError } = await supabase
                .from('teachers')
                .select('id, subject, branch, phone, experience, education, address, notes')
                .eq('user_id', profile.user_id)
                .maybeSingle();

              if (teacherError) {
                console.error('loadTeachers: teacherInfo error for user_id:', profile.user_id, teacherError);
              }
              
              // Eğer teacherInfo yoksa (yeni eklenen öğretmen henüz sync olmamış olabilir), varsayılan değerler kullan
              if (!teacherInfo) {
                return {
                  ...profile,
                  teacher_id: null,
                  branch: 'Branş belirtilmemiş',
                  phone: '-',
                  experience: '-',
                  education: '-',
                  address: '-',
                  notes: '-'
                };
              }

              // Önce branch varsa onu kullan, yoksa subject kullan
              const branchValue = teacherInfo?.branch || teacherInfo?.subject || 'Branş belirtilmemiş';

              // teacherInfo'yu spread ederken branch değerini koru
              const { branch: _, subject: __, ...restTeacherInfo } = teacherInfo || {};

              return {
                ...profile,
                teacher_id: teacherInfo?.id, // Rehber öğretmen kontrolü için
                branch: branchValue,
                phone: teacherInfo?.phone || '-',
                experience: teacherInfo?.experience || '-',
                education: teacherInfo?.education || '-',
                address: teacherInfo?.address || '-',
                notes: teacherInfo?.notes || '-',
                // teacherInfo'nun geri kalanını ekle (branch ve subject hariç)
                ...restTeacherInfo
              };
            })
          );

          setTeachers(teacherData.sort((a, b) => a.name.localeCompare(b.name)));
        } else {
          setTeachers([]);
        }
      } else {
        setTeachers([]);
      }
    } catch (error) {
      console.error('Öğretmen listesi yükleme hatası:', error);
      Alert.alert('Hata', 'Öğretmen listesi yüklenirken bir hata oluştu: ' + error.message);
    } finally {
      setLoadingTeachers(false);
    }
  };

  const loadStudents = async () => {
    let institutionId = institution?.id || institution?.institution_id;
    
    if (!institutionId) {
      // Institution yoksa session'dan al
      const sessionData = await AsyncStorage.getItem('institutionAdminSession');
      if (!sessionData) {
        console.error('loadStudents: Session data bulunamadı');
        setLoadingStudents(false);
        return;
      }
      
      const session = JSON.parse(sessionData);
      institutionId = session?.institutionId;
      
      if (!institutionId) {
        console.error('loadStudents: institutionId bulunamadı');
        setLoadingStudents(false);
        return;
      }
      
      // institutionId geçerli UUID olmalı
      if (!institutionId || institutionId === 'undefined' || institutionId === 'null' || typeof institutionId !== 'string') {
        console.error('loadStudents: Geçersiz institutionId (session):', institutionId);
        setLoadingStudents(false);
        return;
      }

      // Kurum bilgilerini yükle
      const { data: institutionData, error } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', institutionId)
        .single();
      
      if (error) {
        console.error('loadStudents: Institution yükleme hatası:', error);
        setLoadingStudents(false);
        return;
      }
      
      if (!institutionData) {
        console.error('loadStudents: Institution bulunamadı');
        setLoadingStudents(false);
        return;
      }
      setInstitution(institutionData);
    }
    
    // institutionId'nin geçerli UUID olduğundan emin ol
    if (!institutionId || institutionId === 'undefined' || institutionId === 'null') {
      console.error('loadStudents: Geçersiz institutionId:', institutionId);
      setStudents([]);
      setLoadingStudents(false);
      return;
    }

    setLoadingStudents(true);
    try {
      const { data: memberships, error: membershipError } = await supabase
        .from('institution_memberships')
        .select('user_id')
        .eq('institution_id', institutionId)
        .eq('is_active', true);

      if (membershipError) {
        console.error('loadStudents: memberships query error:', membershipError);
        setStudents([]);
        setLoadingStudents(false);
        return;
      }

      if (memberships && memberships.length > 0) {
        const userIds = memberships
          .map(m => m?.user_id)
          .filter(Boolean)
          .filter(id => id !== 'null' && id !== null && id !== 'undefined');
        
        if (userIds.length === 0) {
          setStudents([]);
          setLoadingStudents(false);
          return;
        }
        
        const { data: userProfiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_id, name, user_type, email')
          .in('user_id', userIds)
          .eq('user_type', 'student');

        if (profileError) {
          console.error('loadStudents: userProfiles query error:', profileError);
        }

        if (userProfiles && userProfiles.length > 0) {
          // Promise.allSettled kullanarak tüm query'lerin tamamlanmasını bekle
          // Böylece bir query başarısız olsa bile diğerleri devam eder
          const studentDataResults = await Promise.allSettled(
            userProfiles.map(async (profile) => {
              try {
                const { data: studentInfo, error: studentError } = await supabase
                  .from('students')
                  .select('school, grade, phone, parent_name, parent_phone, address, notes')
                  .eq('user_id', profile.user_id)
                  .single();

                if (studentError) {
                  // Network hatası veya diğer hatalar için sadece log'la, devam et
                  const errorMessage = studentError?.message || studentError?.toString() || 'Bilinmeyen hata';
                  console.error('loadStudents: studentInfo error for user_id:', profile.user_id, errorMessage);
                  
                  // Hata durumunda varsayılan değerlerle devam et
                  return {
                    ...profile,
                    grade: 'Sınıf belirtilmemiş',
                    phone: '-',
                    school: '-',
                    parent_name: '-',
                    parent_phone: '-',
                    address: '-',
                    notes: '-'
                  };
                }

                return {
                  ...profile,
                  grade: studentInfo?.grade || 'Sınıf belirtilmemiş',
                  phone: studentInfo?.phone || '-',
                  school: studentInfo?.school || '-',
                  parent_name: studentInfo?.parent_name || '-',
                  parent_phone: studentInfo?.parent_phone || '-',
                  address: studentInfo?.address || '-',
                  notes: studentInfo?.notes || '-',
                  ...studentInfo
                };
              } catch (error) {
                // Beklenmeyen hatalar için de varsayılan değerlerle devam et
                const errorMessage = error?.message || error?.toString() || 'Bilinmeyen hata';
                console.error('loadStudents: Unexpected error for user_id:', profile.user_id, errorMessage);
                
                return {
                  ...profile,
                  grade: 'Sınıf belirtilmemiş',
                  phone: '-',
                  school: '-',
                  parent_name: '-',
                  parent_phone: '-',
                  address: '-',
                  notes: '-'
                };
              }
            })
          );

          // Promise.allSettled sonuçlarını işle
          const studentData = studentDataResults
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value)
            .filter(Boolean); // null/undefined değerleri filtrele

          setStudents(studentData.sort((a, b) => (a?.name || '').localeCompare(b?.name || '')));
        } else {
          setStudents([]);
        }
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error('Öğrenci listesi yükleme hatası:', error);
      Alert.alert('Hata', 'Öğrenci listesi yüklenirken bir hata oluştu: ' + error.message);
    } finally {
      setLoadingStudents(false);
    }
  };

  const addTeacher = async (deactivateOtherInstitutions = false) => {
    // Form validasyonu
    if (!teacherForm.firstName || !teacherForm.lastName || !teacherForm.email || !teacherForm.branch) {
      Alert.alert('Hata', 'Ad, soyad, e-posta ve branş alanları zorunludur!');
      return;
    }

    let institutionId = institution?.id || institution?.institution_id;
    if (!institutionId) {
      const sessionData = await AsyncStorage.getItem('institutionAdminSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        institutionId = session.institutionId;
      }
    }

    if (!institutionId) {
      Alert.alert('Hata', 'Kurum bilgisi bulunamadı.');
      return;
    }

    setTeacherLoading(true);
    try {
      // Admin username'i al (session'dan)
      let adminUsername = null;
      const sessionData = await AsyncStorage.getItem('institutionAdminSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        adminUsername = session.adminUsername || null;
      }

      // Edge Function kullan
      const result = await addInstitutionAdminTeacher(
        institutionId,
        {
          firstName: teacherForm.firstName,
          lastName: teacherForm.lastName,
          email: teacherForm.email,
          branch: teacherForm.branch,
          phone: teacherForm.phone,
          experience: teacherForm.experience,
          education: teacherForm.education,
          address: teacherForm.address,
          notes: teacherForm.notes,
        },
        deactivateOtherInstitutions,
        adminUsername
      );

      console.log('[DEBUG] addTeacher result:', {
        hasData: !!result.data,
        hasError: !!result.error,
        errorMessage: result.error?.message,
        errorDetails: result.error,
        dataKeys: result.data ? Object.keys(result.data) : [],
        dataMessage: result.data?.message,
        dataType: typeof result.data
      });

      if (result.error) {
        // Limit kontrolü hatası
        if (result.error.limit_reached) {
          Alert.alert(
            'Limit Aşıldı!',
            `${result.error.institution_name || institution?.name} kurumunda öğretmen limiti (${result.error.max_count}) aşıldı.\n\nMevcut: ${result.error.current_count}/${result.error.max_count}\n\nDaha fazla öğretmen eklemek için geliştirici ile iletişime geçin.`,
            [{ text: 'Tamam' }]
          );
          setTeacherLoading(false);
          return;
        }

        // Başka kurumlarda üyelik var - onay isteniyor
        if (result.data?.requires_confirmation) {
          const confirmationMessage = result.data.message || 'Bu öğretmen zaten başka kurum(lar)ında aktif üyeliğe sahip. Önceki kurum üyelikleri pasif edilecek. Devam etmek istiyor musunuz?';
          Alert.alert(
            'Dikkat!',
            confirmationMessage,
            [
              { 
                text: 'İptal', 
                style: 'cancel', 
                onPress: () => {
                  setTeacherLoading(false);
                }
              },
              {
                text: 'Devam Et',
                onPress: () => {
                  // Onay verildi, tekrar çağır - event objesini kullanmadan
                  addTeacher(true);
                }
              }
            ]
          );
          return;
        }

        // Diğer hatalar
        Alert.alert('Hata', result.error.message || result.error || 'Öğretmen eklenirken bir hata oluştu.');
        setTeacherLoading(false);
        return;
      }

      // Başarılı
      Alert.alert('Başarılı!', result.data?.message || 'Öğretmen başarıyla eklendi.');
      setShowAddTeacher(false);
      setTeacherForm({
        firstName: '',
        lastName: '',
        email: '',
        branch: '',
        phone: '',
        experience: '',
        education: '',
        address: '',
        notes: ''
      });
      
      // İstatistikleri ve listeleri yenile
      setTimeout(async () => {
        await loadTeachers();
        await loadStatsData(institution.id || institution.institution_id);
      }, 500);
    } catch (error) {
      // Error objesini güvenli şekilde log'la
      const errorMessage = error?.message || error?.toString() || 'Bilinmeyen hata';
      console.error('[ERROR] Öğretmen ekleme hatası:', errorMessage);
      Alert.alert('Hata', `Öğretmen eklenirken bir hata oluştu: ${errorMessage}`);
    } finally {
      setTeacherLoading(false);
    }
  };

  // Öğretmen kurum üyeliği oluşturma fonksiyonu (artık Edge Function içinde, burada kalmıyor)
  // const createTeacherMembership - KALDIRILDI - Edge Function içinde yapılıyor

  // Öğrenci kurum üyeliği oluşturma fonksiyonu
  // ⚠️ KALDIRILDI - Artık Edge Function (institution-admin-add-student) içinde yapılıyor
  // Bu fonksiyon artık kullanılmıyor, ancak kod geçmişi için burada bırakıldı

  const addStudent = async (deactivateOtherInstitutions = false) => {
    // Form validasyonu
    if (!studentForm.firstName || !studentForm.lastName || !studentForm.email) {
      Alert.alert('Hata', 'Ad, soyad ve e-posta alanları zorunludur!');
      return;
    }

    let institutionId = institution?.id || institution?.institution_id;
    if (!institutionId) {
      const sessionData = await AsyncStorage.getItem('institutionAdminSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        institutionId = session.institutionId;
      }
    }

    if (!institutionId) {
      Alert.alert('Hata', 'Kurum bilgisi bulunamadı.');
      return;
    }

    setStudentLoading(true);
    try {
      // Admin username'i al (session'dan)
      let adminUsername = null;
      const sessionData = await AsyncStorage.getItem('institutionAdminSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        adminUsername = session.adminUsername || null;
      }

      // Edge Function kullan
      const result = await addInstitutionAdminStudent(
        institutionId,
        {
          firstName: studentForm.firstName,
          lastName: studentForm.lastName,
          email: studentForm.email,
          grade: studentForm.grade,
          phone: studentForm.phone,
          parentName: studentForm.parentName,
          parentPhone: studentForm.parentPhone,
          address: studentForm.address,
          notes: studentForm.notes,
        },
        deactivateOtherInstitutions,
        adminUsername
      );

      console.log('[DEBUG] addStudent result:', {
        hasData: !!result.data,
        hasError: !!result.error,
        errorMessage: result.error?.message,
        errorDetails: result.error,
        dataKeys: result.data ? Object.keys(result.data) : [],
        dataMessage: result.data?.message,
        dataType: typeof result.data
      });

      if (result.error) {
        // Limit kontrolü hatası
        if (result.error.limit_reached) {
          Alert.alert(
            'Limit Aşıldı!',
            `${result.error.institution_name || institution?.name} kurumunda öğrenci limiti (${result.error.max_count}) aşıldı.\n\nMevcut: ${result.error.current_count}/${result.error.max_count}\n\nDaha fazla öğrenci eklemek için geliştirici ile iletişime geçin.`,
            [{ text: 'Tamam' }]
          );
          setStudentLoading(false);
          return;
        }

        // Başka kurumlarda üyelik var - onay isteniyor
        if (result.data?.requires_confirmation) {
          const confirmationMessage = result.data.message || 'Bu öğrenci zaten başka kurum(lar)ında aktif üyeliğe sahip. Önceki kurum üyelikleri pasif edilecek. Devam etmek istiyor musunuz?';
          Alert.alert(
            'Dikkat!',
            confirmationMessage,
            [
              { 
                text: 'İptal', 
                style: 'cancel', 
                onPress: () => {
                  setStudentLoading(false);
                }
              },
              {
                text: 'Devam Et',
                onPress: () => {
                  // Onay verildi, tekrar çağır - event objesini kullanmadan
                  addStudent(true);
                }
              }
            ]
          );
          return;
        }

        // Diğer hatalar
        const errorMessage = result.error?.message || result.error || 'Bilinmeyen hata';
        Alert.alert('Hata', errorMessage);
        setStudentLoading(false);
        return;
      }

      // Başarılı
      Alert.alert('Başarılı!', result.data?.message || 'Öğrenci başarıyla eklendi.');
      setShowAddStudent(false);
      setStudentForm({
        firstName: '',
        lastName: '',
        email: '',
        grade: '',
        phone: '',
        parentName: '',
        parentPhone: '',
        address: '',
        notes: ''
      });
      
      // İstatistikleri ve listeleri yenile
      setTimeout(async () => {
        await loadStudents();
        await loadStatsData(institution.id || institution.institution_id);
      }, 500);
    } catch (error) {
      // Error objesini güvenli şekilde log'la
      const errorMessage = error?.message || error?.toString() || 'Bilinmeyen hata';
      console.error('[ERROR] Öğrenci ekleme hatası:', errorMessage);
      Alert.alert('Hata', `Öğrenci eklenirken bir hata oluştu: ${errorMessage}`);
    } finally {
      setStudentLoading(false);
    }
  };


  // Edit user function
  const editUser = async (user) => {
    setSelectedUser(user);
    
    // E-posta bilgisini user_profiles tablosundan al
    let email = user.email || '';
    if (!email) {
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('user_id', user.user_id)
          .single();
        
        if (profile?.email) {
          email = profile.email;
        }
      } catch (error) {
        console.error('E-posta bilgisi alınırken hata:', error);
      }
    }
    
    setEditUserForm({
      firstName: user.name?.split(' ')[0] || '',
      lastName: user.name?.split(' ').slice(1).join(' ') || '',
      email: email,
      branch: user.branch || '',
      phone: user.phone || '',
      grade: user.grade || ''
    });
    setShowEditUser(true);
  };

  // Update user function
  const updateUser = async () => {
    if (!selectedUser) return;

    // Kullanıcı tipini güncellemeden önce kaydet (selectedUser null yapıldıktan sonra erişilemez)
    const isTeacher = !!selectedUser.branch;
    const userId = selectedUser.user_id;

    setEditUserLoading(true);
    try {
      const fullName = `${editUserForm.firstName} ${editUserForm.lastName}`;

      // Admin username'i al (session'dan)
      let adminUsername = null;
      const sessionData = await AsyncStorage.getItem('institutionAdminSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        adminUsername = session.adminUsername || null;
      }

      // Edge Function kullanarak güncelleme yap (RLS politikası nedeniyle)
      const result = await updateInstitutionAdminUser(
        institution?.id || institution?.institution_id,
        userId,
        isTeacher ? 'teacher' : 'student',
        {
          name: fullName,
          email: editUserForm.email,
          branch: isTeacher ? editUserForm.branch : null,
          grade: isTeacher ? null : editUserForm.grade,
          phone: editUserForm.phone
        },
        adminUsername
      );

      if (result.error) {
        const errorMessage = result.error?.message || result.error || 'Bilinmeyen hata';
        const errorDetails = result.error?.details || '';
        Alert.alert('Hata', `${errorMessage}${errorDetails ? '\n\n' + errorDetails : ''}`);
        setEditUserLoading(false);
        return;
      }

      // Modal'ı kapat ve selectedUser'ı temizle
      setShowEditUser(false);
      setSelectedUser(null);
      
      // Supabase cache'inin temizlenmesi için kısa bir bekleme
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Listeleri yenile
      if (isTeacher) {
        await loadTeachers();
        await loadStatsData(institution?.id || institution?.institution_id);
      } else {
        await loadStudents();
        await loadStatsData(institution?.id || institution?.institution_id);
      }

      Alert.alert('Başarılı!', 'Kullanıcı bilgileri güncellendi.');
    } catch (error) {
      console.error('Kullanıcı güncelleme hatası:', error);
      Alert.alert('Hata', `Kullanıcı bilgileri güncellenirken bir hata oluştu: ${error.message}`);
    } finally {
      setEditUserLoading(false);
    }
  };

  // Reset password function
  const resetUserPassword = async (user) => {
    const userId = user.user_id || user.id;
    if (!userId) {
      Alert.alert('Hata', 'Kullanıcı ID bulunamadı');
      return;
    }

    const institutionId = institution?.id || institution?.institution_id;
    if (!institutionId) {
      const sessionData = await AsyncStorage.getItem('institutionAdminSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        institutionId = session.institutionId;
      }
    }

    if (!institutionId) {
      Alert.alert('Hata', 'Kurum bilgisi bulunamadı.');
      return;
    }

    // Kullanıcının email'ini al (önceden gösterim için)
    let userEmail = user.email || 'Bilinmiyor';

    Alert.alert(
      'Şifre Sıfırla',
      `${user.name} kullanıcısının şifresini sıfırlamak istediğinizden emin misiniz?\n\nE-posta: ${userEmail}\nYeni şifre: user123`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            try {
              // Admin username'i al (session'dan)
              let adminUsername = null;
              const sessionData = await AsyncStorage.getItem('institutionAdminSession');
              if (sessionData) {
                const session = JSON.parse(sessionData);
                adminUsername = session.adminUsername || null;
              }

              // Edge Function kullan
              const result = await resetInstitutionAdminUserPassword(
                institutionId,
                userId,
                adminUsername
              );

              if (result.error) {
                const errorMessage = result.error?.message || result.error || 'Bilinmeyen hata';
                const errorDetails = result.error?.details || '';
                Alert.alert('Hata', `${errorMessage}${errorDetails ? '\n\n' + errorDetails : ''}`);
                return;
              }

              // Başarılı
              const resultEmail = result.data?.email || userEmail;
              const resultPassword = result.data?.new_password || 'user123';
              Alert.alert(
                'Başarılı!', 
                `${user.name} kullanıcısının şifresi sıfırlandı.\n\nE-posta: ${resultEmail}\nYeni şifre: ${resultPassword}\n\nBu şifreyi kullanıcıya iletin.`
              );
            } catch (error) {
              // Error objesini güvenli şekilde log'la
              const errorMessage = error?.message || error?.toString() || 'Bilinmeyen hata';
              console.error('[ERROR] Şifre sıfırlama hatası:', errorMessage);
              Alert.alert('Hata', `Şifre sıfırlanırken bir hata oluştu: ${errorMessage}`);
            }
          }
        }
      ]
    );
  };

  // Delete user function
  const deleteUser = (user) => {
    Alert.alert(
      'Kullanıcı Sil',
      `${user.name} kullanıcısını silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz!`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              // SOFT-DELETE: Kurumdan ayır ve erişimi engelle
              let institutionId = institution?.id || institution?.institution_id;
              if (!institutionId) {
                const sessionData = await AsyncStorage.getItem('institutionAdminSession');
                if (sessionData) {
                  const session = JSON.parse(sessionData);
                  institutionId = session.institutionId;
                }
              }

              if (!institutionId) {
                Alert.alert('Hata', 'Kurum bilgisi bulunamadı.');
                return;
              }

              const targetUserId = user?.user_id || user?.id;
              if (!targetUserId) {
                Alert.alert('Hata', 'Kullanıcı ID bulunamadı.');
                return;
              }

              // Kullanıcı tipini belirle
              const userType = user.branch ? 'teacher' : 'student';

              // Admin username'i al (session'dan)
              let adminUsername = null;
              const sessionData = await AsyncStorage.getItem('institutionAdminSession');
              if (sessionData) {
                const session = JSON.parse(sessionData);
                adminUsername = session.adminUsername || null;
              }

              // Edge Function kullan
              const result = await deleteInstitutionAdminUser(
                institutionId,
                targetUserId,
                userType,
                adminUsername
              );

              if (result.error) {
                const errorMessage = result.error?.message || result.error || 'Bilinmeyen hata';
                const errorDetails = result.error?.details || '';
                Alert.alert('Hata', `${errorMessage}${errorDetails ? '\n\n' + errorDetails : ''}`);
                return;
              }

              // Başarılı
              Alert.alert('Başarılı!', result.data?.message || `${user.name} kurumdan kaldırıldı.`);
              
              // Listeleri yenile
              if (user.branch) {
                await loadTeachers();
              } else {
                await loadStudents();
              }
              
              // İstatistikleri güncelle
              await loadStatsData(institutionId);
            } catch (error) {
              // Error objesini güvenli şekilde log'la
              const errorMessage = error?.message || error?.toString() || 'Bilinmeyen hata';
              console.error('[ERROR] Kullanıcı silme hatası:', errorMessage);
              Alert.alert('Hata', `Kullanıcı silinirken bir hata oluştu: ${errorMessage}`);
            }
          }
        }
      ]
    );
  };

  const renderTeacherCard = ({ item }) => {
    // Bu öğretmen rehber öğretmen mi?
    const isGuidanceTeacher = guidanceTeacher?.id === item.teacher_id || guidanceTeacher?.user_id === item.user_id;
    
    return (
      <Card style={styles.userCard}>
        <View style={styles.userCardHeader}>
          <View style={styles.userCardInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.userCardName}>{item.name}</Text>
              {isGuidanceTeacher && (
                <View style={[styles.guidanceBadge, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="school" size={14} color={colors.primary} />
                  <Text style={[styles.guidanceBadgeText, { color: colors.primary }]}>Rehber Öğretmen</Text>
                </View>
              )}
            </View>
            <Text style={styles.userCardBranch}>📚 {item.branch || 'Branş belirtilmemiş'}</Text>
            {item.email && (
              <Text style={styles.userCardEmail}>📧 {item.email}</Text>
            )}
            {item.phone && item.phone !== '-' && (
              <Text style={styles.userCardEmail}>📞 {item.phone}</Text>
            )}
          </View>
          <View style={styles.userCardActions}>
            {!isGuidanceTeacher && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.success + '20' }]}
                onPress={() => {
                  Alert.alert(
                    'Rehber Öğretmen Ata',
                    `${item.name} öğretmenini rehber öğretmen olarak atamak istediğinize emin misiniz?\n\nRehber öğretmen kurumundaki tüm öğrencilerin çalışmalarını görebilir.`,
                    [
                      { text: 'İptal', style: 'cancel' },
                      {
                        text: 'Ata',
                        onPress: async () => {
                          try {
                            // Öğretmenin teacher_id'sini bul
                            let teacherId = item.teacher_id || item.id;
                            
                            // teacher_id yoksa user_id'den bul
                            if (!teacherId && item.user_id) {
                              console.log('teacher_id bulunamadı, user_id ile aranıyor:', item.user_id);
                              const { data, error } = await supabase
                                .from('teachers')
                                .select('id')
                                .eq('user_id', item.user_id)
                                .maybeSingle();
                              
                              if (error) {
                                console.error('teacher_id sorgulama hatası:', error);
                                Alert.alert('Hata', 'Öğretmen bilgisi bulunamadı.');
                                return;
                              }
                              
                              if (data) {
                                teacherId = data.id;
                                console.log('teacher_id bulundu:', teacherId);
                              } else {
                                Alert.alert('Hata', 'Öğretmen kaydı bulunamadı.');
                                return;
                              }
                            }
                            
                            if (teacherId) {
                              await setGuidanceTeacherId(teacherId);
                            } else {
                              Alert.alert('Hata', 'Öğretmen bilgisi bulunamadı.');
                            }
                          } catch (error) {
                            console.error('Rehber öğretmen atama hatası:', error);
                            Alert.alert('Hata', 'Rehber öğretmen atanırken bir hata oluştu.');
                          }
                        }
                      }
                    ]
                  );
                }}
              >
                <Ionicons name="school-outline" size={18} color={colors.success} />
              </TouchableOpacity>
            )}
            {isGuidanceTeacher && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.warning + '20' }]}
                onPress={() => {
                  Alert.alert(
                    'Rehber Öğretmen Kaldır',
                    `${item.name} öğretmeninin rehber öğretmen yetkisini kaldırmak istediğinize emin misiniz?`,
                    [
                      { text: 'İptal', style: 'cancel' },
                      {
                        text: 'Kaldır',
                        style: 'destructive',
                        onPress: () => setGuidanceTeacherId(null)
                      }
                    ]
                  );
                }}
              >
                <Ionicons name="school" size={18} color={colors.warning} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
              onPress={() => editUser(item)}
            >
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.warning + '20' }]}
              onPress={() => resetUserPassword(item)}
            >
              <Ionicons name="key-outline" size={18} color={colors.warning} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
              onPress={() => deleteUser(item)}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  };

  const renderStudentCard = ({ item }) => (
    <Card style={styles.userCard}>
      <View style={styles.userCardHeader}>
        <View style={styles.userCardInfo}>
          <Text style={styles.userCardName}>{item.name}</Text>
          <Text style={styles.userCardBranch}>📖 {item.grade || 'Sınıf belirtilmemiş'}</Text>
          {item.email && (
            <Text style={styles.userCardEmail}>📧 {item.email}</Text>
          )}
          {item.phone && item.phone !== '-' && (
            <Text style={styles.userCardEmail}>📞 {item.phone}</Text>
          )}
        </View>
        <View style={styles.userCardActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
            onPress={() => editUser(item)}
          >
            <Ionicons name="create-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.warning + '20' }]}
            onPress={() => resetUserPassword(item)}
          >
            <Ionicons name="key-outline" size={18} color={colors.warning} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
            onPress={() => deleteUser(item)}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  // Şifre değiştirme fonksiyonu
  const handleChangePassword = async () => {
    // Form validasyonu
    if (!changePasswordForm.currentPassword || !changePasswordForm.newPassword || !changePasswordForm.confirmPassword) {
      Alert.alert('Hata', 'Tüm alanlar doldurulmalıdır!');
      return;
    }

    if (changePasswordForm.newPassword.length < 6) {
      Alert.alert('Hata', 'Yeni şifre en az 6 karakter olmalıdır!');
      return;
    }

    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      Alert.alert('Hata', 'Yeni şifre ve şifre onayı eşleşmiyor!');
      return;
    }

    let institutionId = institution?.id || institution?.institution_id;
    if (!institutionId) {
      const sessionData = await AsyncStorage.getItem('institutionAdminSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        institutionId = session.institutionId;
      }
    }

    if (!institutionId) {
      Alert.alert('Hata', 'Kurum bilgisi bulunamadı.');
      return;
    }

    // Admin username'i al (session'dan)
    let adminUsername = null;
    const sessionData = await AsyncStorage.getItem('institutionAdminSession');
    if (sessionData) {
      const session = JSON.parse(sessionData);
      adminUsername = session.adminUsername || null;
    }

    if (!adminUsername) {
      Alert.alert('Hata', 'Admin kullanıcı adı bulunamadı.');
      return;
    }

    setChangingPassword(true);
    try {
      const result = await changeInstitutionAdminPassword(
        institutionId,
        adminUsername,
        changePasswordForm.currentPassword,
        changePasswordForm.newPassword,
        changePasswordForm.confirmPassword
      );

      if (result.error) {
        let errorMessage = result.error?.message || result.error || 'Bilinmeyen hata';
        const errorDetails = result.error?.details || '';
        
        // Eğer hata mesajı "Edge Function hatası (response body yok)" ise, 
        // muhtemelen 401 hatası (yanlış şifre) - daha anlamlı mesaj göster
        if (errorMessage.includes('response body yok') || errorMessage.includes('non-2xx')) {
          // Status code'a göre mesaj belirle
          if (errorDetails.includes('401') || errorMessage.includes('401')) {
            errorMessage = 'Mevcut şifre yanlış. Lütfen doğru şifreyi girin.';
          } else if (errorDetails.includes('403')) {
            errorMessage = 'Erişim yetkiniz yok.';
          } else if (errorDetails.includes('404')) {
            errorMessage = 'Admin bilgileri bulunamadı.';
          } else {
            errorMessage = 'Şifre değiştirme işlemi başarısız oldu. Lütfen tekrar deneyin.';
          }
        }
        
        Alert.alert('Hata', `${errorMessage}${errorDetails && !errorDetails.includes('401') && !errorDetails.includes('403') && !errorDetails.includes('404') ? '\n\n' + errorDetails : ''}`);
        return;
      }

      // Başarılı
      Alert.alert('Başarılı!', result.data?.message || 'Şifre başarıyla değiştirildi.');
      setShowChangePassword(false);
      setChangePasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      const errorMessage = error?.message || error?.toString() || 'Bilinmeyen hata';
      console.error('[ERROR] Şifre değiştirme hatası:', errorMessage);
      Alert.alert('Hata', `Şifre değiştirilirken bir hata oluştu: ${errorMessage}`);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = useCallback(async (skipConfirm = false) => {
    // Eğer zaten logout işlemi yapılıyorsa, tekrar çağrılmasını engelle
    if (isLoggingOut) {
      return;
    }

    const performLogout = async () => {
      try {
        // Logout flag'ini set et (sonsuz döngüyü önlemek için)
        setIsLoggingOut(true);
        // Önce session'ı temizle
        await AsyncStorage.removeItem('institutionAdminSession');
        
        // Navigation işlemini yap (setTimeout olmadan direkt)
        try {
          // Parent navigator'ı bul
          const parent = navigation.getParent();
          const rootNavigation = parent || navigation;
          
          // Navigation'ı reset et - Login ekranına git
          if (rootNavigation && rootNavigation.dispatch) {
            rootNavigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              })
            );
            // Navigation başarılı olduktan sonra flag'i temizle (ama biraz gecikmeyle)
            setTimeout(() => {
              setIsLoggingOut(false);
            }, 1000);
          } else if (navigation && navigation.navigate) {
            // Fallback: Basit navigate
            navigation.navigate('Login');
            setTimeout(() => {
              setIsLoggingOut(false);
            }, 1000);
          }
        } catch (navError) {
          console.error('Navigation hatası:', navError);
          // Son fallback: Basit navigate
          if (navigation && navigation.navigate) {
            navigation.navigate('Login');
          }
          setIsLoggingOut(false);
        }
      } catch (error) {
        console.error('Çıkış yapma hatası:', error);
        // Fallback: Basit navigate
        try {
          if (navigation && navigation.navigate) {
            navigation.navigate('Login');
          }
        } catch (navError) {
          console.error('Navigation hatası:', navError);
          Alert.alert('Hata', 'Çıkış yapılırken bir hata oluştu. Lütfen uygulamayı yeniden başlatın.');
        } finally {
          setIsLoggingOut(false);
        }
      }
    };

    if (!skipConfirm) {
      Alert.alert(
        'Çıkış Yap',
        'Kurum admin panelinden çıkmak istediğinize emin misiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Çıkış Yap',
            style: 'destructive',
            onPress: () => {
              // Alert callback içinde async fonksiyonu çağır
              performLogout();
            },
          },
        ]
      );
    } else {
      // Direkt çıkış (geri tuşu için)
      await performLogout();
    }
  }, [navigation, isLoggingOut]);

  if (loading && !institution) {
    return (
      <Container>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Kurum Yönetimi</Text>
            <Text style={styles.subtitle}>{institution?.name || 'Yükleniyor...'}</Text>
          </View>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => handleLogout(false)}
          >
            <Ionicons name="log-out-outline" size={24} color={colors.error} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* İstatistikler */}
          <View style={styles.statsContainer}>
            <Text style={styles.sectionTitle}>📊 Genel Bakış</Text>
            <View style={styles.statsGrid}>
              <Card style={styles.statCard}>
                <Ionicons name="people" size={32} color={colors.primary} />
                <Text style={styles.statNumber}>{stats.totalTeachers}</Text>
                <Text style={styles.statLabel}>Öğretmen</Text>
                <Text style={styles.statSubLabel}>
                  {institution ? `/${institution.max_teachers} limit` : ''}
                </Text>
              </Card>
              
              <Card style={styles.statCard}>
                <Ionicons name="school" size={32} color={colors.success} />
                <Text style={styles.statNumber}>{stats.totalStudents}</Text>
                <Text style={styles.statLabel}>Öğrenci</Text>
                <Text style={styles.statSubLabel}>
                  {institution ? `/${institution.max_students} limit` : ''}
                </Text>
              </Card>
            </View>
          </View>

          {/* Rehber Öğretmen */}
          {institution && (
            <View style={styles.institutionContainer}>
              <Text style={styles.sectionTitle}>👨‍🏫 Rehber Öğretmen</Text>
              <Card style={styles.guidanceTeacherCard}>
                {guidanceTeacher ? (
                  <View>
                    <View style={styles.guidanceTeacherHeader}>
                      <Ionicons name="school" size={24} color={colors.primary} />
                      <View style={styles.guidanceTeacherInfo}>
                        <Text style={styles.guidanceTeacherName}>
                          {guidanceTeacher.name || guidanceTeacher.email || 'Bilinmeyen Öğretmen'}
                        </Text>
                        {guidanceTeacher.email && guidanceTeacher.email !== guidanceTeacher.name && (
                          <Text style={styles.guidanceTeacherEmail}>{guidanceTeacher.email}</Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.guidanceTeacherDescription}>
                      Rehber öğretmen kurumundaki tüm öğrencilerin çalışmalarını görüntüleyebilir.
                    </Text>
                  </View>
                ) : (
                  <View>
                    <View style={styles.guidanceTeacherHeader}>
                      <Ionicons name="school-outline" size={24} color={colors.textSecondary} />
                      <Text style={styles.noGuidanceTeacherText}>
                        Henüz rehber öğretmen atanmamış
                      </Text>
                    </View>
                    <Text style={styles.guidanceTeacherDescription}>
                      Rehber öğretmen atamak için öğretmenler listesinden bir öğretmen seçin.
                    </Text>
                  </View>
                )}
              </Card>
            </View>
          )}

          {/* Kurum Bilgileri */}
          {institution && (
            <View style={styles.institutionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🏢 Kurum Bilgileri</Text>
                <TouchableOpacity
                  style={styles.changePasswordButton}
                  onPress={() => setShowChangePassword(true)}
                >
                  <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
                  <Text style={[styles.changePasswordButtonText, { color: colors.primary }]}>
                    Şifre Değiştir
                  </Text>
                </TouchableOpacity>
              </View>
              <Card style={styles.institutionCard}>
                <View style={styles.institutionHeader}>
                  <View style={styles.institutionInfo}>
                    <Text style={styles.institutionName}>{institution.name}</Text>
                    <Text style={styles.institutionType}>{institution.type}</Text>
                  </View>
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
                  </View>
                </View>
                {institution.contact_email && (
                  <View style={styles.contactInfo}>
                    <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.contactText}>{institution.contact_email}</Text>
                  </View>
                )}
                {institution.contact_phone && (
                  <View style={styles.contactInfo}>
                    <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.contactText}>{institution.contact_phone}</Text>
                  </View>
                )}
              </Card>
            </View>
          )}

          {/* Yönetim Menüleri */}
          <View style={styles.menuContainer}>
            <Text style={styles.sectionTitle}>⚙️ Yönetim</Text>
            
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowAddTeacher(true);
              }}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="person-add" size={24} color={colors.primary} />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Öğretmen Ekle</Text>
                  <Text style={styles.menuItemSubtitle}>Yeni öğretmen ekle</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowAddStudent(true);
              }}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="school" size={24} color={colors.success} />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Öğrenci Ekle</Text>
                  <Text style={styles.menuItemSubtitle}>Yeni öğrenci ekle</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowTeacherList(true);
                loadTeachers();
              }}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="people" size={24} color={colors.warning} />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Öğretmenler</Text>
                  <Text style={styles.menuItemSubtitle}>{stats.totalTeachers} öğretmen listesi</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowStudentList(true);
                loadStudents();
              }}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="school" size={24} color={colors.info} />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Öğrenciler</Text>
                  <Text style={styles.menuItemSubtitle}>{stats.totalStudents} öğrenci listesi</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Öğretmen Ekleme Modal */}
        <Modal
          visible={showAddTeacher}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddTeacher(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>👨‍🏫 Öğretmen Ekle</Text>
                <TouchableOpacity
                  onPress={() => setShowAddTeacher(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                <Input
                  label="Ad"
                  value={teacherForm.firstName}
                  onChangeText={(text) => setTeacherForm({...teacherForm, firstName: text})}
                  placeholder="Öğretmen adı"
                />
                <Input
                  label="Soyad"
                  value={teacherForm.lastName}
                  onChangeText={(text) => setTeacherForm({...teacherForm, lastName: text})}
                  placeholder="Öğretmen soyadı"
                />
                <Input
                  label="E-posta"
                  value={teacherForm.email}
                  onChangeText={(text) => setTeacherForm({...teacherForm, email: text})}
                  placeholder="Öğretmen e-postası"
                  keyboardType="email-address"
                />
                <Input
                  label="Branş"
                  value={teacherForm.branch}
                  onChangeText={(text) => setTeacherForm({...teacherForm, branch: text})}
                  placeholder="Öğretmen branşı"
                />
                <Input
                  label="Telefon"
                  value={teacherForm.phone}
                  onChangeText={(text) => setTeacherForm({...teacherForm, phone: text})}
                  placeholder="Öğretmen telefonu"
                />
                <Input
                  label="Deneyim"
                  value={teacherForm.experience}
                  onChangeText={(text) => setTeacherForm({...teacherForm, experience: text})}
                  placeholder="Öğretmen deneyimi"
                />
                <Input
                  label="Eğitim"
                  value={teacherForm.education}
                  onChangeText={(text) => setTeacherForm({...teacherForm, education: text})}
                  placeholder="Öğretmen eğitimi"
                />
                <Input
                  label="Adres"
                  value={teacherForm.address}
                  onChangeText={(text) => setTeacherForm({...teacherForm, address: text})}
                  placeholder="Öğretmen adresi"
                  multiline
                />
                <Input
                  label="Notlar"
                  value={teacherForm.notes}
                  onChangeText={(text) => setTeacherForm({...teacherForm, notes: text})}
                  placeholder="Ek notlar"
                  multiline
                />
              </ScrollView>
              <View style={[styles.modalButtons, { padding: 20, paddingTop: 0 }]}>
                <Button
                  title="İptal"
                  onPress={() => setShowAddTeacher(false)}
                  variant="ghost"
                  style={styles.modalButton}
                />
                <Button
                  title="Öğretmen Ekle"
                  onPress={addTeacher}
                  loading={teacherLoading}
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Öğrenci Ekleme Modal */}
        <Modal
          visible={showAddStudent}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddStudent(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🎓 Öğrenci Ekle</Text>
                <TouchableOpacity
                  onPress={() => setShowAddStudent(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                <Input
                  label="Ad"
                  value={studentForm.firstName}
                  onChangeText={(text) => setStudentForm({...studentForm, firstName: text})}
                  placeholder="Öğrenci adı"
                />
                <Input
                  label="Soyad"
                  value={studentForm.lastName}
                  onChangeText={(text) => setStudentForm({...studentForm, lastName: text})}
                  placeholder="Öğrenci soyadı"
                />
                <Input
                  label="E-posta"
                  value={studentForm.email}
                  onChangeText={(text) => setStudentForm({...studentForm, email: text})}
                  placeholder="Öğrenci e-postası"
                  keyboardType="email-address"
                />
                <Input
                  label="Sınıf"
                  value={studentForm.grade}
                  onChangeText={(text) => setStudentForm({...studentForm, grade: text})}
                  placeholder="Öğrenci sınıfı"
                />
                <Input
                  label="Telefon"
                  value={studentForm.phone}
                  onChangeText={(text) => setStudentForm({...studentForm, phone: text})}
                  placeholder="Öğrenci telefonu"
                />
                <Input
                  label="Veli Adı"
                  value={studentForm.parentName}
                  onChangeText={(text) => setStudentForm({...studentForm, parentName: text})}
                  placeholder="Veli adı"
                />
                <Input
                  label="Veli Telefonu"
                  value={studentForm.parentPhone}
                  onChangeText={(text) => setStudentForm({...studentForm, parentPhone: text})}
                  placeholder="Veli telefonu"
                />
                <Input
                  label="Adres"
                  value={studentForm.address}
                  onChangeText={(text) => setStudentForm({...studentForm, address: text})}
                  placeholder="Öğrenci adresi"
                  multiline
                />
                <Input
                  label="Notlar"
                  value={studentForm.notes}
                  onChangeText={(text) => setStudentForm({...studentForm, notes: text})}
                  placeholder="Ek notlar"
                  multiline
                />
              </ScrollView>
              <View style={[styles.modalButtons, { padding: 20, paddingTop: 0 }]}>
                <Button
                  title="İptal"
                  onPress={() => setShowAddStudent(false)}
                  variant="ghost"
                  style={styles.modalButton}
                />
                <Button
                  title="Öğrenci Ekle"
                  onPress={addStudent}
                  loading={studentLoading}
                  style={[styles.modalButton, { backgroundColor: colors.success }]}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Öğretmen Listesi Modal */}
        <Modal
          visible={showTeacherList}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowTeacherList(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>👨‍🏫 Öğretmenler ({teachers.length})</Text>
                <TouchableOpacity
                  onPress={() => setShowTeacherList(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              {loadingTeachers ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Yükleniyor...</Text>
                </View>
              ) : teachers.length > 0 ? (
                <FlatList
                  data={teachers}
                  renderItem={renderTeacherCard}
                  keyExtractor={(item) => item.user_id}
                  style={styles.userList}
                  contentContainerStyle={{ padding: 16 }}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>Öğretmen bulunamadı</Text>
                  }
                />
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Henüz öğretmen eklenmemiş</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Öğrenci Listesi Modal */}
        <Modal
          visible={showStudentList}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowStudentList(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🎓 Öğrenciler ({students.length})</Text>
                <TouchableOpacity
                  onPress={() => setShowStudentList(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              {loadingStudents ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Yükleniyor...</Text>
                </View>
              ) : students.length > 0 ? (
                <FlatList
                  data={students}
                  renderItem={renderStudentCard}
                  keyExtractor={(item) => item.user_id}
                  style={styles.userList}
                  contentContainerStyle={{ padding: 16 }}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>Öğrenci bulunamadı</Text>
                  }
                />
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Henüz öğrenci eklenmemiş</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Kullanıcı Düzenleme Modal */}
        <Modal
          visible={showEditUser}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowEditUser(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>✏️ Kullanıcı Düzenle</Text>
                <TouchableOpacity
                  onPress={() => setShowEditUser(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                <Input
                  label="Ad"
                  value={editUserForm.firstName}
                  onChangeText={(text) => setEditUserForm({...editUserForm, firstName: text})}
                  placeholder="Ad"
                />
                <Input
                  label="Soyad"
                  value={editUserForm.lastName}
                  onChangeText={(text) => setEditUserForm({...editUserForm, lastName: text})}
                  placeholder="Soyad"
                />
                <Input
                  label="E-posta"
                  value={editUserForm.email}
                  onChangeText={(text) => setEditUserForm({...editUserForm, email: text})}
                  placeholder="E-posta"
                  keyboardType="email-address"
                />
                {selectedUser?.branch && (
                  <Input
                    label="Branş"
                    value={editUserForm.branch}
                    onChangeText={(text) => setEditUserForm({...editUserForm, branch: text})}
                    placeholder="Branş"
                  />
                )}
                {selectedUser?.grade !== undefined && !selectedUser?.branch && (
                  <Input
                    label="Sınıf"
                    value={editUserForm.grade}
                    onChangeText={(text) => setEditUserForm({...editUserForm, grade: text})}
                    placeholder="Sınıf"
                  />
                )}
                <Input
                  label="Telefon"
                  value={editUserForm.phone}
                  onChangeText={(text) => setEditUserForm({...editUserForm, phone: text})}
                  placeholder="Telefon"
                />
              </ScrollView>
              <View style={[styles.modalButtons, { padding: 20, paddingTop: 0 }]}>
                <Button
                  title="İptal"
                  onPress={() => setShowEditUser(false)}
                  variant="ghost"
                  style={styles.modalButton}
                />
                <Button
                  title="Güncelle"
                  onPress={updateUser}
                  loading={editUserLoading}
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Şifre Değiştirme Modal */}
        <Modal
          visible={showChangePassword}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowChangePassword(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🔒 Şifre Değiştir</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowChangePassword(false);
                    setChangePasswordForm({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                  }}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                <Input
                  label="Mevcut Şifre"
                  value={changePasswordForm.currentPassword}
                  onChangeText={(text) => setChangePasswordForm({...changePasswordForm, currentPassword: text})}
                  placeholder="Mevcut şifrenizi girin"
                  secureTextEntry
                />
                <Input
                  label="Yeni Şifre"
                  value={changePasswordForm.newPassword}
                  onChangeText={(text) => setChangePasswordForm({...changePasswordForm, newPassword: text})}
                  placeholder="Yeni şifrenizi girin (min 6 karakter)"
                  secureTextEntry
                />
                <Input
                  label="Yeni Şifre (Tekrar)"
                  value={changePasswordForm.confirmPassword}
                  onChangeText={(text) => setChangePasswordForm({...changePasswordForm, confirmPassword: text})}
                  placeholder="Yeni şifrenizi tekrar girin"
                  secureTextEntry
                />
              </ScrollView>
              <View style={[styles.modalButtons, { padding: 20, paddingTop: 0 }]}>
                <Button
                  title="İptal"
                  onPress={() => {
                    setShowChangePassword(false);
                    setChangePasswordForm({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                  }}
                  variant="ghost"
                  style={styles.modalButton}
                />
                <Button
                  title="Değiştir"
                  onPress={handleChangePassword}
                  loading={changingPassword}
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                />
              </View>
            </View>
          </View>
        </Modal>

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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  changePasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  changePasswordButtonText: {
    fontSize: 14,
    fontWeight: '500',
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
  guidanceTeacherCard: {
    marginBottom: 12,
    padding: 16,
  },
  guidanceTeacherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  guidanceTeacherInfo: {
    flex: 1,
    marginLeft: 12,
  },
  guidanceTeacherName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  guidanceTeacherEmail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  guidanceTeacherDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 8,
  },
  noGuidanceTeacherText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
    marginLeft: 12,
  },
  guidanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  guidanceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  institutionCard: {
    marginBottom: 12,
    padding: 16,
  },
  institutionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  institutionInfo: {
    flex: 1,
  },
  institutionName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  institutionType: {
    fontSize: 14,
    color: colors.textSecondary,
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
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  contactText: {
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
    backgroundColor: colors.backgroundSecondary || colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    ...SHADOWS.small,
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
  placeholder: {
    width: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    padding: 0,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalScrollView: {
    maxHeight: 500,
    padding: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 0.48,
  },
  userList: {
    maxHeight: 400,
  },
  userCard: {
    marginBottom: 8,
    padding: 12,
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userCardInfo: {
    flex: 1,
  },
  userCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  userCardBranch: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  userCardEmail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default InstitutionAdminScreen;
