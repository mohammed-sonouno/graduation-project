/**
 * Answer relevance / plan alignment (facade for training + runtime guard).
 * Factual content still comes only from DB-backed drafts.
 */

import { validateAnswerAlignment } from './answerRelevance.js';

export { validateAnswerAlignment };

/**
 * @param {object} p
 * @param {string} p.planType
 * @param {string|null|undefined} p.draftKind
 * @param {{ ok?: boolean, reason?: string }|null|undefined} p.answerValidation
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateTurnForPolicy(p) {
  const alignment = validateAnswerAlignment({
    planType: p.planType,
    draftKind: p.draftKind
  });
  if (!alignment.ok) {
    return { ok: false, reason: alignment.reason || 'draft_plan_mismatch' };
  }
  if (p.answerValidation && p.answerValidation.ok === false) {
    return { ok: false, reason: p.answerValidation.reason || 'answer_validation_failed' };
  }
  return { ok: true };
}
