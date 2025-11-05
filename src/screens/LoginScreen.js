import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, TouchableOpacity, Modal, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { Container, Input, Button, InterstitialAd } from '../components';
import { COLORS, DARK_COLORS, SIZES } from '../constants/theme';
import { supabase } from '../lib/supabase';
// ⚠️ supabaseAdmin artık kullanılmıyor - Edge Functions kullanılmalı
import { useTheme } from '../contexts/ThemeContext';

export default function LoginScreen({ navigation: navigationProp }) {
  // useNavigation hook'u ile navigation context'ini al
  const navigationFromHook = useNavigation();
  const navigation = navigationProp || navigationFromHook;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAddInstitution, setShowAddInstitution] = useState(false);
  const [showInstitutionList, setShowInstitutionList] = useState(false);
  const [showContractManagement, setShowContractManagement] = useState(false);
  const [showContractUpdate, setShowContractUpdate] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [contractUpdateForm, setContractUpdateForm] = useState({
    contract_start_date: '',
    contract_end_date: '',
    payment_status: 'pending'
  });
  const [showInstitutionDetails, setShowInstitutionDetails] = useState(false);
  const [institutionTeachers, setInstitutionTeachers] = useState([]);
  const [institutionStudents, setInstitutionStudents] = useState([]);
  const [loadingInstitutionDetails, setLoadingInstitutionDetails] = useState(false);
  const [showMoveUserModal, setShowMoveUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [availableInstitutions, setAvailableInstitutions] = useState([]);
  const [loadingMoveUser, setLoadingMoveUser] = useState(false);
  const [showEditInstitution, setShowEditInstitution] = useState(false);
  const [editInstitutionForm, setEditInstitutionForm] = useState({
    name: '',
    type: 'school',
    contact_email: '',
    contact_phone: '',
    address: '',
    max_teachers: 50,
    max_students: 500,
    notes: '',
    admin_username: '',
    admin_password: ''
  });
  const [institutionLoading, setInstitutionLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('start'); // 'start' or 'end'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [institutions, setInstitutions] = useState([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [showInstitutionAdminLogin, setShowInstitutionAdminLogin] = useState(false);
  const [institutionAdminUsername, setInstitutionAdminUsername] = useState('');
  const [institutionAdminPassword, setInstitutionAdminPassword] = useState('');
  const [institutionAdminLoading, setInstitutionAdminLoading] = useState(false);
  const [showInstitutionAdminPanel, setShowInstitutionAdminPanel] = useState(false);
  const [showTeacherList, setShowTeacherList] = useState(false);
  const [showStudentList, setShowStudentList] = useState(false);
  const [loadingInstitutionTeachers, setLoadingInstitutionTeachers] = useState(false);
  const [loadingInstitutionStudents, setLoadingInstitutionStudents] = useState(false);
  const [showInstitutionAddTeacher, setShowInstitutionAddTeacher] = useState(false);
  const [showInstitutionAddStudent, setShowInstitutionAddStudent] = useState(false);
  const [teacherCount, setTeacherCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [showEditUser, setShowEditUser] = useState(false);
  const [editUserForm, setEditUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    branch: '',
    phone: '',
    grade: ''
  });
  const [editUserLoading, setEditUserLoading] = useState(false);


  // Admin stats yükleme fonksiyonları
  const loadAdminStats = async () => {
    setLoadingAdminStats(true);
    try {
      // Kurum istatistikleri
      const { data: institutions } = await supabase
        .from('institutions')
        .select('id, name, is_active, is_premium');

      const totalInstitutions = institutions?.length || 0;
      const activeInstitutions = institutions?.filter(inst => inst.is_active)?.length || 0;

      // Toplam öğretmen sayısı
      const { count: teachersCount } = await supabase
        .from('teachers')
        .select('*', { count: 'exact', head: true });

      // Toplam öğrenci sayısı
      const { count: studentsCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      // Bireysel kullanıcı sayısı - Bireysel Kullanıcılar kurumundan al
      const { data: individualInstitution } = await supabase
        .from('institutions')
        .select('id')
        .eq('name', 'Bireysel Kullanıcılar')
        .single();

      let individualUsers = 0;
      if (individualInstitution) {
        const { count: individualUsersCount } = await supabase
          .from('institution_memberships')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', individualInstitution.id)
          .eq('is_active', true);
        individualUsers = individualUsersCount || 0;
      }

      // Toplam bağlantı sayısı
      const { count: connectionsCount } = await supabase
        .from('student_teachers')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'approved')
        .eq('is_active', true);

      setAdminStats({
        totalInstitutions,
        activeInstitutions,
        totalTeachers: teachersCount || 0,
        totalStudents: studentsCount || 0,
        individualUsers: individualUsers,
        totalConnections: connectionsCount || 0,
      });

      // Kurum bazlı detaylı istatistikler
      await loadInstitutionStats();
    } catch (error) {
      console.error('Admin istatistikleri yüklenirken hata:', error);
    } finally {
      setLoadingAdminStats(false);
    }
  };

  const loadInstitutionStats = async () => {
    console.log('[DEBUG] loadInstitutionStats başladı');
    try {
      // supabase kontrolü
      console.log('[DEBUG] supabase kontrolü:', {
        supabaseExists: !!supabase,
        hasFrom: !!(supabase && supabase.from),
        supabaseType: typeof supabase,
        supabaseKeys: supabase ? Object.keys(supabase) : 'null'
      });
      
      if (!supabase || !supabase.from) {
        console.log('[DEBUG] supabase undefined veya from metodu yok!', {
          supabase: supabase,
          supabaseFrom: supabase?.from
        });
        return;
      }

      console.log('[DEBUG] institutions sorgusu başlatılıyor...');
      const { data: institutions, error: institutionsError } = await supabase
        .from('institutions')
        .select('id, name, is_active, is_premium');

      console.log('[DEBUG] institutions sorgusu sonucu:', {
        hasData: !!institutions,
        dataLength: institutions?.length,
        error: institutionsError,
        errorType: institutionsError ? typeof institutionsError : 'none',
        errorMessage: institutionsError?.message
      });

      if (institutionsError) {
        console.log('[DEBUG] institutionsError var, return ediliyor:', institutionsError);
        return;
      }

      if (!institutions || institutions.length === 0) {
        setInstitutionStats([]);
        return;
      }

      const institutionStatsData = await Promise.all(
        institutions.map(async (inst, index) => {
          try {
            // Bireysel Kullanıcılar kurumu için özel işlem
            if (inst.name === 'Bireysel Kullanıcılar') {
              console.log('[DEBUG] Bireysel Kullanıcılar kurumu işleniyor, inst.id:', inst.id);
              // Bireysel kullanıcılar için students tablosundan say
              console.log('[DEBUG] students sorgusu başlatılıyor...');
              const { data: students, error: studentsError } = await supabase
                .from('students')
                .select('id')
                .eq('institution_id', inst.id);
              
              console.log('[DEBUG] students sorgusu sonucu:', {
                hasData: !!students,
                dataLength: students?.length,
                error: studentsError
              });

            // Eğer students tablosunda veri yoksa, institution_memberships tablosunu da kontrol et
            let finalStudentCount = students?.length || 0;
            
            if (finalStudentCount === 0) {
              console.log('[DEBUG] students sayısı 0, memberships sorgusu başlatılıyor...');
              const { data: memberships, error: membershipsError } = await supabase
                .from('institution_memberships')
                .select('user_id')
                .eq('institution_id', inst.id);
              
              console.log('[DEBUG] memberships sorgusu sonucu:', {
                hasData: !!memberships,
                dataLength: memberships?.length,
                error: membershipsError
              });

              if (memberships && memberships.length > 0) {
                const userIds = memberships.map(m => m.user_id);
                console.log('[DEBUG] userProfiles sorgusu başlatılıyor, userIds:', userIds.length);
                
                const { data: userProfiles, error: userProfilesError } = await supabase
                  .from('user_profiles')
                  .select('user_type')
                  .in('user_id', userIds);
                
                console.log('[DEBUG] userProfiles sorgusu sonucu:', {
                  hasData: !!userProfiles,
                  dataLength: userProfiles?.length,
                  error: userProfilesError
                });

                const studentCount = userProfiles?.filter(p => p.user_type === 'student').length || 0;
                finalStudentCount = studentCount;
              }
            }

              return {
                id: inst.id,
                name: inst.name,
                is_active: inst.is_active,
                is_premium: inst.is_premium,
                teacher_count: 0, // Bireysel kullanıcılar öğretmen olamaz
                student_count: finalStudentCount,
              };
            }

            // Diğer kurumlar için normal işlem
            // Önce institution_memberships üzerinden say (bir öğretmen/öğrenci birden fazla kurumda olabilir)
            console.log('[DEBUG] Kurum işleniyor:', inst.name, 'inst.id:', inst.id);
            console.log('[DEBUG] memberships sorgusu başlatılıyor...');
            const { data: memberships, error: membershipsError } = await supabase
              .from('institution_memberships')
              .select('user_id, role')
              .eq('institution_id', inst.id);
            
            console.log('[DEBUG] memberships sorgusu sonucu:', {
              hasData: !!memberships,
              dataLength: memberships?.length,
              error: membershipsError
            });

          let finalTeacherCount = 0;
          let finalStudentCount = 0;

          if (memberships && memberships.length > 0) {
            const userIds = memberships.map(m => m.user_id).filter(Boolean);
            console.log('[DEBUG] userIds filtrelendi, sayı:', userIds.length);
            
            if (userIds.length > 0) {
              console.log('[DEBUG] userProfiles sorgusu başlatılıyor...');
              const { data: userProfiles, error: userProfilesError } = await supabase
                .from('user_profiles')
                .select('user_type')
                .in('user_id', userIds);
              
              console.log('[DEBUG] userProfiles sorgusu sonucu:', {
                hasData: !!userProfiles,
                dataLength: userProfiles?.length,
                error: userProfilesError
              });

              finalTeacherCount = userProfiles?.filter(p => p.user_type === 'teacher').length || 0;
              finalStudentCount = userProfiles?.filter(p => p.user_type === 'student').length || 0;
            }
          }

          // Fallback: Eğer membership'tan sayı 0 ise, teachers/students tablolarından kontrol et
          if (finalTeacherCount === 0 && finalStudentCount === 0) {
            console.log('[DEBUG] Fallback: teachers ve students count sorguları başlatılıyor...');
            const { count: teacherCount, error: teacherCountError } = await supabase
              .from('teachers')
              .select('*', { count: 'exact', head: true })
              .eq('institution_id', inst.id);

            console.log('[DEBUG] teachers count sorgusu sonucu:', {
              count: teacherCount,
              error: teacherCountError
            });

            const { count: studentCount, error: studentCountError } = await supabase
              .from('students')
              .select('*', { count: 'exact', head: true })
              .eq('institution_id', inst.id);
            
            console.log('[DEBUG] students count sorgusu sonucu:', {
              count: studentCount,
              error: studentCountError
            });

            finalTeacherCount = teacherCount || 0;
            finalStudentCount = studentCount || 0;
          }

            return {
              id: inst.id,
              name: inst.name,
              is_active: inst.is_active,
              is_premium: inst.is_premium,
              teacher_count: finalTeacherCount,
              student_count: finalStudentCount,
            };
          } catch (error) {
            // Hata durumunda boş veri döndür - sessizce handle et
            console.log('[DEBUG] Kurum işlenirken hata:', {
              instId: inst.id,
              instName: inst.name,
              errorType: typeof error,
              errorMessage: error?.message,
              errorStack: error?.stack,
              errorKeys: error ? Object.keys(error) : 'no error object'
            });
            return {
              id: inst.id,
              name: inst.name || 'Bilinmeyen Kurum',
              is_active: inst.is_active || false,
              is_premium: inst.is_premium || false,
              teacher_count: 0,
              student_count: 0,
            };
          }
        })
      );

      console.log('[DEBUG] Tüm kurum istatistikleri hesaplandı, sayı:', institutionStatsData?.length);
      setInstitutionStats(institutionStatsData || []);
    } catch (error) {
      // Hataları sessizce handle et
      console.log('[DEBUG] loadInstitutionStats genel hata:', {
        errorType: typeof error,
        errorMessage: error?.message,
        errorStack: error?.stack,
        errorKeys: error ? Object.keys(error) : 'no error object'
      });
      setInstitutionStats([]);
    }
  };

  // Kurum detaylarını yükle (öğretmenler ve öğrenciler)
  const loadInstitutionDetails = async (institutionId) => {
    // EN ERKEN KONTROL - supabase import edilmiş mi?
    if (typeof supabase === 'undefined') {
      console.error('[CRITICAL] supabase import edilmemiş!');
      setInstitutionTeachers([]);
      setInstitutionStudents([]);
      return;
    }

    console.log('[DEBUG] loadInstitutionDetails başladı, institutionId:', institutionId);
    console.log('[DEBUG] supabase import kontrolü:', {
      supabaseDefined: typeof supabase !== 'undefined',
      supabaseType: typeof supabase,
      supabaseValue: supabase
    });

    if (!institutionId) {
      console.log('[DEBUG] institutionId yok, return ediliyor');
      return;
    }
    
    setLoadingInstitutionDetails(true);
    try {
      // supabase kontrolü - çok detaylı
      console.log('[DEBUG] supabase kontrolü başlıyor...');
      console.log('[DEBUG] supabase:', supabase);
      console.log('[DEBUG] supabase.from:', supabase?.from);
      console.log('[DEBUG] typeof supabase:', typeof supabase);
      console.log('[DEBUG] supabase === null:', supabase === null);
      console.log('[DEBUG] supabase === undefined:', supabase === undefined);
      
      if (supabase === null || supabase === undefined) {
        console.error('[CRITICAL] supabase null veya undefined!');
        setInstitutionTeachers([]);
        setInstitutionStudents([]);
        return;
      }

      if (typeof supabase.from !== 'function') {
        console.error('[CRITICAL] supabase.from bir fonksiyon değil!', {
          fromType: typeof supabase.from,
          fromValue: supabase.from,
          supabaseKeys: Object.keys(supabase || {})
        });
        setInstitutionTeachers([]);
        setInstitutionStudents([]);
        return;
      }

      // Önce institution_memberships tablosundan user_id'leri al
      console.log('[DEBUG] memberships sorgusu başlatılıyor...');
      console.log('[DEBUG] supabase.from çağrılmadan önce kontrol:', {
        supabase: !!supabase,
        supabaseFrom: typeof supabase?.from,
        supabaseFromValue: supabase?.from
      });
      
      // Güvenli çağrı - try-catch ile
      let memberships, membershipError;
      try {
        const result = await supabase
          .from('institution_memberships')
          .select('user_id')
          .eq('institution_id', institutionId);
        memberships = result.data;
        membershipError = result.error;
      } catch (queryError) {
        console.error('[ERROR] supabase.from çağrısı sırasında hata:', queryError);
        membershipError = queryError;
        memberships = null;
      }
      
      console.log('[DEBUG] memberships sorgusu sonucu:', {
        hasData: !!memberships,
        dataLength: memberships?.length,
        error: membershipError,
        errorType: membershipError ? typeof membershipError : 'none',
        errorMessage: membershipError?.message
      });

      if (membershipError) {
        console.log('[DEBUG] membershipError var, return ediliyor:', membershipError);
        setInstitutionTeachers([]);
        setInstitutionStudents([]);
        return;
      }

      if (!memberships || memberships.length === 0) {
        console.log('[DEBUG] memberships boş, return ediliyor');
        setInstitutionTeachers([]);
        setInstitutionStudents([]);
        return;
      }

      const userIds = memberships.map(m => m.user_id).filter(Boolean); // null değerleri filtrele
      console.log('[DEBUG] userIds filtrelendi, sayı:', userIds.length);

      if (userIds.length === 0) {
        console.log('[DEBUG] userIds boş, return ediliyor');
        setInstitutionTeachers([]);
        setInstitutionStudents([]);
        return;
      }

      // Bu kullanıcıların user_profiles bilgilerini al
      console.log('[DEBUG] userProfiles sorgusu başlatılıyor...');
      const { data: userProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('user_id, name, user_type')
        .in('user_id', userIds);
      
      console.log('[DEBUG] userProfiles sorgusu sonucu:', {
        hasData: !!userProfiles,
        dataLength: userProfiles?.length,
        error: profilesError,
        errorType: profilesError ? typeof profilesError : 'none',
        errorMessage: profilesError?.message
      });

      if (profilesError) {
        console.log('[DEBUG] profilesError var, return ediliyor:', profilesError);
        setInstitutionTeachers([]);
        setInstitutionStudents([]);
        return;
      }

      // Öğretmenleri filtrele
      const teachers = [];
      const students = [];
      console.log('[DEBUG] userProfiles işleniyor, sayı:', userProfiles?.length);

      for (const profile of userProfiles || []) {
        if (!profile.user_id) continue; // user_id null ise atla
        
        try {
          if (profile.user_type === 'teacher') {
            // Teachers tablosundan branş bilgisini al
            console.log('[DEBUG] teacher sorgusu başlatılıyor, user_id:', profile.user_id);
            const { data: teacherData, error: teacherDataError } = await supabase
              .from('teachers')
              .select('branch')
              .eq('user_id', profile.user_id)
              .maybeSingle();
            
            console.log('[DEBUG] teacher sorgusu sonucu:', {
              hasData: !!teacherData,
              error: teacherDataError
            });

            teachers.push({
              id: profile.user_id,
              name: profile.name,
              branch: teacherData?.branch || 'Belirtilmemiş'
            });
          } else if (profile.user_type === 'student') {
            // Students tablosundan sınıf ve email bilgisini al
            console.log('[DEBUG] student sorgusu başlatılıyor, user_id:', profile.user_id);
            const { data: studentData, error: studentDataError } = await supabase
              .from('students')
              .select('grade, email')
              .eq('user_id', profile.user_id)
              .maybeSingle();
            
            console.log('[DEBUG] student sorgusu sonucu:', {
              hasData: !!studentData,
              error: studentDataError
            });

            // Email bilgisi students tablosundan alınır
            let studentEmail = studentData?.email || null;

            students.push({
              id: profile.user_id,
              user_id: profile.user_id,
              name: profile.name,
              grade: studentData?.grade || 'Belirtilmemiş',
              email: studentEmail
            });
          }
        } catch (itemError) {
          // Tek bir item için hata oluşursa sessizce atla
          console.log('[DEBUG] Item işlenirken hata:', {
            profileUserId: profile.user_id,
            profileUserType: profile.user_type,
            errorType: typeof itemError,
            errorMessage: itemError?.message,
            errorStack: itemError?.stack,
            errorKeys: itemError ? Object.keys(itemError) : 'no error object'
          });
          continue;
        }
      }

      // Alfabetik sıralama
      console.log('[DEBUG] Öğretmen ve öğrenci sayıları:', {
        teachersCount: teachers.length,
        studentsCount: students.length
      });
      teachers.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      students.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

      setInstitutionTeachers(teachers);
      setInstitutionStudents(students);
      console.log('[DEBUG] loadInstitutionDetails başarıyla tamamlandı');
    } catch (error) {
      // Hataları detaylı logla - console.error kullan ki görünsün
      console.error('[ERROR] loadInstitutionDetails genel hata:', {
        errorType: typeof error,
        errorMessage: error?.message,
        errorStack: error?.stack,
        errorKeys: error ? Object.keys(error) : 'no error object',
        errorName: error?.name,
        errorConstructor: error?.constructor?.name,
        errorFull: error
      });
      console.error('[ERROR] Hatanın tam detayı:', error);
      
      // Hata mesajını kullanıcıya gösterme - sadece boş listeler set et
      setInstitutionTeachers([]);
      setInstitutionStudents([]);
    } finally {
      setLoadingInstitutionDetails(false);
    }
  };

  // Kullanıcı taşıma fonksiyonları
  const loadAvailableInstitutions = async () => {
    try {
      const { data: institutions, error } = await supabase
        .from('institutions')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Kurumlar yüklenirken hata:', error);
        return;
      }

      setAvailableInstitutions(institutions || []);
    } catch (error) {
      console.error('Kurumlar yüklenirken hata:', error);
    }
  };

  const openMoveUserModal = async (user) => {
    setSelectedUser(user);
    await loadAvailableInstitutions();
    setShowMoveUserModal(true);
  };

  const moveUserToInstitution = async (targetInstitutionId) => {
    if (!selectedUser || !targetInstitutionId) return;

    setLoadingMoveUser(true);
    try {
      const userId = selectedUser.user_id || selectedUser.id;
      if (!userId) {
        Alert.alert('Hata', 'Kullanıcı ID bulunamadı');
        return;
      }

      // Kullanıcının user_type'ını al
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('user_type')
        .eq('user_id', userId)
        .single();

      if (!userProfile) {
        Alert.alert('Hata', 'Kullanıcı profili bulunamadı');
        return;
      }

      const userType = userProfile.user_type; // 'teacher' veya 'student'

      // 1. Eski kurumdaki tüm institution_memberships kayıtlarını sil
      // NOT: Bu işlemler RLS ile yapılabilir olmalı veya Edge Function kullanılmalı
      // Şimdilik normal supabase kullanıyoruz (RLS izinleri varsa çalışır)
      const { error: deleteError } = await supabase
        .from('institution_memberships')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Eski üyelik silme hatası:', deleteError);
        Alert.alert('Hata', 'Eski kurum üyeliği silinemedi: ' + deleteError.message);
        return;
      }

      // 2. Yeni kuruma institution_memberships ekle
      const { error: insertError } = await supabase
        .from('institution_memberships')
        .insert({
          institution_id: targetInstitutionId,
          user_id: userId,
          role: userType,
          is_active: true
        });

      if (insertError) {
        console.error('Yeni üyelik ekleme hatası:', insertError);
        Alert.alert('Hata', 'Yeni kuruma üyelik eklenemedi: ' + insertError.message);
        return;
      }

      // 3. teachers veya students tablosundaki institution_id'yi güncelle
      if (userType === 'teacher') {
        const { error: teacherUpdateError } = await supabase
          .from('teachers')
          .update({ institution_id: targetInstitutionId })
          .eq('user_id', userId);

        if (teacherUpdateError) {
          console.error('Öğretmen güncelleme hatası:', teacherUpdateError);
          // Kritik değil, devam et
        }
      } else if (userType === 'student') {
        const { error: studentUpdateError } = await supabase
          .from('students')
          .update({ institution_id: targetInstitutionId })
          .eq('user_id', userId);

        if (studentUpdateError) {
          console.error('Öğrenci güncelleme hatası:', studentUpdateError);
          // Kritik değil, devam et
        }
      }

      // Başarılı mesajı
      const targetInstitution = availableInstitutions.find(inst => inst.id === targetInstitutionId);
      Alert.alert(
        'Başarılı!',
        `${selectedUser.name} başarıyla "${targetInstitution?.name}" kurumuna taşındı.`,
        [{ text: 'Tamam' }]
      );

      // Modal'ları kapat ve listeyi yenile
      setShowMoveUserModal(false);
      setShowInstitutionDetails(false);
      setSelectedUser(null);
      
      // Kurum detaylarını yeniden yükle
      if (selectedInstitution) {
        loadInstitutionDetails(selectedInstitution.id);
      }
    } catch (error) {
      console.error('Kullanıcı taşıma hatası:', error);
      Alert.alert('Hata', 'Kullanıcı taşınamadı');
    } finally {
      setLoadingMoveUser(false);
    }
  };

  
  // Öğrenci ekleme formu
  const [studentForm, setStudentForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    school: '',
    grade: '',
    parentName: '',
    parentPhone: '',
    address: '',
    notes: ''
  });
  const [studentLoading, setStudentLoading] = useState(false);
  
  // Öğretmen ekleme formu
  const [teacherForm, setTeacherForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    branch: '',
    experience: '',
    education: '',
    address: '',
    notes: ''
  });
  const [teacherLoading, setTeacherLoading] = useState(false);

  // Kurum ekleme formu
  const [institutionForm, setInstitutionForm] = useState({
    name: '',
    type: 'school',
    contact_email: '',
    contact_phone: '',
    address: '',
    admin_username: '',
    admin_password: ''
  });
  
  // Admin girişi için gizli tıklama sayacı
  const [adminTapCount, setAdminTapCount] = useState(0);
  const [adminTapTimeout, setAdminTapTimeout] = useState(null);
  
  // Tema context'ini kullan
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);
  const [errors, setErrors] = useState({});

  // Interstitial reklam hook'u
  const { showAd: showInterstitialAd, isLoaded: isInterstitialLoaded } = InterstitialAd();

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (adminTapTimeout) {
        clearTimeout(adminTapTimeout);
      }
    };
  }, [adminTapTimeout]);

  // Sözleşme takibi modalı açıldığında da kontrol yap
  useEffect(() => {
    if (showContractManagement) {
      checkContractExpiry().then(() => {
        loadInstitutions();
      });
    }
  }, [showContractManagement]);

  // Gizli admin girişi fonksiyonu
  const handleAdminTap = () => {
    // Önceki timeout'u temizle
    if (adminTapTimeout) {
      clearTimeout(adminTapTimeout);
    }
    
    setAdminTapCount(prev => {
      const newCount = prev + 1;
      
      if (newCount >= 5) { // 5 kez tıklayınca AdminLogin ekranına yönlendir
        // AdminLogin ekranına navigate et
        if (navigation && navigation.navigate) {
          navigation.navigate('AdminLogin');
        }
        return 0; // Sayaç sıfırla
      }
      
      // 3 saniye sonra sayacı sıfırla
      const timeout = setTimeout(() => {
        setAdminTapCount(0);
      }, 3000);
      setAdminTapTimeout(timeout);
      
      return newCount;
    });
  };

  const addStudent = async () => {
    // Form validasyonu
    if (!studentForm.firstName || !studentForm.lastName || !studentForm.email) {
      Alert.alert('Hata', 'Ad, soyad ve e-posta alanları zorunludur!');
      return;
    }

    // Kurum limit kontrolü
    try {
      const institutionId = selectedInstitution?.institution_id || selectedInstitution?.id;
      const { data: currentInstitution } = await supabase
        .from('institutions')
        .select('max_students, name')
        .eq('id', institutionId)
        .single();

      if (currentInstitution) {
        // Mevcut öğrenci sayısını hesapla
        const { data: memberships } = await supabase
          .from('institution_memberships')
          .select('user_id')
          .eq('institution_id', institutionId);

        if (memberships) {
          const userIds = memberships.map(m => m.user_id);
          const { data: userProfiles } = await supabase
            .from('user_profiles')
            .select('user_type')
            .in('user_id', userIds);

          const currentStudentCount = userProfiles?.filter(p => p.user_type === 'student').length || 0;

          if (currentStudentCount >= currentInstitution.max_students) {
            Alert.alert(
              'Limit Aşıldı!',
              `${currentInstitution.name} kurumunda öğrenci limiti (${currentInstitution.max_students}) aşıldı.\n\nMevcut: ${currentStudentCount}/${currentInstitution.max_students}\n\nDaha fazla öğrenci eklemek için geliştirici ile iletişime geçin.`,
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
      // Yeni kullanıcı oluştur (otomatik giriş yapmadan)
      const { data: newUser, error: authError } = await supabase.auth.signUp({
        email: studentForm.email,
        password: 'student123',
        options: {
          data: {
            first_name: studentForm.firstName,
            last_name: studentForm.lastName,
            user_type: 'student'
          }
        }
      });

      if (authError) {
        console.error('Auth kullanıcı oluşturma hatası:', authError);
        Alert.alert('Hata', 'Kullanıcı oluşturulamadı: ' + authError.message);
        return;
      }

      const authData = newUser;

      // user_profiles tablosuna ekle (eğer yoksa)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: authData.user.id,
          user_type: 'student',
          selected_avatar: null,
          name: `${studentForm.firstName} ${studentForm.lastName}`,
          email: studentForm.email
        }, {
          onConflict: 'user_id'
        });

      if (profileError) {
        console.error('User profile oluşturma hatası:', profileError);
        Alert.alert('Hata', 'Profil oluşturulamadı');
        return;
      }

      // students tablosuna ekle
      const { error: studentError } = await supabase
        .from('students')
        .insert({
          name: `${studentForm.firstName} ${studentForm.lastName}`,
          email: studentForm.email,
          phone: studentForm.phone,
          school: studentForm.school,
          grade: studentForm.grade,
          parent_name: studentForm.parentName,
          parent_phone: studentForm.parentPhone,
          address: studentForm.address,
          notes: studentForm.notes
        });

      if (studentError) {
        console.error('Student oluşturma hatası:', studentError);
        Alert.alert('Hata', 'Öğrenci bilgileri kaydedilemedi');
        return;
      }

      Alert.alert(
        'Başarılı!',
        `Öğrenci başarıyla eklendi!\n\nGiriş Bilgileri:\nE-posta: ${studentForm.email}\nŞifre: student123\n\nBu bilgileri öğrenciye verin.`,
        [
          {
            text: 'Tamam',
            onPress: () => {
              setShowAddStudent(false);
              setStudentForm({
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                school: '',
                grade: '',
                parentName: '',
                parentPhone: '',
                address: '',
                notes: ''
              });
              loadStudents();
            }
          }
        ]
      );

    } catch (error) {
      console.error('Öğrenci ekleme hatası:', error);
      Alert.alert('Hata', 'Öğrenci eklenemedi');
    } finally {
      setStudentLoading(false);
    }
  };

  // NOT: Eski kurum ekleme/yönetim fonksiyonları kaldırıldı
  // Artık AdminInstitutionsScreen kullanılıyor (Edge Functions ile)

  // Tarih seçimi fonksiyonu
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    
    if (selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      
      if (datePickerMode === 'start') {
        // Başlangıç tarihi seçildi, bitiş tarihini 1 yıl sonrası olarak ayarla
        const endDate = new Date(selectedDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        const formattedEndDate = endDate.toISOString().split('T')[0];
        
        setContractUpdateForm({
          ...contractUpdateForm,
          contract_start_date: formattedDate,
          contract_end_date: formattedEndDate
        });
      } else {
        // Bitiş tarihi seçildi
        setContractUpdateForm({
          ...contractUpdateForm,
          contract_end_date: formattedDate
        });
      }
    }
  };

  // Tarih seçici açma fonksiyonu
  const openDatePicker = (mode) => {
    setDatePickerMode(mode);
    setSelectedDate(new Date());
    setShowDatePicker(true);
  };

  // Sözleşme bilgilerini güncelle
  const updateContractInfo = async () => {
    if (!selectedInstitution) return;

    try {
      const { error } = await supabaseAdmin
        .from('institutions')
        .update({
          contract_start_date: contractUpdateForm.contract_start_date || null,
          contract_end_date: contractUpdateForm.contract_end_date || null,
          payment_status: contractUpdateForm.payment_status,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInstitution.id);

      if (error) {
        console.error('Sözleşme güncelleme hatası:', error);
        Alert.alert('Hata', 'Sözleşme bilgileri güncellenemedi: ' + error.message);
        return;
      }

      // Sözleşme tarihine göre otomatik aktif/pasif yap
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let shouldBeActive = true;
      if (contractUpdateForm.contract_end_date) {
        const contractEndDate = new Date(contractUpdateForm.contract_end_date);
        contractEndDate.setHours(0, 0, 0, 0);
        shouldBeActive = contractEndDate >= today;
      }

      // Kurum durumunu güncelle
      await supabaseAdmin
        .from('institutions')
        .update({
          is_active: shouldBeActive,
          is_premium: shouldBeActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInstitution.id);

      // Üyelik durumunu da güncelle
      await supabaseAdmin
        .from('institution_memberships')
        .update({
          is_active: shouldBeActive,
          updated_at: new Date().toISOString()
        })
        .eq('institution_id', selectedInstitution.id);

      Alert.alert(
        'Başarılı!',
        `"${selectedInstitution.name}" kurumunun sözleşme bilgileri güncellendi.\n\nKurum durumu: ${shouldBeActive ? 'Aktif' : 'Pasif'} olarak ayarlandı.`,
        [{ text: 'Tamam' }]
      );

      // Formu temizle ve modal'ı kapat
      setContractUpdateForm({
        contract_start_date: '',
        contract_end_date: '',
        payment_status: 'pending'
      });
      setShowContractUpdate(false);
      setSelectedInstitution(null);
      
      // Listeyi yenile
      loadInstitutions();
      loadAdminStats();
    } catch (error) {
      console.error('Sözleşme güncelleme hatası:', error);
      Alert.alert('Hata', 'Sözleşme bilgileri güncellenemedi');
    }
  };

  // Sözleşme bitiş tarihi kontrolü
  const checkContractExpiry = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Sözleşme süresi dolmuş kurumları bul
      const { data: expiredInstitutions, error } = await supabaseAdmin
        .from('institutions')
        .select('id, name, contract_end_date, is_active')
        .not('contract_end_date', 'is', null)
        .lt('contract_end_date', today)
        .eq('is_active', true);

      if (error) {
        console.error('Sözleşme kontrolü hatası:', error);
        return;
      }

      if (expiredInstitutions && expiredInstitutions.length > 0) {
        // Süresi dolmuş kurumları pasif et
        for (const institution of expiredInstitutions) {
          await supabaseAdmin
            .from('institutions')
            .update({
              is_active: false,
              is_premium: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', institution.id);

          // Üyelerin erişimini de kapat
          await supabaseAdmin
            .from('institution_memberships')
            .update({
              is_active: false,
              updated_at: new Date().toISOString()
            })
            .eq('institution_id', institution.id);
        }

        // no-op
      }
    } catch (error) {
      // swallow
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
      const institutionId = selectedInstitution?.institution_id || selectedInstitution?.id;
      const { data: currentInstitution } = await supabase
        .from('institutions')
        .select('max_teachers, name')
        .eq('id', institutionId)
        .single();

      if (currentInstitution) {
        // Mevcut öğretmen sayısını hesapla
        const { data: memberships } = await supabase
          .from('institution_memberships')
          .select('user_id')
          .eq('institution_id', institutionId);

        if (memberships) {
          const userIds = memberships.map(m => m.user_id);
          const { data: userProfiles } = await supabase
            .from('user_profiles')
            .select('user_type')
            .in('user_id', userIds);

          const currentTeacherCount = userProfiles?.filter(p => p.user_type === 'teacher').length || 0;

          if (currentTeacherCount >= currentInstitution.max_teachers) {
            Alert.alert(
              'Limit Aşıldı!',
              `${currentInstitution.name} kurumunda öğretmen limiti (${currentInstitution.max_teachers}) aşıldı.\n\nMevcut: ${currentTeacherCount}/${currentInstitution.max_teachers}\n\nDaha fazla öğretmen eklemek için geliştirici ile iletişime geçin.`,
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
      // Yeni kullanıcı oluştur (otomatik giriş yapmadan)
      const { data: newUser, error: authError } = await supabase.auth.signUp({
        email: teacherForm.email,
        password: 'teacher123',
        options: {
          data: {
            first_name: teacherForm.firstName,
            last_name: teacherForm.lastName,
            user_type: 'teacher'
          }
        }
      });

      if (authError) {
        console.error('Auth kullanıcı oluşturma hatası:', authError);
        Alert.alert('Hata', 'Kullanıcı oluşturulamadı: ' + authError.message);
        return;
      }

      const authData = newUser;

      // user_profiles tablosuna ekle (eğer yoksa)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: authData.user.id,
          user_type: 'teacher',
          selected_avatar: null,
          name: `${teacherForm.firstName} ${teacherForm.lastName}`,
          email: teacherForm.email
        }, {
          onConflict: 'user_id'
        });

      if (profileError) {
        console.error('User profile oluşturma hatası:', profileError);
        Alert.alert('Hata', 'Profil oluşturulamadı');
        return;
      }

      // teachers tablosuna ekle
      const { error: teacherError } = await supabase
        .from('teachers')
        .insert({
          user_id: authData.user.id,
          name: `${teacherForm.firstName} ${teacherForm.lastName}`,
          email: teacherForm.email,
          branch: teacherForm.branch,
          phone: teacherForm.phone,
          experience: teacherForm.experience,
          education: teacherForm.education,
          address: teacherForm.address,
          notes: teacherForm.notes,
          teacher_code: `T${Date.now()}`,
          school_id: null
        });

      if (teacherError) {
        console.error('Teacher oluşturma hatası:', teacherError);
        Alert.alert('Hata', 'Öğretmen bilgileri kaydedilemedi');
        return;
      }

      Alert.alert(
        'Başarılı!',
        `Öğretmen başarıyla eklendi!\n\nGiriş Bilgileri:\nE-posta: ${teacherForm.email}\nŞifre: teacher123\n\nBu bilgileri öğretmene verin.`,
        [
          {
            text: 'Tamam',
            onPress: () => {
              setShowAddTeacher(false);
              setTeacherForm({
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                branch: '',
                experience: '',
                education: '',
                address: '',
                notes: ''
              });
              loadTeachers();
            }
          }
        ]
      );

    } catch (error) {
      console.error('Öğretmen ekleme hatası:', error);
      Alert.alert('Hata', 'Öğretmen eklenemedi');
    } finally {
      setTeacherLoading(false);
    }
  };

  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          user_id,
          name,
          email,
          created_at
        `)
        .eq('user_type', 'student')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Öğrenciler yüklenirken hata:', error);
        Alert.alert('Hata', 'Öğrenciler yüklenemedi');
        return;
      }

      setStudents(data || []);
    } catch (error) {
      console.error('Öğrenciler yüklenirken hata:', error);
      Alert.alert('Hata', 'Öğrenciler yüklenemedi');
    } finally {
      setLoadingStudents(false);
    }
  };

  const updateTeacherBranch = async (teacherId, newBranch) => {
    try {
      const { error } = await supabase
        .from('teachers')
        .update({ branch: newBranch })
        .eq('id', teacherId);

      if (error) {
        console.error('Branş güncellenirken hata:', error);
        Alert.alert('Hata', 'Branş güncellenemedi');
        return;
      }

      Alert.alert('Başarılı', 'Branş güncellendi!');
      loadTeachers(); // Listeyi yenile
    } catch (error) {
      console.error('Branş güncellenirken hata:', error);
      Alert.alert('Hata', 'Branş güncellenemedi');
    }
  };

  const loadTeachers = async () => {
    setLoadingTeachers(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          user_id,
          name,
          email,
          created_at
        `)
        .eq('user_type', 'teacher')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Öğretmenler yüklenirken hata:', error);
        Alert.alert('Hata', 'Öğretmenler yüklenemedi');
        return;
      }

      setTeachers(data || []);
    } catch (error) {
      console.error('Öğretmenler yüklenirken hata:', error);
      Alert.alert('Hata', 'Öğretmenler yüklenemedi');
    } finally {
      setLoadingTeachers(false);
    }
  };

  // Öğretmen şifre sıfırlama
  const resetTeacherPassword = async (teacherId, teacherName, teacherEmail) => {
    try {
      const newPassword = 'teacher123'; // Varsayılan şifre
      
      // Admin client ile şifre güncelleme
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        teacherId,
        { password: newPassword }
      );

      if (authError) {
        console.error('Öğretmen şifre güncelleme hatası:', authError);
        Alert.alert('Hata', 'Şifre güncellenemedi: ' + authError.message);
        return;
      }

      Alert.alert(
        'Başarılı!',
        `${teacherName} öğretmeninin şifresi sıfırlandı!\n\nYeni Giriş Bilgileri:\nE-posta: ${teacherEmail}\nŞifre: ${newPassword}\n\nBu bilgileri öğretmene verin.`,
        [{ text: 'Tamam' }]
      );
    } catch (error) {
      console.error('Öğretmen şifre sıfırlama hatası:', error);
      Alert.alert('Hata', 'Şifre sıfırlanamadı');
    }
  };

  // Öğrenci şifre sıfırlama
  const resetStudentPassword = async (studentId, studentName, studentEmail) => {
    try {
      // UUID kontrolü
      if (!studentId || typeof studentId !== 'string') {
        Alert.alert('Hata', 'Geçersiz öğrenci ID');
        return;
      }

      const newPassword = 'student123'; // Varsayılan şifre
      
      // Admin client ile şifre güncelleme
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        studentId,
        { password: newPassword }
      );

      if (authError) {
        console.error('Öğrenci şifre güncelleme hatası:', authError);
        Alert.alert('Hata', 'Şifre güncellenemedi: ' + authError.message);
        return;
      }

      Alert.alert(
        'Başarılı!',
        `${studentName} öğrencisinin şifresi sıfırlandı!\n\nYeni Giriş Bilgileri:\nE-posta: ${studentEmail}\nŞifre: ${newPassword}\n\nBu bilgileri öğrenciye verin.`,
        [{ text: 'Tamam' }]
      );
    } catch (error) {
      console.error('Öğrenci şifre sıfırlama hatası:', error);
      Alert.alert('Hata', 'Şifre sıfırlanamadı');
    }
  };

  const handleAdminLogin = async () => {
    if (!adminUsername.trim() || !adminPassword.trim()) {
      Alert.alert('Hata', 'E-posta ve şifre gereklidir');
      return;
    }

    setAdminLoading(true);
    try {
      // Supabase Auth ile giriş yap
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminUsername.trim(), // E-posta formatında bekleniyor
        password: adminPassword
      });

      if (error) {
        console.error('Admin giriş hatası:', error);
        let errorMessage = 'Geçersiz giriş bilgileri';
        
        if (error.message?.includes('Invalid login credentials') || error.message?.includes('invalid_credentials')) {
          errorMessage = 'E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.\n\nAdmin kullanıcısı oluşturulmamışsa, create_admin_user.js script\'ini çalıştırmanız gerekebilir.';
        } else if (error.message?.includes('Email not confirmed')) {
          errorMessage = 'E-posta adresi doğrulanmamış. Lütfen e-posta kutunuzu kontrol edin.';
        } else {
          errorMessage = `Giriş hatası: ${error.message || 'Bilinmeyen hata'}`;
        }
        
        Alert.alert('Hata', errorMessage);
        setAdminLoading(false);
        return;
      }

      // Admin rolünü kontrol et
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_type')
        .eq('user_id', data.user.id)
        .single();

      if (profileError || !profile) {
        Alert.alert('Hata', 'Kullanıcı profili bulunamadı');
        await supabase.auth.signOut(); // Güvenlik için çıkış yap
        setAdminLoading(false);
        return;
      }

      // Admin kontrolü
      if (profile.user_type !== 'admin') {
        Alert.alert('Hata', 'Bu hesap admin yetkisine sahip değil');
        await supabase.auth.signOut(); // Güvenlik için çıkış yap
        setAdminLoading(false);
        return;
      }

      // Admin girişi başarılı - AdminDashboard'a yönlendir
      // Not: Bu fonksiyon artık modal için değil, direkt AdminLogin ekranına yönlendirme için kullanılıyor
      // AdminLogin ekranı kendi navigation'ını yapacak
      setShowAdminLogin(false);
      setAdminUsername('');
      setAdminPassword('');
      
      // AdminLogin ekranına yönlendir (orada giriş yapıldıktan sonra AdminDashboard'a gidecek)
      if (navigation && navigation.navigate) {
        try {
          const parent = navigation.getParent();
          if (parent) {
            parent.navigate('Auth', { screen: 'AdminLogin' });
          } else {
            navigation.navigate('AdminLogin');
          }
        } catch (error) {
          navigation.navigate('AdminLogin');
        }
      }
    } catch (error) {
      console.error('Admin giriş hatası:', error);
      Alert.alert('Hata', 'Giriş yapılırken bir hata oluştu');
    } finally {
      setAdminLoading(false);
    }
  };

  // Kurum sayılarını yükle
  const loadInstitutionCounts = async (institution = selectedInstitution) => {
    if (!institution) return;
    const institutionId = institution.institution_id || institution.id;
    if (!institutionId) return;
    
    try {
      const { data: memberships } = await supabase
        .from('institution_memberships')
        .select('user_id')
        .eq('institution_id', institutionId);

      if (memberships) {
        const filteredUserIds = memberships.map(m => m.user_id).filter(Boolean);
        if (filteredUserIds.length === 0) {
          setTeacherCount(0);
          setStudentCount(0);
          return;
        }

        // Öğretmen sayısı: membership + user_profiles role = teacher
        const { count: teachersCnt } = await supabase
          .from('user_profiles')
          .select('user_id', { count: 'exact', head: true })
          .in('user_id', filteredUserIds)
          .eq('user_type', 'teacher');

        // Öğrenci sayısı: students tablosunda user_id eşleşen ve bu kuruma ait olanlar
        const { count: studentsCnt } = await supabase
          .from('students')
          .select('user_id', { count: 'exact', head: true })
          .in('user_id', filteredUserIds)
          .eq('institution_id', institutionId);

        setTeacherCount(teachersCnt || 0);
        setStudentCount(studentsCnt || 0);
      }
    } catch (error) {
      // Hataları sessizce handle et - sadece debug log'da göster
      console.log('[DEBUG] Kurum sayıları yükleme hatası:', {
        errorType: typeof error,
        errorMessage: error?.message
      });
      // Varsayılan değerleri set et
      setTeacherCount(0);
      setStudentCount(0);
    }
  };

  // Kurum öğretmenlerini yükle
  const loadInstitutionTeachers = async () => {
    if (!selectedInstitution) return;
    const institutionId = selectedInstitution.institution_id || selectedInstitution.id;
    if (!institutionId) return;
    
    setLoadingInstitutionTeachers(true);
    try {
      // 1) Kurum üyeliklerinden user_id'leri al
      const { data: memberships } = await supabaseAdmin
        .from('institution_memberships')
        .select('user_id, role')
        .eq('institution_id', institutionId);

      const teacherUserIds = (memberships || [])
        .filter(m => m.user_id && m.role === 'teacher')
        .map(m => m.user_id);

      if (!teacherUserIds || teacherUserIds.length === 0) {
        setInstitutionTeachers([]);
        return;
      }

      // 2) Profilleri çek (role doğrulama ve ad/email için)
      const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, name, email, user_type')
        .in('user_id', teacherUserIds);

      const onlyTeachers = (profiles || []).filter(p => p.user_type === 'teacher');
      if (onlyTeachers.length === 0) {
        setInstitutionTeachers([]);
        return;
      }

      // 3) teacher detayını user_id ile çek (institution_id filtresi olmadan)
      const teacherPromises = onlyTeachers.map(async (p) => {
        const { data: tinfo } = await supabaseAdmin
          .from('teachers')
          .select('id, user_id, name, email, branch, phone, experience, education, address, notes, institution_id')
          .eq('user_id', p.user_id)
          .single();
        if (!tinfo) return null;
        return {
          ...tinfo,
          name: tinfo.name || p.name || '',
          email: tinfo.email || p.email || '',
        };
      });

      const teacherRows = (await Promise.all(teacherPromises)).filter(Boolean);
      const uniq = Array.from(new Map(teacherRows.map(it => [it.user_id, it])).values());
      setInstitutionTeachers(uniq.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    } catch (error) {
      console.error('Kurum öğretmen listesi yükleme hatası:', error);
    } finally {
      setLoadingInstitutionTeachers(false);
    }
  };

  // Kurum öğrencilerini yükle
  const loadInstitutionStudents = async () => {
    if (!selectedInstitution) return;
    const institutionId = selectedInstitution.institution_id || selectedInstitution.id;
    if (!institutionId) return;
    
    setLoadingInstitutionStudents(true);
    try {
      // 🔑 Bireysel Kullanıcılar kurumu için özel işlem
      if (selectedInstitution.name === 'Bireysel Kullanıcılar') {
        // Bireysel kullanıcılar için students tablosundan direkt al
        const { data: students } = await supabaseAdmin
          .from('students')
          .select('id, user_id, name, email, school, grade, phone, parent_name, parent_phone, address, notes')
          .not('user_id', 'is', null)
          .eq('institution_id', institutionId);

        if (students && students.length > 0) {
          const studentData = students.map(student => ({
            user_id: student.user_id,
            name: student.name,
            email: student.email,
            school: student.school,
            grade: student.grade,
            phone: student.phone,
            parent_name: student.parent_name,
            parent_phone: student.parent_phone,
            address: student.address,
            notes: student.notes,
            id: student.id
          }));

          setInstitutionStudents(studentData.sort((a, b) => a.name.localeCompare(b.name)));
        } else {
          // Fallback: institution_memberships tablosundan al
          const { data: memberships } = await supabase
            .from('institution_memberships')
            .select('user_id')
            .eq('institution_id', institutionId);

          if (memberships && memberships.length > 0) {
            const userIds = memberships.map(m => m.user_id);
            const filteredUserIds = userIds.filter(Boolean);
            if (filteredUserIds.length === 0) {
              setInstitutionStudents([]);
              return;
            }
            
            const { data: userProfiles } = await supabase
              .from('user_profiles')
              .select('user_id, name, user_type')
              .in('user_id', filteredUserIds);

            if (userProfiles) {
              const studentData = (await Promise.all(
                userProfiles.map(async (profile) => {
                  const { data: studentInfo } = await supabase
                    .from('students')
                    .select('id, email, school, grade, phone, parent_name, parent_phone, address, notes')
                    .eq('institution_id', institutionId)
                    .eq('user_id', profile.user_id)
                    .single();

                  if (!studentInfo) {
                    return null;
                  }

                  return {
                    user_id: profile.user_id,
                    name: profile.name,
                    email: studentInfo?.email || '',
                    school: studentInfo?.school || '',
                    grade: studentInfo?.grade || '',
                    phone: studentInfo?.phone || '',
                    parent_name: studentInfo?.parent_name || '',
                    parent_phone: studentInfo?.parent_phone || '',
                    address: studentInfo?.address || '',
                    notes: studentInfo?.notes || '',
                    id: studentInfo?.id || profile.user_id
                  };
                })
              )).filter(Boolean);

              setInstitutionStudents(studentData.sort((a, b) => a.name.localeCompare(b.name)));
            }
          }
        }
        return;
      }

      // Diğer kurumlar için normal işlem
      const institutionId2 = selectedInstitution.institution_id || selectedInstitution.id;

      // 1) Önce doğrudan students tablosundan bu kuruma ait öğrencileri getir
      const { data: studentsDirect } = await supabase
        .from('students')
        .select('id, user_id, name, email, school, grade, phone, parent_name, parent_phone, address, notes')
        .not('user_id', 'is', null)
        .eq('institution_id', institutionId2);

      if (studentsDirect && studentsDirect.length > 0) {
        const studentData = studentsDirect.map(s => ({
          user_id: s.user_id,
          name: s.name || '',
          email: s.email || '',
          school: s.school || '',
          grade: s.grade || '',
          phone: s.phone || '',
          parent_name: s.parent_name || '',
          parent_phone: s.parent_phone || '',
          address: s.address || '',
          notes: s.notes || '',
          id: s.id
        }));

        // Deduplicate by user_id/id
        const uniqStudentsDirect = [];
        const seenStudentIdsDirect = new Set();
        for (const st of studentData) {
          const key = st.user_id || st.id;
          if (key && !seenStudentIdsDirect.has(key)) {
            seenStudentIdsDirect.add(key);
            uniqStudentsDirect.push(st);
          }
        }
        setInstitutionStudents(uniqStudentsDirect.sort((a, b) => a.name.localeCompare(b.name)));
        return;
      }

      // 2) Fallback: membership + profiles
      const { data: memberships } = await supabase
        .from('institution_memberships')
        .select('user_id')
        .eq('institution_id', institutionId2);

      if (memberships) {
      const userIds = memberships.map(m => m.user_id).filter(Boolean);
      if (userIds.length === 0) {
        setInstitutionTeachers([]);
        setInstitutionStudents([]);
        return;
      }
        
        const { data: userProfiles } = await supabase
          .from('user_profiles')
          .select('user_id, name, user_type')
          .in('user_id', userIds);


        if (userProfiles) {
          const studentData = (await Promise.all(
            userProfiles.map(async (profile) => {
              
              const { data: studentInfo } = await supabase
                .from('students')
                .select('id, email, school, grade, phone, parent_name, parent_phone, address, notes')
                .eq('institution_id', institutionId2)
                .eq('user_id', profile.user_id)
                .single();

              if (!studentInfo) {
                return null;
              }


              // E-posta bilgisini user_profiles'dan da al
              let email = studentInfo?.email || '';
              if (!email) {
                const { data: userProfile } = await supabase
                  .from('user_profiles')
                  .select('email')
                  .eq('user_id', profile.user_id)
                  .single();
                
                if (userProfile?.email) {
                  email = userProfile.email;
                }
              }
              
              // Eğer hala e-posta yoksa, auth tablosundan al
              if (!email) {
                try {
                  const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
                  if (authUser?.user?.email) {
                    email = authUser.user.email;
                  }
                } catch (error) {
                  // Auth tablosundan e-posta alınamadı
                }
              }

              const result = {
                ...profile,
                ...studentInfo,
                email: email
              };
              
              return result;
            })
          )).filter(Boolean);

          // Deduplicate by user_id
          const uniqStudents = [];
          const seenStudentIds = new Set();
          for (const st of studentData) {
            const key = st.user_id || st.id;
            if (key && !seenStudentIds.has(key)) {
              seenStudentIds.add(key);
              uniqStudents.push(st);
            }
          }
          setInstitutionStudents(uniqStudents.sort((a, b) => a.name.localeCompare(b.name)));
        }
      }
    } catch (error) {
      console.error('Kurum öğrenci listesi yükleme hatası:', error);
    } finally {
      setLoadingInstitutionStudents(false);
    }
  };

  // Kurum öğretmen ekleme
  const addInstitutionTeacher = async () => {
    // Form validasyonu
    if (!teacherForm.firstName || !teacherForm.lastName || !teacherForm.email || !teacherForm.branch) {
      Alert.alert('Hata', 'Ad, soyad, e-posta ve branş alanları zorunludur!');
      return;
    }

    // Kurum limit kontrolü
    try {
      if (selectedInstitution) {
        const institutionId = selectedInstitution.institution_id || selectedInstitution.id;
        const { data: memberships } = await supabase
          .from('institution_memberships')
          .select('user_id')
          .eq('institution_id', institutionId);

        if (memberships) {
          const userIds = memberships.map(m => m.user_id);
          const { data: userProfiles } = await supabase
            .from('user_profiles')
            .select('user_type')
            .in('user_id', userIds);

          const currentTeacherCount = userProfiles?.filter(p => p.user_type === 'teacher').length || 0;

          if (currentTeacherCount >= selectedInstitution.max_teachers) {
            Alert.alert(
              'Limit Aşıldı!',
              `${selectedInstitution.institution_name} kurumunda öğretmen limiti (${selectedInstitution.max_teachers}) aşıldı.\n\nMevcut: ${currentTeacherCount}/${selectedInstitution.max_teachers}\n\nDaha fazla öğretmen eklemek için geliştirici ile iletişime geçin.`,
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
        // Yeni kullanıcı oluştur (otomatik giriş yapmadan)
        const { data: newUser, error: authError } = await supabase.auth.signUp({
          email: teacherForm.email,
          password: 'teacher123',
          options: {
            emailRedirectTo: 'https://example.com/confirm', // Otomatik giriş yapmasın
            emailConfirm: true, // E-posta doğrulama gerekli
            data: {
              first_name: teacherForm.firstName,
              last_name: teacherForm.lastName,
              user_type: 'teacher',
              branch: teacherForm.branch,
              phone: teacherForm.phone
            }
          }
        });

        // Otomatik giriş yapmasın diye çıkış yap - KALDIRILDI
        // if (newUser?.user) {
        //   await supabase.auth.signOut();
        //   // Kurum yöneticisini tekrar giriş yaptır
        //   await supabase.auth.signInWithPassword({
        //     email: selectedInstitution.admin_email,
        //     password: selectedInstitution.admin_password
        //   });
        // }

        if (authError) {
          if (authError.message.includes('User already registered')) {
            Alert.alert(
              'Hata',
              'Bu e-posta adresi ile zaten bir kullanıcı kayıtlı. Lütfen farklı bir e-posta adresi kullanın.',
              [{ text: 'Tamam' }]
            );
            return;
          }
          throw authError;
        }

      // User profile oluştur (eğer yoksa)
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', newUser.user.id)
        .single();

      if (!existingProfile) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: newUser.user.id,
            name: `${teacherForm.firstName} ${teacherForm.lastName}`,
            user_type: 'teacher',
            email: teacherForm.email
          });

        if (profileError) throw profileError;
      } else {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ email: teacherForm.email })
          .eq('user_id', newUser.user.id);
        
        if (updateError) {
          console.error('User profile update error:', updateError);
        }
      }

        // Teacher bilgilerini kaydet
        const { error: teacherError } = await supabase
          .from('teachers')
          .insert({
            user_id: newUser.user.id,
            name: `${teacherForm.firstName} ${teacherForm.lastName}`,
            email: teacherForm.email,
            branch: teacherForm.branch,
            phone: teacherForm.phone,
            teacher_code: `T${Date.now()}`, // Benzersiz öğretmen kodu
            institution_id: selectedInstitution.id // Kurum ID'si
          });

      if (teacherError) throw teacherError;

        // Kurum üyeliği oluştur
        const { error: membershipError } = await supabaseAdmin
          .from('institution_memberships')
          .insert({
            user_id: newUser.user.id,
            institution_id: selectedInstitution.id,
            role: 'teacher',
            joined_at: new Date().toISOString()
          });

      if (membershipError) throw membershipError;

      Alert.alert(
        'Başarılı!', 
        `Öğretmen başarıyla eklendi.\n\nE-posta: ${teacherForm.email}\nŞifre: teacher123\n\nBu bilgileri öğretmen ile paylaşabilirsiniz.`
      );
      setShowInstitutionAddTeacher(false);
      setTeacherForm({
        firstName: '',
        lastName: '',
        email: '',
        branch: '',
        phone: ''
      });
      loadInstitutionTeachers();
    } catch (error) {
      console.error('Öğretmen ekleme hatası:', error);
      Alert.alert('Hata', 'Öğretmen eklenirken bir hata oluştu.');
    } finally {
      setTeacherLoading(false);
    }
  };

  // Kurum öğrenci ekleme
  const addInstitutionStudent = async () => {
    // Form validasyonu
    if (!studentForm.firstName || !studentForm.lastName) {
      Alert.alert('Hata', 'Ad ve soyad alanları zorunludur!');
      return;
    }

    // Kurum limit kontrolü
    try {
      if (selectedInstitution) {
        const institutionId = selectedInstitution.institution_id || selectedInstitution.id;
        const { data: memberships } = await supabase
          .from('institution_memberships')
          .select('user_id')
          .eq('institution_id', institutionId);

        if (memberships) {
          const userIds = memberships.map(m => m.user_id);
          const { data: userProfiles } = await supabase
            .from('user_profiles')
            .select('user_type')
            .in('user_id', userIds);

          const currentStudentCount = userProfiles?.filter(p => p.user_type === 'student').length || 0;

          if (currentStudentCount >= selectedInstitution.max_students) {
            Alert.alert(
              'Limit Aşıldı!',
              `${selectedInstitution.institution_name} kurumunda öğrenci limiti (${selectedInstitution.max_students}) aşıldı.\n\nMevcut: ${currentStudentCount}/${selectedInstitution.max_students}\n\nDaha fazla öğrenci eklemek için geliştirici ile iletişime geçin.`,
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
        // Yeni kullanıcı oluştur (otomatik giriş yapmadan)
        const { data: newUser, error: authError } = await supabase.auth.signUp({
          email: studentForm.email,
          password: 'student123',
          options: {
            emailRedirectTo: 'https://example.com/confirm', // Otomatik giriş yapmasın
            emailConfirm: true, // E-posta doğrulama gerekli
            data: {
              first_name: studentForm.firstName,
              last_name: studentForm.lastName,
              user_type: 'student',
              school: selectedInstitution?.institution_name,
              grade: studentForm.grade
            }
          }
        });

        if (authError) {
          if (authError.message.includes('User already registered')) {
            Alert.alert(
              'Hata',
              'Bu e-posta adresi ile zaten bir kullanıcı kayıtlı. Lütfen farklı bir e-posta adresi kullanın.',
              [{ text: 'Tamam' }]
            );
            return;
          }
          throw authError;
        }

      // User profile oluştur (eğer yoksa)
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', newUser.user.id)
        .single();

      if (!existingProfile) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: newUser.user.id,
            name: `${studentForm.firstName} ${studentForm.lastName}`,
            user_type: 'student',
            email: studentForm.email
          });

        if (profileError) throw profileError;
      }

        // Student bilgilerini kaydet
        const { error: studentError } = await supabase
          .from('students')
          .insert({
            user_id: newUser.user.id,
            name: `${studentForm.firstName} ${studentForm.lastName}`,
            email: studentForm.email || '', // E-posta opsiyonel ama boş string olarak kaydet
            school: selectedInstitution?.institution_name,
            grade: studentForm.grade,
            institution_id: selectedInstitution.id // Kurum ID'si
          });

      if (studentError) throw studentError;

        // Kurum üyeliği oluştur
        const { error: membershipError } = await supabaseAdmin
          .from('institution_memberships')
          .insert({
            user_id: newUser.user.id,
            institution_id: selectedInstitution.id,
            role: 'student',
            joined_at: new Date().toISOString()
          });

      if (membershipError) throw membershipError;

      Alert.alert(
        'Başarılı!', 
        `Öğrenci başarıyla eklendi.\n\nE-posta: ${studentForm.email}\nŞifre: student123\n\nBu bilgileri öğrenci ile paylaşabilirsiniz.`
      );
      setShowInstitutionAddStudent(false);
      setStudentForm({
        firstName: '',
        lastName: '',
        email: '',
        grade: ''
      });
      loadInstitutionStudents();
    } catch (error) {
      console.error('Öğrenci ekleme hatası:', error);
      Alert.alert('Hata', 'Öğrenci eklenirken bir hata oluştu.');
    } finally {
      setStudentLoading(false);
    }
  };

  // Kullanıcı düzenleme fonksiyonu
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

  // Kullanıcı bilgilerini güncelleme
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
        loadInstitutionTeachers();
      } else {
        loadInstitutionStudents();
      }
    } catch (error) {
      console.error('🔧 DEBUG: updateUser catch hatası:', error);
      Alert.alert('Hata', `Kullanıcı bilgileri güncellenirken bir hata oluştu: ${error.message}`);
    } finally {
      setEditUserLoading(false);
    }
  };

  // Şifre sıfırlama fonksiyonu
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

  // Kullanıcı silme fonksiyonu
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
              const institutionId = selectedInstitution?.institution_id || selectedInstitution?.id;

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

              // NOT: Auth kullanıcısını ve user_profiles kaydını silmiyoruz.
              // Giriş denetimi (check_institution_access) aktif üyelik gerektirdiği için kullanıcı artık giriş yapamaz.

              Alert.alert('Başarılı!', `${user.name} kurumdan kaldırıldı.`);
              
              // Listeleri yenile
              if (user.branch) {
                loadInstitutionTeachers();
              } else {
                loadInstitutionStudents();
              }
              
              // Sayaçları güncelle
              loadInstitutionCounts(selectedInstitution);
              
              // Admin istatistiklerini yenile
              loadAdminStats();
            } catch (error) {
              console.error('Kullanıcı silme hatası:', error);
              Alert.alert('Hata', 'Kullanıcı silinirken bir hata oluştu.');
            }
          }
        }
      ]
    );
  };

  // Kurum admin girişi
  const handleInstitutionAdminLogin = async () => {
    if (!institutionAdminUsername.trim() || !institutionAdminPassword.trim()) {
      Alert.alert('Hata', 'Kullanıcı adı ve şifre gereklidir');
      return;
    }

    setInstitutionAdminLoading(true);
    try {
      const { data: result, error: rpcError } = await supabase
        .rpc('verify_institution_admin_login', {
          p_admin_username: institutionAdminUsername,
          p_admin_password: institutionAdminPassword
        });

      if (rpcError) {
        throw rpcError;
      }

      if (result && result.length > 0) {
        const institutionData = result[0];
        
        // Kurum detaylarını yükle (RLS ile erişilebilir olmalı)
        let institutionDetails = null;
        try {
          const { data: details } = await supabase
            .from('institutions')
            .select('*')
            .eq('id', institutionData.institution_id)
            .single();

          institutionDetails = details;
        } catch (error) {
          // RLS ile erişilemiyorsa, RPC'den gelen veriyi kullan - sessizce handle et
          console.log('[DEBUG] Kurum detayları RLS ile alınamadı, RPC verisi kullanılıyor');
          institutionDetails = institutionData;
        }

        const fullInstitutionData = institutionDetails 
          ? { ...institutionData, ...institutionDetails }
          : institutionData;

        // Sözleşme bitiş tarihi kontrolü
        if (fullInstitutionData.contract_end_date) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const contractEndDate = new Date(fullInstitutionData.contract_end_date);
          contractEndDate.setHours(0, 0, 0, 0);

          if (contractEndDate < today) {
            // Sözleşme bitmiş, kurumu pasif et ve girişi engelle
            // NOT: Bu işlemler RLS ile yapılabilir olmalı veya Edge Function kullanılmalı
            // Şimdilik sadece uyarı göster, güncelleme işlemini backend'de yap
            console.warn('Sözleşme bitmiş - Kurum pasif edilmeli (Edge Function ile yapılmalı)');

            Alert.alert(
              'Erişim Engellendi',
              'Kurumunuzun sözleşmesi sona ermiştir.\n\nGiriş yapabilmek için lütfen sistem yöneticiniz ile iletişime geçin.',
              [{ text: 'Tamam' }]
            );
            return;
          }
        }

        // Aktiflik kontrolü
        if (fullInstitutionData.is_active === false) {
          Alert.alert(
            'Erişim Engellendi',
            'Kurumunuz şu anda pasif durumda.\n\nGiriş yapabilmek için lütfen sistem yöneticiniz ile iletişime geçin.',
            [{ text: 'Tamam' }]
          );
          return;
        }

        setSelectedInstitution(fullInstitutionData);

        // Sözleşme bilgilerini hazırla
        let contractInfo = '';
        if (fullInstitutionData.contract_end_date) {
          const endDate = new Date(fullInstitutionData.contract_end_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          
          const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
          const formattedEndDate = endDate.toLocaleDateString('tr-TR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });

          if (daysLeft < 0) {
            contractInfo = `\n\n⚠️ Sözleşme: ${Math.abs(daysLeft)} gün önce sona ermiş\nBitiş Tarihi: ${formattedEndDate}`;
          } else if (daysLeft === 0) {
            contractInfo = `\n\n⚠️ Sözleşme: Bugün sona eriyor\nBitiş Tarihi: ${formattedEndDate}`;
          } else if (daysLeft <= 30) {
            contractInfo = `\n\n⚠️ Sözleşme: ${daysLeft} gün sonra sona erecek\nBitiş Tarihi: ${formattedEndDate}`;
          } else {
            contractInfo = `\n\n📅 Sözleşme: ${daysLeft} gün sonra sona erecek\nBitiş Tarihi: ${formattedEndDate}`;
          }
        } else {
          contractInfo = '\n\n⚠️ Sözleşme bilgisi bulunmuyor';
        }

        Alert.alert(
          'Giriş Başarılı! 🎉',
          `${institutionData.institution_name} kurumuna giriş yapıldı!${contractInfo}`,
          [
            {
              text: 'Tamam',
              onPress: async () => {
                setShowInstitutionAdminLogin(false);
                setInstitutionAdminUsername('');
                setInstitutionAdminPassword('');
                // Kurum admin panelini modal olarak aç
                setShowInstitutionAdminPanel(true);
                // Session'a admin username'i ekle (Edge Function'lar için)
                const sessionData = {
                  institutionId: institutionData.institution_id,
                  institutionName: institutionData.institution_name,
                  adminUsername: institutionAdminUsername,
                  loginTime: new Date().toISOString(),
                  isActive: fullInstitutionData.is_active !== false,
                  contractEndDate: fullInstitutionData.contract_end_date,
                };
                await AsyncStorage.setItem('institutionAdminSession', JSON.stringify(sessionData));
                // Kurum sayılarını yükle - kurum bilgilerini parametre olarak geç
                loadInstitutionCounts(institutionData);
              }
            }
          ]
        );
      } else {
        Alert.alert('Hata', result.error || 'Geçersiz kullanıcı adı veya şifre');
      }
    } catch (error) {
      // Giriş hatalarını log'da göster ama kullanıcıya sadece genel mesaj göster
      console.log('[DEBUG] Kurum admin giriş hatası:', {
        errorType: typeof error,
        errorMessage: error?.message
      });
      Alert.alert('Hata', 'Giriş yapılamadı: ' + (error.message || 'Bilinmeyen hata'));
    } finally {
      setInstitutionAdminLoading(false);
    }
  };

  // Kurum düzenleme fonksiyonu
  const editInstitution = async () => {
    if (!selectedInstitution) return;

    const institutionId = selectedInstitution.id || selectedInstitution.institution_id;
    if (!institutionId) {
      Alert.alert('Hata', 'Kurum ID bulunamadı');
      return;
    }

    setInstitutionLoading(true);
    try {
      // Güncellenecek verileri hazırla
      const updateData = {
        name: editInstitutionForm.name,
        type: editInstitutionForm.type,
        contact_email: editInstitutionForm.contact_email,
        contact_phone: editInstitutionForm.contact_phone,
        address: editInstitutionForm.address,
        max_teachers: editInstitutionForm.max_teachers,
        max_students: editInstitutionForm.max_students,
        notes: editInstitutionForm.notes,
        admin_username: editInstitutionForm.admin_username,
        updated_at: new Date().toISOString()
      };

      // Şifre boş değilse güncelle
      if (editInstitutionForm.admin_password && editInstitutionForm.admin_password.trim() !== '') {
        updateData.admin_password = editInstitutionForm.admin_password;
      }

      const { error } = await supabaseAdmin
        .from('institutions')
        .update(updateData)
        .eq('id', institutionId);

      if (error) throw error;

      // Admin şifresi güncellenmişse, institution_admin_credentials tablosunu da güncelle
      if (editInstitutionForm.admin_password && editInstitutionForm.admin_password.trim() !== '') {
        const { error: credError } = await supabaseAdmin
          .from('institution_admin_credentials')
          .update({
            admin_password: editInstitutionForm.admin_password,
            updated_at: new Date().toISOString()
          })
          .eq('institution_id', institutionId);

        if (credError) {
          console.error('Admin credentials güncelleme hatası:', credError);
          // Hata olsa da devam et, kurum güncellendi
        }
      }

      const message = editInstitutionForm.admin_password && editInstitutionForm.admin_password.trim() !== '' 
        ? 'Kurum bilgileri ve admin şifresi güncellendi!'
        : 'Kurum bilgileri güncellendi!';

      Alert.alert('Başarılı', message);
      setShowEditInstitution(false);
      loadInstitutions(); // Kurum listesini yenile
      loadAdminStats(); // İstatistikleri de yenile
    } catch (error) {
      console.error('Kurum güncelleme hatası:', error);
      Alert.alert('Hata', 'Kurum güncellenemedi: ' + error.message);
    } finally {
      setInstitutionLoading(false);
    }
  };

  // Kurum düzenleme modalını aç
  const openEditInstitution = (institution) => {
    setSelectedInstitution(institution);
    setEditInstitutionForm({
      name: institution.name || '',
      type: institution.type || 'school',
      contact_email: institution.contact_email || '',
      contact_phone: institution.contact_phone || '',
      address: institution.address || '',
      max_teachers: institution.max_teachers || 50,
      max_students: institution.max_students || 500,
      notes: institution.notes || '',
      admin_username: institution.admin_username || '',
      admin_password: '' // Şifre alanını her zaman boş bırak
    });
    setShowEditInstitution(true);
  };

  // Toplu öğretmen ekleme fonksiyonları
  const downloadCSVTemplate = async () => {
    Alert.alert(
      'CSV Formatı',
      'CSV formatı:\n\nfirstName,lastName,email,branch,phone\nAhmet,Yılmaz,ahmet.yilmaz@okul.com,Matematik,5551234567\nAyşe,Demir,ayse.demir@okul.com,Türkçe,5551234568\n\nBu formatı Excel\'de hazırlayıp CSV olarak kaydedin.',
      [{ text: 'Tamam' }]
    );
  };

  const pickCSVFile = async () => {
    Alert.alert(
      'CSV Dosyası Yükleme',
      'CSV dosyası yükleme özelliği henüz aktif değil.\n\nŞimdilik manuel olarak öğretmen ekleyebilirsiniz.\n\nToplu ekleme için:\n1. CSV şablonunu kopyalayın\n2. Excel\'de doldurun\n3. Manuel olarak ekleyin\n\nAlternatif: Script dosyalarını kullanın\n(bulk_add_teachers_from_csv.js)',
      [{ text: 'Tamam' }]
    );
  };

  // Toplu öğrenci ekleme fonksiyonları
  const downloadStudentCSVTemplate = async () => {
    Alert.alert(
      'CSV Formatı',
      'CSV formatı:\n\nfirstName,lastName,email,grade\nAhmet,Yılmaz,ahmet.yilmaz@okul.com,9A\nAyşe,Demir,ayse.demir@okul.com,10B\n\nBu formatı Excel\'de hazırlayıp CSV olarak kaydedin.',
      [{ text: 'Tamam' }]
    );
  };

  const pickStudentCSVFile = async () => {
    Alert.alert(
      'CSV Dosyası Yükleme',
      'CSV dosyası yükleme özelliği henüz aktif değil.\n\nŞimdilik manuel olarak öğrenci ekleyebilirsiniz.\n\nToplu ekleme için:\n1. CSV şablonunu kopyalayın\n2. Excel\'de doldurun\n3. Manuel olarak ekleyin\n\nAlternatif: Script dosyalarını kullanın\n(bulk_add_students_from_csv.js)',
      [{ text: 'Tamam' }]
    );
  };

  const parseCSV = (csvContent) => {
    const lines = csvContent.split('\n');
    const teachers = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = line.split(',');
      if (columns.length < 3) continue;
      
      teachers.push({
        firstName: columns[0]?.trim() || '',
        lastName: columns[1]?.trim() || '',
        email: columns[2]?.trim() || '',
        branch: columns[3]?.trim() || '',
        phone: columns[4]?.trim() || ''
      });
    }
    
    return teachers;
  };

  const processBulkTeachers = async () => {
    if (bulkTeachers.length === 0) return;
    
    setBulkTeacherLoading(true);
    setBulkTeacherProgress(0);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    try {
      for (let i = 0; i < bulkTeachers.length; i++) {
        const teacher = bulkTeachers[i];
        const progress = Math.round(((i + 1) / bulkTeachers.length) * 100);
        setBulkTeacherProgress(progress);
        
        try {
          // 1. Auth kullanıcısı oluştur
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: teacher.email,
            password: 'teacher123',
            options: {
              emailRedirectTo: 'https://example.com/confirm',
              emailConfirm: true,
              data: {
                first_name: teacher.firstName,
                last_name: teacher.lastName,
                user_type: 'teacher',
                branch: teacher.branch,
                phone: teacher.phone
              }
            }
          });

          if (authError) {
            throw new Error(`Auth hatası: ${authError.message}`);
          }

          const userId = authData.user.id;

          // 2. User profile oluştur
          const { error: profileError } = await supabase
            .from('user_profiles')
            .insert({
              user_id: userId,
              user_type: 'teacher',
              name: `${teacher.firstName} ${teacher.lastName}`,
              email: teacher.email
            });

          if (profileError) {
            throw new Error(`Profile hatası: ${profileError.message}`);
          }

          // 3. Teachers tablosuna ekle
          const { error: teacherError } = await supabase
            .from('teachers')
            .insert({
              user_id: userId,
              teacher_code: `T${Date.now()}${i}`,
              name: `${teacher.firstName} ${teacher.lastName}`,
              email: teacher.email,
              branch: teacher.branch,
              phone: teacher.phone,
              institution_id: selectedInstitution.id
            });

          if (teacherError) {
            throw new Error(`Teacher hatası: ${teacherError.message}`);
          }

          // 4. Institution membership ekle
          const { error: membershipError } = await supabaseAdmin
            .from('institution_memberships')
            .insert({
              user_id: userId,
              institution_id: selectedInstitution.id,
              role: 'teacher'
            });

          if (membershipError) {
            throw new Error(`Membership hatası: ${membershipError.message}`);
          }

          successCount++;

        } catch (error) {
          errorCount++;
          errors.push({
            teacher: `${teacher.firstName} ${teacher.lastName}`,
            email: teacher.email,
            error: error.message
          });
        }

        // Rate limiting için kısa bir bekleme
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Sonuç raporu
      let message = `Toplu ekleme tamamlandı!\n\n✅ Başarılı: ${successCount}\n❌ Hatalı: ${errorCount}`;
      
      if (errors.length > 0) {
        message += `\n\nHatalar:\n`;
        errors.slice(0, 3).forEach(err => {
          message += `• ${err.teacher}: ${err.error}\n`;
        });
        if (errors.length > 3) {
          message += `• ... ve ${errors.length - 3} hata daha`;
        }
      }

      Alert.alert('Toplu Ekleme Sonucu', message);
      
      // Modal'ı kapat ve listeleri yenile
      setShowBulkTeacherModal(false);
      setBulkTeachers([]);
      setBulkTeacherProgress(0);
      
      // Kurum yönetim panelini tekrar aç
      setShowInstitutionAdminPanel(true);
      loadInstitutionTeachers();
      loadInstitutionCounts();

    } catch (error) {
      console.error('Toplu öğretmen ekleme hatası:', error);
      Alert.alert('Hata', 'Toplu ekleme sırasında bir hata oluştu.');
    } finally {
      setBulkTeacherLoading(false);
    }
  };

  const handleLogin = async () => {
    // Validasyon
    const newErrors = {};
    if (!email) newErrors.email = 'E-posta gerekli';
    if (!password) newErrors.password = 'Şifre gerekli';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) throw error;

      // Öğretmen kontrolü - Rehber öğretmen veya normal öğretmen olabilir
      let institutionAccessGranted = false;
      
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (teacherData) {
        // Rehber öğretmen kontrolü
        const { data: guidanceInstitution } = await supabase
          .from('institutions')
          .select('id, is_active, contract_end_date')
          .eq('guidance_teacher_id', teacherData.id)
          .eq('is_active', true)
          .maybeSingle();

        if (guidanceInstitution) {
          // Sözleşme bitiş tarihi kontrolü
          if (guidanceInstitution.contract_end_date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const contractEndDate = new Date(guidanceInstitution.contract_end_date);
            contractEndDate.setHours(0, 0, 0, 0);
            
            if (contractEndDate >= today) {
              institutionAccessGranted = true;
            }
          } else {
            institutionAccessGranted = true;
          }
        } else {
          // Normal öğretmen - institution_memberships'te tüm aktif kurumları kontrol et
          // Bir öğretmen birden fazla kurumda görev alabilir
          const { data: memberships } = await supabase
            .from('institution_memberships')
            .select('institution_id, is_active')
            .eq('user_id', data.user.id)
            .eq('is_active', true);

          if (memberships && memberships.length > 0) {
            // Tüm aktif kurumları kontrol et - en az biri aktif ve geçerli olmalı
            for (const membership of memberships) {
              if (membership.is_active) {
                // Kurum bilgilerini al
                const { data: institution } = await supabase
                  .from('institutions')
                  .select('id, is_active, contract_end_date')
                  .eq('id', membership.institution_id)
                  .maybeSingle();

                if (institution && institution.is_active) {
                  // Sözleşme bitiş tarihi kontrolü
                  let contractValid = true;
                  if (institution.contract_end_date) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const contractEndDate = new Date(institution.contract_end_date);
                    contractEndDate.setHours(0, 0, 0, 0);
                    contractValid = contractEndDate >= today;
                  }

                  if (contractValid) {
                    institutionAccessGranted = true;
                    break; // En az bir geçerli kurum bulundu, yeterli
                  }
                }
              }
            }
          }
        }
      }

      // Öğretmen değilse, check_institution_access fonksiyonunu kullan (premium kontrolü)
      if (!institutionAccessGranted) {
        const { data: institutionCheck } = await supabase
          .rpc('check_institution_access', { p_user_id: data.user.id });

        // Premium kontrolü - true ise girişe izin ver
        if (institutionCheck === true) {
          institutionAccessGranted = true;
        } else {
          // Bireysel kullanıcılar için özel kontrol
          const { data: individualInstitution } = await supabase
            .from('institutions')
            .select('id, is_active')
            .eq('name', 'Bireysel Kullanıcılar')
            .single();

          if (individualInstitution) {
            const { data: membership } = await supabase
              .from('institution_memberships')
              .select('is_active')
              .eq('user_id', data.user.id)
              .eq('institution_id', individualInstitution.id)
              .single();

            // Bireysel kullanıcılar kurumunda ve aktif ise girişe izin ver
            if (membership?.is_active && individualInstitution.is_active) {
              institutionAccessGranted = true;
            }
          }
        }
      }

      // Eğer hiçbir kuruma erişim yoksa girişi engelle
      if (!institutionAccessGranted) {
        await supabase.auth.signOut();
        Alert.alert(
          'Erişim Engellendi',
          'Kurumunuz şu anda pasif durumda.\n\nGiriş yapabilmek için lütfen sistem yöneticiniz ile iletişime geçin.',
          [{ text: 'Tamam' }]
        );
        return;
      }

      // Başarılı giriş - reklam gösterilmiyor (öğretmen/premium kontrolü)
      // if (isInterstitialLoaded) {
      //   showInterstitialAd();
      // }

      // App.js otomatik olarak kullanıcıyı yönlendirecek
    } catch (error) {
      console.error('Giriş hatası:', error);
      
      let errorMessage = 'Giriş sırasında bir hata oluştu.';
      
      if (error.message === 'Invalid login credentials') {
        errorMessage = 'E-posta veya şifre hatalı. Lütfen kontrol edip tekrar dene.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'E-posta adresin henüz doğrulanmamış. Lütfen gelen kutunu kontrol et ve doğrulama linkine tıkla. Spam klasörünü de kontrol etmeyi unutma!';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Giriş Başarısız', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <TouchableOpacity 
            style={styles.header}
            onPress={handleAdminTap}
            activeOpacity={0.7}
          >
            <Text style={styles.title}>Hoş Geldin! 👋</Text>
            <Text style={styles.subtitle}>Hesabına giriş yap</Text>
          </TouchableOpacity>

          <View style={styles.form}>
            <Input
              label="E-posta"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setErrors({ ...errors, email: '' });
              }}
              placeholder="ornek@email.com"
              keyboardType="email-address"
              error={errors.email}
              autoCapitalize="none"
            />

            <Input
              label="Şifre"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrors({ ...errors, password: '' });
              }}
              placeholder="••••••••"
              secureTextEntry
              error={errors.password}
            />

            <Button
              title="Giriş Yap"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginButton}
            />

            <Button
              title="Hesabın yok mu? Kayıt Ol"
              onPress={() => navigation.navigate('Register')}
              variant="ghost"
            />


            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>veya</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              title="Demo Görüntüleme"
              onPress={() => {
                try {
                  // Demo'ya geçiş yap - CommonActions ile
                  navigation.dispatch(
                    CommonActions.navigate({
                      name: 'Demo',
                    })
                  );
                } catch (error) {
                  console.error('Demo navigation error:', error);
                  // Fallback: direkt navigate
                  if (navigation && navigation.navigate) {
                    navigation.navigate('Demo');
                  } else {
                    Alert.alert('Hata', 'Demo moduna geçilemedi. Lütfen tekrar deneyin.');
                  }
                }
              }}
              variant="outline"
              icon={<Ionicons name="eye-outline" size={20} color={colors.primary} />}
              style={styles.demoButton}
            />
            <Text style={styles.demoDescription}>
              Önce uygulamayı keşfet, beğenirsen kayıt ol!
            </Text>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>veya</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              title="🏢 Kurum Girişi"
              onPress={() => {
                if (navigation && navigation.navigate) {
                  navigation.navigate('InstitutionAdminLogin');
                }
              }}
              variant="outline"
              icon={<Ionicons name="business-outline" size={20} color={colors.primary} />}
              style={styles.institutionAdminButton}
            />
            <Text style={styles.institutionAdminDescription}>
              Kurum yöneticisi misiniz? Buradan giriş yapın.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Admin Giriş Modal */}
      <Modal
        visible={showAdminLogin}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowAdminLogin(false);
          setAdminUsername('');
          setAdminPassword('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔧 Admin Girişi</Text>
            <Text style={styles.modalSubtitle}>Admin paneline erişmek için giriş yapın</Text>
            
            <Input
              label="E-posta Adresi"
              value={adminUsername}
              onChangeText={setAdminUsername}
              placeholder="admin@verimly.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              style={styles.modalInput}
            />
            
            <Input
              label="Şifre"
              value={adminPassword}
              onChangeText={setAdminPassword}
              placeholder="Şifrenizi girin"
              secureTextEntry
              style={styles.modalInput}
            />
            
            <View style={styles.modalButtons}>
              <Button
                title="İptal"
                onPress={() => {
                  setShowAdminLogin(false);
                  setAdminUsername('');
                  setAdminPassword('');
                }}
                variant="ghost"
                style={styles.modalButton}
              />
              <Button
                title="Giriş Yap"
                onPress={handleAdminLogin}
                loading={adminLoading}
                style={[styles.modalButton, { backgroundColor: '#ff6b6b' }]}
              />
            </View>
          </View>
        </View>
      </Modal>

      

      {/* Kurum Admin Giriş Modal */}
      <Modal
        visible={showInstitutionAdminLogin}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowInstitutionAdminLogin(false);
          setInstitutionAdminUsername('');
          setInstitutionAdminPassword('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🏢 Kurum Girişi</Text>
            <Text style={styles.modalSubtitle}>Kurum yöneticisi olarak giriş yapın</Text>
            
            <Input
              label="Kullanıcı Adı"
              value={institutionAdminUsername}
              onChangeText={setInstitutionAdminUsername}
              placeholder="Kurum kullanıcı adınızı girin"
              style={styles.modalInput}
            />
            
            <Input
              label="Şifre"
              value={institutionAdminPassword}
              onChangeText={setInstitutionAdminPassword}
              placeholder="Kurum şifrenizi girin"
              secureTextEntry
              style={styles.modalInput}
            />
            
            <View style={styles.modalButtons}>
              <Button
                title="İptal"
                onPress={() => {
                  setShowInstitutionAdminLogin(false);
                  setInstitutionAdminUsername('');
                  setInstitutionAdminPassword('');
                }}
                variant="ghost"
                style={styles.modalButton}
              />
              <Button
                title="Giriş Yap"
                onPress={handleInstitutionAdminLogin}
                loading={institutionAdminLoading}
                style={[styles.modalButton, { backgroundColor: '#4ecdc4' }]}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Institution Modal */}
      <Modal
        visible={showEditInstitution}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditInstitution(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>✏️ Kurum Düzenle</Text>
            <Text style={styles.modalSubtitle}>{selectedInstitution?.name}</Text>
            
            <ScrollView style={styles.modalScrollView}>
              <Input
                label="Kurum Adı"
                value={editInstitutionForm.name}
                onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, name: text})}
                placeholder="Kurum adını girin"
                style={styles.modalInput}
              />
              
              <Input
                label="Kurum Tipi"
                value={editInstitutionForm.type}
                onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, type: text})}
                placeholder="school, university, company, individual"
                style={styles.modalInput}
              />
              
              <Input
                label="İletişim E-postası"
                value={editInstitutionForm.contact_email}
                onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, contact_email: text})}
                placeholder="iletisim@kurum.com"
                keyboardType="email-address"
                style={styles.modalInput}
              />
              
              <Input
                label="İletişim Telefonu"
                value={editInstitutionForm.contact_phone}
                onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, contact_phone: text})}
                placeholder="+90 555 123 45 67"
                keyboardType="phone-pad"
                style={styles.modalInput}
              />
              
              <Input
                label="Adres"
                value={editInstitutionForm.address}
                onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, address: text})}
                placeholder="Kurum adresi"
                multiline
                numberOfLines={3}
                style={styles.modalInput}
              />
              
              <Input
                label="Maksimum Öğretmen Sayısı"
                value={editInstitutionForm.max_teachers.toString()}
                onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, max_teachers: parseInt(text) || 50})}
                placeholder="50"
                keyboardType="numeric"
                style={styles.modalInput}
              />
              
              <Input
                label="Maksimum Öğrenci Sayısı"
                value={editInstitutionForm.max_students.toString()}
                onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, max_students: parseInt(text) || 500})}
                placeholder="500"
                keyboardType="numeric"
                style={styles.modalInput}
              />
              
              <Input
                label="Notlar"
                value={editInstitutionForm.notes}
                onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, notes: text})}
                placeholder="Kurum hakkında notlar"
                multiline
                numberOfLines={3}
                style={styles.modalInput}
              />
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <Button
                title="İptal"
                onPress={() => setShowEditInstitution(false)}
                variant="ghost"
                style={styles.modalButton}
              />
              <Button
                title="Güncelle"
                onPress={editInstitution}
                loading={institutionLoading}
                style={[styles.modalButton, { backgroundColor: '#2196F3' }]}
              />
            </View>
          </View>
        </View>
      </Modal>


      {/* Eski Ana Admin Modal'ları Kaldırıldı - Artık AdminDashboardScreen kullanılıyor */}

      {/* NOT: Eski kurum ekleme modal'ı kaldırıldı - Artık AdminInstitutionsScreen kullanılıyor */}

      {/* Institution List Modal */}
      <Modal
        visible={showInstitutionList}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInstitutionList(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>📋 Kurum Listesi</Text>
            
            {loadingInstitutions ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Kurumlar yükleniyor...</Text>
              </View>
            ) : institutions.length > 0 ? (
              <>
                <Text style={styles.modalSubtitle}>Kayıtlı kurumlar ({institutions.length})</Text>
                <FlatList
                  data={institutions}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <View style={styles.institutionCard}>
                      <View style={styles.institutionInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={styles.institutionName}>{item.name}</Text>
                          <TouchableOpacity onPress={() => openEditInstitution(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="pencil" size={18} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.institutionType}>
                          {item.type === 'school' ? 'Okul' : 
                           item.type === 'university' ? 'Üniversite' :
                           item.type === 'company' ? 'Şirket' : 'Bireysel'}
                        </Text>
                        <Text style={styles.institutionEmail}>{item.contact_email}</Text>
                        <Text style={styles.institutionStatus}>
                          {item.is_active ? '✅ Aktif' : '❌ Pasif'} • 
                          {item.payment_status === 'paid' ? '💰 Ödendi' : 
                           item.payment_status === 'overdue' ? '⚠️ Gecikmiş' : '⏳ Beklemede'}
                        </Text>
                        <Text style={styles.institutionDate}>
                          Oluşturulma: {new Date(item.created_at).toLocaleDateString('tr-TR')}
                        </Text>
                      </View>
                      <View style={styles.institutionActions} />
                    </View>
                  )}
                  style={styles.institutionsList}
                  showsVerticalScrollIndicator={false}
                />
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>Henüz kurum eklenmemiş</Text>
                <Text style={styles.emptyStateSubtext}>"Yeni Kurum Ekle" butonuna tıklayarak ilk kurumunuzu ekleyin</Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <Button
                title="⬅️ Geri"
                onPress={() => {
                  setShowInstitutionList(false);
                }}
                variant="ghost"
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Contract Management Modal */}
      <Modal
        visible={showContractManagement}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowContractManagement(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>📊 Sözleşme Takibi</Text>
            <Text style={styles.modalSubtitle}>Kurum sözleşmelerini yönetin</Text>
            
            
            {loadingInstitutions ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Kurumlar yükleniyor...</Text>
              </View>
            ) : institutions.length > 0 ? (
              <FlatList
                data={institutions}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <View style={styles.contractCard}>
                    <View style={styles.contractInfo}>
                      <Text style={styles.contractName}>{item.name}</Text>
                      <Text style={styles.contractStatus}>
                        {item.is_active ? '✅ Aktif' : '❌ Pasif'} • 
                        {item.payment_status === 'paid' ? '💰 Ödendi' : 
                         item.payment_status === 'overdue' ? '⚠️ Gecikmiş' : '⏳ Beklemede'}
                      </Text>
                      {item.contract_start_date && (
                        <Text style={styles.contractDate}>
                          Sözleşme: {new Date(item.contract_start_date).toLocaleDateString('tr-TR')} - 
                          {item.contract_end_date ? new Date(item.contract_end_date).toLocaleDateString('tr-TR') : 'Belirsiz'}
                        </Text>
                      )}
                      {item.notes && (
                        <Text style={styles.contractNotes}>Not: {item.notes}</Text>
                      )}
                    </View>
                    <View style={styles.contractActions}>
                      <TouchableOpacity
                        style={[styles.contractActionButton, { backgroundColor: '#2196F3' + '20' }]}
                        onPress={() => {
                          setSelectedInstitution(item);
                          setContractUpdateForm({
                            contract_start_date: item.contract_start_date || '',
                            contract_end_date: item.contract_end_date || '',
                            payment_status: item.payment_status || 'pending'
                          });
                          setShowContractUpdate(true);
                        }}
                      >
                        <Text style={[styles.contractActionText, { color: '#2196F3' }]}>
                          Sözleşme Güncelle
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.contractActionButton, { backgroundColor: item.is_active ? '#f44336' + '20' : '#4CAF50' + '20' }]}
                        onPress={() => {
                          Alert.alert(
                            'Kurum Durumu Değiştir',
                            `"${item.name}" kurumunu ${item.is_active ? 'pasif' : 'aktif'} etmek istediğinizden emin misiniz?\n\n${
                              item.is_active 
                                ? 'Pasif edildiğinde kurum üyeleri sistemi kullanamaz.' 
                                : 'Aktif edildiğinde kurum üyeleri sistemi kullanabilir.'
                            }`,
                            [
                              { text: 'İptal', style: 'cancel' },
                              { 
                                text: item.is_active ? 'Pasif Et' : 'Aktif Et', 
                                style: item.is_active ? 'destructive' : 'default',
                                onPress: () => {
                                  // NOT: Eski toggle fonksiyonu kaldırıldı - AdminInstitutionsScreen kullanın
                                  Alert.alert('Bilgi', 'Kurum durumunu değiştirmek için Admin Panel > Kurum Yönetimi bölümünü kullanın.');
                                }
                              }
                            ]
                          );
                        }}
                      >
                        <Text style={[
                          styles.contractActionText,
                          { color: item.is_active ? '#f44336' : '#4CAF50' }
                        ]}>
                          {item.is_active ? 'Pasif Et' : 'Aktif Et'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                style={styles.contractsList}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>Henüz kurum eklenmemiş</Text>
                <Text style={styles.emptyStateSubtext}>Önce kurum ekleyin</Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <Button
                title="⬅️ Geri"
                onPress={() => {
                  setShowContractManagement(false);
                }}
                variant="ghost"
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Contract Update Modal */}
      <Modal
        visible={showContractUpdate}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowContractUpdate(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>📝 Sözleşme Güncelle</Text>
            <Text style={styles.modalSubtitle}>{selectedInstitution?.name}</Text>
            
            <ScrollView style={styles.modalScrollView}>
              <View style={styles.dateInputContainer}>
                <Text style={styles.dateInputLabel}>Sözleşme Başlangıç Tarihi</Text>
                <TouchableOpacity
                  style={styles.dateInputButton}
                  onPress={() => openDatePicker('start')}
                >
                  <Text style={[
                    styles.dateInputText,
                    { color: contractUpdateForm.contract_start_date ? colors.textPrimary : colors.textSecondary }
                  ]}>
                    {contractUpdateForm.contract_start_date || 'Tarih seçin'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.dateInputContainer}>
                <Text style={styles.dateInputLabel}>Sözleşme Bitiş Tarihi</Text>
                <TouchableOpacity
                  style={styles.dateInputButton}
                  onPress={() => openDatePicker('end')}
                >
                  <Text style={[
                    styles.dateInputText,
                    { color: contractUpdateForm.contract_end_date ? colors.textPrimary : colors.textSecondary }
                  ]}>
                    {contractUpdateForm.contract_end_date || 'Tarih seçin'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.selectContainer}>
                <Text style={styles.selectLabel}>Ödeme Durumu</Text>
                <View style={styles.selectOptions}>
                  {[
                    { value: 'pending', label: 'Beklemede' },
                    { value: 'paid', label: 'Ödendi' },
                    { value: 'overdue', label: 'Gecikmiş' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.selectOption,
                        contractUpdateForm.payment_status === option.value && { backgroundColor: colors.primary + '20' }
                      ]}
                      onPress={() => setContractUpdateForm({ ...contractUpdateForm, payment_status: option.value })}
                    >
                      <Text style={[
                        styles.selectOptionText,
                        { color: contractUpdateForm.payment_status === option.value ? colors.primary : colors.textPrimary }
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <Button
                title="İptal"
                onPress={() => {
                  setShowContractUpdate(false);
                  setSelectedInstitution(null);
                  setContractUpdateForm({
                    contract_start_date: '',
                    contract_end_date: '',
                    payment_status: 'pending'
                  });
                }}
                variant="ghost"
                style={styles.modalButton}
              />
              <Button
                title="Güncelle"
                onPress={updateContractInfo}
                style={[styles.modalButton, { backgroundColor: '#4CAF50' }]}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Eski Ana Admin Modal'ları (Admin Main Panel, Kurum Detayları, Kullanıcı Taşıma) Kaldırıldı - Artık AdminDashboardScreen kullanılıyor */}

      {/* Edit Institution Modal */}
      <Modal
        visible={showEditInstitution}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditInstitution(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>✏️ Kurum Düzenle</Text>
            <Text style={styles.modalSubtitle}>{selectedInstitution?.name}</Text>
            
            <ScrollView style={styles.modalScrollView}>
            <Input
                label="Kurum Adı"
                value={editInstitutionForm.name}
                onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, name: text})}
                placeholder="Kurum adını girin"
              style={styles.modalInput}
            />
              
              <View style={styles.selectContainer}>
                <Text style={styles.selectLabel}>Kurum Türü</Text>
                <View style={styles.selectOptions}>
                  {[
                    { value: 'school', label: 'Okul' },
                    { value: 'university', label: 'Üniversite' },
                    { value: 'company', label: 'Şirket' },
                    { value: 'individual', label: 'Bireysel' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.selectOption,
                        editInstitutionForm.type === option.value && { backgroundColor: colors.primary + '20' }
                      ]}
                      onPress={() => setEditInstitutionForm({ ...editInstitutionForm, type: option.value })}
                    >
                      <Text style={[
                        styles.selectOptionText,
                        { color: editInstitutionForm.type === option.value ? colors.primary : colors.textPrimary }
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            
            <Input
                label="İletişim E-postası"
                value={editInstitutionForm.contact_email}
                onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, contact_email: text})}
                placeholder="kurum@email.com"
                keyboardType="email-address"
              style={styles.modalInput}
            />
            
            <Input
                label="İletişim Telefonu"
                value={editInstitutionForm.contact_phone}
                onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, contact_phone: text})}
              placeholder="0555 123 45 67"
              keyboardType="phone-pad"
              style={styles.modalInput}
            />
            
            <Input
              label="Adres"
                value={editInstitutionForm.address}
                onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, address: text})}
                placeholder="Kurum adresi"
              multiline
              numberOfLines={3}
              style={styles.modalInput}
            />

              <View style={styles.limitsContainer}>
                <Input
                  label="Maksimum Öğretmen"
                  value={editInstitutionForm.max_teachers.toString()}
                  onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, max_teachers: parseInt(text) || 50})}
                  placeholder="50"
                  keyboardType="numeric"
                  style={[styles.modalInput, { flex: 1, marginRight: 8 }]}
                />
                <Input
                  label="Maksimum Öğrenci"
                  value={editInstitutionForm.max_students.toString()}
                  onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, max_students: parseInt(text) || 500})}
                  placeholder="500"
                  keyboardType="numeric"
                  style={[styles.modalInput, { flex: 1, marginLeft: 8 }]}
                />
              </View>
            
            <Input
              label="Notlar"
                value={editInstitutionForm.notes}
                onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, notes: text})}
              placeholder="Ek notlar"
              multiline
              numberOfLines={3}
              style={styles.modalInput}
            />

              <View style={styles.adminCredentialsContainer}>
                <Text style={styles.adminCredentialsTitle}>🔐 Kurum Admin Bilgileri</Text>
                <Text style={styles.adminCredentialsSubtitle}>
                  Kurum yöneticisinin giriş bilgileri
                </Text>
                
                <Input
                  label="Admin Kullanıcı Adı"
                  value={editInstitutionForm.admin_username}
                  onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, admin_username: text})}
                  placeholder="Kurum admin kullanıcı adı"
                  style={styles.modalInput}
                />
                
                <Input
                  label="Yeni Admin Şifre"
                  value={editInstitutionForm.admin_password}
                  onChangeText={(text) => setEditInstitutionForm({...editInstitutionForm, admin_password: text})}
                  placeholder="Yeni şifre atayın (boş bırakırsanız değişmez)"
                  secureTextEntry
                  style={styles.modalInput}
                />
                <Text style={styles.adminPasswordNote}>
                  💡 Şifre alanını boş bırakırsanız mevcut şifre korunur. Yeni şifre girerseniz o şifre aktif olur.
                </Text>
              </View>
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <Button
                title="İptal"
                onPress={() => setShowEditInstitution(false)}
                variant="ghost"
                style={styles.modalButton}
              />
              <Button
                title="Güncelle"
                onPress={editInstitution}
                loading={institutionLoading}
                style={[styles.modalButton, { backgroundColor: '#4CAF50' }]}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}

      {/* Kurum Admin Panel Modal */}
      <Modal
        visible={showInstitutionAdminPanel}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInstitutionAdminPanel(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🏢 Kurum Yönetimi</Text>
            <Text style={styles.modalSubtitle}>
              {selectedInstitution?.institution_name} - Kurum Admin Paneli
            </Text>
            

            {/* Kurum İstatistikleri */}
            <View style={styles.institutionStatsCard}>
              <Text style={styles.institutionStatsTitle}>Kurum İstatistikleri</Text>
              <View style={styles.institutionStatsRow}>
                <Text style={styles.institutionStatsText}>
                  Öğretmen: {teacherCount}/{selectedInstitution?.max_teachers || 0}
                </Text>
                <Text style={styles.institutionStatsText}>
                  Öğrenci: {studentCount}/{selectedInstitution?.max_students || 0}
                </Text>
              </View>
            </View>

            {/* Yönetim Butonları */}
            <View style={styles.adminActions}>

              <TouchableOpacity
                style={[styles.adminActionButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowInstitutionAdminPanel(false);
                  setShowInstitutionAddTeacher(true);
                }}
              >
                <Ionicons name="person-add" size={20} color={colors.surface} />
                <Text style={[styles.adminActionButtonText, { color: colors.surface }]}>
                  Öğretmen Ekle
                </Text>
              </TouchableOpacity>


              <TouchableOpacity
                style={[styles.adminActionButton, { backgroundColor: colors.success }]}
                onPress={() => {
                  setShowInstitutionAdminPanel(false);
                  setShowInstitutionAddStudent(true);
                }}
              >
                <Ionicons name="school" size={20} color={colors.surface} />
                <Text style={[styles.adminActionButtonText, { color: colors.surface }]}>
                  Öğrenci Ekle
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.adminActions}>
              <TouchableOpacity
                style={[styles.adminActionButton, { backgroundColor: colors.warning }]}
                onPress={() => {
                  setShowInstitutionAdminPanel(false);
                  setShowTeacherList(true);
                  loadInstitutionTeachers();
                  loadInstitutionCounts();
                }}
              >
                <Ionicons name="people" size={20} color={colors.surface} />
                <Text style={[styles.adminActionButtonText, { color: colors.surface }]}>
                  Öğretmenler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.adminActionButton, { backgroundColor: colors.info }]}
                onPress={() => {
                  setShowInstitutionAdminPanel(false);
                  setShowStudentList(true);
                  loadInstitutionStudents();
                  loadInstitutionCounts();
                }}
              >
                <Ionicons name="school" size={20} color={colors.surface} />
                <Text style={[styles.adminActionButtonText, { color: colors.surface }]}>
                  Öğrenciler
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="Kapat"
                onPress={() => {
                  Alert.alert(
                    'Kurum Yönetimini Kapat',
                    'Kurum yönetim panelini kapatmak istediğinizden emin misiniz?',
                    [
                      { text: 'İptal', style: 'cancel' },
                      { 
                        text: 'Kapat', 
                        style: 'destructive',
                        onPress: () => {
                          setShowInstitutionAdminPanel(false);
                          setInstitutionTeachers([]);
                          setInstitutionStudents([]);
                        }
                      }
                    ]
                  );
                }}
                variant="ghost"
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Kurum Öğretmen Listesi Modal */}
      <Modal
        visible={showTeacherList}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTeacherList(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Öğretmenler</Text>
            <Text style={styles.modalSubtitle}>
              {selectedInstitution?.institution_name} - Öğretmen Listesi
            </Text>
            
            {loadingInstitutionTeachers ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <ScrollView style={styles.userList}>
                {institutionTeachers.map((teacher) => (
                  <View key={teacher.user_id} style={styles.userCard}>
                    <View style={styles.userCardHeader}>
                      <View style={styles.userCardInfo}>
                        <Text style={styles.userCardName}>{teacher.name}</Text>
                        <Text style={styles.userCardBranch}>{teacher.branch}</Text>
                      </View>
                      <View style={styles.userCardActions}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => editUser(teacher)}
                        >
                          <Ionicons name="create-outline" size={20} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => resetUserPassword(teacher)}
                        >
                          <Ionicons name="key-outline" size={20} color={colors.warning} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => deleteUser(teacher)}
                        >
                          <Ionicons name="trash-outline" size={20} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
            </ScrollView>
            )}
            
            <View style={styles.modalButtons}>
              <Button
                title="Geri"
                onPress={() => {
                  setShowTeacherList(false);
                  setShowInstitutionAdminPanel(true);
                }}
                variant="ghost"
                style={styles.modalButton}
              />
              <Button
                title="Kapat"
                onPress={() => {
                  Alert.alert(
                    'Öğretmen Listesini Kapat',
                    'Öğretmen listesini kapatmak istediğinizden emin misiniz?',
                    [
                      { text: 'İptal', style: 'cancel' },
                      { 
                        text: 'Kapat', 
                        style: 'destructive',
                        onPress: () => {
                          setShowTeacherList(false);
                          setInstitutionTeachers([]);
                        }
                      }
                    ]
                  );
                }}
                style={[styles.modalButton, { backgroundColor: colors.error }]}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Kurum Öğrenci Listesi Modal */}
      <Modal
        visible={showStudentList}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStudentList(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Öğrenciler</Text>
            <Text style={styles.modalSubtitle}>
              {selectedInstitution?.institution_name} - Öğrenci Listesi
            </Text>
            
            {loadingInstitutionStudents ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <ScrollView style={styles.userList}>
                {institutionStudents.map((student) => (
                  <View key={student.user_id} style={styles.userCard}>
                    <View style={styles.userCardHeader}>
                      <View style={styles.userCardInfo}>
                        <Text style={styles.userCardName}>{student.name}</Text>
                        <Text style={styles.userCardBranch}>{student.grade}</Text>
                      </View>
                      <View style={styles.userCardActions}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => editUser(student)}
                        >
                          <Ionicons name="create-outline" size={20} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => resetUserPassword(student)}
                        >
                          <Ionicons name="key-outline" size={20} color={colors.warning} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => deleteUser(student)}
                        >
                          <Ionicons name="trash-outline" size={20} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
            
            <View style={styles.modalButtons}>
              <Button
                title="Geri"
                onPress={() => {
                  setShowStudentList(false);
                  setShowInstitutionAdminPanel(true);
                }}
                variant="ghost"
                style={styles.modalButton}
              />
              <Button
                title="Kapat"
                onPress={() => {
                  Alert.alert(
                    'Öğrenci Listesini Kapat',
                    'Öğrenci listesini kapatmak istediğinizden emin misiniz?',
                    [
                      { text: 'İptal', style: 'cancel' },
                      { 
                        text: 'Kapat', 
                        style: 'destructive',
                        onPress: () => {
                          setShowStudentList(false);
                          setInstitutionStudents([]);
                        }
                      }
                    ]
                  );
                }}
                style={[styles.modalButton, { backgroundColor: colors.error }]}
              />
            </View>
          </View>
        </View>
      </Modal>



      {/* Kurum Öğretmen Ekleme Modal */}
      <Modal
        visible={showInstitutionAddTeacher}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInstitutionAddTeacher(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Öğretmen Ekle</Text>
            <Text style={styles.modalSubtitle}>
              {selectedInstitution?.institution_name} - Yeni Öğretmen
            </Text>
            
            <ScrollView style={styles.modalScrollView}>
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
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <Button
                title="İptal"
                onPress={() => {
                  setShowInstitutionAddTeacher(false);
                  setShowInstitutionAdminPanel(true);
                }}
                variant="ghost"
                style={styles.modalButton}
              />
              <Button
                title="Öğretmen Ekle"
                onPress={addInstitutionTeacher}
                loading={teacherLoading}
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Kurum Öğrenci Ekleme Modal */}
      <Modal
        visible={showInstitutionAddStudent}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInstitutionAddStudent(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Öğrenci Ekle</Text>
            <Text style={styles.modalSubtitle}>
              {selectedInstitution?.institution_name} - Yeni Öğrenci
            </Text>
            
            <ScrollView style={styles.modalScrollView}>
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
                placeholder="Öğrenci e-postası (opsiyonel)"
                keyboardType="email-address"
              />
              <View style={styles.institutionInfo}>
                <Text style={styles.institutionInfoLabel}>Okul</Text>
                <Text style={styles.institutionInfoValue}>{selectedInstitution?.institution_name}</Text>
              </View>
              <Input
                label="Sınıf"
                value={studentForm.grade}
                onChangeText={(text) => setStudentForm({...studentForm, grade: text})}
                placeholder="Öğrenci sınıfı"
              />
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <Button
                title="İptal"
                onPress={() => {
                  setShowInstitutionAddStudent(false);
                  setShowInstitutionAdminPanel(true);
                }}
                variant="ghost"
                style={styles.modalButton}
              />
              <Button
                title="Öğrenci Ekle"
                onPress={addInstitutionStudent}
                loading={studentLoading}
                style={[styles.modalButton, { backgroundColor: colors.success }]}
              />
            </View>
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
            <Text style={styles.modalTitle}>Kullanıcı Düzenle</Text>
            <Text style={styles.modalSubtitle}>
              {selectedUser?.name} - Bilgileri Güncelle
            </Text>
            
            <ScrollView style={styles.modalScrollView}>
              <Input
                label="Ad *"
                value={editUserForm.firstName}
                onChangeText={(text) => setEditUserForm({...editUserForm, firstName: text})}
                placeholder="Ad"
              style={styles.modalInput}
            />
            
            <Input
                label="Soyad *"
                value={editUserForm.lastName}
                onChangeText={(text) => setEditUserForm({...editUserForm, lastName: text})}
                placeholder="Soyad"
              style={styles.modalInput}
            />
            
            <Input
                label="E-posta *"
                value={editUserForm.email}
                onChangeText={(text) => setEditUserForm({...editUserForm, email: text})}
                placeholder="ornek@email.com"
                keyboardType="email-address"
              style={styles.modalInput}
            />
            
              {selectedUser?.branch ? (
                <>
            <Input
                    label="Branş *"
                    value={editUserForm.branch}
                    onChangeText={(text) => setEditUserForm({...editUserForm, branch: text})}
                    placeholder="Matematik, Fizik, vb."
              style={styles.modalInput}
            />
            
            <Input
                    label="Telefon"
                    value={editUserForm.phone}
                    onChangeText={(text) => setEditUserForm({...editUserForm, phone: text})}
                    placeholder="+90 555 123 45 67"
                    keyboardType="phone-pad"
                    style={styles.modalInput}
                  />
                </>
              ) : (
                <>
                  <Input
                    label="Sınıf *"
                    value={editUserForm.grade}
                    onChangeText={(text) => setEditUserForm({...editUserForm, grade: text})}
                    placeholder="9, 10, 11, 12, graduate"
              style={styles.modalInput}
            />
            
            <Input
                    label="Telefon"
                    value={editUserForm.phone}
                    onChangeText={(text) => setEditUserForm({...editUserForm, phone: text})}
                    placeholder="+90 555 123 45 67"
                    keyboardType="phone-pad"
              style={styles.modalInput}
            />
                </>
              )}
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <Button
                title="İptal"
                onPress={() => {
                  setShowEditUser(false);
                  setSelectedUser(null);
                }}
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
    </Container>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SIZES.padding,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: SIZES.h1,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
  },
  form: {
    gap: 8,
  },
  loginButton: {
    marginTop: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  demoButton: {
    marginBottom: 8,
  },
  demoDescription: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: SIZES.h2,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalInput: {
    marginBottom: 16,
  },
  modalScrollView: {
    maxHeight: 400,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
  },
  // Admin buttons
  adminButtons: {
    gap: 12,
  },
  adminButton: {
    marginBottom: 8,
  },
  // Teacher list styles
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: colors.textSecondary,
  },
  teachersList: {
    maxHeight: 300,
    marginVertical: 10,
  },
  teacherCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  teacherInfo: {
    flex: 1,
  },
  teacherName: {
    fontSize: SIZES.body,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  teacherEmail: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  teacherBranch: {
    fontSize: SIZES.small,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: 2,
  },
  teacherDate: {
    fontSize: SIZES.caption,
    color: colors.textSecondary,
  },
  teacherActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Student list styles
  studentsList: {
    maxHeight: 300,
    marginVertical: 10,
  },
  studentCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: SIZES.body,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  studentSchool: {
    fontSize: SIZES.small,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: 2,
  },
  studentGrade: {
    fontSize: SIZES.small,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: 2,
  },
  studentParent: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  studentDate: {
    fontSize: SIZES.caption,
    color: colors.textSecondary,
  },
  studentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  // Institution styles
  modalScrollView: {
    maxHeight: 400,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  institutionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  institutionInfo: {
    flex: 1,
  },
  institutionName: {
    fontSize: SIZES.h4,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  institutionType: {
    fontSize: SIZES.small,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  institutionEmail: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  institutionStatus: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  institutionDate: {
    fontSize: SIZES.caption,
    color: colors.textSecondary,
  },
  institutionsList: {
    maxHeight: 300,
  },
  contractCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contractInfo: {
    flex: 1,
  },
  contractName: {
    fontSize: SIZES.h4,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  contractStatus: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  contractDate: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  contractNotes: {
    fontSize: SIZES.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  contractActions: {
    marginLeft: 12,
  },
  contractActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contractActionText: {
    fontSize: SIZES.small,
    fontWeight: '500',
  },
  contractsList: {
    maxHeight: 300,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: SIZES.h4,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  contractManagementButtons: {
    marginBottom: 16,
  },
  contractButton: {
    marginBottom: 8,
  },
  dateInputContainer: {
    marginBottom: 16,
  },
  dateInputLabel: {
    fontSize: SIZES.body,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  dateInputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateInputText: {
    fontSize: SIZES.body,
    flex: 1,
  },
  institutionAdminButton: {
    marginTop: 8,
  },
  institutionAdminDescription: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  institutionActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  // Dashboard stats styles
  statsSection: {
    marginBottom: 24,
  },
  statsSectionTitle: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 80,
  },
  statValue: {
    fontSize: SIZES.h2,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  institutionStatCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  institutionStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  institutionStatName: {
    fontSize: SIZES.h4,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  institutionStatBadges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: SIZES.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  institutionStatDetails: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  institutionStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 100,
  },
  institutionStatText: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    flex: 1,
  },
  // Bireysel kullanıcılar kartı
  individualUsersCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  individualUsersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  individualUsersTitle: {
    fontSize: SIZES.h4,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  individualUsersContent: {
    alignItems: 'center',
    marginBottom: 12,
  },
  individualUsersCount: {
    fontSize: SIZES.h1,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  individualUsersLabel: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  individualUsersDescription: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Kurum detayları stilleri
  institutionStatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  institutionStatFooterText: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  detailsSection: {
    marginBottom: 24,
  },
  detailsSectionTitle: {
    fontSize: SIZES.h4,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: 6,
    padding: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailCardInfo: {
    flex: 1,
  },
  detailCardName: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 1,
  },
  detailCardBranch: {
    fontSize: SIZES.small,
    color: colors.primary,
    fontWeight: '500',
  },
  detailCardGrade: {
    fontSize: SIZES.small,
    color: colors.primary,
    fontWeight: '500',
  },
  detailCardActions: {
    flexDirection: 'row',
    gap: 4,
  },
  detailActionButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCardEmail: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  detailCardPhone: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  detailCardSchool: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  detailCardDate: {
    fontSize: SIZES.caption,
    color: colors.textSecondary,
  },
  // Kullanıcı taşıma modal stilleri
  institutionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  institutionOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  institutionOptionName: {
    fontSize: SIZES.body,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
  },
  adminPasswordNote: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Kurum admin paneli stilleri
  institutionAdminInfo: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  institutionAdminInfoText: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Kurum admin paneli stilleri
  institutionStatsCard: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  institutionStatsTitle: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  institutionStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  institutionStatsText: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  adminActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  adminActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 0.48,
    justifyContent: 'center',
  },
  adminActionButtonText: {
    marginLeft: 8,
    fontWeight: '600',
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userCardActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  userList: {
    maxHeight: 300,
  },
  userCard: {
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userCardInfo: {
    flex: 1,
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
  },
  userCardActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  // Kurum bilgisi stilleri
  institutionInfo: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  institutionInfoLabel: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  institutionInfoValue: {
    fontSize: SIZES.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  // Toplu öğretmen ekleme stilleri
  bulkTeacherInfo: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bulkTeacherInfoTitle: {
    fontSize: SIZES.h4,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  bulkTeacherInfoText: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  bulkTeacherActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  bulkTeacherButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  bulkTeacherButtonText: {
    marginLeft: 8,
    fontWeight: '600',
    fontSize: SIZES.body,
  },
  bulkTeacherPreview: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bulkTeacherPreviewTitle: {
    fontSize: SIZES.h4,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  bulkTeacherPreviewList: {
    maxHeight: 200,
  },
  bulkTeacherPreviewItem: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bulkTeacherPreviewName: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  bulkTeacherPreviewEmail: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  bulkTeacherPreviewBranch: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
  },
  bulkTeacherPreviewMore: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  bulkTeacherProgress: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bulkTeacherProgressText: {
    fontSize: SIZES.body,
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  bulkTeacherProgressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bulkTeacherProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
});

