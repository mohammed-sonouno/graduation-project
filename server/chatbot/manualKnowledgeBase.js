/**
 * Curated static knowledge (ported from najah_gemini_chatbot reference backend).
 * @type {Array<{ id: string, title: string, tags: string[], body: string }>}
 */
const manualKnowledgeBase = [
  {
    id: 'platform-overview',
    title: 'Najah University digital platform overview',
    tags: ['overview', 'platform', 'website', 'najah', 'portal'],
    body:
      'This website is a digital platform for An-Najah National University. Students and professors can use Najah email accounts to access university-related information and services. The platform is designed to make information discovery, event participation, analytics, and student engagement easier through a single web experience.',
  },
  {
    id: 'login-and-roles',
    title: 'Authentication and user roles',
    tags: ['login', 'roles', 'student', 'professor', 'admin', 'dean', 'supervisor'],
    body:
      'The platform supports sign-in with An-Najah university email accounts. The main roles are students, professors, and administrators. Administrative roles may include supervisors and deans. Students can browse information, apply to events, submit feedback, and request communities. Admin-side roles can publish events, monitor analytics, review communities, and moderate sentiment labels when needed.',
  },
  {
    id: 'majors-and-faculties',
    title: 'Majors, fields, and faculties section',
    tags: ['majors', 'fields', 'faculties', 'academic', 'departments'],
    body:
      'The website contains a university information section where users can browse majors, academic fields, and faculties with detailed descriptions. The goal of this section is to help students understand the structure of the university and explore academic options in a clear, organized way.',
  },
  {
    id: 'official-events',
    title: 'Official university events',
    tags: ['events', 'ieee', 'ain', 'official events', 'upcoming', 'past'],
    body:
      'The platform includes official university events such as IEEE activities, AIN activities, and other campus events. Users can browse events that already happened, events happening now, and future events. Event records can include the title, date, location, status, and related reviews once the event is completed.',
  },
  {
    id: 'event-creation-and-application',
    title: 'Event creation, publishing, and student applications',
    tags: ['event creation', 'publishing', 'apply', 'registration', 'workflow'],
    body:
      'Administrators, supervisors, and deans can create and publish university events from the website. Students can apply to join published events directly through the platform. After an event is completed, students can leave feedback using a 1-to-5 star rating and a written comment.',
  },
  {
    id: 'feedback-and-nlp',
    title: 'Event feedback, NLP, and sentiment analysis',
    tags: ['feedback', 'nlp', 'sentiment', 'arabic', 'english', 'analytics'],
    body:
      "The system analyzes event review comments using Python-based natural language processing. It supports Arabic and English text, including elongated words such as 'amaziiiiing'. The system classifies comments into positive, neutral, or negative sentiment. For example, a mixed statement like 'this event was okay, not the greatest, not the worst' is expected to be neutral, while strongly positive language should be classified as positive.",
  },
  {
    id: 'admin-dashboard-and-learning',
    title: 'Admin dashboard, corrections, and learning loop',
    tags: ['admin dashboard', 'manual correction', 'machine learning', 'dashboard', 'sentiment override'],
    body:
      'Administrators can view analytics for completed events through a dashboard UI. They can inspect ratings, comments, and sentiment summaries. If the system classifies a comment incorrectly, the admin can manually correct the sentiment label. The platform is designed so these corrections improve how similar comments are handled later, which adds a lightweight machine-learning feedback loop on top of NLP.',
  },
  {
    id: 'event-analytics-formula',
    title: 'Positive sentiment percentage for completed events',
    tags: ['positive percentage', 'analytics', 'formula', 'sentiment score'],
    body:
      'For completed events, the platform can calculate a positive sentiment percentage by taking positive, neutral, and negative review outcomes into account. This gives administrators a compact KPI for how students felt about an event overall. The dashboard can also present review counts and average rating to complement the sentiment percentage.',
  },
  {
    id: 'communities-module',
    title: 'Student communities and approval workflow',
    tags: ['communities', 'groups', 'discord-like', 'faculty restriction', 'approval'],
    body:
      'The website includes a communities section where students can request new communities. A student provides a community name, chooses a category such as arts, fitness, advice, or life advice, and then decides whether the community should be limited to a specific faculty like Medicine or IT, or open to all faculties. An administrator reviews the request and either approves or rejects it. If approved, other students can browse the community and request to join it.',
  },
  {
    id: 'design-and-ux',
    title: 'Design and user experience',
    tags: ['figma', 'design', 'ui', 'ux', 'hci'],
    body:
      'The interface design was created in Figma. The platform aims to organize university information clearly, reduce friction in event participation, and make analytics easy for administrators to understand. This supports usability, consistency, and a cleaner student experience.',
  },
  {
    id: 'mis-context',
    title: 'Why this project fits MIS',
    tags: ['mis', 'decision support', 'data analysis', 'systems analysis', 'hci'],
    body:
      'This project fits Management Information Systems because it combines application development, structured data management, analytics, decision support, and user-centered interface design. The programming side connects to software development courses, the event analytics and sentiment dashboard connect to data analysis and DSS concepts, and the design work connects to HCI and interface management.',
  },
  /** MIS Major — Bilingual | Official data from An-Najah University registrar */
  {
    id: 'mis-courses',
    title: 'نظم المعلومات الإدارية | Management Information Systems (MIS)',
    tags: [
      // Arabic tags
      'mis', 'نظم المعلومات', 'نظم المعلومات الإدارية',
      'مواد mis', 'خطة mis', 'ساعات mis', '10676',
      'برمجة', 'قواعد بيانات', 'تحليل النظم',
      'فروع القبول mis', 'كم ساعة mis',
      // English tags
      'management information systems', 'management information',
      'mis major', 'mis courses', 'mis credits', 'mis plan',
      'mis admission', 'mis requirements', 'information systems',
      'database management', 'systems analysis', 'mis track',
    ],
    body: `
## Management Information Systems — نظم المعلومات الإدارية (MIS)

| | Arabic | English |
|---|---|---|
| Total Credits | 124 ساعة معتمدة | 124 Credit Hours |
| Accepted Tracks | العلمي، الأدبي، التجاري | Scientific, Literary, Commercial |

### Mandatory Courses — إجباري تخصص (87 Credit Hours):
10676101 مبادئ البرمجة (1) | Programming Principles (1) VB | 3 hrs
10676102 مبادئ البرمجة (2) | Programming Principles (2) VB | 3 hrs
10676110 مقدمة في تكنولوجيا المعلومات | Intro to IT | 3 hrs
10676111 مقدمة في نظم المعلومات الإدارية | Intro to MIS | 3 hrs
10676121 الرياضيات في الأعمال التجارية | Business Mathematics | 3 hrs
10676122 الإحصاء للأعمال التجارية | Business Statistics | 3 hrs
10676151 مبادئ المحاسبة والتمويل | Accounting & Finance Principles | 3 hrs
10676204 تقنيات برمجة الشبكة (1) | Web Programming (1) | 3 hrs
10676211 تحليل القرارات | Decision Analysis | 3 hrs
10676213 بحوث العمليات وتطبيقاتها | Operations Research | 3 hrs
10676222 الاتصالات التجارية وكتابة التقارير | Business Communication & Reports | 3 hrs
10676230 التطوير المؤسسي وإدارة التغيير | Org. Development & Change Mgmt | 3 hrs
10676260 إدارة العمليات | Operations Management | 3 hrs
10676270 إدارة قواعد البيانات وتطبيقاتها | Database Management & Apps | 3 hrs
10676283 تقنيات برمجة الشبكة (2) | Web Programming (2) | 3 hrs
10676321 التجارة الإلكترونية | E-Commerce | 3 hrs
10676323 إدارة المشاريع | Project Management | 3 hrs
10676324 الأمن في تكنولوجيا المعلومات | IT Security | 3 hrs
10676336 تحليل النظم | Systems Analysis | 3 hrs
10676345 الاتصالات والشبكات للأعمال | Business Networks & Communications | 3 hrs
10676350 ضمان الجودة في البرمجيات | Software Quality Assurance | 3 hrs
10676414 أنظمة دعم القرارات | Decision Support Systems | 3 hrs
10676415 ريادة الأعمال في تكنولوجيا المعلومات | IT Entrepreneurship | 3 hrs
10676433 تطبيقات المؤسسات | Enterprise Applications | 3 hrs
10676450 تدريب ميداني MIS | MIS Field Training | 3 hrs
10676470 الإدارة الاستراتيجية في المنظمات الرقمية | Strategic Mgmt in Digital Orgs | 3 hrs
10676490 مشروع في نظم المعلومات الإدارية | MIS Project | 3 hrs
10676500 مبادئ البحث العلمي | Research Methods | 3 hrs
10866111 مبادئ في الإدارة (1) | Management Principles (1) | 3 hrs

### Elective Courses — اختياري تخصص (18 Credit Hours required from):
10676320 إدارة مخاطر نظم المعلومات | IS Risk Management | 3 hrs
10676322 تفاعل الإنسان والحاسوب | Human-Computer Interaction & UI Design | 3 hrs
10676330 التسويق الإلكتروني | E-Marketing | 3 hrs
10676333 تحليل البيانات | Data Analysis | 3 hrs

### ANSWERING RULES:
- Respond in the SAME language the user writes in (Arabic → Arabic, English → English)
- Mixed Arabic-English message → respond in Arabic
- Use ONLY this data for any MIS question
- Course codes starting with 10676 → answer with exact name and hours
- All 3 high school tracks accepted (علمي/Scientific، أدبي/Literary، تجاري/Commercial)
- Total = 87 mandatory + 18 elective + university requirements = 124
- If asked about a course NOT listed → say it is not in the official MIS plan
- Never mix MIS data with other majors
  `,
  },
  {
    id: 'cs-courses',
    title: 'Computer Science courses and curriculum',
    tags: ['computer science', 'cs', 'علوم حاسوب', 'courses', 'مواد'],
    body: `Computer Science at An-Najah has 132 credit hours over 4 years.
Core courses include: Programming (Java, Python, C++), Data structures, Algorithms, Operating systems, Computer architecture, Database systems, Software engineering, Artificial intelligence, Computer networks, Theory of computation, Compiler design, and graduation project.`,
  },
  {
    id: 'engineering-courses',
    title: 'Engineering majors general info',
    tags: ['engineering', 'هندسة', 'courses', 'مواد', 'civil', 'mechanical', 'electrical'],
    body: `Engineering majors at An-Najah take 5 years (161-165 credit hours).
First two years cover shared foundation: Mathematics, Physics, Chemistry, Engineering drawing, Mechanics, and programming basics.
Then students specialize in their chosen field from year 3 onwards.
Minimum admission average is 75% for all engineering majors.`,
  },
];

// Startup integrity check — warn if MIS entry is missing
const _misEntry = manualKnowledgeBase.find(e => e.tags.includes('mis') && e.id === 'mis-courses');
if (!_misEntry) {
  console.warn('[KB] MIS entry not found — check manualKnowledgeBase');
}

export { manualKnowledgeBase };
