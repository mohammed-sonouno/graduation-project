-- Remove chatbot feature: drop views and tables created by 009/015 (if present).
-- Safe to run; IF EXISTS prevents errors on fresh DBs that never had chatbot.

DROP VIEW IF EXISTS chatbot_events;
DROP VIEW IF EXISTS chatbot_communities;
DROP VIEW IF EXISTS chatbot_academic_programs;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_conversations;
