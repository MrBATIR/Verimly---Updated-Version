import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_COLORS, COLORS } from '../constants/theme';
import Container from '../components/Container';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';
// ⚠️ supabaseAdmin artık kullanılmıyor - Edge Functions kullanılmalı

const InstitutionAdminLoginScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!credentials.username.trim() || !credentials.password.trim()) {
      Alert.alert('Hata', 'Kullanıcı adı ve şifre gereklidir');
      return;
    }

    setLoading(true);
    try {
      // RPC fonksiyonu ile kurum admin girişini doğrula
      const { data: result, error: rpcError } = await supabase
        .rpc('verify_institution_admin_login', {
          p_admin_username: credentials.username.trim(),
          p_admin_password: credentials.password
        });

      if (rpcError) {
        throw rpcError;
      }

      if (result && result.length > 0) {
        const institutionData = result[0];
        
        // Kurum detaylarını yükle (RLS ile erişilebilir olmalı)
        let institutionDetails = null;
        try {
          if (!supabase || !supabase.from) {
            console.log('[DEBUG] supabase undefined veya from metodu yok');
          } else {
            const { data: details } = await supabase
              .from('institutions')
              .select('*')
              .eq('id', institutionData.institution_id)
              .single();

            institutionDetails = details;
          }
        } catch (error) {
          console.log('[DEBUG] Kurum detayları RLS ile alınamadı, RPC verisi kullanılıyor');
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
            // Sözleşme bitmiş - Edge Function ile kurumu pasif etmek gerekir
            // Şimdilik sadece uyarı göster, güncelleme işlemini backend'de yap
            console.log('[DEBUG] Sözleşme bitmiş - Kurum pasif edilmeli (Edge Function ile yapılmalı)');

            Alert.alert(
              'Erişim Engellendi',
              'Kurumunuzun sözleşmesi sona ermiştir.\n\nGiriş yapabilmek için lütfen sistem yöneticiniz ile iletişime geçin.',
              [{ text: 'Tamam' }]
            );
            setLoading(false);
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
          setLoading(false);
          return;
        }

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

        // Kurum admin girişi başarılı - Session'ı AsyncStorage'a kaydet
        try {
          await AsyncStorage.setItem('institutionAdminSession', JSON.stringify({
            institutionId: fullInstitutionData.institution_id || fullInstitutionData.id,
            institutionName: fullInstitutionData.institution_name || fullInstitutionData.name,
            adminUsername: credentials.username.trim(),
            loginTime: new Date().toISOString(),
            contractEndDate: fullInstitutionData.contract_end_date,
            isActive: fullInstitutionData.is_active,
          }));
        } catch (storageError) {
          console.error('Session kaydetme hatası:', storageError);
        }

        // InstitutionAdminScreen'e yönlendir
        setTimeout(() => {
          if (navigation && navigation.navigate) {
            try {
              const parent = navigation.getParent();
              if (parent) {
                parent.navigate('InstitutionAdmin', {
                  institutionData: fullInstitutionData
                });
              } else {
                navigation.navigate('InstitutionAdmin', {
                  institutionData: fullInstitutionData
                });
              }
            } catch (error) {
              navigation.navigate('InstitutionAdmin', {
                institutionData: fullInstitutionData
              });
            }
          }
        }, 100);
      } else {
        Alert.alert('Hata', result.error || 'Geçersiz kullanıcı adı veya şifre');
      }
    } catch (error) {
      console.error('Kurum admin giriş hatası:', error);
      Alert.alert('Hata', 'Giriş yapılamadı: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Ionicons name="business" size={64} color={colors.primary} />
          <Text style={styles.title}>Kurum Yönetimi</Text>
          <Text style={styles.subtitle}>Kurum Admin Paneli</Text>
        </View>

        <Card style={styles.loginCard}>
          <Text style={styles.loginTitle}>Giriş Yap</Text>
          
          <Input
            placeholder="Kullanıcı Adı"
            value={credentials.username}
            onChangeText={(text) => setCredentials({ ...credentials, username: text })}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <Input
            placeholder="Şifre"
            value={credentials.password}
            onChangeText={(text) => setCredentials({ ...credentials, password: text })}
            secureTextEntry
            style={styles.input}
          />

          <Button
            title={loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
            onPress={handleLogin}
            disabled={loading}
            style={styles.loginButton}
          />

        </Card>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.backButtonText}>Geri Dön</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Container>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  loginCard: {
    padding: 24,
    marginBottom: 20,
  },
  loginTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  loginButton: {
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  backButtonText: {
    color: colors.text,
    marginLeft: 8,
    fontSize: 16,
  },
});

export default InstitutionAdminLoginScreen;


