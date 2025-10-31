-- institution_memberships tablosuna updated_at sütunu ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'institution_memberships' 
                   AND column_name = 'updated_at') THEN
        ALTER TABLE institution_memberships 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- updated_at trigger'ı ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_institution_memberships_updated_at') THEN
        CREATE TRIGGER update_institution_memberships_updated_at
        BEFORE UPDATE ON institution_memberships
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
