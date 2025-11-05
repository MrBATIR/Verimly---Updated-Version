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
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_COLORS, COLORS } from '../constants/theme';
import { SIZES, SHADOWS } from '../constants/theme';
import Container from '../components/Container';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';
import { getAdminInstitutions, addAdminInstitution, toggleAdminInstitutionStatus, updateAdminContract, updateAdminInstitution } from '../lib/adminApi';
// ⚠️ supabaseAdmin artık kullanılmıyor - Edge Functions kullanılmalı

const AdminInstitutionsScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState(null);
  const [institutionsLoaded, setInstitutionsLoaded] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState(null);

  // Yeni kurum form verileri
  const [formData, setFormData] = useState({
    name: '',
    type: 'school',
    contact_email: '',
    contact_phone: '',
    address: '',
    admin_username: '',
    admin_password: '',
  });

  // Kurum düzenleme form verileri
  const [editFormData, setEditFormData] = useState({
    name: '',
    type: 'school',
    contact_email: '',
    contact_phone: '',
    address: '',
    max_teachers: 50,
    max_students: 500,
    notes: '',
    admin_username: '',
    admin_password: '',
  });

  // Sözleşme güncelleme form verileri
  const [contractData, setContractData] = useState({
    contract_start_date: '',
    contract_end_date: '',
    payment_status: 'pending',
    notes: '',
  });
  
  // Tarih seçici state'leri
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  // Sözleşme bitiş tarihi kontrolü ve otomatik pasif etme
  // NOT: Bu fonksiyon artık Edge Function kullanmıyor çünkü sözleşme güncelleme sırasında
  // Edge Function otomatik olarak tarih kontrollerini yapıyor.
  // Bu fonksiyon sadece sayfa yüklendiğinde çağrılıyor, ancak artık gerekli değil.
  // Edge Function'lar sözleşme tarihlerine göre kurum durumunu otomatik ayarlıyor.
  const checkContractExpiry = async (institutionId = null) => {
    // Bu fonksiyon artık kullanılmıyor - Edge Functions tarih kontrollerini yapıyor
    // Gelecekte bir cron job veya scheduled Edge Function ile yapılabilir
    console.log('Sözleşme kontrolü: Edge Functions tarafından otomatik yapılıyor');
  };

  // Sayfa yüklendiğinde kurumları yükle ve sözleşme kontrolü yap
  useEffect(() => {
    loadInstitutions();
    // Sayfa yüklendiğinde tüm kurumları kontrol et
    checkContractExpiry();
  }, []);

  // Her 5 dakikada bir sözleşme kontrolü yap (opsiyonel)
  useEffect(() => {
    const interval = setInterval(() => {
      checkContractExpiry();
    }, 5 * 60 * 1000); // 5 dakika

    return () => clearInterval(interval);
  }, []);

  const loadInstitutions = async () => {
    setLoading(true);
    try {
      const result = await getAdminInstitutions();

      if (result.error) {
        throw new Error(result.error?.message || result.error || 'Kurumlar yüklenemedi');
      }

      setInstitutions(result.data || []);
      setInstitutionsLoaded(true);
    } catch (error) {
      console.error('Kurumlar yükleme hatası:', error);
      Alert.alert('Hata', `Kurumlar yüklenirken bir hata oluştu: ${error?.message || 'Bilinmeyen hata'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddInstitution = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const result = await addAdminInstitution({
        name: formData.name,
        type: formData.type,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone,
        address: formData.address,
        admin_username: formData.admin_username,
        admin_password: formData.admin_password,
      });

      if (result.error) {
        throw new Error(result.error?.message || result.error || 'Kurum eklenemedi');
      }

      const institutionData = result.data?.institution;
      const credentialsData = result.data?.credentials;

      setGeneratedCredentials({
        institutionName: formData.name,
        adminUsername: formData.admin_username,
        adminPassword: formData.admin_password,
      });

      // Formu temizle
      setFormData({
        name: '',
        type: 'school',
        contact_email: '',
        contact_phone: '',
        address: '',
        admin_username: '',
        admin_password: '',
      });

      setShowAddForm(false);
      setShowCredentials(true);
      loadInstitutions(); // Listeyi yenile
    } catch (error) {
      console.error('Kurum ekleme hatası:', error);
      Alert.alert('Hata', `Kurum eklenirken bir hata oluştu: ${error?.message || 'Bilinmeyen hata'}`);
    } finally {
      setSaving(false);
    }
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Hata', 'Kurum adı gereklidir.');
      return false;
    }
    if (!formData.contact_email.trim()) {
      Alert.alert('Hata', 'İletişim e-postası gereklidir.');
      return false;
    }
    if (!formData.admin_username.trim()) {
      Alert.alert('Hata', 'Admin kullanıcı adı gereklidir.');
      return false;
    }
    if (!formData.admin_password.trim()) {
      Alert.alert('Hata', 'Admin şifresi gereklidir.');
      return false;
    }
    return true;
  };

  const toggleInstitutionStatus = async (institution) => {
    const newStatus = !institution.is_active;
    const action = newStatus ? 'aktif' : 'pasif';
    
    Alert.alert(
      'Kurum Durumu Değiştir',
      `"${institution.name}" kurumunu ${action} etmek istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet',
          onPress: async () => {
            try {
              const result = await toggleAdminInstitutionStatus(institution.id, newStatus);

              if (result.error) {
                throw new Error(result.error?.message || result.error || 'Kurum durumu değiştirilemedi');
              }

              Alert.alert('Başarılı', `Kurum ${action} edildi.`);
              // Listeyi yenile - kısa bir gecikme ile cache'i temizlemek için
              setTimeout(() => {
                loadInstitutions();
              }, 500);
            } catch (error) {
              console.error('Kurum durumu değiştirme hatası:', error);
              Alert.alert('Hata', `Kurum durumu değiştirilemedi: ${error?.message || 'Bilinmeyen hata'}`);
            }
          },
        },
      ]
    );
  };

  const updateContract = async (institution) => {
    setSelectedInstitution(institution);
    
    // Tarihleri Date objesine çevir
    const startDateValue = institution.contract_start_date 
      ? new Date(institution.contract_start_date) 
      : new Date();
    const endDateValue = institution.contract_end_date 
      ? new Date(institution.contract_end_date) 
      : new Date();
    
    setStartDate(startDateValue);
    setEndDate(endDateValue);
    
    setContractData({
      contract_start_date: institution.contract_start_date || '',
      contract_end_date: institution.contract_end_date || '',
      payment_status: institution.payment_status || 'pending',
      notes: institution.notes || '',
    });
    setShowContractModal(true);
  };
  
  // Tarih formatını YYYY-MM-DD formatına çevir
  const formatDateForDB = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Tarih değişiklik handler'ları
  // NOT: Tarih değişikliklerinde artık inline güncelleme yapılmıyor.
  // Tüm mantık handleContractUpdate içinde Edge Function ile yapılıyor.
  const handleStartDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
    }
    if (selectedDate && selectedInstitution) {
      setStartDate(selectedDate);
      const formattedDate = formatDateForDB(selectedDate);
      setContractData({ 
        ...contractData, 
        contract_start_date: formattedDate 
      });
    }
    if (Platform.OS === 'ios') {
      // iOS'ta modal içinde kalır
    }
  };
  
  const handleEndDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowEndDatePicker(false);
    }
    if (selectedDate && selectedInstitution) {
      setEndDate(selectedDate);
      const formattedDate = formatDateForDB(selectedDate);
      setContractData({ 
        ...contractData, 
        contract_end_date: formattedDate 
      });
    }
    if (Platform.OS === 'ios') {
      // iOS'ta modal içinde kalır
    }
  };

  const handleContractUpdate = async () => {
    if (!selectedInstitution) return;

    setSaving(true);
    try {
      const result = await updateAdminContract(selectedInstitution.id, {
        contract_start_date: contractData.contract_start_date || null,
        contract_end_date: contractData.contract_end_date || null,
        payment_status: contractData.payment_status,
        notes: contractData.notes || null,
      });

      if (result.error) {
        throw new Error(result.error?.message || result.error || 'Sözleşme güncellenemedi');
      }

      const message = result.data?.message || 'Sözleşme bilgileri güncellendi.';
      Alert.alert('Başarılı', message);
      setShowContractModal(false);
      loadInstitutions(); // Listeyi yenile
    } catch (error) {
      console.error('Sözleşme güncelleme hatası:', error);
      Alert.alert('Hata', `Sözleşme güncellenemedi: ${error?.message || 'Bilinmeyen hata'}`);
    } finally {
      setSaving(false);
    }
  };

  const openEditInstitution = (institution) => {
    setSelectedInstitution(institution);
    setEditFormData({
      name: institution.name || '',
      type: institution.type || 'school',
      contact_email: institution.contact_email || '',
      contact_phone: institution.contact_phone || '',
      address: institution.address || '',
      max_teachers: institution.max_teachers || 50,
      max_students: institution.max_students || 500,
      notes: institution.notes || '',
      admin_username: institution.admin_username || '',
      admin_password: '', // Boş bırak, değiştirilmeyecekse korunur
    });
    setShowEditForm(true);
  };

  const handleEditInstitution = async () => {
    if (!selectedInstitution) return;

    if (!editFormData.name.trim()) {
      Alert.alert('Hata', 'Kurum adı gereklidir.');
      return;
    }
    if (!editFormData.contact_email.trim()) {
      Alert.alert('Hata', 'İletişim e-postası gereklidir.');
      return;
    }

    setSaving(true);
    try {
      const result = await updateAdminInstitution(selectedInstitution.id, {
        name: editFormData.name,
        type: editFormData.type,
        contact_email: editFormData.contact_email,
        contact_phone: editFormData.contact_phone || null,
        address: editFormData.address || null,
        max_teachers: editFormData.max_teachers || 50,
        max_students: editFormData.max_students || 500,
        notes: editFormData.notes || null,
        admin_username: editFormData.admin_username || null,
        admin_password: editFormData.admin_password && editFormData.admin_password.trim() !== '' 
          ? editFormData.admin_password 
          : null, // Sadece değiştirilecekse gönder
      });

      if (result.error) {
        throw new Error(result.error?.message || result.error || 'Kurum güncellenemedi');
      }

      const message = editFormData.admin_password && editFormData.admin_password.trim() !== '' 
        ? 'Kurum bilgileri ve admin şifresi güncellendi!'
        : 'Kurum bilgileri güncellendi!';

      Alert.alert('Başarılı', message);
      setShowEditForm(false);
      setTimeout(() => {
        loadInstitutions();
      }, 500);
    } catch (error) {
      console.error('Kurum güncelleme hatası:', error);
      Alert.alert('Hata', `Kurum güncellenemedi: ${error?.message || 'Bilinmeyen hata'}`);
    } finally {
      setSaving(false);
    }
  };

  const renderInstitution = (institution) => (
    <Card key={institution.id} style={styles.institutionCard}>
      <View style={styles.institutionHeader}>
        <View style={styles.institutionInfo}>
          <Text style={[styles.institutionName, { color: colors.textPrimary }]}>
            {institution.name}
          </Text>
          <Text style={[styles.institutionType, { color: colors.textSecondary }]}>
            {institution.type === 'school' ? 'Okul' : 
             institution.type === 'university' ? 'Üniversite' :
             institution.type === 'company' ? 'Şirket' : 'Bireysel'}
          </Text>
          <Text style={[styles.institutionEmail, { color: colors.textSecondary }]}>
            {institution.contact_email}
          </Text>
        </View>
        <View style={styles.institutionStatus}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: institution.is_active ? '#4CAF50' + '20' : '#f44336' + '20' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: institution.is_active ? '#4CAF50' : '#f44336' }
            ]}>
              {institution.is_active ? 'Aktif' : 'Pasif'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.institutionDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            Oluşturulma: {new Date(institution.created_at).toLocaleDateString('tr-TR')}
          </Text>
        </View>
        
        {institution.contract_start_date && (
          <View style={styles.detailRow}>
            <Ionicons name="document-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              Sözleşme: {new Date(institution.contract_start_date).toLocaleDateString('tr-TR')} - 
              {institution.contract_end_date ? new Date(institution.contract_end_date).toLocaleDateString('tr-TR') : 'Belirsiz'}
            </Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Ionicons name="card-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            Ödeme: {institution.payment_status === 'paid' ? 'Ödendi' : 
                   institution.payment_status === 'overdue' ? 'Gecikmiş' : 'Beklemede'}
          </Text>
        </View>
      </View>

      <View style={styles.institutionActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.warning + '20' }]}
          onPress={() => openEditInstitution(institution)}
        >
          <Ionicons name="pencil" size={20} color={colors.warning} />
          <Text style={[styles.actionButtonText, { color: colors.warning }]}>
            Düzenle
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: institution.is_active ? '#f44336' + '20' : '#4CAF50' + '20' }
          ]}
          onPress={() => toggleInstitutionStatus(institution)}
        >
          <Ionicons 
            name={institution.is_active ? 'pause-circle-outline' : 'play-circle-outline'} 
            size={20} 
            color={institution.is_active ? '#f44336' : '#4CAF50'} 
          />
          <Text style={[
            styles.actionButtonText,
            { color: institution.is_active ? '#f44336' : '#4CAF50' }
          ]}>
            {institution.is_active ? 'Pasif Et' : 'Aktif Et'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
          onPress={() => updateContract(institution)}
        >
          <Ionicons name="document-text-outline" size={20} color={colors.primary} />
          <Text style={[styles.actionButtonText, { color: colors.primary }]}>
            Sözleşme
          </Text>
        </TouchableOpacity>
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

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.loadButton, { backgroundColor: colors.primary }]}
            onPress={loadInstitutions}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.surface} size="small" />
            ) : (
              <Ionicons name="refresh" size={20} color={colors.surface} />
            )}
            <Text style={[styles.loadButtonText, { color: colors.surface }]}>
              {institutionsLoaded ? 'Yenile' : 'Kurumları Yükle'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.success }]}
            onPress={() => setShowAddForm(true)}
          >
            <Ionicons name="add" size={20} color={colors.surface} />
            <Text style={[styles.addButtonText, { color: colors.surface }]}>
              Kurum Ekle
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {institutions.length === 0 && institutionsLoaded ? (
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                Henüz kurum eklenmemiş
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                "Kurum Ekle" butonuna tıklayarak ilk kurumunuzu ekleyin
              </Text>
            </View>
          ) : (
            institutions.map(renderInstitution)
          )}
        </ScrollView>

        {/* Kurum Ekleme Modal */}
        <Modal
          visible={showAddForm}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowAddForm(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Yeni Kurum Ekle
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowAddForm(false)}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Input
                  label="Kurum Adı *"
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Örnek: ABC Okulu"
                />

                <View style={styles.selectContainer}>
                  <Text style={[styles.selectLabel, { color: colors.textPrimary }]}>
                    Kurum Türü *
                  </Text>
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
                          formData.type === option.value && { backgroundColor: colors.primary + '20' }
                        ]}
                        onPress={() => setFormData({ ...formData, type: option.value })}
                      >
                        <Text style={[
                          styles.selectOptionText,
                          { color: formData.type === option.value ? colors.primary : colors.textPrimary }
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <Input
                  label="İletişim E-postası *"
                  value={formData.contact_email}
                  onChangeText={(text) => setFormData({ ...formData, contact_email: text })}
                  placeholder="ornek@okul.com"
                  keyboardType="email-address"
                />

                <Input
                  label="İletişim Telefonu"
                  value={formData.contact_phone}
                  onChangeText={(text) => setFormData({ ...formData, contact_phone: text })}
                  placeholder="+90 555 123 45 67"
                  keyboardType="phone-pad"
                />

                <Input
                  label="Adres"
                  value={formData.address}
                  onChangeText={(text) => setFormData({ ...formData, address: text })}
                  placeholder="Kurum adresi"
                  multiline
                  numberOfLines={3}
                />

                <View style={styles.separator} />

                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Admin Giriş Bilgileri
                </Text>

                <Input
                  label="Admin Kullanıcı Adı *"
                  value={formData.admin_username}
                  onChangeText={(text) => setFormData({ ...formData, admin_username: text })}
                  placeholder="okul123_admin"
                />

                <Input
                  label="Admin Şifresi *"
                  value={formData.admin_password}
                  onChangeText={(text) => setFormData({ ...formData, admin_password: text })}
                  placeholder="Güçlü bir şifre girin"
                  secureTextEntry
                />
              </ScrollView>

              <View style={styles.modalActions}>
                <Button
                  title="İptal"
                  onPress={() => setShowAddForm(false)}
                  style={[styles.cancelButton, { backgroundColor: colors.textSecondary }]}
                />
                <Button
                  title={saving ? 'Ekleniyor...' : 'Kurum Ekle'}
                  onPress={handleAddInstitution}
                  disabled={saving}
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Giriş Bilgileri Modal */}
        <Modal
          visible={showCredentials}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCredentials(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Kurum Oluşturuldu
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowCredentials(false)}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.credentialsContent}>
                <View style={[styles.successIcon, { backgroundColor: colors.success + '20' }]}>
                  <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                </View>

                <Text style={[styles.credentialsTitle, { color: colors.textPrimary }]}>
                  {generatedCredentials?.institutionName}
                </Text>

                <Text style={[styles.credentialsSubtitle, { color: colors.textSecondary }]}>
                  Kurum başarıyla oluşturuldu. Admin giriş bilgileri:
                </Text>

                <View style={[styles.credentialsBox, { backgroundColor: colors.background }]}>
                  <View style={styles.credentialRow}>
                    <Text style={[styles.credentialLabel, { color: colors.textSecondary }]}>
                      Kullanıcı Adı:
                    </Text>
                    <Text style={[styles.credentialValue, { color: colors.textPrimary }]}>
                      {generatedCredentials?.adminUsername}
                    </Text>
                  </View>
                  <View style={styles.credentialRow}>
                    <Text style={[styles.credentialLabel, { color: colors.textSecondary }]}>
                      Şifre:
                    </Text>
                    <Text style={[styles.credentialValue, { color: colors.textPrimary }]}>
                      {generatedCredentials?.adminPassword}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.credentialsNote, { color: colors.textSecondary }]}>
                  Bu bilgileri güvenli bir yerde saklayın. Kurum admini bu bilgilerle giriş yapabilir.
                </Text>
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Tamam"
                  onPress={() => setShowCredentials(false)}
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Kurum Düzenleme Modal */}
        <Modal
          visible={showEditForm}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowEditForm(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Kurum Düzenle
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowEditForm(false)}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  {selectedInstitution?.name}
                </Text>

                <Input
                  label="Kurum Adı *"
                  value={editFormData.name}
                  onChangeText={(text) => setEditFormData({ ...editFormData, name: text })}
                  placeholder="Örnek: ABC Okulu"
                />

                <View style={styles.selectContainer}>
                  <Text style={[styles.selectLabel, { color: colors.textPrimary }]}>
                    Kurum Türü *
                  </Text>
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
                          editFormData.type === option.value && { backgroundColor: colors.primary + '20' }
                        ]}
                        onPress={() => setEditFormData({ ...editFormData, type: option.value })}
                      >
                        <Text style={[
                          styles.selectOptionText,
                          { color: editFormData.type === option.value ? colors.primary : colors.textPrimary }
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <Input
                  label="İletişim E-postası *"
                  value={editFormData.contact_email}
                  onChangeText={(text) => setEditFormData({ ...editFormData, contact_email: text })}
                  placeholder="ornek@okul.com"
                  keyboardType="email-address"
                />

                <Input
                  label="İletişim Telefonu"
                  value={editFormData.contact_phone}
                  onChangeText={(text) => setEditFormData({ ...editFormData, contact_phone: text })}
                  placeholder="+90 555 123 45 67"
                  keyboardType="phone-pad"
                />

                <Input
                  label="Adres"
                  value={editFormData.address}
                  onChangeText={(text) => setEditFormData({ ...editFormData, address: text })}
                  placeholder="Kurum adresi"
                  multiline
                  numberOfLines={3}
                />

                <View style={styles.limitsContainer}>
                  <Input
                    label="Maksimum Öğretmen"
                    value={editFormData.max_teachers.toString()}
                    onChangeText={(text) => setEditFormData({ ...editFormData, max_teachers: parseInt(text) || 50 })}
                    placeholder="50"
                    keyboardType="numeric"
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Input
                    label="Maksimum Öğrenci"
                    value={editFormData.max_students.toString()}
                    onChangeText={(text) => setEditFormData({ ...editFormData, max_students: parseInt(text) || 500 })}
                    placeholder="500"
                    keyboardType="numeric"
                    style={{ flex: 1, marginLeft: 8 }}
                  />
                </View>

                <Input
                  label="Notlar"
                  value={editFormData.notes}
                  onChangeText={(text) => setEditFormData({ ...editFormData, notes: text })}
                  placeholder="Ek notlar"
                  multiline
                  numberOfLines={3}
                />

                <View style={styles.separator} />

                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  🔐 Kurum Admin Bilgileri
                </Text>
                <Text style={[styles.credentialsSubtitle, { color: colors.textSecondary, marginBottom: 16 }]}>
                  Kurum yöneticisinin giriş bilgileri
                </Text>

                <Input
                  label="Admin Kullanıcı Adı"
                  value={editFormData.admin_username}
                  onChangeText={(text) => setEditFormData({ ...editFormData, admin_username: text })}
                  placeholder="Kurum admin kullanıcı adı"
                />

                <Input
                  label="Yeni Admin Şifre"
                  value={editFormData.admin_password}
                  onChangeText={(text) => setEditFormData({ ...editFormData, admin_password: text })}
                  placeholder="Yeni şifre atayın (boş bırakırsanız değişmez)"
                  secureTextEntry
                />
                <Text style={[styles.credentialsNote, { color: colors.textSecondary }]}>
                  💡 Şifre alanını boş bırakırsanız mevcut şifre korunur. Yeni şifre girerseniz o şifre aktif olur.
                </Text>
              </ScrollView>

              <View style={styles.modalActions}>
                <Button
                  title="İptal"
                  onPress={() => setShowEditForm(false)}
                  style={[styles.cancelButton, { backgroundColor: colors.textSecondary }]}
                />
                <Button
                  title={saving ? 'Güncelleniyor...' : 'Güncelle'}
                  onPress={handleEditInstitution}
                  disabled={saving}
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Sözleşme Güncelleme Modal */}
        <Modal
          visible={showContractModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowContractModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Sözleşme Güncelle
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowContractModal(false)}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  {selectedInstitution?.name}
                </Text>

                <View style={styles.dateInputContainer}>
                  <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>
                    Sözleşme Başlangıç Tarihi
                  </Text>
                  <TouchableOpacity
                    style={[styles.dateInput, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                    <Text style={[styles.dateInputText, { color: contractData.contract_start_date ? colors.textPrimary : colors.textSecondary }]}>
                      {contractData.contract_start_date 
                        ? startDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                        : 'Tarih seçin'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showStartDatePicker && (
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleStartDateChange}
                    minimumDate={new Date(2020, 0, 1)}
                    maximumDate={new Date(2099, 11, 31)}
                  />
                )}

                <View style={styles.dateInputContainer}>
                  <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>
                    Sözleşme Bitiş Tarihi
                  </Text>
                  <TouchableOpacity
                    style={[styles.dateInput, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                    <Text style={[styles.dateInputText, { color: contractData.contract_end_date ? colors.textPrimary : colors.textSecondary }]}>
                      {contractData.contract_end_date 
                        ? endDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                        : 'Tarih seçin'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showEndDatePicker && (
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleEndDateChange}
                    minimumDate={startDate || new Date(2020, 0, 1)}
                    maximumDate={new Date(2099, 11, 31)}
                  />
                )}

                <View style={styles.selectContainer}>
                  <Text style={[styles.selectLabel, { color: colors.textPrimary }]}>
                    Ödeme Durumu
                  </Text>
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
                          contractData.payment_status === option.value && { backgroundColor: colors.primary + '20' }
                        ]}
                        onPress={() => setContractData({ ...contractData, payment_status: option.value })}
                      >
                        <Text style={[
                          styles.selectOptionText,
                          { color: contractData.payment_status === option.value ? colors.primary : colors.textPrimary }
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <Input
                  label="Notlar"
                  value={contractData.notes}
                  onChangeText={(text) => setContractData({ ...contractData, notes: text })}
                  placeholder="Sözleşme ile ilgili notlar..."
                  multiline
                  numberOfLines={3}
                />
              </ScrollView>

              <View style={styles.modalActions}>
                <Button
                  title="İptal"
                  onPress={() => setShowContractModal(false)}
                  style={[styles.cancelButton, { backgroundColor: colors.textSecondary }]}
                />
                <Button
                  title={saving ? 'Güncelleniyor...' : 'Güncelle'}
                  onPress={handleContractUpdate}
                  disabled={saving}
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
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
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    gap: SIZES.padding,
  },
  loadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: SIZES.radius,
    gap: 8,
  },
  loadButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: SIZES.radius,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  institutionCard: {
    marginBottom: SIZES.padding,
    padding: SIZES.padding,
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
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  institutionType: {
    fontSize: 14,
    marginBottom: 2,
  },
  institutionEmail: {
    fontSize: 14,
  },
  institutionStatus: {
    marginLeft: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  institutionDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    flex: 1,
  },
  institutionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: SIZES.radius,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: SIZES.radius,
    ...SHADOWS.large,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    maxHeight: 400,
    paddingHorizontal: SIZES.padding,
  },
  selectContainer: {
    marginBottom: 16,
  },
  selectLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  selectOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
  credentialsContent: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    alignItems: 'center',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  credentialsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  credentialsSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  credentialsBox: {
    width: '100%',
    padding: 16,
    borderRadius: SIZES.radius,
    marginBottom: 16,
  },
  credentialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  credentialLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  credentialValue: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  credentialsNote: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  dateInputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    gap: 12,
  },
  dateInputText: {
    fontSize: 16,
    flex: 1,
  },
  limitsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
});

export default AdminInstitutionsScreen;
