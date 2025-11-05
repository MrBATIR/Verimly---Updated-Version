import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Container, Button, Input, Card } from '../components';
import { supabase } from '../lib/supabase';
import { updateGuidanceTeacherStudentPlan, deleteGuidanceTeacherStudentPlans, getGuidanceTeacherStudentPlans, getGuidanceTeacherStudents, createGuidanceTeacherStudentPlan } from '../lib/adminApi';

const TeacherPlanScreen = ({ route }) => {
  const isDemo = route?.params?.isDemo || false;
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentPlans, setStudentPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' or 'weekly'
  
  // Modal state'leri
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planTitle, setPlanTitle] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGuidanceTeacher, setIsGuidanceTeacher] = useState(false);

  useEffect(() => {
    if (isDemo) {
      loadDemoStudents();
    } else {
      loadStudents();
    }
  }, [isDemo]);

  // Sayfa her odaklandığında öğrencileri yenile
  useFocusEffect(
    React.useCallback(() => {
      if (!isDemo) {
        loadStudents();
      }
    }, [isDemo])
  );

  const loadDemoStudents = () => {
    setStudents([
      {
        id: 'demo-student-1',
        name: 'Ahmet Yılmaz',
        email: 'ahmet@demo.com',
        avatar_url: null,
      },
      {
        id: 'demo-student-2',
        name: 'Ayşe Demir',
        email: 'ayse@demo.com',
        avatar_url: null,
      },
      {
        id: 'demo-student-3',
        name: 'Mehmet Kaya',
        email: 'mehmet@demo.com',
        avatar_url: null,
      },
    ]);
  };

  const loadStudents = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın.');
        setLoading(false);
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
        Alert.alert('Hata', 'Öğretmen bilgisi bulunamadı: ' + (teacherError?.message || 'Bilinmeyen hata'));
        setLoading(false);
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
        
        // Rehber öğretmen - Edge Function ile kurumundaki tüm öğrencileri göster
        const result = await getGuidanceTeacherStudents(institutionData.id);
        
        if (result.error) {
          console.error('Rehber öğretmen öğrencileri yüklenirken hata:', result.error);
          Alert.alert('Hata', result.error.message || 'Öğrenciler yüklenemedi');
          setLoading(false);
          return;
        }

        // Edge Function'dan gelen öğrenci listesini formatla
        const studentsData = result.data?.data || result.data || [];
        const formattedStudents = studentsData.map(student => ({
          id: student.user_id,
          name: student.name || `Öğrenci ${student.id?.substring(0, 8) || ''}`,
          email: student.email || '',
          avatar_url: null // Edge Function'dan avatar bilgisi gelmiyor, gerekirse eklenebilir
        }));

        // Alfabetik sıralama (isme göre)
        formattedStudents.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB, 'tr');
        });

        setStudents(formattedStudents);
        setLoading(false);
        return; // Rehber öğretmen için işlem tamamlandı
      } else {
        setIsGuidanceTeacher(false);
        // Normal öğretmen - Bağlı öğrencileri al
        const { data: students, error: studentsError } = await supabase
          .from('student_teachers')
          .select('student_id')
          .eq('teacher_id', teacherData.id)
          .eq('is_active', true);

        if (studentsError) {
          console.error('Öğrenciler yüklenirken hata:', studentsError);
          Alert.alert('Hata', 'Bağlı öğrenciler yüklenemedi: ' + studentsError.message);
          setLoading(false);
          return;
        }

        studentIds = students?.map(student => student.student_id) || [];
      }

      if (studentIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // Normal öğretmen için öğrenci profil verilerini al
      const { data: studentProfiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, name, email, avatar_url')
        .in('user_id', studentIds);

      if (profileError) {
        console.error('Öğrenci profilleri yüklenirken hata:', profileError);
        Alert.alert('Hata', 'Öğrenci profilleri yüklenemedi: ' + profileError.message);
        setLoading(false);
        return;
      }

      const studentsData = (studentProfiles || []).map(profile => ({
        id: profile.user_id,
        name: profile.name || 'İsimsiz Öğrenci',
        email: profile.email,
        avatar_url: profile.avatar_url,
      }));

      setStudents(studentsData);
    } catch (error) {
      console.error('Öğrenciler yüklenirken hata:', error);
      Alert.alert('Hata', 'Öğrenciler yüklenirken bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentPlans = async (studentId) => {
    if (isDemo) {
      loadDemoStudentPlans();
      return;
    }

    try {
      setLoading(true);
      
      // Öğretmen ID'sini al
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!teacherData) {
        setLoading(false);
        return;
      }

      // Rehber öğretmen kontrolü
      let institutionData = null;
      if (isGuidanceTeacher) {
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
        const result = await getGuidanceTeacherStudentPlans(studentId, institutionData.id);
        
        if (result.error) {
          console.error('Öğrenci planları yüklenirken hata:', result.error);
          setStudentPlans([]);
          setLoading(false);
          return;
        }

        const plansData = result.data?.data || result.data || { daily: [], weekly: [] };
        const planType = activeTab;
        const plans = planType === 'daily' ? (plansData.daily || []) : (plansData.weekly || []);
        
        setStudentPlans(plans);
      } else {
        // Normal öğretmen - Normal supabase kullan
        const tableName = activeTab === 'daily' ? 'student_daily_plans' : 'student_weekly_plans';
        const dateField = activeTab === 'daily' ? 'plan_date' : 'week_start_date';
        
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('student_id', studentId)
          .order(dateField, { ascending: false });

        if (error) {
          console.error('Öğrenci planları yüklenirken hata:', error);
          setStudentPlans([]);
          setLoading(false);
          return;
        }

        // Rehber öğretmen kontrolü - Planları yükledikten sonra her plan için rehber öğretmen kontrolü yap
        const enrichedPlans = await Promise.all((data || []).map(async (plan) => {
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

        setStudentPlans(enrichedPlans || []);
      }
    } catch (error) {
      console.error('Öğrenci planları yüklenirken hata:', error);
      setStudentPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDemoStudentPlans = () => {
    const demoPlans = [
      {
        id: 'demo-plan-1',
        title: 'Matematik çalışması',
        description: 'Geometri konularını tekrar et',
        [activeTab === 'daily' ? 'plan_date' : 'week_start_date']: new Date().toISOString().split('T')[0],
        is_completed: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'demo-plan-2',
        title: 'Fizik ödevleri',
        description: 'Mekanik problemlerini çöz',
        [activeTab === 'daily' ? 'plan_date' : 'week_start_date']: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        is_completed: true,
        created_at: new Date().toISOString(),
      },
    ];
    setStudentPlans(demoPlans);
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    loadStudentPlans(student.id);
  };

  const handleAddPlan = () => {
    if (!selectedStudent) {
      Alert.alert('Uyarı', 'Önce bir öğrenci seçin');
      return;
    }
    setEditingPlan(null);
    setPlanTitle('');
    setPlanDescription('');
    setPlanDate(new Date().toISOString().split('T')[0]);
    setShowAddModal(true);
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanTitle(plan.title);
    setPlanDescription(plan.description || '');
    setPlanDate(activeTab === 'daily' ? plan.plan_date : plan.week_start_date);
    setShowAddModal(true);
  };

  const handleSavePlan = async () => {
    if (!planTitle.trim()) {
      Alert.alert('Hata', 'Plan başlığı gereklidir');
      return;
    }

    if (!planDate.trim()) {
      Alert.alert('Hata', 'Tarih gereklidir');
      return;
    }

    if (isDemo) {
      Alert.alert('Demo Mod', 'Demo modda plan kaydedilemez');
      setShowAddModal(false);
      return;
    }

    try {
      setLoading(true);
      
      // Öğretmen ID'sini al
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı');
        setLoading(false);
        return;
      }

      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (teacherError || !teacherData) {
        Alert.alert('Hata', 'Öğretmen bilgisi bulunamadı');
        setLoading(false);
        return;
      }

      const tableName = activeTab === 'daily' ? 'student_daily_plans' : 'student_weekly_plans';
      const dateField = activeTab === 'daily' ? 'plan_date' : 'week_start_date';
      const planType = activeTab;
      
      // Rehber öğretmen kontrolü ve institution_id al
      let institutionData = null;
      if (isGuidanceTeacher) {
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
        if (editingPlan) {
          // Plan güncelleme
          const result = await updateGuidanceTeacherStudentPlan(
            editingPlan.id,
            institutionData.id,
            planType,
            {
              title: planTitle.trim(),
              description: planDescription.trim(),
              plan_date: planDate,
            }
          );

          if (result.error) {
            throw new Error(result.error.message || 'Plan güncellenemedi');
          }
        } else {
          // Yeni plan oluşturma
          // selectedStudent.id artık user_id, students.id'yi bulmamız gerekiyor
          // Edge Function hem students.id hem de students.user_id kabul ediyor
          const result = await createGuidanceTeacherStudentPlan(
            selectedStudent.id, // user_id olarak kullanılabilir
            institutionData.id,
            planTitle.trim(),
            planDescription.trim(),
            planDate,
            planType
          );

          if (result.error) {
            throw new Error(result.error.message || 'Plan oluşturulamadı');
          }
        }
      } else {
        // Normal öğretmen - Normal supabase kullan
        const queryClient = supabase;
        
        const planData = {
          student_id: selectedStudent.id,
          title: planTitle.trim(),
          description: planDescription.trim(),
          [dateField]: planDate,
          teacher_id: teacherData.id,
        };

        if (editingPlan) {
          const { error } = await queryClient
            .from(tableName)
            .update(planData)
            .eq('id', editingPlan.id);

          if (error) throw error;
        } else {
          const { error } = await queryClient
            .from(tableName)
            .insert(planData);

          if (error) throw error;
        }
      }

      Alert.alert('Başarılı', editingPlan ? 'Plan güncellendi' : 'Plan eklendi');
      setShowAddModal(false);
      loadStudentPlans(selectedStudent.id);
    } catch (error) {
      console.error('Plan kaydedilirken hata:', error);
      Alert.alert('Hata', 'Plan kaydedilemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = (plan) => {
    Alert.alert(
      'Planı Sil',
      'Bu planı silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Sil', 
          style: 'destructive',
          onPress: () => deletePlan(plan)
        }
      ]
    );
  };

  const deletePlan = async (plan) => {
    if (isDemo) {
      Alert.alert('Demo Mod', 'Demo modda plan silinemez');
      return;
    }

    try {
      setLoading(true);
      const planType = activeTab;
      
      // Öğretmen ID'sini al
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı');
        setLoading(false);
        return;
      }

      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (teacherError || !teacherData) {
        Alert.alert('Hata', 'Öğretmen bilgisi bulunamadı');
        setLoading(false);
        return;
      }

      // Rehber öğretmen kontrolü
      let institutionData = null;
      if (isGuidanceTeacher) {
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
          .eq('id', plan.id);

        if (error) throw error;
      }

      Alert.alert('Başarılı', 'Plan silindi');
      loadStudentPlans(selectedStudent.id);
    } catch (error) {
      console.error('Plan silinirken hata:', error);
      Alert.alert('Hata', 'Plan silinemedi');
    } finally {
      setLoading(false);
    }
  };

  const renderStudentItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.studentCard,
        selectedStudent?.id === item.id && styles.selectedStudentCard
      ]}
      onPress={() => handleStudentSelect(item)}
    >
      <View style={styles.studentInfo}>
        <View style={styles.avatarContainer}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.defaultAvatar}>
              <Text style={styles.avatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.studentDetails}>
          <Text style={styles.studentName}>{item.name}</Text>
          <Text style={styles.studentEmail}>{item.email}</Text>
        </View>
      </View>
      {selectedStudent?.id === item.id && (
        <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
      )}
    </TouchableOpacity>
  );

  const renderPlanItem = ({ item }) => {
    const isTeacherPlan = item.teacher_id;
    const isGuidanceTeacherPlan = item.isGuidanceTeacher;
    
    return (
      <Card style={styles.planCard}>
        <TouchableOpacity
          style={styles.planContent}
          onPress={() => handleEditPlan(item)}
        >
          <View style={styles.planHeader}>
            <View style={styles.planTitleContainer}>
              <Text style={styles.planTitle}>{item.title}</Text>
              {/* Plan türü badge'i */}
              {isTeacherPlan && (
                <View style={[
                  styles.teacherPlanBadge,
                  isGuidanceTeacherPlan && styles.guidanceTeacherPlanBadge
                ]}>
                  <Ionicons 
                    name={isGuidanceTeacherPlan ? "shield-checkmark" : "school"} 
                    size={12} 
                    color="#fff" 
                  />
                  <Text style={styles.teacherPlanBadgeText}>
                    {isGuidanceTeacherPlan ? 'Rehber Öğretmen' : 'Öğretmen'}
                  </Text>
                </View>
              )}
            </View>
            <View style={[
              styles.completionIndicator,
              item.is_completed && styles.completedIndicator
            ]}>
              <Ionicons 
                name={item.is_completed ? "checkmark" : "ellipse-outline"} 
                size={24} 
                color={item.is_completed ? "#4CAF50" : "#ccc"} 
              />
            </View>
          </View>
          
          {item.description && (
            <Text style={styles.planDescription}>{item.description}</Text>
          )}
          
          <View style={styles.planFooter}>
            <Text style={styles.planDate}>
              {activeTab === 'daily' 
                ? new Date(item.plan_date).toLocaleDateString('tr-TR')
                : `${new Date(item.week_start_date).toLocaleDateString('tr-TR')} - ${new Date(new Date(item.week_start_date).getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR')}`
              }
            </Text>
          </View>
          
          <View style={styles.planActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEditPlan(item)}
            >
              <Ionicons name="create-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeletePlan(item)}
            >
              <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Card>
    );
  };

  if (loading && students.length === 0) {
    return (
      <Container>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Öğrenciler yükleniyor...</Text>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <View style={styles.container}>
        <Text style={styles.title}>Öğrenci Planları</Text>
        
        {/* Students List */}
        <View style={styles.studentsSection}>
          <Text style={styles.sectionTitle}>Öğrenciler</Text>
          
          {students.length === 0 && !loading ? (
            <View style={styles.emptyStudentsContainer}>
              <Ionicons name="people-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStudentsText}>
                {isGuidanceTeacher ? 'Kurumda öğrenci bulunamadı' : 'Bağlı öğrenci yok'}
              </Text>
              <Text style={styles.emptyStudentsSubtext}>
                {isGuidanceTeacher 
                  ? 'Kurumunuzda henüz öğrenci kaydı bulunmuyor' 
                  : 'Öğrenciler bağlandığında burada görünecek'}
              </Text>
            </View>
          ) : (
            <>
              {/* Search Input */}
              <TextInput
                style={styles.searchInput}
                placeholder="Öğrenci adı ile ara..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#999"
              />
              <FlatList
                data={students.filter(student => 
                  student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  student.email?.toLowerCase().includes(searchQuery.toLowerCase())
                )}
                renderItem={renderStudentItem}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.studentsList}
                contentContainerStyle={styles.studentsListContent}
                ListEmptyComponent={() => (
                  <View style={styles.emptySearchContainer}>
                    <Text style={styles.emptySearchText}>Arama sonucu bulunamadı</Text>
                  </View>
                )}
              />
            </>
          )}
        </View>

        {selectedStudent && (
          <>
            {/* Tab Buttons */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'daily' && styles.activeTab]}
                onPress={() => setActiveTab('daily')}
              >
                <Text style={[styles.tabText, activeTab === 'daily' && styles.activeTabText]}>
                  Günlük Planlar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'weekly' && styles.activeTab]}
                onPress={() => setActiveTab('weekly')}
              >
                <Text style={[styles.tabText, activeTab === 'weekly' && styles.activeTabText]}>
                  Haftalık Planlar
                </Text>
              </TouchableOpacity>
            </View>

            {/* Plans List */}
            <FlatList
              data={studentPlans}
              renderItem={renderPlanItem}
              keyExtractor={(item) => item.id}
              style={styles.plansList}
              contentContainerStyle={styles.plansListContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Ionicons name="calendar-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>
                    {activeTab === 'daily' ? 'Henüz günlük plan yok' : 'Henüz haftalık plan yok'}
                  </Text>
                  <Text style={styles.emptySubtext}>
                    {activeTab === 'daily' 
                      ? 'Öğrenci için günlük plan oluşturun'
                      : 'Öğrenci için haftalık plan oluşturun'
                    }
                  </Text>
                </View>
              )}
            />

            {/* Add Button */}
            <TouchableOpacity style={styles.addButton} onPress={handleAddPlan}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        {!selectedStudent && (
          <View style={styles.noStudentContainer}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.noStudentText}>Öğrenci Seçin</Text>
            <Text style={styles.noStudentSubtext}>
              Plan oluşturmak için önce bir öğrenci seçin
            </Text>
          </View>
        )}
      </View>

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingPlan ? 'Planı Düzenle' : 'Yeni Plan Ekle'}
            </Text>
            
            <Text style={styles.modalSubtitle}>
              {selectedStudent?.name} için {activeTab === 'daily' ? 'günlük' : 'haftalık'} plan
            </Text>
            
            <Input
              label="Plan Başlığı"
              value={planTitle}
              onChangeText={setPlanTitle}
              placeholder="Plan başlığını girin"
              style={styles.modalInput}
            />
            
            <Input
              label="Açıklama"
              value={planDescription}
              onChangeText={setPlanDescription}
              placeholder="Plan açıklamasını girin (opsiyonel)"
              multiline
              numberOfLines={3}
              style={styles.modalInput}
            />
            
            <Input
              label={activeTab === 'daily' ? 'Tarih' : 'Hafta Başlangıcı'}
              value={planDate}
              onChangeText={setPlanDate}
              placeholder="YYYY-MM-DD"
              style={styles.modalInput}
            />
            
            <View style={styles.modalButtons}>
              <Button
                title="İptal"
                onPress={() => setShowAddModal(false)}
                variant="ghost"
                style={styles.modalButton}
              />
              <Button
                title={editingPlan ? 'Güncelle' : 'Ekle'}
                onPress={handleSavePlan}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  studentsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 20,
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  emptyStudentsContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 20,
  },
  emptyStudentsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStudentsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptySearchContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 14,
    color: '#999',
  },
  studentsList: {
    maxHeight: 100,
  },
  studentsListContent: {
    paddingHorizontal: 20,
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    minWidth: 120,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedStudentCard: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  defaultAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  studentEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  plansList: {
    flex: 1,
  },
  plansListContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  planCard: {
    marginBottom: 12,
  },
  planContent: {
    padding: 16,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  planTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  teacherPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9C27B0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  guidanceTeacherPlanBadge: {
    backgroundColor: '#673AB7', // Daha koyu mor rehber öğretmen için
  },
  teacherPlanBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 4,
  },
  planDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  planFooter: {
    marginBottom: 12,
  },
  planDate: {
    fontSize: 12,
    color: '#999',
  },
  planActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  completionIndicator: {
    padding: 4,
  },
  completedIndicator: {
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
  },
  editButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f0f8ff',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fff5f5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  noStudentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noStudentText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  noStudentSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  addButton: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
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
});

export default TeacherPlanScreen;
