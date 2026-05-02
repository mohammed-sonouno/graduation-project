// Engine abstraction: production uses DbChatbotEngine (database-backed plans + repositories only).
export class ChatbotEngine {
  /**
   * @param {{ userId: number, conversationId: number, userMessage: string }} input
   * @returns {Promise<{ replyText: string }>}
   */
  // eslint-disable-next-line no-unused-vars
  async generate(input) {
    throw new Error('Not implemented');
  }
}

