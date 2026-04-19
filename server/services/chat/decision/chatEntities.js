import {
  normalizeText,
  includesAny,
  extractComparisonPair,
  extractInterestTermsFromMessage,
  detectQuestionComplexity
} from '../../../utils/chatText.js';
import { inferReplyLocale } from '../response/safeMessages.js';

/** @param {string|null|undefined} stream */
export function isResolvedStream(stream) {
  return stream === 'scientific' || stream === 'industrial';
}

/**
 * Structured extraction for logging, validation, and intent enrichment (DB-driven answers only).
 */
export function extractChatEntities(userMessage, memory = null, majorPage = null) {
  const raw = String(userMessage || '');
  const msg = normalizeText(raw);
  const avgMatch = msg.match(/(\d{2,3}(?:\.\d{1,2})?)/);
  let average = avgMatch ? Number(avgMatch[1]) : null;
  if (average != null && !Number.isFinite(average)) average = null;
  if (average == null && memory?.lastAverage != null && Number.isFinite(Number(memory.lastAverage))) {
    average = Number(memory.lastAverage);
  }

  let stream = includesAny(msg, ['scientific', 'علمي']) ? 'scientific' : includesAny(msg, ['industrial', 'صناعي']) ? 'industrial' : null;
  if (!stream && memory?.lastStream && isResolvedStream(memory.lastStream)) {
    stream = memory.lastStream;
  }

  const comparisonPair = extractComparisonPair(raw);
  const interestTerms = extractInterestTermsFromMessage(raw);
  const inferredLocale = inferReplyLocale(raw);
  const replyLocale =
    inferredLocale ||
    (memory?.lastReplyLocale === 'ar' || memory?.lastReplyLocale === 'en'
      ? memory.lastReplyLocale
      : 'en');

  const pageReference =
    majorPage &&
    (includesAny(msg, [
      'this major',
      'this programme',
      'this program',
      'هاد التخصص',
      'هذا التخصص',
      'هالبرنامج',
      'هاد البرنامج'
    ]) ||
      /\b(is|are)\s+(this|it)\b/i.test(raw) ||
      /\b(this|it)\s+(major|program|programme)\b/i.test(raw) ||
      includesAny(msg, ['هل هاد', 'هل هذا', 'هل هي', 'هل هو']));

  const questionComplexity = detectQuestionComplexity(raw);

  return {
    average,
    stream,
    interestTerms,
    comparisonPair,
    replyLocale,
    pageMajorId: majorPage?.majorId ?? null,
    programKey: majorPage?.programKey ?? null,
    category: majorPage?.category ?? null,
    pageReference: Boolean(pageReference),
    questionComplexity
  };
}
