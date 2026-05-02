import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { manualKnowledgeBase } from '../chatbot/manualKnowledgeBase.js';
import { getSessionMessages, appendSessionTurn } from '../chatbot/sessionStore.js';
import prisma from '../lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

export { clearSession } from '../chatbot/sessionStore.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_VERSION = (process.env.GEMINI_API_VERSION || 'v1beta').replace(/^\//, '');
const GEMINI_TIMEOUT_MS = Math.max(1000, Number.parseInt(String(process.env.GEMINI_TIMEOUT_MS || '30000'), 10) || 30000);

const ARABIC_SCRIPT_RE = /[\u0600-\u06FF]/;

function ensureConfigured() {
  if (!GEMINI_API_KEY) {
    const error = new Error('Gemini chatbot is not configured. Add GEMINI_API_KEY to .env and restart the server.');
    error.statusCode = 503;
    throw error;
  }
}

function hasArabic(text = '') {
  return ARABIC_SCRIPT_RE.test(String(text));
}

function normalizeArabicText(text = '') {
  return String(text)
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '')
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

/**
 * Prisma: all events (summary) for grounding.
 * @returns {Promise<string>}
 */
export async function getEventContext() {
  try {
    const events = await prisma.event.findMany({
      select: { id: true, title: true, date: true, location: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    if (events.length === 0) return '[Database: no events found.]\n';
    const lines = events.map((e) => {
      const when = e.date ?? e.createdAt;
      const d = when ? new Date(when).toISOString().slice(0, 10) : '—';
      return `- [${e.id}] ${e.title} | when: ${d} | location: ${e.location ?? '—'}`;
    });
    return `Official events (from PostgreSQL via Prisma):\n${lines.join('\n')}\n`;
  } catch (err) {
    console.error('[getEventContext] Prisma error:', err?.message || err);
    return `[getEventContext failed: ${err?.message || err}]\n`;
  }
}

/**
 * Prisma: all events with reviews (ratings, comments, sentiments).
 * @returns {Promise<string>}
 */
export async function getEventDetailsContext() {
  try {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        reviews: {
          orderBy: { createdAt: 'desc' },
          select: {
            rating: true,
            comment: true,
            sentiment: true,
            overrideSentiment: true,
          },
        },
      },
    });
    if (events.length === 0) return '[Database: no events, no review details.]\n';
    const blocks = events.map((ev) => {
      const head = `Event: ${ev.title} (id: ${ev.id})`;
      if (!ev.reviews.length) return `${head}\n  (no reviews yet.)\n`;
      const body = ev.reviews
        .map((r) => {
          const c = r.comment && r.comment.trim() ? r.comment.replace(/\s+/g, ' ').trim() : '(no comment)';
          return `  - ${r.rating}/5 | sentiment: ${r.sentiment} | override: ${r.overrideSentiment ?? '—'} | ${c}`;
        })
        .join('\n');
      return `${head}\n${body}\n`;
    });
    return `Events with reviews (Prisma, live data):\n\n${blocks.join('\n')}\n`;
  } catch (err) {
    console.error('[getEventDetailsContext] Prisma error:', err?.message || err);
    return `[getEventDetailsContext failed: ${err?.message || err}]\n`;
  }
}

/**
 * Prisma: per-event review KPIs (effective sentiment prefers override over model).
 * @returns {Promise<string>}
 */
export async function getEventAnalyticsContext() {
  try {
    const events = await prisma.event.findMany({
      orderBy: { title: 'asc' },
      include: { reviews: true },
    });
    if (events.length === 0) return '[Database: no events for analytics.]\n';
    const lines = events.map((ev) => {
      const n = ev.reviews.length;
      if (n === 0) {
        return `- ${ev.title} (id: ${ev.id}): 0 reviews; avg: n/a; positive %: n/a.`;
      }
      let sum = 0;
      let pos = 0;
      let neu = 0;
      let neg = 0;
      for (const r of ev.reviews) {
        sum += r.rating;
        const es = effectiveSentimentForAnalytics(r);
        if (es === 'positive') pos += 1;
        else if (es === 'negative') neg += 1;
        else neu += 1;
      }
      const avg = (sum / n).toFixed(2);
      const posPct = ((pos / n) * 100).toFixed(1);
      return (
        `- ${ev.title} (id: ${ev.id}): reviews=${n} | avg rating=${avg}/5 | ` +
        `sentiment: +${pos} / ~${neu} / -${neg} (effective) | positive share=${posPct}%`
      );
    });
    return `Per-event analytics (Prisma, live reviews):\n${lines.join('\n')}\n`;
  } catch (err) {
    console.error('[getEventAnalyticsContext] Prisma error:', err?.message || err);
    return `[getEventAnalyticsContext failed: ${err?.message || err}]\n`;
  }
}

/**
 * Prisma: top reviews whose comments match any keyword from the user message.
 * @param {string} userMessage
 * @returns {Promise<string>}
 */
export async function getReviewSearchContext(userMessage) {
  try {
    const kws = extractKeywords(userMessage);
    if (kws.length === 0) {
      return (
        '[Review search: no extractable keywords; skipping DB keyword search. ' +
        'Other sections still list full reviews.]\n'
      );
    }
    const ors = kws.map((k) => ({
      comment: { contains: k, mode: 'insensitive' },
    }));
    const reviews = await prisma.review.findMany({
      where: { OR: ors },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { event: { select: { title: true } } },
    });
    if (reviews.length === 0) {
      return `[Review search: no comments matched keywords: ${kws.join(', ')}]\n`;
    }
    const top5 = reviews.slice(0, 5);
    const lines = top5.map((r) => {
      const title = r.event?.title ?? '(event)';
      const c = (r.comment || '').replace(/\s+/g, ' ').trim() || '(empty)';
      return `- “${title}” | ${r.rating}/5 | eff. ${effectiveSentimentForAnalytics(r)} | ${c.slice(0, 400)}`;
    });
    return `Top review matches for keywords [${kws.join(', ')}] (Prisma, max 5):\n${lines.join('\n')}\n`;
  } catch (err) {
    console.error('[getReviewSearchContext] Prisma error:', err?.message || err);
    return `[getReviewSearchContext failed: ${err?.message || err}]\n`;
  }
}

function getStaticCourseContext(majorName) {
  if (!majorName) return '';
  const name = majorName.toLowerCase();

  const courseMap = {
    'management information systems': `MIS main course areas: Programming & databases, Systems analysis & design, Networking & security, E-commerce & ERP, Business administration, Accounting & finance, Statistics, IT project management. Total: 132 credit hours, 4 years.`,
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
    let major = null;
    if (majorName && majorName.trim()) {
      major = await prisma.major.findFirst({
        where: { name: { contains: majorName.trim(), mode: 'insensitive' } },
      });
    }
    if (!major) return '[Major context: not found in database.]\n';
    const staticCourses = getStaticCourseContext(majorName);
    return `Major details from database:
- Name: ${major.name}
- Faculty: ${major.facultyName}
- Major Type: ${major.majorType || '—'}
- Credit Hours: ${major.creditHours}
- Duration: ${major.duration}
- Minimum Admission Average: ${major.minAdmission}
- Notes: ${major.notes || '—'}
- Course overview: ${staticCourses}
`;
  } catch (err) {
    console.error('[getMajorContext] Prisma error:', err?.message || err);
    return `[getMajorContext failed: ${err?.message || err}]\n`;
  }
}

export async function getAllMajorsContext() {
  try {
    const majors = await prisma.major.findMany({
      orderBy: [{ facultyName: 'asc' }, { name: 'asc' }],
      select: { name: true, facultyName: true, creditHours: true, duration: true, minAdmission: true, majorType: true },
    });
    if (majors.length === 0) return '[Database: no majors found.]\n';
    const grouped = {};
    for (const m of majors) {
      if (!grouped[m.facultyName]) grouped[m.facultyName] = [];
      const typePart = m.majorType && String(m.majorType).trim() ? ` | type: ${m.majorType}` : '';
      grouped[m.facultyName].push(`  - ${m.name} | ${m.duration} | ${m.creditHours} credits | min: ${m.minAdmission}${typePart}`);
    }
    const lines = Object.entries(grouped).map(([fac, items]) => `${fac}:\n${items.join('\n')}`);
    return `All university majors (from database):\n\n${lines.join('\n\n')}\n`;
  } catch (err) {
    console.error('[getAllMajorsContext] Prisma error:', err?.message || err);
    return `[getAllMajorsContext failed: ${err?.message || err}]\n`;
  }
}

function sanitizeGrounding(text) {
  if (!text || typeof text !== 'string') return text;
  // Remove lines that contain course codes (5+ digit numbers at start of line or after pipe)
  const lines = text.split('\n');
  const cleaned = lines.filter(line => {
    // Remove lines with course codes like 10676414
    if (/\b1\d{7}\b/.test(line)) return false;
    // Remove lines that are just numbers
    if (/^\s*\d+\s*$/.test(line)) return false;
    return true;
  });
  return cleaned.join('\n');
}

/**
 * @param {string} groundingContext — full string from all context builders
 * @param {{ userMessage: string, majorName?: string, majorFaculty?: string }} opts
 * @returns {string}
 */
export function buildSystemPrompt(groundingContext, opts = {}) {
  const { userMessage = '', majorName, majorFaculty } = opts;
  const u = String(userMessage);
  const languageIsArabic = ARABIC_SCRIPT_RE.test(u);
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

  const languageBlock =
    'You must always reply in the exact same language the user used in their message. ' +
    'If the user writes in Arabic, respond fully in Arabic. ' +
    'If the user writes in English, respond fully in English. ' +
    'Never switch languages unless the user does first.';

  const lineArabic = 'The user is writing in Arabic. You must respond in Arabic only.';
  const lineEnglish = 'The user is writing in English. You must respond in English only.';
  const languageEnforcement = languageIsArabic ? lineArabic : lineEnglish;

  const head = [
    'You are Najah AI Assistant for An-Najah National University’s digital platform.',
    'Use ONLY the grounding context below for live database facts (events, reviews, analytics). ' +
      'Do not invent statistics or events not present in the grounding. If a section shows an error, acknowledge that the data was unavailable.',
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

/**
 * @param {string} userMessage
 * @param {string} majorName
 * @returns {Promise<string>}
 */
async function buildFullGroundingString(userMessage, majorName) {
  const [evList, evDetails, evAnalytics, reviewSearch, majorCtx, allMajors] = await Promise.all([
    getEventContext(),
    getEventDetailsContext(),
    getEventAnalyticsContext(),
    getReviewSearchContext(userMessage),
    getMajorContext(majorName),
    getAllMajorsContext(),
  ]);
  return [
    '## 1) Event list', sanitizeGrounding(evList), '',
    '## 2) Event details + reviews', sanitizeGrounding(evDetails), '',
    '## 3) Event analytics', sanitizeGrounding(evAnalytics), '',
    '## 4) Review keyword search', sanitizeGrounding(reviewSearch), '',
    '## 5) Current major details', sanitizeGrounding(majorCtx), '',
    '## 6) All majors overview', sanitizeGrounding(allMajors),
  ].join('\n');
}

function developerContextFromHistory(sessionId) {
  const history = getSessionMessages(sessionId).slice(-8);
  return history.map((entry) => ({
    role: entry.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(entry.content || '') }],
  }));
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part.text || '').filter(Boolean).join('\n').trim();
  if (text) return text;
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (finishReason) return `Gemini returned no text. Finish reason: ${finishReason}`;
  return '';
}

/**
 * @param {{ userMessage: string, systemPrompt: string, sessionId?: string | null }} p
 */
async function callGemini({ userMessage, systemPrompt, sessionId }) {
  const modelPath = MODEL.startsWith('models/') ? MODEL : `models/${MODEL}`;
  const url = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/${modelPath}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const contents = [...developerContextFromHistory(sessionId), { role: 'user', parts: [{ text: String(userMessage) }] }];

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generation_config: { temperature: 0.35, top_p: 0.9, max_output_tokens: 1200 },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = await res.json();
  return extractGeminiText(data);
}

function buildSuggestions(question = '') {
  const arabic = hasArabic(question);
  return arabic
    ? [
        'شو مواد التخصص؟',
        'قديش عدد الساعات المعتمدة؟',
        'قديش مدة الدراسة؟',
        'شو فرص العمل بعد التخرج؟',
      ]
    : [
        'What courses are in this major?',
        'How many credit hours are required?',
        'How long does this major take?',
        'What career paths can I follow?',
      ];
}

/**
 * Main entry: loads DB grounding, builds system prompt (language + optional major), calls Gemini.
 * @param {{ sessionId?: string | null, userMessage: string, majorName?: string, majorFaculty?: string }} p
 * @returns {Promise<{ answer: string, suggestions: string[], model: string, provider: string }>}
 */
export async function askChatbot({ sessionId, userMessage, majorName, majorFaculty }) {
  const clean = String(userMessage || '').trim();
  if (!clean) {
    const err = new Error('question is required');
    err.statusCode = 400;
    throw err;
  }

  const answer = buildLocalChatResponse({
    userMessage: clean,
    majorName,
    majorFaculty,
  });

  if (sessionId) appendSessionTurn(sessionId, clean, answer);

  return {
    answer,
    suggestions: buildSuggestions(clean),
    model: 'local-rule-based',
    provider: 'local',
  };
}

/**
 * @param {{ question: string, sessionId?: string | null, majorName?: string, majorFaculty?: string }} p
 */
export async function answerQuestion({ question, sessionId, majorName, majorFaculty }) {
  return askChatbot({
    userMessage: question,
    sessionId,
    majorName,
    majorFaculty,
  });
}
