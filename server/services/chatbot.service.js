import { manualKnowledgeBase } from '../chatbot/manualKnowledgeBase.js';
import { getSessionMessages, appendSessionTurn } from '../chatbot/sessionStore.js';
import { pool } from '../db/pool.js';

export { clearSession } from '../chatbot/sessionStore.js';

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

const GROQ_MODELS = [
  process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
];
const GROQ_TIMEOUT_MS = Math.max(1000, Number.parseInt(String(process.env.GROQ_TIMEOUT_MS || '30000'), 10) || 30000);
const getGroqKey = () => process.env.GROQ_API_KEY || '';

// ---------------------------------------------------------------------------
// IN-MEMORY CACHE
// ---------------------------------------------------------------------------

/** @type {Map<string, { data: any, expires: number }>} */
const _cache = new Map();

/**
 * @template T
 * @param {string} key
 * @param {number} ttlMs
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
function cached(key, ttlMs, fn) {
  const hit = _cache.get(key);
  if (hit && Date.now() < hit.expires) return Promise.resolve(hit.data);
  return fn().then(data => {
    _cache.set(key, { data, expires: Date.now() + ttlMs });
    return data;
  });
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const ARABIC_SCRIPT_RE = /[؀-ۿ]/;

function hasArabic(text = '') {
  return ARABIC_SCRIPT_RE.test(String(text));
}

// ---------------------------------------------------------------------------
// TEXT NORMALIZATION
// ---------------------------------------------------------------------------

function normalizeArabicText(text = '') {
  return String(text)
    .normalize('NFKC')
    .replace(/3/g, 'ع').replace(/7/g, 'ح').replace(/2/g, 'أ')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/ـ/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEnglishText(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palestinian/Levantine dialect → MSA */
const DIALECT_MAP = {
  'بدي':'أريد','بدك':'تريد','بده':'يريد','بدها':'تريد','بدنا':'نريد','بدهم':'يريدون',
  'وين':'أين','منين':'من أين','ليش':'لماذا','شو':'ماذا','شوو':'ماذا',
  'هلق':'الآن','هلأ':'الآن','كتير':'كثير','كتيرة':'كثيرة',
  'هون':'هنا','منيح':'جيد','مو':'ليس','قديش':'كم','اشي':'شيء',
  'يلا':'هيا','خلص':'انتهى',
};
const DIALECT_REPLACEMENTS = Object.entries(DIALECT_MAP).map(([from, to]) => ({
  re: new RegExp(from, 'g'), to,
}));

function normalizeDialect(text = '') {
  let result = String(text);
  for (const { re, to } of DIALECT_REPLACEMENTS) result = result.replace(re, to);
  return result;
}

// ---------------------------------------------------------------------------
// MAJOR CONTEXT PARSER
// ---------------------------------------------------------------------------

function parseMajorContextInline(majorName, majorFacultyRaw = '') {
  const raw = String(majorFacultyRaw || '');
  const parsed = {
    majorName: majorName || '', faculty: '', creditHours: '', duration: '',
    majorType: '', minAdmission: '', notes: '', courses: [],
  };
  if (!raw) return parsed;
  const parts = raw.split(' | ').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const idx = part.indexOf(':');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (key === 'major') parsed.majorName = value || parsed.majorName;
    else if (key === 'faculty') parsed.faculty = value;
    else if (key === 'credit hours') parsed.creditHours = value;
    else if (key === 'duration') parsed.duration = value;
    else if (key === 'major type') parsed.majorType = value;
    else if (key === 'minimum admission average') parsed.minAdmission = value;
    else if (key === 'notes') parsed.notes = value;
    else if (key === 'courses' && value) {
      parsed.courses = value
        .split(' ; ').map((c) => c.trim()).filter(Boolean)
        .map((line) => {
          const m = line.match(/^(.+?)\s-\s(.+?)\s\((.+?)\)$/);
          if (!m) return { raw: line, code: '', title: line, creditHours: '' };
          return { raw: line, code: m[1], title: m[2], creditHours: m[3] };
        });
    }
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// LOCAL RULE-BASED FALLBACK
// ---------------------------------------------------------------------------

function buildLocalChatResponse({ userMessage, majorName, majorFaculty }) {
  const q = String(userMessage || '').trim();
  const qLower = normalizeEnglishText(q);
  const qAr = normalizeArabicText(q);
  const arabic = hasArabic(q);
  const ctx = parseMajorContextInline(majorName, majorFaculty);
  const majorLabel = ctx.majorName || majorName || (arabic ? 'هذا التخصص' : 'this major');

  const hasAny = (...tokens) => tokens.some((t) => qLower.includes(normalizeEnglishText(t)));
  const hasAnyAr = (...tokens) => tokens.some((t) => qAr.includes(normalizeArabicText(t)));
  const scoreIntent = (en = [], ar = []) => {
    let s = 0;
    for (const t of en) if (qLower.includes(normalizeEnglishText(t))) s++;
    for (const t of ar) if (qAr.includes(normalizeArabicText(t))) s++;
    return s;
  };

  const isThanks =
    hasAny('thanks', 'thank you', 'thx', 'ty', 'appreciate') ||
    hasAnyAr('شكرا', 'شكراً', 'مشكور', 'يعطيك العافية', 'تسلم', 'الله يسلمك', 'يزاك الله');
  if (isThanks) return arabic ? 'أيه والله 😊 إشي ثاني؟' : "You're welcome! Anything else?";

  const isGreeting =
    hasAny('hello', 'hi', 'hey', 'yo', 'sup', 'good morning', 'good evening', 'good afternoon') ||
    hasAnyAr('مرحبا', 'اهلا', 'أهلا', 'هلا', 'هلو', 'هاي', 'سلام', 'صباح الخير', 'مساء الخير', 'كيفك', 'كيف حالك');

  const intents = {
    courses: scoreIntent(
      ['course', 'courses', 'subject', 'subjects', 'syllabus', 'modules', 'study plan', 'plan'],
      ['مواد', 'مساقات', 'مقررات', 'الخطة', 'الخطة الدراسية', 'مواد التخصص', 'شو المواد', 'المواد']
    ),
    credits: scoreIntent(['credit', 'credits', 'credit hour', 'hours'], ['ساعات', 'عدد الساعات', 'كم ساعة', 'قديش ساعة', 'الساعات']),
    duration: scoreIntent(['duration', 'years', 'how long'], ['مدة', 'سنوات', 'كم سنة', 'قديش سنة', 'المدة']),
    admission: scoreIntent(['admission', 'minimum', 'gpa', 'average', 'requirement'], ['معدل', 'قبول', 'الحد الادني', 'الحد الادنى', 'الحد الأدنى', 'شروط القبول']),
    faculty: scoreIntent(['faculty', 'college'], ['كلية', 'الكليه', 'الكلية']),
    careers: scoreIntent(['career', 'careers', 'job', 'jobs', 'future'], ['وظيفة', 'وظائف', 'شغل', 'مستقبل', 'سوق العمل', 'بعد التخرج']),
    type: scoreIntent(
      ['major type', 'academic track', 'what track', 'stream'],
      ['نوع التخصص', 'المؤهل العلمي', 'مسار التخصص', 'علمي ولا ادبي', 'شو نوع التخصص', 'مسار']
    ),
    explain: scoreIntent(['tell me', 'explain', 'details', 'overview', 'about'], ['احكي', 'احكيلي', 'اشرح', 'اشرحلي', 'فهمني', 'تفاصيل', 'معلومات', 'نبذه', 'نبذة']),
  };
  const [topIntentName, topIntentScore] = Object.entries(intents).sort((a, b) => b[1] - a[1])[0] ?? ['', 0];

  if (isGreeting) {
    const hasMajor = Boolean(majorName && String(majorName).trim());
    return arabic
      ? hasMajor
        ? `أهلاً! 😊 كيف أساعدك في ${majorLabel}؟ بتقدر تسألني عن المواد، الساعات، مدة الدراسة، أو فرص العمل.`
        : 'أهلاً! 😊 أنا مساعد جامعة النجاح. بتقدر تسألني عن الفعاليات، المجتمعات، التخصصات، أو أي إشي متعلق بالمنصة.'
      : hasMajor
        ? `Hey! 😊 Ask me anything about ${majorLabel} — courses, credit hours, career paths, you name it.`
        : "Hey! 😊 I'm the Najah University assistant. Ask me about events, communities, majors, or anything on the platform.";
  }

  if (topIntentName === 'courses' && topIntentScore > 0) {
    if (ctx.courses.length === 0) {
      return arabic
        ? `حالياً ما عندي قائمة مواد مفصلة لـ ${majorLabel}.\nبس بقدر أساعدك بمعدل القبول، عدد الساعات، ومدة الدراسة.`
        : `I don't have a detailed course list for ${majorLabel} right now.\nI can help with admission average, credit hours, and duration.`;
    }
    const classify = (title = '') => {
      const tAr = normalizeArabicText(title); const tEn = normalizeEnglishText(title);
      if (['برمجة','قواعد بيانات','شبكات','ذكاء','حاسوب','نظم معلومات','امن المعلومات','خوارزميات'].some(k=>tAr.includes(k)) ||
          ['program','database','network','software','information system','computer','cyber','algorithm'].some(k=>tEn.includes(k)))
        return arabic ? 'مواد تقنية' : 'Technical';
      if (['ادارة','إدارة','محاسبة','مالية','اقتصاد','تسويق','اعمال','أعمال'].some(k=>tAr.includes(normalizeArabicText(k))) ||
          ['management','accounting','finance','economics','marketing','business'].some(k=>tEn.includes(k)))
        return arabic ? 'مواد أعمال' : 'Business';
      return arabic ? 'مواد عامة' : 'General';
    };
    const grouped = {};
    for (const c of ctx.courses) {
      const cat = classify(c.title);
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(c);
    }
    const groupsText = Object.entries(grouped).map(([cat, items]) => {
      const lines = items.map(c => `- ${c.title || '—'} (${(c.creditHours||'—').replace(/\s*cr$/i,'').trim()}${arabic?' ساعة':' cr'})`).join('\n');
      return `**${cat}:**\n${lines}`;
    }).join('\n\n');
    return arabic
      ? `مواد ${majorLabel}:\n\n${groupsText}\n\nالمجموع: ${ctx.creditHours||'—'} ساعة خلال ${ctx.duration||'—'}.`
      : `${majorLabel} courses:\n\n${groupsText}\n\nTotal: ${ctx.creditHours||'—'} credit hours over ${ctx.duration||'—'}.`;
  }
  if (topIntentName === 'credits' && topIntentScore > 0 && ctx.creditHours)
    return arabic ? `عدد الساعات المعتمدة في ${majorLabel} هو ${ctx.creditHours} ساعة.` : `${majorLabel} requires ${ctx.creditHours} credit hours.`;
  if (topIntentName === 'duration' && topIntentScore > 0 && ctx.duration)
    return arabic ? `مدة دراسة ${majorLabel} هي ${ctx.duration}.` : `The study duration for ${majorLabel} is ${ctx.duration}.`;
  if (topIntentName === 'admission' && topIntentScore > 0 && ctx.minAdmission)
    return arabic ? `الحد الأدنى للقبول في ${majorLabel} هو ${ctx.minAdmission}.` : `Minimum admission average for ${majorLabel} is ${ctx.minAdmission}.`;
  if (topIntentName === 'faculty' && topIntentScore > 0 && ctx.faculty)
    return arabic ? `${majorLabel} يتبع إلى ${ctx.faculty}.` : `${majorLabel} belongs to ${ctx.faculty}.`;
  if (topIntentName === 'type' && topIntentScore > 0 && ctx.majorType)
    return arabic ? `نوع المسار الأكاديمي لـ ${majorLabel}: ${ctx.majorType}.` : `Academic track for ${majorLabel}: ${ctx.majorType}.`;
  if (topIntentName === 'type' && topIntentScore > 0 && !ctx.majorType)
    return arabic ? `ما عندي تصنيف المسار الأكاديمي لـ ${majorLabel} حالياً.` : `I don't have the academic track info for ${majorLabel}.`;
  if (topIntentName === 'careers' && topIntentScore > 0)
    return arabic
      ? `بشكل عام خريج ${majorLabel} بتلاقيه يشتغل بأماكن كتير في القطاعين العام والخاص، أو يكمل دراسات عليا.\nإذا بدك أمثلة أدق، قلّي ميولك.`
      : `${majorLabel} graduates pursue varied paths across public and private sectors, or continue to graduate studies.\nTell me your interests for a more specific list.`;
  if (topIntentName === 'explain' && topIntentScore > 0) {
    const tm = ctx.majorType ? `، نوع المسار: ${ctx.majorType}` : '';
    return arabic
      ? `${majorLabel} في ${ctx.faculty||'الكلية'}${tm}، مدته ${ctx.duration||'—'}، وعدد ساعاته ${ctx.creditHours||'—'}، والحد الأدنى للقبول ${ctx.minAdmission||'—'}.\nاسألني مباشرة: "شو المواد؟" أو "قديش الساعات؟" أو "شو فرص العمل؟".`
      : `${majorLabel} in ${ctx.faculty||'its faculty'}${ctx.majorType?`, track: ${ctx.majorType}`:''}, duration ${ctx.duration||'—'}, ${ctx.creditHours||'—'} credits, min admission ${ctx.minAdmission||'—'}.\nAsk directly: "what courses?" or "how many credits?" or "what careers?"`;
  }

  const hasMajorFallback = Boolean(majorName && String(majorName).trim());
  return arabic
    ? hasMajorFallback
      ? `تفضل! اسألني عن ${majorLabel} — المواد، الساعات، المسار الأكاديمي، أو فرص العمل.`
      : 'تفضل! اسألني عن الفعاليات، المجتمعات، التخصصات، أو أي إشي ثاني متعلق بالمنصة.'
    : hasMajorFallback
      ? `Go ahead! Ask me about ${majorLabel} — courses, credit hours, academic track, or career paths.`
      : 'Go ahead! Ask me about events, communities, majors, or anything else on the platform.';
}

// ---------------------------------------------------------------------------
// KEYWORD EXTRACTION
// ---------------------------------------------------------------------------

function extractKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  return text.normalize('NFKC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t && t.length >= 2)
    .filter((t, i, a) => a.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i);
}

// ---------------------------------------------------------------------------
// DB CONTEXT BUILDERS
// ---------------------------------------------------------------------------

async function _getEventContext() {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, start_date AS date, location
       FROM events
       ORDER BY ABS(EXTRACT(EPOCH FROM (start_date::timestamptz - NOW()))) ASC
       LIMIT 30`
    );
    if (rows.length === 0) return '[Database: no events found.]\n';

    const now = new Date();
    const upcoming = rows
      .filter(e => e.date && new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const past = rows
      .filter(e => !e.date || new Date(e.date) < now)
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // most recent first

    const fmt = d => d ? new Date(d).toISOString().slice(0, 10) : '—';

    const nearest = upcoming.length > 0 ? upcoming[0] : (past.length > 0 ? past[0] : null);

    let out = 'University events:\n\n';
    if (nearest) {
      const label = upcoming.length > 0 ? 'NEXT UPCOMING EVENT' : 'MOST RECENT PAST EVENT';
      out += `${label}: "${nearest.title}" | date: ${fmt(nearest.date)} | location: ${nearest.location ?? '—'}\n\n`;
    }

    if (upcoming.length > 0) {
      out += `All upcoming events (${upcoming.length}):\n`;
      out += upcoming.map(e => `- [UPCOMING] ${e.title} | ${fmt(e.date)} | ${e.location ?? '—'}`).join('\n');
    } else {
      out += 'No future events scheduled currently.\n';
    }
    if (past.length > 0) {
      out += `\n\nRecent past events (${Math.min(past.length, 10)} shown):\n`;
      out += past.slice(0, 10).map(e => `- [PAST] ${e.title} | ${fmt(e.date)} | ${e.location ?? '—'}`).join('\n');
    }
    return out + '\n';
  } catch (err) {
    console.error('[getEventContext] error:', err?.message || err);
    return `[getEventContext failed: ${err?.message || err}]\n`;
  }
}

export const getEventContext = () => cached('events', 2 * 60_000, _getEventContext);

export async function getEventDetailsContext() { return ''; }

export async function getEventAnalyticsContext() {
  try {
    const { rows } = await pool.query(
      `SELECT e.title,
              COUNT(r.id)::int AS review_count,
              ROUND(AVG(r.rating)::numeric, 2) AS avg_rating,
              COUNT(CASE WHEN COALESCE(r.override_sentiment, r.sentiment) = 'positive' THEN 1 END)::int AS pos,
              COUNT(CASE WHEN COALESCE(r.override_sentiment, r.sentiment) = 'neutral'  THEN 1 END)::int AS neu,
              COUNT(CASE WHEN COALESCE(r.override_sentiment, r.sentiment) = 'negative' THEN 1 END)::int AS neg
       FROM events e
       LEFT JOIN event_reviews r ON r.event_id = e.id
       GROUP BY e.id, e.title ORDER BY e.title ASC`
    );
    if (rows.length === 0) return '[Database: no events for analytics.]\n';
    const lines = rows.map((ev) => {
      if (ev.review_count === 0) return `- ${ev.title}: no reviews yet`;
      const pct = ((ev.pos / ev.review_count) * 100).toFixed(1);
      return `- ${ev.title}: ${ev.review_count} reviews | avg ${ev.avg_rating}/5 | +${ev.pos}/~${ev.neu}/-${ev.neg} | positive ${pct}%`;
    });
    return `Event analytics:\n${lines.join('\n')}\n`;
  } catch (err) {
    console.error('[getEventAnalyticsContext] error:', err?.message || err);
    return `[getEventAnalyticsContext failed: ${err?.message || err}]\n`;
  }
}

async function _getCommunitiesContext() {
  try {
    const { rows } = await pool.query(
      `SELECT c.name, c.description, c.colleges, c.chat_enabled,
              COUNT(cm.user_id)::int AS member_count
       FROM communities c
       LEFT JOIN community_members cm ON cm.community_id = c.id
       GROUP BY c.id, c.name, c.description, c.colleges, c.chat_enabled
       ORDER BY c.name ASC LIMIT 60`
    );
    if (rows.length === 0) return '[Database: no communities found.]\n';
    const lines = rows.map((c) => {
      const colleges = Array.isArray(c.colleges) && c.colleges.length > 0 ? c.colleges.join(', ') : 'open to all';
      const desc = c.description ? ` — ${String(c.description).slice(0, 100)}` : '';
      return `- ${c.name} | members: ${c.member_count} | colleges: ${colleges}${desc}`;
    });
    return `Student communities:\n${lines.join('\n')}\n`;
  } catch (err) {
    console.error('[getCommunitiesContext] error:', err?.message || err);
    return `[getCommunitiesContext failed: ${err?.message || err}]\n`;
  }
}

export const getCommunitiesContext = () => cached('communities', 5 * 60_000, _getCommunitiesContext);

export async function getReviewSearchContext(userMessage) {
  try {
    const kws = extractKeywords(userMessage).slice(0, 5);
    if (kws.length === 0) return '';
    const conditions = kws.map((k, i) => `r.comment ILIKE $${i + 1}`).join(' OR ');
    const { rows } = await pool.query(
      `SELECT e.title, r.rating, r.comment, COALESCE(r.override_sentiment, r.sentiment) AS sentiment
       FROM event_reviews r JOIN events e ON e.id = r.event_id
       WHERE ${conditions} ORDER BY r.created_at DESC LIMIT 5`,
      kws.map(k => `%${k}%`)
    );
    if (rows.length === 0) return '';
    return `Related reviews:\n${rows.map(r => `- "${r.title}" | ${r.rating}/5 | ${r.sentiment} | ${(r.comment||'').slice(0,200).replace(/\s+/g,' ')}`).join('\n')}\n`;
  } catch (err) {
    console.error('[getReviewSearchContext] error:', err?.message || err);
    return '';
  }
}

function getStaticCourseContext(majorName) {
  if (!majorName) return '';
  const name = majorName.toLowerCase();
  const courseMap = {
    'management information systems': 'MIS: 124 credit hours, 4 years. Accepts scientific, literary, and business streams. Combines IT and business management.',
    'computer science': 'CS: 132 credit hours, 4 years. Programming, algorithms, OS, AI, databases, networks.',
    'civil engineering': 'Civil Engineering: 162 credit hours, 5 years. Structures, geotechnics, construction management.',
    'business administration': 'Business Admin: 132 credit hours, 4 years. Management, marketing, accounting, finance.',
  };
  for (const [key, value] of Object.entries(courseMap)) {
    if (name.includes(key) || key.includes(name.split(' ')[0].toLowerCase())) return value;
  }
  return `For detailed courses in ${majorName}, check the university website or contact the faculty.`;
}

export async function getMajorContext(majorName) {
  try {
    if (!majorName || !majorName.trim()) return '';
    const { rows } = await pool.query(
      `SELECT name, faculty_name, major_type, credit_hours, duration, min_admission, notes
       FROM majors WHERE name ILIKE $1 LIMIT 1`,
      [`%${majorName.trim()}%`]
    );
    if (rows.length === 0) return '';
    const m = rows[0];
    return `Major: ${m.name} | Faculty: ${m.faculty_name} | Type: ${m.major_type||'—'} | Credits: ${m.credit_hours} | Duration: ${m.duration} | Min admission: ${m.min_admission} | ${getStaticCourseContext(majorName)}\n`;
  } catch (err) {
    console.error('[getMajorContext] error:', err?.message || err);
    return '';
  }
}

async function _getAllMajorsContext() {
  try {
    const { rows } = await pool.query(
      `SELECT name, faculty_name, credit_hours, duration, min_admission, major_type
       FROM majors ORDER BY faculty_name ASC, name ASC`
    );
    if (rows.length === 0) return '[Database: no majors found.]\n';
    const grouped = {};
    for (const m of rows) {
      if (!grouped[m.faculty_name]) grouped[m.faculty_name] = [];
      const t = m.major_type ? ` | ${m.major_type}` : '';
      grouped[m.faculty_name].push(`  - ${m.name} | ${m.duration} | ${m.credit_hours}cr | min: ${m.min_admission}${t}`);
    }
    return `University majors by faculty:\n\n${Object.entries(grouped).map(([f, items]) => `${f}:\n${items.join('\n')}`).join('\n\n')}\n`;
  } catch (err) {
    console.error('[getAllMajorsContext] error:', err?.message || err);
    return `[getAllMajorsContext failed: ${err?.message || err}]\n`;
  }
}

export const getAllMajorsContext = () => cached('allMajors', 10 * 60_000, _getAllMajorsContext);

// ---------------------------------------------------------------------------
// GROUNDING HELPERS
// ---------------------------------------------------------------------------

function sanitizeGrounding(text) {
  if (!text || typeof text !== 'string') return text;
  return text.split('\n').filter(line => {
    if (/\b1\d{7}\b/.test(line)) return false;
    if (/^\s*\d+\s*$/.test(line)) return false;
    return true;
  }).join('\n');
}

/**
 * Trims grounding to character budget: first 70% + last 30%.
 * @param {string} text
 * @param {number} [maxChars=14000]
 */
function trimToTokenBudget(text, maxChars = 14000) {
  if (!text || text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.7);
  const tail = maxChars - head;
  return text.slice(0, head) + '\n\n[...محتوى محذوف...]\n\n' + text.slice(-tail);
}

/**
 * Tag-scored KB section: picks the most relevant entries for the query.
 * @param {string} [userMessage='']
 */
function buildKnowledgeBaseSection(userMessage = '') {
  if (!userMessage) {
    return `Platform knowledge base:\n\n${manualKnowledgeBase.map(e => `### ${e.title}\n${e.body}`).join('\n\n')}\n`;
  }
  const normalized = normalizeDialect(userMessage);
  const q = normalizeEnglishText(normalized) + ' ' + normalizeArabicText(normalized);
  const en = normalizeEnglishText(normalized);
  const ar = normalizeArabicText(normalized);

  const isMISQuery =
    en.includes('mis') ||
    en.includes('management information') ||
    en.includes('information systems') ||
    ar.includes(normalizeArabicText('نظم المعلومات')) ||
    /10676\d{3}/.test(userMessage);

  const scored = manualKnowledgeBase.map(entry => {
    let score = entry.tags.filter(t => q.includes(t.toLowerCase())).length;
    if (isMISQuery && entry.tags.includes('mis')) score += 5;
    return { entry, score };
  }).sort((a, b) => b.score - a.score);

  const topScore = scored[0]?.score ?? 0;
  const limit = isMISQuery ? 5 : 4;
  // When topScore=0 (no tag match — typical for Arabic messages) exclude the large MIS-courses
  // entry to prevent context bloat; it will be included when explicitly matched.
  const selected = topScore > 0
    ? scored.slice(0, limit)
    : scored.filter(({ entry }) => entry.id !== 'mis-courses').slice(0, 6);
  return `Platform knowledge base:\n\n${selected.map(({ entry }) => `### ${entry.title}\n${entry.body}`).join('\n\n')}\n`;
}

// ---------------------------------------------------------------------------
// TOPIC DETECTION
// ---------------------------------------------------------------------------

function detectTopics(msg) {
  const ar = normalizeArabicText(msg);
  const en = normalizeEnglishText(msg);
  const hasAr = (...words) => words.some((w) => ar.includes(normalizeArabicText(w)));
  const hasEn = (...words) => words.some((w) => en.includes(w));
  return {
    events: hasAr(
      'فعالية','فعاليات','حدث','احداث','نشاط','نشاطات','ايفنت',
      'تقييم','مراجعة','تقييمات','حفله','حفلة','محاضرة','ورشة','ورش',
      'مسابقة','رحله','رحلة','قادم','قادمة','جاي','القادم',
    ) || hasEn('event', 'events', 'activity', 'activities', 'review', 'rating', 'workshop', 'lecture', 'upcoming', 'next event'),
    communities: hasAr(
      'مجتمع','مجتمعات','كلوب','نادي','مجموعة','انضم','عضوية',
      'جروب','جروبات','تجمع','فريق','نوادي','اشترك','انضمام',
    ) || hasEn('community', 'communities', 'club', 'group', 'join', 'member', 'team'),
    majors: hasAr(
      'تخصص','تخصصات','كلية','كليات','مادة','مواد','ساعات',
      'قبول','معدل','دراسة','برنامج','خطة','مسار','درجة','بكالوريوس',
      'هندسة','طب','حاسوب','ادارة','اعمال','محاسبة','قانون',
      'تمريض','صيدلة','اختصاص','شعبة','فرع','قسم',
      'نظم المعلومات','نظم المعلومات الإدارية',
    ) || hasEn('major', 'faculty', 'course', 'credit', 'admission', 'degree', 'program', 'study',
               'department', 'engineering', 'medicine', 'management information', 'information systems',
               'mis major', 'mis courses', 'mis credits') ||
      en.includes('mis') ||
      msg.includes('10676'),
    platform: hasAr(
      'موقع','منصة','نظام','حساب','تسجيل','دخول','دور','صلاحية',
      'تطبيق','ابليكيشن','لوحة','داشبورد','ادمن','مشرف','ادارة',
      'طالب','استاذ','بروفيسور','مسؤول','رسالة','اشعار','اشعارات',
    ) || hasEn('platform', 'website', 'account', 'login', 'role', 'system', 'admin', 'dashboard'),
  };
}

// ---------------------------------------------------------------------------
// MAJOR INFERENCE
// ---------------------------------------------------------------------------

/**
 * Infers MIS major context from message keywords / 10676xxx course codes.
 * @param {string} message
 * @returns {{ majorName: string, majorFaculty: string } | null}
 */
function inferMajorFromMessage(message) {
  const en = normalizeEnglishText(message);
  const ar = normalizeArabicText(normalizeDialect(message));
  const isMIS =
    en.includes('mis') ||
    en.includes('management information') ||
    en.includes('information systems') ||
    ar.includes(normalizeArabicText('نظم المعلومات')) ||
    /10676\d{3}/.test(message);
  if (isMIS) {
    return {
      majorName: 'نظم المعلومات الإدارية / Management Information Systems',
      majorFaculty: 'كلية تكنولوجيا المعلومات والحاسوب / Faculty of IT & Computer Engineering',
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// FULL GROUNDING
// ---------------------------------------------------------------------------

const ADMIN_ROLES = new Set(['admin', 'supervisor', 'dean']);

async function buildFullGroundingString(userMessage, majorName, userRole = 'student') {
  const isAdmin = ADMIN_ROLES.has(String(userRole).toLowerCase());
  const msgForDetection = normalizeDialect(userMessage);
  const topics = detectTopics(msgForDetection);
  const hasMajorCtx = Boolean(majorName && String(majorName).trim());
  if (hasMajorCtx) topics.majors = true;

  const fetchAll = !topics.events && !topics.communities && !topics.majors && !topics.platform;

  const [evList, evAnalytics, reviewSearch, majorCtx, allMajors, communities] = await Promise.all([
    (topics.events || fetchAll) ? getEventContext() : null,
    (topics.events || fetchAll) && isAdmin ? getEventAnalyticsContext() : null,  // admin only
    (topics.events || fetchAll) && isAdmin ? getReviewSearchContext(msgForDetection) : null,  // admin only
    (topics.majors || hasMajorCtx || fetchAll) ? getMajorContext(majorName) : null,
    topics.majors ? getAllMajorsContext() : null,   // never in fetchAll — expensive
    (topics.communities || fetchAll) ? getCommunitiesContext() : null,
  ]);

  const parts = ['## Platform knowledge', buildKnowledgeBaseSection(userMessage)];
  if (evList)       parts.push('## Events', sanitizeGrounding(evList));
  if (evAnalytics)  parts.push('## Event analytics', sanitizeGrounding(evAnalytics));
  if (reviewSearch) parts.push('## Review search', sanitizeGrounding(reviewSearch));
  if (majorCtx)     parts.push('## Current major', sanitizeGrounding(majorCtx));
  if (allMajors)    parts.push('## All majors', sanitizeGrounding(allMajors));
  if (communities)  parts.push('## Communities', communities);

  return trimToTokenBudget(parts.join('\n\n'));
}

// ---------------------------------------------------------------------------
// SYSTEM PROMPT
// ---------------------------------------------------------------------------

export function buildSystemPrompt(groundingContext, opts = {}) {
  const { userMessage = '', majorName, majorFaculty, userRole = 'student' } = opts;
  const isAdmin = ADMIN_ROLES.has(String(userRole).toLowerCase());
  const u = String(userMessage);
  const languageIsArabic = ARABIC_SCRIPT_RE.test(u);

  // Mixed Arabic-English always defaults to Arabic
  const languageEnforcement = languageIsArabic
    ? 'The user is writing in Arabic (or mixed Arabic-English). You MUST respond fully in Arabic only — no English words except proper nouns.'
    : 'The user is writing in English. You MUST respond fully in English only.';

  const behaviorRules = `
BEHAVIOR RULES:
- Sound like a helpful Palestinian university student texting a friend — warm, direct, zero bureaucratic tone.
- Short answers. Bullet points only when listing 3+ items.
- NEVER repeat the topic name in every sentence. Say it once then use "هاد" / "it" / pronouns.
- For greetings: one warm line, then offer to help. Example: "أهلاً 😊 كيف بقدر أساعدك؟"
- For thanks: respond naturally. Example: "أيه والله 😊 إشي ثاني؟"
- For careers: list 4-6 real job titles, one line each.
- For difficulty questions: 2-line direct honest answer.
- For duration / credit hours: one sentence, exact number from grounding.
- FORBIDDEN PHRASES — never use these ever:
  "يمكنني مساعدتك"، "سؤال رائع"، "بالتأكيد"، "بكل سرور"، "يسعدني"،
  "لا تتردد في السؤال"، "هل يمكنني مساعدتك بشيء آخر؟"، "وفقاً للبيانات المتاحة"،
  "تجدر الإشارة"، "في ختام الحديث"، "من الجدير بالذكر"
- If data is missing from grounding: "ما عندي معلومات عن هاد" — never invent.
`;

  const dialectBlock = `
DIALECT & INPUT UNDERSTANDING:
Users write in Palestinian/Levantine dialect, MSA, Arabizi (3=ع, 7=ح, 2=أ), or mixed.
NEVER ask users to rephrase. Always answer directly.
Key mappings: بدي=أريد، وين=أين، ليش=لماذا، شو=ماذا، هلق=الآن، كتير=كثير، قديش=كم، مو=ليس.

❌ FORBIDDEN (formal) → ✅ USE INSTEAD (Palestinian):
"يتضمن هذا التخصص" → "هاد التخصص فيه"
"تبلغ ساعاته المعتمدة" → "عدد ساعاته"
"يمكنك الالتحاق" → "بتقدر تنضم"
"فرص العمل المتاحة" → "وين بتشتغل بعدين"
"بشكل عام" → "يعني"
"خريج هذا التخصص" → "اللي بيخرج منه"
"يشتغل في مسارات متنوعة" → "بتلاقيه يشتغل بأماكن كتير"

WORD BANK: هاد، هاي، هيك، يعني، بتقدر، بدك، كتير، منيح، والله، ما في،
شو بدك، لازم، إشي، مو لازم، بالنسبة لـ، بتلاقي، بتشوف، خلص، تمام، أيه، طبعاً
`;

  const courseHandling = `
COURSES — FULL LIST RULES:
When the user asks for courses / مواد for a major:
1. Give the COMPLETE list from the knowledge base — do NOT truncate or limit.
2. Group by category: مواد تقنية / Technical | مواد أعمال / Business | مواد عامة / General
3. Format each course as: "- اسم المادة (X ساعات)" — NEVER show course codes like 10676xxx
4. End with: total credit hours and duration.

For MIS specifically — 29 mandatory + 4 elective courses:
"مواد MIS بتنقسم هيك:

**مواد تقنية (Technical):**
- مبادئ البرمجة (1) (3 ساعات)
- مبادئ البرمجة (2) (3 ساعات)
- مقدمة في تكنولوجيا المعلومات (3 ساعات)
...وهيك لكل المواد...

**مواد أعمال (Business):**
...

**مواد عامة:**
...

**اختياري (18 ساعة من):**
- تفاعل الإنسان والحاسوب (3 ساعات)
...

المجموع الكلي 124 ساعة خلال 4 سنين."

If user says "شو المواد كلها" or "give me all courses" → give the FULL list, nothing abbreviated.
`;

  const eventsHandling = `
EVENTS — NEAREST EVENT QUESTION HANDLING:
The grounding has one of these markers at the top:
  "NEXT UPCOMING EVENT: ..." → there IS a future event
  "MOST RECENT PAST EVENT: ..." → no future events, this is the latest one that happened

When asked "شو أقرب فعالية؟" / "ايش اقرب ايفينت؟" / "next event?":
→ ALWAYS answer from whichever marker is present — NEVER say there are no events if any marker exists.
→ If NEXT UPCOMING EVENT → respond: "أقرب فعالية متاحة إلك هي **[name]** 😊 بتاريخ [date] في [location]."
→ If MOST RECENT PAST EVENT → respond: "آخر فعالية كانت **[name]** 😊 كانت بتاريخ [date] في [location]. ما في فعاليات قادمة حالياً، بس ترقّب!"
→ One event only — never list multiple for this question.

When asked for ALL upcoming events ("شو الفعاليات القادمة كلها"):
→ List all [UPCOMING] events. If none: "ما في فعاليات قادمة حالياً" then mention the most recent past one.
`;

  const facultyHandling = `
FACULTY MAJORS — WHEN ASKED "شو التخصصات في كلية X":
Give a warm thematic overview — what fields the faculty covers and what they prepare students for.
Do NOT dump a dry numbered list with credits and admission numbers.

For كلية تكنولوجيا المعلومات / IT faculty, respond like this (adapt based on grounding data):

"كلية تكنولوجيا المعلومات بتغطي أهم مجالات التكنولوجيا اليوم 🎓

- **البرمجة وتطوير البرمجيات** — تبني مواقع وتطبيقات، وتشتغل في شركات التقنية
- **نظم المعلومات الإدارية (MIS)** — بيجمع بين التكنولوجيا والإدارة، مثالي لو بدك تشتغل في بيئة الأعمال
- **علوم الحاسوب** — خوارزميات، ذكاء اصطناعي، نظم — للي بيحب العمق التقني
- **الشبكات والأمن السيبراني** — حماية المعلومات والبنية التحتية

إذا بدك تتعرف على كل تخصص أكتر، روح على صفحة الكليات في الموقع وادخل على كلية تكنولوجيا المعلومات — هناك بتلاقي كل التفاصيل 😊"

For other faculties: same pattern — thematic overview of what the majors prepare students for, then redirect.
NEVER list bare numbers (credits/admission) unless the user specifically asks. Keep tone warm and helpful.
`;

  const scopeBlock = `
SCOPE — WHAT YOU CAN ANSWER:
1. Academic majors: courses, credit hours, duration, admission average, career paths.
2. University events: upcoming/past, dates, locations, reviews, analytics.
3. Student communities: name, description, colleges, member count.
4. Platform usage: how to join, roles, how events work.
5. General university questions: colleges, structure, student life.

SECURITY — NEVER SHARE: passwords, emails, phone numbers, internal IDs, tokens, sessions.
If asked: "ما بقدر أشارك هاي المعلومات لأسباب أمنية."

OUT OF SCOPE: politely say you're specialized for An-Najah platform and redirect.
`;

  const head = [
    "You are Najah AI Assistant for An-Najah National University's digital platform.",
    "Use ONLY the grounding context below for live facts (events, majors, communities). Do not invent facts not in the grounding.",
    'You must always reply in the SAME language the user used. Arabic → Arabic. English → English. Mixed → Arabic.',
    languageEnforcement,
    scopeBlock,
    behaviorRules,
    dialectBlock,
    courseHandling,
    eventsHandling,
    facultyHandling,
  ];

  if (isAdmin) {
    head.push(`
ADMIN MODE — this user is a platform administrator (role: ${userRole}).
They have access to analytics, sentiment data, and review details.
You MAY answer questions about:
- Event sentiment percentages (positive/neutral/negative counts)
- Average ratings per event
- Review content and sentiment breakdown
- Community member counts and statistics
Present analytics clearly: percentages, counts, averages. Be concise and data-focused.
Students do NOT have access to this data — never reveal analytics to non-admin users.`);
  } else {
    head.push(`
STUDENT MODE — this user is a student (role: ${userRole}).
Do NOT share event analytics, sentiment percentages, review counts, or any internal statistics.
If asked about analytics/ratings/sentiment data: "هاي المعلومات متاحة للإدارة فقط." / "This information is available to admins only."
`);
  }

  if (majorName && String(majorName).trim()) {
    const fac = majorFaculty != null && String(majorFaculty).trim() ? String(majorFaculty).trim() : '—';
    head.push('', `The user is viewing the major page for: ${String(majorName).trim()} (faculty: ${fac}). Prioritize this major.`);
  }

  return [
    ...head,
    '',
    '--- GROUNDING (authoritative, use only this for facts) ---',
    '',
    String(groundingContext || '').trimEnd(),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// GROQ API
// ---------------------------------------------------------------------------

function buildMessagesFromHistory(sessionId, systemPrompt, userMessage) {
  const history = getSessionMessages(sessionId).slice(-8);
  const messages = [{ role: 'system', content: systemPrompt }];
  for (const entry of history) {
    messages.push({ role: entry.role === 'assistant' ? 'assistant' : 'user', content: String(entry.content || '') });
  }
  messages.push({ role: 'user', content: String(userMessage) });
  return messages;
}

async function callGroq({ userMessage, systemPrompt, sessionId, model }) {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const messages = buildMessagesFromHistory(sessionId, systemPrompt, userMessage);
  const body = {
    model,
    messages,
    temperature: 0.25,
    max_tokens: 1000,
    top_p: 0.85,
    frequency_penalty: 0.2,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getGroqKey()}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Groq HTTP ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Tries GROQ_MODELS in order, falls back on 429/503.
 */
async function callGroqWithFallback({ userMessage, systemPrompt, sessionId }) {
  for (const model of GROQ_MODELS) {
    try {
      return await callGroq({ userMessage, systemPrompt, sessionId, model });
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('429') || msg.includes('503')) {
        console.warn(`[callGroqWithFallback] ${model} rate-limited, trying next`);
        continue;
      }
      throw err;
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// SUGGESTIONS
// ---------------------------------------------------------------------------

function buildSuggestions(question = '', hasMajorContext = false) {
  const arabic = hasArabic(question);
  if (hasMajorContext) {
    return arabic
      ? ['شو كل مواد التخصص؟', 'قديش عدد الساعات المعتمدة؟', 'شو فرص العمل بعد التخرج؟', 'صعب هاد التخصص؟']
      : ['What are all the courses in this major?', 'How many credit hours are required?', 'What career paths does this major lead to?', 'Is this major difficult?'];
  }
  return arabic
    ? ['شو أقرب فعالية قادمة؟', 'شو التخصصات في كلية تكنولوجيا المعلومات؟', 'كيف أنضم لمجتمع؟', 'شو مواد تخصص MIS؟']
    : ['What is the next upcoming event?', 'What majors are in the IT faculty?', 'How do I join a community?', 'What courses are in the MIS major?'];
}

// ---------------------------------------------------------------------------
// SMART ASYNC FALLBACK  (used when Groq is unavailable)
// ---------------------------------------------------------------------------

async function buildSmartFallback(clean, resolvedMajorName, resolvedMajorFaculty) {
  const arabic = hasArabic(clean);
  const qNorm = normalizeDialect(clean);
  const qEn = normalizeEnglishText(qNorm);
  const qAr = normalizeArabicText(qNorm);

  const hasEn = (...w) => w.some(t => qEn.includes(t));
  const hasAr = (...w) => w.some(t => qAr.includes(normalizeArabicText(t)));

  // ── 1. Events ──────────────────────────────────────────────────────────────
  const isEventQ =
    hasAr('فعالية','فعاليات','ايفنت','ايفينت','حفله','حفلة','محاضرة','ورشة','مسابقة','نشاط','قادم','قادمة','جاي') ||
    hasEn('event','events','upcoming','activity','next event','workshop');
  if (isEventQ) {
    try {
      const evCtx = await getEventContext();
      const upMatch = evCtx.match(/NEXT UPCOMING EVENT: "([^"]+)" \| date: ([^\|]+) \| location: ([^\n]+)/);
      const pastMatch = evCtx.match(/MOST RECENT PAST EVENT: "([^"]+)" \| date: ([^\|]+) \| location: ([^\n]+)/);
      if (upMatch) {
        const [, title, date, loc] = upMatch;
        return arabic
          ? `أقرب فعالية متاحة إلك هي **${title.trim()}** 😊 بتاريخ ${date.trim()} في ${loc.trim()}.`
          : `The next upcoming event is **${title.trim()}** 😊 on ${date.trim()} at ${loc.trim()}.`;
      }
      if (pastMatch) {
        const [, title, date, loc] = pastMatch;
        return arabic
          ? `آخر فعالية كانت **${title.trim()}** 😊 كانت بتاريخ ${date.trim()} في ${loc.trim()}. ما في فعاليات قادمة حالياً، بس ترقّب!`
          : `The most recent event was **${title.trim()}** 😊 on ${date.trim()} at ${loc.trim()}. No upcoming events currently — stay tuned!`;
      }
    } catch (_) {}
    return arabic
      ? 'ما قدرت أجيب معلومات الفعاليات حالياً. جرب تفوت على صفحة الفعاليات مباشرة من الموقع 😊'
      : 'Could not fetch event info right now. Check the Events page directly on the platform 😊';
  }

  // ── 2. Community join ──────────────────────────────────────────────────────
  const isCommunityJoinQ =
    (hasAr('انضم','اشترك','عضو','عضوية') || hasEn('join','member','sign up')) &&
    (hasAr('مجتمع','مجتمعات','كلوب','نادي') || hasEn('community','communities','club'));
  if (isCommunityJoinQ) {
    return arabic
      ? 'عشان تنضم لمجتمع 😊\n\n1. روح على صفحة **المجتمعات** في الموقع\n2. ابحث عن المجتمع اللي بدك تنضم فيه\n3. اضغط على **"طلب الانضمام"**\n\nبعد موافقة قائد المجتمع بتكون عضواً رسمياً وبتقدر تشارك في الفعاليات والنقاشات!'
      : 'To join a community 😊\n\n1. Go to the **Communities** page\n2. Find the community you want\n3. Click **"Request to Join"**\n\nOnce the leader approves, you\'re officially a member and can join events and discussions!';
  }

  // ── 3. IT faculty majors ────────────────────────────────────────────────────
  const isITFacultyQ =
    (hasAr('كلية') || hasEn('faculty','college')) &&
    (hasEn('it','information technology','computer') || hasAr('تكنولوجيا','معلومات','حاسوب','حاسب'));
  if (isITFacultyQ) {
    return arabic
      ? `كلية تكنولوجيا المعلومات بتغطي أهم مجالات التكنولوجيا اليوم 🎓\n\n- **البرمجة وتطوير البرمجيات** — تبني مواقع وتطبيقات، وتشتغل في شركات التقنية\n- **نظم المعلومات الإدارية (MIS)** — بيجمع التكنولوجيا مع إدارة الأعمال، مثالي لبيئة الأعمال\n- **علوم الحاسوب** — خوارزميات، ذكاء اصطناعي، نظم تشغيل\n- **الشبكات والأمن السيبراني** — حماية المعلومات والبنية التحتية\n\nإذا بدك تكتشف كل تخصص أكتر، روح على صفحة **الكليات** في الموقع وادخل على كلية تكنولوجيا المعلومات 😊`
      : `The Faculty of IT covers the most important tech fields today 🎓\n\n- **Software Development** — build websites & apps, work at tech companies\n- **MIS** — combines technology with business management\n- **Computer Science** — algorithms, AI, operating systems\n- **Networks & Cybersecurity** — information and infrastructure protection\n\nVisit the **Colleges** page on the platform for full details on each major 😊`;
  }

  // ── 4. MIS courses from KB ─────────────────────────────────────────────────
  const isMISCourseQ =
    (hasEn('mis') || hasAr('نظم المعلومات','mis')) &&
    (hasAr('مواد','مساقات','مقررات','خطة','مادة') || hasEn('course','courses','subject','plan','syllabus'));
  const isMISMajor = resolvedMajorName &&
    (String(resolvedMajorName).toLowerCase().includes('mis') ||
     String(resolvedMajorName).includes('نظم المعلومات'));
  if (isMISCourseQ || isMISMajor) {
    const misEntry = manualKnowledgeBase.find(e => e.id === 'mis-courses');
    if (misEntry) {
      const lines = misEntry.body.split('\n');
      const mandatory = [], elective = [];
      let inElective = false;
      for (const line of lines) {
        if (/Elective/i.test(line)) { inElective = true; continue; }
        const m = line.match(/^1\d{7}\s+(.+?)\s*\|\s*.+?\s*\|\s*(\d+)\s*hrs?/);
        if (m) (inElective ? elective : mandatory).push({ name: m[1].trim(), hrs: m[2] });
      }
      if (mandatory.length > 0) {
        const techKw = ['برمجة','قواعد','شبكات','ذكاء','حاسوب','نظم','امن','ويب','خوارزم','تطبيق','مشروع','تدريب'];
        const bizKw = ['ادارة','إدارة','محاسبة','مالية','تجار','تسويق','اعمال','أعمال','اقتصاد','بحوث العمليات','ريادة','استراتيج'];
        const tech = [], biz = [], gen = [];
        for (const c of mandatory) {
          const t = normalizeArabicText(c.name);
          if (techKw.some(k => t.includes(k))) tech.push(c);
          else if (bizKw.some(k => t.includes(k))) biz.push(c);
          else gen.push(c);
        }
        const fmt = arr => arr.map(c => `- ${c.name} (${c.hrs} ساعات)`).join('\n');
        let out = arabic ? 'مواد تخصص MIS — نظم المعلومات الإدارية 📚\n\n' : 'MIS Courses 📚\n\n';
        if (tech.length) out += `**مواد تقنية:**\n${fmt(tech)}\n\n`;
        if (biz.length)  out += `**مواد أعمال:**\n${fmt(biz)}\n\n`;
        if (gen.length)  out += `**مواد عامة:**\n${fmt(gen)}\n\n`;
        if (elective.length) out += `**اختياري (18 ساعة من):**\n${fmt(elective)}\n\n`;
        out += arabic ? 'المجموع: 124 ساعة خلال 4 سنين.' : 'Total: 124 credit hours, 4 years.';
        return out;
      }
    }
  }

  // ── Default ────────────────────────────────────────────────────────────────
  return buildLocalChatResponse({ userMessage: clean, majorName: resolvedMajorName, majorFaculty: resolvedMajorFaculty });
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

export async function askChatbot({ sessionId, userMessage, majorName, majorFaculty, userRole = 'student' }) {
  const clean = String(userMessage || '').trim();
  if (!clean) {
    const err = new Error('question is required');
    err.statusCode = 400;
    throw err;
  }

  // Infer MIS context from message keywords / course codes when not explicitly provided
  let resolvedMajorName = majorName;
  let resolvedMajorFaculty = majorFaculty;
  if (!resolvedMajorName) {
    const inferred = inferMajorFromMessage(clean);
    if (inferred) {
      resolvedMajorName = inferred.majorName;
      resolvedMajorFaculty = inferred.majorFaculty;
    }
  }

  const hasMajorContext = Boolean(resolvedMajorName && String(resolvedMajorName).trim());
  const groqKey = getGroqKey();

  if (groqKey) {
    try {
      const groundingContext = await buildFullGroundingString(clean, resolvedMajorName, userRole);
      const systemPrompt = buildSystemPrompt(groundingContext, { userMessage: clean, majorName: resolvedMajorName, majorFaculty: resolvedMajorFaculty, userRole });
      const answer = await callGroqWithFallback({ userMessage: clean, systemPrompt, sessionId });
      if (answer) {
        if (sessionId) appendSessionTurn(sessionId, clean, answer);
        return { answer, suggestions: buildSuggestions(clean, hasMajorContext), model: GROQ_MODELS[0], provider: 'groq' };
      }
    } catch (err) {
      console.error('[askChatbot] Groq failed:', err);
    }
  }

  const answer = await buildSmartFallback(clean, resolvedMajorName, resolvedMajorFaculty);
  if (sessionId) appendSessionTurn(sessionId, clean, answer);
  return { answer, suggestions: buildSuggestions(clean, hasMajorContext), model: 'local-rule-based', provider: 'local' };
}

export async function answerQuestion({ question, sessionId, majorName, majorFaculty }) {
  return askChatbot({ userMessage: question, sessionId, majorName, majorFaculty });
}
