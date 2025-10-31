/**
 * Toplu Öğretmen Ekleme Script'i
 * 
 * Kullanım:
 * 1. Aşağıdaki teachers dizisine öğretmen bilgilerini ekleyin
 * 2. INSTITUTION_ID'yi güncelleyin
 * 3. node bulk_add_teachers.js komutu ile çalıştırın
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase bağlantı bilgileri
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_SERVICE_KEY = 'your-service-role-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Kurum ID'si (Kurum yönetim panelinden alabilirsiniz)
const INSTITUTION_ID = 'your-institution-id';

// Eklenecek öğretmenler
const teachers = [
  {
    firstName: 'Ahmet',
    lastName: 'Yılmaz',
    email: 'ahmet.yilmaz@okul.com',
    branch: 'Matematik',
    phone: '5551234567'
  },
  {
    firstName: 'Ayşe',
    lastName: 'Demir',
    email: 'ayse.demir@okul.com',
    branch: 'Türkçe',
    phone: '5551234568'
  },
  {
    firstName: 'Mehmet',
    lastName: 'Kaya',
    email: 'mehmet.kaya@okul.com',
    branch: 'Fen Bilgisi',
    phone: '5551234569'
  },
  // Buraya daha fazla öğretmen ekleyebilirsiniz...
];

async function addTeacherBulk() {
  console.log(`\n🚀 Toplu öğretmen ekleme başlıyor...`);
  console.log(`📊 Toplam ${teachers.length} öğretmen eklenecek\n`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < teachers.length; i++) {
    const teacher = teachers[i];
    const progress = Math.round(((i + 1) / teachers.length) * 100);
    
    try {
      console.log(`[${i + 1}/${teachers.length}] ${teacher.firstName} ${teacher.lastName} ekleniyor...`);

      // 1. Auth kullanıcısı oluştur
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: teacher.email,
        password: 'teacher123',
        email_confirm: true,
        user_metadata: {
          first_name: teacher.firstName,
          last_name: teacher.lastName,
          user_type: 'teacher',
          branch: teacher.branch,
          phone: teacher.phone
        }
      });

      if (authError) {
        throw new Error(`Auth hatası: ${authError.message}`);
      }

      const userId = authData.user.id;

      // 2. User profile oluştur
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          user_type: 'teacher',
          name: `${teacher.firstName} ${teacher.lastName}`,
          email: teacher.email
        });

      if (profileError) {
        throw new Error(`Profile hatası: ${profileError.message}`);
      }

      // 3. Teachers tablosuna ekle
      const { error: teacherError } = await supabase
        .from('teachers')
        .insert({
          user_id: userId,
          teacher_code: `T${Date.now()}${i}`,
          name: `${teacher.firstName} ${teacher.lastName}`,
          email: teacher.email,
          branch: teacher.branch,
          phone: teacher.phone,
          institution_id: INSTITUTION_ID
        });

      if (teacherError) {
        throw new Error(`Teacher hatası: ${teacherError.message}`);
      }

      // 4. Institution membership ekle
      const { error: membershipError } = await supabase
        .from('institution_memberships')
        .insert({
          user_id: userId,
          institution_id: INSTITUTION_ID,
          role: 'teacher'
        });

      if (membershipError) {
        throw new Error(`Membership hatası: ${membershipError.message}`);
      }

      console.log(`✅ ${teacher.firstName} ${teacher.lastName} başarıyla eklendi (${progress}%)`);
      successCount++;

    } catch (error) {
      console.error(`❌ ${teacher.firstName} ${teacher.lastName} eklenemedi: ${error.message}`);
      errorCount++;
      errors.push({
        teacher: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        error: error.message
      });
    }

    // Rate limiting için kısa bir bekleme
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n📊 İşlem Tamamlandı!`);
  console.log(`✅ Başarılı: ${successCount}`);
  console.log(`❌ Hatalı: ${errorCount}`);

  if (errors.length > 0) {
    console.log(`\n❌ Hatalar:`);
    errors.forEach(err => {
      console.log(`   - ${err.teacher} (${err.email}): ${err.error}`);
    });
  }

  console.log(`\n🔑 Tüm öğretmenlerin şifresi: teacher123`);
}

// Script'i çalıştır
addTeacherBulk()
  .then(() => {
    console.log('\n✅ Script başarıyla tamamlandı!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script hatası:', error);
    process.exit(1);
  });

