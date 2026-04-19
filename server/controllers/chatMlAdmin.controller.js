import { AppError } from '../utils/AppError.js';
import { ChatMlRepository } from '../repositories/chatMl.repository.js';
import { ChatLearningRepository } from '../repositories/chatLearning.repository.js';
import { getActiveModelVersionEnv } from '../config/chatMlModels.js';

const repo = new ChatMlRepository();
const learningRepo = new ChatLearningRepository();

const PROPOSAL_TYPES = new Set([
  'intent_label',
  'synonym',
  'ranking_weight',
  'recommendation_rule',
  'other'
]);

export async function getChatMlLogs(req, res, next) {
  try {
    const outcome = req.query.outcome || null;
    const weakReason = req.query.weakReason || req.query.weak_reason || null;
    const limit = req.query.limit;
    const offset = req.query.offset;
    const [items, total] = await Promise.all([
      repo.listLogsAdmin({ outcome, weakReason, limit, offset }),
      repo.countLogsAdmin({ outcome, weakReason })
    ]);
    res.json({ items, total, limit: Number(limit) || 50, offset: Number(offset) || 0 });
  } catch (e) {
    next(e);
  }
}

export async function getChatMlLogById(req, res, next) {
  try {
    const row = await repo.getLogByIdAdmin(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Log not found' });
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
}

export async function getChatMlStats(req, res, next) {
  try {
    const stats = await repo.getFrequencyStats();
    res.json(stats);
  } catch (e) {
    next(e);
  }
}

/** Approved DB tables/columns for chatbot knowledge (policy catalog). */
export async function getChatKnowledgeAllowlist(req, res, next) {
  try {
    const items = await learningRepo.listKnowledgeAllowlist();
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

/** Registered ML artifacts (draft → approved → active); env hooks for deployed generation. */
export async function getChatMlModelRegistry(req, res, next) {
  try {
    const items = await learningRepo.listModelRegistry({
      modelKey: req.query.modelKey || null,
      limit: req.query.limit
    });
    res.json({
      items,
      envVersions: {
        intent: getActiveModelVersionEnv('intent'),
        rank: getActiveModelVersionEnv('rank'),
        synonym: getActiveModelVersionEnv('synonym')
      }
    });
  } catch (e) {
    next(e);
  }
}

export async function patchChatMlModelRegistry(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError('Invalid id', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
    const b = req.body || {};
    const status = String(b.status || '').trim();
    if (!['draft', 'pending_review', 'approved', 'active', 'retired'].includes(status)) {
      throw new AppError('Invalid status', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
    const notes = b.notes != null ? String(b.notes).trim().slice(0, 4000) : null;
    const row = await learningRepo.updateModelRegistry({
      id,
      status,
      approvedByUserId: req.user?.id ?? null,
      notes
    });
    if (!row) {
      return res.status(404).json({ error: 'Registry row not found' });
    }
    res.json(row);
  } catch (e) {
    if (e instanceof AppError) {
      return res.status(e.statusCode || 500).json({ error: e.message, code: e.code });
    }
    next(e);
  }
}

export async function postChatMlModelRegistry(req, res, next) {
  try {
    const b = req.body || {};
    const modelKey = String(b.modelKey || '').trim();
    const version = String(b.version || '').trim();
    if (!modelKey || !version) {
      throw new AppError('modelKey and version are required', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
    const artifactUri = b.artifactUri != null ? String(b.artifactUri).trim().slice(0, 2000) : null;
    const status = b.status != null ? String(b.status).trim() : 'draft';
    if (!['draft', 'pending_review'].includes(status)) {
      throw new AppError('status must be draft or pending_review for create', {
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      });
    }
    const notes = b.notes != null ? String(b.notes).trim().slice(0, 4000) : null;
    const row = await learningRepo.insertModelRegistryDraft({
      modelKey,
      version,
      artifactUri,
      status,
      notes
    });
    res.status(201).json(row);
  } catch (e) {
    if (e instanceof AppError) {
      return res.status(e.statusCode || 500).json({ error: e.message, code: e.code });
    }
    next(e);
  }
}

export async function getChatMlExport(req, res, next) {
  try {
    const limit = req.query.limit;
    const outcome = req.query.outcome || null;
    const format = (req.query.format || 'jsonl').toLowerCase();
    const full = ['1', 'true', 'yes'].includes(String(req.query.full || '').toLowerCase());
    const dataset = String(req.query.dataset || 'default').toLowerCase();

    let rows;
    let filename = 'chat-ml-training.jsonl';
    if (dataset === 'supervised' || dataset === 'gold_intent') {
      rows = await repo.exportSupervisedIntentRows({ limit });
      filename = 'chat-ml-supervised-intent.jsonl';
    } else {
      rows = await repo.exportTrainingRows({ limit, outcome, full });
      if (full) filename = 'chat-ml-training-full.jsonl';
    }

    if (format === 'json') {
      return res.json({ count: rows.length, dataset, full, rows });
    }

    const lines = rows.map((r) => JSON.stringify(r)).join('\n');
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(lines + (lines ? '\n' : ''));
  } catch (e) {
    next(e);
  }
}

export async function postChatMlReview(req, res, next) {
  try {
    const b = req.body || {};
    const proposalType = String(b.proposalType || '').trim();
    if (!PROPOSAL_TYPES.has(proposalType)) {
      throw new AppError(`proposalType must be one of: ${[...PROPOSAL_TYPES].join(', ')}`, {
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      });
    }
    let interactionLogId = null;
    if (b.interactionLogId != null && b.interactionLogId !== '') {
      interactionLogId = Number(b.interactionLogId);
      if (!Number.isFinite(interactionLogId) || interactionLogId <= 0) {
        throw new AppError('interactionLogId must be a positive number', {
          statusCode: 400,
          code: 'VALIDATION_ERROR'
        });
      }
    }
    const payload = b.payload && typeof b.payload === 'object' ? b.payload : {};
    const adminNotes = b.adminNotes != null ? String(b.adminNotes).trim().slice(0, 4000) : null;

    const row = await repo.insertReviewItem({
      interactionLogId,
      proposalType,
      payload,
      adminNotes
    });
    res.status(201).json(row);
  } catch (e) {
    if (e instanceof AppError) {
      return res.status(e.statusCode || 500).json({ error: e.message, code: e.code });
    }
    next(e);
  }
}

export async function listChatMlReview(req, res, next) {
  try {
    const status = req.query.status || null;
    const limit = req.query.limit;
    const offset = req.query.offset;
    const items = await repo.listReviewQueue({ status, limit, offset });
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

/**
 * Human gold labels for supervised training (intent / entities). Does not change live bot logic.
 */
export async function postChatMlGoldLabel(req, res, next) {
  try {
    const b = req.body || {};
    const interactionLogId = Number(b.interactionLogId);
    if (!Number.isFinite(interactionLogId) || interactionLogId <= 0) {
      throw new AppError('interactionLogId must be a positive number', {
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      });
    }
    const log = await repo.getLogByIdAdmin(interactionLogId);
    if (!log) {
      return res.status(404).json({ error: 'Interaction log not found' });
    }
    const goldIntent = b.goldIntent != null ? String(b.goldIntent).trim().slice(0, 80) : null;
    const goldEntities = b.goldEntities && typeof b.goldEntities === 'object' ? b.goldEntities : null;
    const labelNotes = b.labelNotes != null ? String(b.labelNotes).trim().slice(0, 4000) : null;
    if (!goldIntent && !goldEntities && !labelNotes) {
      throw new AppError('Provide at least one of goldIntent, goldEntities, or labelNotes', {
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      });
    }
    const row = await repo.upsertLabeledExample({
      interactionLogId,
      labeledByUserId: req.user?.id ?? null,
      goldIntent,
      goldEntities,
      labelNotes
    });
    res.status(201).json(row);
  } catch (e) {
    if (e instanceof AppError) {
      return res.status(e.statusCode || 500).json({ error: e.message, code: e.code });
    }
    next(e);
  }
}

export async function patchChatMlReview(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError('Invalid id', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
    const b = req.body || {};
    const status = String(b.status || '').trim();
    if (!['approved', 'rejected', 'applied', 'pending'].includes(status)) {
      throw new AppError('status must be approved, rejected, applied, or pending', {
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      });
    }
    const adminNotes = b.adminNotes != null ? String(b.adminNotes).trim().slice(0, 4000) : null;
    const row = await repo.updateReviewItem({
      id,
      adminUserId: req.user?.id ?? null,
      status,
      adminNotes
    });
    if (!row) {
      return res.status(404).json({ error: 'Review item not found' });
    }
    res.json(row);
  } catch (e) {
    if (e instanceof AppError) {
      return res.status(e.statusCode || 500).json({ error: e.message, code: e.code });
    }
    next(e);
  }
}
