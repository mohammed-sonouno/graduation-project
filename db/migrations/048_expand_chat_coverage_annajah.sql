-- 048: Expand baseline chat coverage for all imported An-Najah faculties and majors.
-- Safe and additive only: inserts missing faculty chat knowledge and missing major chat context.

BEGIN;

INSERT INTO faculty_sources (source_name, source_url, confidence, notes)
VALUES
  (
    'An-Najah official faculties page',
    'https://www.najah.edu/en/academic/faculties/',
    0.95,
    'Baseline faculty list used for faculty chat coverage.'
  ),
  (
    'An-Najah official undergraduate programs by faculty',
    'https://www.najah.edu/en/academic/undergraduate-programs/by-faculty/',
    0.95,
    'Baseline faculty-program mapping used for faculty and major chat coverage.'
  )
ON CONFLICT (source_url) DO NOTHING;

WITH desired_faculties AS (
  SELECT *
  FROM (
    VALUES
      (
        'an-najah-faculty-medicine-allied',
        'Faculty of Medicine and Allied medical Sciences',
        ARRAY['medicine','medical','allied','health','faculty','college','كلية','طب','صحة','طبية']::text[]
      ),
      (
        'an-najah-faculty-engineering',
        'Faculty of Engineering',
        ARRAY['engineering','engineer','faculty','college','كلية','هندسة']::text[]
      ),
      (
        'an-najah-faculty-dentistry',
        'Faculty of Dentistry & Dental Surgery',
        ARRAY['dentistry','dental','faculty','college','كلية','اسنان','طب اسنان']::text[]
      ),
      (
        'an-najah-faculty-nursing',
        'Faculty of Nursing',
        ARRAY['nursing','nurse','faculty','college','كلية','تمريض']::text[]
      ),
      (
        'an-najah-faculty-pharmacy',
        'Faculty of Pharmacy',
        ARRAY['pharmacy','pharmacist','faculty','college','كلية','صيدلة']::text[]
      ),
      (
        'an-najah-faculty-it-ai',
        'Faculty of Information Technology & Artificial Intelligence',
        ARRAY['information','technology','artificial','intelligence','it','ai','faculty','college','كلية','تكنولوجيا','معلومات','ذكاء']::text[]
      ),
      (
        'an-najah-faculty-science',
        'Faculty of Science',
        ARRAY['science','scientific','faculty','college','كلية','علوم']::text[]
      ),
      (
        'an-najah-faculty-shariah',
        'Faculty of Shari''ah',
        ARRAY['sharia','shari''ah','islamic','faculty','college','كلية','شريعة','اسلامية']::text[]
      ),
      (
        'an-najah-faculty-humanities-education',
        'Faculty of Humanities and Educational Sciences',
        ARRAY['humanities','educational','education','faculty','college','كلية','علوم انسانية','تربوية','تعليم']::text[]
      ),
      (
        'an-najah-faculty-business-communication',
        'Faculty of Business and Communication',
        ARRAY['business','communication','commerce','faculty','college','كلية','اعمال','اتصال','تواصل']::text[]
      ),
      (
        'an-najah-faculty-veterinary-agricultural',
        'Faculty of Veterinary Medicine and Agricultural Engineering',
        ARRAY['veterinary','agricultural','agriculture','faculty','college','كلية','بيطري','زراعية','زراعة']::text[]
      ),
      (
        'an-najah-faculty-law-political',
        'Faculty of Law and Political Sciences',
        ARRAY['law','legal','political','politics','faculty','college','كلية','قانون','سياسية']::text[]
      ),
      (
        'an-najah-faculty-fine-arts',
        'Faculty of Fine Arts',
        ARRAY['fine','arts','art','faculty','college','كلية','فنون']::text[]
      )
  ) AS t(slug, college_name, keywords)
),
missing_profiles AS (
  SELECT
    df.slug,
    df.college_name,
    df.keywords,
    c.id AS college_id,
    COUNT(m.id)::int AS majors_count
  FROM desired_faculties df
  JOIN colleges c ON c.name = df.college_name
  LEFT JOIN majors m ON m.college_id = c.id
  LEFT JOIN faculty_profiles fp ON fp.slug = df.slug
  WHERE fp.id IS NULL
  GROUP BY df.slug, df.college_name, df.keywords, c.id
)
INSERT INTO faculty_profiles (
  university_slug,
  slug,
  official_name_en,
  aliases,
  overview_en,
  overview_ar
)
SELECT
  'an-najah',
  mp.slug,
  mp.college_name,
  ARRAY[mp.college_name],
  mp.college_name || ' is listed by An-Najah National University among its academic faculties, and it is linked in this system to ' || mp.majors_count || ' undergraduate programs imported from the official undergraduate programs directory.',
  mp.college_name || ' مدرجة ضمن كليات جامعة النجاح الوطنية، وهي مرتبطة في هذا النظام بعدد ' || mp.majors_count || ' من برامج البكالوريوس المستوردة من الدليل الرسمي للبرامج.'
FROM missing_profiles mp;

WITH desired_faculties AS (
  SELECT *
  FROM (
    VALUES
      (
        'an-najah-faculty-medicine-allied',
        'Faculty of Medicine and Allied medical Sciences',
        ARRAY['medicine','medical','allied','health','faculty','college','كلية','طب','صحة','طبية']::text[]
      ),
      (
        'an-najah-faculty-engineering',
        'Faculty of Engineering',
        ARRAY['engineering','engineer','faculty','college','كلية','هندسة']::text[]
      ),
      (
        'an-najah-faculty-dentistry',
        'Faculty of Dentistry & Dental Surgery',
        ARRAY['dentistry','dental','faculty','college','كلية','اسنان','طب اسنان']::text[]
      ),
      (
        'an-najah-faculty-nursing',
        'Faculty of Nursing',
        ARRAY['nursing','nurse','faculty','college','كلية','تمريض']::text[]
      ),
      (
        'an-najah-faculty-pharmacy',
        'Faculty of Pharmacy',
        ARRAY['pharmacy','pharmacist','faculty','college','كلية','صيدلة']::text[]
      ),
      (
        'an-najah-faculty-it-ai',
        'Faculty of Information Technology & Artificial Intelligence',
        ARRAY['information','technology','artificial','intelligence','it','ai','faculty','college','كلية','تكنولوجيا','معلومات','ذكاء']::text[]
      ),
      (
        'an-najah-faculty-science',
        'Faculty of Science',
        ARRAY['science','scientific','faculty','college','كلية','علوم']::text[]
      ),
      (
        'an-najah-faculty-shariah',
        'Faculty of Shari''ah',
        ARRAY['sharia','shari''ah','islamic','faculty','college','كلية','شريعة','اسلامية']::text[]
      ),
      (
        'an-najah-faculty-humanities-education',
        'Faculty of Humanities and Educational Sciences',
        ARRAY['humanities','educational','education','faculty','college','كلية','علوم انسانية','تربوية','تعليم']::text[]
      ),
      (
        'an-najah-faculty-business-communication',
        'Faculty of Business and Communication',
        ARRAY['business','communication','commerce','faculty','college','كلية','اعمال','اتصال','تواصل']::text[]
      ),
      (
        'an-najah-faculty-veterinary-agricultural',
        'Faculty of Veterinary Medicine and Agricultural Engineering',
        ARRAY['veterinary','agricultural','agriculture','faculty','college','كلية','بيطري','زراعية','زراعة']::text[]
      ),
      (
        'an-najah-faculty-law-political',
        'Faculty of Law and Political Sciences',
        ARRAY['law','legal','political','politics','faculty','college','كلية','قانون','سياسية']::text[]
      ),
      (
        'an-najah-faculty-fine-arts',
        'Faculty of Fine Arts',
        ARRAY['fine','arts','art','faculty','college','كلية','فنون']::text[]
      )
  ) AS t(slug, college_name, keywords)
),
faculty_base AS (
  SELECT
    fp.id AS faculty_id,
    fp.slug,
    fp.official_name_en,
    df.keywords,
    c.id AS college_id,
    COUNT(m.id)::int AS majors_count,
    COALESCE(STRING_AGG(m.name, ', ' ORDER BY m.name), '') AS majors_list
  FROM desired_faculties df
  JOIN faculty_profiles fp ON fp.slug = df.slug
  JOIN colleges c ON c.name = df.college_name
  LEFT JOIN majors m ON m.college_id = c.id
  GROUP BY fp.id, fp.slug, fp.official_name_en, df.keywords, c.id
)
INSERT INTO faculty_qa (
  faculty_id,
  question_en,
  question_ar,
  answer_en,
  answer_ar,
  normalized_intent,
  keywords
)
SELECT
  fb.faculty_id,
  'Tell me about ' || fb.official_name_en,
  'احكيلي عن ' || fb.official_name_en,
  fb.official_name_en || ' is listed by An-Najah National University among its academic faculties. In this system it is linked to ' || fb.majors_count || ' undergraduate programs imported from the official programs directory.',
  fb.official_name_en || ' مدرجة ضمن كليات جامعة النجاح الوطنية، وهي مرتبطة في هذا النظام بعدد ' || fb.majors_count || ' من برامج البكالوريوس المستوردة من الدليل الرسمي للبرامج.',
  'FACULTY_OVERVIEW_BASELINE',
  fb.keywords || ARRAY['overview','about','information','معلومات','نبذة']
FROM faculty_base fb
WHERE NOT EXISTS (
  SELECT 1
  FROM faculty_qa fq
  WHERE fq.faculty_id = fb.faculty_id
    AND fq.normalized_intent = 'FACULTY_OVERVIEW_BASELINE'
)
UNION ALL
SELECT
  fb.faculty_id,
  'What programs are in ' || fb.official_name_en || '?',
  'ما التخصصات الموجودة في ' || fb.official_name_en || '؟',
  'The undergraduate programs currently linked to ' || fb.official_name_en || ' in this system are: ' || fb.majors_list || '.',
  'التخصصات المرتبطة حاليًا بـ ' || fb.official_name_en || ' في هذا النظام هي: ' || fb.majors_list || '.',
  'FACULTY_PROGRAMS_BASELINE',
  fb.keywords || ARRAY['program','programs','programme','programmes','major','majors','تخصص','تخصصات','برنامج','برامج']
FROM faculty_base fb
WHERE NOT EXISTS (
  SELECT 1
  FROM faculty_qa fq
  WHERE fq.faculty_id = fb.faculty_id
    AND fq.normalized_intent = 'FACULTY_PROGRAMS_BASELINE'
);

INSERT INTO major_chat_context (
  major_id,
  category,
  greeting_en,
  greeting_ar,
  suggested_questions_en,
  suggested_questions_ar,
  facts_en,
  facts_ar,
  engineering_program_key
)
SELECT
  m.id,
  CASE
    WHEN c.name = 'Faculty of Engineering' THEN 'engineering'
    WHEN c.name = 'Faculty of Information Technology & Artificial Intelligence' THEN 'technology'
    WHEN c.name IN (
      'Faculty of Medicine and Allied medical Sciences',
      'Faculty of Dentistry & Dental Surgery',
      'Faculty of Nursing',
      'Faculty of Pharmacy',
      'Faculty of Veterinary Medicine and Agricultural Engineering'
    ) THEN 'health'
    WHEN c.name = 'Faculty of Business and Communication' THEN 'business'
    WHEN c.name IN ('Faculty of Law and Political Sciences', 'Faculty of Shari''ah') THEN 'law'
    WHEN c.name = 'Faculty of Science' THEN 'science'
    ELSE 'arts'
  END,
  'Hello, I am your advisor for ' || m.name || '. I can answer from the university database about how this programme is linked inside An-Najah''s academic catalogue.',
  'أهلاً، أنا مساعدك لتخصص ' || m.name || '. بقدر أجاوبك من قاعدة بيانات الجامعة عن ارتباط هذا البرنامج داخل دليل جامعة النجاح الأكاديمي.',
  '["What is this major about?","Which faculty is this major under?","What careers can this major lead to?","What should I know before choosing it?"]'::jsonb,
  '["احكيلي عن هذا التخصص","تحت أي كلية يندرج هذا التخصص؟","ما مجالات العمل لهذا التخصص؟","ما الذي يجب أن أعرفه قبل اختياره؟"]'::jsonb,
  'An-Najah National University lists ' || m.name || ' as an undergraduate programme under ' || c.name || '.',
  'تدرج جامعة النجاح الوطنية تخصص ' || m.name || ' ضمن ' || c.name || ' في قائمة برامج البكالوريوس الرسمية.',
  NULL
FROM majors m
JOIN colleges c ON c.id = m.college_id
LEFT JOIN major_chat_context mc ON mc.major_id = m.id
WHERE mc.major_id IS NULL;

COMMIT;
