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
import { supabase, supabaseAdmin } from '../lib/supabase';

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
          if (institutionData.guidance_teacher_id) {
            await loadGuidanceTeacher(institutionData.guidance_teacher_id);
          } else {
            setGuidanceTeacher(null);
          }
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
  const loadGuidanceTeacher = async (teacherId) => {
    if (!teacherId) {
      setGuidanceTeacher(null);
      return;
    }

    try {
      // Önce teachers tablosundan öğretmen bilgisini al
      const { data: teacherData, error: teacherError } = await supabaseAdmin
        .from('teachers')
        .select('id, user_id, name, email')
        .eq('id', teacherId)
        .maybeSingle();

      if (teacherError) {
        console.error('Teachers query error:', teacherError);
      }

      if (!teacherData) {
        // Eğer teachers tablosunda yoksa, user_profiles'den kontrol et
        const { data: institutionData } = await supabaseAdmin
          .from('institutions')
          .select('guidance_teacher_id')
          .eq('guidance_teacher_id', teacherId)
          .single();
        
        if (institutionData?.guidance_teacher_id) {
          // teacher_id ile user_profiles'den bilgi al
          // Ancak teacher_id direkt user_profiles'e bağlı değil, teachers tablosu üzerinden
        }
        
        setGuidanceTeacher(null);
        return;
      }

      // user_profiles'den isim ve email bilgisini al (eğer teachers'da yoksa)
      let teacherName = teacherData.name;
      let teacherEmail = teacherData.email;

      if (!teacherName || !teacherEmail) {
        const { data: userProfile, error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .select('name, email')
          .eq('user_id', teacherData.user_id)
          .maybeSingle();

        if (!profileError && userProfile) {
          teacherName = teacherName || userProfile.name || 'Bilinmeyen Öğretmen';
          teacherEmail = teacherEmail || userProfile.email || '';
        }
      }

      const guidanceTeacherData = {
        id: teacherData.id,
        user_id: teacherData.user_id,
        name: teacherName || 'Bilinmeyen Öğretmen',
        email: teacherEmail || '',
      };

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
      const { data, error } = await supabaseAdmin
        .from('institutions')
        .update({ guidance_teacher_id: teacherId })
        .eq('id', institutionId)
        .select()
        .single();

      if (error) {
        console.error('Rehber öğretmen atama hatası (update):', error);
        throw error;
      }

      // Institution state'ini güncelle
      if (data) {
        setInstitution(prev => ({ ...prev, guidance_teacher_id: teacherId }));
      }

      // Rehber öğretmen bilgisini yenile
      if (teacherId) {
        await loadGuidanceTeacher(teacherId);
        
        // Biraz bekle ve tekrar kontrol et (state güncellenmesi için)
        setTimeout(async () => {
          await loadGuidanceTeacher(teacherId);
        }, 500);
      } else {
        setGuidanceTeacher(null);
      }

      // Institution state'ini güncelle (guidance_teacher_id'yi içerir)
      const { data: updatedInstitution } = await supabaseAdmin
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
          const studentData = await Promise.all(
            userProfiles.map(async (profile) => {
              const { data: studentInfo, error: studentError } = await supabase
                .from('students')
                .select('school, grade, phone, parent_name, parent_phone, address, notes')
                .eq('user_id', profile.user_id)
                .single();

              if (studentError) {
                console.error('loadStudents: studentInfo error for user_id:', profile.user_id, studentError);
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
            })
          );

          setStudents(studentData.sort((a, b) => a.name.localeCompare(b.name)));
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

  const addTeacher = async () => {
    // Form validasyonu
    if (!teacherForm.firstName || !teacherForm.lastName || !teacherForm.email || !teacherForm.branch) {
      Alert.alert('Hata', 'Ad, soyad, e-posta ve branş alanları zorunludur!');
      return;
    }

    // Kurum limit kontrolü
    try {
      if (institution) {
        const { data: memberships } = await supabase
          .from('institution_memberships')
          .select('user_id')
          .eq('institution_id', institution.id);

        if (memberships) {
          const userIds = memberships.map(m => m.user_id);
          const { data: userProfiles } = await supabase
            .from('user_profiles')
            .select('user_type')
            .in('user_id', userIds);

          const currentTeacherCount = userProfiles?.filter(p => p.user_type === 'teacher').length || 0;

          if (currentTeacherCount >= institution.max_teachers) {
            Alert.alert(
              'Limit Aşıldı!',
              `${institution.name} kurumunda öğretmen limiti (${institution.max_teachers}) aşıldı.\n\nMevcut: ${currentTeacherCount}/${institution.max_teachers}\n\nDaha fazla öğretmen eklemek için geliştirici ile iletişime geçin.`,
              [{ text: 'Tamam' }]
            );
            return;
          }
        }
      }
    } catch (error) {
      console.error('Limit kontrolü hatası:', error);
    }

    setTeacherLoading(true);
    try {
      // Önce bu e-postayla bir kullanıcı var mı kontrol et
      let targetUserId = null;
      
      // E-posta ile mevcut kullanıcıyı bul
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('user_id, email')
        .eq('email', teacherForm.email.toLowerCase().trim())
        .maybeSingle();

      let newUser = null;
      if (existingProfile) {
        // Kullanıcı zaten var - mevcut kullanıcıyı kullan
        targetUserId = existingProfile.user_id;
        
        // Bu kullanıcının başka kurumlarda aktif üyeliği var mı kontrol et
        const { data: existingMemberships } = await supabase
          .from('institution_memberships')
          .select('institution_id, is_active, institutions(name)')
          .eq('user_id', targetUserId)
          .eq('is_active', true);

          if (existingMemberships && existingMemberships.length > 0) {
          const otherInstitutions = existingMemberships
            .map(m => m.institutions?.name || 'Bilinmeyen Kurum')
            .join(', ');

          if (otherInstitutions) {
            Alert.alert(
              'Dikkat!',
              `Bu öğretmen zaten "${otherInstitutions}" kurum(lar)ında aktif üyeliğe sahip.\n\nBu öğretmeni bu kuruma eklemek için önceki kurum üyelikleri pasif edilecek. Devam etmek istiyor musunuz?`,
              [
                { text: 'İptal', style: 'cancel', onPress: () => {
                  setTeacherLoading(false);
                  return;
                }},
                {
                  text: 'Devam Et',
                  onPress: async () => {
                    try {
                      // Eski aktif üyelikleri pasif et
                      await supabaseAdmin
                        .from('institution_memberships')
                        .update({ is_active: false })
                        .eq('user_id', targetUserId)
                        .neq('institution_id', currentInstitutionId);
                      
                      // user_profiles tablosunda institution_id güncelle
                      const { error: profileUpdateError } = await supabaseAdmin
                        .from('user_profiles')
                        .update({ institution_id: currentInstitutionId })
                        .eq('user_id', targetUserId);

                      if (profileUpdateError) {
                        console.error('Alert callback: user_profiles institution_id güncelleme hatası:', profileUpdateError);
                        // Kritik değil, devam et
                      }
                      
                      // Teachers tablosunda kayıt var mı kontrol et
                      const { data: existingTeacher } = await supabaseAdmin
                        .from('teachers')
                        .select('id')
                        .eq('user_id', targetUserId)
                        .maybeSingle();

                      if (!existingTeacher) {
                        // Teachers tablosunda kayıt yoksa oluştur
                        const { data: insertedTeacher, error: teacherError } = await supabaseAdmin
                          .from('teachers')
                          .insert({
                            user_id: targetUserId,
                            branch: teacherForm.branch,
                            phone: teacherForm.phone,
                            experience: teacherForm.experience,
                            education: teacherForm.education,
                            address: teacherForm.address,
                            notes: teacherForm.notes,
                            institution_id: currentInstitutionId
                          })
                          .select()
                          .single();

                        if (teacherError) {
                          console.error('Alert callback: teachers insert hatası:', teacherError);
                          throw new Error(`Öğretmen kaydı oluşturulamadı: ${teacherError.message}`);
                        }

                        if (!insertedTeacher) {
                          throw new Error('Öğretmen kaydı oluşturulamadı');
                        }

                      } else {
                        // Varsa güncelle
                        const { error: updateError } = await supabaseAdmin
                          .from('teachers')
                          .update({
                            branch: teacherForm.branch,
                            phone: teacherForm.phone,
                            experience: teacherForm.experience,
                            education: teacherForm.education,
                            address: teacherForm.address,
                            notes: teacherForm.notes,
                            institution_id: currentInstitutionId
                          })
                          .eq('id', existingTeacher.id);

                        if (updateError) {
                          console.error('Alert callback: teachers update hatası:', updateError);
                          throw new Error(`Öğretmen kaydı güncellenemedi: ${updateError.message}`);
                        }
                      }
                      
                      // Yeni kurum üyeliğini oluştur
                      await createTeacherMembership(targetUserId);

                      Alert.alert('Başarılı!', 'Öğretmen başarıyla eklendi. Önceki kurum üyelikleri pasif edildi.');
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
                      // Kısa bir gecikme ekle - veritabanı sync'i için
                      setTimeout(async () => {
                        await loadTeachers();
                        await loadStatsData(institution.id || institution.institution_id);
                      }, 500);
                    } catch (error) {
                      console.error('Öğretmen ekleme hatası:', error);
                      Alert.alert('Hata', 'Öğretmen eklenirken bir hata oluştu.');
                    } finally {
                      setTeacherLoading(false);
                    }
                  }
                }
              ]
            );
            return; // Alert callback'inde devam edilecek
          }
        }
        
        // Eğer bu kurumda pasif üyelik varsa, onu aktif et ve güncelle
        if (currentInstitutionMembership) {
          // Pasif üyeliği aktif et
          const { error: activateError } = await supabaseAdmin
            .from('institution_memberships')
            .update({ 
              is_active: true,
              joined_at: new Date().toISOString()
            })
            .eq('id', currentInstitutionMembership.id);

          if (activateError) {
            console.error('Pasif üyelik aktif edilirken hata:', activateError);
            throw activateError;
          }

        }
        
        // Mevcut kullanıcı için user_profiles tablosunu güncelle (institution_id ekle)
        // currentInstitutionId yukarıda tanımlandı

        // user_profiles tablosunda institution_id güncelle
        const { error: profileUpdateError } = await supabaseAdmin
          .from('user_profiles')
          .update({ institution_id: currentInstitutionId })
          .eq('user_id', targetUserId);

        if (profileUpdateError) {
          console.error('user_profiles institution_id güncelleme hatası:', profileUpdateError);
          // Kritik değil, devam et
        }

        // Mevcut kullanıcı için teachers tablosunda kayıt var mı kontrol et
        const { data: existingTeacher } = await supabaseAdmin
          .from('teachers')
          .select('id')
          .eq('user_id', targetUserId)
          .maybeSingle();

        if (!existingTeacher) {
          // Teachers tablosunda kayıt yoksa oluştur
          const { data: insertedTeacher, error: teacherError } = await supabaseAdmin
            .from('teachers')
            .insert({
              user_id: targetUserId,
              branch: teacherForm.branch,
              phone: teacherForm.phone,
              experience: teacherForm.experience,
              education: teacherForm.education,
              address: teacherForm.address,
              notes: teacherForm.notes,
              institution_id: currentInstitutionId
            })
            .select()
            .single();

          if (teacherError) {
            console.error('Mevcut kullanıcı için teachers insert hatası:', teacherError);
            throw new Error(`Öğretmen kaydı oluşturulamadı: ${teacherError.message}`);
          }

          if (!insertedTeacher) {
            throw new Error('Öğretmen kaydı oluşturulamadı');
          }

        } else {
          // Varsa güncelle
          const { error: updateError } = await supabaseAdmin
            .from('teachers')
            .update({
              branch: teacherForm.branch,
              phone: teacherForm.phone,
              experience: teacherForm.experience,
              education: teacherForm.education,
              address: teacherForm.address,
              notes: teacherForm.notes,
              institution_id: currentInstitutionId
            })
            .eq('id', existingTeacher.id);

          if (updateError) {
            console.error('Mevcut kullanıcı için teachers update hatası:', updateError);
            throw new Error(`Öğretmen kaydı güncellenemedi: ${updateError.message}`);
          }
        }
        
        // Başka kurumda aktif üyelik yoksa ve bu kurumda pasif üyelik de yoksa yeni üyelik oluştur
        if (!currentInstitutionMembership) {
          await createTeacherMembership(targetUserId);
        }
        
        Alert.alert('Başarılı!', 'Öğretmen başarıyla eklendi.');
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
        // Kısa bir gecikme ekle - veritabanı sync'i için
        setTimeout(async () => {
          await loadTeachers();
          await loadStatsData(institution.id || institution.institution_id);
        }, 500);
      } else {
        // Yeni kullanıcı oluştur
        const { data: createdUser, error: authError } = await supabase.auth.signUp({
          email: teacherForm.email,
          password: 'teacher123',
          options: {
            data: {
              first_name: teacherForm.firstName,
              last_name: teacherForm.lastName,
              user_type: 'teacher',
              branch: teacherForm.branch,
              phone: teacherForm.phone,
              experience: teacherForm.experience,
              education: teacherForm.education,
              address: teacherForm.address,
              notes: teacherForm.notes
            }
          }
        });

        if (authError) throw authError;
        newUser = createdUser;
        targetUserId = createdUser.user.id;

        // User profile oluştur veya güncelle
        let institutionId = institution?.id || institution?.institution_id;
        if (!institutionId) {
          const sessionData = await AsyncStorage.getItem('institutionAdminSession');
          if (sessionData) {
            const session = JSON.parse(sessionData);
            institutionId = session.institutionId;
          }
        }

        const { data: existingProfile } = await supabaseAdmin
          .from('user_profiles')
          .select('user_id')
          .eq('user_id', targetUserId)
          .maybeSingle();

        if (!existingProfile) {
          // Yeni profile oluştur
          const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert({
              user_id: targetUserId,
              name: `${teacherForm.firstName} ${teacherForm.lastName}`,
              user_type: 'teacher',
              email: teacherForm.email,
              institution_id: institutionId
            });

          if (profileError) throw profileError;
        } else {
          // Mevcut profile'ı güncelle
          const { error: updateError } = await supabaseAdmin
            .from('user_profiles')
            .update({
              name: `${teacherForm.firstName} ${teacherForm.lastName}`,
              email: teacherForm.email,
              institution_id: institutionId
            })
            .eq('user_id', targetUserId);

          if (updateError) throw updateError;
        }

        // Teacher bilgilerini kaydet - önce varsa kontrol et
        const { data: existingTeacher } = await supabaseAdmin
          .from('teachers')
          .select('id')
          .eq('user_id', targetUserId)
          .maybeSingle();

        if (!existingTeacher) {
          // Öğretmen kodu oluştur (benzersiz)
          const teacherCode = `T${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          const teacherName = `${teacherForm.firstName} ${teacherForm.lastName}`.trim();
          
          const { data: insertedTeacher, error: teacherError } = await supabaseAdmin
            .from('teachers')
            .insert({
              user_id: targetUserId,
              name: teacherName, // Zorunlu alan
              email: teacherForm.email, // Zorunlu olabilir
              branch: teacherForm.branch,
              phone: teacherForm.phone,
              experience: teacherForm.experience,
              education: teacherForm.education,
              address: teacherForm.address,
              notes: teacherForm.notes,
              institution_id: institutionId,
              teacher_code: teacherCode // Zorunlu alan
            })
            .select()
            .single();

          if (teacherError) {
            console.error('Teachers insert hatası:', teacherError);
            throw new Error(`Öğretmen kaydı oluşturulamadı: ${teacherError.message}`);
          }

          if (!insertedTeacher) {
            throw new Error('Öğretmen kaydı oluşturulamadı: Kayıt oluşturuldu ama geri döndürülemedi');
          }

        } else {
          // Zaten varsa güncelle
          const teacherName = `${teacherForm.firstName} ${teacherForm.lastName}`.trim();
          const { error: updateError } = await supabaseAdmin
            .from('teachers')
            .update({
              name: teacherName, // Zorunlu alan
              email: teacherForm.email,
              branch: teacherForm.branch,
              phone: teacherForm.phone,
              experience: teacherForm.experience,
              education: teacherForm.education,
              address: teacherForm.address,
              notes: teacherForm.notes,
              institution_id: institutionId
            })
            .eq('id', existingTeacher.id);

          if (updateError) {
            console.error('Teachers update hatası:', updateError);
            throw new Error(`Öğretmen kaydı güncellenemedi: ${updateError.message}`);
          }
        }

        // Kurum üyeliği oluştur
        await createTeacherMembership(targetUserId);

        Alert.alert('Başarılı!', 'Öğretmen başarıyla eklendi.');
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
        // Kısa bir gecikme ekle - veritabanı sync'i için
        setTimeout(async () => {
          await loadTeachers();
          await loadStatsData(institution.id || institution.institution_id);
        }, 500);
      }
    } catch (error) {
      console.error('Öğretmen ekleme hatası:', error);
      Alert.alert('Hata', 'Öğretmen eklenirken bir hata oluştu.');
    } finally {
      setTeacherLoading(false);
    }
  };

  // Öğretmen kurum üyeliği oluşturma fonksiyonu
  const createTeacherMembership = async (userId) => {
    let institutionId = institution?.id || institution?.institution_id;
    
    if (!institutionId) {
      // Institution henüz yüklenmemişse session'dan al
      const sessionData = await AsyncStorage.getItem('institutionAdminSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        institutionId = session.institutionId;
      }
    }
    
    if (!institutionId) {
      throw new Error('Kurum bilgisi bulunamadı');
    }

    // Önce bu kurumda zaten üyelik var mı kontrol et
    const { data: existingMembership } = await supabaseAdmin
      .from('institution_memberships')
      .select('id')
      .eq('user_id', userId)
      .eq('institution_id', institutionId)
      .maybeSingle();

    if (existingMembership) {
      // Zaten üyelik varsa aktif et
      const { error: updateError } = await supabaseAdmin
        .from('institution_memberships')
        .update({ is_active: true, joined_at: new Date().toISOString() })
        .eq('id', existingMembership.id);
      
      if (updateError) throw updateError;
    } else {
      // Yeni üyelik oluştur
      const { error: membershipError } = await supabaseAdmin
        .from('institution_memberships')
        .insert({
          user_id: userId,
          institution_id: institutionId,
          role: 'teacher',
          joined_at: new Date().toISOString()
        });

      if (membershipError) throw membershipError;
    }
  };

  // Öğrenci kurum üyeliği oluşturma fonksiyonu
  const createStudentMembership = async (userId) => {
    // Önce bu kurumda zaten üyelik var mı kontrol et
    const { data: existingMembership } = await supabaseAdmin
      .from('institution_memberships')
      .select('id')
      .eq('user_id', userId)
      .eq('institution_id', institution.id)
      .maybeSingle();

    if (existingMembership) {
      // Zaten üyelik varsa aktif et
      const { error: updateError } = await supabaseAdmin
        .from('institution_memberships')
        .update({ is_active: true, joined_at: new Date().toISOString() })
        .eq('id', existingMembership.id);
      
      if (updateError) throw updateError;
    } else {
      // Yeni üyelik oluştur
      const { error: membershipError } = await supabaseAdmin
        .from('institution_memberships')
        .insert({
          user_id: userId,
          institution_id: institution.id,
          role: 'student',
          joined_at: new Date().toISOString()
        });

      if (membershipError) throw membershipError;
    }
  };

  const addStudent = async () => {
    // Form validasyonu
    if (!studentForm.firstName || !studentForm.lastName || !studentForm.email) {
      Alert.alert('Hata', 'Ad, soyad ve e-posta alanları zorunludur!');
      return;
    }

    // Kurum limit kontrolü
    try {
      if (institution) {
        const { data: memberships } = await supabase
          .from('institution_memberships')
          .select('user_id')
          .eq('institution_id', institution.id);

        if (memberships) {
          const userIds = memberships.map(m => m.user_id);
          const { data: userProfiles } = await supabase
            .from('user_profiles')
            .select('user_type')
            .in('user_id', userIds);

          const currentStudentCount = userProfiles?.filter(p => p.user_type === 'student').length || 0;

          if (currentStudentCount >= institution.max_students) {
            Alert.alert(
              'Limit Aşıldı!',
              `${institution.name} kurumunda öğrenci limiti (${institution.max_students}) aşıldı.\n\nMevcut: ${currentStudentCount}/${institution.max_students}\n\nDaha fazla öğrenci eklemek için geliştirici ile iletişime geçin.`,
              [{ text: 'Tamam' }]
            );
            return;
          }
        }
      }
    } catch (error) {
      console.error('Limit kontrolü hatası:', error);
    }

    setStudentLoading(true);
    try {
      // Önce bu e-postayla bir kullanıcı var mı kontrol et
      let targetUserId = null;
      
      // E-posta ile mevcut kullanıcıyı bul
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('user_id, email')
        .eq('email', studentForm.email.toLowerCase().trim())
        .maybeSingle();

      let newUser = null;
      if (existingProfile) {
        // Kullanıcı zaten var - mevcut kullanıcıyı kullan
        targetUserId = existingProfile.user_id;
        
        // Bu kullanıcının başka kurumlarda aktif üyeliği var mı kontrol et
        const { data: existingMemberships } = await supabase
          .from('institution_memberships')
          .select('institution_id, is_active, institutions(name)')
          .eq('user_id', targetUserId)
          .eq('is_active', true);

        if (existingMemberships && existingMemberships.length > 0) {
          const otherInstitutions = existingMemberships
            .filter(m => m.institution_id !== institution.id)
            .map(m => m.institutions?.name || 'Bilinmeyen Kurum')
            .join(', ');

          if (otherInstitutions) {
            Alert.alert(
              'Dikkat!',
              `Bu öğrenci zaten "${otherInstitutions}" kurum(lar)ında aktif üyeliğe sahip.\n\nBu öğrenciyi bu kuruma eklemek için önceki kurum üyelikleri pasif edilecek. Devam etmek istiyor musunuz?`,
              [
                { text: 'İptal', style: 'cancel', onPress: () => {
                  setStudentLoading(false);
                  return;
                }},
                {
                  text: 'Devam Et',
                  onPress: async () => {
                    try {
                      // Eski aktif üyelikleri pasif et
                      await supabase
                        .from('institution_memberships')
                        .update({ is_active: false })
                        .eq('user_id', targetUserId)
                        .neq('institution_id', institution.id);
                      
                      // Yeni kurum üyeliğini oluştur
                      await createStudentMembership(targetUserId);
                      
                      // Mevcut öğrencinin okul bilgisini güncelle (eğer students tablosunda kayıt varsa)
                      const studentName = `${studentForm.firstName} ${studentForm.lastName}`;
                      const { data: existingStudent } = await supabaseAdmin
                        .from('students')
                        .select('id')
                        .eq('user_id', targetUserId)
                        .maybeSingle();
                      
                      if (existingStudent) {
                        // Mevcut kayıt varsa okul bilgisini güncelle
                        await supabaseAdmin
                          .from('students')
                          .update({ 
                            name: studentName,
                            email: studentForm.email,
                            school: institution?.name || '',
                            grade: studentForm.grade || '',
                            phone: studentForm.phone || '',
                            parent_name: studentForm.parentName || '',
                            parent_phone: studentForm.parentPhone || '',
                            address: studentForm.address || '',
                            notes: studentForm.notes || ''
                          })
                          .eq('user_id', targetUserId);
                      } else {
                        // Kayıt yoksa oluştur
                        await supabaseAdmin
                          .from('students')
                          .insert({
                            user_id: targetUserId,
                            name: studentName,
                            email: studentForm.email,
                            school: institution?.name || '',
                            grade: studentForm.grade || '',
                            phone: studentForm.phone || '',
                            parent_name: studentForm.parentName || '',
                            parent_phone: studentForm.parentPhone || '',
                            address: studentForm.address || '',
                            notes: studentForm.notes || ''
                          });
                      }

                      Alert.alert('Başarılı!', 'Öğrenci başarıyla eklendi. Önceki kurum üyelikleri pasif edildi.');
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
                      await loadStudents();
                      await loadStatsData(institution.id || institution.institution_id);
                    } catch (error) {
                      console.error('Öğrenci ekleme hatası:', error);
                      Alert.alert('Hata', 'Öğrenci eklenirken bir hata oluştu.');
                    } finally {
                      setStudentLoading(false);
                    }
                  }
                }
              ]
            );
            return; // Alert callback'inde devam edilecek
          }
        }
        
        // Başka kurumda aktif üyelik yoksa direkt yeni üyelik oluştur
        await createStudentMembership(targetUserId);
        
        // Mevcut öğrencinin okul bilgisini güncelle (eğer students tablosunda kayıt varsa)
        const studentNameForUpdate = `${studentForm.firstName} ${studentForm.lastName}`;
        const { data: existingStudent } = await supabaseAdmin
          .from('students')
          .select('id')
          .eq('user_id', targetUserId)
          .maybeSingle();
        
        if (existingStudent) {
          // Mevcut kayıt varsa okul bilgisini güncelle
          await supabaseAdmin
            .from('students')
            .update({ 
              name: studentNameForUpdate,
              email: studentForm.email,
              school: institution?.name || '',
              grade: studentForm.grade || '',
              phone: studentForm.phone || '',
              parent_name: studentForm.parentName || '',
              parent_phone: studentForm.parentPhone || '',
              address: studentForm.address || '',
              notes: studentForm.notes || ''
            })
            .eq('user_id', targetUserId);
        } else {
          // Kayıt yoksa oluştur
          await supabaseAdmin
            .from('students')
            .insert({
              user_id: targetUserId,
              name: studentNameForUpdate,
              email: studentForm.email,
              school: institution?.name || '',
              grade: studentForm.grade || '',
              phone: studentForm.phone || '',
              parent_name: studentForm.parentName || '',
              parent_phone: studentForm.parentPhone || '',
              address: studentForm.address || '',
              notes: studentForm.notes || ''
            });
        }
        
        Alert.alert('Başarılı!', 'Öğrenci başarıyla eklendi.');
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
        await loadStudents();
        await loadStatsData(institution.id || institution.institution_id);
      } else {
        // Yeni kullanıcı oluştur
        const { data: createdUser, error: authError } = await supabase.auth.signUp({
          email: studentForm.email,
          password: 'student123',
          options: {
            data: {
              first_name: studentForm.firstName,
              last_name: studentForm.lastName,
              user_type: 'student',
              school: institution?.name || '',
              grade: studentForm.grade,
              phone: studentForm.phone,
              parent_name: studentForm.parentName,
              parent_phone: studentForm.parentPhone,
              address: studentForm.address,
              notes: studentForm.notes
            }
          }
        });

        if (authError) throw authError;
        newUser = createdUser;
        targetUserId = createdUser.user.id;

        // User profile oluştur veya güncelle (eğer varsa)
        const { data: existingProfile } = await supabaseAdmin
          .from('user_profiles')
          .select('user_id')
          .eq('user_id', targetUserId)
          .maybeSingle();

        if (existingProfile) {
          // Mevcut profil varsa güncelle
          const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .update({
              name: `${studentForm.firstName} ${studentForm.lastName}`,
              user_type: 'student',
              email: studentForm.email
            })
            .eq('user_id', targetUserId);
          
          if (profileError) throw profileError;
        } else {
          // Yeni profil oluştur
          const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert({
              user_id: targetUserId,
              name: `${studentForm.firstName} ${studentForm.lastName}`,
              user_type: 'student',
              email: studentForm.email
            });

          if (profileError) throw profileError;
        }

        // Student bilgilerini kaydet veya güncelle (eğer varsa)
        const { data: existingStudentRecord } = await supabaseAdmin
          .from('students')
          .select('id')
          .eq('user_id', targetUserId)
          .maybeSingle();

        const studentName = `${studentForm.firstName} ${studentForm.lastName}`;
        
        if (existingStudentRecord) {
          // Mevcut kayıt varsa güncelle
          const { error: studentError } = await supabaseAdmin
            .from('students')
            .update({
              name: studentName,
              email: studentForm.email,
              school: institution?.name || '',
              grade: studentForm.grade,
              phone: studentForm.phone,
              parent_name: studentForm.parentName,
              parent_phone: studentForm.parentPhone,
              address: studentForm.address,
              notes: studentForm.notes
            })
            .eq('user_id', targetUserId);
          
          if (studentError) throw studentError;
        } else {
          // Yeni kayıt oluştur
          const { error: studentError } = await supabaseAdmin
            .from('students')
            .insert({
              user_id: targetUserId,
              name: studentName,
              email: studentForm.email,
              school: institution?.name || '',
              grade: studentForm.grade,
              phone: studentForm.phone,
              parent_name: studentForm.parentName,
              parent_phone: studentForm.parentPhone,
              address: studentForm.address,
              notes: studentForm.notes
            });

          if (studentError) throw studentError;
        }

        // Kurum üyeliği oluştur
        await createStudentMembership(targetUserId);

        Alert.alert('Başarılı!', 'Öğrenci başarıyla eklendi.');
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
        await loadStudents();
        await loadStatsData(institution.id || institution.institution_id);
      }
    } catch (error) {
      console.error('Öğrenci ekleme hatası:', error);
      Alert.alert('Hata', 'Öğrenci eklenirken bir hata oluştu.');
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

    setEditUserLoading(true);
    try {
      const fullName = `${editUserForm.firstName} ${editUserForm.lastName}`;
      
      // User profiles tablosunu güncelle
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          name: fullName,
          email: editUserForm.email
        })
        .eq('user_id', selectedUser.user_id);

      if (profileError) {
        console.error('User profile güncelleme hatası:', profileError);
        throw profileError;
      }

      // Öğretmen mi öğrenci mi kontrol et
      if (selectedUser.branch) {
        // Öğretmen
        const { error: teacherError } = await supabase
          .from('teachers')
          .update({
            name: fullName,
            email: editUserForm.email,
            branch: editUserForm.branch,
            phone: editUserForm.phone
          })
          .eq('user_id', selectedUser.user_id);

        if (teacherError) {
          console.error('Öğretmen güncelleme hatası:', teacherError);
          throw teacherError;
        }
      } else {
        // Öğrenci
        const { error: studentError } = await supabase
          .from('students')
          .update({
            name: fullName,
            email: editUserForm.email,
            grade: editUserForm.grade,
            phone: editUserForm.phone
          })
          .eq('user_id', selectedUser.user_id);

        if (studentError) {
          console.error('Öğrenci güncelleme hatası:', studentError);
          throw studentError;
        }
      }

      Alert.alert('Başarılı!', 'Kullanıcı bilgileri güncellendi.');
      setShowEditUser(false);
      setSelectedUser(null);
      
      // Listeleri yenile
      if (selectedUser.branch) {
        await loadTeachers();
        await loadStatsData(institution?.id || institution?.institution_id);
      } else {
        await loadStudents();
        await loadStatsData(institution?.id || institution?.institution_id);
      }
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

    // Kullanıcının email'ini al
    let userEmail = user.email;
    if (!userEmail) {
      try {
        const { data: userProfile } = await supabaseAdmin
          .from('user_profiles')
          .select('email')
          .eq('user_id', userId)
          .single();
        
        userEmail = userProfile?.email || null;
        
        if (!userEmail) {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
          userEmail = authUser?.user?.email || 'Bilinmiyor';
        }
      } catch (error) {
        console.error('Email alınamadı:', error);
        userEmail = 'Bilinmiyor';
      }
    }

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
              // Admin client ile direkt şifre sıfırlama
              const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                password: 'user123'
              });

              if (updateError) {
                // Fallback: RPC fonksiyonu ile şifre sıfırlama
                const { data, error: rpcError } = await supabaseAdmin.rpc('reset_user_password_admin', {
                  target_user_id: userId,
                  new_password: 'user123'
                });

                if (rpcError) {
                  throw rpcError;
                }
              }

              Alert.alert(
                'Başarılı!', 
                `${user.name} kullanıcısının şifresi sıfırlandı.\n\nE-posta: ${userEmail}\nYeni şifre: user123\n\nBu şifreyi kullanıcıya iletin.`
              );
            } catch (error) {
              console.error('Şifre sıfırlama hatası:', error);
              Alert.alert('Hata', 'Şifre sıfırlanırken bir hata oluştu. Lütfen geliştirici ile iletişime geçin.');
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
              const institutionId = institution?.id || institution?.institution_id;

              const targetUserId = user?.user_id || user?.id;
              if (user.branch) {
                // Öğretmen: teacher satırını çöz ve ilişikleri kes
                const { data: teacherRow } = await supabaseAdmin
                  .from('teachers')
                  .select('id')
                  .eq('user_id', targetUserId)
                  .single();

                if (teacherRow?.id) {
                  await supabaseAdmin.from('student_teachers').delete().eq('teacher_id', teacherRow.id);
                }
                await supabaseAdmin.from('teachers').update({ institution_id: null }).eq('user_id', targetUserId);
              } else {
                // Öğrenci: ilişikleri kes, kurum ID'yi boşalt
                await supabaseAdmin.from('student_teachers').delete().eq('student_id', targetUserId);
                await supabaseAdmin.from('students').update({ institution_id: null }).eq('user_id', targetUserId);
              }

              // Kurum üyeliğini kaldır (sil) veya pasifleştir
              if (institutionId) {
                await supabaseAdmin
                  .from('institution_memberships')
                  .delete()
                  .match({ user_id: targetUserId, institution_id: institutionId });
              } else {
                await supabaseAdmin
                  .from('institution_memberships')
                  .delete()
                  .eq('user_id', targetUserId);
              }

              Alert.alert('Başarılı!', `${user.name} kurumdan kaldırıldı.`);
              
              // Listeleri yenile
              if (user.branch) {
                await loadTeachers();
              } else {
                await loadStudents();
              }
              
              // İstatistikleri güncelle
              await loadStatsData(institution?.id || institution?.institution_id);
            } catch (error) {
              console.error('Kullanıcı silme hatası:', error);
              Alert.alert('Hata', 'Kullanıcı silinirken bir hata oluştu.');
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
                              const { data, error } = await supabaseAdmin
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
                        <Text style={styles.guidanceTeacherName}>{guidanceTeacher.name}</Text>
                        {guidanceTeacher.email && (
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
              <Text style={styles.sectionTitle}>🏢 Kurum Bilgileri</Text>
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
