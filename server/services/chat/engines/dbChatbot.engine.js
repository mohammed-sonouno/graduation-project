import { ChatbotEngine } from './chatbotEngine.js';
import { detectIntent } from './intentMap.js';
import { UserSafeRepository } from '../../../repositories/userSafe.repository.js';
import { EventsRepository } from '../../../repositories/events.repository.js';
import { CommunitiesRepository } from '../../../repositories/communities.repository.js';
import { NotificationsRepository } from '../../../repositories/notifications.repository.js';
import { EventRegistrationsRepository } from '../../../repositories/eventRegistrations.repository.js';
import { AccessPolicyGuard, PlanTypes } from '../policy/accessPolicy.js';
import { ConversationMemoryStore } from '../memory/conversationMemory.js';
import { TtlCache } from '../cache/ttlCache.js';
import { ProgramRecommendationService } from '../programRecommendation.service.js';
import { EngineeringProgramsRepository } from '../../../repositories/engineeringPrograms.repository.js';
import { UniversityKnowledgeRepository } from '../../../repositories/universityKnowledge.repository.js';
import { FacultyKnowledgeRepository } from '../../../repositories/facultyKnowledge.repository.js';
import { ResponseComposer } from '../response/responseComposer.js';
import { perfConfig, resolveQueryListLimit } from '../performance/config.js';
import { getProgramsCatalogCache } from '../performance/catalogCache.js';
import { explainFitSummary } from '../decision/recommendationExplanation.js';
import { buildComparisonLines } from '../decision/programComparison.js';
import { extractInterestTermsFromMessage, normalizeText, includesAny } from '../../../utils/chatText.js';
import { hasNonMajorGlobalIntentSignals } from '../decision/intentSignals.js';
import { extractChatEntities, isResolvedStream } from '../decision/chatEntities.js';
import { validateAnswerAlignment } from '../decision/answerRelevance.js';

function buildAcceptanceProgramDraft(p) {
  const min = p.minAvgMin != null && p.minAvgMin !== '' ? Number(p.minAvgMin) : null;
  const max = p.minAvgMax != null && p.minAvgMax !== '' ? Number(p.minAvgMax) : null;
  const hasMin = Number.isFinite(min);
  const hasMax = Number.isFinite(max);
  let rangeTextAr;
  let rangeTextEn;
  if (hasMin && hasMax) {
    rangeTextAr = `من ${min} إلى ${max}`;
    rangeTextEn = `${min}–${max}`;
  } else if (hasMin) {
    rangeTextAr = `حوالي ${min} فما فوق`;
    rangeTextEn = `around ${min} or above`;
  } else if (hasMax) {
    rangeTextAr = `حتى حوالي ${max}`;
    rangeTextEn = `up to around ${max}`;
  } else {
    rangeTextAr = 'غير متوفر حالياً';
    rangeTextEn = 'not available at the moment';
  }
  return {
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    streamType: p.streamType,
    isEstimate: p.isEstimate,
    rangeTextAr,
    rangeTextEn
  };
}

async function searchProgramsFromUserQuery(repo, rawQ, maxHits = 5) {
  const raw = String(rawQ || '').trim();
  if (!raw) return [];
  const parts = raw.split(/\s+/).filter((t) => t.length >= 2);
  const terms = [raw, ...[...new Set(parts)]];
  const seen = new Set();
  const hits = [];
  for (const term of terms) {
    const rows = await repo.searchByKeyword({ q: term, limit: maxHits });
    for (const row of rows) {
      const k = row.programKey;
      if (!seen.has(k)) {
        seen.add(k);
        hits.push(row);
      }
      if (hits.length >= maxHits) return hits;
    }
  }
  return hits;
}

async function resolveFullProgramRow(repo, label, excludeKeys = new Set()) {
  const hits = await searchProgramsFromUserQuery(repo, label, 8);
  for (const h of hits) {
    if (excludeKeys.has(h.programKey)) continue;
    const full = await repo.getByProgramKey(h.programKey);
    if (full) return full;
  }
  return null;
}

export class DbChatbotEngine extends ChatbotEngine {
  constructor({
    userSafeRepository = new UserSafeRepository(),
    eventsRepository = new EventsRepository(),
    communitiesRepository = new CommunitiesRepository(),
    notificationsRepository = new NotificationsRepository(),
    eventRegistrationsRepository = new EventRegistrationsRepository(),
    maxItems = resolveQueryListLimit(),
    policyGuard = new AccessPolicyGuard(),
    memoryStore = new ConversationMemoryStore(),
    cache = new TtlCache({
      ttlMs: perfConfig.eventsCountCacheTtlMs,
      max: perfConfig.eventsCountCacheMax
    }),
    programRecommendationService = new ProgramRecommendationService({
      catalogCache: getProgramsCatalogCache()
    }),
    engineeringProgramsRepository = new EngineeringProgramsRepository(),
    universityKnowledgeRepository = new UniversityKnowledgeRepository(),
    facultyKnowledgeRepository = new FacultyKnowledgeRepository(),
    responseComposer = new ResponseComposer()
  } = {}) {
    super();
    this.userSafe = userSafeRepository;
    this.events = eventsRepository;
    this.communities = communitiesRepository;
    this.notifications = notificationsRepository;
    this.registrations = eventRegistrationsRepository;
    this.maxItems = Number.isFinite(maxItems) ? maxItems : 5;
    this.policy = policyGuard;
    this.memory = memoryStore;
    this.cache = cache;
    this.recommender = programRecommendationService;
    this.programsRepo = engineeringProgramsRepository;
    this.uniRepo = universityKnowledgeRepository;
    this.facRepo = facultyKnowledgeRepository;
    this.composer = responseComposer;
  }

  async generate({ userId, conversationId, userMessage, majorPage = null }) {
    const t0 = perfConfig.perfLog ? Date.now() : 0;
    const memory = conversationId ? this.memory.get(conversationId) : null;
    const entities = extractChatEntities(userMessage, memory, majorPage);
    let intent = detectIntent(userMessage, memory, majorPage);
    const rawIntentName = intent?.name ?? null;
    if (intent.name === 'unknown' && majorPage && !hasNonMajorGlobalIntentSignals(userMessage)) {
      intent = { name: 'major_advisor_snapshot', params: { aspect: 'overview' } };
    }

    const plan = this.planFromIntent({ intent, userId, memory, userMessage, majorPage, entities });
    plan.majorPage = majorPage || null;
    plan.userMessage = userMessage;
    plan.questionComplexity = entities.questionComplexity;

    this.policy.assertPlanAllowed({ plan, userId });

    let { draft, debug } = await this.executePlan(plan);
    let answerValidation = validateAnswerAlignment({ planType: plan.type, draftKind: draft?.kind });
    let mismatchRecovered = false;
    if (!answerValidation.ok) {
      mismatchRecovered = true;
      draft = { kind: 'not_in_database' };
      debug = { ...(debug || {}), plan, answerValidation, mismatchRecovered: true };
    }

    const replyText = this.composer.compose(draft, userMessage, {
      majorPage,
      replyLocale: entities.replyLocale,
      questionComplexity: entities.questionComplexity
    });

    if (perfConfig.perfLog) {
      console.log(
        JSON.stringify({
          tag: 'chatbot.engine',
          plan: plan.type,
          intent: intent?.name,
          ms: Date.now() - t0
        })
      );
    }

    if (conversationId) {
      const prev = memory || {};
      const next = {
        ...prev,
        lastPlanType: plan.type,
        lastEntity: plan.entity,
        lastParams: plan.params,
        lastReplyLocale: entities.replyLocale
      };
      if (plan.type === PlanTypes.ENGINEERING_RECOMMEND) {
        const a = plan.params?.average;
        if (a != null && !Number.isNaN(Number(a))) next.lastAverage = Number(a);
        if (plan.params?.stream && isResolvedStream(plan.params.stream)) next.lastStream = plan.params.stream;
        if (plan.params?.interestTerms?.length) {
          next.lastInterestTerms = plan.params.interestTerms;
        }
        if (draft.kind === 'engineering_recommend') {
          next.lastSafeProgramKeys = (draft.safeOptions || []).map((p) => p.programKey).filter(Boolean);
          next.lastCompetitiveProgramKeys = (draft.competitiveOptions || [])
            .map((p) => p.programKey)
            .filter(Boolean);
          if (draft.streamLabel?.en === 'scientific' || draft.streamLabel?.en === 'industrial') {
            next.lastStream = draft.streamLabel.en;
          }
        }
      }
      if (plan.type === PlanTypes.ENGINEERING_FOLLOWUP_RANK) {
        const a = plan.params?.average;
        if (a != null && !Number.isNaN(Number(a))) next.lastAverage = Number(a);
        if (plan.params?.stream && isResolvedStream(plan.params.stream)) next.lastStream = plan.params.stream;
      }
      if (plan.type === PlanTypes.MAJOR_ADVISOR_BEST) {
        const a = plan.params?.average ?? (draft.kind === 'major_advisor_best_eng' ? draft.average : null);
        if (a != null && !Number.isNaN(Number(a))) next.lastAverage = Number(a);
        if (plan.params?.stream && isResolvedStream(plan.params.stream)) next.lastStream = plan.params.stream;
        if (draft.kind === 'major_advisor_best_eng') {
          next.lastSafeProgramKeys = (draft.safeOptions || []).map((p) => p.programKey).filter(Boolean);
          next.lastCompetitiveProgramKeys = (draft.competitiveOptions || [])
            .map((p) => p.programKey)
            .filter(Boolean);
          if (draft.streamLabel?.en === 'scientific' || draft.streamLabel?.en === 'industrial') {
            next.lastStream = draft.streamLabel.en;
          }
        }
      }
      if (majorPage) {
        next.pageMajorId = majorPage.majorId;
        next.pageMajorName = majorPage.majorName;
        next.pageProgramKey = majorPage.programKey;
      }
      this.memory.set(conversationId, next);
    }

    return {
      replyText,
      debug: {
        ...debug,
        plan,
        draftKind: draft?.kind ?? null,
        intentName: intent?.name ?? null,
        rawIntentName,
        extractedEntities: entities,
        answerValidation,
        mismatchRecovered
      }
    };
  }

  planFromIntent({ intent, userId, memory, userMessage, majorPage, entities = null }) {
    switch (intent.name) {
      case 'major_advisor_snapshot':
        return {
          type: PlanTypes.MAJOR_ADVISOR_SNAPSHOT,
          entity: 'majors',
          userId,
          params: intent.params || { aspect: 'overview' }
        };
      case 'major_advisor_best': {
        let average = entities?.average != null ? Number(entities.average) : null;
        if ((average == null || Number.isNaN(average)) && memory?.lastAverage != null) {
          average = Number(memory.lastAverage);
        }
        let streamUse = entities?.stream || null;
        if (!isResolvedStream(streamUse) && memory?.lastStream) streamUse = memory.lastStream;
        const interestTerms =
          entities?.interestTerms?.length ? entities.interestTerms : extractInterestTermsFromMessage(userMessage || '');
        return {
          type: PlanTypes.MAJOR_ADVISOR_BEST,
          entity: 'majors',
          params: { average, stream: streamUse, interestTerms }
        };
      }
      case 'greet':
        return { type: PlanTypes.GREET, entity: 'users_safe', userId };
      case 'help':
        return { type: PlanTypes.HELP };
      case 'unknown':
        return { type: PlanTypes.UNKNOWN };
      case 'whoami':
        return { type: PlanTypes.WHOAMI, entity: 'users_safe', userId };
      case 'notifications':
        return { type: PlanTypes.NOTIFICATIONS_LIST, entity: 'notifications', userId, params: intent.params || {} };
      case 'registrations':
        return { type: PlanTypes.REGISTRATIONS_LIST, entity: 'event_registrations', userId };
      case 'events_count':
        return { type: PlanTypes.EVENTS_COUNT, entity: 'events', params: intent.params || {} };
      case 'event_details':
        return { type: PlanTypes.EVENT_DETAILS, entity: 'events', params: intent.params || {} };
      case 'events_search':
        return { type: PlanTypes.EVENTS_SEARCH, entity: 'events', params: intent.params || {} };
      case 'events_list':
        return { type: PlanTypes.EVENTS_LIST, entity: 'events' };
      case 'communities_search':
        return { type: PlanTypes.COMMUNITIES_SEARCH, entity: 'communities', params: intent.params || {} };
      case 'communities_list':
        return { type: PlanTypes.COMMUNITIES_LIST, entity: 'communities' };
      case 'engineering_recommend': {
        const p = { ...(intent.params || {}) };
        if (entities?.average != null && !Number.isNaN(Number(entities.average))) {
          p.average = Number(entities.average);
        }
        if (isResolvedStream(entities?.stream)) {
          p.stream = entities.stream;
        }
        if (entities?.interestTerms?.length) {
          p.interestTerms = entities.interestTerms;
        }
        if ((p.average == null || Number.isNaN(Number(p.average))) && memory?.lastAverage != null) {
          p.average = memory.lastAverage;
        }
        if (!isResolvedStream(p.stream) && memory?.lastStream && isResolvedStream(memory.lastStream)) {
          p.stream = memory.lastStream;
        }
        if (!p.interestTerms?.length && memory?.lastInterestTerms?.length) {
          p.interestTerms = memory.lastInterestTerms;
        }
        return { type: PlanTypes.ENGINEERING_RECOMMEND, entity: 'engineering_programs', params: p };
      }
      case 'engineering_acceptance_query':
        return { type: PlanTypes.ENGINEERING_ACCEPTANCE_QUERY, entity: 'engineering_programs', params: intent.params || {} };
      case 'engineering_compare':
        return {
          type: PlanTypes.ENGINEERING_COMPARE,
          entity: 'engineering_programs',
          params: intent.params || {}
        };
      case 'engineering_followup_rank': {
        let average = entities?.average != null ? Number(entities.average) : null;
        if ((average == null || Number.isNaN(average)) && memory?.lastAverage != null) {
          average = Number(memory.lastAverage);
        }
        let stream = isResolvedStream(entities?.stream) ? entities.stream : null;
        if (!stream && memory?.lastStream && isResolvedStream(memory.lastStream)) {
          stream = memory.lastStream;
        }
        return {
          type: PlanTypes.ENGINEERING_FOLLOWUP_RANK,
          entity: 'engineering_programs',
          params: {
            keyA: memory?.lastSafeProgramKeys?.[0],
            keyB: memory?.lastSafeProgramKeys?.[1],
            average,
            stream
          }
        };
      }
      case 'university_info':
        return { type: PlanTypes.UNIVERSITY_INFO, entity: 'university_qa', params: intent.params || {} };
      case 'faculty_info':
        return { type: PlanTypes.FACULTY_INFO, entity: 'faculty_qa', params: intent.params || {} };
      default:
        return { type: PlanTypes.UNKNOWN };
    }
  }

  async executePlan(plan) {
    if (plan.type === PlanTypes.EVENTS_COUNT) {
      const key = `events_count:${plan.params?.status || 'all'}`;
      const cached = this.cache.get(key);
      if (cached) return cached;
      const res = await this.executePlanNoCache(plan);
      this.cache.set(key, res);
      return res;
    }
    return this.executePlanNoCache(plan);
  }

  async executePlanNoCache(plan) {
    switch (plan.type) {
      case PlanTypes.UNKNOWN:
        return { draft: { kind: 'unknown_intent' }, debug: { plan, sources: [] } };
      case PlanTypes.GREET: {
        const u = await this.userSafe.getSafeById(plan.userId);
        const majorPage = plan.majorPage || null;
        return {
          draft: { kind: 'greet', name: u?.name || '', majorPage },
          debug: { plan, sources: ['app_users', ...(majorPage ? ['major_chat_context'] : [])] }
        };
      }
      case PlanTypes.WHOAMI: {
        const u = await this.userSafe.getSafeById(plan.userId);
        return { draft: { kind: 'whoami', name: u?.name || '' }, debug: { plan, sources: ['app_users'] } };
      }
      case PlanTypes.HELP:
        return { draft: { kind: 'help' }, debug: { plan, sources: [] } };
      case PlanTypes.NOTIFICATIONS_LIST: {
        const unreadOnly = Boolean(plan.params?.unreadOnly);
        const n = await this.notifications.listByUserId({ userId: plan.userId, unreadOnly, limit: this.maxItems });
        if (n.length === 0) {
          return {
            draft: { kind: 'notifications_empty', unreadOnly },
            debug: { plan, sources: ['notifications'] }
          };
        }
        return {
          draft: {
            kind: 'notifications_list',
            items: n.map((x) => ({
              title: x.title,
              read: x.read,
              message: x.message
            }))
          },
          debug: { plan, sources: ['notifications'] }
        };
      }
      case PlanTypes.REGISTRATIONS_LIST: {
        const rows = await this.registrations.listByUserId({ userId: plan.userId, limit: this.maxItems });
        if (rows.length === 0) {
          return { draft: { kind: 'registrations_empty' }, debug: { plan, sources: ['event_registrations'] } };
        }
        return {
          draft: { kind: 'registrations_list', items: rows },
          debug: { plan, sources: ['event_registrations', 'events'] }
        };
      }
      case PlanTypes.EVENTS_COUNT: {
        const status = plan.params?.status;
        if (status) {
          const total = await this.events.countByStatus(status);
          return { draft: { kind: 'events_count', total, status }, debug: { plan, sources: ['events'] } };
        }
        const total = await this.events.countAll();
        return { draft: { kind: 'events_count', total }, debug: { plan, sources: ['events'] } };
      }
      case PlanTypes.EVENT_DETAILS: {
        const eventId = plan.params?.eventId;
        if (!eventId) return { draft: { kind: 'event_missing_id' }, debug: { plan } };
        const ev = await this.events.findById(eventId);
        if (!ev) return { draft: { kind: 'event_not_found', eventId }, debug: { plan, sources: ['events'] } };
        return { draft: { kind: 'event_details', event: ev }, debug: { plan, sources: ['events'] } };
      }
      case PlanTypes.EVENTS_SEARCH: {
        const q = plan.params?.q;
        if (!q) return { draft: { kind: 'events_search_prompt' }, debug: { plan } };
        const rows = await this.events.searchByTitle({ q, limit: this.maxItems });
        if (rows.length === 0) return { draft: { kind: 'not_in_database' }, debug: { plan, sources: ['events'] } };
        return { draft: { kind: 'events_search', q, items: rows }, debug: { plan, sources: ['events'] } };
      }
      case PlanTypes.EVENTS_LIST: {
        const rows = await this.events.listUpcoming({ limit: this.maxItems });
        if (rows.length === 0) return { draft: { kind: 'not_in_database' }, debug: { plan, sources: ['events'] } };
        return { draft: { kind: 'events_list', items: rows }, debug: { plan, sources: ['events'] } };
      }
      case PlanTypes.COMMUNITIES_SEARCH: {
        const q = plan.params?.q;
        if (!q) return { draft: { kind: 'communities_search_prompt' }, debug: { plan } };
        const rows = await this.communities.searchByName({ q, limit: Math.max(this.maxItems, 10) });
        if (rows.length === 0) return { draft: { kind: 'not_in_database' }, debug: { plan, sources: ['communities'] } };
        return { draft: { kind: 'communities_search', q, items: rows }, debug: { plan, sources: ['communities', 'colleges'] } };
      }
      case PlanTypes.COMMUNITIES_LIST: {
        const rows = await this.communities.list({ limit: Math.max(this.maxItems, 10) });
        if (rows.length === 0) return { draft: { kind: 'not_in_database' }, debug: { plan, sources: ['communities'] } };
        return { draft: { kind: 'communities_list', items: rows }, debug: { plan, sources: ['communities', 'colleges'] } };
      }
      case PlanTypes.ENGINEERING_RECOMMEND: {
        const avgRaw = plan.params?.average;
        const avg = typeof avgRaw === 'number' ? avgRaw : avgRaw != null ? Number(avgRaw) : NaN;
        const stream = plan.params?.stream;
        const interestTerms = plan.params?.interestTerms || [];
        if (typeof avg !== 'number' || Number.isNaN(avg)) {
          return {
            draft: { kind: 'engineering_recommend_prompt', promptFocus: 'average' },
            debug: { plan }
          };
        }
        if (!isResolvedStream(stream)) {
          return {
            draft: { kind: 'engineering_recommend_prompt', promptFocus: 'stream' },
            debug: { plan }
          };
        }

        const rec = await this.recommender.recommend({ average: avg, stream, interestTerms });
        const safeOptions = rec.safeOptions.slice(0, 6);
        const competitiveOptions = rec.competitiveOptions.slice(0, 6);
        const allShown = [...safeOptions, ...competitiveOptions];
        const hasEstimate = allShown.some((p) => p.isEstimate);
        const streamLabel = {
          ar: rec.user.stream === 'scientific' ? 'علمي' : rec.user.stream === 'industrial' ? 'صناعي' : null,
          en:
            rec.user.stream === 'scientific'
              ? 'scientific'
              : rec.user.stream === 'industrial'
                ? 'industrial'
                : null
        };

        const userStream = rec.user?.stream ?? null;
        const explainSafe = safeOptions.map((p) => ({
          programKey: p.programKey,
          ...explainFitSummary(p, avg, userStream, plan.questionComplexity)
        }));
        const explainCompetitive = competitiveOptions.slice(0, 4).map((p) => ({
          programKey: p.programKey,
          ...explainFitSummary(p, avg, userStream, plan.questionComplexity)
        }));

        return {
          draft: {
            kind: 'engineering_recommend',
            average: avg,
            streamLabel,
            streamUnspecified: rec.streamUnspecified,
            hasEstimate,
            safeOptions,
            competitiveOptions,
            ineligibleOptions: rec.ineligibleOptions || [],
            recommendationExplanations: { safe: explainSafe, competitive: explainCompetitive },
            interestMatchedNone: rec.interestMatchedNone,
            interestTerms: rec.interestTerms
          },
          debug: { plan, sources: ['engineering_programs'] }
        };
      }
      case PlanTypes.ENGINEERING_COMPARE: {
        const sideA = String(plan.params?.sideA || '').trim();
        const sideB = String(plan.params?.sideB || '').trim();
        if (!sideA || !sideB) {
          return { draft: { kind: 'engineering_compare_prompt' }, debug: { plan } };
        }
        const rowA = await resolveFullProgramRow(this.programsRepo, sideA, new Set());
        const rowB = await resolveFullProgramRow(this.programsRepo, sideB, new Set([rowA?.programKey].filter(Boolean)));
        if (!rowA && !rowB) {
          return { draft: { kind: 'not_in_database' }, debug: { plan, sources: ['engineering_programs'] } };
        }
        if (!rowA || !rowB) {
          return {
            draft: {
              kind: 'engineering_compare_partial',
              found: rowA || rowB,
              missingLabel: rowA ? sideB : sideA
            },
            debug: { plan, sources: ['engineering_programs'] }
          };
        }
        const { linesEn, linesAr, summaryEn, summaryAr } = buildComparisonLines(rowA, rowB);
        return {
          draft: { kind: 'engineering_compare', rowA, rowB, linesEn, linesAr, summaryEn, summaryAr },
          debug: { plan, sources: ['engineering_programs'] }
        };
      }
      case PlanTypes.ENGINEERING_FOLLOWUP_RANK: {
        const keyA = plan.params?.keyA;
        const keyB = plan.params?.keyB;
        const avgRaw = plan.params?.average;
        const avg = typeof avgRaw === 'number' ? avgRaw : avgRaw != null ? Number(avgRaw) : NaN;
        if (!keyA || !keyB) {
          return { draft: { kind: 'engineering_followup_need_context' }, debug: { plan } };
        }
        if (typeof avg !== 'number' || Number.isNaN(avg)) {
          return {
            draft: { kind: 'engineering_recommend_prompt', promptFocus: 'average' },
            debug: { plan }
          };
        }
        const userStream = plan.params?.stream ? String(plan.params.stream) : null;
        if (!isResolvedStream(userStream)) {
          return { draft: { kind: 'engineering_followup_need_stream' }, debug: { plan } };
        }
        const rowA = await this.programsRepo.getByProgramKey(keyA);
        const rowB = await this.programsRepo.getByProgramKey(keyB);
        if (!rowA || !rowB) {
          return { draft: { kind: 'not_in_database' }, debug: { plan, sources: ['engineering_programs'] } };
        }
        const fitA = explainFitSummary(rowA, avg, userStream, plan.questionComplexity);
        const fitB = explainFitSummary(rowB, avg, userStream, plan.questionComplexity);
        const { linesEn, linesAr, summaryEn, summaryAr } = buildComparisonLines(rowA, rowB);
        return {
          draft: {
            kind: 'engineering_followup_rank',
            rowA,
            rowB,
            average: avg,
            fitA,
            fitB,
            linesEn,
            linesAr,
            summaryEn,
            summaryAr
          },
          debug: { plan, sources: ['engineering_programs'] }
        };
      }
      case PlanTypes.ENGINEERING_ACCEPTANCE_QUERY: {
        const majorPage = plan.majorPage || null;
        const q = String(plan.params?.q || '').trim();
        if (!q) return { draft: { kind: 'engineering_acceptance_prompt' }, debug: { plan } };

        let hits = await searchProgramsFromUserQuery(this.programsRepo, q, 8);
        if (majorPage?.programKey) {
          const pref = hits.find((h) => h.programKey === majorPage.programKey);
          if (pref) {
            hits = [pref, ...hits.filter((h) => h.programKey !== majorPage.programKey)].slice(0, 5);
          }
        }
        if (hits.length === 0) {
          return { draft: { kind: 'not_in_database' }, debug: { plan, sources: ['engineering_programs'] } };
        }

        return {
          draft: {
            kind: 'engineering_acceptance',
            programs: hits.slice(0, 5).map(buildAcceptanceProgramDraft)
          },
          debug: { plan, sources: ['engineering_programs'] }
        };
      }
      case PlanTypes.MAJOR_ADVISOR_SNAPSHOT: {
        const majorPage = plan.majorPage || null;
        if (!majorPage) return { draft: { kind: 'unknown_intent' }, debug: { plan } };
        const hints = await this.userSafe.getAcademicHints(plan.userId);
        let engRow = null;
        if (majorPage.programKey) {
          engRow = await this.programsRepo.getByProgramKey(majorPage.programKey);
        }
        return {
          draft: {
            kind: 'major_advisor_snapshot',
            aspect: plan.params?.aspect || 'overview',
            majorPage,
            engRow,
            ctxRow: {
              factsEn: majorPage.factsEn,
              factsAr: majorPage.factsAr
            },
            profileGpa: hints.gpa,
            profileMajor: hints.profileMajor
          },
          debug: { plan, sources: ['majors', 'major_chat_context', 'engineering_programs'] }
        };
      }
      case PlanTypes.MAJOR_ADVISOR_BEST: {
        const majorPage = plan.majorPage || null;
        if (!majorPage) return { draft: { kind: 'unknown_intent' }, debug: { plan } };
        const hints = await this.userSafe.getAcademicHints(plan.userId);
        let avg = plan.params?.average;
        if (avg == null || Number.isNaN(Number(avg))) avg = hints.gpa;
        const stream = plan.params?.stream || null;
        const interestTerms = plan.params?.interestTerms || [];

        if (majorPage.category !== 'engineering' || !majorPage.programKey) {
          return {
            draft: {
              kind: 'major_advisor_best_non_eng',
              majorPage,
              profileGpa: hints.gpa,
              profileMajor: hints.profileMajor
            },
            debug: { plan, sources: ['majors', 'major_chat_context'] }
          };
        }

        if (avg == null || Number.isNaN(Number(avg))) {
          return {
            draft: { kind: 'major_advisor_need_average', majorPage },
            debug: { plan, sources: ['engineering_programs'] }
          };
        }

        const numAvg = Number(avg);
        if (!isResolvedStream(stream)) {
          return {
            draft: { kind: 'major_advisor_need_stream', majorPage, average: numAvg },
            debug: { plan, sources: ['engineering_programs'] }
          };
        }

        const rec = await this.recommender.recommend({ average: numAvg, stream, interestTerms });
        const safeOptions = rec.safeOptions.slice(0, 6);
        const competitiveOptions = rec.competitiveOptions.slice(0, 6);
        const allShown = [...safeOptions, ...competitiveOptions];
        const hasEstimate = allShown.some((p) => p.isEstimate);
        const streamLabel = {
          ar: rec.user.stream === 'scientific' ? 'علمي' : rec.user.stream === 'industrial' ? 'صناعي' : null,
          en:
            rec.user.stream === 'scientific'
              ? 'scientific'
              : rec.user.stream === 'industrial'
                ? 'industrial'
                : null
        };
        const userStream = rec.user?.stream ?? null;
        const explainSafe = safeOptions.map((p) => ({
          programKey: p.programKey,
          ...explainFitSummary(p, numAvg, userStream, plan.questionComplexity)
        }));
        const explainCompetitive = competitiveOptions.slice(0, 4).map((p) => ({
          programKey: p.programKey,
          ...explainFitSummary(p, numAvg, userStream, plan.questionComplexity)
        }));

        return {
          draft: {
            kind: 'major_advisor_best_eng',
            majorPage,
            average: numAvg,
            streamLabel,
            streamUnspecified: rec.streamUnspecified,
            hasEstimate,
            safeOptions,
            competitiveOptions,
            ineligibleOptions: rec.ineligibleOptions || [],
            recommendationExplanations: { safe: explainSafe, competitive: explainCompetitive },
            interestMatchedNone: rec.interestMatchedNone,
            interestTerms: rec.interestTerms
          },
          debug: { plan, sources: ['engineering_programs', 'majors'] }
        };
      }
      case PlanTypes.UNIVERSITY_INFO: {
        const raw = normalizeText(plan.userMessage || '');
        const words = raw.split(/\s+/).filter((w) => w.length >= 2);
        const hits = await this.uniRepo.searchQA({ terms: words, limit: 3 });
        if (hits.length) {
          return {
            draft: { kind: 'university_qa', matches: hits },
            debug: { plan, sources: ['university_qa'] }
          };
        }
        return { draft: { kind: 'not_in_database' }, debug: { plan, sources: ['university_qa'] } };
      }
      case PlanTypes.FACULTY_INFO: {
        const topic = plan.params?.topic;
        if (topic === 'abet') {
          const abetRows = await this.facRepo.getAbetPrograms();
          const qaHits = await this.facRepo.searchQA({ terms: ['abet', 'accredited', 'accreditation'], limit: 2 });
          return {
            draft: { kind: 'faculty_abet', programs: abetRows, qaMatches: qaHits },
            debug: { plan, sources: ['engineering_programs', 'faculty_qa'] }
          };
        }
        const raw = normalizeText(plan.userMessage || '');
        const words = raw.split(/\s+/).filter((w) => w.length >= 2);
        const facultyId = await this.facRepo.identifyFacultyId({ terms: words });
        const hits = await this.facRepo.searchQA({ terms: words, limit: 3, facultyId });
        if (hits.length) {
          return {
            draft: { kind: 'faculty_qa', matches: hits },
            debug: { plan, sources: ['faculty_qa'] }
          };
        }
        return { draft: { kind: 'not_in_database' }, debug: { plan, sources: ['faculty_qa'] } };
      }
      case PlanTypes.FEEDBACK_CORRECTION: {
        const message = plan.params?.message || plan.userMessage;
        // Store the correction in memory for potential future use
        if (conversationId) {
          const prev = this.memory.get(conversationId) || {};
          const corrections = prev.corrections || [];
          corrections.push({ message, timestamp: Date.now() });
          this.memory.set(conversationId, { ...prev, corrections });
        }
        return {
          draft: { kind: 'feedback_acknowledged', message },
          debug: { plan, sources: [] }
        };
      }
      default:
        return { draft: { kind: 'not_in_database' }, debug: { plan, reason: 'unhandled_plan' } };
    }
  }
}
