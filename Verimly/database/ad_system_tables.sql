-- Reklam Sistemi Veritabanı Tabloları
-- 5 reklam izleme = 1 günlük reklam kaldırma sistemi

-- 1. Kullanıcı reklam izleme tablosu
CREATE TABLE IF NOT EXISTS user_ad_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_type VARCHAR(20) NOT NULL CHECK (ad_type IN ('interstitial', 'rewarded', 'banner')),
  watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Kullanıcı reklam kaldırma durumu
CREATE TABLE IF NOT EXISTS user_ad_removals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  removal_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Premium üyelik tablosu
CREATE TABLE IF NOT EXISTS user_premium (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_premium BOOLEAN DEFAULT false,
  premium_start_date TIMESTAMP WITH TIME ZONE,
  premium_end_date TIMESTAMP WITH TIME ZONE,
  auto_renewal BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- auto_renewal sütununu mevcut tabloya ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_premium' AND column_name = 'auto_renewal') THEN
        ALTER TABLE user_premium ADD COLUMN auto_renewal BOOLEAN DEFAULT true;
    END IF;
END $$;


-- 4. Günlük reklam sayaç tablosu
CREATE TABLE IF NOT EXISTS user_daily_ad_count (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  count_date DATE NOT NULL,
  interstitial_count INTEGER DEFAULT 0,
  rewarded_count INTEGER DEFAULT 0,
  banner_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, count_date)
);

-- 5. Kurumlar tablosu
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'school', 'university', 'company', 'individual'
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  address TEXT,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT false, -- Manuel kontrol: kurum aktif mi?
  is_premium BOOLEAN DEFAULT false,
  premium_start_date TIMESTAMP WITH TIME ZONE,
  premium_end_date TIMESTAMP WITH TIME ZONE,
  auto_renewal BOOLEAN DEFAULT false, -- Manuel kontrol için false
  renewal_type VARCHAR(20) DEFAULT 'manual', -- 'manual', 'yearly', 'monthly'
  renewal_date DATE, -- Yıllık yenileme tarihi (1 Temmuz)
  max_teachers INTEGER DEFAULT 50,
  max_students INTEGER DEFAULT 500,
  contract_start_date DATE, -- Sözleşme başlangıç tarihi
  contract_end_date DATE, -- Sözleşme bitiş tarihi
  payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'overdue'
  notes TEXT, -- Admin notları
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Kurum üyelikleri tablosu
CREATE TABLE IF NOT EXISTS institution_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'admin', 'teacher', 'student'
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(institution_id, user_id)
);

-- 7. Kurum admin giriş bilgileri tablosu
CREATE TABLE IF NOT EXISTS institution_admin_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  admin_username VARCHAR(50) NOT NULL,
  admin_password VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(institution_id, admin_username)
);

-- institutions tablosuna manuel kontrol sütunları ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'institutions' AND column_name = 'is_active') THEN
        ALTER TABLE institutions ADD COLUMN is_active BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'institutions' AND column_name = 'renewal_type') THEN
        ALTER TABLE institutions ADD COLUMN renewal_type VARCHAR(20) DEFAULT 'manual';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'institutions' AND column_name = 'renewal_date') THEN
        ALTER TABLE institutions ADD COLUMN renewal_date DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'institutions' AND column_name = 'contract_start_date') THEN
        ALTER TABLE institutions ADD COLUMN contract_start_date DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'institutions' AND column_name = 'contract_end_date') THEN
        ALTER TABLE institutions ADD COLUMN contract_end_date DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'institutions' AND column_name = 'payment_status') THEN
        ALTER TABLE institutions ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'institutions' AND column_name = 'notes') THEN
        ALTER TABLE institutions ADD COLUMN notes TEXT;
    END IF;
    
    -- auto_renewal'ı false yap (manuel kontrol için)
    UPDATE institutions SET auto_renewal = false WHERE auto_renewal IS NULL;
    UPDATE institutions SET renewal_type = 'manual' WHERE renewal_type IS NULL;
END $$;

-- user_profiles tablosuna institution_id sütunu ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'institution_id') THEN
        ALTER TABLE user_profiles ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_user_ad_watches_user_id ON user_ad_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ad_watches_watched_at ON user_ad_watches(watched_at);
CREATE INDEX IF NOT EXISTS idx_user_ad_removals_user_id ON user_ad_removals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ad_removals_removal_date ON user_ad_removals(removal_date);
CREATE INDEX IF NOT EXISTS idx_user_premium_user_id ON user_premium(user_id);
CREATE INDEX IF NOT EXISTS idx_user_daily_ad_count_user_id ON user_daily_ad_count(user_id);
CREATE INDEX IF NOT EXISTS idx_user_daily_ad_count_count_date ON user_daily_ad_count(count_date);
CREATE INDEX IF NOT EXISTS idx_institutions_admin_user_id ON institutions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_institution_memberships_institution_id ON institution_memberships(institution_id);
CREATE INDEX IF NOT EXISTS idx_institution_memberships_user_id ON institution_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_institution_id ON user_profiles(institution_id);
CREATE INDEX IF NOT EXISTS idx_institution_admin_credentials_institution_id ON institution_admin_credentials(institution_id);
CREATE INDEX IF NOT EXISTS idx_institution_admin_credentials_username ON institution_admin_credentials(admin_username);

-- RLS (Row Level Security) politikaları
ALTER TABLE user_ad_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ad_removals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_premium ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_ad_count ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_admin_credentials ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar sadece kendi verilerini görebilir (güvenli policy oluşturma)
DO $$
BEGIN
    -- user_ad_watches policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_ad_watches' AND policyname = 'Users can view own ad watches') THEN
        CREATE POLICY "Users can view own ad watches" ON user_ad_watches
          FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_ad_watches' AND policyname = 'Users can insert own ad watches') THEN
        CREATE POLICY "Users can insert own ad watches" ON user_ad_watches
          FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    -- user_ad_removals policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_ad_removals' AND policyname = 'Users can view own ad removals') THEN
        CREATE POLICY "Users can view own ad removals" ON user_ad_removals
          FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_ad_removals' AND policyname = 'Users can insert own ad removals') THEN
        CREATE POLICY "Users can insert own ad removals" ON user_ad_removals
          FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    -- user_premium policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_premium' AND policyname = 'Users can view own premium status') THEN
        CREATE POLICY "Users can view own premium status" ON user_premium
          FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_premium' AND policyname = 'Users can insert own premium status') THEN
        CREATE POLICY "Users can insert own premium status" ON user_premium
          FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_premium' AND policyname = 'Users can update own premium status') THEN
        CREATE POLICY "Users can update own premium status" ON user_premium
          FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    -- user_daily_ad_count policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_daily_ad_count' AND policyname = 'Users can view own daily ad count') THEN
        CREATE POLICY "Users can view own daily ad count" ON user_daily_ad_count
          FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_daily_ad_count' AND policyname = 'Users can insert own daily ad count') THEN
        CREATE POLICY "Users can insert own daily ad count" ON user_daily_ad_count
          FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_daily_ad_count' AND policyname = 'Users can update own daily ad count') THEN
        CREATE POLICY "Users can update own daily ad count" ON user_daily_ad_count
          FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    -- institutions policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'institutions' AND policyname = 'Users can view own institution') THEN
        CREATE POLICY "Users can view own institution" ON institutions
          FOR SELECT USING (auth.uid() = admin_user_id OR 
                           auth.uid() IN (SELECT user_id FROM institution_memberships WHERE institution_id = institutions.id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'institutions' AND policyname = 'Admins can manage own institution') THEN
        CREATE POLICY "Admins can manage own institution" ON institutions
          FOR ALL USING (auth.uid() = admin_user_id);
    END IF;

    -- institution_memberships policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'institution_memberships' AND policyname = 'Users can view own memberships') THEN
        CREATE POLICY "Users can view own memberships" ON institution_memberships
          FOR SELECT USING (auth.uid() = user_id OR 
                           auth.uid() IN (SELECT admin_user_id FROM institutions WHERE id = institution_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'institution_memberships' AND policyname = 'Admins can manage memberships') THEN
        CREATE POLICY "Admins can manage memberships" ON institution_memberships
          FOR ALL USING (auth.uid() IN (SELECT admin_user_id FROM institutions WHERE id = institution_id));
    END IF;

    -- institution_admin_credentials policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'institution_admin_credentials' AND policyname = 'System can manage admin credentials') THEN
        CREATE POLICY "System can manage admin credentials" ON institution_admin_credentials
          FOR ALL USING (true); -- Sadece sistem yönetimi için
    END IF;
END $$;

-- Trigger fonksiyonları
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Updated_at trigger'ları (güvenli oluşturma)
DO $$
BEGIN
    -- user_premium trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_premium_updated_at') THEN
        CREATE TRIGGER update_user_premium_updated_at 
          BEFORE UPDATE ON user_premium 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- user_daily_ad_count trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_daily_ad_count_updated_at') THEN
        CREATE TRIGGER update_user_daily_ad_count_updated_at 
          BEFORE UPDATE ON user_daily_ad_count 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- institutions trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_institutions_updated_at') THEN
        CREATE TRIGGER update_institutions_updated_at 
          BEFORE UPDATE ON institutions 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Günlük reklam sayacını güncelleyen fonksiyon
CREATE OR REPLACE FUNCTION increment_daily_ad_count(
  p_user_id UUID,
  p_ad_type VARCHAR(20)
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_daily_ad_count (user_id, count_date, interstitial_count, rewarded_count, banner_count)
  VALUES (
    p_user_id, 
    CURRENT_DATE, 
    CASE WHEN p_ad_type = 'interstitial' THEN 1 ELSE 0 END,
    CASE WHEN p_ad_type = 'rewarded' THEN 1 ELSE 0 END,
    CASE WHEN p_ad_type = 'banner' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, count_date)
  DO UPDATE SET
    interstitial_count = user_daily_ad_count.interstitial_count + 
      CASE WHEN p_ad_type = 'interstitial' THEN 1 ELSE 0 END,
    rewarded_count = user_daily_ad_count.rewarded_count + 
      CASE WHEN p_ad_type = 'rewarded' THEN 1 ELSE 0 END,
    banner_count = user_daily_ad_count.banner_count + 
      CASE WHEN p_ad_type = 'banner' THEN 1 ELSE 0 END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Reklam izleme kaydı ekleyen fonksiyon
CREATE OR REPLACE FUNCTION record_ad_watch(
  p_user_id UUID,
  p_ad_type VARCHAR(20)
)
RETURNS VOID AS $$
BEGIN
  -- Reklam izleme kaydını ekle
  INSERT INTO user_ad_watches (user_id, ad_type)
  VALUES (p_user_id, p_ad_type);
  
  -- Günlük sayacı güncelle
  PERFORM increment_daily_ad_count(p_user_id, p_ad_type);
END;
$$ LANGUAGE plpgsql;

-- 5 reklam izleme kontrolü ve reklam kaldırma fonksiyonu
CREATE OR REPLACE FUNCTION check_and_remove_ads(
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  today_count INTEGER;
  has_removal BOOLEAN;
BEGIN
  -- Bugünkü interstitial reklam sayısını kontrol et
  SELECT COALESCE(interstitial_count, 0) INTO today_count
  FROM user_daily_ad_count
  WHERE user_id = p_user_id AND count_date = CURRENT_DATE;
  
  -- Bugün için reklam kaldırma kaydı var mı kontrol et
  SELECT EXISTS(
    SELECT 1 FROM user_ad_removals 
    WHERE user_id = p_user_id 
    AND removal_date = CURRENT_DATE 
    AND is_active = true
  ) INTO has_removal;
  
  -- 5 reklam izlenmişse ve henüz kaldırma kaydı yoksa
  IF today_count >= 5 AND NOT has_removal THEN
    -- Reklam kaldırma kaydı ekle
    INSERT INTO user_ad_removals (user_id, removal_date)
    VALUES (p_user_id, CURRENT_DATE);
    
    RETURN true;
  END IF;
  
  RETURN has_removal;
END;
$$ LANGUAGE plpgsql;

-- Premium kullanıcı kontrolü fonksiyonu
CREATE OR REPLACE FUNCTION is_premium_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  premium_status BOOLEAN;
BEGIN
  SELECT 
    CASE 
      WHEN is_premium = true AND premium_end_date > NOW() THEN true
      ELSE false
    END
  INTO premium_status
  FROM user_premium
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(premium_status, false);
END;
$$ LANGUAGE plpgsql;

-- Kurum premium durumu ayarla
CREATE OR REPLACE FUNCTION set_institution_premium_status(p_institution_id UUID, p_is_premium BOOLEAN, p_start_date TIMESTAMP DEFAULT NULL, p_end_date TIMESTAMP DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  UPDATE public.institutions 
  SET
    is_premium = p_is_premium,
    premium_start_date = COALESCE(p_start_date, institutions.premium_start_date),
    premium_end_date = COALESCE(p_end_date, institutions.premium_end_date),
    updated_at = NOW()
  WHERE id = p_institution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kullanıcının kurum premium durumunu kontrol et
CREATE OR REPLACE FUNCTION check_institution_premium(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  institution_premium BOOLEAN := false;
  institution_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Kullanıcının kurumunu bul
  SELECT i.is_premium, i.premium_end_date
  INTO institution_premium, institution_end_date
  FROM public.institutions i
  JOIN public.institution_memberships im ON i.id = im.institution_id
  WHERE im.user_id = p_user_id AND im.is_active = true
  LIMIT 1;

  -- Kurum premium değilse false döndür
  IF NOT institution_premium THEN
    RETURN false;
  END IF;

  -- Premium süresi kontrolü
  IF institution_end_date IS NOT NULL AND NOW() > institution_end_date THEN
    -- Süre dolmuşsa kurum premium'unu sonlandır
    UPDATE public.institutions 
    SET is_premium = false, updated_at = NOW()
    WHERE id = (SELECT i.id FROM public.institutions i
                JOIN public.institution_memberships im ON i.id = im.institution_id
                WHERE im.user_id = p_user_id AND im.is_active = true
                LIMIT 1);
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Yıllık yenileme tarihini hesapla (1 Temmuz)
CREATE OR REPLACE FUNCTION calculate_yearly_renewal_date()
RETURNS DATE AS $$
DECLARE
  current_year INTEGER;
  renewal_date DATE;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());
  
  -- Bu yılın 1 Temmuz'u
  renewal_date := DATE(current_year || '-07-01');
  
  -- Eğer bugün 1 Temmuz'u geçtiyse, gelecek yılın 1 Temmuz'unu döndür
  IF NOW() > renewal_date THEN
    renewal_date := DATE((current_year + 1) || '-07-01');
  END IF;
  
  RETURN renewal_date;
END;
$$ LANGUAGE plpgsql;

-- Kurum premium aktif etme (manuel)
CREATE OR REPLACE FUNCTION activate_institution_premium(p_institution_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  start_date TIMESTAMP WITH TIME ZONE;
  end_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Premium başlangıç ve bitiş tarihlerini hesapla
  start_date := NOW();
  end_date := start_date + INTERVAL '1 year';
  
  -- Kurum premium durumunu güncelle
  UPDATE public.institutions 
  SET
    is_active = true,
    is_premium = true,
    premium_start_date = start_date,
    premium_end_date = end_date,
    auto_renewal = false,
    renewal_type = 'manual',
    updated_at = NOW()
  WHERE id = p_institution_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Yıllık yenileme kontrolü ve otomatik yenileme
CREATE OR REPLACE FUNCTION check_and_renew_yearly_premiums()
RETURNS INTEGER AS $$
DECLARE
  institution_record RECORD;
  renewed_count INTEGER := 0;
  renewal_date DATE;
BEGIN
  -- Bugünün tarihi
  renewal_date := CURRENT_DATE;
  
  -- Yenileme tarihi gelen kurumları bul
  FOR institution_record IN 
    SELECT id, name, yearly_price, admin_user_id
    FROM public.institutions 
    WHERE is_premium = true 
    AND renewal_date = renewal_date
    AND auto_renewal = true
  LOOP
    -- Yıllık premium yenile
    PERFORM purchase_yearly_institution_premium(
      institution_record.id, 
      institution_record.yearly_price
    );
    
    renewed_count := renewed_count + 1;
    
    -- Log için (gerçek uygulamada ayrı bir log tablosu olabilir)
    RAISE NOTICE 'Kurum yenilendi: % (ID: %)', institution_record.name, institution_record.id;
  END LOOP;
  
  RETURN renewed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Manuel kurum aktif/pasif etme
CREATE OR REPLACE FUNCTION set_institution_status(p_institution_id UUID, p_is_active BOOLEAN, p_notes TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.institutions 
  SET
    is_active = p_is_active,
    is_premium = p_is_active, -- Aktif ise premium da aktif
    notes = COALESCE(p_notes, notes),
    updated_at = NOW()
  WHERE id = p_institution_id;
  
  -- Eğer kurum pasif ediliyorsa, tüm üyelerin erişimini de kısıtla
  IF NOT p_is_active THEN
    UPDATE public.institution_memberships 
    SET is_active = false
    WHERE institution_id = p_institution_id;
  ELSE
    -- Kurum aktif ediliyorsa, üyelerin erişimini geri aç
    UPDATE public.institution_memberships 
    SET is_active = true
    WHERE institution_id = p_institution_id;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kurum sözleşme bilgilerini güncelle
CREATE OR REPLACE FUNCTION update_institution_contract(
  p_institution_id UUID, 
  p_contract_start_date DATE, 
  p_contract_end_date DATE,
  p_payment_status VARCHAR DEFAULT 'pending'
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.institutions 
  SET
    contract_start_date = p_contract_start_date,
    contract_end_date = p_contract_end_date,
    payment_status = p_payment_status,
    updated_at = NOW()
  WHERE id = p_institution_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kurum durumunu kontrol et (aktif ve premium)
CREATE OR REPLACE FUNCTION check_institution_access(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  institution_active BOOLEAN := false;
  institution_premium BOOLEAN := false;
  contract_end_date DATE;
BEGIN
  -- Kullanıcının kurumunu ve durumunu kontrol et
  SELECT i.is_active, i.is_premium, i.contract_end_date
  INTO institution_active, institution_premium, contract_end_date
  FROM public.institutions i
  JOIN public.institution_memberships im ON i.id = im.institution_id
  WHERE im.user_id = p_user_id AND im.is_active = true
  LIMIT 1;

  -- Kurum aktif değilse false döndür
  IF NOT institution_active THEN
    RETURN false;
  END IF;

  -- Sözleşme süresi kontrolü
  IF contract_end_date IS NOT NULL AND CURRENT_DATE > contract_end_date THEN
    -- Sözleşme süresi dolmuşsa kurumu pasif et
    UPDATE public.institutions 
    SET is_active = false, is_premium = false, updated_at = NOW()
    WHERE id = (SELECT i.id FROM public.institutions i
                JOIN public.institution_memberships im ON i.id = im.institution_id
                WHERE im.user_id = p_user_id AND im.is_active = true
                LIMIT 1);
    RETURN false;
  END IF;

  RETURN institution_premium;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kurum admin giriş bilgilerini oluştur
CREATE OR REPLACE FUNCTION create_institution_admin_credentials(
  p_institution_id UUID,
  p_admin_username VARCHAR(50),
  p_admin_password VARCHAR(255)
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO public.institution_admin_credentials (
    institution_id,
    admin_username,
    admin_password,
    is_active
  ) VALUES (
    p_institution_id,
    p_admin_username,
    p_admin_password,
    true
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kurum admin giriş doğrulama
CREATE OR REPLACE FUNCTION verify_institution_admin_login(
  p_admin_username VARCHAR(50),
  p_admin_password VARCHAR(255)
)
RETURNS TABLE(
  institution_id UUID,
  institution_name VARCHAR(255),
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    iac.institution_id,
    i.name,
    i.is_active
  FROM public.institution_admin_credentials iac
  JOIN public.institutions i ON iac.institution_id = i.id
  WHERE iac.admin_username = p_admin_username
    AND iac.admin_password = p_admin_password
    AND iac.is_active = true
    AND i.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kurum admin şifre güncelleme
CREATE OR REPLACE FUNCTION update_institution_admin_password(
  p_institution_id UUID,
  p_new_password VARCHAR(255)
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.institution_admin_credentials 
  SET 
    admin_password = p_new_password,
    updated_at = NOW()
  WHERE institution_id = p_institution_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'lar
-- institution_memberships tablosu için updated_at trigger'ı
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_institution_memberships_updated_at') THEN
        CREATE TRIGGER update_institution_memberships_updated_at
        BEFORE UPDATE ON institution_memberships
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
