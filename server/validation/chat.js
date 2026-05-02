import { AppError } from '../utils/AppError.js';

/**
 * Validates POST /api/chat body. No external schema dependency (matches prior zod rules).
 * @returns {{ message: string, conversationId?: number, majorId?: string }}
 */
export function parseChatBody(body) {
  const b = body || {};
  const rawMessage = b.message;
  if (typeof rawMessage !== 'string' || !rawMessage.trim()) {
    throw new AppError('message is required', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }

  let conversationId;
  if (b.conversationId != null && b.conversationId !== '') {
    conversationId = Number(b.conversationId);
    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      throw new AppError('conversationId must be a positive number', {
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      });
    }
  }

  let majorId;
  if (b.majorId != null && b.majorId !== '') {
    if (typeof b.majorId !== 'string' && typeof b.majorId !== 'number') {
      throw new AppError('majorId must be a string or number', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
    majorId = String(b.majorId).trim().slice(0, 100);
    if (!majorId) majorId = undefined;
  }

  return {
    message: rawMessage.trim().slice(0, 4000),
    conversationId,
    majorId
  };
}

/**
 * POST /api/chat/feedback — optional thumbs/rating on a logged turn.
 * @returns {{ interactionLogId: number, helpful?: boolean, rating?: number, comment?: string|null }}
 */
export function parseChatFeedbackBody(body) {
  const b = body || {};
  const rawId = b.interactionLogId;
  const interactionLogId = Number(rawId);
  if (!Number.isFinite(interactionLogId) || interactionLogId <= 0) {
    throw new AppError('interactionLogId must be a positive number', {
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    });
  }

  let helpful;
  if (b.helpful != null && b.helpful !== '') {
    if (typeof b.helpful === 'boolean') helpful = b.helpful;
    else if (b.helpful === 'true' || b.helpful === true) helpful = true;
    else if (b.helpful === 'false' || b.helpful === false) helpful = false;
    else {
      throw new AppError('helpful must be a boolean', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
  }

  let rating;
  if (b.rating != null && b.rating !== '') {
    rating = Number(b.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new AppError('rating must be an integer 1–5', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
  }

  let comment;
  if (b.comment != null && b.comment !== '') {
    comment = String(b.comment).trim().slice(0, 2000);
    if (!comment) comment = undefined;
  }

  return { interactionLogId, helpful, rating, comment };
}
