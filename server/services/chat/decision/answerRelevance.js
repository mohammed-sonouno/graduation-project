import { PlanTypes } from '../policy/accessPolicy.js';

/** Plan type -> draft kinds that are valid for that plan (factual pipeline only). */
const ALLOWED_DRAFTS = {
  [PlanTypes.GREET]: ['greet'],
  [PlanTypes.HELP]: ['help'],
  [PlanTypes.UNKNOWN]: ['unknown_intent'],
  [PlanTypes.WHOAMI]: ['whoami'],
  [PlanTypes.NOTIFICATIONS_LIST]: ['notifications_empty', 'notifications_list'],
  [PlanTypes.REGISTRATIONS_LIST]: ['registrations_empty', 'registrations_list'],
  [PlanTypes.EVENTS_COUNT]: ['events_count'],
  [PlanTypes.EVENT_DETAILS]: ['event_missing_id', 'event_not_found', 'event_details'],
  [PlanTypes.EVENTS_SEARCH]: ['events_search_prompt', 'events_search', 'not_in_database'],
  [PlanTypes.EVENTS_LIST]: ['events_list', 'not_in_database'],
  [PlanTypes.COMMUNITIES_SEARCH]: ['communities_search_prompt', 'communities_search', 'not_in_database'],
  [PlanTypes.COMMUNITIES_LIST]: ['communities_list', 'not_in_database'],
  [PlanTypes.ENGINEERING_RECOMMEND]: ['engineering_recommend', 'engineering_recommend_prompt'],
  [PlanTypes.ENGINEERING_ACCEPTANCE_QUERY]: [
    'engineering_acceptance',
    'engineering_acceptance_prompt',
    'not_in_database'
  ],
  [PlanTypes.ENGINEERING_COMPARE]: [
    'engineering_compare',
    'engineering_compare_prompt',
    'engineering_compare_partial',
    'not_in_database'
  ],
  [PlanTypes.ENGINEERING_FOLLOWUP_RANK]: [
    'engineering_followup_rank',
    'engineering_followup_need_context',
    'engineering_followup_need_stream',
    'engineering_recommend_prompt',
    'not_in_database'
  ],
  [PlanTypes.MAJOR_ADVISOR_SNAPSHOT]: ['major_advisor_snapshot', 'not_in_database'],
  [PlanTypes.MAJOR_ADVISOR_BEST]: [
    'major_advisor_best_eng',
    'major_advisor_best_non_eng',
    'major_advisor_need_average',
    'major_advisor_need_stream'
  ],
  [PlanTypes.UNIVERSITY_INFO]: ['university_qa', 'not_in_database'],
  [PlanTypes.FACULTY_INFO]: ['faculty_qa', 'faculty_abet', 'not_in_database']
};

/**
 * @param {object} p
 * @param {string} p.planType
 * @param {string} p.draftKind
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateAnswerAlignment({ planType, draftKind }) {
  const kind = String(draftKind || '');
  const pt = planType;
  const allowed = ALLOWED_DRAFTS[pt];
  if (!allowed) {
    return { ok: false, reason: 'unknown_plan_type' };
  }
  if (!allowed.includes(kind)) {
    return { ok: false, reason: 'draft_plan_mismatch', allowed, got: kind };
  }
  return { ok: true };
}
