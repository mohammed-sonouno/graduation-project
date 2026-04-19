import { pool } from '../db/pool.js';

export class ChatMlRepository {
  async insertInteractionLog({
    userId,
    conversationId,
    userMessageId,
    botMessageId,
    questionText,
    replyText,
    detectedIntent,
    rawIntent,
    planType,
    replyLocale,
    contextMajorId,
    contextProgramKey,
    contextCategory,
    userGpaHint,
    userProfileMajor,
    answerKind,
    outcome,
    weakReason,
    answerValidationOk = null,
    mismatchBlocked = false,
    debugSources
  }) {
    const r = await pool.query(
      `INSERT INTO chat_ml_interaction_logs (
        user_id, conversation_id, user_message_id, bot_message_id,
        question_text, reply_text,
        detected_intent, raw_intent, plan_type, reply_locale,
        context_major_id, context_program_key, context_category,
        user_gpa_hint, user_profile_major,
        answer_kind, outcome, weak_reason,
        answer_validation_ok, mismatch_blocked,
        debug_sources
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
      )
      RETURNING id`,
      [
        userId,
        conversationId,
        userMessageId ?? null,
        botMessageId ?? null,
        questionText,
        replyText,
        detectedIntent ?? null,
        rawIntent ?? null,
        planType ?? null,
        replyLocale ?? null,
        contextMajorId ?? null,
        contextProgramKey ?? null,
        contextCategory ?? null,
        userGpaHint ?? null,
        userProfileMajor ?? null,
        answerKind ?? null,
        outcome,
        weakReason ?? null,
        answerValidationOk,
        Boolean(mismatchBlocked),
        debugSources != null ? debugSources : null
      ]
    );
    return r.rows[0]?.id ?? null;
  }

  async getLogForUser(logId, userId) {
    const r = await pool.query(
      `SELECT id, user_id AS "userId" FROM chat_ml_interaction_logs WHERE id = $1`,
      [logId]
    );
    const row = r.rows[0];
    if (!row) return null;
    if (row.userId !== userId) return null;
    return row;
  }

  async getLogByIdAdmin(logId) {
    const id = Number(logId);
    if (!Number.isFinite(id) || id <= 0) return null;
    const r = await pool.query(
      `SELECT id,
              user_id AS "userId",
              conversation_id AS "conversationId",
              question_text AS "questionText",
              reply_text AS "replyText",
              detected_intent AS "detectedIntent",
              raw_intent AS "rawIntent",
              plan_type AS "planType",
              reply_locale AS "replyLocale",
              context_major_id AS "contextMajorId",
              context_program_key AS "contextProgramKey",
              context_category AS "contextCategory",
              user_gpa_hint AS "userGpaHint",
              user_profile_major AS "userProfileMajor",
              answer_kind AS "answerKind",
              outcome,
              weak_reason AS "weakReason",
              answer_validation_ok AS "answerValidationOk",
              mismatch_blocked AS "mismatchBlocked",
              debug_sources AS "debugSources",
              created_at AS "createdAt"
       FROM chat_ml_interaction_logs WHERE id = $1`,
      [id]
    );
    return r.rows[0] ?? null;
  }

  async upsertFeedback({ interactionLogId, userId, helpful, rating, comment }) {
    const r = await pool.query(
      `INSERT INTO chat_ml_feedback (interaction_log_id, user_id, helpful, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (interaction_log_id, user_id) DO UPDATE SET
         helpful = EXCLUDED.helpful,
         rating = EXCLUDED.rating,
         comment = EXCLUDED.comment
       RETURNING id, interaction_log_id AS "interactionLogId", helpful, rating, comment, created_at AS "createdAt"`,
      [interactionLogId, userId, helpful ?? null, rating ?? null, comment ?? null]
    );
    return r.rows[0] ?? null;
  }

  async listLogsAdmin({ outcome = null, weakReason = null, limit = 50, offset = 0 } = {}) {
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 500);
    const off = Math.max(Number(offset) || 0, 0);
    const hasOutcome = outcome && ['success', 'weak', 'failed'].includes(outcome);
    const hasWeak = weakReason != null && String(weakReason).trim() !== '';
    const conds = [];
    const params = [lim, off];
    let i = 3;
    if (hasOutcome) {
      conds.push(`outcome = $${i++}`);
      params.push(outcome);
    }
    if (hasWeak) {
      conds.push(`weak_reason = $${i++}`);
      params.push(String(weakReason).trim());
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const r = await pool.query(
      `SELECT id,
              user_id AS "userId",
              conversation_id AS "conversationId",
              question_text AS "questionText",
              LEFT(reply_text, 500) AS "replyPreview",
              detected_intent AS "detectedIntent",
              raw_intent AS "rawIntent",
              plan_type AS "planType",
              reply_locale AS "replyLocale",
              context_major_id AS "contextMajorId",
              context_program_key AS "contextProgramKey",
              context_category AS "contextCategory",
              answer_kind AS "answerKind",
              outcome,
              weak_reason AS "weakReason",
              answer_validation_ok AS "answerValidationOk",
              mismatch_blocked AS "mismatchBlocked",
              created_at AS "createdAt"
       FROM chat_ml_interaction_logs
       ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    return r.rows;
  }

  async countLogsAdmin({ outcome = null, weakReason = null } = {}) {
    const hasOutcome = outcome && ['success', 'weak', 'failed'].includes(outcome);
    const hasWeak = weakReason != null && String(weakReason).trim() !== '';
    const conds = [];
    const params = [];
    let i = 1;
    if (hasOutcome) {
      conds.push(`outcome = $${i++}`);
      params.push(outcome);
    }
    if (hasWeak) {
      conds.push(`weak_reason = $${i++}`);
      params.push(String(weakReason).trim());
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const r = await pool.query(
      `SELECT COUNT(*)::bigint AS c FROM chat_ml_interaction_logs ${where}`,
      params
    );
    return Number(r.rows[0]?.c || 0);
  }

  async getFrequencyStats() {
    const [
      outcomes,
      plans,
      intents,
      weakReasons,
      answerKinds,
      locales,
      feedbackSummary
    ] = await Promise.all([
      pool.query(`SELECT * FROM v_chat_ml_outcome_counts ORDER BY outcome`),
      pool.query(`SELECT * FROM v_chat_ml_plan_frequency ORDER BY cnt DESC`),
      pool.query(`SELECT * FROM v_chat_ml_intent_frequency ORDER BY cnt DESC`),
      pool.query(`SELECT * FROM v_chat_ml_weak_reason_counts ORDER BY cnt DESC NULLS LAST`),
      pool.query(`SELECT * FROM v_chat_ml_answer_kind_frequency ORDER BY cnt DESC`),
      pool.query(`SELECT * FROM v_chat_ml_locale_frequency ORDER BY cnt DESC`),
      pool.query(`SELECT * FROM v_chat_ml_feedback_summary`)
    ]);
    return {
      outcomes: outcomes.rows,
      planFrequency: plans.rows,
      intentFrequency: intents.rows,
      weakReasonFrequency: weakReasons.rows,
      answerKindFrequency: answerKinds.rows,
      localeFrequency: locales.rows,
      feedbackSummary: feedbackSummary.rows[0] ?? null
    };
  }

  /**
   * @param {{ limit?: number, outcome?: string|null, full?: boolean }} opts
   * full=true: full reply_text + debug_sources + validation flags (for offline ML).
   */
  async exportTrainingRows({ limit = 5000, outcome = null, full = false } = {}) {
    const lim = Math.min(Math.max(Number(limit) || 5000, 1), 50000);
    const hasOutcome = outcome && ['success', 'weak', 'failed'].includes(outcome);
    const replySelect = full ? `reply_text AS "replyText"` : `LEFT(reply_text, 2000) AS "replyPreview"`;
    const debugSelect = full ? `, debug_sources AS "debugSources"` : '';
    const validationSelect = full
      ? `, answer_validation_ok AS "answerValidationOk", mismatch_blocked AS "mismatchBlocked"`
      : '';
    const r = await pool.query(
      `SELECT id,
              question_text AS text,
              detected_intent AS intent,
              raw_intent AS "rawIntent",
              plan_type AS "planType",
              reply_locale AS locale,
              context_major_id AS "majorId",
              context_program_key AS "programKey",
              context_category AS category,
              user_gpa_hint AS gpa,
              user_profile_major AS "profileMajor",
              answer_kind AS "answerKind",
              outcome,
              weak_reason AS "weakReason",
              ${replySelect}
              ${validationSelect}
              ${debugSelect},
              created_at AS "createdAt"
       FROM chat_ml_interaction_logs
       ${hasOutcome ? 'WHERE outcome = $2' : ''}
       ORDER BY id ASC
       LIMIT $1`,
      hasOutcome ? [lim, outcome] : [lim]
    );
    return r.rows;
  }

  async exportSupervisedIntentRows({ limit = 5000 } = {}) {
    const lim = Math.min(Math.max(Number(limit) || 5000, 1), 50000);
    const r = await pool.query(
      `SELECT * FROM v_chat_ml_supervised_intent_rows ORDER BY log_id ASC LIMIT $1`,
      [lim]
    );
    return r.rows;
  }

  async insertReviewItem({ interactionLogId, proposalType, payload, adminNotes = null }) {
    const r = await pool.query(
      `INSERT INTO chat_ml_review_queue (interaction_log_id, proposal_type, payload, admin_notes, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, interaction_log_id AS "interactionLogId", proposal_type AS "proposalType",
                 status, payload, admin_notes AS "adminNotes", created_at AS "createdAt"`,
      [interactionLogId ?? null, proposalType, payload || {}, adminNotes]
    );
    return r.rows[0] ?? null;
  }

  async upsertLabeledExample({
    interactionLogId,
    labeledByUserId,
    goldIntent = null,
    goldEntities = null,
    labelNotes = null
  }) {
    const r = await pool.query(
      `INSERT INTO chat_ml_labeled_examples (
        interaction_log_id, labeled_by_user_id, gold_intent, gold_entities, label_notes
      ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (interaction_log_id) DO UPDATE SET
         labeled_by_user_id = EXCLUDED.labeled_by_user_id,
         gold_intent = EXCLUDED.gold_intent,
         gold_entities = EXCLUDED.gold_entities,
         label_notes = EXCLUDED.label_notes,
         updated_at = NOW()
       RETURNING id, interaction_log_id AS "interactionLogId", gold_intent AS "goldIntent",
                 gold_entities AS "goldEntities", label_notes AS "labelNotes", created_at AS "createdAt"`,
      [
        interactionLogId,
        labeledByUserId ?? null,
        goldIntent != null ? String(goldIntent).trim().slice(0, 80) : null,
        goldEntities && typeof goldEntities === 'object' ? goldEntities : null,
        labelNotes != null ? String(labelNotes).trim().slice(0, 4000) : null
      ]
    );
    return r.rows[0] ?? null;
  }

  async updateReviewItem({ id, adminUserId, status, adminNotes }) {
    const r = await pool.query(
      `UPDATE chat_ml_review_queue
       SET status = $2,
           reviewed_by_user_id = $3,
           reviewed_at = CASE WHEN $2 IN ('approved','rejected','applied') THEN NOW() ELSE reviewed_at END,
           admin_notes = COALESCE($4, admin_notes)
       WHERE id = $1
       RETURNING id, status, reviewed_at AS "reviewedAt", admin_notes AS "adminNotes"`,
      [id, status, adminUserId ?? null, adminNotes ?? null]
    );
    return r.rows[0] ?? null;
  }

  async listReviewQueue({ status = null, limit = 50, offset = 0 } = {}) {
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const off = Math.max(Number(offset) || 0, 0);
    const hasStatus = status && ['pending', 'approved', 'rejected', 'applied'].includes(status);
    const where = hasStatus ? 'WHERE status = $3' : '';
    const r = await pool.query(
      `SELECT id, interaction_log_id AS "interactionLogId", proposal_type AS "proposalType",
              status, payload, admin_notes AS "adminNotes",
              reviewed_by_user_id AS "reviewedByUserId", reviewed_at AS "reviewedAt",
              created_at AS "createdAt"
       FROM chat_ml_review_queue
       ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $1 OFFSET $2`,
      hasStatus ? [lim, off, status] : [lim, off]
    );
    return r.rows;
  }
}
