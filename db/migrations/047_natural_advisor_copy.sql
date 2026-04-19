-- 047: Rewrite all major_chat_context greetings and suggested questions.
-- Removes all technical/database language ("stored", "record", "catalogue", "field", "مخزن", "السجل", "الكتالوج").
-- Replaces with natural academic advisor tone in both English and Arabic.
-- Data-only change; no schema modifications.

BEGIN;

-- ===== ENGINEERING MAJORS =====

UPDATE major_chat_context SET
  greeting_en = 'Welcome! I am your academic advisor for Management Information Systems. Feel free to ask me anything about this programme — admission, difficulty, career paths, or whether it might be a good fit for you.',
  greeting_ar = 'أهلاً وسهلاً! أنا مرشدك الأكاديمي لبرنامج نظم معلومات الإدارة. اسألني أي شي عن هالتخصص — القبول، الصعوبة، فرص العمل، أو إذا بيناسبك.',
  suggested_questions_en = '["Is this programme difficult?","What careers does MIS lead to?","Is it more technical or business-focused?","What is the admission average for this programme?"]'::jsonb,
  suggested_questions_ar = '["هل هالتخصص صعب؟","شو فرص العمل بعد التخرج؟","أكثر تقني ولا إداري؟","شو معدل القبول لهالبرنامج؟"]'::jsonb
WHERE major_id = 'eng-mis';

UPDATE major_chat_context SET
  greeting_en = 'Welcome! I am your academic advisor for Computer Science. Ask me about anything related to this programme — admission requirements, difficulty, career opportunities, or how it compares with other options.',
  greeting_ar = 'أهلاً! أنا مرشدك الأكاديمي لعلوم الحاسوب. اسألني عن أي شي يخص هالتخصص — شروط القبول، الصعوبة، فرص العمل، أو مقارنته مع تخصصات ثانية.',
  suggested_questions_en = '["Is this programme difficult?","Is it very math-heavy?","What is the competition level?","What is the admission average?"]'::jsonb,
  suggested_questions_ar = '["هل هالتخصص صعب؟","فيه رياضيات كثير؟","شو مستوى التنافس؟","شو معدل القبول؟"]'::jsonb
WHERE major_id = 'eng-cs';

UPDATE major_chat_context SET
  greeting_en = 'Welcome! I am your academic advisor for Electrical Engineering. I can help you understand admission requirements, difficulty, career paths, and whether this programme suits your goals.',
  greeting_ar = 'أهلاً! أنا مرشدك الأكاديمي للهندسة الكهربائية. بقدر أساعدك تفهم شروط القبول، الصعوبة، مجالات العمل، وإذا هالتخصص بيناسب أهدافك.',
  suggested_questions_en = '["Is this programme difficult?","What career paths does it lead to?","Does it require scientific or industrial stream?","What is the admission average?"]'::jsonb,
  suggested_questions_ar = '["هل هالتخصص صعب؟","شو مجالات العمل بعد التخرج؟","بتطلب فرع علمي ولا صناعي؟","شو معدل القبول؟"]'::jsonb
WHERE major_id = 'eng-ee';

UPDATE major_chat_context SET
  greeting_en = 'Welcome! I am your academic advisor for Civil Engineering. I can tell you about admission, difficulty, career directions, and how this programme compares with other engineering options.',
  greeting_ar = 'أهلاً وسهلاً! أنا مرشدك الأكاديمي للهندسة المدنية. بقدر أحكيلك عن القبول، الصعوبة، مجالات العمل، ومقارنته مع تخصصات هندسية ثانية.',
  suggested_questions_en = '["Is this programme difficult?","What do graduates usually go on to do?","Is it math-heavy?","What is the admission average?"]'::jsonb,
  suggested_questions_ar = '["هل هالتخصص صعب؟","شو بشتغلوا الخريجين عادةً؟","فيه رياضيات كثير؟","شو معدل القبول؟"]'::jsonb
WHERE major_id = 'eng-ce';

UPDATE major_chat_context SET
  greeting_en = 'Welcome! I am your academic advisor for Mechanical Engineering. Ask me about anything — admission, difficulty, career paths, or how hands-on the programme is.',
  greeting_ar = 'أهلاً! أنا مرشدك الأكاديمي للهندسة الميكانيكية. اسألني عن أي شي — القبول، الصعوبة، فرص العمل، أو قديش فيه جانب عملي.',
  suggested_questions_en = '["Is this programme difficult?","Is it more hands-on or theoretical?","What is the competition level?","What is the admission average?"]'::jsonb,
  suggested_questions_ar = '["هل هالتخصص صعب؟","أكثر عملي ولا نظري؟","شو مستوى التنافس؟","شو معدل القبول؟"]'::jsonb
WHERE major_id = 'eng-me';

UPDATE major_chat_context SET
  greeting_en = 'Welcome! I am your academic advisor for Information Technology. Feel free to ask about admission, difficulty, career opportunities, or what makes this programme unique.',
  greeting_ar = 'أهلاً! أنا مرشدك الأكاديمي لتقنية المعلومات. اسألني عن القبول، الصعوبة، فرص العمل، أو شو اللي بميز هالتخصص.',
  suggested_questions_en = '["Is this programme difficult?","Is it more programming or infrastructure?","What is the admission average?","What careers does it lead to?"]'::jsonb,
  suggested_questions_ar = '["هل هالتخصص صعب؟","أكثر برمجة ولا بنية تحتية؟","شو معدل القبول؟","شو فرص العمل؟"]'::jsonb
WHERE major_id = 'eng-it';

UPDATE major_chat_context SET
  greeting_en = 'Welcome! I am your academic advisor for Software Engineering. I can help you with questions about admission, difficulty, career paths, or how it compares with Computer Science.',
  greeting_ar = 'أهلاً! أنا مرشدك الأكاديمي لهندسة البرمجيات. بقدر أساعدك بأسئلة عن القبول، الصعوبة، فرص العمل، أو مقارنته مع علوم الحاسوب.',
  suggested_questions_en = '["Is this programme difficult?","How coding-intensive is it?","What is the admission average?","How does it compare with Computer Science?"]'::jsonb,
  suggested_questions_ar = '["هل هالتخصص صعب؟","قديش فيه برمجة؟","شو معدل القبول؟","شو الفرق بينه وبين علوم الحاسوب؟"]'::jsonb
WHERE major_id = 'eng-se';

-- ===== ARTS / SOCIAL SCIENCE MAJORS =====

UPDATE major_chat_context SET
  greeting_en = 'Welcome! I am your academic advisor for Economics. I can share what I know about this programme and help you think about whether it fits your interests and goals.',
  greeting_ar = 'أهلاً وسهلاً! أنا مرشدك الأكاديمي للاقتصاد. بقدر أشاركك اللي بعرفه عن هالتخصص وأساعدك تفكر إذا بيناسب اهتماماتك وأهدافك.',
  suggested_questions_en = '["Is this major more theory or applied?","What analytical skills does it develop?","Is it a good fit if I like data and analysis?","How does it compare with Business Administration?"]'::jsonb,
  suggested_questions_ar = '["هالتخصص أكثر نظري ولا تطبيقي؟","شو المهارات التحليلية اللي بيطورها؟","بيناسبني إذا بحب البيانات والتحليل؟","شو الفرق بينه وبين إدارة الأعمال؟"]'::jsonb
WHERE major_id = 'arts-econ';

UPDATE major_chat_context SET
  greeting_en = 'Welcome! I am your academic advisor for Psychology. I will do my best to answer your questions about this programme, and guide you on whether it could be a good fit for you.',
  greeting_ar = 'أهلاً فيك! أنا مرشدك الأكاديمي لعلم النفس. رح أحاول أجاوبك على أسئلتك عن هالتخصص وأساعدك تقرر إذا بيناسبك.',
  suggested_questions_en = '["Is this major more scientific or humanities?","What career paths are common after graduation?","Is clinical work part of the undergraduate programme?","Is it a good fit for me?"]'::jsonb,
  suggested_questions_ar = '["هالتخصص أكثر علمي ولا إنساني؟","شو مسارات العمل بعد التخرج؟","في تدريب سريري بالبكالوريوس؟","بيناسبني هالتخصص؟"]'::jsonb
WHERE major_id = 'arts-psych';

UPDATE major_chat_context SET
  greeting_en = 'Welcome! I am your academic advisor for Biology. Ask me about the programme, career directions, or whether it matches your interests.',
  greeting_ar = 'أهلاً! أنا مرشدك الأكاديمي لعلم الأحياء. اسألني عن البرنامج، مجالات العمل، أو إذا بيناسب اهتماماتك.',
  suggested_questions_en = '["Is this major lab-heavy?","What careers does it prepare for?","How much chemistry is typically required?","Is it difficult?"]'::jsonb,
  suggested_questions_ar = '["فيه مختبرات كثير؟","شو الوظائف اللي بحضّر إلها؟","قديش بتطلب كيمياء؟","هل هو صعب؟"]'::jsonb
WHERE major_id = 'arts-bio';

-- ===== BUSINESS MAJORS =====

UPDATE major_chat_context SET
  greeting_en = 'Welcome! I am your academic advisor for Business Administration. I can help you understand what this programme offers and how it might fit your career goals.',
  greeting_ar = 'أهلاً وسهلاً! أنا مرشدك الأكاديمي لإدارة الأعمال. بقدر أساعدك تفهم شو بيقدم هالتخصص وكيف ممكن يناسب أهدافك المهنية.',
  suggested_questions_en = '["Is this major more theory or practical?","What job opportunities does it lead to?","Is it a good fit if I like leadership?","How does it compare with Economics?"]'::jsonb,
  suggested_questions_ar = '["هالتخصص أكثر نظري ولا عملي؟","شو فرص العمل؟","بيناسبني إذا بحب القيادة والإدارة؟","شو الفرق بينه وبين الاقتصاد؟"]'::jsonb
WHERE major_id = 'bus-mgmt';

-- ===== HEALTH MAJORS =====

UPDATE major_chat_context SET
  greeting_en = 'Welcome! I am your academic advisor for Nursing. I can share what I know about this programme. For licensing and clinical details, I would recommend checking with the faculty office directly.',
  greeting_ar = 'أهلاً فيك! أنا مرشدك الأكاديمي للتمريض. بقدر أشاركك اللي بعرفه عن هالتخصص. لتفاصيل الترخيص والسريريات، بنصحك تتواصل مع عمادة الكلية.',
  suggested_questions_en = '["Is this programme more clinical or classroom-based?","What does licensing depend on?","Is it very demanding in hours?","Is it a good fit for me?"]'::jsonb,
  suggested_questions_ar = '["هالبرنامج أكثر سريري ولا صفي؟","شو بتعتمد عليه رخصة المزاولة؟","هل ساعاته كثيرة؟","بيناسبني هالتخصص؟"]'::jsonb
WHERE major_id = 'med-nursing';

-- ===== LAW MAJORS =====

UPDATE major_chat_context SET
  greeting_en = 'Welcome! I am your academic advisor for Law. I can help you understand what this programme involves. For specific practice routes, the faculty office can give you the latest details.',
  greeting_ar = 'أهلاً! أنا مرشدك الأكاديمي للقانون. بقدر أساعدك تفهم شو بيتضمن هالتخصص. لتفاصيل مسارات الممارسة، الكلية بتقدر تفيدك أكثر.',
  suggested_questions_en = '["Is this major reading-heavy?","What career paths are common after graduation?","Is it theory-first in the early years?","Is it a good fit if I like debate and writing?"]'::jsonb,
  suggested_questions_ar = '["هالتخصص فيه قراءة كثيرة؟","شو مسارات العمل بعد التخرج؟","هل البداية نظرية؟","بيناسبني إذا بحب النقاش والكتابة؟"]'::jsonb
WHERE major_id = 'law-legal';

-- ===== FACTS TEXT CLEANUP =====
-- Remove technical language from facts_en / facts_ar where present

UPDATE major_chat_context SET
  facts_en = 'Management Information Systems combines technology with business processes. For detailed curriculum information, check the official faculty page.',
  facts_ar = 'نظم معلومات الإدارة بجمع بين التكنولوجيا والعمليات التجارية. لتفاصيل المنهج، راجع صفحة الكلية الرسمية.'
WHERE major_id = 'eng-mis';

UPDATE major_chat_context SET
  facts_en = 'Economics combines quantitative reasoning with social-science perspectives. For the full curriculum, check the official faculty page.',
  facts_ar = 'الاقتصاد بجمع التفكير الكمّي مع وجهات نظر العلوم الاجتماعية. للمنهج الكامل، راجع صفحة الكلية الرسمية.'
WHERE major_id = 'arts-econ';

UPDATE major_chat_context SET
  facts_en = 'Business Administration covers strategy, operations, and leadership skills. For course requirements, check the official faculty page.',
  facts_ar = 'إدارة الأعمال بتغطي الاستراتيجية والعمليات ومهارات القيادة. لمتطلبات المواد، راجع صفحة الكلية الرسمية.'
WHERE major_id = 'bus-mgmt';

UPDATE major_chat_context SET
  facts_en = 'Nursing is a tightly regulated field. Always confirm competencies and licensing requirements with the faculty office.',
  facts_ar = 'التمريض مجال منظّم. دايماً تأكد من المتطلبات ورخصة المزاولة مع عمادة الكلية.'
WHERE major_id = 'med-nursing';

UPDATE major_chat_context SET
  facts_en = 'Law study focuses on statutes, cases, and structured argument. For practice routes and bar requirements, check with the faculty.',
  facts_ar = 'القانون بركّز على النصوص والسوابق والحجة المنظمة. لمسارات الممارسة ومتطلبات المحاماة، تواصل مع الكلية.'
WHERE major_id = 'law-legal';

COMMIT;
