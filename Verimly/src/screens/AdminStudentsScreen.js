import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_COLORS, COLORS } from '../constants/theme';
import { SIZES, SHADOWS } from '../constants/theme';
import Container from '../components/Container';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';

const AdminStudentsScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState(null);
  const [studentsLoaded, setStudentsLoaded] = useState(false);

  // Yeni öğrenci form verileri
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    school: '',
    grade: '',
  });

  // useEffect kaldırıldı - öğrenciler sadece butona tıklandığında yüklenecek

  const loadStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          name,
          email,
          phone,
          school,
          grade,
          parent_name,
          parent_phone,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStudents(data || []);
      setStudentsLoaded(true);
    } catch (error) {
      console.error('Öğrenciler yüklenirken hata:', error);
      Alert.alert('Hata', 'Öğrenciler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const validateForm = () => {
    if (!formData.first_name.trim()) {
      Alert.alert('Hata', 'Ad gereklidir');
      return false;
    }
    if (!formData.last_name.trim()) {
      Alert.alert('Hata', 'Soyad gereklidir');
      return false;
    }
    if (!formData.email.trim()) {
      Alert.alert('Hata', 'E-posta gereklidir');
      return false;
    }
    return true;
  };

  const handleAddStudent = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const fullName = `${formData.first_name.trim()} ${formData.last_name.trim()}`;

      // Önce kullanıcının var olup olmadığını kontrol et
      const { data: existingUser } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: 'student123'
      });

      let authData;
      if (existingUser.user) {
        // Kullanıcı zaten var, mevcut kullanıcıyı kullan
        authData = existingUser;
      } else {
        // Yeni kullanıcı oluştur
        const { data: newUser, error: authError } = await supabase.auth.signUp({
          email: formData.email.trim(),
          password: 'student123',
          options: {
            data: {
              first_name: formData.first_name.trim(),
              last_name: formData.last_name.trim(),
              user_type: 'student'
            }
          }
        });

        if (authError) {
          console.error('Auth kullanıcı oluşturma hatası:', authError);
          Alert.alert('Hata', 'Kullanıcı oluşturulamadı: ' + authError.message);
          return;
        }
        authData = newUser;
      }

      // user_profiles tablosuna ekle (eğer yoksa)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: authData.user.id,
          user_type: 'student',
          selected_avatar: null,
          name: fullName,
          email: formData.email.trim()
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
          name: fullName,
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          school: formData.school.trim(),
          grade: formData.grade.trim(),
          parent_name: '',
          parent_phone: '',
          address: '',
          notes: ''
        });

      if (studentError) {
        console.error('Student oluşturma hatası:', studentError);
        Alert.alert('Hata', 'Öğrenci bilgileri kaydedilemedi');
        return;
      }


      // Giriş bilgilerini göster
      setGeneratedCredentials({
        email: formData.email.trim(),
        password: 'student123',
        name: fullName,
      });
      setShowCredentials(true);

      // Formu temizle
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        school: '',
        grade: '',
      });
      setShowAddForm(false);

      // Öğrenci listesini yenile
      loadStudents();

    } catch (error) {
      console.error('Öğrenci ekleme hatası:', error);
      Alert.alert('Hata', 'Öğrenci eklenemedi: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderStudent = ({ item }) => (
    <Card style={styles.studentCard}>
      <View style={styles.studentHeader}>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{item.name || 'İsimsiz Öğrenci'}</Text>
          <Text style={styles.studentEmail}>{item.email || 'E-posta yok'}</Text>
          {item.school && (
            <Text style={styles.studentSchool}>🏫 {item.school}</Text>
          )}
          {item.grade && (
            <Text style={styles.studentGrade}>📚 {item.grade}</Text>
          )}
          {item.parent_name && (
            <Text style={styles.studentParent}>👨‍👩‍👧‍👦 Veli: {item.parent_name}</Text>
          )}
          <Text style={styles.studentDate}>
            Kayıt: {new Date(item.created_at).toLocaleDateString('tr-TR')}
          </Text>
        </View>
        <View style={styles.studentActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  if (loading) {
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
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Admin Paneli</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.institutionButton}
              onPress={() => navigation.navigate('AdminInstitutions')}
            >
              <Ionicons name="business" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddForm(true)}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content}>
          {!studentsLoaded ? (
            <View style={styles.loadButtonContainer}>
              <TouchableOpacity
                style={styles.loadButton}
                onPress={loadStudents}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="people" size={24} color="#fff" />
                    <Text style={styles.loadButtonText}>Öğrencileri Görüntüle</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.loadButtonSubtext}>
                Mevcut öğrencileri görüntülemek için butona tıklayın
              </Text>
            </View>
          ) : students.length > 0 ? (
            <>
              <View style={styles.studentsHeader}>
                <Text style={styles.studentsCount}>
                  {students.length} öğrenci bulundu
                </Text>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={loadStudents}
                >
                  <Ionicons name="refresh" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {students.map((student) => (
                <View key={student.user_id}>
                  {renderStudent({ item: student })}
                </View>
              ))}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={colors.textLight} />
              <Text style={styles.emptyText}>Henüz öğrenci yok</Text>
              <Text style={styles.emptySubtext}>
                Yeni öğrenci eklemek için yukarıdaki + butonuna tıklayın
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Yeni Öğrenci Ekleme Formu */}
        <Modal
          visible={showAddForm}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <Container>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={() => setShowAddForm(false)}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Yeni Öğrenci Ekle</Text>
                <View style={styles.placeholder} />
              </View>

              <ScrollView style={styles.formContainer}>
                <Input
                  placeholder="Ad"
                  value={formData.first_name}
                  onChangeText={(text) => setFormData({ ...formData, first_name: text })}
                  style={styles.input}
                />
                
                <Input
                  placeholder="Soyad"
                  value={formData.last_name}
                  onChangeText={(text) => setFormData({ ...formData, last_name: text })}
                  style={styles.input}
                />
                
                <Input
                  placeholder="E-posta"
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  keyboardType="email-address"
                  style={styles.input}
                />
                
                <Input
                  placeholder="Telefon"
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  keyboardType="phone-pad"
                  style={styles.input}
                />
                
                <Input
                  placeholder="Okul"
                  value={formData.school}
                  onChangeText={(text) => setFormData({ ...formData, school: text })}
                  style={styles.input}
                />
                
                <Input
                  placeholder="Sınıf"
                  value={formData.grade}
                  onChangeText={(text) => setFormData({ ...formData, grade: text })}
                  style={styles.input}
                />

                <Button
                  title={saving ? "Ekleniyor..." : "Öğrenci Ekle"}
                  onPress={handleAddStudent}
                  disabled={saving}
                  style={styles.addButton}
                />
              </ScrollView>
            </View>
          </Container>
        </Modal>

        {/* Giriş Bilgileri Modal */}
        <Modal
          visible={showCredentials}
          animationType="slide"
          transparent={true}
        >
          <View style={styles.credentialsOverlay}>
            <Card style={styles.credentialsCard}>
              <Text style={styles.credentialsTitle}>Öğrenci Giriş Bilgileri</Text>
              <Text style={styles.credentialsSubtitle}>
                Bu bilgileri öğrenciye verin
              </Text>
              
              <View style={styles.credentialsInfo}>
                <Text style={styles.credentialsLabel}>Ad Soyad:</Text>
                <Text style={styles.credentialsValue}>{generatedCredentials?.name}</Text>
                
                <Text style={styles.credentialsLabel}>E-posta:</Text>
                <Text style={styles.credentialsValue}>{generatedCredentials?.email}</Text>
                
                <Text style={styles.credentialsLabel}>Şifre:</Text>
                <Text style={styles.credentialsPassword}>{generatedCredentials?.password}</Text>
              </View>

              <Button
                title="Tamam"
                onPress={() => setShowCredentials(false)}
                style={styles.credentialsButton}
              />
            </Card>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  institutionButton: {
    backgroundColor: colors.primary,
    padding: 8,
    borderRadius: 8,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  studentCard: {
    marginBottom: 12,
    padding: 16,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  studentDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  studentActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  formContainer: {
    flex: 1,
    padding: 16,
  },
  input: {
    marginBottom: 16,
  },
  credentialsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  credentialsCard: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
  },
  credentialsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  credentialsSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  credentialsInfo: {
    marginBottom: 24,
  },
  credentialsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    marginBottom: 4,
  },
  credentialsValue: {
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
  },
  credentialsPassword: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    backgroundColor: colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    textAlign: 'center',
  },
  credentialsButton: {
    backgroundColor: colors.primary,
  },
  // Yeni buton stilleri
  loadButtonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    ...SHADOWS.medium,
  },
  loadButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadButtonSubtext: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 250,
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 250,
    lineHeight: 20,
  },
  studentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  studentsCount: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
  },
  studentSchool: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: 2,
  },
  studentGrade: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: 2,
  },
  studentParent: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
});

export default AdminStudentsScreen;
