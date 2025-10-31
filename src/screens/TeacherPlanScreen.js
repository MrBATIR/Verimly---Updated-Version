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
      if (!user) return;

      const { data, error } = await supabase
        .from('teacher_students')
        .select(`
          student_id,
          user_profiles!teacher_students_student_id_fkey (
            user_id,
            name,
            email,
            avatar_url
          )
        `)
        .eq('teacher_id', user.id);

      if (error) {
        console.error('Öğrenciler yüklenirken hata:', error);
        return;
      }

      const studentsData = data.map(item => ({
        id: item.student_id,
        name: item.user_profiles.name || 'İsimsiz Öğrenci',
        email: item.user_profiles.email,
        avatar_url: item.user_profiles.avatar_url,
      }));

      setStudents(studentsData);
    } catch (error) {
      console.error('Öğrenciler yüklenirken hata:', error);
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
      const tableName = activeTab === 'daily' ? 'student_daily_plans' : 'student_weekly_plans';
      const dateField = activeTab === 'daily' ? 'plan_date' : 'week_start_date';
      
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('student_id', studentId)
        .order(dateField, { ascending: false });

      if (error) {
        console.error('Öğrenci planları yüklenirken hata:', error);
        return;
      }

      setStudentPlans(data || []);
    } catch (error) {
      console.error('Öğrenci planları yüklenirken hata:', error);
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
      const tableName = activeTab === 'daily' ? 'student_daily_plans' : 'student_weekly_plans';
      const dateField = activeTab === 'daily' ? 'plan_date' : 'week_start_date';
      
      const planData = {
        student_id: selectedStudent.id,
        title: planTitle.trim(),
        description: planDescription.trim(),
        [dateField]: planDate,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from(tableName)
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(tableName)
          .insert(planData);

        if (error) throw error;
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
      const tableName = activeTab === 'daily' ? 'student_daily_plans' : 'student_weekly_plans';
      
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', plan.id);

      if (error) throw error;

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

  const renderPlanItem = ({ item }) => (
    <Card style={styles.planCard}>
      <TouchableOpacity
        style={styles.planContent}
        onPress={() => handleEditPlan(item)}
      >
        <View style={styles.planHeader}>
          <Text style={styles.planTitle}>{item.title}</Text>
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
          <FlatList
            data={students}
            renderItem={renderStudentItem}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.studentsList}
            contentContainerStyle={styles.studentsListContent}
          />
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
  planTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
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
