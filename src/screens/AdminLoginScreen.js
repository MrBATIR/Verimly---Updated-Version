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

const AdminLoginScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const [credentials, setCredentials] = useState({
    username: 'admin',
    password: 'admin123',
  });
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!credentials.username.trim() || !credentials.password.trim()) {
      Alert.alert('Hata', 'Kullanıcı adı ve şifre gereklidir');
      return;
    }

    setLoading(true);
    try {
      // Admin kimlik doğrulama (basit versiyon)
      // Gerçek uygulamada güvenli bir admin sistemi kullanılmalı
      if (credentials.username === 'admin' && credentials.password === 'admin123') {
        Alert.alert(
          'Giriş Başarılı! 🎉',
          'Admin paneline yönlendiriliyorsunuz...',
          [
            {
              text: 'Tamam',
              onPress: () => navigation.navigate('AdminDashboard'),
            },
          ]
        );
      } else {
        Alert.alert('Hata', 'Geçersiz kullanıcı adı veya şifre');
      }
    } catch (error) {
      console.error('Admin giriş hatası:', error);
      Alert.alert('Hata', 'Giriş yapılamadı');
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
            placeholder="Kullanıcı Adı"
            value={credentials.username}
            onChangeText={(text) => setCredentials({ ...credentials, username: text })}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            defaultValue="admin"
          />
          
          <Input
            placeholder="Şifre"
            value={credentials.password}
            onChangeText={(text) => setCredentials({ ...credentials, password: text })}
            secureTextEntry
            style={styles.input}
            autoComplete="off"
            defaultValue="admin123"
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
