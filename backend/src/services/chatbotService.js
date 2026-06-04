import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { manualKnowledgeBase } from '../chatbot/manualKnowledgeBase.js';
import { getSessionMessages, appendSessionTurn } from '../chatbot/sessionStore.js';
import { pool } from '../../../server/db/pool.js';

// backend/src/services/ → up 3 levels → project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../.env'), override: false });

export { clearSession } from '../chatbot/sessionStore.js';

const GROQ_MODELS = [
  process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
];
const GROQ_TIMEOUT_MS = Math.max(1000, Number.parseInt(String(process.env.GROQ_TIMEOUT_MS || '30000'), 10) || 30000);

// Read at call-time (not module load) to avoid ESM hoisting race with dotenv
const getGroqKey = () => process.env.GROQ_API_KEY || '';

// ---------------------------------------------------------------------------
// IN-MEMORY CACHE
// ---------------------------------------------------------------------------

/** @type {Map<string, { data: any, expires: number }>} */
const _cache = new Map();

/**
 * Returns a cached result or calls fn() and caches the result for ttlMs ms.
 * @template T
 * @param {string} key - Cache key
 * @param {number} ttlMs - Time-to-live in milliseconds
 * @param {() => Promise<T>} fn - Async producer called on cache miss
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
// CONSTANTS & GUARDS
// ---------------------------------------------------------------------------

const ARABIC_SCRIPT_RE = /[؀-ۿ]/;

function ensureConfigured() {
  if (!getGroqKey()) {
    const error = new Error('Groq chatbot is not configured. Add GROQ_API_KEY to .env and restart the server.');
    error.statusCode = 503;
    throw error;
  }
}

function hasArabic(text = '') {
  return ARABIC_SCRIPT_RE.test(String(text));
}

// ---------------------------------------------------------------------------
// TEXT NORMALIZATION
// ---------------------------------------------------------------------------

/**
 * Normalize Arabic text: strip diacritics, normalize letters, convert Arabizi digits.
 * @param {string} text
 * @returns {string}
 */
function normalizeArabicText(text = '') {
  return String(text)
    .normalize('NFKC')
    // Arabizi digit → Arabic letter substitutions
    .replace(/3/g, 'ع')
    .replace(/7/g, 'ح')
    .replace(/2/g, 'أ')
    .replace(/[ً-ٰٟ]/g, '')
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

/** Palestinian/Levantine dialect → MSA substitution map */
const DIALECT_MAP = {
  'بدي':  'أريد',
  'بدك':  'تريد',
  'بده':  'يريد',
  'بدها': 'تريد',
  'بدنا': 'نريد',
  'بدهم': 'يريدون',
  'وين':  'أين',
  'منين': 'من أين',
  'ليش':  'لماذا',
  'شو':   'ماذا',
  'شوو':  'ماذا',
  'هلق':  'الآن',
  'هلأ':  'الآن',
  'كتير': 'كثير',
  'كتيرة':'كثيرة',
  'هون':  'هنا',
  'منيح': 'جيد',
  'مو':   'ليس',
  'قديش': 'كم',
  'اشي':  'شيء',
  'يلا':  'هيا',
  'خلص':  'انتهى',
};

// Pre-compile replacements once at module load
const DIALECT_REPLACEMENTS = Object.entries(DIALECT_MAP).map(([from, to]) => ({
  re: new RegExp(from, 'g'),
  to,
}));

/**
 * Converts Palestinian/Levantine dialect words to MSA equivalents
 * for better topic detection and knowledge-base scoring.
 * @param {string} text
 * @returns {string}
 */
function normalizeDialect(text = '') {
  let result = String(text);
  for (const { re, to } of DIALECT_REPLACEMENTS) {
    result = result.replace(re, to);
  }
  return result;
}

// ---------------------------------------------------------------------------
// MAJOR CONTEXT PARSER (inline, no DB)
// ---------------------------------------------------------------------------

function parseMajorContextInline(majorName, majorFacultyRaw = '') {
  const raw = String(majorFacultyRaw || '');
  const parsed = {
    majorName: majorName || '',
    faculty: '',
    creditHours: '',
    duration: '',
    majorType: '',
    minAdmission: '',
    notes: '',
    courses: [],
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
        .split(' ; ')
        .map((c) => c.trim())
        .filter(Boolean)
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
// LOCAL RULE-BASED FALLBACK (no Groq required)
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
  const scoreIntent = (enTokens = [], arTokens = []) => {
    let score = 0;
    for (const token of enTokens) if (qLower.includes(normalizeEnglishText(token))) score += 1;
    for (const token of arTokens) if (qAr.includes(normalizeArabicText(token))) score += 1;
    return score;
  };

  const isGreeting =
    hasAny('hello', 'hi', 'hey', 'good morning', 'good evening', 'good afternoon') ||
    hasAnyAr('مرحبا', 'اهلا', 'أهلا', 'هلا', 'سلام', 'صباح الخير', 'مساء الخير', 'يسعد صباحك', 'يسعد مساك');
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
      ['major type', 'academic track', 'what track', 'stream', 'scientific or literary', 'literary or scientific', 'commercial stream'],
      ['نوع التخصص', 'المؤهل العلمي', 'مسار التخصص', 'علمي ولا ادبي', 'علمي ولا تجاري', 'ادبي ولا تجاري', 'شو نوع التخصص', 'مسار']
    ),
    explain: scoreIntent(['tell me', 'explain', 'details', 'overview', 'about'], ['احكي', 'احكيلي', 'اشرح', 'اشرحلي', 'فهمني', 'تفاصيل', 'معلومات', 'نبذه', 'نبذة']),
  };
  const topIntent = Object.entries(intents).sort((a, b) => b[1] - a[1])[0];
  const topIntentName = topIntent?.[0] || '';
  const topIntentScore = topIntent?.[1] || 0;

  if (isGreeting) {
    return arabic
      ? `أهلًا وسهلًا! كيف بقدر أساعدك في ${majorLabel}؟\nممكن تسألني عن المواد، نوع المسار الأكاديمي، عدد الساعات، مدة الدراسة، أو فرص العمل.`
      : `Hello! I can help you with ${majorLabel}.\nYou can ask about courses, major type (academic track), credit hours, duration, or career paths.`;
  }

  if (topIntentName === 'courses' && topIntentScore > 0) {
    if (ctx.courses.length === 0) {
      const typeLineAr = ctx.majorType ? `\nنوع المسار الأكاديمي: ${ctx.majorType}.` : '';
      const typeLineEn = ctx.majorType ? `\nMajor type (academic track): ${ctx.majorType}.` : '';
      return arabic
        ? `حالياً ما عندي قائمة مواد مفصلة لـ ${majorLabel} ضمن المصدر المتاح.\nبس بقدر أساعدك بمعدل القبول، عدد الساعات، ومدة الدراسة.${typeLineAr}`
        : `I do not currently have a detailed course list for ${majorLabel} in the available source.\nI can still help with admission average, credit hours, and duration.${typeLineEn}`;
    }
    const classifyCourse = (title = '') => {
      const tAr = normalizeArabicText(title);
      const tEn = normalizeEnglishText(title);
      if (
        ['برمجة', 'قواعد بيانات', 'شبكات', 'ذكاء', 'حاسوب', 'نظم معلومات', 'امن المعلومات', 'خوارزميات'].some((k) => tAr.includes(k)) ||
        ['program', 'database', 'network', 'software', 'information system', 'computer', 'cyber', 'algorithm'].some((k) => tEn.includes(k))
      ) {
        return arabic ? 'مواد تقنية' : 'Technical Courses';
      }
      if (
        ['ادارة', 'إدارة', 'محاسبة', 'مالية', 'اقتصاد', 'تسويق', 'اعمال', 'أعمال'].some((k) => tAr.includes(normalizeArabicText(k))) ||
        ['management', 'accounting', 'finance', 'economics', 'marketing', 'business'].some((k) => tEn.includes(k))
      ) {
        return arabic ? 'مواد أعمال' : 'Business Courses';
      }
      return arabic ? 'مواد عامة' : 'General Courses';
    };

    const queryTokens = (arabic ? qAr : qLower)
      .split(' ')
      .filter((t) => t.length >= 3)
      .filter((t) => !['المواد', 'مواد', 'مساقات', 'courses', 'course', 'about', 'التخصص'].includes(t));
    const matched = queryTokens.length > 0
      ? ctx.courses.filter((c) => {
          const hay = `${normalizeArabicText(c.title)} ${normalizeEnglishText(c.title)} ${String(c.code || '').toLowerCase()}`;
          return queryTokens.some((t) => hay.includes(normalizeArabicText(t)) || hay.includes(normalizeEnglishText(t)));
        })
      : [];
    const top = (matched.length ? matched : ctx.courses).slice(0, 10);
    const grouped = {};
    for (const c of top) {
      const cat = classifyCourse(c.title);
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(c);
    }
    const groupsText = Object.entries(grouped)
      .map(([cat, items]) => {
        const lines = items
          .slice(0, 4)
          .map((c) => `- ${c.title || '—'} (${(c.creditHours || '—').replace(/\s*cr$/i, '').trim()}${arabic ? ' ساعة' : ' credits'})`)
          .join('\n');
        return `${arabic ? `**${cat}:**` : `**${cat}:**`}\n${lines}`;
      })
      .join('\n\n');
    const hasMore = (matched.length ? matched.length : ctx.courses.length) > top.length;
    const tail = arabic
      ? `\n\n${hasMore ? 'وفيه مواد ثانية كمان.\n' : ''}المجموع الكلي ${ctx.creditHours || '—'} ساعة خلال ${ctx.duration || '—'}.`
      : `\n\n${hasMore ? 'There are additional courses as well.\n' : ''}Total: ${ctx.creditHours || '—'} credit hours over ${ctx.duration || '—'}.`;
    const matchLine = matched.length > 0
      ? (arabic ? `\nلقيت ${matched.length} مادة مرتبطة بسؤالك.\n` : `\nI found ${matched.length} courses matching your query.\n`)
      : '';
    return arabic
      ? `مواد ${majorLabel} بتنقسم هيك:${matchLine}\n\n${groupsText}${tail}`
      : `Courses in ${majorLabel} can be grouped like this:${matchLine}\n\n${groupsText}${tail}`;
  }
  if (topIntentName === 'credits' && topIntentScore > 0 && ctx.creditHours) {
    return arabic
      ? `عدد الساعات المعتمدة في ${majorLabel} هو ${ctx.creditHours} ساعة.`
      : `${majorLabel} requires ${ctx.creditHours} credit hours.`;
  }
  if (topIntentName === 'duration' && topIntentScore > 0 && ctx.duration) {
    return arabic
      ? `مدة دراسة ${majorLabel} هي ${ctx.duration}.`
      : `The study duration for ${majorLabel} is ${ctx.duration}.`;
  }
  if (topIntentName === 'admission' && topIntentScore > 0 && ctx.minAdmission) {
    return arabic
      ? `الحد الأدنى للقبول في ${majorLabel} هو ${ctx.minAdmission}.`
      : `The minimum admission average for ${majorLabel} is ${ctx.minAdmission}.`;
  }
  if (topIntentName === 'faculty' && topIntentScore > 0 && ctx.faculty) {
    return arabic
      ? `${majorLabel} يتبع إلى ${ctx.faculty}.`
      : `${majorLabel} belongs to ${ctx.faculty}.`;
  }
  if (topIntentName === 'type' && topIntentScore > 0 && ctx.majorType) {
    return arabic
      ? `نوع المسار الأكاديمي لـ ${majorLabel}: ${ctx.majorType}.`
      : `The academic track (major type) for ${majorLabel} is: ${ctx.majorType}.`;
  }
  if (topIntentName === 'type' && topIntentScore > 0 && !ctx.majorType) {
    return arabic
      ? `ما عندي تصنيف نوع المسار الأكاديمي لـ ${majorLabel} ضمن البيانات المتاحة حالياً.`
      : `I do not have the major type (academic track) for ${majorLabel} in the current data.`;
  }
  if (topIntentName === 'careers' && topIntentScore > 0) {
    const typeTailAr = ctx.majorType ? `\nالمسار الأكاديمي المصنّف: ${ctx.majorType}.` : '';
    const typeTailEn = ctx.majorType ? `\nAcademic track: ${ctx.majorType}.` : '';
    return arabic
      ? `بشكل عام، خريج ${majorLabel} ممكن يشتغل في مسارات متنوعة بالقطاعين العام والخاص، أو يكمل دراسات عليا.${typeTailAr}\nإذا بدك أعطيك أمثلة أدق، ابعتلي ميولك أو المجال اللي حابب تدخل فيه.`
      : `In general, ${majorLabel} graduates can pursue varied paths across public and private sectors, or continue graduate studies.${typeTailEn}\nIf you want a more specific list, tell me your preferred field.`;
  }
  if (topIntentName === 'explain' && topIntentScore > 0) {
    const typeMidAr = ctx.majorType ? `، ونوع المسار الأكاديمي ${ctx.majorType}` : '';
    const typeMidEn = ctx.majorType ? `, major type ${ctx.majorType}` : '';
    return arabic
      ? `${majorLabel} في ${ctx.faculty || 'الكلية'}${typeMidAr}، مدته ${ctx.duration || '—'}، وعدد ساعاته ${ctx.creditHours || '—'}، والحد الأدنى للقبول ${ctx.minAdmission || '—'}.\nإذا بدك، اسألني مباشرة: "شو المواد؟" أو "شو نوع المسار؟" أو "قديش الساعات؟" أو "شو فرص العمل؟".`
      : `${majorLabel} is in ${ctx.faculty || 'its faculty'}${typeMidEn}, with duration ${ctx.duration || '—'}, ${ctx.creditHours || '—'} credit hours, and minimum admission average ${ctx.minAdmission || '—'}.\nYou can ask directly: "what courses?", "what is the major type?", "how many credits?", or "what careers?".`;
  }

  return arabic
    ? `أنا جاهز أساعدك بكل ما يخص ${majorLabel}.\nاسألني عن المواد، نوع المسار الأكاديمي، عدد الساعات، مدة الدراسة، أو معدل القبول.`
    : `I can help you with ${majorLabel} details.\nAsk me about courses, major type (academic track), credit hours, duration, or minimum admission average.`;
}

function effectiveSentimentForAnalytics(review) {
  const o = review.overrideSentiment;
  if (o != null && String(o).trim() !== '') {
    const s = String(o).trim().toLowerCase();
    if (s === 'positive' || s === 'neutral' || s === 'negative') return s;
  }
  const s = (review.sentiment || 'neutral').toLowerCase();
  if (s === 'positive' || s === 'neutral' || s === 'negative') return s;
  return 'neutral';
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function extractKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  const raw = text.normalize('NFKC');
  return raw
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t && t.length >= 2)
    .map((t) => t)
    .filter((t, i, a) => a.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i);
}

// ---------------------------------------------------------------------------
// DB CONTEXT BUILDERS (slow-changing ones wrapped with cache)
// ---------------------------------------------------------------------------

async function _getEventContext() {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, start_date AS date, location, created_at
       FROM events ORDER BY created_at ASC LIMIT 50`
    );
    if (rows.length === 0) return '[Database: no events found.]\n';
    const lines = rows.map((e) => {
      const d = e.date ? new Date(e.date).toISOString().slice(0, 10) : '—';
      return `- ${e.title} | date: ${d} | location: ${e.location ?? '—'}`;
    });
    return `University events:\n${lines.join('\n')}\n`;
  } catch (err) {
    console.error('[getEventContext] error:', err?.message || err);
    return `[getEventContext failed: ${err?.message || err}]\n`;
  }
}

/** @returns {Promise<string>} */
export const getEventContext = () => cached('events', 2 * 60_000, _getEventContext);

export async function getEventDetailsContext() {
  return '';
}

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
       GROUP BY e.id, e.title
       ORDER BY e.title ASC`
    );
    if (rows.length === 0) return '[Database: no events for analytics.]\n';
    const lines = rows.map((ev) => {
      if (ev.review_count === 0) return `- ${ev.title}: no reviews yet`;
      const pct = ev.review_count > 0 ? ((ev.pos / ev.review_count) * 100).toFixed(1) : 'n/a';
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
      const colleges = Array.isArray(c.colleges) && c.colleges.length > 0
        ? c.colleges.join(', ') : 'open to all';
      const desc = c.description ? ` — ${String(c.description).slice(0, 100)}` : '';
      return `- ${c.name} | members: ${c.member_count} | colleges: ${colleges}${desc}`;
    });
    return `Student communities:\n${lines.join('\n')}\n`;
  } catch (err) {
    console.error('[getCommunitiesContext] error:', err?.message || err);
    return `[getCommunitiesContext failed: ${err?.message || err}]\n`;
  }
}

/** @returns {Promise<string>} */
export const getCommunitiesContext = () => cached('communities', 5 * 60_000, _getCommunitiesContext);

export async function getReviewSearchContext(userMessage) {
  try {
    const kws = extractKeywords(userMessage).slice(0, 5);
    if (kws.length === 0) return '';
    const conditions = kws.map((k, i) => `r.comment ILIKE $${i + 1}`).join(' OR ');
    const params = kws.map((k) => `%${k}%`);
    const { rows } = await pool.query(
      `SELECT e.title, r.rating, r.comment,
              COALESCE(r.override_sentiment, r.sentiment) AS sentiment
       FROM event_reviews r
       JOIN events e ON e.id = r.event_id
       WHERE ${conditions}
       ORDER BY r.created_at DESC LIMIT 5`,
      params
    );
    if (rows.length === 0) return '';
    const lines = rows.map((r) => {
      const c = (r.comment || '').slice(0, 200).replace(/\s+/g, ' ');
      return `- "${r.title}" | ${r.rating}/5 | ${r.sentiment} | ${c}`;
    });
    return `Related reviews:\n${lines.join('\n')}\n`;
  } catch (err) {
    console.error('[getReviewSearchContext] error:', err?.message || err);
    return '';
  }
}

function getStaticCourseContext(majorName) {
  if (!majorName) return '';
  const name = majorName.toLowerCase();

  const courseMap = {
    'management information systems': `MIS main course areas: Programming & databases, Systems analysis & design, Networking & security, E-commerce & ERP, Business administration, Accounting & finance, Statistics, IT project management. Total: 124 credit hours, 4 years. Accepts scientific, literary, and business streams.`,
    'computer science': `CS main course areas: Programming (Java/Python/C++), Data structures & algorithms, Operating systems, AI & machine learning, Database systems, Software engineering, Computer networks. Total: 132 credit hours, 4 years.`,
    'civil engineering': `Civil Engineering main course areas: Structural engineering, Geotechnical engineering, Construction management, Surveying, Fluid mechanics, Transportation engineering. Total: 162 credit hours, 5 years.`,
    'business administration': `Business Admin main areas: Management principles, Marketing, Accounting, Finance, Business law, Economics, Statistics, HR management. Total: 132 credit hours, 4 years.`,
  };

  for (const [key, value] of Object.entries(courseMap)) {
    if (name.includes(key) || key.includes(name.split(' ')[0].toLowerCase())) {
      return value;
    }
  }
  return `For detailed course list of ${majorName}, students can check the university website or contact the faculty directly.`;
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
    const staticCourses = getStaticCourseContext(majorName);
    return `Major: ${m.name} | Faculty: ${m.faculty_name} | Type: ${m.major_type || '—'} | Credits: ${m.credit_hours} | Duration: ${m.duration} | Min admission: ${m.min_admission} | ${staticCourses}\n`;
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
    const lines = Object.entries(grouped).map(([fac, items]) => `${fac}:\n${items.join('\n')}`);
    return `University majors:\n\n${lines.join('\n\n')}\n`;
  } catch (err) {
    console.error('[getAllMajorsContext] error:', err?.message || err);
    return `[getAllMajorsContext failed: ${err?.message || err}]\n`;
  }
}

/** @returns {Promise<string>} */
export const getAllMajorsContext = () => cached('allMajors', 10 * 60_000, _getAllMajorsContext);

// ---------------------------------------------------------------------------
// GROUNDING HELPERS
// ---------------------------------------------------------------------------

function sanitizeGrounding(text) {
  if (!text || typeof text !== 'string') return text;
  const lines = text.split('\n');
  const cleaned = lines.filter(line => {
    if (/\b1\d{7}\b/.test(line)) return false;
    if (/^\s*\d+\s*$/.test(line)) return false;
    return true;
  });
  return cleaned.join('\n');
}

/**
 * Trims grounding text to a character budget, keeping first 70% + last 30%.
 * @param {string} text
 * @param {number} [maxChars=6000]
 * @returns {string}
 */
function trimToTokenBudget(text, maxChars = 6000) {
  if (!text || text.length <= maxChars) return text;
  const headLen = Math.floor(maxChars * 0.7);
  const tailLen = maxChars - headLen;
  return (
    text.slice(0, headLen) +
    '\n\n[...محتوى محذوف للحفاظ على حدود نافذة السياق...]\n\n' +
    text.slice(-tailLen)
  );
}

/**
 * Tag-scored knowledge-base section: picks top-4 relevant entries for the query.
 * Falls back to all entries when no tags match (general question).
 * @param {string} [userMessage='']
 * @returns {string}
 */
function buildKnowledgeBaseSection(userMessage = '') {
  if (!userMessage) {
    const lines = manualKnowledgeBase.map((e) => `### ${e.title}\n${e.body}`);
    return `Platform knowledge base:\n\n${lines.join('\n\n')}\n`;
  }
  const normalized = normalizeDialect(userMessage);
  const q = normalizeEnglishText(normalized) + ' ' + normalizeArabicText(normalized);
  const en = normalizeEnglishText(normalized);
  const ar = normalizeArabicText(normalized);

  // Detect MIS-specific query to apply a score boost on the MIS KB entry
  const isMISQuery =
    en.includes('mis') ||
    en.includes('management information') ||
    en.includes('information systems') ||
    ar.includes(normalizeArabicText('نظم المعلومات')) ||
    /10676\d{3}/.test(userMessage);

  const scored = manualKnowledgeBase
    .map(entry => {
      let score = entry.tags.filter(t => q.includes(t.toLowerCase())).length;
      if (isMISQuery && entry.tags.includes('mis')) score += 5;
      return { entry, score };
    })
    .sort((a, b) => b.score - a.score);
  const topScore = scored[0]?.score ?? 0;
  // Return top-5 for MIS queries (detailed entry needs full context), top-4 otherwise
  const limit = isMISQuery ? 5 : 4;
  const selected = topScore > 0 ? scored.slice(0, limit) : scored;
  const lines = selected.map(({ entry }) => `### ${entry.title}\n${entry.body}`);
  return `Platform knowledge base:\n\n${lines.join('\n\n')}\n`;
}

function detectTopics(msg) {
  const ar = normalizeArabicText(msg);
  const en = normalizeEnglishText(msg);
  const hasAr = (...words) => words.some((w) => ar.includes(normalizeArabicText(w)));
  const hasEn = (...words) => words.some((w) => en.includes(w));
  return {
    events: hasAr('فعالية', 'فعاليات', 'حدث', 'احداث', 'نشاط', 'نشاطات', 'ايفنت', 'تقييم', 'مراجعة', 'تقييمات') ||
            hasEn('event', 'events', 'activity', 'activities', 'review', 'rating'),
    communities: hasAr('مجتمع', 'مجتمعات', 'كلوب', 'نادي', 'مجموعة', 'انضم', 'عضوية') ||
                 hasEn('community', 'communities', 'club', 'group', 'join', 'member'),
    majors: hasAr('تخصص', 'تخصصات', 'كلية', 'كليات', 'مادة', 'مواد', 'ساعات', 'قبول', 'معدل', 'دراسة', 'برنامج',
                  'نظم المعلومات', 'نظم المعلومات الإدارية') ||
            hasEn('major', 'faculty', 'course', 'credit', 'admission', 'degree', 'program', 'study',
                  'management information', 'mis major', 'mis courses', 'information systems',
                  'mis credits', 'mis requirements') ||
            en.includes('mis') ||
            msg.includes('10676'),
    platform: hasAr('موقع', 'منصة', 'نظام', 'حساب', 'تسجيل', 'دخول', 'دور', 'صلاحية') ||
              hasEn('platform', 'website', 'account', 'login', 'role', 'system', 'how'),
  };
}

async function buildFullGroundingString(userMessage, majorName) {
  // Normalize dialect before topic detection so dialect keywords resolve correctly
  const msgForDetection = normalizeDialect(userMessage);
  const topics = detectTopics(msgForDetection);
  const hasMajorCtx = Boolean(majorName && String(majorName).trim());

  if (hasMajorCtx) topics.majors = true;

  // fetchAll fires when no topic is detected, but never pulls getAllMajorsContext (expensive)
  const fetchAll = !topics.events && !topics.communities && !topics.majors && !topics.platform;

  const fetches = await Promise.all([
    (topics.events || fetchAll) ? getEventContext() : null,
    (topics.events || fetchAll) ? getEventAnalyticsContext() : null,
    (topics.events || fetchAll) ? getReviewSearchContext(msgForDetection) : null,
    (topics.majors || hasMajorCtx || fetchAll) ? getMajorContext(majorName) : null,
    topics.majors ? getAllMajorsContext() : null,           // never in fetchAll
    (topics.communities || fetchAll) ? getCommunitiesContext() : null,
  ]);

  const [evList, evAnalytics, reviewSearch, majorCtx, allMajors, communities] = fetches;

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

/** Arabic descriptions per user role, injected before the scope block */
const ROLE_DESCRIPTIONS = {
  student:    'المستخدم طالب. ركّز على معلومات التخصصات والفعاليات للانضمام والمجتمعات. لا تُظهر إحصائيات أو أدوات الإدارة.',
  professor:  'المستخدم أستاذ/محاضر. يمكنه الاطلاع على معلومات إنشاء الفعاليات والتفاصيل الأكاديمية وإدارة المجتمعات.',
  admin:      'المستخدم مدير النظام. يمكنه الاطلاع على إحصائيات المشاعر ولوحة القيادة وتصحيح التسميات وإدارة الفعاليات الكاملة.',
  supervisor: 'المستخدم مشرف/عميد. ركّز على تقارير مستوى الكلية وسير عمل الموافقة على المجتمعات والإحصائيات التفصيلية.',
};

/**
 * @param {string} groundingContext — full string from all context builders
 * @param {{ userMessage: string, majorName?: string, majorFaculty?: string, userRole?: string }} opts
 * @returns {string}
 */
export function buildSystemPrompt(groundingContext, opts = {}) {
  const { userMessage = '', majorName, majorFaculty, userRole = 'student' } = opts;
  const u = String(userMessage);
  const languageIsArabic = ARABIC_SCRIPT_RE.test(u);

  const roleBlock = `USER ROLE: ${ROLE_DESCRIPTIONS[userRole] ?? ROLE_DESCRIPTIONS.student}`;

  const dialectBlock = `
INPUT DIALECT — UNDERSTANDING RULES:
Users may write in Palestinian/Levantine dialect, MSA, or mixed Arabic-English (Arabizi like "3" for ع, "7" for ح, "2" for أ).
Accept ALL input forms without ever asking the user to rephrase or clarify their dialect.
Understand equivalents: بدي=أريد، وين=أين، ليش=لماذا، شو=ماذا، هلق=الآن، كتير=كثير، مو=ليس، قديش=كم، هاد=هذا، هيك=هكذا.
Never say "أعد صياغة سؤالك" or "I don't understand your dialect" — always answer directly.
`;

  const behaviorRules = `
BEHAVIOR RULES:
- Be concise. Use short answers. Use bullet points only when listing 3+ items.
- Be warm like a helpful senior student, not a formal office.
- NEVER repeat the major name in every sentence. Say it once then use "هاد التخصص" or "فيه".
- For questions about jobs/careers: list 4-6 real job titles with one line each.
- For questions about difficulty: give a direct honest answer in 2-3 lines max.
- For questions about duration or credit hours: answer in ONE sentence with the exact number from the database.
- If the user asks a vague question, answer the most likely interpretation directly. Do NOT ask for clarification unless truly necessary.
- Never say "يمكنني مساعدتك" or "سؤال رائع" or "بالتأكيد" — just answer directly.
- If data is not in the grounding context, say: "ما عندي معلومات كافية عن هاد" — never invent facts.
`;

  const exampleDialect = `
DIALECT AND TONE — CRITICAL, ALWAYS FOLLOW:
You must sound like a Palestinian/Levantine university student helping a friend. Examples:

❌ NEVER say → ✅ ALWAYS say instead:
"يتضمن هذا التخصص" → "هاد التخصص فيه"
"تبلغ ساعاته المعتمدة" → "عدد ساعاته"
"يُعدّ هذا التخصص من التخصصات" → "هاد التخصص"
"يمكنك الالتحاق" → "بتقدر تنضم"
"فرص العمل المتاحة" → "وين بتشتغل بعدين"
"بشكل عام" → "يعني"
"بطبيعة الحال" → "طبعاً"
"من الجدير بالذكر" → just say the fact directly
"إذا كنت تمتلك" → "إذا عندك"
"يُنصح بذلك" → "أيه، منيح هيك"
"خريج هذا التخصص" → "اللي بتخرج منه"
"يشتغل في مسارات" → "بتلاقيه يشتغل"

WORD BANK — use these words naturally:
هاد، هاي، هيك، يعني، بتقدر، بدك، كتير، منيح، والله، ما في، في عندنا،
شو بدك، لازم، اشي، مو لازم، بالنسبة لـ، بتلاقي، بتشوف، خلص، تمام

SAMPLE GOOD ANSWER for "شو فرص العمل؟":
"بتلاقي خريج MIS يشتغل بأماكن كتير، مثلاً:
- محلل أنظمة في شركات تقنية
- مدير مشاريع IT
- مستشار أعمال رقمية
- بنوك وشركات تأمين
- حكومة أو مؤسسات دولية
والله خيارات كتير لأنه بيجمع بين التقنية والأعمال."

SAMPLE GOOD ANSWER for "صعب؟":
"يعني فيه مواد تقنية وفيه مواد أعمال — مو صعب كتير بس بدك تنتبه.
اللي بيحب التكنولوجيا والأعمال مع بعض بيلاقيه منيح."
`;
  const courseHandling = `
COURSES AND SUBJECTS RULES — CRITICAL:
When the user asks about courses, subjects, or "شو المواد" for a major:
- NEVER show course codes (numbers like 10676414) — these are internal database IDs, hide them completely
- NEVER list more than 8-10 courses
- Group courses into categories if possible (e.g., مواد تقنية، مواد أعمال، مواد عامة)
- Show only the course NAME and credit hours in a clean format
- Summarize in a friendly way, example:

"مواد MIS بتنقسم لثلاث مجموعات:

**مواد تقنية:**
- برمجة وتطوير أنظمة (3 ساعات)
- قواعد بيانات (3 ساعات)
- شبكات (3 ساعات)

**مواد أعمال:**
- محاسبة ومالية (3 ساعات)
- إدارة أعمال (3 ساعات)

**مواد عامة:**
- رياضيات (3 ساعات)
- إحصاء (3 ساعات)

المجموع الكلي 132 ساعة خلال 4 سنين."

- If there are too many courses in the database, pick the most representative ones and say "وفيه مواد ثانية كمان"
- Always end with the total credit hours and duration from the database
`;

  const scopeBlock = `
SCOPE — WHAT YOU CAN ANSWER:
You are a helpful AI assistant for An-Najah National University's digital platform. You can answer about:
1. Academic majors and faculties: courses, credit hours, duration, min admission average, career paths.
2. University events: list, dates, locations, reviews, ratings, sentiment analytics.
3. Student communities: name, description, which colleges can join, member count, chat status.
4. Platform usage: how to join communities, how events work, what roles exist, how to apply for events.
5. General university questions: colleges, academic structure, graduation project, student life.

PRIVACY AND SECURITY — NEVER SHARE:
- Passwords, password hashes, or any authentication credentials
- User email addresses, phone numbers, or any personal contact info
- Internal user IDs or admin account details
- Any information from tables: app_users passwords, tokens, sessions
- If asked for any of the above, say: "ما بقدر أشارك هاي المعلومات لأسباب أمنية" or "I can't share that for security reasons."

OUT OF SCOPE:
If the user asks something completely unrelated to the university platform (cooking, sports, general trivia, etc.), politely say you're specialized for An-Najah university services and offer to help with what you know.
`;

  const languageBlock =
    'You must always reply in the exact same language the user used in their message. ' +
    'If the user writes in Arabic, respond fully in Arabic. ' +
    'If the user writes in English, respond fully in English. ' +
    'Never switch languages unless the user does first.';

  // Mixed Arabic-English input defaults to Arabic, per global language rule
  const lineArabic = 'The user is writing in Arabic (or mixed Arabic-English). You MUST respond fully in Arabic only. Do NOT switch to English.';
  const lineEnglish = 'The user is writing in English. You MUST respond fully in English only. Do NOT switch to Arabic.';
  const languageEnforcement = languageIsArabic ? lineArabic : lineEnglish;

  const head = [
    "You are Najah AI Assistant for An-Najah National University's digital platform.",
    "Use ONLY the grounding context below for live database facts (events, reviews, analytics, communities). " +
      "Do not invent statistics, events, or community names not present in the grounding. If a section shows an error, acknowledge that the data was unavailable.",
    roleBlock,
    dialectBlock,
    scopeBlock,
    languageBlock,
    languageEnforcement,
    behaviorRules,
    exampleDialect,
    courseHandling,
  ];

  if (majorName && String(majorName).trim()) {
    const fac = majorFaculty != null && String(majorFaculty).trim() ? String(majorFaculty).trim() : '—';
    head.push(
      '',
      `The user is currently viewing the major page for: ${String(majorName).trim()} which belongs to the faculty of ${fac}. Prioritize answering questions about this major.`,
    );
  }

  return [
    ...head,
    '',
    '--- GROUNDING (authoritative) ---',
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

/**
 * Single Groq API call with a specific model.
 * @param {{ userMessage: string, systemPrompt: string, sessionId?: string | null, model: string }} p
 * @returns {Promise<string>}
 */
async function callGroq({ userMessage, systemPrompt, sessionId, model }) {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const messages = buildMessagesFromHistory(sessionId, systemPrompt, userMessage);

  const body = {
    model,
    messages,
    temperature: 0.25,
    max_tokens: 800,
    top_p: 0.85,
    frequency_penalty: 0.2,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getGroqKey()}`,
      },
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
 * Tries each model in GROQ_MODELS in order, falling back to the next on 429/503.
 * @param {{ userMessage: string, systemPrompt: string, sessionId?: string | null }} p
 * @returns {Promise<string>}
 */
async function callGroqWithFallback({ userMessage, systemPrompt, sessionId }) {
  for (const model of GROQ_MODELS) {
    try {
      return await callGroq({ userMessage, systemPrompt, sessionId, model });
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('429') || msg.includes('503')) {
        console.warn(`[callGroqWithFallback] ${model} rate-limited, trying next model`);
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
      ? [
          'شو مواد التخصص؟',
          'قديش عدد الساعات المعتمدة؟',
          'شو فرص العمل بعد التخرج؟',
          'صعب هاد التخصص؟',
        ]
      : [
          'What courses are in this major?',
          'How many credit hours are required?',
          'What career paths does this major lead to?',
          'Is this major difficult?',
        ];
  }
  return arabic
    ? [
        'شو الفعاليات القادمة؟',
        'شو المجتمعات الموجودة؟',
        'شو التخصصات في كلية تكنولوجيا المعلومات؟',
        'كيف أنضم لمجتمع؟',
      ]
    : [
        'What upcoming events are there?',
        'What communities are available?',
        'What majors are in the IT faculty?',
        'How do I join a community?',
      ];
}

// ---------------------------------------------------------------------------
// MAJOR INFERENCE
// ---------------------------------------------------------------------------

/**
 * Infers MIS major context from message content when no explicit majorName is passed.
 * Checks for Arabic MIS keywords, English MIS keywords, and 10676xxx course codes.
 * @param {string} message - Raw user message
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
// PUBLIC API
// ---------------------------------------------------------------------------

/**
 * Main entry point: builds grounding, constructs system prompt, calls Groq with fallback.
 * Falls back to local rule-based engine if Groq is unavailable or returns empty.
 * @param {{ sessionId?: string | null, userMessage: string, majorName?: string, majorFaculty?: string, userRole?: string }} p
 * @returns {Promise<{ answer: string, suggestions: string[], model: string, provider: string }>}
 */
export async function askChatbot({ sessionId, userMessage, majorName, majorFaculty, userRole = 'student' }) {
  const clean = String(userMessage || '').trim();
  if (!clean) {
    const err = new Error('question is required');
    err.statusCode = 400;
    throw err;
  }

  // Use explicitly passed major, or infer from message content (e.g. MIS keywords / 10676xxx codes)
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
  console.log('[askChatbot] GROQ key present:', groqKey ? `YES (${groqKey.slice(0, 8)}...)` : 'NO');

  if (groqKey) {
    try {
      const groundingContext = await buildFullGroundingString(clean, resolvedMajorName);
      const systemPrompt = buildSystemPrompt(groundingContext, { userMessage: clean, majorName: resolvedMajorName, majorFaculty: resolvedMajorFaculty, userRole });
      const answer = await callGroqWithFallback({ userMessage: clean, systemPrompt, sessionId });
      if (answer) {
        if (sessionId) appendSessionTurn(sessionId, clean, answer);
        return {
          answer,
          suggestions: buildSuggestions(clean, hasMajorContext),
          model: GROQ_MODELS[0],
          provider: 'groq',
        };
      }
    } catch (err) {
      console.error('[askChatbot] Groq failed — full error:', err);
    }
  }

  const answer = buildLocalChatResponse({ userMessage: clean, majorName: resolvedMajorName, majorFaculty: resolvedMajorFaculty });
  if (sessionId) appendSessionTurn(sessionId, clean, answer);
  return {
    answer,
    suggestions: buildSuggestions(clean, hasMajorContext),
    model: 'local-rule-based',
    provider: 'local',
  };
}

/**
 * @param {{ question: string, sessionId?: string | null, majorName?: string, majorFaculty?: string, userRole?: string }} p
 */
export async function answerQuestion({ question, sessionId, majorName, majorFaculty, userRole }) {
  return askChatbot({ userMessage: question, sessionId, majorName, majorFaculty, userRole });
}
