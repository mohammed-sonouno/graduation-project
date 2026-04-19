import { Router } from 'express';
import {
  getChatMlLogs,
  getChatMlLogById,
  getChatMlStats,
  getChatKnowledgeAllowlist,
  getChatMlModelRegistry,
  postChatMlModelRegistry,
  patchChatMlModelRegistry,
  getChatMlExport,
  postChatMlGoldLabel,
  postChatMlReview,
  listChatMlReview,
  patchChatMlReview
} from '../controllers/chatMlAdmin.controller.js';

export function createChatMlAdminRouter() {
  const router = Router();
  router.get('/logs', getChatMlLogs);
  router.get('/logs/:id', getChatMlLogById);
  router.get('/stats', getChatMlStats);
  router.get('/knowledge-allowlist', getChatKnowledgeAllowlist);
  router.get('/model-registry', getChatMlModelRegistry);
  router.post('/model-registry', postChatMlModelRegistry);
  router.patch('/model-registry/:id', patchChatMlModelRegistry);
  router.get('/export', getChatMlExport);
  router.post('/labels', postChatMlGoldLabel);
  router.post('/review-queue', postChatMlReview);
  router.get('/review-queue', listChatMlReview);
  router.patch('/review-queue/:id', patchChatMlReview);
  return router;
}
