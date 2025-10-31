-- delete_user_admin fonksiyonunu düzelt
-- Bu fonksiyon gerçekten kullanıcı siler

DROP FUNCTION IF EXISTS delete_user_admin(UUID);

CREATE OR REPLACE FUNCTION delete_user_admin(
  target_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER;
  result JSON;
BEGIN
  -- Kullanıcının var olup olmadığını kontrol et
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Auth kullanıcısını sil ve etkilenen satır sayısını al
  DELETE FROM auth.users WHERE id = target_user_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Başarılı sonuç döndür
  IF deleted_count > 0 THEN
    result := json_build_object(
      'success', true, 
      'message', 'User deleted successfully',
      'user_id', target_user_id,
      'deleted_count', deleted_count
    );
  ELSE
    result := json_build_object('success', false, 'error', 'User could not be deleted');
  END IF;
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'user_id', target_user_id
    );
    RETURN result;
END;
$$;

-- Fonksiyon için gerekli izinleri ver
GRANT EXECUTE ON FUNCTION delete_user_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_admin(UUID) TO service_role;
