-- Split canonical engineering bucket into two faculties (matches majors catalogue / UI).
-- Idempotent; safe with npm run migrate after 042_faculties_normalize_final.sql.

BEGIN;

INSERT INTO colleges (name)
SELECT 'Faculty of Information Technology & Artificial Intelligence'
WHERE NOT EXISTS (
  SELECT 1 FROM colleges
  WHERE lower(trim(name)) = lower(trim('Faculty of Information Technology & Artificial Intelligence'))
);

UPDATE colleges
SET name = 'Faculty of Engineering'
WHERE lower(trim(name)) IN (
  'engineering & it',
  'engineering and it',
  'faculty of engineering and information technology'
);

DO $$
DECLARE
  eng_id INTEGER;
  it_id INTEGER;
BEGIN
  SELECT id INTO eng_id FROM colleges
  WHERE lower(trim(name)) = 'faculty of engineering'
  ORDER BY id LIMIT 1;

  SELECT id INTO it_id FROM colleges
  WHERE lower(trim(name)) = 'faculty of information technology & artificial intelligence'
  ORDER BY id LIMIT 1;

  IF eng_id IS NULL OR it_id IS NULL THEN
    RAISE NOTICE '048_split_engineering_and_it_faculties: missing eng or it college row (eng %, it %)', eng_id, it_id;
    RETURN;
  END IF;

  UPDATE majors
  SET college_id = it_id
  WHERE college_id = eng_id
    AND name IN (
      'Computer Science',
      'Management Information Systems',
      'Information Technology',
      'Software Engineering',
      'Cybersecurity',
      'AI and Data Science'
    );

  -- IEEE is governed under Faculty of Engineering (business rule; dean approval routing).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'college_id'
  ) THEN
    UPDATE communities c
    SET college_id = eng_id
    WHERE lower(trim(c.name)) = 'ieee';
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

UPDATE app_users
SET college = 'Faculty of Engineering'
WHERE college IS NOT NULL AND trim(college) <> ''
  AND lower(trim(college)) IN ('engineering & it', 'engineering and it');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_profiles'
  ) THEN
    UPDATE student_profiles sp
    SET college = 'Faculty of Engineering'
    WHERE sp.college IS NOT NULL AND trim(sp.college) <> ''
      AND lower(trim(sp.college)) IN ('engineering & it', 'engineering and it');
  END IF;
END $$;

COMMIT;
