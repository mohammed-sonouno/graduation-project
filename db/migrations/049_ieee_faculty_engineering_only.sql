-- Idempotent: ensure IEEE association is linked to Faculty of Engineering only (IEEE governance).
BEGIN;

DO $$
DECLARE
  eng_id INTEGER;
BEGIN
  SELECT id INTO eng_id FROM colleges
  WHERE lower(trim(name)) = 'faculty of engineering'
  ORDER BY id LIMIT 1;

  IF eng_id IS NULL THEN
    RAISE NOTICE '049_ieee_faculty_engineering_only: Faculty of Engineering row missing';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'college_id'
  ) THEN
    UPDATE communities SET college_id = eng_id WHERE lower(trim(name)) = 'ieee';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'colleges'
  ) THEN
    UPDATE communities
    SET colleges = ARRAY['Faculty of Engineering']::text[]
    WHERE lower(trim(name)) = 'ieee';
  END IF;
END $$;

COMMIT;
