# Supabase Database Schema Relationships

> Auto-generated Mermaid ER diagram for the JustTalk AI database

```mermaid
erDiagram
    %% ============================================
    %% CORE USER & PROFILES
    %% ============================================
    PROFILES {
        uuid id PK
        text name
        text email
        text role
        uuid owner_teacher_id FK
        timestamp with time zone created_at
        text display_name
        text username
        text profile_photo_url
        text[] interests
        text cefr_level
        text[] learning_goals
        boolean onboarding_completed
        boolean teacher_onboarding_completed
        text native_language
        text country
        boolean is_certified_teacher
        text catchy_title
        text about_me
        text teaching_experience
        numeric hourly_rate
        text time_zone
        text justai_correction_style
    }

    USER_ROLES {
        uuid id PK
        uuid user_id FK
        text role
        timestamp with time zone created_at
    }

    TEACHER_STUDENT_LINKS {
        uuid teacher_id FK
        uuid student_id FK
        timestamp with time zone created_at
    }

    %% ============================================
    %% LESSONS
    %% ============================================
    LESSONS {
        uuid id PK
        uuid teacher_id FK
        uuid student_id FK
        timestamp with time zone starts_at
        timestamp with time zone ends_at
        text title
        text notes
        text status
        timestamp with time zone created_at
        boolean is_free_lesson
        boolean is_ai_session
    }

    LESSON_TRANSCRIPTION_SEGMENTS {
        uuid id PK
        uuid lesson_id FK
        uuid speaker_id FK
        text speaker_role
        timestamp with time zone start_time
        timestamp with time zone end_time
        text transcript
        text audio_file_path
        boolean final_sentence_transcription
        text formatted_text
        boolean realtime_processed
    }

    LESSON_MISTAKES_RAW {
        uuid id PK
        uuid lesson_id FK
        uuid segment_id FK
        uuid speaker_id FK
        text speaker_role
        text error_type
        text general_error_type
        text sentence
        integer start_pos
        integer end_pos
        text replacement
        text sapling_id
        boolean ai_validated
        float ai_confidence
        text ai_rejection_reason
    }

    LESSON_ATTENDANCE {
        uuid id PK
        uuid lesson_id FK
        uuid user_id FK
        text user_role
        timestamp with time zone joined_at
        timestamp with time zone left_at
    }

    LESSON_GRAMMAR_USAGE {
        uuid id PK
        uuid lesson_id FK
        uuid student_id FK
        text structure_code
        text cefr_level
        integer count_in_lesson
        boolean first_time_used
    }

    LESSON_SUMMARIES {
        uuid id PK
        uuid lesson_id FK UK
        text summary
        text conversation_sample
        jsonb stats
    }

    LESSON_NOTES_COLLABORATIVE {
        uuid lesson_id PK
        bytea yjs_state
        timestamp with time zone updated_at
        uuid updated_by FK
    }

    LESSON_ACTIVE_GOALS_SNAPSHOT {
        uuid lesson_id PK
        uuid student_id PK
        uuid goal_id PK
        text cefr_level
        integer priority_rank
        integer lesson_count
        integer focus_lesson_count
        boolean is_stable
        uuid lexeme_id FK
        text lemma
        text pos
    }

    %% ============================================
    %% MESSAGING
    %% ============================================
    CONVERSATIONS {
        uuid id PK
        text type
        timestamp with time zone created_at
        timestamp with time zone updated_at
        timestamp with time zone last_message_at
        uuid created_by FK
        uuid direct_user1_id FK
        uuid direct_user2_id FK
    }

    CONVERSATION_PARTICIPANTS {
        uuid conversation_id PK
        uuid user_id PK
        text role
        timestamp with time zone last_read_at
    }

    MESSAGES {
        uuid id PK
        uuid conversation_id FK
        uuid sender_id FK
        text content
        timestamp with time zone created_at
    }

    MESSAGE_ATTACHMENTS {
        uuid id PK
        uuid message_id FK
        text storage_path
        text mime_type
        integer file_size_bytes
    }

    MESSAGE_NOTIFICATION_LOG {
        uuid id PK
        uuid conversation_id FK
        uuid recipient_id FK
        integer message_count
        timestamp with time zone sent_at
    }

    %% ============================================
    %% VOCABULARY & LEXEMES
    %% ============================================
    LEXEMES {
        uuid id PK
        text lemma
        text pos
        timestamp with time zone created_at
        text[] tags
        jsonb lemma_group
        text cefr_level
    }

    STUDENT_GOALS {
        uuid id PK
        uuid student_id FK
        timestamp with time zone created_at
        boolean is_active_for_lessons
        timestamp with time zone last_used_at
        uuid added_by_user_id FK
        uuid lexeme_id FK
    }

    STUDENT_LEXEME_HISTORY {
        uuid student_id PK
        uuid lexeme_id PK
        integer total_count
        integer lesson_count
        timestamp with time zone first_used_at
        timestamp with time zone last_used_at
        timestamp with time zone acquired_at
        uuid acquired_lesson_id FK
        uuid first_lesson_id FK
        integer focus_lesson_count
        timestamp with time zone focus_acquired_at
        boolean is_stable
        timestamp with time zone stable_at
        uuid stable_lesson_id FK
    }

    VOCAB_EVIDENCE {
        uuid id PK
        uuid lesson_id FK
        uuid segment_id FK
        uuid student_id FK
        integer start_char
        integer end_char
        text text_snippet
        text tag
        uuid lexeme_id FK
        boolean was_in_focus
    }

    VOCAB_INGESTION_QUEUE {
        uuid id PK
        uuid lesson_id FK
        uuid segment_id FK
        uuid student_id FK
        text text
        text request_id UK
        text status
        integer retry_count
    }

    VOCAB_PROCESSING_LOG {
        uuid id PK
        text request_id UK
        uuid lesson_id FK
        uuid segment_id FK
        uuid student_id FK
        text text_hash
        timestamp with time zone processed_at
    }

    VOCAB_SETS {
        uuid id PK
        text name
        text slug UK
        text description
        text set_type
        integer display_order
        integer xp
        integer set_size
    }

    VOCAB_SET_ITEMS {
        uuid id PK
        uuid set_id FK
        integer position
        uuid lexeme_id FK
    }

    VOCAB_RECOMMENDATIONS {
        bigint id PK
        uuid student_id FK
        bigint recommendation_lexicon_id FK
        uuid lexeme_id FK
        text status
        jsonb reason
    }

    RECOMMENDATION_LEXICON {
        bigint id PK
        text lemma
        text pos
        uuid lexeme_id UK
        text cefr_level
        integer frequency
        jsonb tags
    }

    LEXEME_FREQUENCY {
        uuid id PK
        uuid lexeme_id FK
        text source
        integer spoken_level
        integer written_level
        integer frequency_rank
    }

    %% ============================================
    %% GRAMMAR
    %% ============================================
    GRAMMAR_EVIDENCE {
        uuid id PK
        uuid lesson_id FK
        uuid segment_id FK
        uuid student_id FK
        text structure_code
        text detector
        numeric confidence
        text text_snippet
    }

    GRAMMAR_STRUCTURES_REF {
        text structure_code PK
        text cefr_level
        text display_name
        text description
        jsonb examples
        text[] tags
        integer priority
    }

    STUDENT_GRAMMAR_HISTORY {
        uuid id PK
        uuid student_id FK
        text structure_code
        text cefr_level
        integer total_count
        integer lesson_count
        text status
    }

    MISTAKE_DISPLAY_MAP {
        text error_type PK
        text display_group
        text display_name
        integer display_priority
        boolean is_display_whitelisted
    }

    %% ============================================
    %% TEACHER MANAGEMENT
    %% ============================================
    TEACHER_AVAILABILITY_SLOTS {
        uuid id PK
        uuid teacher_id FK
        integer day_of_week
        time start_time
        time end_time
        boolean is_active
    }

    TEACHER_AVAILABILITY_EXCEPTIONS {
        uuid id PK
        uuid teacher_id FK
        date exception_date
        time start_time
        time end_time
        text type
    }

    TEACHER_VERIFICATIONS {
        uuid id PK
        uuid teacher_id FK UK
        text sumsub_applicant_id
        text verification_status
        timestamp with time zone submitted_at
        timestamp with time zone approved_at
        text stripe_account_id
        text stripe_account_status
    }

    TEACHER_EARNINGS {
        uuid id PK
        uuid teacher_id FK
        uuid lesson_payment_id FK
        integer gross_amount_cents
        numeric commission_rate
        integer commission_amount_cents
        integer net_amount_cents
        boolean is_available_for_payout
    }

    TEACHER_EARNING_TRANSACTIONS {
        uuid id PK
        uuid teacher_id FK
        text transaction_type
        uuid lesson_id FK
        integer amount_cents
        integer gross_amount_cents
        numeric commission_rate
        integer commission_amount_cents
    }

    TEACHER_EARNINGS_REVERSALS {
        uuid id PK
        uuid teacher_id FK
        uuid original_earning_id FK
        uuid refund_id FK
        integer reversed_amount_cents
        integer reversed_commission_cents
    }

    %% ============================================
    %% PAYMENTS & CREDITS
    %% ============================================
    LESSON_PACKAGES {
        uuid id PK
        uuid teacher_id FK
        text stripe_product_id
        text stripe_price_id
        text name
        text description
        integer lesson_count
        text package_type
        integer price_cents
        text currency
        integer validity_days
        boolean is_active
    }

    LESSON_PAYMENTS {
        uuid id PK
        uuid lesson_id FK
        uuid student_id FK
        uuid teacher_id FK
        uuid credit_id FK
        integer amount_cents
        text currency
        text status
        timestamp with time zone payment_date
        timestamp with time zone release_date
    }

    STUDENT_CREDIT_TRANSACTIONS {
        uuid id PK
        uuid student_id FK
        uuid teacher_id FK
        text transaction_type
        integer amount
        text description
        uuid lesson_id FK
        uuid package_id FK
        text stripe_payment_intent_id
        text stripe_subscription_id
    }

    REFUNDS {
        uuid id PK
        uuid student_id FK
        uuid teacher_id FK
        uuid lesson_payment_id FK
        uuid student_credit_id FK
        text stripe_refund_id
        integer refund_amount_cents
        text currency
        text refund_type
        text status
        integer commission_reversed_cents
    }

    COMMISSION_TIERS {
        uuid id PK
        integer min_hours
        integer max_hours
        numeric commission_rate
    }

    PAYOUT_REQUESTS {
        uuid id PK
        uuid teacher_id FK
        integer amount_cents
        text currency
        text status
        text stripe_transfer_id
        timestamp with time zone requested_at
        timestamp with time zone completed_at
    }

    PAYMENT_AUDIT_LOG {
        uuid id PK
        uuid lesson_payment_id FK
        text payment_method
        jsonb calculation_details
    }

    %% ============================================
    %% JUSTAI - AI CONVERSATIONS & SUBSCRIPTIONS
    %% ============================================
    JUSTAI_SUBSCRIPTIONS {
        uuid id PK
        uuid student_id FK
        text subscription_type
        text status
        integer monthly_message_limit
        integer messages_used_this_period
        integer price_cents
        text currency
        text billing_cycle
        text stripe_subscription_id UK
        text stripe_customer_id
        timestamp with time zone current_period_start
        timestamp with time zone current_period_end
        text billing_period
        boolean cancel_at_period_end
        integer trial_days
        integer voice_minutes_limit
    }

    JUSTAI_SUBSCRIPTION_PLANS {
        uuid id PK
        text plan_name
        text plan_type
        text billing_period
        text description
        integer monthly_message_limit
        boolean includes_voice
        integer price_cents
        integer monthly_equivalent_cents
        integer discount_percentage
        text stripe_price_id UK
        text stripe_product_id
        jsonb features
        boolean is_active
        boolean is_featured
        integer display_order
        integer voice_minutes_limit
        text pricing_variant
    }

    JUSTAI_CONVERSATIONS {
        uuid id PK
        uuid student_id FK
        text title
        text conversation_type
        text scenario
        boolean is_voice_session
        integer voice_session_duration
        text status
        timestamp with time zone created_at
        timestamp with time zone last_message_at
        jsonb session_memory
        jsonb language_feedback
        integer conversation_score
        uuid agent_id FK
        boolean unlock_next_scenario
    }

    JUSTAI_MESSAGES {
        uuid id PK
        uuid conversation_id FK
        text role
        text content
        integer tokens_used
        boolean is_voice_message
        integer audio_duration_seconds
    }

    JUSTAI_VOICE_SESSIONS {
        uuid id PK
        uuid conversation_id FK
        uuid student_id FK
        text elevenlabs_conversation_id UK
        uuid virtual_lesson_id FK
        integer total_duration_seconds
        integer student_speaking_time_seconds
        integer ai_speaking_time_seconds
        integer elevenlabs_character_count
        integer elevenlabs_cost_cents
        timestamp with time zone started_at
        timestamp with time zone ended_at
        boolean transcription_complete
        boolean vocabulary_processed
        boolean grammar_processed
    }

    JUSTAI_AGENT_CONFIGS {
        uuid id PK
        uuid student_id FK
        text[] learning_goals
        text[] interests
        text cefr_level
        text preferred_voice_id
        numeric speaking_rate
        text correction_style
        text formality_level
        text system_prompt_template
        boolean is_active
        boolean onboarding_completed
    }

    JUSTAI_AGENTS {
        uuid id PK
        uuid parent_agent_id FK
        integer step_number
        boolean is_multi_step
        integer total_steps
        text name
        text description
        text icon
        text image_url
        text category
        text personality_name
        text elevenlabs_agent_id UK
        integer recommended_duration_seconds
        text unlock_condition_type
        integer unlock_condition_value
        text difficulty_level
        text recommended_cefr_level
        boolean is_active
        boolean is_premium
        integer display_order
        uuid teacher_id FK
        uuid[] student_id
        boolean is_published
        text system_prompt
        text first_message
        text voice_id
        text language
        jsonb evaluation_criteria
        jsonb data_collection
        text long_description
        jsonb workflow_edges
        text edge_source_criteria_id
        uuid knowledge_base_id FK
        jsonb canvas_position
        text step_path
        text branch_label
        boolean is_terminal
    }

    JUSTAI_USAGE_LOG {
        uuid id PK
        uuid subscription_id FK
        uuid student_id FK
        uuid message_id FK
        uuid conversation_id FK
        integer tokens_used
        integer cost_cents
        boolean is_voice_message
        integer elevenlabs_characters
        timestamp with time zone billing_period_start
        timestamp with time zone billing_period_end
    }

    JUSTAI_STUDENT_PROGRESS {
        uuid id PK
        uuid student_id FK
        uuid agent_id FK
        text status
        integer sessions_count
        integer total_messages_sent
        integer total_time_spent_seconds
        integer best_session_score
        integer latest_session_score
        numeric average_session_score
        uuid best_session_conversation_id FK
        timestamp with time zone unlocked_at
        timestamp with time zone first_started_at
        timestamp with time zone completed_at
    }

    %% ============================================
    %% AI FEATURES
    %% ============================================
    AI_FEATURE_ACCESS {
        uuid id PK
        uuid user_id FK
        text feature_name
        boolean is_enabled
        integer monthly_token_limit
        integer daily_token_limit
        integer limit_reset_day
        timestamp with time zone granted_at
        uuid granted_by FK
        timestamp with time zone expires_at
        text preferred_model
    }

    AI_INTERACTIONS {
        uuid id PK
        uuid user_id FK
        text feature_name
        uuid student_id FK
        text request_type
        text user_prompt
        integer input_tokens
        integer output_tokens
        numeric estimated_cost_usd
        text model_name
        boolean was_successful
        text error_message
        integer response_time_ms
    }

    AI_USAGE_SUMMARY {
        uuid id PK
        uuid user_id FK
        text feature_name
        text period_type
        timestamp with time zone period_start
        timestamp with time zone period_end
        integer total_interactions
        integer total_input_tokens
        integer total_output_tokens
        numeric total_cost_usd
    }

    AI_CHAT_CONVERSATIONS {
        uuid id PK
        text session_id UK
        uuid user_id FK
        text feature_name
        uuid student_id FK
        text title
    }

    AI_CHAT_MESSAGES {
        uuid id PK
        uuid conversation_id FK
        text role
        text content
        integer tokens_used
    }

    %% ============================================
    %% PRONUNCIATION
    %% ============================================
    PRONUNCIATION_SESSIONS {
        uuid id PK
        uuid student_id FK
        uuid lesson_id FK
        text source_type
        text dict_type
        text dict_dialect
        text provider_api
        boolean is_final
        jsonb metadata
    }

    PRONUNCIATION_RAW_PAYLOADS {
        uuid id PK
        uuid session_id FK
        jsonb request_payload
        jsonb response_payload
    }

    PRONUNCIATION_PHONEME_ATTEMPTS {
        uuid id PK
        uuid student_id FK
        uuid pronunciation_session_id FK
        uuid practice_result_id FK
        uuid practice_item_id FK
        text practice_type
        timestamp with time zone occurred_at
        text utterance_text
        text token_text
        text word_text
        text ipa_symbol
        integer position_in_word
        integer score
        boolean is_target_phoneme
    }

    PRONUNCIATION_PRACTICE_SESSIONS {
        uuid id PK
        uuid student_id FK
        timestamp with time zone started_at
        timestamp with time zone completed_at
        text status
        text[] target_phonemes
        integer total_items
        integer completed_items
        boolean is_baseline
    }

    PRONUNCIATION_PRACTICE_ITEMS {
        uuid id PK
        uuid student_id FK
        uuid practice_session_id FK
        text target_ipa_symbol
        text practice_type
        text word_text
        text word_ipa
        text pair_word_text
        text pair_word_ipa
        text reference_sentence
        integer difficulty_tier
        text selection_reason
        integer item_order
    }

    PRONUNCIATION_PRACTICE_RESULTS {
        uuid id PK
        uuid practice_item_id FK
        uuid practice_session_id FK
        uuid pronunciation_session_id FK
        timestamp with time zone attempted_at
        numeric pronunciation_score
        boolean was_correct
        boolean phoneme_was_correct
        integer attempt_number
        numeric overall_score
        numeric fluency_score
        numeric integrity_score
    }

    %% ============================================
    %% FOCUS & VOCABULARY TRACKING
    %% ============================================
    FOCUS_ACTIVATION_EVENTS {
        uuid id PK
        uuid student_id FK
        uuid lexeme_id FK
        uuid lesson_id FK
        text from_state
        text to_state
    }

    %% ============================================
    %% ROOMS & TEACHING
    %% ============================================
    ROOMS {
        uuid id PK
        uuid owner_teacher_id FK
        text title
        text status
    }

    ROOM_MEMBERS {
        uuid room_id PK
        uuid student_id PK
    }

    WORKFLOW_TEMPLATES {
        uuid id PK
        uuid teacher_id FK
        text name
        text description
        jsonb generation_params
        jsonb workflow_structure
        integer usage_count
        boolean is_public
    }

    %% ============================================
    %% REFERENCE TABLES
    %% ============================================
    LEXEME_FREQUENCY {
        uuid id PK
        uuid lexeme_id FK
        text source
        integer spoken_level
        integer written_level
        integer frequency_rank
    }

    POS_TAG_MAP {
        text tag PK
        text pos
        text pos_explanation
        text tag_explanation
        text language
        jsonb metadata
    }

    STUDENT_PROGRESS {
        uuid id PK
        uuid student_id FK
        uuid lesson_id FK
        jsonb vocab_stats
        jsonb set_stats
    }

    LEXEMES_IMPORT {
        uuid id PK
        text lemma
        text pos
        text source
    }

    IPA_LEXICON {
        uuid id PK
        text ipa_symbol
        text word_text
        text word_ipa
        integer syllable_count
        integer phoneme_position
    }

    %% ============================================
    %% RELATIONSHIPS
    %% ============================================

    %% Profile self-reference for owner_teacher
    PROFILES ||--o{ PROFILES : "owner_teacher"

    %% User roles
    PROFILES ||--o{ USER_ROLES : "has_role"
    PROFILES ||--o{ TEACHER_STUDENT_LINKS : "teacher_link"
    PROFILES ||--o{ TEACHER_STUDENT_LINKS : "student_link"

    %% Lessons with teachers and students
    PROFILES ||--o{ LESSONS : "teaches"
    PROFILES ||--o{ LESSONS : "attends"
    LESSONS ||--o{ LESSON_TRANSCRIPTION_SEGMENTS : "has_segments"
    LESSONS ||--o{ LESSON_MISTAKES_RAW : "has_mistakes"
    LESSONS ||--o{ LESSON_ATTENDANCE : "has_attendance"
    LESSONS ||--o{ LESSON_GRAMMAR_USAGE : "has_grammar_usage"
    LESSONS ||--o{ LESSON_SUMMARIES : "has_summary"
    LESSONS ||--o{ LESSON_NOTES_COLLABORATIVE : "has_notes"
    LESSONS ||--o{ LESSON_ACTIVE_GOALS_SNAPSHOT : "has_goals_snapshot"

    %% Transcription segments
    PROFILES ||--o{ LESSON_TRANSCRIPTION_SEGMENTS : "speaker"
    LESSON_TRANSCRIPTION_SEGMENTS ||--o{ LESSON_MISTAKES_RAW : "has_mistake"
    LESSON_TRANSCRIPTION_SEGMENTS ||--o{ VOCAB_EVIDENCE : "has_vocab"
    LESSON_TRANSCRIPTION_SEGMENTS ||--o{ GRAMMAR_EVIDENCE : "has_grammar"

    %% Messaging
    PROFILES ||--o{ CONVERSATIONS : "creates"
    PROFILES ||--o{ CONVERSATIONS : "direct_user1"
    PROFILES ||--o{ CONVERSATIONS : "direct_user2"
    CONVERSATIONS ||--o{ CONVERSATION_PARTICIPANTS : "has_participants"
    CONVERSATIONS ||--o{ MESSAGES : "has_messages"
    CONVERSATIONS ||--o{ MESSAGE_NOTIFICATION_LOG : "notifications"
    PROFILES ||--o{ MESSAGES : "sends"
    MESSAGES ||--o{ MESSAGE_ATTACHMENTS : "has_attachments"

    %% Vocabulary
    LEXEMES ||--o{ STUDENT_GOALS : "goal_for_student"
    LEXEMES ||--o{ STUDENT_LEXEME_HISTORY : "history_for_student"
    LEXEMES ||--o{ VOCAB_EVIDENCE : "evidenced_in"
    LEXEMES ||--o{ VOCAB_SET_ITEMS : "in_set"
    LEXEMES ||--o{ LEXEME_FREQUENCY : "frequency_data"
    LEXEMES ||--o{ FOCUS_ACTIVATION_EVENTS : "focus_events"
    LEXEMES ||--o{ LESSON_ACTIVE_GOALS_SNAPSHOT : "in_snapshot"

    PROFILES ||--o{ STUDENT_GOALS : "has_goals"
    PROFILES ||--o{ STUDENT_LEXEME_HISTORY : "vocab_history"
    PROFILES ||--o{ VOCAB_EVIDENCE : "vocab_evidence"

    VOCAB_SETS ||--o{ VOCAB_SET_ITEMS : "contains"

    %% Grammar
    GRAMMAR_STRUCTURES_REF ||--o{ GRAMMAR_EVIDENCE : "evidence"
    GRAMMAR_STRUCTURES_REF ||--o{ STUDENT_GRAMMAR_HISTORY : "history"
    PROFILES ||--o{ GRAMMAR_EVIDENCE : "grammar_evidence"
    LESSONS ||--o{ GRAMMAR_EVIDENCE : "grammar_evidence"

    %% Teacher
    PROFILES ||--o{ TEACHER_AVAILABILITY_SLOTS : "availability"
    PROFILES ||--o{ TEACHER_AVAILABILITY_EXCEPTIONS : "exceptions"
    PROFILES ||--o{ TEACHER_VERIFICATIONS : "verification"
    PROFILES ||--o{ TEACHER_EARNINGS : "earnings"
    PROFILES ||--o{ TEACHER_EARNING_TRANSACTIONS : "transactions"
    PROFILES ||--o{ TEACHER_EARNINGS_REVERSALS : "reversals"

    %% Payments
    PROFILES ||--o{ LESSON_PACKAGES : "packages"
    LESSONS ||--o{ LESSON_PAYMENTS : "payment"
    PROFILES ||--o{ LESSON_PAYMENTS : "student_payment"
    PROFILES ||--o{ LESSON_PAYMENTS : "teacher_payment"
    LESSON_PAYMENTS ||--o{ TEACHER_EARNINGS : "earning"
    LESSON_PAYMENTS ||--o{ REFUNDS : "refund"
    LESSON_PAYMENTS ||--o{ PAYMENT_AUDIT_LOG : "audit"

    PROFILES ||--o{ STUDENT_CREDIT_TRANSACTIONS : "credits"
    LESSON_PACKAGES ||--o{ STUDENT_CREDIT_TRANSACTIONS : "package_purchase"
    LESSONS ||--o{ STUDENT_CREDIT_TRANSACTIONS : "lesson_debit"
    REFUNDS ||--o{ STUDENT_CREDIT_TRANSACTIONS : "credit_refund"

    PROFILES ||--o{ PAYOUT_REQUESTS : "payout_requests"

    %% JustAI Subscriptions
    PROFILES ||--o{ JUSTAI_SUBSCRIPTIONS : "subscription"
    JUSTAI_SUBSCRIPTIONS ||--o{ JUSTAI_USAGE_LOG : "usage_logs"

    %% JustAI Conversations
    PROFILES ||--o{ JUSTAI_CONVERSATIONS : "conversations"
    JUSTAI_AGENTS ||--o{ JUSTAI_CONVERSATIONS : "agent_conversations"
    JUSTAI_CONVERSATIONS ||--o{ JUSTAI_MESSAGES : "messages"
    JUSTAI_CONVERSATIONS ||--o{ JUSTAI_VOICE_SESSIONS : "voice_sessions"
    PROFILES ||--o{ JUSTAI_VOICE_SESSIONS : "voice_sessions"
    LESSONS ||--o{ JUSTAI_VOICE_SESSIONS : "virtual_lesson"

    JUSTAI_CONVERSATIONS ||--o{ JUSTAI_STUDENT_PROGRESS : "progress"

    %% JustAI Agents
    PROFILES ||--o{ JUSTAI_AGENTS : "teacher_agents"
    JUSTAI_AGENTS ||--o{ JUSTAI_AGENTS : "parent_agent"
    JUSTAI_AGENTS ||--o{ JUSTAI_AGENTS : "knowledge_base"
    JUSTAI_AGENT_CONFIGS ||--o{ JUSTAI_AGENTS : "config_for_agent"

    %% AI Features
    PROFILES ||--o{ AI_FEATURE_ACCESS : "feature_access"
    PROFILES ||--o{ AI_INTERACTIONS : "ai_interactions"
    AI_INTERACTIONS ||--o{ AI_USAGE_SUMMARY : "usage_summary"

    PROFILES ||--o{ AI_CHAT_CONVERSATIONS : "chat_conversations"
    AI_CHAT_CONVERSATIONS ||--o{ AI_CHAT_MESSAGES : "chat_messages"

    %% Pronunciation
    PROFILES ||--o{ PRONUNCIATION_SESSIONS : "pronunciation_sessions"
    LESSONS ||--o{ PRONUNCIATION_SESSIONS : "pronunciation_lesson"
    PRONUNCIATION_SESSIONS ||--o{ PRONUNCIATION_RAW_PAYLOADS : "raw_payloads"
    PRONUNCIATION_SESSIONS ||--o{ PRONUNCIATION_PHONEME_ATTEMPTS : "phoneme_attempts"

    PROFILES ||--o{ PRONUNCIATION_PRACTICE_SESSIONS : "practice_sessions"
    PRONUNCIATION_PRACTICE_SESSIONS ||--o{ PRONUNCIATION_PRACTICE_ITEMS : "practice_items"
    PRONUNCIATION_PRACTICE_ITEMS ||--o{ PRONUNCIATION_PRACTICE_RESULTS : "results"
    PRONUNCIATION_SESSIONS ||--o{ PRONUNCIATION_PRACTICE_RESULTS : "pronunciation_result"

    PROFILES ||--o{ PRONUNCIATION_PRACTICE_ITEMS : "practice_items"

    %% Focus
    PROFILES ||--o{ FOCUS_ACTIVATION_EVENTS : "focus_events"
    LEXEMES ||--o{ FOCUS_ACTIVATION_EVENTS : "focus_lexemes"

    %% Rooms
    PROFILES ||--o{ ROOMS : "owned_rooms"
    ROOMS ||--o{ ROOM_MEMBERS : "members"
    PROFILES ||--o{ ROOM_MEMBERS : "room_member"

    %% Workflows
    PROFILES ||--o{ WORKFLOW_TEMPLATES : "workflows"

    %% Student Progress
    PROFILES ||--o{ STUDENT_PROGRESS : "progress"
    LESSONS ||--o{ STUDENT_PROGRESS : "lesson_progress"

    %% Recommendations
    PROFILES ||--o{ VOCAB_RECOMMENDATIONS : "recommendations"
    RECOMMENDATION_LEXICON ||--o{ VOCAB_RECOMMENDATIONS : "lexicon_recommendations"
    LEXEMES ||--o{ VOCAB_RECOMMENDATIONS : "lexeme_recommendations"
```

## Table Categories

### Core User Management
- **profiles** - Main user profiles (students, teachers, admins)
- **user_roles** - Role assignments
- **teacher_student_links** - Teacher-student relationships

### Lessons & Transcription
- **lessons** - Scheduled lessons between teachers and students
- **lesson_transcription_segments** - Audio transcription segments
- **lesson_mistakes_raw** - Grammar/mistake records from lessons
- **lesson_attendance** - Attendance tracking
- **lesson_grammar_usage** - Grammar structure usage per lesson
- **lesson_summaries** - AI-generated lesson summaries
- **lesson_notes_collaborative** - Collaborative YJS notes
- **lesson_active_goals_snapshot** - Vocabulary goals at lesson time

### Messaging System
- **conversations** - Chat conversations
- **conversation_participants** - Conversation members
- **messages** - Individual messages
- **message_attachments** - File attachments
- **message_notification_log** - Email notification tracking

### Vocabulary & Lexemes
- **lexemes** - Core vocabulary entries
- **student_goals** - Student's vocabulary goals
- **student_lexeme_history** - Per-student vocabulary tracking
- **vocab_evidence** - Vocabulary usage evidence
- **vocab_ingestion_queue** - Queue for vocabulary processing
- **vocab_processing_log** - Processing history
- **vocab_sets** - Vocabulary sets
- **vocab_set_items** - Items in vocabulary sets
- **vocab_recommendations** - AI recommendations
- **recommendation_lexicon** - Recommendation source lexicon

### Grammar
- **grammar_evidence** - Grammar usage evidence
- **grammar_structures_ref** - Grammar structure definitions
- **student_grammar_history** - Per-student grammar tracking
- **mistake_display_map** - Error type display mapping

### Teacher Management
- **teacher_availability_slots** - Weekly availability
- **teacher_availability_exceptions** - Time off / exceptions
- **teacher_verifications** - Identity verification status
- **teacher_earnings** - Earnings per lesson payment
- **teacher_earning_transactions** - Detailed earning transactions
- **teacher_earnings_reversals** - Reversals (refunds)

### Payments & Credits
- **lesson_packages** - Teacher-created lesson packages
- **lesson_payments** - Payment records
- **student_credit_transactions** - Credit balance transactions
- **refunds** - Refund records
- **commission_tiers** - Commission rate configuration
- **payout_requests** - Teacher payout requests
- **payment_audit_log** - Payment processing audit trail

### JustAI Subscriptions
- **justai_subscriptions** - Student subscription status
- **justai_subscription_plans** - Available subscription plans
- **justai_conversations** - AI conversation sessions
- **justai_messages** - Messages in AI conversations
- **justai_voice_sessions** - Voice call sessions with AI
- **justai_agent_configs** - Per-student AI agent configuration
- **justai_agents** - AI agent definitions (scenarios)
- **justai_usage_log** - Token/usage tracking
- **justai_student_progress** - Student progress per agent

### AI Features
- **ai_feature_access** - Feature enablement per user
- **ai_interactions** - AI API interaction logs
- **ai_usage_summary** - Pre-computed usage stats
- **ai_chat_conversations** - AI chat sessions
- **ai_chat_messages** - Chat message history

### Pronunciation
- **pronunciation_sessions** - Raw pronunciation assessment sessions
- **pronunciation_raw_payloads** - SpeechSuper API responses
- **pronunciation_phoneme_attempts** - Per-phoneme results
- **pronunciation_practice_sessions** - Practice session groups
- **pronunciation_practice_items** - Individual practice words
- **pronunciation_practice_results** - Practice attempt results

### Focus & Vocabulary Tracking
- **focus_activation_events** - Vocabulary state change events

### Rooms & Workflows
- **rooms** - Group rooms (teacher-owned)
- **room_members** - Room membership
- **workflow_templates** - AI workflow templates

### Reference Tables
- **lexeme_frequency** - Word frequency data
- **pos_tag_map** - Part-of-speech tag mappings
- **student_progress** - Per-lesson progress records
- **lexemes_import** - Import staging table
- **ipa_lexicon** - IPA pronunciation lexicon
