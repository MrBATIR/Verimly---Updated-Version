import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BottomTabNavigator from './BottomTabNavigator';
import AuthNavigator from './AuthNavigator';
import TeacherStudentDetailScreen from '../screens/TeacherStudentDetailScreen';
import TeacherPlanScreen from '../screens/TeacherPlanScreen';
import TeacherRequestsScreen from '../screens/TeacherRequestsScreen';
import AdminInstitutionsScreen from '../screens/AdminInstitutionsScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  // TODO: Supabase auth state ile değiştirilecek
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={BottomTabNavigator} />
          <Stack.Screen 
            name="Auth" 
            component={AuthNavigator}
            options={{
              presentation: 'modal',
            }}
          />
          <Stack.Screen 
            name="TeacherStudentDetail" 
            component={TeacherStudentDetailScreen}
            options={{
              presentation: 'card',
            }}
          />
          <Stack.Screen 
            name="TeacherPlan" 
            component={TeacherPlanScreen}
            options={{
              presentation: 'card',
            }}
          />
          <Stack.Screen 
            name="TeacherRequests" 
            component={TeacherRequestsScreen}
            options={{
              presentation: 'card',
            }}
          />
          <Stack.Screen 
            name="AdminInstitutions" 
            component={AdminInstitutionsScreen}
            options={{
              presentation: 'card',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

