-- 043: Enrich knowledge data from official An-Najah sources.
-- Additive only. All inserts use ON CONFLICT or WHERE NOT EXISTS. No deletions.

BEGIN;

-- ===== SCHEMA ADDITIONS =====

ALTER TABLE university_statistics
  ADD COLUMN IF NOT EXISTS books_count INTEGER NULL,
  ADD COLUMN IF NOT EXISTS ebooks_count INTEGER NULL,
  ADD COLUMN IF NOT EXISTS ejournals_count INTEGER NULL;

ALTER TABLE engineering_programs
  ADD COLUMN IF NOT EXISTS is_abet_accredited BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS department_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS career_summary_en TEXT NULL,
  ADD COLUMN IF NOT EXISTS career_summary_ar TEXT NULL;

-- ===== UNIVERSITY SOURCES =====

INSERT INTO university_sources (id, source_name, source_url, fetched_at, confidence, notes) VALUES
  (4, 'An-Najah - Facts and Figures (public page)',
   'https://www.najah.edu/en/about/annu-facts/',
   NOW(), 0.95,
   'Official facts page with campus, library, and program counts.'),
  (5, 'An-Najah - Vision, Mission and Values (https)',
   'https://www.najah.edu/en/about/vision-and-mission/',
   NOW(), 0.95,
   'Official vision, mission, and values page (https variant).'),
  (6, 'An-Najah - Faculties listing',
   'https://www.najah.edu/en/academic/faculties/',
   NOW(), 0.90,
   'Official faculties list page.')
ON CONFLICT (source_url) DO NOTHING;

-- ===== UNIVERSITY PROFILE UPDATE =====

UPDATE university_profiles SET
  campuses_count = 5,
  campuses_note = 'Five campuses: New Campus, Old Campus, Hisham Hijjawi College of Technology, Khadouri Campus (Tulkarm), An-Najah National Hospital.',
  updated_at = NOW()
WHERE slug = 'an-najah';

-- ===== UNIVERSITY STATISTICS UPDATE =====

UPDATE university_statistics SET
  bachelor_programs_count = 128,
  master_programs_count = 78,
  phd_programs_count = 13,
  campuses_count = 5,
  books_count = 250071,
  ebooks_count = 308568,
  ejournals_count = 81735,
  updated_at = NOW()
WHERE university_id = 1;

-- ===== UNIVERSITY TIMELINE =====

INSERT INTO university_timeline (university_id, year, title, description, source_id, sort_order) VALUES
  (1, 1978, 'Engineering and other faculties inaugurated',
   'Faculties of Economics, Administrative Sciences, Educational Sciences and Engineering were inaugurated.',
   2, 5),
  (1, 1994, 'Faculty of Pharmacy established',
   'Faculty of Pharmacy established along with new centres including APSIM and the Water and Environmental Studies Institute.',
   2, 6),
  (1, 1995, 'Faculty of Law established',
   NULL, 2, 7),
  (1, 1999, 'Faculty of Medicine established',
   'Established in cooperation with Al-Quds and Al-Azhar Universities.',
   2, 8),
  (1, 2000, 'New Campus foundation stone laid',
   'Late Yasser Arafat laid the foundation stone for the New Campus. Faculty of Veterinary Medicine and Computer Engineering also established.',
   2, 9),
  (1, 2005, 'New Campus inaugurated by President Abbas',
   'President Mahmoud Abbas inaugurated the New Campus. Faculty of Honors and Architectural Conservation unit established.',
   2, 10),
  (1, 2008, 'Teaching hospital and sports complex',
   'Faculty of Medicine accredited independently. University hospital acquired and sports complex inaugurated.',
   2, 11),
  (1, 2012, 'EFQM Global Excellence Award',
   'University obtains the EFQM Global Excellence Award.',
   2, 12),
  (1, 2014, 'ABET accreditation for engineering',
   'Seven engineering programmes received ABET accreditation, a first in Palestine.',
   2, 13),
  (1, 2016, 'Ranked 1st in Palestine',
   'Ranked 1st Palestinian university by Webometrics and U.S. News. Two additional ABET accreditations obtained.',
   2, 14)
ON CONFLICT (university_id, year, title) DO NOTHING;

-- ===== UNIVERSITY QA (idempotent: skip if normalized_intent already exists) =====

INSERT INTO university_qa (university_id, topic_id, question_en, question_ar, answer_en, answer_ar, normalized_intent, keywords, source_id)
SELECT 1, 3,
  'How many campuses does An-Najah have?',
  E'\u0643\u0645 \u062d\u0631\u0645 \u062c\u0627\u0645\u0639\u064a \u0641\u064a \u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0646\u062c\u0627\u062d\u061f',
  'An-Najah has five campuses: the New Campus, the Old Campus, Hisham Hijjawi College of Technology, Khadouri Campus in Tulkarm, and An-Najah National Hospital.',
  E'\u0644\u062f\u0649 \u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0646\u062c\u0627\u062d \u062e\u0645\u0633\u0629 \u0623\u062d\u0631\u0645 \u062c\u0627\u0645\u0639\u064a\u0629: \u0627\u0644\u062d\u0631\u0645 \u0627\u0644\u062c\u062f\u064a\u062f\u060c \u0627\u0644\u062d\u0631\u0645 \u0627\u0644\u0642\u062f\u064a\u0645\u060c \u0643\u0644\u064a\u0629 \u0647\u0634\u0627\u0645 \u062d\u062c\u0627\u0648\u064a \u0627\u0644\u062a\u0642\u0646\u064a\u0629\u060c \u062d\u0631\u0645 \u062e\u0636\u0648\u0631\u064a \u0641\u064a \u0637\u0648\u0644\u0643\u0631\u0645\u060c \u0648\u0645\u0633\u062a\u0634\u0641\u0649 \u0627\u0644\u0646\u062c\u0627\u062d \u0627\u0644\u0648\u0637\u0646\u064a.',
  'UNIVERSITY_CAMPUSES',
  ARRAY['campuses','campus','new campus','old campus','hijjawi','khadouri','hospital'],
  4
WHERE NOT EXISTS (SELECT 1 FROM university_qa WHERE normalized_intent = 'UNIVERSITY_CAMPUSES');

INSERT INTO university_qa (university_id, topic_id, question_en, question_ar, answer_en, answer_ar, normalized_intent, keywords, source_id)
SELECT 1, 1,
  'What is the vision of An-Najah?',
  E'\u0645\u0627 \u0647\u064a \u0631\u0624\u064a\u0629 \u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0646\u062c\u0627\u062d\u061f',
  'An-Najah is dedicated to promoting understanding, providing the highest quality education, and serving as a leader in scientific research. It acts as a base for sustainable development by encouraging leadership and community service.',
  E'\u062a\u0644\u062a\u0632\u0645 \u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0646\u062c\u0627\u062d \u0628\u062a\u0639\u0632\u064a\u0632 \u0627\u0644\u0641\u0647\u0645 \u0648\u062a\u0642\u062f\u064a\u0645 \u0623\u0639\u0644\u0649 \u062c\u0648\u062f\u0629 \u0641\u064a \u0627\u0644\u062a\u0639\u0644\u064a\u0645 \u0648\u0627\u0644\u0631\u064a\u0627\u062f\u0629 \u0641\u064a \u0627\u0644\u0628\u062d\u062b \u0627\u0644\u0639\u0644\u0645\u064a\u060c \u0648\u062a\u0639\u0645\u0644 \u0643\u0642\u0627\u0639\u062f\u0629 \u0644\u0644\u062a\u0646\u0645\u064a\u0629 \u0627\u0644\u0645\u0633\u062a\u062f\u0627\u0645\u0629 \u0645\u0646 \u062e\u0644\u0627\u0644 \u062a\u0634\u062c\u064a\u0639 \u0627\u0644\u0642\u064a\u0627\u062f\u0629 \u0648\u062e\u062f\u0645\u0629 \u0627\u0644\u0645\u062c\u062a\u0645\u0639.',
  'UNIVERSITY_VISION',
  ARRAY['vision'],
  5
WHERE NOT EXISTS (SELECT 1 FROM university_qa WHERE normalized_intent = 'UNIVERSITY_VISION');

INSERT INTO university_qa (university_id, topic_id, question_en, question_ar, answer_en, answer_ar, normalized_intent, keywords, source_id)
SELECT 1, 3,
  'How big is the An-Najah library?',
  E'\u0643\u0645 \u062d\u062c\u0645 \u0645\u0643\u062a\u0628\u0629 \u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0646\u062c\u0627\u062d\u061f',
  'The university libraries contain more than 250,071 books, 308,568 electronic books, and 81,735 electronic journals.',
  E'\u062a\u062d\u062a\u0648\u064a \u0645\u0643\u062a\u0628\u0627\u062a \u0627\u0644\u062c\u0627\u0645\u0639\u0629 \u0639\u0644\u0649 \u0623\u0643\u062b\u0631 \u0645\u0646 250,071 \u0643\u062a\u0627\u0628\u060c \u0648308,568 \u0643\u062a\u0627\u0628 \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u060c \u064881,735 \u0645\u062c\u0644\u0629 \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u0629.',
  'UNIVERSITY_LIBRARY',
  ARRAY['library','books','ebooks','journals'],
  4
WHERE NOT EXISTS (SELECT 1 FROM university_qa WHERE normalized_intent = 'UNIVERSITY_LIBRARY');

INSERT INTO university_qa (university_id, topic_id, question_en, question_ar, answer_en, answer_ar, normalized_intent, keywords, source_id)
SELECT 1, 3,
  'What faculties does An-Najah have?',
  E'\u0645\u0627 \u0647\u064a \u0643\u0644\u064a\u0627\u062a \u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0646\u062c\u0627\u062d\u061f',
  'An-Najah has 11 faculties including: Medicine and Allied Medical Sciences, Business and Communication, Dentistry, Fine Arts, Graduate Studies, Humanities and Educational Sciences, IT and AI, Law and Political Sciences, Veterinary Medicine and Agricultural Engineering, and Engineering and IT.',
  E'\u062a\u0636\u0645 \u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0646\u062c\u0627\u062d 11 \u0643\u0644\u064a\u0629 \u0645\u0646\u0647\u0627: \u0627\u0644\u0637\u0628\u060c \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0648\u0627\u0644\u0627\u062a\u0635\u0627\u0644\u060c \u0637\u0628 \u0627\u0644\u0623\u0633\u0646\u0627\u0646\u060c \u0627\u0644\u0641\u0646\u0648\u0646 \u0627\u0644\u062c\u0645\u064a\u0644\u0629\u060c \u0627\u0644\u062f\u0631\u0627\u0633\u0627\u062a \u0627\u0644\u0639\u0644\u064a\u0627\u060c \u0627\u0644\u0639\u0644\u0648\u0645 \u0627\u0644\u0625\u0646\u0633\u0627\u0646\u064a\u0629 \u0648\u0627\u0644\u062a\u0631\u0628\u0648\u064a\u0629\u060c \u062a\u0643\u0646\u0648\u0644\u0648\u062c\u064a\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0648\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a\u060c \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0648\u0627\u0644\u0639\u0644\u0648\u0645 \u0627\u0644\u0633\u064a\u0627\u0633\u064a\u0629\u060c \u0627\u0644\u0637\u0628 \u0627\u0644\u0628\u064a\u0637\u0631\u064a \u0648\u0627\u0644\u0647\u0646\u062f\u0633\u0629 \u0627\u0644\u0632\u0631\u0627\u0639\u064a\u0629\u060c \u0648\u0627\u0644\u0647\u0646\u062f\u0633\u0629 \u0648\u062a\u0643\u0646\u0648\u0644\u0648\u062c\u064a\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a.',
  'UNIVERSITY_FACULTIES_LIST',
  ARRAY['faculties','colleges','faculty list'],
  6
WHERE NOT EXISTS (SELECT 1 FROM university_qa WHERE normalized_intent = 'UNIVERSITY_FACULTIES_LIST');

-- ===== FACULTY SOURCES =====

INSERT INTO faculty_sources (id, source_name, source_url, fetched_at, confidence, notes) VALUES
  (5, 'Faculty of Engineering - ABET Accredited Programs',
   'https://eng.najah.edu/en/quality-unit/abet-accredited-engineering-programs/',
   NOW(), 0.95,
   'Official ABET accreditation listing page.'),
  (6, 'Faculty of Engineering - Welcome / About',
   'https://eng.najah.edu/en/about/',
   NOW(), 0.95,
   'Official faculty about page.')
ON CONFLICT (source_url) DO NOTHING;

-- ===== FACULTY STATISTICS UPDATE =====

UPDATE faculty_statistics SET
  students_count = 5200,
  faculty_members_count = 150,
  programs_count = 15,
  updated_at = NOW()
WHERE faculty_id = 1;

-- ===== FACULTY QA (only truly new intents) =====

INSERT INTO faculty_qa (faculty_id, topic_id, question_en, question_ar, answer_en, answer_ar, normalized_intent, keywords, source_id)
SELECT 1, 1,
  'How many programs are ABET accredited in Engineering?',
  E'\u0643\u0645 \u0628\u0631\u0646\u0627\u0645\u062c \u0645\u0639\u062a\u0645\u062f \u0645\u0646 ABET \u0641\u064a \u0643\u0644\u064a\u0629 \u0627\u0644\u0647\u0646\u062f\u0633\u0629\u061f',
  'Nine engineering programs are ABET accredited: Civil, Electrical, Chemical, Industrial, Mechanical, Mechatronics, Telecommunications, Computer, and Building Engineering.',
  E'\u062a\u0633\u0639\u0629 \u0628\u0631\u0627\u0645\u062c \u0647\u0646\u062f\u0633\u064a\u0629 \u0645\u0639\u062a\u0645\u062f\u0629 \u0645\u0646 ABET: \u0627\u0644\u0645\u062f\u0646\u064a\u0629\u060c \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064a\u0629\u060c \u0627\u0644\u0643\u064a\u0645\u064a\u0627\u0626\u064a\u0629\u060c \u0627\u0644\u0635\u0646\u0627\u0639\u064a\u0629\u060c \u0627\u0644\u0645\u064a\u0643\u0627\u0646\u064a\u0643\u064a\u0629\u060c \u0627\u0644\u0645\u064a\u0643\u0627\u062a\u0631\u0648\u0646\u0643\u0633\u060c \u0627\u0644\u0627\u062a\u0635\u0627\u0644\u0627\u062a\u060c \u0627\u0644\u062d\u0627\u0633\u0648\u0628\u060c \u0648\u0647\u0646\u062f\u0633\u0629 \u0627\u0644\u0628\u0646\u0627\u0621.',
  'FACULTY_ABET_PROGRAMS_COUNT',
  ARRAY['abet','accredited','accreditation','count','how many'],
  5
WHERE NOT EXISTS (SELECT 1 FROM faculty_qa WHERE normalized_intent = 'FACULTY_ABET_PROGRAMS_COUNT');

INSERT INTO faculty_qa (faculty_id, topic_id, question_en, question_ar, answer_en, answer_ar, normalized_intent, keywords, source_id)
SELECT 1, 1,
  'Is my engineering program ABET accredited?',
  E'\u0647\u0644 \u0628\u0631\u0646\u0627\u0645\u062c\u064a \u0627\u0644\u0647\u0646\u062f\u0633\u064a \u0645\u0639\u062a\u0645\u062f \u0645\u0646 ABET\u061f',
  'The nine ABET-accredited programmes at An-Najah are: Civil, Electrical, Chemical, Industrial, Mechanical, Mechatronics, Telecommunications, Computer, and Building Engineering. Check each programme record for its accreditation status.',
  E'\u0627\u0644\u0628\u0631\u0627\u0645\u062c \u0627\u0644\u062a\u0633\u0639\u0629 \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u0629 \u0645\u0646 ABET \u0641\u064a \u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0646\u062c\u0627\u062d: \u0627\u0644\u0645\u062f\u0646\u064a\u0629\u060c \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064a\u0629\u060c \u0627\u0644\u0643\u064a\u0645\u064a\u0627\u0626\u064a\u0629\u060c \u0627\u0644\u0635\u0646\u0627\u0639\u064a\u0629\u060c \u0627\u0644\u0645\u064a\u0643\u0627\u0646\u064a\u0643\u064a\u0629\u060c \u0627\u0644\u0645\u064a\u0643\u0627\u062a\u0631\u0648\u0646\u0643\u0633\u060c \u0627\u0644\u0627\u062a\u0635\u0627\u0644\u0627\u062a\u060c \u0627\u0644\u062d\u0627\u0633\u0648\u0628\u060c \u0648\u0647\u0646\u062f\u0633\u0629 \u0627\u0644\u0628\u0646\u0627\u0621.',
  'PROGRAM_ABET_CHECK',
  ARRAY['abet','accredited','my program','check'],
  5
WHERE NOT EXISTS (SELECT 1 FROM faculty_qa WHERE normalized_intent = 'PROGRAM_ABET_CHECK');

-- ===== ENGINEERING PROGRAM SOURCES =====

INSERT INTO engineering_program_sources (id, source_name, source_url, fetched_at, confidence, notes) VALUES
  (2, 'Faculty of Engineering - Official Programs Overview',
   'https://eng.najah.edu/en/study/',
   NOW(), 0.90,
   'Official study page listing undergraduate programs.'),
  (3, 'Faculty of Engineering (archived) - Programs list',
   'http://eng-old.najah.edu/node/1',
   NOW(), 0.85,
   'Archived official page listing all programme names.')
ON CONFLICT (source_url) DO NOTHING;

-- ===== ENGINEERING PROGRAMS: set ABET + department on existing rows =====
-- Controlled department values (exact match to official 3 departments):
--   'Electrical and Computer Engineering'
--   'Industrial and Mechanical Engineering'
--   'Architectural and Civil Engineering'

-- ABET = true (confirmed on eng.najah.edu/en/quality-unit/abet-accredited-engineering-programs/)
UPDATE engineering_programs SET is_abet_accredited = true, department_name = 'Architectural and Civil Engineering'   WHERE program_key = 'civil_engineering';
UPDATE engineering_programs SET is_abet_accredited = true, department_name = 'Electrical and Computer Engineering'   WHERE program_key = 'electrical_engineering';
UPDATE engineering_programs SET is_abet_accredited = true, department_name = 'Electrical and Computer Engineering'   WHERE program_key = 'computer_engineering';
UPDATE engineering_programs SET is_abet_accredited = true, department_name = 'Industrial and Mechanical Engineering' WHERE program_key = 'mechanical_engineering';
UPDATE engineering_programs SET is_abet_accredited = true, department_name = 'Industrial and Mechanical Engineering' WHERE program_key = 'industrial_engineering';
UPDATE engineering_programs SET is_abet_accredited = true, department_name = 'Industrial and Mechanical Engineering' WHERE program_key = 'mechatronics_engineering';
UPDATE engineering_programs SET is_abet_accredited = true, department_name = 'Electrical and Computer Engineering'   WHERE program_key = 'telecommunications_engineering';

-- ABET = false (NOT on the official ABET list)
UPDATE engineering_programs SET is_abet_accredited = false, department_name = 'Architectural and Civil Engineering'   WHERE program_key = 'architectural_engineering';
UPDATE engineering_programs SET is_abet_accredited = false, department_name = 'Industrial and Mechanical Engineering' WHERE program_key = 'energy_environmental_engineering';

-- Career summary for mechanical_engineering ONLY (source: eng.najah.edu official page)
UPDATE engineering_programs SET
  career_summary_en = 'Graduates can work in building mechanical systems, factories as mechanical engineering designers or maintenance engineers, production lines, vehicle companies, government institutions, elevator companies, and hydraulic machines.'
WHERE program_key = 'mechanical_engineering';

-- ===== ENGINEERING PROGRAMS: new program rows =====

INSERT INTO engineering_programs (
  faculty_slug, program_key, name_en, name_ar, description_en,
  degree_type, stream_type, is_abet_accredited, department_name,
  is_estimate, keywords, source_id
) VALUES
  ('an-najah-faculty-engineering', 'chemical_engineering',
   'Chemical Engineering',
   E'\u0627\u0644\u0647\u0646\u062f\u0633\u0629 \u0627\u0644\u0643\u064a\u0645\u064a\u0627\u0626\u064a\u0629',
   NULL,
   'Bachelor', 'scientific', true, 'Industrial and Mechanical Engineering',
   true, ARRAY['chemical','chemistry','process'], 2),
  ('an-najah-faculty-engineering', 'building_engineering',
   'Building Engineering',
   E'\u0647\u0646\u062f\u0633\u0629 \u0627\u0644\u0628\u0646\u0627\u0621',
   NULL,
   'Bachelor', 'both', true, 'Architectural and Civil Engineering',
   true, ARRAY['building','construction','structural'], 2),
  ('an-najah-faculty-engineering', 'urban_planning',
   'Urban Planning Engineering',
   E'\u0647\u0646\u062f\u0633\u0629 \u0627\u0644\u062a\u062e\u0637\u064a\u0637 \u0627\u0644\u0639\u0645\u0631\u0627\u0646\u064a',
   NULL,
   'Bachelor', 'both', false, 'Architectural and Civil Engineering',
   true, ARRAY['urban','planning','city'], 2),
  ('an-najah-faculty-engineering', 'materials_engineering',
   'Materials Science Engineering',
   E'\u0647\u0646\u062f\u0633\u0629 \u0639\u0644\u0648\u0645 \u0627\u0644\u0645\u0648\u0627\u062f',
   NULL,
   'Bachelor', 'scientific', false, 'Industrial and Mechanical Engineering',
   true, ARRAY['materials','materials science','metallurgy'], 2)
ON CONFLICT (program_key) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  is_abet_accredited = EXCLUDED.is_abet_accredited,
  department_name = EXCLUDED.department_name,
  updated_at = NOW();

COMMIT;
