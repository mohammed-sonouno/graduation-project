-- 049_normalize_user_college_fields.sql
-- Normalize legacy faculty/college name strings stored in app_users.college
-- and student_profiles.college to their canonical equivalents.
-- Canonical names are defined in config/rules.js and src/canonicalCollege.js.

DO $$
DECLARE
  legacy_map TEXT[][] := ARRAY[
    -- Engineering
    ARRAY['engineering & it',                                           'Faculty of Engineering'],
    ARRAY['engineering and it',                                         'Faculty of Engineering'],
    ARRAY['faculty of engineering and information technology',          'Faculty of Engineering'],
    -- IT & AI
    ARRAY['it',                                                         'Faculty of Information Technology & Artificial Intelligence'],
    ARRAY['information technology',                                     'Faculty of Information Technology & Artificial Intelligence'],
    ARRAY['faculty of information technology & artificial intelligence','Faculty of Information Technology & Artificial Intelligence'],
    ARRAY['cs',                                                         'Faculty of Information Technology & Artificial Intelligence'],
    ARRAY['computer science',                                           'Faculty of Information Technology & Artificial Intelligence'],
    ARRAY['cybersecurity',                                              'Faculty of Information Technology & Artificial Intelligence'],
    ARRAY['mis',                                                        'Faculty of Information Technology & Artificial Intelligence'],
    ARRAY['management information systems',                             'Faculty of Information Technology & Artificial Intelligence'],
    ARRAY['software engineering',                                       'Faculty of Information Technology & Artificial Intelligence'],
    ARRAY['ai and data science',                                        'Faculty of Information Technology & Artificial Intelligence'],
    ARRAY['artificial intelligence',                                    'Faculty of Information Technology & Artificial Intelligence'],
    -- Medicine
    ARRAY['faculty of medicine and allied medical sciences',            'Faculty of Medicine and Health Sciences'],
    ARRAY['medicine & health',                                          'Faculty of Medicine and Health Sciences'],
    ARRAY['medicine and health',                                        'Faculty of Medicine and Health Sciences'],
    ARRAY['faculty of dentistry & dental surgery',                      'Faculty of Medicine and Health Sciences'],
    ARRAY['faculty of dentistry and dental surgery',                    'Faculty of Medicine and Health Sciences'],
    -- Science
    ARRAY['arts & sciences',                                            'Faculty of Science'],
    ARRAY['arts and sciences',                                          'Faculty of Science'],
    -- Economics / Social Sciences
    ARRAY['business school',                                            'Faculty of Economics and Social Sciences'],
    ARRAY['faculty of business and communication',                      'Faculty of Economics and Social Sciences'],
    -- Law
    ARRAY['law & policy',                                               'Faculty of Law'],
    ARRAY['law and policy',                                             'Faculty of Law'],
    ARRAY['faculty of law and political sciences',                      'Faculty of Law'],
    ARRAY['law and political sciences',                                 'Faculty of Law'],
    -- Arts / Humanities
    ARRAY['faculty of humanities and educational sciences',             'Faculty of Arts'],
    ARRAY['humanities and educational sciences',                        'Faculty of Arts'],
    -- Vet / Agriculture (generic legacy string maps to Vet; Agriculture split cannot be inferred from name alone)
    ARRAY['faculty of veterinary medicine and agricultural engineering','Faculty of Veterinary Medicine'],
    ARRAY['veterinary medicine and agricultural engineering',           'Faculty of Veterinary Medicine'],
    -- Sharia
    ARRAY['faculty of shari''ah',                                      'Faculty of Sharia Sciences'],
    ARRAY['faculty of shariah',                                        'Faculty of Sharia Sciences']
  ];
  pair TEXT[];
BEGIN
  -- app_users.college (free-text column, may not exist in all deployments)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'college'
  ) THEN
    FOREACH pair SLICE 1 IN ARRAY legacy_map LOOP
      UPDATE app_users
      SET college = pair[2]
      WHERE lower(trim(college)) = lower(pair[1])
        AND college IS DISTINCT FROM pair[2];
    END LOOP;
  END IF;

  -- student_profiles.college (free-text column, may not exist in all deployments)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_profiles' AND column_name = 'college'
  ) THEN
    FOREACH pair SLICE 1 IN ARRAY legacy_map LOOP
      UPDATE student_profiles
      SET college = pair[2]
      WHERE lower(trim(college)) = lower(pair[1])
        AND college IS DISTINCT FROM pair[2];
    END LOOP;
  END IF;
END $$;
