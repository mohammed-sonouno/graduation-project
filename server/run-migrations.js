/**
 * Run all DB migrations in order. Usage: node server/run-migrations.js
 */
import 'dotenv/config';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db/pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const migrations = [
  '002_app_users.sql',
  '003_student_fields.sql',
  '003_colleges_majors.sql',
  '004_rename_role_user_to_student.sql',
  '004_events.sql',
  '005_event_registrations.sql',
  '005_must_complete_profile.sql',
  '006_student_profiles.sql',
  '007_notifications.sql',
  '008_seed_events.sql',
  '010_module_data.sql',
  '011_communities_and_role_assignments.sql',
  '012_ensure_app_users_full_schema.sql',
  '013_events_community_college.sql',
  '014_backfill_event_community.sql',
  '016_db_checkup_improvements.sql',
  '017_drop_chatbot.sql',
  '018_login_codes.sql',
  '019_password_hash_nullable.sql',
  '020_constraints_checks.sql',
  '021_pending_registrations.sql',
  '022_event_registrations_status.sql',
  '023_event_audience_colleges_majors.sql',
  '024_event_registrations_payment.sql',
  '027_allow_multiple_leaders_per_community.sql',
  '028_events_columns_ensure.sql',
  '029_events_varchar_to_text.sql',
  '030_events_status_check_workflow.sql',
  '031_events_indexes_ensure.sql',
  '032_events_rejected_at_step.sql',
  '033_events_created_at_index.sql',
  '034_events_requested_changes_at_step.sql',
  '035_events_approval_columns.sql',
  '036_delete_seed_events.sql',
  '037_university_knowledge_annajah.sql',
  '038_faculty_engineering_knowledge_annajah.sql',
  '039_engineering_programs_recommendations.sql',
  '040_chat_conversations_messages.sql',
  '041_chat_major_advisor_context.sql',
  '042_polish_major_advisor_copy.sql',
  '043_enrich_knowledge_data.sql',
  '044_chat_ml_learning_pipeline.sql',
  '045_chat_ml_training_signals.sql',
  '046_chat_controlled_learning.sql',
  '047_natural_advisor_copy.sql',
  '048_expand_chat_coverage_annajah.sql',
];

async function run() {
  const client = await pool.connect();
  const base = join(__dirname, '..', 'db', 'migrations');
  for (const name of migrations) {
    try {
      const sql = await readFile(join(base, name), 'utf8');
      await client.query(sql);
      console.log('OK:', name);
    } catch (err) {
      console.error('FAIL:', name, err.message);
      process.exitCode = 1;
    }
  }
  client.release();
  await pool.end();
}

run();
