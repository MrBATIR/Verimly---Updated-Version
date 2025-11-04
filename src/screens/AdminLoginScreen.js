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
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_COLORS, COLORS } from '../constants/theme';
import { SIZES, SHADOWS } from '../constants/theme';
import Container from '../components/Container';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';

const AdminLoginScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const [credentials, setCredentials] = useState({
    username: '', // E-posta formatında
    password: '',
  });
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!credentials.username.trim() || !credentials.password.trim()) {
      Alert.alert('Hata', 'E-posta ve şifre gereklidir');
      return;
    }

    setLoading(true);
    try {
      // Supabase Auth ile giriş yap
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.username.trim(), // E-posta formatında bekleniyor
        password: credentials.password
      });

      if (error) {
        console.error('Admin giriş hatası:', error);
        let errorMessage = 'Geçersiz giriş bilgileri';
        
        if (error.message?.includes('Invalid login credentials') || error.message?.includes('invalid_credentials')) {
          errorMessage = 'E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.\n\nAdmin kullanıcısı oluşturulmamışsa, create_admin_user.js script\'ini çalıştırmanız gerekebilir.';
        } else if (error.message?.includes('Email not confirmed')) {
          errorMessage = 'E-posta adresi doğrulanmamış. Lütfen e-posta kutunuzu kontrol edin.';
        } else {
          errorMessage = `Giriş hatası: ${error.message || 'Bilinmeyen hata'}`;
        }
        
        Alert.alert('Hata', errorMessage);
        setLoading(false);
        return;
      }

      // Admin rolünü kontrol et
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_type')
        .eq('user_id', data.user.id)
        .single();

      if (profileError || !profile) {
        Alert.alert('Hata', 'Kullanıcı profili bulunamadı');
        await supabase.auth.signOut(); // Güvenlik için çıkış yap
        setLoading(false);
        return;
      }

      // Admin kontrolü
      if (profile.user_type !== 'admin') {
        Alert.alert('Hata', 'Bu hesap admin yetkisine sahip değil');
        await supabase.auth.signOut(); // Güvenlik için çıkış yap
        setLoading(false);
        return;
      }

      // Admin girişi başarılı - direkt navigate et
      // setTimeout ile biraz geciktir (state güncellemeleri için)
      setTimeout(() => {
        if (navigation && navigation.navigate) {
          // Önce parent navigator kontrolü yap
          try {
            const parent = navigation.getParent();
            if (parent) {
              // Parent varsa parent üzerinden navigate et
              parent.navigate('AdminDashboard');
            } else {
              // Parent yoksa direkt navigate et
              navigation.navigate('AdminDashboard');
            }
          } catch (error) {
            // getParent() çalışmadıysa direkt navigate dene
            navigation.navigate('AdminDashboard');
          }
        }
      }, 100);
    } catch (error) {
      console.error('Admin giriş hatası:', error);
      Alert.alert('Hata', 'Giriş yapılırken bir hata oluştu');
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
          <Ionicons name="shield-checkmark" size={64} color={colors.primary} />
          <Text style={styles.title}>Admin Paneli</Text>
          <Text style={styles.subtitle}>Sistem Yönetimi</Text>
        </View>

        <Card style={styles.loginCard}>
          <Text style={styles.loginTitle}>Giriş Yap</Text>
          
          <Input
            placeholder="E-posta Adresi"
            value={credentials.username}
            onChangeText={(text) => setCredentials({ ...credentials, username: text })}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
          />
          
          <Input
            placeholder="Şifre"
            value={credentials.password}
            onChangeText={(text) => setCredentials({ ...credentials, password: text })}
            secureTextEntry
            style={styles.input}
            autoComplete="password"
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

export default AdminLoginScreen;
