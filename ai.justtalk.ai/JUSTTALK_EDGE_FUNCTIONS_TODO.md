# JustTalk — Edge functions & infra to update in the main (Supabase) repo

The `supabase/` directory is gitignored in this app repo. The JustTalk edge
functions were developed/deployed against Supabase project **`bcsyrxkfeatnbaqlnxgr`
(Core App)** but their source must be committed in the separate edge-functions repo.
Local working copies (source of truth to copy over) live at:

- `supabase/functions/justtalk-start/index.ts`
- `supabase/functions/justtalk-post-call-webhook/index.ts`

## 1. New edge functions to add

| Function | Type | verify_jwt | Purpose |
|----------|------|------------|---------|
| `justtalk-start` | new | **true** | Auth user, build `STUDENT_SNAPSHOT` + `CONTEXT_MEMORY` from cross-app data, insert `justtalk_session`, return `{ session_id, signed_url, dynamic_variables }` using `JUSTTALK_AGENT_ID`. |
| `justtalk-post-call-webhook` | new | **false** | HMAC-verified ElevenLabs post-call webhook. Locates `justtalk_session` by `elevenlabs_conversation_id`, persists `transcript_summary` / `collected_data` / `title` / `coach_metrics` / `ended_at`, and captures a `justtalk_session_analyzed` event to PostHog. |

Reused unchanged: `elevenlabs-get-conversation` (on-demand transcript fetch for the history sidebar).

## 2. Database migration (already applied to `bcsyrxkfeatnbaqlnxgr`)

Table `public.justtalk_session` + index + RLS. Add this migration to the repo for parity:

```sql
create table public.justtalk_session (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  elevenlabs_conversation_id text unique,
  title text,
  dynamic_variables jsonb,
  transcript_summary text,
  collected_data jsonb,
  coach_metrics jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index justtalk_session_student_recent_idx
  on public.justtalk_session (student_id, started_at desc);
alter table public.justtalk_session enable row level security;
create policy justtalk_session_select_own on public.justtalk_session
  for select using (auth.uid() = student_id);
create policy justtalk_session_update_own on public.justtalk_session
  for update using (auth.uid() = student_id);
```

## 3. Secrets to set (Supabase project secrets)

| Secret | Used by | Notes |
|--------|---------|-------|
| `JUSTTALK_AGENT_ID` | justtalk-start | ElevenLabs JustTalk agent id (new, separate from `ELEVENLABS_AGENT_ID` / `IELTS_COACH_AGENT_ID`). |
| `JUSTTALK_WEBHOOK_SECRET` | justtalk-post-call-webhook | Signing secret of the dedicated JustTalk ElevenLabs webhook. Falls back to `ELEVENLABS_WEBHOOK_SECRET` if unset. |
| `POSTHOG_API_KEY` | justtalk-post-call-webhook | PostHog project key for app.justtalk.ai (244423). Capture is skipped if unset. |
| `POSTHOG_HOST` | justtalk-post-call-webhook | Optional; defaults to `https://us.i.posthog.com`. |

Already present (reused): `ELEVENLABS_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.

## 4. ElevenLabs dashboard config (manual)

- Create the "JustTalk" agent; set `JUSTTALK_AGENT_ID`.
- Agent prompt/first message may only reference: `{{STUDENT_NAME}}`, `{{STUDENT_SNAPSHOT}}`, `{{CONTEXT_MEMORY}}` (a missing referenced variable terminates the call immediately). `justtalk-start` always sends all three.
- Data collection fields: `focus_area_agreed`, `commitment_made`, `student_mood`, `topics_covered`, `unresolved_questions`, `next_session_goal`.
- Create a dedicated post-call webhook → `…/functions/v1/justtalk-post-call-webhook`, copy its signing secret into `JUSTTALK_WEBHOOK_SECRET`, and attach it to the JustTalk agent.

## 5. Deploy order

1. Apply the migration.
2. Deploy `justtalk-start` (verify_jwt=true) and `justtalk-post-call-webhook` (verify_jwt=false).
3. Set secrets (section 3).
4. Configure the ElevenLabs agent + webhook (section 4).
