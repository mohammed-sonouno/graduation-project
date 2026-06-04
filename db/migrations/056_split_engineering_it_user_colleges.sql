-- Split legacy "Engineering & IT" users into Faculty of Engineering vs IT & AI by major.
-- Idempotent; run after 048_split_engineering_and_it_faculties.sql.

BEGIN;

DO $$
DECLARE
  eng_name TEXT := 'Faculty of Engineering';
  it_name TEXT := 'Faculty of Information Technology & Artificial Intelligence';
  eng_id INTEGER;
  it_id INTEGER;
BEGIN
  SELECT id INTO eng_id FROM colleges
  WHERE lower(trim(name)) = lower(trim(eng_name))
  ORDER BY id LIMIT 1;

  SELECT id INTO it_id FROM colleges
  WHERE lower(trim(name)) = lower(trim(it_name))
  ORDER BY id LIMIT 1;

  IF eng_id IS NULL OR it_id IS NULL THEN
    RAISE NOTICE '056: missing engineering or IT college row';
    RETURN;
  END IF;

  -- IT majors → IT faculty college_id
  UPDATE majors
  SET college_id = it_id
  WHERE lower(trim(name)) IN (
    'computer science',
    'management information systems',
    'information technology',
    'software engineering',
    'cybersecurity',
    'cyber security',
    'ai and data science',
    'artificial intelligence and data science',
    'computer information systems',
    'computer science apprenticeship program'
  )
  AND college_id IS DISTINCT FROM it_id;

  -- IT majors → IT faculty on user profiles
  UPDATE app_users
  SET college = it_name
  WHERE major IS NOT NULL AND trim(major) <> ''
    AND lower(trim(major)) IN (
      'computer science',
      'management information systems',
      'information technology',
      'software engineering',
      'cybersecurity',
      'cyber security',
      'ai and data science',
      'artificial intelligence and data science',
      'computer information systems',
      'computer science apprenticeship program'
    )
    AND (
      college IS NULL OR trim(college) = ''
      OR lower(trim(college)) IN (
        'engineering & it',
        'engineering and it',
        'faculty of engineering and information technology',
        lower(trim(eng_name))
      )
    );

  -- Everyone else on legacy combined label → Engineering
  UPDATE app_users
  SET college = eng_name
  WHERE college IS NOT NULL AND trim(college) <> ''
    AND lower(trim(college)) IN (
      'engineering & it',
      'engineering and it',
      'faculty of engineering and information technology'
    );

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_profiles'
  ) THEN
    UPDATE student_profiles sp
    SET college = it_name
    FROM app_users u
    WHERE u.id = sp.user_id
      AND u.major IS NOT NULL AND trim(u.major) <> ''
      AND lower(trim(u.major)) IN (
        'computer science',
        'management information systems',
        'information technology',
        'software engineering',
        'cybersecurity',
        'cyber security',
        'ai and data science',
        'artificial intelligence and data science',
        'computer information systems',
        'computer science apprenticeship program'
      );

    UPDATE student_profiles
    SET college = eng_name
    WHERE college IS NOT NULL AND trim(college) <> ''
      AND lower(trim(college)) IN (
        'engineering & it',
        'engineering and it',
        'faculty of engineering and information technology'
      );
  END IF;
END $$;

COMMIT;
