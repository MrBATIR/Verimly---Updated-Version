/**
 * CSV'den Toplu Öğretmen Ekleme Script'i
 * 
 * Kullanım:
 * 1. ogretmen_listesi.csv dosyasını hazırlayın
 * 2. SUPABASE_URL, SUPABASE_SERVICE_KEY ve INSTITUTION_ID'yi güncelleyin
 * 3. npm install @supabase/supabase-js csv-parser
 * 4. node bulk_add_teachers_from_csv.js komutu ile çalıştırın
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const csv = require('csv-parser');

// Supabase bağlantı bilgileri
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_SERVICE_KEY = 'your-service-role-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Kurum ID'si
const INSTITUTION_ID = 'your-institution-id';

// CSV dosya yolu
const CSV_FILE = './ogretmen_listesi.csv';

async function readCSV() {
  return new Promise((resolve, reject) => {
    const teachers = [];
    
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on('data', (row) => {
        teachers.push({
          firstName: row.firstName || row['Ad'] || row['ad'],
          lastName: row.lastName || row['Soyad'] || row['soyad'],
          email: row.email || row['E-posta'] || row['eposta'],
          branch: row.branch || row['Branş'] || row['brans'],
          phone: row.phone || row['Telefon'] || row['telefon']
        });
      })
      .on('end', () => {
        resolve(teachers);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

async function addTeacherBulk() {
  console.log(`\n🚀 CSV dosyası okunuyor: ${CSV_FILE}\n`);

  let teachers;
  try {
    teachers = await readCSV();
    console.log(`📊 ${teachers.length} öğretmen bulundu\n`);
  } catch (error) {
    console.error(`❌ CSV dosyası okunamadı: ${error.message}`);
    console.log(`\n💡 İpucu: ogretmen_listesi.csv dosyasının mevcut olduğundan emin olun.`);
    return;
  }

  if (teachers.length === 0) {
    console.log('❌ CSV dosyasında öğretmen bulunamadı!');
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  const addedTeachers = [];

  for (let i = 0; i < teachers.length; i++) {
    const teacher = teachers[i];
    const progress = Math.round(((i + 1) / teachers.length) * 100);
    
    // Geçersiz veri kontrolü
    if (!teacher.firstName || !teacher.lastName || !teacher.email) {
      console.log(`⚠️  [${i + 1}/${teachers.length}] Geçersiz veri, atlanıyor...`);
      errorCount++;
      errors.push({
        teacher: `${teacher.firstName || ''} ${teacher.lastName || ''}`,
        email: teacher.email || 'N/A',
        error: 'Eksik bilgi (Ad, Soyad veya E-posta)'
      });
      continue;
    }

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
          branch: teacher.branch || '',
          phone: teacher.phone || ''
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
          branch: teacher.branch || '',
          phone: teacher.phone || '',
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
      addedTeachers.push({
        name: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        password: 'teacher123'
      });

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

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 İşlem Tamamlandı!`);
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Başarılı: ${successCount}`);
  console.log(`❌ Hatalı: ${errorCount}`);

  if (addedTeachers.length > 0) {
    console.log(`\n✅ Eklenen Öğretmenler:`);
    addedTeachers.forEach((t, idx) => {
      console.log(`   ${idx + 1}. ${t.name}`);
      console.log(`      E-posta: ${t.email}`);
      console.log(`      Şifre: ${t.password}`);
    });
  }

  if (errors.length > 0) {
    console.log(`\n❌ Hatalar:`);
    errors.forEach((err, idx) => {
      console.log(`   ${idx + 1}. ${err.teacher} (${err.email})`);
      console.log(`      Hata: ${err.error}`);
    });
  }

  console.log(`\n🔑 Tüm öğretmenlerin varsayılan şifresi: teacher123`);
  console.log(`💡 Öğretmenler ilk girişte şifrelerini değiştirebilirler.\n`);
}

// Script'i çalıştır
addTeacherBulk()
  .then(() => {
    console.log('✅ Script başarıyla tamamlandı!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script hatası:', error);
    process.exit(1);
  });

