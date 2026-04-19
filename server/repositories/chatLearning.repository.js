import { pool } from '../db/pool.js';

/** Sidecar logging for controlled ML;1:1 with chat_ml_interaction_logs.id */
export class ChatLearningRepository {
  async getPreviousInteractionLogId(conversationId, currentLogId) {
    const r = await pool.query(
      `SELECT id FROM chat_ml_interaction_logs
       WHERE conversation_id = $1 AND id < $2
       ORDER BY id DESC LIMIT 1`,
      [conversationId, currentLogId]
    );
    return r.rows[0]?.id ?? null;
  }

  /**
   * @param {object} p
   * @param {number} p.interactionLogId
   * @param {number} p.userId
   * @param {number} p.conversationId
   * @param {number|null} p.userMessageId
   * @param {number|null} p.botMessageId
   * @param {string} p.questionText
   * @param {string} p.replyText
   * @param {string|null} p.detectedIntent
   * @param {string|null} p.rawIntent
   * @param {string|null} p.planType
   * @param {string|null} p.answerKind
   * @param {string} p.replyLocale
   * @param {string|null} p.contextMajorId
   * @param {string|null} p.contextProgramKey
   * @param {string|null} p.contextCategory
   * @param {object|null} p.extractedEntities
   * @param {string[]|null} p.pipelineSources
   * @param {boolean|null} p.validationOk
   * @param {boolean} p.mismatchBlocked
   * @param {string} p.outcome - success|weak|failed
   * @param {string|null} p.weakReason
   */
  async insertLearningSidecars(p) {
    const parentId = await this.getPreviousInteractionLogId(p.conversationId, p.interactionLogId);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO chat_question_logs (
          interaction_log_id, user_id, conversation_id, user_message_id, parent_interaction_log_id,
          question_text, detected_intent, raw_intent, reply_locale,
          context_major_id, context_program_key, context_category, extracted_entities
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
        [
          p.interactionLogId,
          p.userId,
          p.conversationId,
          p.userMessageId ?? null,
          parentId,
          p.questionText,
          p.detectedIntent ?? null,
          p.rawIntent ?? null,
          p.replyLocale ?? null,
          p.contextMajorId ?? null,
          p.contextProgramKey ?? null,
          p.contextCategory ?? null,
          p.extractedEntities != null ? JSON.stringify(p.extractedEntities) : null
        ]
      );

      const fallbackUsed = isFallbackAnswerKind(p.answerKind);
      const weakOrOff = p.outcome === 'weak' || p.outcome === 'failed';

      await client.query(
        `INSERT INTO chat_answer_logs (
          interaction_log_id, bot_message_id, reply_text, answer_kind, plan_type,
          fallback_used, weak_or_offtopic, validation_ok, mismatch_blocked, pipeline_sources
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
        [
          p.interactionLogId,
          p.botMessageId ?? null,
          p.replyText,
          p.answerKind ?? null,
          p.planType ?? null,
          fallbackUsed,
          weakOrOff,
          p.validationOk ?? null,
          Boolean(p.mismatchBlocked),
          p.pipelineSources != null ? JSON.stringify(p.pipelineSources) : null
        ]
      );

      await client.query(
        `INSERT INTO chat_entity_logs (interaction_log_id, entities)
         VALUES ($1, $2::jsonb)`,
        [
          p.interactionLogId,
          JSON.stringify(p.extractedEntities && typeof p.extractedEntities === 'object' ? p.extractedEntities : {})
        ]
      );

      if (p.outcome === 'weak' || p.outcome === 'failed') {
        await client.query(
          `INSERT INTO chat_unanswered (interaction_log_id, outcome, weak_reason, category)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (interaction_log_id) DO NOTHING`,
          [
            p.interactionLogId,
            p.outcome,
            p.weakReason ?? null,
            p.mismatchBlocked ? 'validation_mismatch' : p.outcome === 'failed' ? 'failed' : 'weak'
          ]
        );

        await client.query(
          `INSERT INTO chat_training_samples (interaction_log_id, sample_status, flag_reason)
           VALUES ($1, 'auto_flagged', $2)
           ON CONFLICT (interaction_log_id) DO UPDATE SET
             sample_status = EXCLUDED.sample_status,
             flag_reason = EXCLUDED.flag_reason`,
          [p.interactionLogId, p.weakReason || p.outcome]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async listKnowledgeAllowlist() {
    const r = await pool.query(
      `SELECT id, table_schema AS "tableSchema", table_name AS "tableName",
              column_name AS "columnName", domain, contains_pii AS "containsPii",
              read_only AS "readOnly", relation_notes AS "relationNotes", created_at AS "createdAt"
       FROM chat_knowledge_allowlist
       ORDER BY domain, table_name, column_name`
    );
    return r.rows;
  }

  async listModelRegistry({ modelKey = null, limit = 100 } = {}) {
    const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const hasKey = modelKey && String(modelKey).trim();
    const r = await pool.query(
      `SELECT id, model_key AS "modelKey", version, artifact_uri AS "artifactUri", status,
              approved_by_user_id AS "approvedByUserId", approved_at AS "approvedAt",
              activated_at AS "activatedAt", retired_at AS "retiredAt", notes, created_at AS "createdAt"
       FROM chat_ml_model_registry
       ${hasKey ? 'WHERE model_key = $2' : ''}
       ORDER BY model_key ASC, created_at DESC
       LIMIT $1`,
      hasKey ? [lim, String(modelKey).trim()] : [lim]
    );
    return r.rows;
  }

  async insertModelRegistryDraft({
    modelKey,
    version,
    artifactUri = null,
    status = 'draft',
    notes = null
  }) {
    const r = await pool.query(
      `INSERT INTO chat_ml_model_registry (model_key, version, artifact_uri, status, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, model_key AS "modelKey", version, artifact_uri AS "artifactUri", status, notes, created_at AS "createdAt"`,
      [String(modelKey).trim().slice(0, 64), String(version).trim().slice(0, 64), artifactUri, status, notes]
    );
    return r.rows[0] ?? null;
  }

  async updateModelRegistry({ id, status, approvedByUserId = null, notes = null }) {
    const rid = Number(id);
    if (!Number.isFinite(rid) || rid <= 0) return null;
    const st = String(status || '').trim();
    const r = await pool.query(
      `UPDATE chat_ml_model_registry SET
         status = $2,
         approved_by_user_id = CASE
           WHEN $2 IN ('approved', 'active') THEN COALESCE($3, approved_by_user_id)
           ELSE approved_by_user_id END,
         approved_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE approved_at END,
         activated_at = CASE WHEN $2 = 'active' THEN NOW() ELSE activated_at END,
         retired_at = CASE WHEN $2 = 'retired' THEN NOW() ELSE retired_at END,
         notes = COALESCE($4, notes)
       WHERE id = $1
       RETURNING id, model_key AS "modelKey", version, status, approved_at AS "approvedAt", activated_at AS "activatedAt"`,
      [rid, st, approvedByUserId ?? null, notes ?? null]
    );
    return r.rows[0] ?? null;
  }
}

function isFallbackAnswerKind(kind) {
  const k = String(kind || '').trim();
  if (!k) return false;
  if (k === 'unknown_intent' || k === 'not_in_database') return true;
  if (k.endsWith('_prompt')) return true;
  return false;
}
