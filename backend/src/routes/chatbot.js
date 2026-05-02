import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { askChatbot, clearSession } from '../services/chatbotService.js';

const router = Router();

router.get('/suggestions', (req, res) => {
  const isArabic = /ar/i.test(String(req.query.lang || ''));
  res.json({
    suggestions: isArabic
      ? [
          'ما هي الفعاليات القادمة؟',
          'اشرح لي كيف يعمل نظام المجتمعات؟',
          'ما الذي يفعله تحليل المشاعر في الموقع؟',
          'لخص لي آخر فعالية موجودة في البيانات',
        ]
      : [
          'What upcoming events are available?',
          'How does the communities workflow work?',
          'What does the sentiment analysis feature do?',
          'Summarize the latest event in the database',
        ],
  });
});

router.post('/ask', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const rawQ = body.question != null ? body.question : body.message;
    const question = String(rawQ || '').trim();
    let sessionId = String(body.sessionId || '').trim() || null;
    if (!sessionId) sessionId = randomUUID();

    if (!question) return res.status(400).json({ error: 'question is required' });

    const majorName = body.majorName != null && String(body.majorName).trim() ? String(body.majorName).trim() : undefined;
    const majorFaculty = body.majorFaculty != null && String(body.majorFaculty).trim() ? String(body.majorFaculty).trim() : undefined;

    const result = await askChatbot({
      sessionId,
      userMessage: question,
      majorName,
      majorFaculty,
    });
    return res.json({ ...result, sessionId });
  } catch (error) {
    console.error('Chatbot route error:', error);
    const status = error.statusCode || 500;
    const msg = error.message || 'Chatbot failed to process the question';
    return res.status(status).json({
      error: msg,
      answer: msg,
    });
  }
});

router.post('/reset', (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const sessionId = String(body.sessionId || '').trim();
  if (sessionId) clearSession(sessionId);
  return res.json({ ok: true });
});

export default router;
