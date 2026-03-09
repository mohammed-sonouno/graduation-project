/**
 * Analytics routes — event performance and feedback analysis.
 *
 * DATA SOURCE: All analytics are read from the database only. No mock or in-memory data.
 * - event_reviews: ratings, comments, sentiment (and optional user_id, registration_id)
 * - events: event existence and identity
 * - event_analytics_summary (view): registrations_count, identified_reviews for response rate
 *
 * DATA STORAGE: All writes are persisted to the database.
 * - New reviews: INSERT into event_reviews (POST /event/:eventId/reviews)
 * - Seed script: INSERT into event_reviews (server/seed-event-reviews.js)
 *
 * Computed metrics (KPI, trend, benchmarks, aspects, suggestions) are derived in-app from
 * the above DB data and returned to the client; they are not stored back to DB.
 */

import { Router } from 'express';
import { randomUUID } from 'node:crypto';

// EventId validation (events.id is VARCHAR(100) in this project)
function requireEventId(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const id = raw.trim();
  if (id.length === 0 || id.length > 100) return null;
  return id;
}

function toReviewRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    rating: row.rating,
    comment: row.comment,
    sentiment: row.sentiment,
    overrideSentiment: row.override_sentiment,
    sentimentScore: row.sentiment_score,
    sentimentRaw: row.sentiment_raw,
    language: row.language,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default function analyticsRouter(pool) {
  const router = Router();

  async function eventExists(eventId) {
    const result = await pool.query('SELECT 1 FROM events WHERE id = $1 LIMIT 1', [eventId]);
    return result.rows.length > 0;
  }

  function performanceLabel(avg) {
    if (avg >= 4.0) return 'Good';
    if (avg >= 3.0) return 'Okay';
    return 'Needs Improvement';
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function pct(n, total) {
    if (!total) return 0;
    return Math.round((n / total) * 100);
  }

  function normalizeElongation(text) {
    if (!text) return '';
    let t = String(text).toLowerCase().replace(/ـ/g, '');
    t = t.replace(/([a-z])\1{2,}/g, '$1');
    t = t.replace(/([\u0600-\u06FF])\1{2,}/g, '$1$1');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  function topPhraseFromComments(comments) {
    const stopEn = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'for', 'with', 'it', 'is', 'was', 'were', 'are', 'am',
      'this', 'that', 'these', 'those', 'i', 'we', 'you', 'they', 'he', 'she', 'my', 'our', 'your', 'their', 'very',
      'so', 'too', 'really', 'at', 'as', 'be', 'been', 'being', 'from', 'by', 'not',
    ]);
    const stopAr = new Set([
      'و', 'في', 'على', 'من', 'الى', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك', 'انا', 'أنا', 'نحن', 'انت', 'أنت', 'انتم', 'أنتم',
      'هو', 'هي', 'هم', 'هن', 'كان', 'كانت', 'يكون', 'تكون', 'جدا', 'جداً', 'كتير', 'كثير', 'مرة', 'مره', 'بس', 'يعني', 'مش', 'مو', 'لا', 'ما', 'كان',
    ]);
    const tokens = [];
    for (const c of comments) {
      if (!c) continue;
      const cleaned = normalizeElongation(String(c))
        .replace(/[0-9]/g, ' ')
        .replace(/[^؀-ۿa-z\s]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!cleaned) continue;
      for (const t of cleaned.split(' ')) {
        if (!t || t.length < 2) continue;
        if (stopEn.has(t) || stopAr.has(t)) continue;
        tokens.push(t);
      }
    }
    if (tokens.length === 0) return { phrase: null, count: 0 };
    const unigram = new Map();
    const bigram = new Map();
    for (let i = 0; i < tokens.length; i++) {
      const w = tokens[i];
      unigram.set(w, (unigram.get(w) || 0) + 1);
      if (i < tokens.length - 1) {
        const bg = w + ' ' + tokens[i + 1];
        bigram.set(bg, (bigram.get(bg) || 0) + 1);
      }
    }
    function pickTop(map) {
      let best = null;
      let bestCount = 0;
      for (const [k, v] of map.entries()) {
        if (v > bestCount) { best = k; bestCount = v; }
      }
      return { phrase: best, count: bestCount };
    }
    const topBi = pickTop(bigram);
    if (topBi.phrase && topBi.count >= 2) return topBi;
    return pickTop(unigram);
  }

  function buildTrend(reviews, daysLimit = 30) {
    const byDay = new Map();
    for (const r of reviews) {
      const d = new Date(r.createdAt);
      const day = d.toISOString().slice(0, 10);
      if (!byDay.has(day)) {
        byDay.set(day, { date: day, count: 0, sumRating: 0, pos: 0, neu: 0, neg: 0 });
      }
      const row = byDay.get(day);
      row.count += 1;
      row.sumRating += r.rating;
      const s = (r.effectiveSentiment || r.overrideSentiment || r.sentiment || 'neutral').toLowerCase();
      if (s === 'positive') row.pos += 1;
      else if (s === 'negative') row.neg += 1;
      else row.neu += 1;
    }
    const days = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
    const limited = days.slice(Math.max(0, days.length - daysLimit));
    return limited.map((x) => ({
      date: x.date,
      count: x.count,
      avgRating: Number((x.sumRating / x.count).toFixed(2)),
      positivePct: pct(x.pos, x.count),
      neutralPct: pct(x.neu, x.count),
      negativePct: pct(x.neg, x.count),
    }));
  }

  function computeKPI({ avgRating, positivePct, negativePct, totalReviews }) {
    const ratingScore = clamp((avgRating / 5) * 100, 0, 100);
    const sentimentScore = clamp((positivePct - negativePct + 100) / 2, 0, 100);
    const engagementScore = clamp((totalReviews / 10) * 100, 0, 100);
    const score = 0.50 * ratingScore + 0.35 * sentimentScore + 0.15 * engagementScore;
    const finalScore = Math.round(score);
    let tier = 'Good';
    if (finalScore >= 85) tier = 'Excellent';
    else if (finalScore >= 70) tier = 'Good';
    else if (finalScore >= 55) tier = 'Needs Improvement';
    else tier = 'Critical';
    return {
      score: finalScore,
      tier,
      components: {
        ratingScore: Math.round(ratingScore),
        sentimentScore: Math.round(sentimentScore),
        engagementScore: Math.round(engagementScore),
      },
      weights: { rating: 0.50, sentiment: 0.35, engagement: 0.15 },
    };
  }

  function computeRiskAlerts({ avgRating, negativePct, totalReviews, kpiScore, trend }) {
    const alerts = [];
    if (!totalReviews) return alerts;
    if (avgRating < 2.5 && totalReviews >= 3) {
      alerts.push({ type: 'LOW_RATING', severity: 'high', message: 'Average rating is below 2.5 (possible dissatisfaction).' });
    }
    if (negativePct >= 40 && totalReviews >= 5) {
      alerts.push({ type: 'HIGH_NEGATIVE_SENTIMENT', severity: 'high', message: 'Negative sentiment is 40% or higher.' });
    }
    if (kpiScore < 55 && totalReviews >= 3) {
      alerts.push({ type: 'LOW_KPI_SCORE', severity: 'high', message: 'Performance score is in the Critical range.' });
    } else if (kpiScore < 70 && totalReviews >= 3) {
      alerts.push({ type: 'MEDIUM_KPI_SCORE', severity: 'medium', message: 'Performance score indicates improvement is needed.' });
    }
    if (trend && trend.length >= 6) {
      const last3 = trend.slice(-3);
      const prev3 = trend.slice(-6, -3);
      const lastNeg = last3.reduce((a, x) => a + (x.negativePct * x.count), 0) / Math.max(1, last3.reduce((a, x) => a + x.count, 0));
      const prevNeg = prev3.reduce((a, x) => a + (x.negativePct * x.count), 0) / Math.max(1, prev3.reduce((a, x) => a + x.count, 0));
      if (lastNeg - prevNeg >= 15) {
        alerts.push({ type: 'NEGATIVE_SPIKE', severity: 'medium', message: 'Negative sentiment has increased significantly in the last few days.' });
      }
    }
    if (totalReviews < 3) {
      alerts.push({ type: 'LOW_FEEDBACK_VOLUME', severity: 'low', message: 'Very few reviews. Insights may be unreliable.' });
    }
    return alerts;
  }

  function normText(s = '') {
    let t = String(s).toLowerCase();
    t = t.replace(/[\u064B-\u0652\u0640]/g, '');
    t = t.replace(/([a-z])\1{2,}/g, '$1');
    t = t.replace(/([\u0600-\u06FF])\1{2,}/g, '$1');
    t = t.replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
    t = t.replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  const ASPECT_DEFS = [
    { key: 'organization', label: 'Organization & Timing', keywords: ['تنظيم', 'منظم', 'ترتيب', 'لخبط', 'فوضى', 'جدول', 'وقت', 'توقيت', 'schedule', 'timing', 'organized', 'organization', 'queue', 'line', 'delay', 'late'] },
    { key: 'content', label: 'Content & Value', keywords: ['محتوى', 'مفيد', 'استفدت', 'فائده', 'قيمه', 'موضوع', 'مواضيع', 'محاضره', 'جلسه', 'sessions', 'content', 'useful', 'valuable', 'learned', 'topic'] },
    { key: 'speakers', label: 'Speakers', keywords: ['محاضر', 'محاضرين', 'متحدث', 'المتحدث', 'سبيكر', 'speaker', 'speakers', 'presenter', 'presenters'] },
    { key: 'venue', label: 'Venue & Facilities', keywords: ['مكان', 'قاعة', 'قاعه', 'موقع', 'parking', 'باركنج', 'موقف', 'صاله', 'hall', 'venue', 'location', 'chairs', 'seats', 'air', 'sound', 'audio', 'mic'] },
    { key: 'registration', label: 'Registration & Entry', keywords: ['تسجيل', 'سجل', 'دخول', 'بوابه', 'بطاقه', 'id', 'qr', 'check in', 'checkin', 'registration', 'entry'] },
    { key: 'communication', label: 'Communication', keywords: ['اعلان', 'إعلان', 'رساله', 'معلومه', 'معلومات', 'تواصل', 'communication', 'info', 'details', 'announcement'] },
  ];

  function computeAspectBreakdown(reviews) {
    const buckets = {};
    for (const a of ASPECT_DEFS) {
      buckets[a.key] = { aspect: a.key, label: a.label, mentions: 0, positive: 0, neutral: 0, negative: 0, score: 0 };
    }
    for (const r of reviews) {
      const txt = normText(r.comment || '');
      if (!txt) continue;
      const s = (r.overrideSentiment || r.sentiment || 'neutral').toLowerCase();
      for (const a of ASPECT_DEFS) {
        const hit = a.keywords.some((k) => txt.includes(normText(k)));
        if (!hit) continue;
        const b = buckets[a.key];
        b.mentions += 1;
        b[s] = (b[s] || 0) + 1;
      }
    }
    return Object.values(buckets)
      .filter((x) => x.mentions > 0)
      .map((x) => ({ ...x, score: Number(((x.positive - x.negative) / x.mentions).toFixed(3)) }))
      .sort((a, b) => b.mentions - a.mentions);
  }

  function computeBenchmarks(eventId, eventStats, allEventStats) {
    const events = Object.values(allEventStats);
    const avgRatingAll = events.length ? events.reduce((s, e) => s + e.avgRating, 0) / events.length : 0;
    const avgPositivePctAll = events.length ? events.reduce((s, e) => s + e.positivePct, 0) / events.length : 0;
    const sorted = events.map((e) => e.avgRating).sort((a, b) => a - b);
    const r = eventStats.avgRating;
    let pctVal = 0;
    if (sorted.length) {
      const below = sorted.filter((x) => x <= r).length;
      pctVal = Math.round((below / sorted.length) * 100);
    }
    return {
      university: {
        avgRating: Number(avgRatingAll.toFixed(2)),
        avgPositivePct: Number(avgPositivePctAll.toFixed(1)),
        eventsCount: events.length,
      },
      event: {
        avgRating: Number(eventStats.avgRating.toFixed(2)),
        positivePct: Number(eventStats.positivePct.toFixed(1)),
        percentileRating: pctVal,
        deltaRating: Number((eventStats.avgRating - avgRatingAll).toFixed(2)),
        deltaPositivePct: Number((eventStats.positivePct - avgPositivePctAll).toFixed(1)),
      },
    };
  }

  function computeSuggestions({ avgRating, sentiment, aspects, riskAlerts }) {
    const suggestions = [];
    if (avgRating <= 2.5) suggestions.push('High priority: address the top pain points (organization, content quality, and venue comfort) before the next run.');
    else if (avgRating <= 3.5) suggestions.push('Focus on incremental improvements: reduce friction, clarify schedule, and strengthen session quality.');
    else suggestions.push('Maintain strengths and standardize what worked well; optimize a few operational details to protect the high rating.');
    if ((sentiment?.positivePct || 0) < 40) suggestions.push('Boost attendee satisfaction by improving communication (clear agenda, reminders, and on-site guidance).');
    const worst = (aspects || [])
      .map((a) => ({ ...a, negRate: a.mentions ? (a.negative / a.mentions) : 0 }))
      .sort((a, b) => b.negRate - a.negRate)
      .slice(0, 2);
    for (const w of worst) {
      if (w.negRate < 0.35) continue;
      if (w.aspect === 'organization') suggestions.push('Organization: tighten timing, reduce delays/queues, and assign clear staff roles for flow control.');
      if (w.aspect === 'venue') suggestions.push('Venue: improve signage/seating/AV; verify sound quality and comfort in advance.');
      if (w.aspect === 'registration') suggestions.push('Registration: streamline check-in (QR scan), add an extra desk at peak times, and pre-communicate entry steps.');
      if (w.aspect === 'content') suggestions.push('Content: align sessions with attendee expectations; add practical demos, clearer objectives, and better pacing.');
      if (w.aspect === 'speakers') suggestions.push('Speakers: brief presenters on time limits and audience level; prioritize engaging delivery and Q&A.');
      if (w.aspect === 'communication') suggestions.push('Communication: send agenda + location map earlier; highlight starting times and changes via one clear channel.');
    }
    if ((riskAlerts || []).some((a) => a.type === 'spam')) suggestions.push('Quality control: add anti-spam rules (rate limits, duplicate detection) to protect analytics reliability.');
    if ((riskAlerts || []).some((a) => a.type === 'low_sample')) suggestions.push('Data quality: increase review volume (QR code at exit, small incentive) to make analytics statistically reliable.');
    return Array.from(new Set(suggestions)).slice(0, 6);
  }

  const TOPIC_DEFS = [
    { key: 'organization', label: 'Organization / Planning', keywords: ['تنظيم', 'منظم', 'ترتيب', 'سريع', 'تأخير', 'تأخرت', 'ازدحام', 'queue', 'line', 'delay', 'organization', 'organized'] },
    { key: 'venue', label: 'Venue / Location', keywords: ['مكان', 'قاعة', 'لوكيشن', 'موقع', 'قرب', 'بعيد', 'parking', 'location', 'venue', 'hall'] },
    { key: 'content', label: 'Content / Speakers', keywords: ['محتوى', 'محاضرة', 'محاضرات', 'متحدث', 'متحدثين', 'دكتور', 'عرض', 'ورشة', 'ورش', 'speaker', 'talk', 'workshop', 'content'] },
    { key: 'staff', label: 'People / Staff', keywords: ['الناس', 'طاقم', 'موظف', 'موظفين', 'مساعد', 'تعامل', 'لطيف', 'لطيفة', 'staff', 'team', 'people', 'friendly'] },
    { key: 'value', label: 'Value / Quality', keywords: ['مفيد', 'فائدة', 'قيمة', 'جودة', 'احترافي', 'فخم', 'روعة', 'بجنن', 'نار', 'great', 'amazing', 'excellent', 'quality', 'value'] },
    { key: 'food', label: 'Food / Hospitality', keywords: ['اكل', 'أكل', 'ضيافة', 'قهوة', 'ماء', 'ساندويش', 'food', 'snacks', 'coffee', 'hospitality'] },
  ];

  function extractTopicsFromTexts(texts = []) {
    const counts = new Map();
    for (const def of TOPIC_DEFS) counts.set(def.key, 0);
    const joined = texts.join(' || ').toLowerCase();
    for (const def of TOPIC_DEFS) {
      let c = 0;
      for (const kw of def.keywords) {
        const k = normalizeElongation(String(kw)).toLowerCase();
        if (!k) continue;
        const re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const m = joined.match(re);
        if (m) c += m.length;
      }
      if (c > 0) counts.set(def.key, c);
    }
    return TOPIC_DEFS
      .map((d) => ({ key: d.key, label: d.label, count: counts.get(d.key) || 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  function toCsv(rows) {
    if (!rows || rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const esc = (v) => {
      const s = String(v ?? '');
      if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.map(esc).join(',')];
    for (const r of rows) {
      lines.push(headers.map((h) => esc(r[h])).join(','));
    }
    return lines.join('\n');
  }

  // GET /event/:eventId — full analytics for one event (events must be linked to a community)
  router.get('/event/:eventId', async (req, res) => {
    try {
      const eventId = requireEventId(req.params.eventId);
      if (!eventId) return res.status(400).json({ error: 'Invalid eventId' });
      if (!(await eventExists(eventId))) return res.status(404).json({ error: 'Event not found' });

      const eventRow = await pool.query(
        `SELECT e.id, e.community_id, c.name AS community_name
         FROM events e
         LEFT JOIN communities c ON c.id = e.community_id
         WHERE e.id = $1`,
        [eventId]
      );
      const ev = eventRow.rows[0];
      if (!ev || ev.community_id == null) {
        return res.status(400).json({ error: 'Analytics are available only for events linked to a community.' });
      }
      const communityId = ev.community_id;
      const communityName = ev.community_name || null;

      // Reviews are stored with event_id; analytics scope by event_id so each event's metrics use only its reviews
      const revResult = await pool.query(
        `SELECT id, event_id, rating, sentiment, override_sentiment, comment, created_at
         FROM event_reviews WHERE event_id = $1`,
        [eventId]
      );
      const reviews = revResult.rows.map(toReviewRow);

      const total = reviews.length;
      // Empty shape when DB returned no rows for this event (no mock data; all zeros from DB)
      if (total === 0) {
        const summaryResult = await pool.query(
          `SELECT registrations_count, identified_reviews FROM event_analytics_summary WHERE id = $1`,
          [eventId]
        );
        const summary = summaryResult.rows[0] || {};
        const registrationsCount = Number(summary.registrations_count || 0);
        return res.json({
          eventId,
          communityId,
          communityName,
          totalReviews: 0,
          averageRating: 0,
          overallPerformance: 'No Data',
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          sentiment: { positive: 0, neutral: 0, negative: 0 },
          sentimentPercentages: { positive: 0, neutral: 0, negative: 0 },
          topPhrase: { phrase: null, count: 0 },
          kpi: null,
          registrationsCount,
          identifiedReviewsCount: 0,
          responseRate: 0,
          riskAlerts: [],
          benchmarks: null,
          aspects: [],
          suggestions: [],
          recentReviews: [],
        });
      }

      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      const avg = sum / total;
      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const sentiment = { positive: 0, neutral: 0, negative: 0 };

      for (const r of reviews) {
        ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
        const s = (r.overrideSentiment || r.sentiment || 'neutral').toLowerCase();
        sentiment[s] = (sentiment[s] || 0) + 1;
      }

      const comments = reviews.map((r) => r.comment).filter(Boolean);
      const topPhrase = topPhraseFromComments(comments);
      const positivePct = pct(sentiment.positive, total);
      const neutralPct = pct(sentiment.neutral, total);
      const negativePct = pct(sentiment.negative, total);
      const trend = buildTrend(reviews, 30);
      const kpi = computeKPI({ avgRating: avg, positivePct, negativePct, totalReviews: total });
      const riskAlerts = computeRiskAlerts({ avgRating: avg, negativePct, totalReviews: total, kpiScore: kpi.score, trend });

      const summaryResult = await pool.query(
        `SELECT registrations_count, identified_reviews
         FROM event_analytics_summary
         WHERE id = $1`,
        [eventId]
      );
      const summary = summaryResult.rows[0] || {};
      const registrationsCount = Number(summary.registrations_count || 0);
      const identifiedReviewsCount = Number(summary.identified_reviews || 0);
      const responseRate = registrationsCount > 0
        ? Number(Math.min(100, ((total / registrationsCount) * 100)).toFixed(1))
        : 0;

      const allRevResult = await pool.query(
        `SELECT event_id, rating, sentiment, override_sentiment FROM event_reviews`
      );
      const allReviews = allRevResult.rows.map(toReviewRow);
      const allEventStats = {};
      for (const r of allReviews) {
        const eid = r.eventId;
        if (!allEventStats[eid]) allEventStats[eid] = { sumRating: 0, count: 0, pos: 0 };
        allEventStats[eid].sumRating += Number(r.rating || 0);
        allEventStats[eid].count += 1;
        const s = r.overrideSentiment || r.sentiment || 'neutral';
        if (s === 'positive') allEventStats[eid].pos += 1;
      }
      for (const st of Object.values(allEventStats)) {
        st.avgRating = st.count ? st.sumRating / st.count : 0;
        st.positivePct = st.count ? (st.pos / st.count) * 100 : 0;
      }
      const eventStats = { avgRating: avg, positivePct };
      const benchmarks = computeBenchmarks(eventId, eventStats, allEventStats);
      const aspects = computeAspectBreakdown(reviews);
      const sentimentSummary = {
        ...sentiment,
        positivePct,
        neutralPct,
        negativePct,
      };
      const suggestions = computeSuggestions({ avgRating: avg, sentiment: sentimentSummary, aspects, riskAlerts });

      // Recent reviews for dashboard (last 10, same shape as analytics)
      const recentReviews = reviews
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10)
        .map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          sentiment: (r.overrideSentiment || r.sentiment || 'neutral').toLowerCase(),
          createdAt: r.createdAt,
        }));

      res.json({
        eventId,
        communityId,
        communityName,
        totalReviews: total,
        averageRating: Number(avg.toFixed(2)),
        overallPerformance: performanceLabel(avg),
        ratingDistribution,
        sentiment,
        sentimentPercentages: {
          positive: positivePct,
          neutral: neutralPct,
          negative: negativePct,
        },
        topPhrase,
        kpi,
        registrationsCount,
        identifiedReviewsCount,
        responseRate,
        riskAlerts,
        benchmarks,
        aspects,
        suggestions,
        recentReviews,
      });
    } catch (err) {
      console.error('analytics event error:', err);
      res.status(500).json({ error: 'Failed to load analytics' });
    }
  });

  // POST /event/:eventId/reviews — create a review (rating 1–5, optional comment). Sentiment set by rule: 4–5 positive, 1–2 negative, 3 neutral.
  router.post('/event/:eventId/reviews', async (req, res) => {
    try {
      const eventId = requireEventId(req.params.eventId);
      if (!eventId) return res.status(400).json({ error: 'Invalid eventId' });
      if (!(await eventExists(eventId))) return res.status(404).json({ error: 'Event not found' });
      const body = req.body || {};
      const rating = body.rating != null ? Number(body.rating) : NaN;
      if (Number.isNaN(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'rating is required and must be 1–5' });
      }
      const comment = typeof body.comment === 'string' ? body.comment.trim() || null : null;
      const sentiment = rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'neutral';
      const sentimentScore = rating >= 4 ? 0.8 : rating <= 2 ? -0.6 : 0;
      const id = randomUUID();
      await pool.query(
        `INSERT INTO event_reviews (id, event_id, rating, comment, sentiment, sentiment_score, language, source, is_seeded, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'unknown', 'manual', false, NOW())`,
        [id, eventId, rating, comment, sentiment, sentimentScore]
      );
      const row = (await pool.query(
        `SELECT id, event_id, rating, comment, sentiment, override_sentiment, sentiment_score, created_at
         FROM event_reviews WHERE id = $1`,
        [id]
      )).rows[0];
      res.status(201).json(toReviewRow(row));
    } catch (err) {
      if (err?.code === '23503') return res.status(404).json({ error: 'Event not found' });
      if (err?.code === '23505') return res.status(409).json({ error: 'A review for this event already exists for this participant' });
      console.error('analytics create review error:', err);
      res.status(500).json({ error: 'Failed to create review' });
    }
  });

  // GET /event/:eventId/trend
  router.get('/event/:eventId/trend', async (req, res) => {
    try {
      const eventId = requireEventId(req.params.eventId);
      if (!eventId) return res.status(400).json({ error: 'Invalid eventId' });
      if (!(await eventExists(eventId))) return res.status(404).json({ error: 'Event not found' });
      const days = Number(req.query.days || 30);

      const revResult = await pool.query(
        `SELECT rating, sentiment, override_sentiment, created_at FROM event_reviews WHERE event_id = $1`,
        [eventId]
      );
      const reviews = revResult.rows.map((r) => {
        const row = toReviewRow(r);
        row.effectiveSentiment = (row.overrideSentiment || row.sentiment || 'neutral').toLowerCase();
        return row;
      });
      const trend = buildTrend(reviews, clamp(days, 7, 180));
      res.json({ days: clamp(days, 7, 180), trend });
    } catch (err) {
      console.error('analytics trend error:', err);
      res.status(500).json({ error: 'Failed to load trend' });
    }
  });

  // GET /topics?eventId=...
  router.get('/topics', async (req, res) => {
    try {
      const eventId = requireEventId(req.query.eventId);
      if (!eventId) return res.status(400).json({ error: 'eventId is required' });
      if (!(await eventExists(eventId))) return res.status(404).json({ error: 'Event not found' });

      const revResult = await pool.query(
        `SELECT comment FROM event_reviews WHERE event_id = $1`,
        [eventId]
      );
      const texts = revResult.rows.map((r) => r.comment || '').filter(Boolean);
      const topics = extractTopicsFromTexts(texts);
      res.json({ eventId, topics });
    } catch (err) {
      console.error('analytics topics error:', err);
      res.status(500).json({ error: 'Failed to load topics' });
    }
  });

  // GET /export/reviews.csv
  router.get('/export/reviews.csv', async (req, res) => {
    try {
      const eventId = req.query.eventId ? requireEventId(req.query.eventId) : null;
      if (req.query.eventId && !eventId) return res.status(400).json({ error: 'Invalid eventId' });
      if (eventId && !(await eventExists(eventId))) return res.status(404).json({ error: 'Event not found' });
      const where = eventId ? 'WHERE event_id = $1' : '';
      const params = eventId ? [eventId] : [];
      const revResult = await pool.query(
        `SELECT id, event_id, rating, comment, sentiment, override_sentiment, created_at
         FROM event_reviews ${where} ORDER BY created_at DESC`,
        params
      );
      const rows = revResult.rows.map((r) => ({
        id: r.id,
        eventId: r.event_id,
        rating: r.rating,
        comment: r.comment,
        predictedSentiment: r.sentiment,
        adminOverride: r.override_sentiment || '',
        finalSentiment: r.override_sentiment || r.sentiment,
        createdAt: r.created_at,
      }));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="reviews${eventId ? `-event-${eventId}` : ''}.csv"`);
      res.send(toCsv(rows));
    } catch (err) {
      console.error('analytics export reviews error:', err);
      res.status(500).json({ error: 'Failed to export reviews' });
    }
  });

  // GET /export/alerts.csv
  router.get('/export/alerts.csv', async (req, res) => {
    try {
      const eventId = requireEventId(req.query.eventId);
      if (!eventId) return res.status(400).json({ error: 'eventId is required' });
      if (!(await eventExists(eventId))) return res.status(404).json({ error: 'Event not found' });

      const revResult = await pool.query(
        `SELECT comment FROM event_reviews WHERE event_id = $1`,
        [eventId]
      );
      const comments = revResult.rows.map((r) => (r.comment || '').toLowerCase());
      const alertWords = [
        'scam', 'fraud', 'unsafe', 'harassment', 'danger', 'threat',
        'احتيال', 'نصب', 'خطر', 'غير امن', 'تحرش', 'تهديد', 'مشكلة امن', 'تزوير',
      ];
      const alerts = [];
      for (const w of alertWords) {
        const c = comments.filter((t) => t.includes(w)).length;
        if (c > 0) alerts.push({ eventId, keyword: w, count: c });
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="risk-alerts-event-${eventId}.csv"`);
      res.send(toCsv(alerts));
    } catch (err) {
      console.error('analytics export alerts error:', err);
      res.status(500).json({ error: 'Failed to export alerts' });
    }
  });

  return router;
}
