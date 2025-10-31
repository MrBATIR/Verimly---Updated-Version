import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, DARK_COLORS, SIZES } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { InterstitialAd } from '../components';
import * as teacherApi from '../lib/teacherApi';
import * as messageApi from '../lib/messageApi';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import ReportsScreen from '../screens/ReportsScreen';
import AddLogScreen from '../screens/AddLogScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TeacherDashboardScreen from '../screens/TeacherDashboardScreen';
import TeacherHomeScreen from '../screens/TeacherHomeScreen';
import TeacherReportsScreen from '../screens/TeacherReportsScreen';
import TeacherAddScreen from '../screens/TeacherAddScreen';
import TeacherRequestsScreen from '../screens/TeacherRequestsScreen';
import TeacherStudentDetailScreen from '../screens/TeacherStudentDetailScreen';
import TeacherMessageScreen from '../screens/TeacherMessageScreen';
import StudentMessageScreen from '../screens/StudentMessageScreen';
import TeacherPlanScreen from '../screens/TeacherPlanScreen';
import StudentPlanScreen from '../screens/StudentPlanScreen';
import AdminLoginScreen from '../screens/AdminLoginScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AdminTeachersScreen from '../screens/AdminTeacherScreen';
import AdminStudentsScreen from '../screens/AdminStudentsScreen';

const Tab = createBottomTabNavigator();

function BottomTabNavigatorContent({ isDemo }) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  
  const [userType, setUserType] = useState(null); // null = henüz belirlenmedi
  const [loading, setLoading] = useState(true);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [hasTeacherConnection, setHasTeacherConnection] = useState(false); // Öğretmen bağlantısı var mı?
  const [isIndividualUser, setIsIndividualUser] = useState(false); // Bireysel kullanıcı mı?
  
  // Interstitial reklam hook'u
  const { showAd: showInterstitialAd, isLoaded: isInterstitialLoaded } = InterstitialAd(null, 'navigation');
  
  // Tab değişimlerinde interstitial ad göster - Sadece belirli tab'larda
  const [lastAdTime, setLastAdTime] = useState(0);
  const [currentTab, setCurrentTab] = useState('');
  
  useFocusEffect(
    React.useCallback(() => {
      const now = Date.now();
      const timeSinceLastAd = now - lastAdTime;
      
      // Sadece Raporlar ve Çalışma Ekleme tab'larında reklam göster
      if (currentTab !== 'Reports' && currentTab !== 'AddLog') {
        return;
      }
      
      // En az 20 saniye bekle
      if (timeSinceLastAd < 20000) {
        return;
      }
      
      setLastAdTime(now);
      
      setTimeout(() => {
        showInterstitialAd();
      }, 1000);
    }, [showInterstitialAd, lastAdTime, currentTab])
  );

  useEffect(() => {
    if (!isDemo) {
      checkUserType();
    } else {
      setLoading(false);
      setUserType('student'); // Demo modda öğrenci olarak göster
    }
  }, [isDemo]);


  // Real-time güncelleme için interval ekle
  useEffect(() => {
    if (isDemo) return;

    // Her 3 saniyede bir kontrol et (mesaj ekranı ile senkronize)
    const interval = setInterval(() => {
      if (userType === 'teacher') {
        loadPendingRequestsCount();
      } else if (userType === 'student') {
        loadUnreadMessageCount();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isDemo, userType]);

  const checkUserType = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('user_type')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          setUserType(profile.user_type || 'student');
          
          // Bireysel kullanıcı kontrolü
          // Bireysel kullanıcı kontrolü: kullanıcı sadece 'Bireysel Kullanıcılar' kurumunda mı?
          const { data: memberships } = await supabase
            .from('institution_memberships')
            .select('institution_id')
            .eq('user_id', user.id);

          let individualUser = false;
          if (memberships && memberships.length > 0) {
            const instIds = memberships.map(m => m.institution_id);
            const { data: insts } = await supabase
              .from('institutions')
              .select('id, name')
              .in('id', instIds);

            const hasOnlyIndividual = insts && insts.length > 0 
              && insts.every(i => i.name === 'Bireysel Kullanıcılar');
            individualUser = hasOnlyIndividual;
          } else {
            // Kurumsuz kullanıcıları bireysel say
            individualUser = true;
          }
          setIsIndividualUser(individualUser);
          
          // Eğer öğretmen ise bekleyen istekleri yükle
          if (profile.user_type === 'teacher') {
            loadPendingRequestsCount();
          }
          // Eğer öğrenci ise mesaj sayısını yükle ve öğretmen bağlantısını kontrol et
          if (profile.user_type === 'student') {
            loadUnreadMessageCount();
            await checkTeacherConnection(user.id);
          }
        }
      }
    } catch (error) {
      console.error('Kullanıcı tipi kontrolü hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkTeacherConnection = async (userId) => {
    try {
      // Öğrencinin onaylanmış öğretmen bağlantısı var mı kontrol et
      const { data, error } = await supabase
        .from('student_teachers')
        .select('id')
        .eq('student_id', userId)
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .limit(1);

      if (error) {
        console.error('Teacher connection check error:', error);
        setHasTeacherConnection(false);
      } else {
        setHasTeacherConnection(data && data.length > 0);
      }
    } catch (error) {
      console.error('Teacher connection check error:', error);
      setHasTeacherConnection(false);
    }
  };

  const loadPendingRequestsCount = async () => {
    try {
      const result = await teacherApi.getPendingRequests();
      if (result.success) {
        setPendingRequestsCount(result.data?.length || 0);
      }
    } catch (error) {
      console.error('Bekleyen istekler yüklenirken hata:', error);
    }
  };

  const loadUnreadMessageCount = async () => {
    try {
      const result = await messageApi.getUnreadMessageCount();
      if (result.success) {
        setUnreadMessageCount(result.count);
      }
    } catch (error) {
      console.error('Okunmamış mesaj sayısı yüklenirken hata:', error);
    }
  };
  

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Reports') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'AddLog') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'TeacherDashboard') {
            iconName = focused ? 'school' : 'school-outline';
          } else if (route.name === 'TeacherHome') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'TeacherReports') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'TeacherAdd') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'TeacherMessage') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'StudentMessage') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 8,
          shadowColor: isDark ? '#000' : '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: SIZES.tiny,
          fontWeight: '600',
          marginBottom: Platform.OS === 'ios' ? 0 : 4,
        },
      })}
    >
         {userType === 'teacher' ? (
           // Öğretmen ekranları
           <>
             <Tab.Screen 
               name="TeacherHome" 
               component={TeacherHomeScreen}
               initialParams={{ isDemo }}
               options={{ tabBarLabel: 'Ana Sayfa' }}
             />
             <Tab.Screen 
               name="TeacherReports" 
               component={TeacherReportsScreen}
               initialParams={{ isDemo }}
               options={{ tabBarLabel: 'Raporlar' }}
             />
             <Tab.Screen 
               name="TeacherMessage" 
               component={TeacherMessageScreen}
               initialParams={{ isDemo }}
               options={{ tabBarLabel: 'Mesajlar' }}
             />
            <Tab.Screen 
              name="TeacherAdd" 
              component={TeacherAddScreen}
              initialParams={{ isDemo }}
              options={{ 
                tabBarLabel: 'Öğrenci',
                tabBarIcon: ({ focused, color, size }) => (
                  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons 
                      name={focused ? 'add-circle' : 'add-circle-outline'} 
                      size={size} 
                      color={color} 
                    />
                  </View>
                )
              }}
            />
           </>
         ) : (
        // Öğrenci ekranları
        <> 
             <Tab.Screen 
               name="Dashboard" 
               component={DashboardScreen}
               initialParams={{ isDemo }}
               options={{ tabBarLabel: 'Ana Sayfa' }}
               listeners={({ navigation }) => ({
                 tabPress: (e) => {
                   setCurrentTab('Dashboard');
                 },
               })}
             />
          <Tab.Screen 
            name="Reports" 
            component={ReportsScreen}
            initialParams={{ isDemo }}
            options={{ tabBarLabel: 'Raporlar' }}
            listeners={({ navigation }) => ({
              tabPress: (e) => {
                setCurrentTab('Reports');
              },
            })}
          />
          <Tab.Screen 
            name="StudentPlan" 
            component={StudentPlanScreen}
            initialParams={{ isDemo }}
            options={{ 
              tabBarLabel: 'Planlarım',
              tabBarIcon: ({ focused, color, size }) => (
                <Ionicons 
                  name={focused ? 'calendar' : 'calendar-outline'} 
                  size={size} 
                  color={color} 
                />
              ),
            }}
          />
          <Tab.Screen 
            name="AddLog" 
            component={AddLogScreen}
            initialParams={{ isDemo }}
            options={{ 
              tabBarLabel: 'Çalışma Ekle',
              tabBarIcon: ({ focused, color, size }) => (
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons 
                    name={focused ? 'add-circle' : 'add-circle-outline'} 
                    size={size} 
                    color={color} 
                  />
                </View>
              )
            }}
            listeners={({ navigation }) => ({
              tabPress: (e) => {
                setCurrentTab('AddLog');
                // Alt tab'dan ekle butonuna basıldığında params'ı temizle
                // Böylece her zaman yeni ekleme modu açılır
                navigation.setParams({ studyId: undefined });
              },
            })}
          />
          {(!isIndividualUser) && (
            <Tab.Screen 
              name="StudentMessage" 
              component={StudentMessageScreen}
              initialParams={{ isDemo }}
              options={{ tabBarLabel: 'Mesajlar' }}
            />
          )}
        </>
      )}
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        initialParams={{ isDemo }}
        options={{ tabBarLabel: 'Profil' }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            setCurrentTab('Profile');
          },
        })}
      />
    </Tab.Navigator>
  );
}

export default function BottomTabNavigator({ route, isDemo: propIsDemo }) {
  const isDemo = propIsDemo || route?.params?.isDemo || false;
  return <BottomTabNavigatorContent isDemo={isDemo} />;
}

