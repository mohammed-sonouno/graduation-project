/**
 * Classifies a composed reply for training / review (does not change runtime answers).
 * @param {string|null|undefined} answerKind - draft.kind from DbChatbotEngine
 * @param {{ mismatchRecovered?: boolean }} [options]
 * @returns {{ outcome: 'success'|'weak'|'failed', weakReason: string|null }}
 */
export function classifyChatOutcome(answerKind, options = {}) {
  if (options.mismatchRecovered) {
    return { outcome: 'failed', weakReason: 'validation_mismatch' };
  }

  const k = String(answerKind || '').trim();
  if (!k) return { outcome: 'success', weakReason: null };

  if (k === 'unknown_intent' || k === 'not_in_database') {
    return { outcome: 'failed', weakReason: k };
  }

  const weakPrompts = new Set([
    'engineering_recommend_prompt',
    'engineering_acceptance_prompt',
    'engineering_compare_prompt',
    'events_search_prompt',
    'communities_search_prompt',
    'major_advisor_need_average',
    'major_advisor_need_stream',
    'engineering_followup_need_context',
    'engineering_followup_need_stream',
    'engineering_compare_partial',
    'event_missing_id',
    'event_not_found'
  ]);

  if (weakPrompts.has(k) || k.endsWith('_prompt')) {
    return { outcome: 'weak', weakReason: k };
  }

  return { outcome: 'success', weakReason: null };
}
