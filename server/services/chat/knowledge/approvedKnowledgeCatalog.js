/**
 * Schema-aware knowledge surface for the chatbot (documentation + runtime hints).
 * Source of truth for DB policy is chat_knowledge_allowlist; this mirrors it for code/tests
 * and documents relationships. Does not execute SQL.
 */

/** @typedef {{ from: string, to: string, kind: string }} KnowledgeRelation */

/** @type {KnowledgeRelation[]} */
export const APPROVED_KNOWLEDGE_RELATIONS = [
  { from: 'major_chat_context', to: 'engineering_programs', kind: 'programKey → engineering row when category=engineering' },
  { from: 'communities', to: 'colleges', kind: 'club → college name' },
  { from: 'event_registrations', to: 'events', kind: 'user registration → event' },
  { from: 'faculty_qa', to: 'engineering_programs', kind: 'optional cross-link for ABET/program lists' }
];

/**
 * Domains used in allowlist / catalog (align with DB CHECK on chat_knowledge_allowlist.domain).
 */
export const KNOWLEDGE_DOMAINS = [
  'university_knowledge',
  'faculty_knowledge',
  'engineering_programs',
  'major_page_context',
  'events',
  'communities',
  'notifications',
  'user_safe_profile',
  'operational',
  'logging_only'
];

/**
 * Tables the Node chatbot repositories are allowed to touch for factual answers
 * (narrow reads only; enforced by code structure, not dynamic SQL).
 */
export const RUNTIME_FACT_TABLES = new Set([
  'university_qa',
  'university_statistics',
  'university_timeline',
  'university_profiles',
  'faculty_qa',
  'faculty_statistics',
  'engineering_programs',
  'major_chat_context',
  'events',
  'communities',
  'colleges',
  'notifications',
  'event_registrations',
  'app_users',
  'student_profiles'
]);

/**
 * @param {string} tableName
 * @param {{ allowPii?: boolean }} [opts]
 * @returns {boolean}
 */
export function assertRuntimeFactTableAllowed(tableName, opts = {}) {
  const t = String(tableName || '').toLowerCase();
  if (!RUNTIME_FACT_TABLES.has(t)) return false;
  if (!opts.allowPii && (t === 'app_users' || t === 'student_profiles')) {
    return false;
  }
  return true;
}
