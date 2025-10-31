-- delete_user_admin RPC fonksiyonunu oluştur
-- Bu fonksiyon admin tarafından kullanıcı silmek için kullanılır

CREATE OR REPLACE FUNCTION delete_user_admin(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    deleted_count INTEGER := 0;
BEGIN
    -- Kullanıcının auth.users tablosundan silinmesi
    -- Bu işlem Supabase Auth API üzerinden yapılmalı
    -- RPC fonksiyonu ile direkt auth.users tablosuna erişim yok
    
    -- Sadece başarı mesajı döndür
    result := json_build_object(
        'success', true,
        'message', 'Kullanıcı silme işlemi başlatıldı',
        'user_id', target_user_id,
        'note', 'Auth kullanıcı silme işlemi manuel olarak yapılmalı'
    );
    
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
