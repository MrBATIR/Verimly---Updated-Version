import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Supabase bağlantı bilgileri - Environment variables'dan veya app.json'dan alınır
// NOT: Service Key artık frontend'de TUTULMAYACAK!
// Service Key sadece backend'de (Supabase Edge Functions veya Node.js API) kullanılmalıdır.
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 'https://jxxtdljuarnxsmqstzyy.supabase.co';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4eHRkbGp1YXJueHNtcXN0enl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMzgyMjUsImV4cCI6MjA3NzU5ODIyNX0.4A2TdG1ZYvyEKOv2D4S9TVbXeGe8or8v_ZEy-3_MbP0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ⚠️ GÜVENLİK UYARISI: supabaseAdmin artık burada TANIMLANMIYOR!
// Service Key frontend'de TUTULMAMALIDIR. 
// Admin işlemleri için Supabase Edge Functions kullanılmalıdır.
// 
// Örnek kullanım:
// const { data, error } = await supabase.functions.invoke('function-name', {
//   body: { ... },
//   headers: {
//     Authorization: `Bearer ${session.access_token}`
//   }
// });

