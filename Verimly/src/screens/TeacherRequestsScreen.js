import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_COLORS, COLORS } from '../constants/theme';
import { SIZES, SHADOWS } from '../constants/theme';
import Container from '../components/Container';
import Card from '../components/Card';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';

const TeacherRequestsScreen = () => {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentAvatars, setStudentAvatars] = useState({});

  useEffect(() => {
    loadPendingRequests();
  }, []);

  // Ekran her odaklandığında istekleri yenile
  useFocusEffect(
    React.useCallback(() => {
      loadPendingRequests();
    }, [])
  );

  // Real-time güncelleme için interval ekle
  useEffect(() => {
    // Her 30 saniyede bir istekleri kontrol et (loading gösterme)
    const interval = setInterval(() => {
      loadPendingRequests(false); // Loading gösterme
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadPendingRequests = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const { getPendingRequests } = await import('../lib/teacherApi');
      const result = await getPendingRequests();
      
      if (result.success) {
        setPendingRequests(result.data || []);
        
        // Öğrenci avatarlarını yükle
        await loadStudentAvatars(result.data || []);
      } else {
        console.error('Onay bekleyen istekler yüklenirken hata:', result.error);
        Alert.alert('Hata', result.error);
      }
    } catch (error) {
      console.error('Onay bekleyen istekler yüklenirken hata:', error);
      Alert.alert('Hata', 'Bir hata oluştu.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const loadStudentAvatars = async (requests) => {
    try {
      if (!requests || requests.length === 0) return;

      const studentIds = requests.map(request => request.student_id);
      
      const { data: studentProfiles, error } = await supabase
        .from('user_profiles')
        .select('user_id, selected_avatar')
        .in('user_id', studentIds);

      if (error) {
        console.error('Öğrenci avatarları yüklenirken hata:', error);
        return;
      }

      // Avatar verilerini state'e kaydet
      const avatarMap = {};
      studentProfiles?.forEach(profile => {
        avatarMap[profile.user_id] = profile.selected_avatar;
      });
      
      setStudentAvatars(avatarMap);
    } catch (error) {
      console.error('Öğrenci avatarları yüklenirken hata:', error);
    }
  };

  const handleApproveRequest = async (requestId, studentName, requestType) => {
    const isConnectRequest = requestType === 'connect';
    Alert.alert(
      isConnectRequest ? 'İsteği Onayla' : 'Bağlantıyı Kes',
      isConnectRequest 
        ? `${studentName} öğrencisinin bağlantı isteğini onaylamak istediğinizden emin misiniz?`
        : `${studentName} öğrenciyle bağlantıyı kesmek istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: isConnectRequest ? 'Onayla' : 'Kes',
          onPress: async () => {
            try {
              if (requestType === 'connect') {
                const { approveStudentRequest } = await import('../lib/teacherApi');
                const result = await approveStudentRequest(requestId);
                
                if (result.success) {
                  Alert.alert('Başarılı', result.message);
                  loadPendingRequests(); // Listeyi yenile
                } else {
                  Alert.alert('Hata', result.error);
                }
              } else {
                // Kesme isteği için approveDisconnectionRequest kullan
                const { approveDisconnectionRequest } = await import('../lib/teacherApi');
                const result = await approveDisconnectionRequest(requestId);
                
                if (result.success) {
                  Alert.alert('Başarılı', result.message);
                  loadPendingRequests(); // Listeyi yenile
                } else {
                  Alert.alert('Hata', result.error);
                }
              }
            } catch (error) {
              console.error('İstek onaylanırken hata:', error);
              Alert.alert('Hata', 'Bir hata oluştu.');
            }
          }
        }
      ]
    );
  };

  const handleRejectRequest = async (requestId, studentName) => {
    Alert.alert(
      'İsteği Reddet',
      `${studentName} öğrencisinin isteğini reddetmek istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Reddet',
          style: 'destructive',
          onPress: async () => {
            try {
              const { rejectStudentRequest } = await import('../lib/teacherApi');
              const result = await rejectStudentRequest(requestId);
              
              if (result.success) {
                Alert.alert('Başarılı', result.message);
                loadPendingRequests(); // Listeyi yenile
              } else {
                Alert.alert('Hata', result.error);
              }
            } catch (error) {
              console.error('İstek reddedilirken hata:', error);
              Alert.alert('Hata', 'Bir hata oluştu.');
            }
          }
        }
      ]
    );
  };

  const getStudentName = (student) => {
    if (student?.user_metadata?.full_name) {
      return student.user_metadata.full_name;
    }
    if (student?.user_metadata?.name) {
      return student.user_metadata.name;
    }
    return student?.email?.split('@')[0] || 'Bilinmeyen Öğrenci';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Container>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Öğrenci İstekleri</Text>
          <Text style={styles.subtitle}>Onay bekleyen öğrenci başvuruları</Text>
        </View>

        {/* İstekler Listesi */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Yükleniyor...</Text>
          </View>
        ) : pendingRequests.length > 0 ? (
          <View style={styles.requestsList}>
            {pendingRequests.map((request) => (
              <Card key={request.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={styles.studentInfo}>
                    <View style={styles.studentAvatar}>
                      <Text style={styles.studentAvatarEmoji}>
                        {studentAvatars[request.student_id] || '👤'}
                      </Text>
                    </View>
                    <View style={styles.studentDetails}>
                      <Text style={styles.studentName}>
                        {getStudentName(request.students)}
                      </Text>
                      <Text style={styles.studentEmail}>
                        {request.students?.email}
                      </Text>
                      <Text style={styles.requestDate}>
                        {formatDate(request.created_at)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>
                      {request.request_type === 'connect' ? 'BAĞLANTI İSTEĞİ' : 'KESME İSTEĞİ'}
                    </Text>
                  </View>
                </View>

                <View style={styles.requestActions}>
                  <Button
                    title={request.request_type === 'connect' ? 'Reddet' : 'İptal'}
                    onPress={() => handleRejectRequest(request.id, getStudentName(request.students))}
                    style={[styles.rejectButton, { backgroundColor: colors.error }]}
                    textStyle={[styles.rejectButtonText, { color: colors.surface }]}
                  />
                  <Button
                    title={request.request_type === 'connect' ? 'Onayla' : 'Kes'}
                    onPress={() => handleApproveRequest(request.id, getStudentName(request.students), request.request_type)}
                    style={[styles.approveButton, { backgroundColor: colors.success }]}
                    textStyle={[styles.approveButtonText, { color: colors.surface }]}
                  />
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={64} color={colors.textLight} />
            <Text style={styles.emptyTitle}>Onay Bekleyen İstek Yok</Text>
            <Text style={styles.emptySubtitle}>
              Şu anda onay bekleyen öğrenci başvurusu bulunmuyor.
            </Text>
          </View>
        )}
      </ScrollView>
    </Container>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: SIZES.padding,
    alignItems: 'center',
  },
  title: {
    fontSize: SIZES.h2,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.padding * 2,
  },
  loadingText: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
  },
  requestsList: {
    padding: SIZES.padding,
    gap: 16,
  },
  requestCard: {
    padding: SIZES.padding,
    ...SHADOWS.medium,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarEmoji: {
    fontSize: 20,
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  studentEmail: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  requestDate: {
    fontSize: SIZES.tiny,
    color: colors.textLight,
  },
  statusBadge: {
    backgroundColor: colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: SIZES.tiny,
    fontWeight: '600',
    color: colors.surface,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: SIZES.radius,
    alignItems: 'center',
  },
  rejectButtonText: {
    fontSize: SIZES.body,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: SIZES.radius,
    alignItems: 'center',
  },
  approveButtonText: {
    fontSize: SIZES.body,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.padding * 2,
  },
  emptyTitle: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default TeacherRequestsScreen;
