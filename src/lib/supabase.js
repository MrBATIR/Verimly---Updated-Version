import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Supabase projenizin URL ve Anon Key'ini buraya ekleyin
const supabaseUrl = 'https://jxxtdljuarnxsmqstzyy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4eHRkbGp1YXJueHNtcXN0enl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NDA5NjIsImV4cCI6MjA3NTAxNjk2Mn0.WHb49D9qunSCmHUIYO4OqwmGn-uDNf3Zu5oukDISqi8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Admin yetkileri için ayrı client (şifre sıfırlama için)
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4eHRkbGp1YXJueHNtcXN0enl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ0MDk2MiwiZXhwIjoyMDc1MDE2OTYyfQ.bc6ALb5juxEFBgDnSqn4GcjKHBoBCqIuysAG-F5S6Ss';

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

