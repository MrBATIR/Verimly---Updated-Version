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
  FlatList,
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

const InstitutionAdminScreen = ({ navigation, route }) => {
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
    school: '',
    grade: '',
    phone: '',
    parentName: '',
    parentPhone: '',
    address: '',
    notes: ''
  });

  const [teacherLoading, setTeacherLoading] = useState(false);
  const [studentLoading, setStudentLoading] = useState(false);

  useEffect(() => {
    loadInstitutionData();
  }, []);

  const loadInstitutionData = async () => {
    setLoading(true);
    try {
      // Route parametrelerinden kurum bilgilerini al
      if (route?.params?.institutionData) {
        setInstitution(route.params.institutionData);
        setLoading(false);
        return;
      }

      // Fallback: Mevcut kullanıcının kurum bilgilerini al
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('institution_id')
        .eq('user_id', user.id)
        .single();

      if (userProfile?.institution_id) {
        const { data: institutionData } = await supabase
          .from('institutions')
          .select('*')
          .eq('id', userProfile.institution_id)
          .single();

        setInstitution(institutionData);
      }
    } catch (error) {
      console.error('Kurum bilgileri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeachers = async () => {
    if (!institution) return;
    
    setLoading(true);
    try {
      const { data: memberships } = await supabase
        .from('institution_memberships')
        .select('user_id')
        .eq('institution_id', institution.id);

      if (memberships) {
        const userIds = memberships.map(m => m.user_id);
        const { data: userProfiles } = await supabase
          .from('user_profiles')
          .select('user_id, name, user_type')
          .in('user_id', userIds)
          .eq('user_type', 'teacher');

        if (userProfiles) {
          const teacherData = await Promise.all(
            userProfiles.map(async (profile) => {
              const { data: teacherInfo } = await supabase
                .from('teachers')
                .select('branch, phone, experience, education, address, notes')
                .eq('user_id', profile.user_id)
                .single();

              return {
                ...profile,
                ...teacherInfo
              };
            })
          );

          setTeachers(teacherData.sort((a, b) => a.name.localeCompare(b.name)));
        }
      }
    } catch (error) {
      console.error('Öğretmen listesi yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    if (!institution) return;
    
    setLoading(true);
    try {
      const { data: memberships } = await supabase
        .from('institution_memberships')
        .select('user_id')
        .eq('institution_id', institution.id);

      if (memberships) {
        const userIds = memberships.map(m => m.user_id);
        const { data: userProfiles } = await supabase
          .from('user_profiles')
          .select('user_id, name, user_type')
          .in('user_id', userIds)
          .eq('user_type', 'student');

        if (userProfiles) {
          const studentData = await Promise.all(
            userProfiles.map(async (profile) => {
              const { data: studentInfo } = await supabase
                .from('students')
                .select('school, grade, phone, parent_name, parent_phone, address, notes')
                .eq('user_id', profile.user_id)
                .single();

              return {
                ...profile,
                ...studentInfo
              };
            })
          );

          setStudents(studentData.sort((a, b) => a.name.localeCompare(b.name)));
        }
      }
    } catch (error) {
      console.error('Öğrenci listesi yükleme hatası:', error);
    } finally {
      setLoading(false);
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
      // Yeni kullanıcı oluştur
      const { data: newUser, error: authError } = await supabase.auth.signUp({
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

      // User profile oluştur
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: newUser.user.id,
          name: `${teacherForm.firstName} ${teacherForm.lastName}`,
          user_type: 'teacher',
          email: teacherForm.email
        });

      if (profileError) throw profileError;

      // Teacher bilgilerini kaydet
      const { error: teacherError } = await supabase
        .from('teachers')
        .insert({
          user_id: newUser.user.id,
          branch: teacherForm.branch,
          phone: teacherForm.phone,
          experience: teacherForm.experience,
          education: teacherForm.education,
          address: teacherForm.address,
          notes: teacherForm.notes
        });

      if (teacherError) throw teacherError;

      // Kurum üyeliği oluştur
      const { error: membershipError } = await supabase
        .from('institution_memberships')
        .insert({
          user_id: newUser.user.id,
          institution_id: institution.id,
          role: 'teacher',
          joined_at: new Date().toISOString()
        });

      if (membershipError) throw membershipError;

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
      loadTeachers();
    } catch (error) {
      console.error('Öğretmen ekleme hatası:', error);
      Alert.alert('Hata', 'Öğretmen eklenirken bir hata oluştu.');
    } finally {
      setTeacherLoading(false);
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
      // Yeni kullanıcı oluştur
      const { data: newUser, error: authError } = await supabase.auth.signUp({
        email: studentForm.email,
        password: 'student123',
        options: {
          data: {
            first_name: studentForm.firstName,
            last_name: studentForm.lastName,
            user_type: 'student',
            school: studentForm.school,
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

      // User profile oluştur
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: newUser.user.id,
          name: `${studentForm.firstName} ${studentForm.lastName}`,
          user_type: 'student',
          email: studentForm.email
        });

      if (profileError) throw profileError;

      // Student bilgilerini kaydet
      const { error: studentError } = await supabase
        .from('students')
        .insert({
          user_id: newUser.user.id,
          school: studentForm.school,
          grade: studentForm.grade,
          phone: studentForm.phone,
          parent_name: studentForm.parentName,
          parent_phone: studentForm.parentPhone,
          address: studentForm.address,
          notes: studentForm.notes
        });

      if (studentError) throw studentError;

      // Kurum üyeliği oluştur
      const { error: membershipError } = await supabase
        .from('institution_memberships')
        .insert({
          user_id: newUser.user.id,
          institution_id: institution.id,
          role: 'student',
          joined_at: new Date().toISOString()
        });

      if (membershipError) throw membershipError;

      Alert.alert('Başarılı!', 'Öğrenci başarıyla eklendi.');
      setShowAddStudent(false);
      setStudentForm({
        firstName: '',
        lastName: '',
        email: '',
        school: '',
        grade: '',
        phone: '',
        parentName: '',
        parentPhone: '',
        address: '',
        notes: ''
      });
      loadStudents();
    } catch (error) {
      console.error('Öğrenci ekleme hatası:', error);
      Alert.alert('Hata', 'Öğrenci eklenirken bir hata oluştu.');
    } finally {
      setStudentLoading(false);
    }
  };


  const renderTeacherCard = ({ item }) => (
    <Card style={styles.userCard}>
      <View style={styles.userCardInfo}>
        <Text style={styles.userCardName}>{item.name}</Text>
        <Text style={styles.userCardBranch}>{item.branch}</Text>
      </View>
    </Card>
  );

  const renderStudentCard = ({ item }) => (
    <Card style={styles.userCard}>
      <View style={styles.userCardInfo}>
        <Text style={styles.userCardName}>{item.name}</Text>
        <Text style={styles.userCardBranch}>{item.grade}</Text>
      </View>
    </Card>
  );

  return (
    <Container>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Kurum Yönetimi
          </Text>
          <View style={styles.placeholder} />
        </View>

        {institution && (
          <Card style={styles.institutionCard}>
            <Text style={styles.institutionName}>{institution.name}</Text>
            <Text style={styles.institutionType}>{institution.type}</Text>
            <View style={styles.limitsContainer}>
              <Text style={styles.limitsText}>
                Öğretmen: {teachers.length}/{institution.max_teachers}
              </Text>
              <Text style={styles.limitsText}>
                Öğrenci: {students.length}/{institution.max_students}
              </Text>
            </View>
          </Card>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              setShowAddTeacher(true);
            }}
          >
            <Ionicons name="person-add" size={20} color={colors.surface} />
            <Text style={[styles.actionButtonText, { color: colors.surface }]}>
              Öğretmen Ekle
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.success }]}
            onPress={() => {
              setShowAddStudent(true);
            }}
          >
            <Ionicons name="school" size={20} color={colors.surface} />
            <Text style={[styles.actionButtonText, { color: colors.surface }]}>
              Öğrenci Ekle
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listButtons}>
          <TouchableOpacity
            style={[styles.listButton, { backgroundColor: colors.warning }]}
            onPress={() => {
              setShowTeacherList(true);
              loadTeachers();
            }}
          >
            <Ionicons name="people" size={20} color={colors.surface} />
            <Text style={[styles.listButtonText, { color: colors.surface }]}>
              Öğretmenler ({teachers.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.listButton, { backgroundColor: colors.info }]}
            onPress={() => {
              setShowStudentList(true);
              loadStudents();
            }}
          >
            <Ionicons name="school" size={20} color={colors.surface} />
            <Text style={[styles.listButtonText, { color: colors.surface }]}>
              Öğrenciler ({students.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Öğretmen Ekleme Modal */}
        <Modal
          visible={showAddTeacher}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddTeacher(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Öğretmen Ekle</Text>
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
              <View style={styles.modalButtons}>
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
              <Text style={styles.modalTitle}>Öğrenci Ekle</Text>
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
                  placeholder="Öğrenci e-postası"
                  keyboardType="email-address"
                />
                <Input
                  label="Okul"
                  value={studentForm.school}
                  onChangeText={(text) => setStudentForm({...studentForm, school: text})}
                  placeholder="Öğrenci okulu"
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
              <View style={styles.modalButtons}>
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
              <Text style={styles.modalTitle}>Öğretmenler</Text>
              {loading ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : (
                <FlatList
                  data={teachers}
                  renderItem={renderTeacherCard}
                  keyExtractor={(item) => item.user_id}
                  style={styles.userList}
                />
              )}
              <Button
                title="Kapat"
                onPress={() => setShowTeacherList(false)}
                style={styles.modalButton}
              />
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
              <Text style={styles.modalTitle}>Öğrenciler</Text>
              {loading ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : (
                <FlatList
                  data={students}
                  renderItem={renderStudentCard}
                  keyExtractor={(item) => item.user_id}
                  style={styles.userList}
                />
              )}
              <Button
                title="Kapat"
                onPress={() => setShowStudentList(false)}
                style={styles.modalButton}
              />
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
    padding: SIZES.padding,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.padding,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  institutionCard: {
    marginBottom: SIZES.padding,
    padding: SIZES.padding,
  },
  institutionName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  institutionType: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  limitsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  limitsText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SIZES.padding,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 0.48,
    justifyContent: 'center',
  },
  actionButtonText: {
    marginLeft: 8,
    fontWeight: '600',
  },
  listButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 0.48,
    justifyContent: 'center',
  },
  listButtonText: {
    marginLeft: 8,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalScrollView: {
    maxHeight: 400,
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
    maxHeight: 300,
  },
  userCard: {
    marginBottom: 8,
    padding: 12,
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
});

export default InstitutionAdminScreen;
