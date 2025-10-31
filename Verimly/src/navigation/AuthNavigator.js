import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AdminLoginScreen from '../screens/AdminLoginScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AdminTeachersScreen from '../screens/AdminTeacherScreen';
import AdminStudentsScreen from '../screens/AdminStudentsScreen';
import AdminInstitutionsScreen from '../screens/AdminInstitutionsScreen';
import AdminIndividualUsersScreen from '../screens/AdminIndividualUsersScreen';
import InstitutionAdminScreen from '../screens/InstitutionAdminScreen';
import { COLORS } from '../constants/theme';

const Stack = createNativeStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.surface,
        },
        headerTintColor: COLORS.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{
          headerTitle: '',
          headerBackVisible: true,
        }}
      />
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen}
        options={{
          headerTitle: '',
          headerBackVisible: true,
        }}
      />
      <Stack.Screen 
        name="AdminLogin" 
        component={AdminLoginScreen}
        options={{
          headerTitle: 'Admin Girişi',
          headerBackVisible: true,
        }}
      />
      <Stack.Screen 
        name="AdminDashboard" 
        component={AdminDashboardScreen}
        options={{
          headerTitle: 'Admin Panel',
          headerBackVisible: true,
        }}
      />
      <Stack.Screen 
        name="AdminTeachers" 
        component={AdminTeachersScreen}
        options={{
          headerTitle: 'Öğretmen Yönetimi',
          headerBackVisible: true,
        }}
      />
      <Stack.Screen 
        name="AdminStudents" 
        component={AdminStudentsScreen}
        options={{
          headerTitle: 'Öğrenci Yönetimi',
          headerBackVisible: true,
        }}
      />
      <Stack.Screen 
        name="AdminInstitutions" 
        component={AdminInstitutionsScreen}
        options={{
          headerTitle: 'Kurum Yönetimi',
          headerBackVisible: true,
        }}
      />
      <Stack.Screen 
        name="AdminIndividualUsers" 
        component={AdminIndividualUsersScreen}
        options={{
          headerTitle: 'Bireysel Kullanıcılar',
          headerBackVisible: true,
        }}
      />
      <Stack.Screen 
        name="InstitutionAdmin" 
        component={InstitutionAdminScreen}
        options={{
          headerTitle: 'Kurum Yönetimi',
          headerBackVisible: true,
        }}
      />
    </Stack.Navigator>
  );
}

