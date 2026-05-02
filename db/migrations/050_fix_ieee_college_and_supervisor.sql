-- 050_fix_ieee_college_and_supervisor.sql
-- 1. Ensure "Faculty of Engineering" exists as a separate canonical college row.
-- 2. Re-point the IEEE community to that college (fixes wrong/legacy college link).
-- 3. Assign ieee.sup@najah.edu to the IEEE community (community_id was NULL).

DO $$
DECLARE
  eng_id   INT;
  ieee_id  INT;
  sup_id   INT;
BEGIN
  -- 1. Insert canonical college if missing
  INSERT INTO colleges (name)
  SELECT 'Faculty of Engineering'
  WHERE NOT EXISTS (
    SELECT 1 FROM colleges
    WHERE lower(trim(name)) = 'faculty of engineering'
  );

  SELECT id INTO eng_id
  FROM colleges
  WHERE lower(trim(name)) = 'faculty of engineering'
  ORDER BY id
  LIMIT 1;

  IF eng_id IS NULL THEN
    RAISE EXCEPTION 'Faculty of Engineering college row not found after insert.';
  END IF;

  -- 2. Fix IEEE community college link (college_id column path)
  UPDATE communities
  SET college_id = eng_id
  WHERE lower(trim(name)) = 'ieee'
    AND (college_id IS DISTINCT FROM eng_id);

  -- 2b. Fix IEEE community colleges[] array path (text[] column)
  UPDATE communities
  SET colleges = ARRAY['Faculty of Engineering']::text[]
  WHERE lower(trim(name)) = 'ieee'
    AND colleges IS DISTINCT FROM ARRAY['Faculty of Engineering']::text[];

  -- 3. Fix ieee.sup@najah.edu community_id
  SELECT id INTO ieee_id
  FROM communities
  WHERE lower(trim(name)) = 'ieee'
  LIMIT 1;

  IF ieee_id IS NOT NULL THEN
    SELECT id INTO sup_id
    FROM app_users
    WHERE lower(email) = 'ieee.sup@najah.edu'
    LIMIT 1;

    IF sup_id IS NOT NULL THEN
      UPDATE app_users
      SET community_id = ieee_id
      WHERE id = sup_id
        AND (community_id IS DISTINCT FROM ieee_id);
    END IF;
  END IF;

END $$;
