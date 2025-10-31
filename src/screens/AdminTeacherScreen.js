import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
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

const AdminTeacherScreen = () => {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Yeni öğretmen form verileri
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    school_id: '',
    teacher_code: '',
  });

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select(`
          id,
          name,
          email,
          subject,
          teacher_code,
          is_active,
          created_at,
          user_id
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error('Öğretmenler yüklenirken hata:', error);
      Alert.alert('Hata', 'Öğretmenler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const generateTeacherCode = () => {
    const prefix = 'TCH';
    const randomNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}${randomNumber}`;
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Hata', 'Öğretmen adı soyadı gereklidir');
      return false;
    }
    if (!formData.email.trim()) {
      Alert.alert('Hata', 'E-posta gereklidir');
      return false;
    }
    if (!formData.subject.trim()) {
      Alert.alert('Hata', 'Branş gereklidir');
      return false;
    }
    if (!formData.school_id.trim()) {
      Alert.alert('Hata', 'Okul seçimi gereklidir');
      return false;
    }
    return true;
  };

  const handleAddTeacher = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const fullName = formData.name.trim();

      // Önce kullanıcının var olup olmadığını kontrol et
      const { data: existingUser } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: 'teacher123'
      });

      let authData;
      if (existingUser.user) {
        // Kullanıcı zaten var, mevcut kullanıcıyı kullan
        authData = existingUser;
      } else {
        // Yeni kullanıcı oluştur
        const { data: newUser, error: authError } = await supabase.auth.signUp({
          email: formData.email.trim(),
          password: 'teacher123',
          options: {
            data: {
              first_name: formData.name.split(' ')[0] || '',
              last_name: formData.name.split(' ').slice(1).join(' ') || '',
              user_type: 'teacher'
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
          user_type: 'teacher',
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

      // Öğretmen kodu oluştur
      const teacherCode = formData.teacher_code || generateTeacherCode();

      // Teachers tablosuna kayıt ekle
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .insert({
          user_id: authData.user.id,
          name: fullName,
          email: formData.email.trim(),
          subject: formData.subject.trim(),
          teacher_code: teacherCode,
          school_id: formData.school_id || null,
          is_active: true,
        })
        .select()
        .single();

      if (teacherError) {
        console.error('Teacher oluşturma hatası:', teacherError);
        Alert.alert('Hata', 'Öğretmen bilgileri kaydedilemedi');
        return;
      }

      Alert.alert(
        'Başarılı! 🎉',
        `Öğretmen başarıyla kaydedildi!\n\nGiriş Bilgileri:\nE-posta: ${formData.email.trim()}\nŞifre: teacher123\n\nÖğretmen Kodu: ${teacherCode}\n\nBu bilgileri öğretmene verin.`,
        [
          {
            text: 'Tamam',
            onPress: () => {
              setShowAddForm(false);
              setFormData({
                name: '',
                email: '',
                subject: '',
                school_id: '',
                teacher_code: '',
              });
              loadTeachers();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Öğretmen kaydetme hatası:', error);
      Alert.alert('Hata', 'Öğretmen kaydedilemedi: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderTeacher = ({ item }) => (
    <Card style={styles.teacherCard}>
      <View style={styles.teacherHeader}>
        <View style={styles.teacherInfo}>
          <Text style={styles.teacherName}>{item.name || 'İsimsiz Öğretmen'}</Text>
          <Text style={styles.teacherEmail}>{item.email || 'E-posta yok'}</Text>
          {item.subject && (
            <Text style={styles.teacherSubject}>📚 {item.subject}</Text>
          )}
          <Text style={styles.teacherCode}>Kod: {item.teacher_code}</Text>
          <Text style={styles.teacherDate}>
            Kayıt: {new Date(item.created_at).toLocaleDateString('tr-TR')}
          </Text>
        </View>
        <View style={styles.teacherStatus}>
          <View style={[styles.statusDot, { backgroundColor: item.is_active ? '#4CAF50' : '#F44336' }]} />
          <Text style={styles.statusText}>{item.is_active ? 'Aktif' : 'Pasif'}</Text>
        </View>
      </View>
    </Card>
  );

  if (loading) {
    return (
      <Container>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Öğretmenler yükleniyor...</Text>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Öğretmen Yönetimi</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddForm(true)}
          >
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.addButtonText}>Yeni Öğretmen</Text>
          </TouchableOpacity>
        </View>

        {showAddForm && (
          <Card style={styles.addForm}>
            <Text style={styles.formTitle}>Yeni Öğretmen Ekle</Text>
            
            <Input
              placeholder="Ad Soyad"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
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
              placeholder="Branş (Matematik, Türkçe, vb.)"
              value={formData.subject}
              onChangeText={(text) => setFormData({ ...formData, subject: text })}
              style={styles.input}
            />
            
            <Input
              placeholder="Okul ID (UUID)"
              value={formData.school_id}
              onChangeText={(text) => setFormData({ ...formData, school_id: text })}
              style={styles.input}
            />
            
            <Input
              placeholder="Öğretmen Kodu (boş bırakılırsa otomatik oluşturulur)"
              value={formData.teacher_code}
              onChangeText={(text) => setFormData({ ...formData, teacher_code: text })}
              style={styles.input}
            />

            <View style={styles.formButtons}>
              <Button
                title="İptal"
                onPress={() => setShowAddForm(false)}
                style={[styles.button, styles.cancelButton]}
              />
              <Button
                title={saving ? "Kaydediliyor..." : "Kaydet"}
                onPress={handleAddTeacher}
                disabled={saving}
                style={[styles.button, styles.saveButton]}
              />
            </View>
          </Card>
        )}

        <ScrollView style={styles.teachersList}>
          {teachers.map((teacher) => (
            <View key={teacher.id}>
              {renderTeacher({ item: teacher })}
            </View>
          ))}
        </ScrollView>
      </View>
    </Container>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
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
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  addForm: {
    marginBottom: 20,
    padding: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: colors.error,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  teachersList: {
    flex: 1,
  },
  teacherCard: {
    marginBottom: 12,
    padding: 16,
  },
  teacherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  teacherInfo: {
    flex: 1,
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  teacherEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  teacherSubject: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  teacherCode: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  teacherSchool: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  teacherStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  teacherDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default AdminTeacherScreen;
