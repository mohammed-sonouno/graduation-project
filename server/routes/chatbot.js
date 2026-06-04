import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { askChatbot, clearSession } from '../services/chatbot.service.js';

const router = Router();

router.get('/suggestions', (req, res) => {
  const isArabic = /ar/i.test(String(req.query.lang || ''));
  res.json({
    suggestions: isArabic
      ? [
          'شو أقرب فعالية قادمة؟',
          'شو التخصصات في كلية تكنولوجيا المعلومات؟',
          'كيف أنضم لمجتمع؟',
          'شو مواد تخصص MIS؟',
        ]
      : [
          'What is the next upcoming event?',
          'What majors are in the IT faculty?',
          'How do I join a community?',
          'What courses are in the MIS major?',
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
    const userRole = req.user?.role ?? 'student';

    const result = await askChatbot({
      sessionId,
      userMessage: question,
      majorName,
      majorFaculty,
      userRole,
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
