export const schemaMetadata = {
  version: 1,
  entities: {
    users_safe: {
      table: 'app_users',
      description: 'Application users (SAFE view for chatbot personalization).',
      allowedFields: ['id', 'first_name', 'middle_name', 'last_name'],
      restrictedFields: [
        'email',
        'password_hash',
        'phone',
        'student_number',
        'tokens',
        'any_auth_fields'
      ],
      notes: 'Chatbot is only allowed to access id + derived display name.'
    },
    events: {
      table: 'events',
      description: 'University events.',
      allowedFields: [
        'id',
        'title',
        'description',
        'category',
        'club_name',
        'location',
        'start_date',
        'start_time',
        'end_date',
        'end_time',
        'available_seats',
        'price',
        'price_member',
        'featured',
        'status'
      ],
      restrictedFields: [],
      relations: [{ to: 'event_registrations', on: 'events.id = event_registrations.event_id' }]
    },
    communities: {
      table: 'communities',
      description: 'Communities/clubs (linked to colleges).',
      allowedFields: ['id', 'name', 'college_id'],
      restrictedFields: [],
      relations: [{ to: 'colleges', on: 'communities.college_id = colleges.id' }]
    },
    colleges: {
      table: 'colleges',
      description: 'Reference data for colleges.',
      allowedFields: ['id', 'name'],
      restrictedFields: []
    },
    notifications: {
      table: 'notifications',
      description: 'Per-user notifications.',
      allowedFields: ['id', 'user_id', 'title', 'message', 'read', 'created_at'],
      restrictedFields: [],
      policy: {
        rowLevel: 'ONLY_CURRENT_USER'
      }
    },
    event_registrations: {
      table: 'event_registrations',
      description: 'User registrations to events.',
      allowedFields: ['id', 'user_id', 'event_id', 'created_at'],
      restrictedFields: ['student_id', 'college', 'major', 'name', 'email'],
      policy: {
        rowLevel: 'ONLY_CURRENT_USER'
      }
    },
    university_qa: {
      table: 'university_qa',
      description: 'University knowledge Q&A (factual snippets).',
      allowedFields: [
        'id',
        'university_id',
        'topic_id',
        'question_en',
        'question_ar',
        'answer_en',
        'answer_ar',
        'normalized_intent',
        'keywords',
        'source_id',
        'created_at',
        'updated_at'
      ],
      restrictedFields: [],
      notes: 'Read via UniversityKnowledgeRepository only.'
    },
    faculty_qa: {
      table: 'faculty_qa',
      description: 'Faculty knowledge Q&A.',
      allowedFields: [
        'id',
        'faculty_id',
        'topic_id',
        'question_en',
        'question_ar',
        'answer_en',
        'answer_ar',
        'normalized_intent',
        'keywords',
        'source_id',
        'created_at',
        'updated_at'
      ],
      restrictedFields: [],
      notes: 'Read via FacultyKnowledgeRepository only.'
    },
    engineering_programs: {
      table: 'engineering_programs',
      description: 'Engineering programme catalogue (admission bands, streams, descriptions).',
      allowedFields: [
        'program_key',
        'faculty_slug',
        'name_en',
        'name_ar',
        'stream_type',
        'min_acceptance_average_min',
        'min_acceptance_average_max',
        'difficulty_level',
        'estimated_competition_level',
        'description_en',
        'description_ar',
        'career_summary_en',
        'career_summary_ar',
        'keywords',
        'general_notes',
        'is_abet_accredited',
        'is_estimate',
        'department_name',
        'degree_type'
      ],
      restrictedFields: [],
      notes: 'Read via EngineeringProgramsRepository; no invented fields in replies.'
    },
    major_chat_context: {
      table: 'major_chat_context',
      description: 'Per-major UI/chat context (greetings, suggested questions, facts).',
      allowedFields: [
        'major_id',
        'category',
        'engineering_program_key',
        'greeting_en',
        'greeting_ar',
        'facts_en',
        'facts_ar',
        'suggested_questions_en',
        'suggested_questions_ar'
      ],
      restrictedFields: [],
      relations: [{ to: 'majors', on: 'major_chat_context.major_id = majors.id' }]
    }
  }
};
