-- Admin Aktivite Logları Tablosunu ve İlgili Nesneleri Kaldır
-- NOT: Bu script sadece temizlik için. Kullanılmıyorsa silinebilir.

-- Önce RLS politikalarını kaldır
DROP POLICY IF EXISTS "Admins can view all activity logs" ON admin_activity_logs;
DROP POLICY IF EXISTS "Admins can insert activity logs" ON admin_activity_logs;

-- Fonksiyonu kaldır
DROP FUNCTION IF EXISTS log_admin_activity(VARCHAR, VARCHAR, UUID, TEXT, JSONB);

-- Index'leri kaldır (tablo silinince otomatik silinir ama manuel de silinebilir)
DROP INDEX IF EXISTS idx_admin_activity_logs_admin_user_id;
DROP INDEX IF EXISTS idx_admin_activity_logs_action_type;
DROP INDEX IF EXISTS idx_admin_activity_logs_target_type;
DROP INDEX IF EXISTS idx_admin_activity_logs_created_at;
DROP INDEX IF EXISTS idx_admin_activity_logs_target_id;

-- Tabloyu kaldır (içindeki tüm veriler de silinir!)
DROP TABLE IF EXISTS admin_activity_logs CASCADE;


