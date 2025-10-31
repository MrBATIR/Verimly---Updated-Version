-- Şifre sıfırlama RPC fonksiyonu oluştur
CREATE OR REPLACE FUNCTION reset_user_password_admin(
  target_user_id UUID,
  new_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result JSON;
  _user_id uuid;
  _email text;
  _hashed_password text;
  _salt text;
  _password_hash_alg text;
  _password_hash_key_len int;
  _password_hash_iterations int;
  _password_hash_salt_bytes int;
  _password_hash_variant text;
  _password_hash_memory int;
BEGIN
  -- Kullanıcının var olup olmadığını kontrol et
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Kullanıcının email'ini al
  SELECT email INTO _email FROM auth.users WHERE id = target_user_id;

  IF _email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User email not found');
  END IF;

  -- Şifre hash algoritması ayarlarını al
  SELECT
    s.value->>'password_hash_alg',
    (s.value->>'password_hash_key_len')::int,
    (s.value->>'password_hash_iterations')::int,
    (s.value->>'password_hash_salt_bytes')::int,
    s.value->>'password_hash_variant',
    (s.value->>'password_hash_memory')::int
  INTO
    _password_hash_alg,
    _password_hash_key_len,
    _password_hash_iterations,
    _password_hash_salt_bytes,
    _password_hash_variant,
    _password_hash_memory
  FROM auth.settings s
  WHERE s.key = 'security';

  -- Yeni salt oluştur
  _salt := extensions.gen_salt('bf');

  -- Şifreyi hash'le
  _hashed_password := extensions.crypt(new_password, _salt);

  -- Auth kullanıcısını güncelle
  UPDATE auth.users
  SET
    encrypted_password = _hashed_password,
    email_confirmed_at = NOW(),
    last_sign_in_at = NOW(),
    updated_at = NOW()
  WHERE id = target_user_id
  RETURNING id INTO _user_id;

  IF _user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Failed to update password');
  END IF;

  -- Başarılı sonuç döndür
  RETURN json_build_object(
    'success', true, 
    'message', 'Password reset successfully',
    'user_id', _user_id
  );
END;
$$;

-- RLS politikası ekle (sadece kurum adminleri kullanabilsin)
-- Önce mevcut policy'yi sil, sonra yeniden oluştur
DROP POLICY IF EXISTS "Institution admins can reset passwords" ON auth.users;

CREATE POLICY "Institution admins can reset passwords" ON auth.users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM institutions i
    JOIN institution_memberships im ON i.id = im.institution_id
    WHERE im.user_id = auth.uid()
    AND im.role = 'admin'
  )
);

-- Kullanıcı silme RPC fonksiyonu oluştur
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
    RETURN json_build_object(
      'success', true, 
      'message', 'User deleted successfully',
      'user_id', target_user_id,
      'deleted_count', deleted_count
    );
  ELSE
    RETURN json_build_object('success', false, 'error', 'User could not be deleted');
  END IF;
END;
$$;

-- Fonksiyonları public schema'ya taşı
GRANT EXECUTE ON FUNCTION reset_user_password_admin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_admin(UUID) TO authenticated;
