-- Chat persistence for integrated chatbot (additive only; recreates tables after 017_drop_chatbot.sql).
-- Same schema as chatbot-service migrate; IF NOT EXISTS is safe on existing DBs.

BEGIN;

CREATE TABLE IF NOT EXISTS chat_conversations (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title       TEXT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id              SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender          VARCHAR(16) NOT NULL CHECK (sender IN ('user', 'bot')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);

COMMIT;
