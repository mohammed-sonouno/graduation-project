export function normalizeText(s) {
  return stripDiacritics(toLatinDigits(String(s || '')))
    .toLowerCase()
    .replace(/[،؛؟]/g, ' ')
    .replace(/[^\p{L}\p{N}\s"'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toLatinDigits(s) {
  // Arabic-Indic digits → Latin digits (helps parsing counts/ids in Arabic messages)
  return String(s || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function stripDiacritics(s) {
  // Removes Arabic/Latin diacritics in a cheap way (good enough for intent matching)
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u064B-\u065F\u0670]/g, ''); // Arabic harakat
}

export function pickQuotedOrAfterKeyword(message, keyword) {
  // Examples:
  // - event "Software" -> Software
  // - search events software -> software
  const m = String(message || '');
  const q = m.match(/"([^"]+)"/);
  if (q?.[1]) return q[1].trim();

  const idx = normalizeText(m).indexOf(keyword);
  if (idx === -1) return null;
  const after = m.slice(idx + keyword.length).trim();
  if (!after) return null;
  return after;
}

export function includesAny(haystack, needles) {
  const h = normalizeText(haystack);
  return needles.some((n) => h.includes(normalizeText(n)));
}

/** @returns {[string, string]|null} trimmed sides for programme comparison */
export function extractComparisonPair(message) {
  const m = String(message || '').trim();
  if (!m) return null;
  const patterns = [
    /(?:الفرق|فرق)\s+بين\s+(.+?)\s+و\s+(.+)/i,
    /(?:قارن|قارني)\s+بين\s+(.+?)\s+و\s+(.+)/i,
    /difference\s+between\s+(.+?)\s+and\s+(.+)/i,
    /compare\s+(.+?)\s+(?:to|with|and|versus)\s+(.+)/i,
    /(.+?)\s+or\s+(.+?)[\s,?]*(?:which|what)\s/i,
    /(?:which\s+is\s+better)\s*[,:]?\s*(.+?)\s+or\s+(.+)/i,
    /(.+?)\s+vs\.?\s+(.+)/i
  ];
  for (const re of patterns) {
    const x = m.match(re);
    if (x?.[1] && x?.[2]) {
      const a = x[1].trim().replace(/^["']|["']$/g, '').slice(0, 120);
      const b = x[2].trim().replace(/^["']|["']$/g, '').slice(0, 120);
      if (a.length >= 2 && b.length >= 2 && a.toLowerCase() !== b.toLowerCase()) return [a, b];
    }
  }
  return null;
}

/** Terms used only to filter DB `keywords` / names — not factual claims. */
export function extractInterestTermsFromMessage(userMessage) {
  const msg = normalizeText(userMessage);
  const terms = [];
  if (includesAny(msg, ['programming', 'software', 'code', 'coding', 'developer', 'computer science', 'computing', 'it', 'information technology', 'web development', 'app development', 'ai', 'artificial intelligence', 'machine learning', 'data science'])) {
    terms.push('programming', 'software', 'computer science');
  }
  if (includesAny(msg, ['برمجة', 'برامج', 'حاسوب', 'علوم الحاسوب', 'تكنولوجيا المعلومات', 'تطوير الويب', 'تطوير التطبيقات', 'ذكاء اصطناعي', 'تعلم الآلة', 'علم البيانات'])) {
    terms.push('برمجة', 'علوم الحاسوب');
  }
  if (includesAny(msg, ['math', 'mathematics', 'algebra', 'calculus', 'statistics', 'probability', 'discrete math', 'linear algebra'])) {
    terms.push('math', 'mathematics', 'statistics');
  }
  if (includesAny(msg, ['رياضيات', 'ریاضیات', 'حساب', 'إحصاء', 'احتمالات', 'رياضيات متقطعة', 'جبر خطي'])) {
    terms.push('رياضيات', 'إحصاء');
  }
  if (includesAny(msg, ['civil', 'مدني', 'أشغال', 'إنشاءات', 'structures', 'geotechnical', 'transportation', 'environmental'])) {
    terms.push('civil', 'structures');
  }
  if (includesAny(msg, ['electrical', 'كهرباء', 'كهربائي', 'إلكترونيات', 'power systems', 'control systems', 'telecommunications'])) {
    terms.push('electrical', 'electronics');
  }
  if (includesAny(msg, ['mechanical', 'ميكانيك', 'هندسة ميكانيكية', 'ماكينات', 'thermodynamics', 'fluid mechanics', 'heat transfer', 'design'])) {
    terms.push('mechanical', 'design');
  }
  if (includesAny(msg, ['health', 'medical', 'biomedical', 'biology', 'biotechnology', 'طب', 'صحة', 'بيولوجيا', 'علاج', 'genetics', 'pharmacology'])) {
    terms.push('health', 'biomedical');
  }
  if (includesAny(msg, ['business', 'management', 'finance', 'economics', 'تجارة', 'اقتصاد', 'إدارة', 'محاسبة', 'marketing', 'entrepreneurship'])) {
    terms.push('business', 'management');
  }
  if (includesAny(msg, ['architecture', 'تصميم', 'عمارة', 'أبنية', 'معمار', 'urban planning', 'interior design'])) {
    terms.push('architecture', 'design');
  }
  if (includesAny(msg, ['chemical', 'كيمياء', 'كيميائي', 'petroleum', 'materials science', 'nanotechnology'])) {
    terms.push('chemical', 'materials');
  }
  if (includesAny(msg, ['aerospace', 'طيران', 'فضاء', 'aviation', 'astronautics'])) {
    terms.push('aerospace');
  }
  if (includesAny(msg, ['industrial', 'صناعي', 'manufacturing', 'quality control', 'operations'])) {
    terms.push('industrial');
  }
  if (includesAny(msg, ['environmental', 'بيئي', 'sustainability', 'renewable energy', 'ecology'])) {
    terms.push('environmental');
  }
  if (includesAny(msg, ['physics', 'فيزياء', 'quantum', 'nuclear', 'optics'])) {
    terms.push('physics');
  }
  if (includesAny(msg, ['chemistry', 'كيمياء', 'organic', 'inorganic', 'analytical'])) {
    terms.push('chemistry');
  }
  return [...new Set(terms)];
}

/** Detects if the question seems complex/advanced based on keywords and structure */
export function detectQuestionComplexity(userMessage) {
  const msg = normalizeText(userMessage);
  const advancedTerms = [
    'advanced', 'complex', 'detailed', 'in-depth', 'technical', 'specific', 'exact', 'precise',
    'how does', 'why does', 'explain', 'elaborate', 'break down', 'step by step',
    'متقدم', 'معقد', 'تفصيلي', 'في العمق', 'تقني', 'محدد', 'دقيق',
    'كيف يعمل', 'ليش يعمل', 'اشرح', 'وضح', 'حلل', 'خطوة بخطوة'
  ];
  const simpleTerms = [
    'what is', 'what are', 'is it', 'do i', 'can i', 'simple', 'basic', 'easy',
    'شو هو', 'شو هي', 'هل هو', 'هل هي', 'بقدر', 'أقدر', 'بسيط', 'أساسي', 'سهل'
  ];
  const questionWords = ['how', 'why', 'what', 'when', 'where', 'which', 'who', 'كيف', 'ليش', 'شو', 'متى', 'وين', 'ايش', 'مين'];
  const questionCount = questionWords.filter(word => includesAny(msg, [word])).length;
  const hasAdvanced = includesAny(msg, advancedTerms);
  const hasSimple = includesAny(msg, simpleTerms);
  const length = msg.split(' ').length;

  if (hasAdvanced || questionCount > 1 || length > 20) return 'complex';
  if (hasSimple || questionCount === 1) return 'simple';
  return 'medium';
}

export function isEngineeringCatalogContext(msgNormalized, memory, majorPage = null) {
  const tawjihiStyle =
    includesAny(msgNormalized, ['معدل', 'توجيهي', 'tawjihi', 'average']) &&
    (includesAny(msgNormalized, ['علمي', 'صناعي', 'scientific', 'industrial']) ||
      includesAny(msgNormalized, ['بقدر', 'ادخل', 'ادرس', 'شو بقدر']));
  return (
    tawjihiStyle ||
    includesAny(msgNormalized, ['engineering', 'هندسة', 'هندسي', 'برنامج هندسي']) ||
    memory?.lastPlanType === 'ENGINEERING_RECOMMEND' ||
    memory?.lastPlanType === 'ENGINEERING_COMPARE' ||
    memory?.lastPlanType === 'ENGINEERING_FOLLOWUP_RANK' ||
    memory?.lastPlanType === 'ENGINEERING_ACCEPTANCE_QUERY' ||
    (memory?.lastAverage != null && memory?.lastSafeProgramKeys?.length) ||
    majorPage?.category === 'engineering'
  );
}

