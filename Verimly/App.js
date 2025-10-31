import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
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
    
    // Çok kısa timeout ile session kontrolü (1 saniye)
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Session check timeout')), 1000);
    });

    Promise.race([sessionPromise, timeoutPromise])
      .then(({ data: { session }, error }) => {
        clearTimeout(timeoutId);
        if (error) {
          console.log('Session error:', error);
          setSession(null);
        } else {
          setSession(session);
        }
        setLoading(false);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.log('Session check failed or timeout:', error);
        setSession(null);
        setLoading(false);
      });

    // Session değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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
                  name="Demo" 
                  component={BottomTabNavigator}
                  initialParams={{ isDemo: true }}
                />
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
