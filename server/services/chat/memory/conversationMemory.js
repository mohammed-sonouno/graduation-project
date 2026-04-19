export class ConversationMemoryStore {
  constructor({ ttlMs = 10 * 60 * 1000 } = {}) {
    this.ttlMs = ttlMs;
    this.map = new Map();
  }

  get(conversationId) {
    const entry = this.map.get(conversationId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(conversationId);
      return null;
    }
    return entry.state;
  }

  set(conversationId, state) {
    this.map.set(conversationId, { state, expiresAt: Date.now() + this.ttlMs });
  }
}
