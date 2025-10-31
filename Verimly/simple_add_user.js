// Basit kullanıcı ekleme - sadece bilgileri kaydet
const addStudentSimple = async (studentData) => {
  try {
    // Sadece students tablosuna ekle (auth.users'a ekleme)
    const { data, error } = await supabase
      .from('students')
      .insert({
        name: `${studentData.firstName} ${studentData.lastName}`,
        email: studentData.email,
        phone: studentData.phone,
        school: studentData.school,
        grade: studentData.grade,
        parent_name: studentData.parentName,
        parent_phone: studentData.parentPhone,
        address: studentData.address,
        notes: studentData.notes
      });

    if (error) {
      console.error('Öğrenci kaydetme hatası:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      message: `Öğrenci bilgileri kaydedildi!\n\nKullanıcıya söyleyin:\n1. Uygulamayı açsın\n2. "Kayıt Ol" butonuna tıklasın\n3. E-posta: ${studentData.email}\n4. Şifre: student123\n5. Kayıt olsun`
    };
  } catch (error) {
    console.error('Öğrenci kaydetme hatası:', error);
    return { success: false, error: error.message };
  }
};

const addTeacherSimple = async (teacherData) => {
  try {
    // Sadece teachers tablosuna ekle (auth.users'a ekleme)
    const { data, error } = await supabase
      .from('teachers')
      .insert({
        name: `${teacherData.firstName} ${teacherData.lastName}`,
        email: teacherData.email,
        branch: teacherData.branch,
        phone: teacherData.phone,
        experience: teacherData.experience,
        education: teacherData.education,
        address: teacherData.address,
        notes: teacherData.notes,
        teacher_code: `T${Date.now()}`, // Basit öğretmen kodu
        school_id: '00000000-0000-0000-0000-000000000000' // Varsayılan okul ID
      });

    if (error) {
      console.error('Öğretmen kaydetme hatası:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      message: `Öğretmen bilgileri kaydedildi!\n\nKullanıcıya söyleyin:\n1. Uygulamayı açsın\n2. "Kayıt Ol" butonuna tıklasın\n3. E-posta: ${teacherData.email}\n4. Şifre: teacher123\n5. Kayıt olsun`
    };
  } catch (error) {
    console.error('Öğretmen kaydetme hatası:', error);
    return { success: false, error: error.message };
  }
};

