import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Container, Button, Input, Card, AdBanner, InterstitialAd } from '../components';
import { supabase } from '../lib/supabase';

const StudentPlanScreen = ({ route }) => {
  const isDemo = route?.params?.isDemo || false;
  const [dailyPlans, setDailyPlans] = useState([]);
  const [weeklyPlans, setWeeklyPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' or 'weekly'
  
  // Modal state'leri
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planTitle, setPlanTitle] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [showCompletedPlans, setShowCompletedPlans] = useState(false);
  const [expandedPlans, setExpandedPlans] = useState(new Set());

  // Interstitial reklam hook'u - screen name ile
  const { showAd: showInterstitialAd, isLoaded: isInterstitialLoaded } = InterstitialAd(null, 'studentPlan');

  useEffect(() => {
    if (isDemo) {
      loadDemoPlans();
    } else {
      loadPlans();
    }
  }, [isDemo, activeTab]);

  // Sayfa her odaklandığında planları yenile
  useFocusEffect(
    React.useCallback(() => {
      if (!isDemo) {
        loadPlans();
      }
    }, [isDemo, activeTab])
  );

  // Akıllı realtime güncelleme - sadece değişiklik olduğunda güncelle
  useEffect(() => {
    if (isDemo) return;
    
    const interval = setInterval(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Sadece plan sayısını kontrol et
        let currentCount;
        if (activeTab === 'daily') {
          const { count } = await supabase
            .from('student_daily_plans')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', user.id);
          currentCount = count;
        } else {
          const { count } = await supabase
            .from('student_weekly_plans')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', user.id);
          currentCount = count;
        }

        // Eğer plan sayısı değiştiyse tam yükleme yap
        const currentPlans = activeTab === 'daily' ? dailyPlans : weeklyPlans;
        if (currentCount !== currentPlans.length) {
          loadPlans();
        }
      } catch (error) {
        // Hata durumunda sessizce devam et
      }
    }, 30000); // 30 saniyede bir kontrol et

    return () => clearInterval(interval);
  }, [isDemo, activeTab, dailyPlans.length, weeklyPlans.length]);

  const loadDemoPlans = () => {
    const demoDailyPlans = [
      {
        id: '1',
        plan_date: new Date().toISOString().split('T')[0],
        title: 'Matematik ödevini tamamla',
        description: 'Sayfa 45-50 arası problemleri çöz',
        is_completed: false,
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        plan_date: new Date().toISOString().split('T')[0],
        title: 'Fizik konu tekrarı',
        description: 'Enerji konusunu tekrar et',
        is_completed: true,
        created_at: new Date().toISOString(),
      },
    ];

    const demoWeeklyPlans = [
      {
        id: '1',
        week_start_date: getWeekStartDate(new Date()),
        title: 'Matematik sınavına hazırlan',
        description: 'Tüm konuları tekrar et ve test çöz',
        is_completed: false,
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        week_start_date: getWeekStartDate(new Date()),
        title: 'Fizik projesi',
        description: 'Enerji dönüşümü projesini tamamla',
        is_completed: false,
        created_at: new Date().toISOString(),
      },
    ];

    setDailyPlans(demoDailyPlans);
    setWeeklyPlans(demoWeeklyPlans);
  };

  const loadPlans = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (activeTab === 'daily') {
        const { data, error } = await supabase
          .from('student_daily_plans')
          .select(`
            *,
            created_by_teacher:teachers!student_daily_plans_teacher_id_fkey(
              id,
              user_id
            )
          `)
          .eq('student_id', user.id)
          .order('plan_date', { ascending: false });

        if (error) throw error;
        
        // Öğretmen adlarını ve rehber öğretmen bilgisini al
        const plansWithTeacherNames = await Promise.all(
          (data || []).map(async (plan) => {
            if (plan.created_by_teacher?.id) {
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('name')
                .eq('user_id', plan.created_by_teacher.user_id)
                .single();
              
              // Rehber öğretmen kontrolü
              const { data: institutionData } = await supabase
                .from('institutions')
                .select('id')
                .eq('guidance_teacher_id', plan.created_by_teacher.id)
                .eq('is_active', true)
                .maybeSingle();
              
              return {
                ...plan,
                teacherName: profile?.name || 'Öğretmen',
                isGuidanceTeacher: !!institutionData
              };
            }
            return plan;
          })
        );
        
        setDailyPlans(plansWithTeacherNames);
      } else {
        const { data, error } = await supabase
          .from('student_weekly_plans')
          .select(`
            *,
            created_by_teacher:teachers!student_weekly_plans_teacher_id_fkey(
              id,
              user_id
            )
          `)
          .eq('student_id', user.id)
          .order('week_start_date', { ascending: false });

        if (error) throw error;
        
        // Öğretmen adlarını ve rehber öğretmen bilgisini al
        const plansWithTeacherNames = await Promise.all(
          (data || []).map(async (plan) => {
            if (plan.created_by_teacher?.id) {
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('name')
                .eq('user_id', plan.created_by_teacher.user_id)
                .single();
              
              // Rehber öğretmen kontrolü
              const { data: institutionData } = await supabase
                .from('institutions')
                .select('id')
                .eq('guidance_teacher_id', plan.created_by_teacher.id)
                .eq('is_active', true)
                .maybeSingle();
              
              return {
                ...plan,
                teacherName: profile?.name || 'Öğretmen',
                isGuidanceTeacher: !!institutionData
              };
            }
            return plan;
          })
        );
        
        setWeeklyPlans(plansWithTeacherNames);
      }
    } catch (error) {
      console.error('Planlar yüklenirken hata:', error);
      Alert.alert('Hata', 'Planlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const getWeekStartDate = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Pazartesi
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  };

  const handleAddPlan = () => {
    // Önce interstitial reklam göster
    if (isInterstitialLoaded) {
      showInterstitialAd();
    }
    
    // Sonra plan ekleme modalını aç
    setEditingPlan(null);
    setPlanTitle('');
    setPlanDescription('');
    setPlanDate(activeTab === 'daily' ? new Date().toISOString().split('T')[0] : getWeekStartDate(new Date()));
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

    if (isDemo) {
      Alert.alert('Demo Mod', 'Demo modda plan kaydedilemez');
      setShowAddModal(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const planData = {
        student_id: user.id,
        title: planTitle.trim(),
        description: planDescription.trim(),
      };

      if (activeTab === 'daily') {
        planData.plan_date = planDate;
        
        if (editingPlan) {
          const { error } = await supabase
            .from('student_daily_plans')
            .update(planData)
            .eq('id', editingPlan.id);
          
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('student_daily_plans')
            .insert(planData);
          
          if (error) throw error;
        }
      } else {
        planData.week_start_date = planDate;
        
        if (editingPlan) {
          const { error } = await supabase
            .from('student_weekly_plans')
            .update(planData)
            .eq('id', editingPlan.id);
          
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('student_weekly_plans')
            .insert(planData);
          
          if (error) throw error;
        }
      }

      setShowAddModal(false);
      loadPlans();
      Alert.alert('Başarılı', editingPlan ? 'Plan güncellendi' : 'Plan eklendi');
    } catch (error) {
      console.error('Plan kaydedilirken hata:', error);
      Alert.alert('Hata', 'Plan kaydedilemedi');
    }
  };

  const handleToggleComplete = async (plan) => {
    if (isDemo) {
      Alert.alert('Demo Mod', 'Demo modda plan durumu değiştirilemez');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const tableName = activeTab === 'daily' ? 'student_daily_plans' : 'student_weekly_plans';
      const { error } = await supabase
        .from(tableName)
        .update({ is_completed: !plan.is_completed })
        .eq('id', plan.id);

      if (error) throw error;

      // State'i doğrudan güncelle - ekran yenilenme olmadan
      if (activeTab === 'daily') {
        setDailyPlans(prevPlans => 
          prevPlans.map(p => 
            p.id === plan.id ? { ...p, is_completed: !p.is_completed } : p
          )
        );
      } else {
        setWeeklyPlans(prevPlans => 
          prevPlans.map(p => 
            p.id === plan.id ? { ...p, is_completed: !p.is_completed } : p
          )
        );
      }
    } catch (error) {
      console.error('Plan durumu güncellenirken hata:', error);
      Alert.alert('Hata', 'Plan durumu güncellenemedi');
    }
  };

  const togglePlanExpansion = (planId) => {
    setExpandedPlans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(planId)) {
        newSet.delete(planId);
      } else {
        newSet.add(planId);
      }
      return newSet;
    });
  };

  const handleDeletePlan = async (plan) => {
    Alert.alert(
      'Planı Sil',
      'Bu planı silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            if (isDemo) {
              Alert.alert('Demo Mod', 'Demo modda plan silinemez');
              return;
            }

            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              const tableName = activeTab === 'daily' ? 'student_daily_plans' : 'student_weekly_plans';
              const { error } = await supabase
                .from(tableName)
                .delete()
                .eq('id', plan.id);

              if (error) throw error;

              loadPlans();
              Alert.alert('Başarılı', 'Plan silindi');
            } catch (error) {
              console.error('Plan silinirken hata:', error);
              Alert.alert('Hata', 'Plan silinemedi');
            }
          }
        }
      ]
    );
  };

  const renderPlanItem = ({ item }) => {
    const isTeacherPlan = item.created_by_teacher;
    const teacherName = item.teacherName || 'Öğretmen';
    const isExpanded = expandedPlans.has(item.id);
    const hasLongDescription = item.description && item.description.length > 100;
    
    return (
      <Card style={[
        styles.planCard, 
        isTeacherPlan ? styles.teacherPlanCard : styles.studentPlanCard,
        activeTab === 'daily' && (isTeacherPlan ? styles.teacherDailyCard : styles.studentDailyCard),
        activeTab === 'weekly' && (isTeacherPlan ? styles.teacherWeeklyCard : styles.studentWeeklyCard)
      ]}>
        <View style={styles.planContent}>
          <View style={styles.planHeader}>
            <View style={styles.planInfo}>
              {/* Plan türü badge'i */}
              {isTeacherPlan ? (
                <View style={[
                  styles.teacherBadge,
                  item.isGuidanceTeacher && styles.guidanceTeacherBadge
                ]}>
                  <Ionicons 
                    name={item.isGuidanceTeacher ? "shield-checkmark" : "school"} 
                    size={12} 
                    color="#fff" 
                  />
                  <Text style={styles.teacherBadgeText}>
                    {item.isGuidanceTeacher 
                      ? `${teacherName} (Rehber Öğretmen) tarafından oluşturuldu`
                      : `${teacherName} tarafından oluşturuldu`
                    }
                  </Text>
                </View>
              ) : (
                <View style={styles.studentBadge}>
                  <Ionicons name="person" size={12} color="#fff" />
                  <Text style={styles.studentBadgeText}>
                    Kendi planım
                  </Text>
                </View>
              )}
              
              <Text style={[
                styles.planTitle,
                item.is_completed && styles.completedPlanTitle
              ]}>
                {item.title}
              </Text>
              
              {/* Açıklama - kompakt veya genişletilmiş */}
              {item.description && (
                <View style={styles.descriptionContainer}>
                  <Text style={styles.planDescription} numberOfLines={isExpanded ? 0 : 2}>
                    {item.description}
                  </Text>
                  {hasLongDescription && (
                    <TouchableOpacity
                      style={styles.expandButton}
                      onPress={() => togglePlanExpansion(item.id)}
                    >
                      <Text style={styles.expandButtonText}>
                        {isExpanded ? 'Daha az göster' : 'Daha fazla göster'}
                      </Text>
                      <Ionicons 
                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                        size={16} 
                        color="#007AFF" 
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )}
              
              <Text style={styles.planDate}>
                {activeTab === 'daily' 
                  ? new Date(item.plan_date).toLocaleDateString('tr-TR')
                  : `${new Date(item.week_start_date).toLocaleDateString('tr-TR')} - ${new Date(new Date(item.week_start_date).getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR')}`
                }
              </Text>
            </View>
            <View style={styles.planActions}>
              <TouchableOpacity
                style={[
                  styles.completionIndicator,
                  item.is_completed && styles.completedIndicator
                ]}
                onPress={() => handleToggleComplete(item)}
              >
                <Ionicons 
                  name={item.is_completed ? "checkmark-circle" : "ellipse-outline"} 
                  size={24} 
                  color={item.is_completed ? "#4CAF50" : "#ccc"} 
                />
              </TouchableOpacity>
              {item.is_completed && (
                <Text style={styles.completedText}>Tamamlandı</Text>
              )}
              
              {/* Sadece öğrencinin kendi planları için düzenleme/silme butonları */}
              {!isTeacherPlan && (
                <>
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
                </>
              )}
            </View>
          </View>
        </View>
      </Card>
    );
  };

  if (loading) {
    return (
      <Container>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Planlar yükleniyor...</Text>
        </View>
      </Container>
    );
  }

  const currentPlans = activeTab === 'daily' ? dailyPlans : weeklyPlans;

  return (
    <Container>
      <View style={styles.container}>
        <Text style={styles.title}>Planlarım</Text>
        
        {/* Tab Buttons */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'daily' && styles.activeDailyTab]}
            onPress={() => setActiveTab('daily')}
          >
            <Ionicons 
              name="calendar-outline" 
              size={16} 
              color={activeTab === 'daily' ? '#fff' : '#007AFF'} 
            />
            <Text style={[styles.tabText, activeTab === 'daily' && styles.activeTabText]}>
              Günlük Planlar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'weekly' && styles.activeWeeklyTab]}
            onPress={() => setActiveTab('weekly')}
          >
            <Ionicons 
              name="calendar" 
              size={16} 
              color={activeTab === 'weekly' ? '#fff' : '#34C759'} 
            />
            <Text style={[styles.tabText, activeTab === 'weekly' && styles.activeTabText]}>
              Haftalık Planlar
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Günlük/Haftalık Planlar Altı Banner Reklam */}
        <AdBanner 
          style={styles.plansBanner}
          screenName="studentPlan"
          onAdLoaded={() => console.log('Plans banner ad loaded')}
          onAdFailedToLoad={(error) => console.log('Plans banner ad failed:', error)}
        />
        
        {/* Plans List */}
        <FlatList
          data={currentPlans.filter(plan => !plan.is_completed)}
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
                  ? 'Bugün için plan oluşturmaya başlayın'
                  : 'Bu hafta için plan oluşturmaya başlayın'
                }
              </Text>
            </View>
          )}
          ListFooterComponent={() => {
            const completedPlans = currentPlans.filter(plan => plan.is_completed);
            if (completedPlans.length === 0) return null;
            
            return (
              <View style={styles.completedSection}>
                <TouchableOpacity 
                  style={styles.completedSectionHeader}
                  onPress={() => setShowCompletedPlans(!showCompletedPlans)}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={styles.completedSectionTitle}>
                    Tamamlanan Planlar ({completedPlans.length})
                  </Text>
                  <Ionicons 
                    name={showCompletedPlans ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#4CAF50" 
                  />
                </TouchableOpacity>
                {showCompletedPlans && (
                  <View style={styles.completedPlansList}>
                    {completedPlans.map((plan) => (
                      <View key={plan.id} style={styles.completedPlanItem}>
                        {renderPlanItem({ item: plan })}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
        />

        {/* Add Button */}
        <TouchableOpacity style={styles.addButton} onPress={handleAddPlan}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  activeDailyTab: {
    backgroundColor: '#007AFF',
  },
  activeWeeklyTab: {
    backgroundColor: '#34C759',
  },
  tabText: {
    fontSize: 16,
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
      // Öğretmen planları - Turuncu tonları
      teacherPlanCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#FF9800',
      },
      teacherDailyCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#FF9800',
        backgroundColor: '#FFF8E1',
      },
      teacherWeeklyCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#FF9800',
        backgroundColor: '#FFF3E0',
      },
      
      // Öğrenci planları - Mavi tonları
      studentPlanCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#4A90E2',
      },
      studentDailyCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#4A90E2',
        backgroundColor: '#F0F8FF',
      },
      studentWeeklyCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#4A90E2',
        backgroundColor: '#E6F3FF',
      },
  teacherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  guidanceTeacherBadge: {
    backgroundColor: '#9C27B0', // Mor renk rehber öğretmen için
  },
  teacherBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },
  studentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  studentBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },
  planContent: {
    padding: 12,
    position: 'relative',
  },
  planTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  planInfo: {
    flex: 1,
    marginRight: 12,
  },
  planTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  completedPlanTitle: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  planDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    lineHeight: 16,
  },
  planDate: {
    fontSize: 11,
    color: '#999',
  },
  planActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completionIndicator: {
    marginRight: 8,
  },
  completedIndicator: {
    // Stil zaten completionIndicator'da
  },
  completedText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 4,
  },
  completedSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  completedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F0F8F0',
    borderRadius: 8,
    marginBottom: 8,
  },
  completedSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 8,
    flex: 1,
  },
  completedPlansList: {
    marginTop: 8,
  },
  completedPlanItem: {
    opacity: 0.7,
    marginBottom: 8,
  },
  descriptionContainer: {
    marginTop: 4,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 4,
  },
  expandButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginRight: 4,
  },
  editButton: {
    padding: 8,
    marginRight: 4,
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
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
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  plansBanner: {
    marginHorizontal: 20,
    marginVertical: 15,
    borderRadius: 8,
    overflow: 'hidden',
    height: 60,
  },
});

export default StudentPlanScreen;
