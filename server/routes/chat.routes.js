import { Router } from 'express';
import { postChat, postChatFeedback } from '../controllers/chat.controller.js';

export function createChatRouter() {
  const router = Router();
  router.post('/feedback', postChatFeedback);
  router.post('/', postChat);
  return router;
}
