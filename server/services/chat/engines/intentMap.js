import {
  includesAny,
  normalizeText,
  pickQuotedOrAfterKeyword,
  extractComparisonPair,
  extractInterestTermsFromMessage,
  isEngineeringCatalogContext
} from '../../../utils/chatText.js';

function hasWord(msg, word) {
  return new RegExp(`\\b${word}\\b`, 'i').test(normalizeText(msg));
}

function detectMajorPageIntent(msg, userMessage, memory, majorPage) {
  if (!majorPage?.majorId) return null;

  // --- Best major ---
  if (
    includesAny(msg, [
      'best major', 'which major', 'what major', 'better major',
      'أفضل تخصص', 'شو أفضل تخصص', 'أحسن تخصص', 'شو أحسن تخصص',
      'أفضل برنامج', 'أحسن برنامج'
    ])
  ) {
    return { name: 'major_advisor_best', params: {} };
  }

  // --- Difficulty ---
  if (
    includesAny(msg, [
      'difficult', 'difficulty', 'hard', 'easy', 'challenging', 'demanding',
      'tough', 'workload', 'heavy', 'intense', 'intense programme',
      'how tough', 'is it tough', 'heavy workload', 'course load',
      'صعب', 'صعوبة', 'سهل', 'صعبان', 'متطلب', 'مستوى الصعوبة',
      'هل صعب', 'قديش صعب', 'شو مستوى الصعوبة', 'كيف صعوبته',
      'is it hard', 'is it difficult', 'how hard', 'how difficult'
    ])
  ) {
    return { name: 'major_advisor_snapshot', params: { aspect: 'difficulty' } };
  }

  // --- Competition ---
  if (
    includesAny(msg, [
      'competition', 'competitive', 'compete', 'how competitive',
      'is it competitive', 'competition level', 'how popular',
      'many applicants', 'many students apply', 'selective',
      'تنافس', 'منافسة', 'المنافسة', 'مستوى التنافس',
      'شو مستوى التنافس', 'قديش التنافس', 'هل فيه تنافس',
      'كيف التنافس', 'التنافسية'
    ])
  ) {
    return { name: 'major_advisor_snapshot', params: { aspect: 'competition' } };
  }

  // --- Careers ---
  if (
    includesAny(msg, [
      'career', 'careers', 'job', 'jobs', 'employment',
      'job prospects', 'job opportunities', 'career paths', 'career options',
      'what can i work', 'where can i work', 'find work', 'work after',
      'profession', 'salary', 'earning',
      'after graduation', 'when i graduate', 'after i finish',
      'graduates', 'graduates do', 'graduate do',
      'وظيفة', 'وظائف', 'شغل', 'سوق العمل', 'فرص عمل', 'فرص العمل',
      'بعد التخرج', 'مجالات العمل', 'مجالات الشغل',
      'lead to', 'leads to', 'what does it lead', 'what does this lead',
      'where can i work', 'what can i do with', 'what can i become',
      'where do graduates', 'what will i become',
      'اين اعمل', 'وين اشتغل', 'شو بيودي', 'شو بدو يصير',
      'وين بروح', 'شو بشتغل', 'شو بصير',
      'شو بيطلع', 'لوين بيودي', 'شو مجالات العمل',
      'future', 'مستقبل', 'مستقبله'
    ])
  ) {
    return { name: 'major_advisor_snapshot', params: { aspect: 'careers' } };
  }

  // --- Fit / suitability ---
  if (
    includesAny(msg, [
      'suitable', 'right for me', 'fit me', 'fits me',
      'good for me', 'good for someone', 'good for', 'good if i', 'good if you',
      'good choice', 'worth it', 'should i', 'is it worth', 'worth studying',
      'good programme', 'good program', 'good major', 'is it good',
      'do you recommend', 'would you recommend', 'is it right',
      'اختيار جيد', 'خيار منيح', 'مناسب', 'يناسبني',
      'مناسبة لي', 'مناسب لي', 'بناسبني', 'بيناسبني',
      'is it for me', 'would it suit', 'should i study', 'should i choose',
      'should i pick', 'should i go for', 'is it a good idea',
      'هل ادرس', 'هل اختار', 'لازم ادرسه', 'أدرسه',
      'بيستاهل', 'يستاهل', 'منيح', 'كويس',
      'هل هو منيح', 'هل هو كويس', 'متع', 'ممتع',
      'ليش أختار', 'ليه أختار', 'ليش أدرس', 'ليه أدرس',
      'هل يناسبني', 'هل هذا يناسبني', 'هل هذا مناسب لي', 'هالبرنامج لي',
      'هل ينفع', 'هل يناسب', 'مناسب لي', 'هل مناسب', 'هل مناسب ليا',
      'لماذا', 'ليش', 'ليش لازم', 'ليش لازم أ', 'ليش لازم ادرس', 'why should i', 'why choose', 'why this',
      'advantages', 'disadvantages', 'pros and cons', 'مزايا', 'عيوب', 'ايجابيات', 'سلبيات',
      'مصلحتي', 'خيري', 'أفضل لي', 'الأنسب', 'الأحسن لي', 'يوافقني', 'يطابقني'
    ])
  ) {
    return { name: 'major_advisor_snapshot', params: { aspect: 'fit' } };
  }

  // --- Math ---
  if (includesAny(msg, ['math', 'mathematics', 'algebra', 'calculus', 'رياضيات', 'حساب', 'رياضي'])) {
    return { name: 'major_advisor_snapshot', params: { aspect: 'math' } };
  }

  // --- Format (theory vs practical, stream) ---
  if (includesAny(msg, [
    'theory', 'practical', 'hands-on', 'theoretical',
    'which stream', 'what stream', 'stream required', 'stream needed',
    'scientific or industrial', 'industrial or scientific',
    'نظري', 'عملي', 'تطبيقي', 'فرع علمي', 'فرع صناعي',
    'اي فرع', 'شو الفرع', 'علمي ولا صناعي'
  ])) {
    return { name: 'major_advisor_snapshot', params: { aspect: 'format' } };
  }

  // --- Admission / acceptance (on a major page: always answer, no extra AND) ---
  if (
    includesAny(msg, [
      'acceptance average', 'minimum average', 'min average',
      'admission average', 'admission', 'acceptance',
      'admission band', 'band for', 'what average', 'average needed',
      'required average', 'entry requirements', 'get in', 'get into',
      'gpa needed', 'gpa required', 'what gpa', 'minimum gpa',
      'grade needed', 'grade required', 'what grade',
      'score needed', 'cut off', 'cutoff', 'threshold',
      'can i get in', 'chances of getting in', 'do i qualify',
      'معدل القبول', 'معدل قبول', 'اقل معدل', 'أقل معدل', 'قبول',
      'شو المعدل', 'كم المعدل', 'قديش المعدل', 'شو معدل',
      'كم بدي معدل', 'قديش بدي معدل', 'شروط القبول', 'شروط الدخول',
      'كيف ادخل', 'كيف انقبل', 'شو بدي عشان ادخل',
      'نطاق القبول', 'نطاق المعدل',
      'how to get in', 'what do i need', 'requirements'
    ])
  ) {
    if (majorPage.category === 'engineering' && majorPage.programKey) {
      const q =
        pickQuotedOrAfterKeyword(userMessage, 'for') ||
        pickQuotedOrAfterKeyword(userMessage, 'ل') ||
        majorPage.majorName;
      return { name: 'engineering_acceptance_query', params: { q: String(q || majorPage.majorName).trim() } };
    }
    return { name: 'major_advisor_snapshot', params: { aspect: 'admission' } };
  }

  // --- Accreditation / ABET on a major page ---
  if (
    includesAny(msg, ['accredited', 'accreditation', 'abet', 'اعتماد', 'معتمد'])
  ) {
    return { name: 'major_advisor_snapshot', params: { aspect: 'overview' } };
  }

  // --- Duration / years ---
  if (
    includesAny(msg, [
      'how long', 'how many years', 'duration', 'years to complete',
      'year programme', 'year program', 'semesters',
      'كم سنة', 'مدة', 'مدته', 'كم سنه', 'كم فصل'
    ])
  ) {
    return { name: 'major_advisor_snapshot', params: { aspect: 'overview' } };
  }

  // --- Overview (general "tell me about") ---
  if (
    includesAny(msg, [
      'tell me about', 'what is this', 'overview', 'about this',
      'describe', 'information', 'details', 'summary',
      'what is this programme', 'what is this program', 'what is this major',
      'explain this', 'give me info', 'tell me more',
      'what do i need to know', 'what should i know',
      'احكيلي عن', 'شو هاد', 'شو هالتخصص', 'عن هالتخصص',
      'اعطيني معلومات', 'معلومات عن', 'نبذة', 'وصف', 'ملخص'
    ])
  ) {
    return { name: 'major_advisor_snapshot', params: { aspect: 'overview' } };
  }

  // --- Fuzzy fallback: catch common question words that imply "tell me about this major" ---
  if (
    includesAny(msg, [
      'this programme', 'this program', 'this major', 'this department',
      'this one', 'this course', 'this degree', 'this field',
      'هالتخصص', 'هاد التخصص', 'هالبرنامج', 'هاد البرنامج',
      'هالقسم', 'هالكلية'
    ])
  ) {
    return { name: 'major_advisor_snapshot', params: { aspect: 'overview' } };
  }

  return null;
}

/**
 * @param {string} userMessage
 * @param {object|null} memory — ephemeral conversation state (no PII beyond programme keys / averages)
 * @param {object|null} majorPage — resolved major page context (optional)
 */
export function detectIntent(userMessage, memory = null, majorPage = null) {
  const msg = normalizeText(userMessage);
  const interestTerms = extractInterestTermsFromMessage(userMessage);
  const avgMatch = msg.match(/(\d{2,3}(?:\.\d{1,2})?)/);
  const stream =
    includesAny(msg, ['scientific', 'علمي']) ? 'scientific' :
    includesAny(msg, ['industrial', 'صناعي']) ? 'industrial' :
    null;

  const engCtx = isEngineeringCatalogContext(msg, memory, majorPage);

  const pair = extractComparisonPair(userMessage);
  if (pair) {
    return { name: 'engineering_compare', params: { sideA: pair[0], sideB: pair[1] } };
  }

  if (
    memory?.lastSafeProgramKeys?.length >= 2 &&
    includesAny(msg, [
      'ايهم احسن',
      'أيهم أحسن',
      'شو احسن',
      'which is better',
      'which one is better',
      'which option',
      'أفضل',
      'احسن خيار',
      'more competitive',
      'أكثر تنافس'
    ])
  ) {
    return { name: 'engineering_followup_rank', params: {} };
  }

  const majorScoped = detectMajorPageIntent(msg, userMessage, memory, majorPage);
  if (majorScoped) return majorScoped;

  if (
    includesAny(msg, [
      'acceptance average', 'minimum average', 'min average',
      'admission average', 'admission band', 'required average',
      'gpa needed', 'gpa required', 'what gpa', 'cutoff',
      'معدل القبول', 'معدل قبول', 'اقل معدل', 'أقل معدل',
      'شو معدل القبول', 'كم معدل القبول', 'قديش معدل القبول'
    ]) &&
    (includesAny(msg, ['engineering', 'هندسة', 'program', 'برنامج', 'تخصص', 'major']) ||
      /هندسة/.test(String(userMessage || '')))
  ) {
    const q =
      pickQuotedOrAfterKeyword(userMessage, 'for') ||
      pickQuotedOrAfterKeyword(userMessage, 'ل') ||
      pickQuotedOrAfterKeyword(userMessage, 'معدل القبول') ||
      pickQuotedOrAfterKeyword(userMessage, 'اقل معدل') ||
      pickQuotedOrAfterKeyword(userMessage, 'أقل معدل') ||
      userMessage;
    return { name: 'engineering_acceptance_query', params: { q } };
  }

  if (
    includesAny(msg, ['abet', 'accredited', 'accreditation', 'اعتماد', 'معتمد']) &&
    includesAny(msg, ['engineering', 'هندسة', 'program', 'برنامج', 'faculty', 'كلية'])
  ) {
    return { name: 'faculty_info', params: { topic: 'abet' } };
  }

  if (
    /\u0643\u0644\u064A\u0629/.test(String(userMessage || '')) &&
    /(\u062A\u062E\u0635\u0635|\u0627\u0644\u062A\u062E\u0635\u0635\u0627\u062A|\u0628\u0631\u0646\u0627\u0645\u062C|\u0627\u0644\u0628\u0631\u0627\u0645\u062C|\u0645\u0639\u0644\u0648\u0645\u0627\u062A|\u0646\u0628\u0630\u0629|\u0627\u062D\u0643\u064A|\u0627\u062D\u0643\u064A\u0644\u064A|\u0627\u062E\u0628\u0631\u0646\u064A|\u0639\u0646)/.test(String(userMessage || ''))
  ) {
    return { name: 'faculty_info', params: { topic: 'general' } };
  }

  if (
    includesAny(msg, ['faculty', 'كلية', 'college']) &&
    includesAny(msg, [
      'department', 'departments', 'اقسام', 'أقسام', 'قسم',
      'student', 'students', 'طلاب', 'عدد',
      'labs', 'facilities', 'مختبر', 'مرافق',
      'established', 'founded', 'تأسست', 'تأسس',
      'overview', 'about', 'عن', 'نبذة',
      'tell', 'اخبرني', 'احكيلي', 'info', 'information', 'معلومات',
      'program', 'programs', 'programme', 'programmes', 'major', 'majors',
      'تخصص', 'تخصصات', 'التخصصات', 'برنامج', 'برامج', 'البرامج',
      'موجود', 'الموجودة', 'شو', 'ما'
    ])
  ) {
    return { name: 'faculty_info', params: { topic: 'general' } };
  }

  const recommendLike =
    includesAny(msg, [
      'recommend',
      'تنصحني',
      'انسب',
      'انسب لي',
      'fits me',
      'fit me',
      'right for me',
      'best major',
      'which major',
      'what major',
      'what engineering',
      'which engineering',
      'what can i join',
      'what can i study',
      'what can i enroll',
      'what are my options',
      'what options do i have',
      'what programmes can i',
      'what programs can i',
      'شو بقدر ادخل',
      'شو بقدر ادرس',
      'شو بتنصحني',
      'ادخل هندسة',
      'شو بتنصح', 'وش بتنصحني', 'نصيحة', 'ارشدني',
      'what fits', 'what suits', 'شو بناسبني', 'شو بيناسبني',
      'suggest', 'suggestion', 'advise', 'advice',
      'help me choose', 'help me pick', 'help me decide',
      'should i', 'should i study', 'what should i study',
      'what should i choose', 'should i choose', 'which should i choose',
      'what should i do', 'شو لازم اسوي', 'شو لازم اختار', 'شو لازم ادرس',
      'why should i', 'why this', 'why choose', 'why not',
      'ما هو الأفضل', 'شو الأفضل', 'ايش أنسب', 'أيهما أفضل', 'أفضل لي'
    ]) ||
    (includesAny(msg, ['competitive', 'تنافس', 'near threshold', 'قريب من العتبة']) &&
      (engCtx || includesAny(msg, ['engineering', 'هندسة'])));

  const avgWithContext =
    avgMatch &&
    (includesAny(msg, ['average', 'معدل', 'توجيهي', 'tawjihi']) ||
      includesAny(msg, ['engineering', 'هندسة', 'تخصص', 'برنامج', 'major', 'program']));

  if (engCtx && (recommendLike || avgWithContext || interestTerms.length)) {
    return {
      name: 'engineering_recommend',
      params: {
        average: avgMatch ? Number(avgMatch[1]) : null,
        stream,
        interestTerms
      }
    };
  }

  if (
    avgMatch &&
    includesAny(msg, ['average', 'معدل', 'توجيهي', 'tawjihi']) &&
    includesAny(msg, ['engineering', 'هندسة', 'major', 'program', 'تخصص', 'تخصصات', 'برنامج', 'برامج'])
  ) {
    return { name: 'engineering_recommend', params: { average: Number(avgMatch[1]), stream, interestTerms } };
  }

  if (
    includesAny(msg, ['what can i join', 'what can i study', 'شو بقدر ادخل', 'شو بقدر ادرس', 'شو بتنصحني']) &&
    includesAny(msg, ['engineering', 'هندسة'])
  ) {
    return { name: 'engineering_recommend', params: { average: avgMatch ? Number(avgMatch[1]) : null, stream, interestTerms } };
  }

  if (
    includesAny(msg, ['abet', 'accredited', 'accreditation', 'اعتماد', 'معتمد']) &&
    includesAny(msg, ['engineering', 'هندسة', 'program', 'برنامج', 'faculty', 'كلية'])
  ) {
    return { name: 'faculty_info', params: { topic: 'abet' } };
  }

  if (
    includesAny(msg, ['faculty', 'كلية', 'college']) &&
    includesAny(msg, [
      'department', 'departments', 'اقسام', 'أقسام', 'قسم',
      'student', 'students', 'طلاب', 'عدد',
      'labs', 'facilities', 'مختبر', 'مرافق',
      'established', 'founded', 'تأسست', 'تأسس',
      'overview', 'about', 'عن', 'نبذة',
      'tell', 'اخبرني', 'احكيلي', 'info', 'information', 'معلومات',
      'program', 'programs', 'programme', 'programmes', 'major', 'majors',
      'تخصص', 'تخصصات', 'التخصصات', 'برنامج', 'برامج', 'البرامج',
      'موجود', 'الموجودة', 'شو', 'ما'
    ])
  ) {
    return { name: 'faculty_info', params: { topic: 'general' } };
  }

  if (
    includesAny(msg, [
      'faculty of engineering',
      'كلية الهندسة',
      'faculty engineering',
      'faculty of pharmacy',
      'faculty of nursing',
      'faculty of science',
      'faculty of law',
      'faculty of medicine',
      'faculty of business',
      'faculty of fine arts'
    ]) &&
    !includesAny(msg, ['major', 'program', 'تخصص', 'برنامج'])
  ) {
    return { name: 'faculty_info', params: { topic: 'general' } };
  }

  if (
    includesAny(msg, [
      'university', 'الجامعة', 'جامعة', 'najah', 'النجاح', 'an-najah'
    ]) &&
    includesAny(msg, [
      'campus', 'campuses', 'حرم', 'أحرم',
      'vision', 'mission', 'رؤية', 'رسالة',
      'library', 'مكتبة', 'كتب', 'books',
      'faculties', 'كليات',
      'programs', 'برامج',
      'history', 'تاريخ', 'founded', 'تأسس', 'أسس',
      'overview', 'about', 'عن', 'نبذة',
      'facts', 'حقائق', 'معلومات',
      'how many', 'كم'
    ])
  ) {
    return { name: 'university_info', params: {} };
  }

  if (
    hasWord(msg, 'hi') ||
    hasWord(msg, 'hello') ||
    hasWord(msg, 'hey') ||
    includesAny(msg, [
      'good morning',
      'good evening',
      'مرحبا',
      'أهلا',
      'اهلا',
      'السلام عليكم',
      'سلام'
    ])
  ) {
    return { name: 'greet' };
  }

  if (
    msg === 'help' ||
    includesAny(msg, ['what can you do', 'commands', 'مساعدة', 'ساعدني', 'ايش تقدر تسوي', 'شو بتقدر تعمل'])
  ) {
    return { name: 'help' };
  }

  if (includesAny(msg, ['my name', 'who am i', 'اسمي', 'مين انا', 'من انا', 'ما اسمي'])) {
    return { name: 'whoami' };
  }

  if (includesAny(msg, ['notification', 'notifications', 'اشعار', 'اشعارات', 'الإشعارات', 'تنبيه', 'تنبيهات'])) {
    const unreadOnly = includesAny(msg, ['unread', 'new', 'غير مقروء', 'جديد', 'جديدة']);
    return { name: 'notifications', params: { unreadOnly } };
  }

  if (
    includesAny(msg, [
      'registration',
      'registrations',
      'registered',
      'my events',
      'تسجيل',
      'تسجيلاتي',
      'مسجل',
      'حجوزاتي'
    ])
  ) {
    return { name: 'registrations' };
  }

  if (
    includesAny(msg, ['count', 'how many', 'عدد', 'كم']) &&
    includesAny(msg, ['event', 'events', 'فعالية', 'فعاليات', 'حدث', 'احداث', 'أحداث'])
  ) {
    const status =
      msg.match(/\b(approved|pending|draft|rejected|needs_changes|upcoming|past)\b/)?.[1] ||
      (includesAny(msg, ['approved', 'مقبول', 'تمت الموافقة', 'موافق عليه']) ? 'approved' : null) ||
      (includesAny(msg, ['pending', 'قيد المراجعة', 'معلق']) ? 'pending' : null) ||
      (includesAny(msg, ['draft', 'مسودة']) ? 'draft' : null) ||
      (includesAny(msg, ['rejected', 'مرفوض']) ? 'rejected' : null) ||
      (includesAny(msg, ['past', 'سابقة']) ? 'past' : null) ||
      (includesAny(msg, ['upcoming', 'قادمة', 'قادم']) ? 'upcoming' : null);

    return { name: 'events_count', params: { status } };
  }

  if (includesAny(msg, ['event details', 'details event', 'تفاصيل فعالية', 'تفاصيل حدث', 'تفاصيل'])) {
    const eventId =
      pickQuotedOrAfterKeyword(userMessage, 'event details') ||
      pickQuotedOrAfterKeyword(userMessage, 'details event') ||
      pickQuotedOrAfterKeyword(userMessage, 'تفاصيل فعالية') ||
      pickQuotedOrAfterKeyword(userMessage, 'تفاصيل حدث') ||
      null;
    if (eventId) return { name: 'event_details', params: { eventId: eventId.trim() } };
  }

  if (hasWord(msg, 'event') || includesAny(msg, ['فعالية', 'حدث'])) {
    const tokens = msg.split(' ').filter(Boolean);
    if (tokens.length >= 2) {
      const maybeId = tokens.slice(1).join(' ').trim();
      if (/[a-z0-9]/i.test(maybeId) && maybeId.length <= 120) {
        return { name: 'event_details', params: { eventId: maybeId } };
      }
    }
  }

  if (includesAny(msg, ['search event', 'search events', 'ابحث', 'بحث', 'دور', 'ابحث عن فعالية', 'ابحث عن حدث'])) {
    const q =
      pickQuotedOrAfterKeyword(userMessage, 'search events') ||
      pickQuotedOrAfterKeyword(userMessage, 'search event') ||
      pickQuotedOrAfterKeyword(userMessage, 'ابحث عن فعالية') ||
      pickQuotedOrAfterKeyword(userMessage, 'ابحث عن حدث') ||
      pickQuotedOrAfterKeyword(userMessage, 'ابحث') ||
      pickQuotedOrAfterKeyword(userMessage, 'بحث') ||
      null;
    return { name: 'events_search', params: { q: q?.trim() || null } };
  }

  if (
    includesAny(msg, [
      'list events',
      'next events',
      'events',
      'اعرض الفعاليات',
      'فعاليات',
      'الاحداث',
      'أحداث',
      'الفعاليات القادمة'
    ])
  ) {
    return { name: 'events_list' };
  }

  if (includesAny(msg, ['community', 'communities', 'مجتمع', 'مجتمعات', 'الاندية', 'النوادي', 'نادي'])) {
    const q =
      pickQuotedOrAfterKeyword(userMessage, 'search communities') ||
      pickQuotedOrAfterKeyword(userMessage, 'search community') ||
      pickQuotedOrAfterKeyword(userMessage, 'ابحث عن مجتمع') ||
      pickQuotedOrAfterKeyword(userMessage, 'ابحث عن نادي') ||
      pickQuotedOrAfterKeyword(userMessage, 'ابحث') ||
      null;

    if (includesAny(msg, ['search', 'ابحث', 'بحث', 'دور']) && q) {
      return { name: 'communities_search', params: { q: q.trim() } };
    }
    return { name: 'communities_list' };
  }

  if (
    includesAny(msg, [
      'wrong', 'incorrect', 'not right', 'false', 'mistake', 'error',
      'خطأ', 'غلط', 'مش صح', 'مو صحيح', 'مو دقيق',
      'correct is', 'right is', 'should be', 'actually', 'in fact',
      'الصحيح هو', 'الدقيق هو', 'يجب ان يكون', 'في الواقع',
      'explain more', 'more details', 'details', 'elaborate', 'tell me more',
      'اشرح أكثر', 'تفاصيل أكثر', 'تفاصيل', 'وضح', 'احكي أكثر'
    ])
  ) {
    return { name: 'feedback_correction', params: { message: userMessage } };
  }

  return { name: 'unknown' };
}
