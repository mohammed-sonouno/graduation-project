-- ═══════════════════════════════════════════════════════════════════════════════
-- Final faculties normalization + IEEE association (single source of truth).
-- Idempotent: safe to run on every deploy with npm run migrate.
--
-- Engineering canonical display name (ONLY): 'Engineering & IT'
-- Keep alias list in sync with src/canonicalCollege.js (ENGINEERING_ALIASES comment).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Other legacy short labels → long canonical faculty names (non-engineering) ──
UPDATE colleges SET name = 'Faculty of Medicine and Health Sciences'
WHERE lower(trim(name)) IN (
  'medicine & health', 'medicine and health',
  'faculty of medicine and allied medical sciences'
);

UPDATE colleges SET name = 'Faculty of Science'
WHERE lower(trim(name)) IN ('arts & sciences', 'arts and sciences');

UPDATE colleges SET name = 'Faculty of Economics and Social Sciences'
WHERE lower(trim(name)) IN ('business school', 'faculty of business and communication');

UPDATE colleges SET name = 'Faculty of Law'
WHERE lower(trim(name)) IN ('law & policy', 'law and policy', 'faculty of law and political sciences');

-- ── Engineering & IT — ONLY canonical name for all engineering-related rows ─────
UPDATE colleges c
SET name = 'Engineering & IT'
WHERE EXISTS (
  SELECT 1
  FROM (VALUES
    ('engineering'),
    ('faculty of engineering'),
    ('it'),
    ('information technology'),
    ('engineering & it'),
    ('engineering and it'),
    ('faculty of engineering and information technology'),
    ('faculty of information technology & artificial intelligence')
  ) AS eng(alias)
  WHERE lower(trim(c.name)) = lower(trim(eng.alias))
);

-- ── Ensure full canonical faculty list exists (names match PostgreSQL truth) ────
INSERT INTO colleges (name)
SELECT v FROM (VALUES
  ('Engineering & IT'),
  ('Faculty of Medicine and Health Sciences'),
  ('Faculty of Science'),
  ('Faculty of Pharmacy'),
  ('Faculty of Nursing'),
  ('Faculty of Optometry'),
  ('Faculty of Veterinary Medicine'),
  ('Faculty of Agriculture'),
  ('Faculty of Arts'),
  ('Faculty of Educational Sciences and Teacher Training'),
  ('Faculty of Law'),
  ('Faculty of Economics and Social Sciences'),
  ('Faculty of Fine Arts'),
  ('Faculty of Physical Education and Sports Sciences'),
  ('Faculty of Sharia Sciences')
) AS t(v)
WHERE NOT EXISTS (
  SELECT 1 FROM colleges col WHERE lower(trim(col.name)) = lower(trim(t.v))
);

-- ── IEEE association: name, kind, college link, organizer label ───────────────
UPDATE communities SET name = 'IEEE'
WHERE lower(trim(name)) LIKE '%ieee%' OR lower(trim(name)) = 'ieee';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'kind'
  ) THEN
    UPDATE communities SET kind = 'association' WHERE lower(trim(name)) = 'ieee';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'college_id'
  ) THEN
    UPDATE communities c
    SET college_id = eng.id
    FROM colleges eng
    WHERE lower(trim(c.name)) = 'ieee'
      AND lower(trim(eng.name)) = 'engineering & it';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'colleges'
  ) THEN
    UPDATE communities SET colleges = ARRAY['Engineering & IT']::text[]
    WHERE lower(trim(name)) = 'ieee';
  END IF;
END $$;

UPDATE events e SET club_name = 'IEEE'
FROM communities co
WHERE e.community_id = co.id AND lower(trim(co.name)) = 'ieee';

-- ── Free-text college fields → Engineering & IT ─────────────────────────────────
UPDATE app_users u
SET college = 'Engineering & IT'
WHERE u.college IS NOT NULL AND trim(u.college) <> ''
  AND EXISTS (
    SELECT 1
    FROM (VALUES
      ('engineering'),
      ('faculty of engineering'),
      ('it'),
      ('information technology'),
      ('engineering & it'),
      ('engineering and it'),
      ('faculty of engineering and information technology'),
      ('faculty of information technology & artificial intelligence')
    ) AS eng(alias)
    WHERE lower(trim(u.college)) = lower(trim(eng.alias))
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_profiles'
  ) THEN
    UPDATE student_profiles sp
    SET college = 'Engineering & IT'
    WHERE sp.college IS NOT NULL AND trim(sp.college) <> ''
      AND EXISTS (
        SELECT 1
        FROM (VALUES
          ('engineering'),
          ('faculty of engineering'),
          ('it'),
          ('information technology'),
          ('engineering & it'),
          ('engineering and it'),
          ('faculty of engineering and information technology'),
          ('faculty of information technology & artificial intelligence')
        ) AS eng(alias)
        WHERE lower(trim(sp.college)) = lower(trim(eng.alias))
      );
  END IF;
END $$;

-- ── communities.colleges[] — swap any engineering alias element → Engineering & IT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'colleges'
  ) THEN
    UPDATE communities c
    SET colleges = ARRAY(
      SELECT DISTINCT y FROM (
        SELECT CASE
          WHEN EXISTS (
            SELECT 1
            FROM (VALUES
              ('engineering'),
              ('faculty of engineering'),
              ('it'),
              ('information technology'),
              ('engineering & it'),
              ('engineering and it'),
              ('faculty of engineering and information technology'),
              ('faculty of information technology & artificial intelligence')
            ) AS eng(alias)
            WHERE lower(trim(x)) = lower(trim(eng.alias))
          ) THEN 'Engineering & IT'
          ELSE trim(x)
        END AS y
        FROM unnest(COALESCE(c.colleges, '{}')) AS t(x)
      ) s
    )
    WHERE c.colleges IS NOT NULL
      AND cardinality(c.colleges) > 0
      AND EXISTS (
        SELECT 1 FROM unnest(c.colleges) x
        WHERE EXISTS (
          SELECT 1
          FROM (VALUES
            ('engineering'),
            ('faculty of engineering'),
            ('it'),
            ('information technology'),
            ('engineering & it'),
            ('engineering and it'),
            ('faculty of engineering and information technology'),
            ('faculty of information technology & artificial intelligence')
          ) AS eng(alias)
          WHERE lower(trim(x)) = lower(trim(eng.alias))
        )
      );
  END IF;
END $$;

COMMIT;
