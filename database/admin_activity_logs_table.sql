-- Admin Aktivite Logları Tablosu
-- Admin panelindeki tüm işlemleri loglamak için

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL, -- 'user_create', 'user_delete', 'user_move', 'user_password_reset', 'institution_create', 'institution_update', etc.
  target_type VARCHAR(50), -- 'user', 'institution', 'contract', etc.
  target_id UUID, -- İşlem yapılan kaydın ID'si
  description TEXT, -- İşlem açıklaması
  details JSONB, -- Ek detaylar (JSON formatında)
  ip_address VARCHAR(45), -- Admin'in IP adresi
  user_agent TEXT, -- Browser/device bilgisi
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_admin_user_id ON admin_activity_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_action_type ON admin_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_target_type ON admin_activity_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at ON admin_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_target_id ON admin_activity_logs(target_id);

-- RLS Politikaları (Admin'ler tüm logları görebilir)
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Admin'ler tüm logları görebilir ve ekleyebilir
CREATE POLICY "Admins can view all activity logs" ON admin_activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.user_type = 'admin'
    )
  );

CREATE POLICY "Admins can insert activity logs" ON admin_activity_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.user_type = 'admin'
    )
  );

-- Fonksiyon: Admin aktivite logu ekle (kolay kullanım için)
CREATE OR REPLACE FUNCTION log_admin_activity(
  p_action_type VARCHAR(50),
  p_target_type VARCHAR(50),
  p_target_id UUID,
  p_description TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_admin_user_id UUID;
BEGIN
  -- Mevcut admin kullanıcısını al
  SELECT auth.uid() INTO v_admin_user_id;
  
  -- Log kaydı oluştur
  INSERT INTO admin_activity_logs (
    admin_user_id,
    action_type,
    target_type,
    target_id,
    description,
    details
  ) VALUES (
    v_admin_user_id,
    p_action_type,
    p_target_type,
    p_target_id,
    p_description,
    p_details
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Yorumlar
COMMENT ON TABLE admin_activity_logs IS 'Admin panelindeki tüm işlemlerin log kayıtları';
COMMENT ON COLUMN admin_activity_logs.action_type IS 'İşlem tipi: user_create, user_delete, user_move, user_password_reset, institution_create, etc.';
COMMENT ON COLUMN admin_activity_logs.target_type IS 'İşlem yapılan kayıt tipi: user, institution, contract, etc.';
COMMENT ON COLUMN admin_activity_logs.target_id IS 'İşlem yapılan kaydın UUID ID si';
COMMENT ON COLUMN admin_activity_logs.details IS 'Ek detaylar JSON formatında (ör: eski değerler, yeni değerler, vb.)';


