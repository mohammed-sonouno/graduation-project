-- Colleges and majors (reference data, stored in DB).
CREATE TABLE IF NOT EXISTS colleges (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS majors (
  id         VARCHAR(100) PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_majors_college_id ON majors(college_id);

-- Seed colleges
INSERT INTO colleges (id, name) VALUES
  (1, 'Engineering & IT'),
  (2, 'Medicine & Health'),
  (3, 'Arts & Sciences'),
  (4, 'Business School'),
  (5, 'Law & Policy')
ON CONFLICT (id) DO NOTHING;

-- Seed majors (requires colleges to exist)
INSERT INTO majors (id, name, college_id) VALUES
  ('eng-mis', 'Management Information Systems', 1),
  ('eng-cs', 'Computer Science', 1),
  ('eng-ee', 'Electrical Engineering', 1),
  ('eng-ce', 'Civil Engineering', 1),
  ('eng-me', 'Mechanical Engineering', 1),
  ('eng-it', 'Information Technology', 1),
  ('eng-se', 'Software Engineering', 1),
  ('arts-econ', 'Economics', 3),
  ('arts-psych', 'Psychology', 3),
  ('arts-bio', 'Biology', 3),
  ('bus-mgmt', 'Business Administration', 4),
  ('med-nursing', 'Nursing', 2),
  ('law-legal', 'Law', 5)
ON CONFLICT (id) DO NOTHING;
