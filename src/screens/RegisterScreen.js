import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Container, Input, Button } from '../components';
import Select from '../components/Select';
import { COLORS, DARK_COLORS, SIZES } from '../constants/theme';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';

const GRADE_OPTIONS = [
  { label: '5. Sınıf', value: '5' },
  { label: '6. Sınıf', value: '6' },
  { label: '7. Sınıf', value: '7' },
  { label: '8. Sınıf', value: '8' },
  { label: '9. Sınıf', value: '9' },
  { label: '10. Sınıf', value: '10' },
  { label: '11. Sınıf', value: '11' },
  { label: '12. Sınıf', value: '12' },
  { label: 'Mezun', value: 'graduate' },
];

export default function RegisterScreen({ navigation }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    grade: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Tema context'ini kullan
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const updateField = (field, value) => {
    setFormData({ ...formData, [field]: value });
    setErrors({ ...errors, [field]: '' });
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.firstName.trim()) newErrors.firstName = 'Ad gerekli';
    if (!formData.lastName.trim()) newErrors.lastName = 'Soyad gerekli';
    if (!formData.email.trim()) newErrors.email = 'E-posta gerekli';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Geçerli bir e-posta girin';
    if (!formData.phone.trim()) newErrors.phone = 'Telefon gerekli';
    if (!formData.grade) newErrors.grade = 'Sınıf seçimi gerekli';
    if (!formData.password) newErrors.password = 'Şifre gerekli';
    else if (formData.password.length < 6) newErrors.password = 'Şifre en az 6 karakter olmalı';
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Şifreler eşleşmiyor';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      
      // Email formatını daha katı kontrol et
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        Alert.alert('Hata', 'Geçerli bir e-posta adresi girin');
        setLoading(false);
        return;
      }

      // Önce sadece Auth ile kayıt yap (basit)
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password
      });

      if (error) {
        console.error('Auth error:', error);
        throw error;
      }


      // Şimdi profile eklemeyi dene
      try {
        // Önce bireysel kullanıcılar kurumunu bul
        const { data: individualInstitution, error: institutionError } = await supabaseAdmin
          .from('institutions')
          .select('id, name')
          .eq('name', 'Bireysel Kullanıcılar')
          .single();

        if (institutionError) {
          // Kurum yoksa oluştur
          const { data: newInstitution, error: createInstitutionError } = await supabaseAdmin
            .from('institutions')
            .insert({
              name: 'Bireysel Kullanıcılar',
              description: 'App Store ve Google Play\'den indirip üye olan bireysel kullanıcılar',
              is_active: true,
              is_premium: false
            })
            .select('id')
            .single();
            
          if (createInstitutionError) {
            // Kurum oluşturulamadı, devam et
          } else {
            individualInstitution = newInstitution;
          }
        }

        // user_profiles tablosuna ekle (user_type: 'student' olarak)
        const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
        
        // Önce mevcut profile'ı kontrol et
        const { data: existingProfile, error: checkError } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('user_id', data.user.id)
          .maybeSingle();
        
        let profileError = null;
        if (existingProfile) {
          // Mevcut profile'ı güncelle
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({
              name: fullName,
              email: formData.email.trim().toLowerCase(),
              institution_id: individualInstitution?.id || null
            })
            .eq('user_id', data.user.id);
          profileError = updateError;
        } else {
          // Yeni profile oluştur
          const { error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              user_id: data.user.id,
              user_type: 'student',
              name: fullName,
              email: formData.email.trim().toLowerCase(),
              institution_id: individualInstitution?.id || null
            });
          profileError = insertError;
        }

        if (profileError) {
          console.error('Profile error:', profileError);
        }

        // Bireysel kullanıcılar için students tablosuna da kayıt ekle (profile hatasından bağımsız)
        
        // Önce mevcut student kaydını kontrol et
        const { data: existingStudent, error: studentCheckError } = await supabase
          .from('students')
          .select('user_id')
          .eq('user_id', data.user.id)
          .maybeSingle();
        
        let studentError = null;
        if (existingStudent) {
          // Mevcut student kaydını güncelle
          const { error: updateStudentError } = await supabase
            .from('students')
            .update({
              name: fullName,
              email: formData.email.trim().toLowerCase(),
              phone: formData.phone.trim(),
              school: 'Bireysel Kullanıcı', // Sabit değer
              grade: formData.grade,
              institution_id: individualInstitution?.id || null
            })
            .eq('user_id', data.user.id);
          studentError = updateStudentError;
        } else {
          // Yeni student kaydı oluştur
          const { error: insertStudentError } = await supabase
            .from('students')
            .insert({
              user_id: data.user.id,
              name: fullName,
              email: formData.email.trim().toLowerCase(),
              phone: formData.phone.trim(),
              school: 'Bireysel Kullanıcı', // Sabit değer
              grade: formData.grade,
              institution_id: individualInstitution?.id || null
            });
          studentError = insertStudentError;
        }

        if (studentError) {
          console.error('Student error:', studentError);
        }

        // Institution membership oluştur (eğer kurum varsa)
        if (individualInstitution?.id) {
          // Önce mevcut membership'i kontrol et
          const { data: existingMembership, error: membershipCheckError } = await supabaseAdmin
            .from('institution_memberships')
            .select('id')
            .eq('user_id', data.user.id)
            .eq('institution_id', individualInstitution.id)
            .maybeSingle();
            
          if (existingMembership) {
            const { error: updateMembershipError } = await supabaseAdmin
              .from('institution_memberships')
              .update({
                role: 'student',
                is_active: true
              })
              .eq('user_id', data.user.id)
              .eq('institution_id', individualInstitution.id);
              
            if (updateMembershipError) {
              console.error('Membership güncelleme hatası:', updateMembershipError);
            }
          } else {
            const { error: membershipError } = await supabaseAdmin
              .from('institution_memberships')
              .insert({
                institution_id: individualInstitution.id,
                user_id: data.user.id,
                role: 'student',
                is_active: true
              });

            if (membershipError) {
              console.error('Institution membership oluşturma hatası:', membershipError);
            }
          }
        }
      } catch (profileError) {
        console.error('Profile ekleme hatası:', profileError);
      }

      Alert.alert(
        'Hesap Oluşturuldu! 🎉',
        'Hesabın başarıyla oluşturuldu. Hoş geldin!',
        [
          {
            text: 'Tamam',
            onPress: () => {
              // Kullanıcı zaten giriş yapmış, direkt ana ekrana git
              navigation.getParent()?.navigate('Main');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Kayıt hatası:', error);
      Alert.alert(
        'Hata',
        error.message || 'Kayıt sırasında bir hata oluştu. Lütfen tekrar dene.'
      );
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
          <View style={styles.header}>
            <Text style={styles.title}>Hesap Oluştur 🎓</Text>
            <Text style={styles.subtitle}>Çalışma takibine başla</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.row}>
              <Input
                label="Ad"
                value={formData.firstName}
                onChangeText={(text) => updateField('firstName', text)}
                placeholder="Adın"
                error={errors.firstName}
                style={styles.halfInput}
              />
              <Input
                label="Soyad"
                value={formData.lastName}
                onChangeText={(text) => updateField('lastName', text)}
                placeholder="Soyadın"
                error={errors.lastName}
                style={styles.halfInput}
              />
            </View>

            <Input
              label="E-posta"
              value={formData.email}
              onChangeText={(text) => updateField('email', text)}
              placeholder="ornek@email.com"
              keyboardType="email-address"
              error={errors.email}
              autoCapitalize="none"
            />

            <Input
              label="Telefon"
              value={formData.phone}
              onChangeText={(text) => updateField('phone', text)}
              placeholder="0555 555 55 55"
              keyboardType="phone-pad"
              error={errors.phone}
            />


            <Select
              label="Sınıf"
              value={formData.grade}
              onValueChange={(value) => updateField('grade', value)}
              options={GRADE_OPTIONS}
              placeholder="Sınıf seç"
              error={errors.grade}
            />

            <Input
              label="Şifre"
              value={formData.password}
              onChangeText={(text) => updateField('password', text)}
              placeholder="En az 6 karakter"
              secureTextEntry
              error={errors.password}
            />

            <Input
              label="Şifre Tekrar"
              value={formData.confirmPassword}
              onChangeText={(text) => updateField('confirmPassword', text)}
              placeholder="Şifreni tekrar gir"
              secureTextEntry
              error={errors.confirmPassword}
            />

            <Button
              title="Kayıt Ol"
              onPress={handleRegister}
              loading={loading}
              style={styles.registerButton}
            />

            <Button
              title="Zaten hesabın var mı? Giriş Yap"
              onPress={() => navigation.navigate('Login')}
              variant="ghost"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingTop: 40,
  },
  header: {
    marginBottom: 32,
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
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  halfInput: {
    flex: 1,
    marginBottom: 0,
  },
  registerButton: {
    marginTop: 16,
  },
});

