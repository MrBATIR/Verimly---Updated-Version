import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// React Navigation development-only warning'lerini bastır
LogBox.ignoreLogs([
  'The action \'NAVIGATE\' with payload',
  'Do you have a screen named',
]);
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import AdminLoginScreen from './src/screens/AdminLoginScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import InstitutionAdminLoginScreen from './src/screens/InstitutionAdminLoginScreen';
import InstitutionAdminScreen from './src/screens/InstitutionAdminScreen';
import SplashScreen from './src/components/SplashScreen';
import { supabase } from './src/lib/supabase';
import { COLORS, DARK_COLORS } from './src/constants/theme';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';

const Stack = createNativeStackNavigator();

function AppContent() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const { isDark, isLoading: themeLoading } = useTheme();

  useEffect(() => {
    let timeoutId;
    let isResolved = false;
    
    // Session kontrolü - timeout süresini artırdık (5 saniye)
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutId);
        
        if (error) {
          // Sadece gerçek hataları log'la
          console.error('Session error:', error);
          setSession(null);
        } else {
          setSession(session);
        }
        setLoading(false);
      })
      .catch((error) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutId);
        // Sadece gerçek hataları log'la (timeout sessizce handle edilir)
        console.error('Session check error:', error);
        setSession(null);
        setLoading(false);
      });
    
    // Timeout kontrolü - sessizce handle et
    timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        // Timeout durumunda sessizce devam et (log yok)
        setSession(null);
        setLoading(false);
      }
    }, 5000);

    // Session değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Eğer session null ise veya SIGNED_OUT eventi varsa session'ı temizle
      if (event === 'SIGNED_OUT' || !session) {
        setSession(null);
      } else {
        // Session geçerli mi kontrol et
        try {
          const { data: { user }, error } = await supabase.auth.getUser();
          if (error || !user) {
            // Kullanıcı bulunamazsa session'ı null yap
            setSession(null);
            await supabase.auth.signOut();
          } else {
            setSession(session);
          }
        } catch (error) {
          console.log('Session validation error:', error);
          setSession(null);
        }
      }
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  // Splash screen göster
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }


  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {session ? (
              // Kullanıcı giriş yapmış - Ana ekrana yönlendir
              <Stack.Screen name="Main">
                {(props) => <BottomTabNavigator {...props} isDemo={false} />}
              </Stack.Screen>
            ) : (
              // Kullanıcı giriş yapmamış - Login ekranı göster
              <>
                <Stack.Screen 
                  name="Login" 
                  component={LoginScreen}
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen 
                  name="Register" 
                  component={RegisterScreen}
                  options={{
                    headerShown: true,
                    headerTitle: '',
                    headerBackVisible: true,
                  }}
                />
                <Stack.Screen 
                  name="AdminLogin" 
                  component={AdminLoginScreen}
                  options={{
                    headerShown: true,
                    headerTitle: 'Admin Girişi',
                    headerBackVisible: true,
                  }}
                />
                <Stack.Screen 
                  name="AdminDashboard" 
                  component={AdminDashboardScreen}
                  options={{
                    headerShown: true,
                    headerTitle: 'Admin Panel',
                    headerBackVisible: true,
                  }}
                />
                <Stack.Screen 
                  name="InstitutionAdminLogin" 
                  component={InstitutionAdminLoginScreen}
                  options={{
                    headerShown: true,
                    headerTitle: 'Kurum Admin Girişi',
                    headerBackVisible: true,
                  }}
                />
                <Stack.Screen 
                  name="InstitutionAdmin" 
                  component={InstitutionAdminScreen}
                  options={{
                    headerShown: false, // Custom header kullanıyoruz
                    gestureEnabled: false, // Swipe back'ı devre dışı bırak
                  }}
                />
                <Stack.Screen 
                  name="Demo" 
                  options={{
                    headerShown: false,
                    gestureEnabled: true,
                  }}
                >
                  {(props) => <BottomTabNavigator {...props} isDemo={true} />}
                </Stack.Screen>
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style={isDark ? "light" : "dark"} />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
