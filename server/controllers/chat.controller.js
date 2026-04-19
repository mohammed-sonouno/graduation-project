import { ChatService } from '../services/chat/chat.service.js';
import { AppError } from '../utils/AppError.js';
import { parseChatBody, parseChatFeedbackBody } from '../validation/chat.js';
import { ChatMlRepository } from '../repositories/chatMl.repository.js';

const chatService = new ChatService();
const chatMlRepo = new ChatMlRepository();

export async function postChat(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { message, conversationId, majorId } = parseChatBody(req.body);
    const result = await chatService.handleUserMessage({
      userId: Number(userId),
      conversationId,
      message,
      majorId
    });

    res.json({
      reply: result?.botMessage?.content,
      ...result
    });
  } catch (e) {
    if (e instanceof AppError) {
      return res.status(e.statusCode || 500).json({
        error: e.message,
        code: e.code,
        details: e.details
      });
    }
    next(e);
  }
}

export async function postChatFeedback(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { interactionLogId, helpful, rating, comment } = parseChatFeedbackBody(req.body);
    const log = await chatMlRepo.getLogForUser(interactionLogId, Number(userId));
    if (!log) {
      return res.status(404).json({ error: 'Interaction log not found' });
    }

    const row = await chatMlRepo.upsertFeedback({
      interactionLogId,
      userId: Number(userId),
      helpful,
      rating,
      comment
    });

    res.json({ ok: true, feedback: row });
  } catch (e) {
    if (e instanceof AppError) {
      return res.status(e.statusCode || 500).json({
        error: e.message,
        code: e.code,
        details: e.details
      });
    }
    next(e);
  }
}
