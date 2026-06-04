/** In-memory session: last 10 user+assistant message pairs (max 20 entries with { role, content }). */

const sessions = new Map();
const MAX_TURNS = 6;

/**
 * @returns {Array<{ role: string, content: string }>}
 */
export function getSessionMessages(sessionId) {
  if (!sessionId) return [];
  return sessions.get(sessionId) || [];
}

/**
 * @param {string} sessionId
 * @param {string} userText
 * @param {string} assistantText
 */
export function appendSessionTurn(sessionId, userText, assistantText) {
  if (!sessionId) return;
  const turns = sessions.get(sessionId) || [];
  turns.push({ role: 'user', content: String(userText || '') });
  turns.push({ role: 'assistant', content: String(assistantText || '') });
  sessions.set(sessionId, turns.slice(-MAX_TURNS * 2));
}

/**
 * @param {string} sessionId
 */
export function clearSession(sessionId) {
  if (!sessionId) return;
  sessions.delete(sessionId);
}
