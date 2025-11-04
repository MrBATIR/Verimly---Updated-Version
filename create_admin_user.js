/**
 * Admin Kullanıcısı Oluşturma Script'i
 * 
 * Kullanım:
 * 1. Aşağıdaki ADMIN_EMAIL ve ADMIN_PASSWORD değerlerini güncelleyin
 * 2. SUPABASE_URL ve SUPABASE_SERVICE_KEY değerlerini güncelleyin
 * 3. node create_admin_user.js komutu ile çalıştırın
 * 
 * NOT: Service Key'i güvenli tutun, bu key en yüksek yetkiye sahiptir!
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase bağlantı bilgileri
const SUPABASE_URL = 'https://jxxtdljuarnxsmqstzyy.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4eHRkbGp1YXJueHNtcXN0enl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ0MDk2MiwiZXhwIjoyMDc1MDE2OTYyfQ.bc6ALb5juxEFBgDnSqn4GcjKHBoBCqIuysAG-F5S6Ss';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Admin bilgileri - BUNLARI DEĞİŞTİRİN!
const ADMIN_EMAIL = 'admin@verimly.com';
const ADMIN_PASSWORD = 'Admin123!@#'; // Güçlü bir şifre kullanın!
const ADMIN_NAME = 'Verimly Admin';

async function createAdminUser() {
  console.log('\n🔐 Admin kullanıcısı oluşturuluyor...\n');
  console.log(`📧 E-posta: ${ADMIN_EMAIL}`);
  console.log(`👤 İsim: ${ADMIN_NAME}\n`);

  try {
    // 1. Önce kullanıcının zaten var olup olmadığını kontrol et
    console.log('1️⃣ Kullanıcı kontrolü yapılıyor...');
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Kullanıcı listesi alınamadı:', listError.message);
      return;
    }

    const existingUser = existingUsers?.users?.find(u => u.email === ADMIN_EMAIL);
    
    if (existingUser) {
      console.log('⚠️  Bu e-posta adresi zaten kullanılıyor!');
      console.log(`   Kullanıcı ID: ${existingUser.id}`);
      
      // Kullanıcı profili var mı kontrol et
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', existingUser.id)
        .single();

      if (existingProfile) {
        if (existingProfile.user_type === 'admin') {
          console.log('✅ Bu kullanıcı zaten admin olarak kayıtlı!');
          console.log('\n📋 Mevcut Admin Bilgileri:');
          console.log(`   User ID: ${existingUser.id}`);
          console.log(`   E-posta: ${existingUser.email}`);
          console.log(`   İsim: ${existingProfile.name}`);
          console.log(`   User Type: ${existingProfile.user_type}`);
          console.log('\n✅ İşlem tamamlandı. Zaten admin kullanıcısı mevcut.');
          return;
        } else {
          console.log('⚠️  Kullanıcı var ama admin değil. Admin yapılıyor...');
          // user_type'ı admin yap
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ user_type: 'admin' })
            .eq('user_id', existingUser.id);

          if (updateError) {
            console.error('❌ Profil güncellenemedi:', updateError.message);
            return;
          }

          console.log('✅ Kullanıcı admin yapıldı!');
          console.log('\n📋 Admin Bilgileri:');
          console.log(`   User ID: ${existingUser.id}`);
          console.log(`   E-posta: ${existingUser.email}`);
          console.log('\n✅ İşlem tamamlandı!');
          return;
        }
      } else {
        // Kullanıcı var ama profil yok - profil oluştur
        console.log('📝 Kullanıcı profili oluşturuluyor...');
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: existingUser.id,
            user_type: 'admin',
            name: ADMIN_NAME,
            email: ADMIN_EMAIL
          });

        if (profileError) {
          console.error('❌ Profil oluşturulamadı:', profileError.message);
          return;
        }

        console.log('✅ Profil oluşturuldu!');
        console.log('\n📋 Admin Bilgileri:');
        console.log(`   User ID: ${existingUser.id}`);
        console.log(`   E-posta: ${existingUser.email}`);
        console.log('\n✅ İşlem tamamlandı!');
        return;
      }
    }

    // 2. Yeni admin kullanıcısı oluştur
    console.log('2️⃣ Yeni admin kullanıcısı oluşturuluyor...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true, // E-posta doğrulamasını atla
      user_metadata: {
        name: ADMIN_NAME,
        user_type: 'admin'
      }
    });

    if (authError) {
      console.error('❌ Auth kullanıcısı oluşturulamadı:', authError.message);
      return;
    }

    const userId = authData.user.id;
    console.log(`✅ Auth kullanıcısı oluşturuldu! (ID: ${userId})`);

    // 3. User profile oluştur veya güncelle
    console.log('3️⃣ User profile oluşturuluyor/güncelleniyor...');
    
    // Önce var mı kontrol et
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingProfile) {
      // Zaten var, admin yap
      console.log('⚠️  Profil zaten var, admin yapılıyor...');
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          user_type: 'admin',
          name: ADMIN_NAME,
          email: ADMIN_EMAIL
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('❌ User profile güncellenemedi:', updateError.message);
        return;
      }
      console.log('✅ User profile admin olarak güncellendi!');
    } else {
      // Yeni oluştur
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          user_type: 'admin',
          name: ADMIN_NAME,
          email: ADMIN_EMAIL
        });

      if (profileError) {
        console.error('❌ User profile oluşturulamadı:', profileError.message);
        console.log('⚠️  Auth kullanıcısı oluşturuldu ama profil oluşturulamadı.');
        console.log(`   User ID: ${userId}`);
        console.log('   Manuel olarak user_profiles tablosuna ekleyebilirsiniz.');
        return;
      }

      console.log('✅ User profile oluşturuldu!');
    }

    // 4. Başarı mesajı
    console.log('\n🎉 ADMIN KULLANICISI BAŞARIYLA OLUŞTURULDU!\n');
    console.log('📋 Admin Bilgileri:');
    console.log(`   User ID: ${userId}`);
    console.log(`   E-posta: ${ADMIN_EMAIL}`);
    console.log(`   Şifre: ${ADMIN_PASSWORD}`);
    console.log(`   İsim: ${ADMIN_NAME}`);
    console.log(`   User Type: admin`);
    console.log('\n⚠️  ÖNEMLİ GÜVENLİK NOTLARI:');
    console.log('   1. Bu şifreyi güvenli bir yerde saklayın');
    console.log('   2. İlk girişten sonra şifreyi değiştirmenizi öneririz');
    console.log('   3. Service Key\'i asla paylaşmayın');
    console.log('\n✅ İşlem tamamlandı! Artık admin paneline giriş yapabilirsiniz.\n');

  } catch (error) {
    console.error('❌ Beklenmeyen bir hata oluştu:', error.message);
    console.error(error);
  }
}

// Script'i çalıştır
createAdminUser()
  .then(() => {
    console.log('✨ Script tamamlandı.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script hatası:', error);
    process.exit(1);
  });

