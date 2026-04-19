# Chatbot controlled learning (offline ML)

Runtime answers stay rule- and database-driven. This folder documents how **logged** turns become **training data** and how **approved** changes flow (via admin review), not live self-modification.

## What is logged (every turn)

After each chat message, `chat_ml_interaction_logs` stores:

- Question and full reply text
- `detected_intent`, `raw_intent`, `plan_type`, `answer_kind`
- `reply_locale`, page context (`context_major_id`, `context_program_key`, `context_category`)
- Academic hints (`user_gpa_hint`, `user_profile_major`)
- `outcome` (`success` | `weak` | `failed`) and `weak_reason`
- `answer_validation_ok`, `mismatch_blocked` (safety / alignment signals)
- `debug_sources` JSON (pipeline sources, extracted entities, validation details)

Weak / failed rows are the primary signal for “unanswered or low-quality” cases (`outcome` + `weak_reason`).

## Normalized learning tables (migration `046_chat_controlled_learning.sql`)

Each turn still creates one row in `chat_ml_interaction_logs`, plus **sidecars** (same `interaction_log_id`):

| Table | Role |
|--------|------|
| `chat_question_logs` | Question text, intents, locale, page context, `extracted_entities`, optional `parent_interaction_log_id` (prior turn = clarification / follow-up) |
| `chat_answer_logs` | Reply text, `answer_kind`, `plan_type`, `fallback_used`, `weak_or_offtopic`, `validation_ok`, `mismatch_blocked`, `pipeline_sources` |
| `chat_entity_logs` | Entity JSON snapshot for ML |
| `chat_unanswered` | One row per weak/failed turn (mining unanswered / low-quality) |
| `chat_training_samples` | `auto_flagged` for weak/failed; promote to `promoted` / `exported` after review |
| `chat_knowledge_allowlist` | Curated list of **readable** tables/domains (`*` = whole-table policy row) |
| `chat_ml_model_registry` | Draft / approved / active **artifact versions** (no auto-activate) |
| `chat_feedback` | **View** over `chat_ml_feedback` for SQL-friendly name |

Code catalog (relationships + runtime table hints): `server/services/chat/knowledge/approvedKnowledgeCatalog.js`.

Admin:

- `GET /api/admin/chat-ml/knowledge-allowlist`
- `GET|POST|PATCH /api/admin/chat-ml/model-registry` — register drafts; `PATCH` moves `approved` → `active` → `retired` after human gate

Env hooks (optional): `CHAT_ML_INTENT_MODEL_VERSION`, `CHAT_ML_RANK_MODEL_VERSION`, `CHAT_ML_SYNONYM_MODEL_VERSION` (see `server/config/chatMlModels.js`).

## User feedback

`chat_ml_feedback` (and view `chat_feedback`) stores optional `helpful`, `rating`, `comment` per user and log id (`POST /api/chat/feedback`).

## Human labels (supervised intent / entities)

Admins can attach gold labels without changing production logic:

- `POST /api/admin/chat-ml/labels` with `interactionLogId`, optional `goldIntent`, `goldEntities`, `labelNotes`
- Export labeled rows: `GET /api/admin/chat-ml/export?dataset=supervised&format=jsonl`

## Admin analytics

- `GET /api/admin/chat-ml/stats` — outcome, plan, intent, weak-reason, answer-kind, locale frequencies, feedback summary
- `GET /api/admin/chat-ml/logs?outcome=failed&weakReason=validation_mismatch`
- `GET /api/admin/chat-ml/logs/:id` — full row for review
- `GET /api/admin/chat-ml/export?format=jsonl&full=true` — NDJSON with full reply + `debug_sources` for Python

## Review queue (before any change is applied)

`chat_ml_review_queue` holds proposals (`intent_label`, `synonym`, `ranking_weight`, `recommendation_rule`, …). Only after human **approval** should you merge changes into code, DB seeds, or weights — never automatically from the chat path.

## Python usage

1. Run export from admin API or SQL `COPY` from `chat_ml_interaction_logs`.
2. Use `load_jsonl.py` to iterate rows (pandas optional).
3. Train models offline; deploy new intent maps / synonyms / rankers as versioned artifacts after review.

See `training_row.example.json` for a typical flat row shape.
