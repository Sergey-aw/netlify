# JustTalk Agent — Design & Implementation Plan

> Branch: `feature/justtalk-agent`
> Status: Implemented (code + DB + edge fns deployed). Remaining: manual ElevenLabs agent setup.
> Last updated: 2026-05-29
>
> ## Implementation status
> - [x] `justtalk_session` table + indexes + RLS (migration applied to `bcsyrxkfeatnbaqlnxgr`)
> - [x] `justtalk-start` edge fn (deployed, verify_jwt=true)
> - [x] `justtalk-post-call-webhook` edge fn (deployed, verify_jwt=false)
> - [x] `src/services/justtalk.service.ts`
> - [x] `src/pages/JustTalk.tsx` + history sidebar
> - [x] `/justtalk` route, AIChatHome feature card, `src/lib/justtalk-analytics.ts`
> - [x] `npm run build` typecheck passes
> - [ ] MANUAL: create ElevenLabs "JustTalk" agent; set Supabase secret `JUSTTALK_AGENT_ID`
> - [ ] MANUAL: agent `data_collection` fields (focus_area_agreed, commitment_made,
>       student_mood, topics_covered, unresolved_questions, next_session_goal)
> - [ ] MANUAL: set agent post-call webhook URL → `justtalk-post-call-webhook`
>
> Note: `get_student_vocab_stats` RPC is broken in this DB (references missing
> `student_lexeme_history_aggregated`); the snapshot uses `get_student_vocab_overview_v4`
> + direct `student_lexeme_history`/`student_goals` queries instead.

## 1. Concept

A dedicated voice agent ("**JustTalk**") the student talks to about their **whole-app
progress**. Unlike role plays (scenario practice) or the IELTS Coach (single-test
debrief), JustTalk is a cross-cutting progress coach that can see everything the
student has done across the app and remembers every prior coaching conversation.

Each session the agent receives two dynamic variables:

- **`STUDENT_SNAPSHOT`** — full, time-stamped cross-app experience (vocabulary,
  mistake types, IELTS results, role-play progress, pronunciation, goals), rebuilt
  live each session.
- **`CONTEXT_MEMORY`** — the running thread of what the student has discussed with
  JustTalk across all prior sessions (summaries + structured collected data + open
  threads), accumulated over time.

After each session, results are extracted from the ElevenLabs post-call analysis and
persisted, so the next session's `CONTEXT_MEMORY` carries continuity. Past
conversations can be **reviewed in a sidebar** — transcripts are fetched from
ElevenLabs on demand and are **never** written to `lesson_transcription_segments`.

## 2. Why a separate flow (and how existing flows stay safe)

There are three existing voice flows, none of which this touches:

| Flow | Page | Agent source | Dynamic variables |
|------|------|--------------|-------------------|
| Role plays / Freetalk | `AIChatVoice.tsx` | `ELEVENLABS_AGENT_ID` (env default) or per-scenario `justai_agents.elevenlabs_agent_id` | `{ context_memory }` |
| IELTS Coach | `IELTSCoach.tsx` | `IELTS_COACH_AGENT_ID` (env secret) | server-built `MODE`, `EXAMINER_HANDOFF`, ... |
| **JustTalk (new)** | `JustTalk.tsx` | `JUSTTALK_AGENT_ID` (new env secret) | server-built `STUDENT_SNAPSHOT`, `CONTEXT_MEMORY` |

JustTalk is modeled on the **IELTS Coach pattern** (a dedicated start edge function
that aggregates data server-side and returns `{ signed_url, dynamic_variables }`; a
page that only does `conversation.startSession(...)`). It deliberately does **not**
reuse `AIChatVoice`, which is wired to virtual-lesson creation and realtime vocab
ingestion we don't want here.

**Isolation guarantees:**
- New ElevenLabs agent via **new** secret `JUSTTALK_AGENT_ID` (existing
  `ELEVENLABS_AGENT_ID` and `IELTS_COACH_AGENT_ID` untouched).
- New edge functions only; reuses the **read-only** `elevenlabs-get-conversation`.
- New page/route/nav; `AIChatVoice`, role plays, IELTS coach unchanged.
- New table `justtalk_session`; no changes to existing tables.
- No lesson / segment / realtime-vocab writes.

## 3. Components

| # | Component | Type | Action |
|---|-----------|------|--------|
| 1 | `justtalk_session` | DB table | new |
| 2 | `justtalk-start` | edge function | new |
| 3 | `justtalk-post-call-webhook` | edge function | new |
| 4 | `elevenlabs-get-conversation` | edge function | reuse (transcript review) |
| 5 | `src/services/justtalk.service.ts` | client service | new |
| 6 | `src/pages/JustTalk.tsx` (+ history sidebar) | page | new |
| 7 | route `/justtalk` + nav entry | `App.tsx` / `BottomNav` / `AIChatHome` | new |
| 8 | PostHog `trackJustTalk*` helpers | `src/lib/posthog.ts` | new |
| 9 | ElevenLabs "JustTalk" agent config | dashboard | manual |

---

## 4. Database — `justtalk_session`

```sql
create table public.justtalk_session (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  elevenlabs_conversation_id text unique,
  title text,                       -- short label for the sidebar (derived from summary)
  dynamic_variables jsonb,          -- snapshot + memory sent in (audit)
  transcript_summary text,          -- from post-call analysis
  collected_data jsonb,             -- structured data_collection_results
  coach_metrics jsonb,              -- optional: duration, msg counts
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
-- edge functions write via the service role (bypass RLS)
```

Delivered via `apply_migration` (Supabase project `bcsyrxkfeatnbaqlnxgr`).

---

## 5. Edge function `justtalk-start`

Skeleton cloned from `ielts-coach-start`: CORS handling → auth via anon-key client
(`getUser()`) → service-role client for data queries.

### 5.1 Data sources → snapshot sections (all timestamped)

| Section | Source | Timestamp fields |
|---------|--------|------------------|
| profile | `profiles` | — (provides `timezone`, `native_language`, name) |
| vocabulary | RPCs `get_student_vocab_overview_v4`, `get_student_vocab_stats`, `get_active_lesson_goals`; `student_lexeme_history` + `lexemes` | `acquired_at`, `last_used_at`, `stable_at` |
| mistakes | `lesson_mistakes_view` where `ai_validated=true`, grouped by `display_group`/`display_name` | per-occurrence `created_at` → derived `first_seen`/`last_seen` |
| ielts | `ielts_test_score` (latest per test) + `ielts_attempt`/`ielts_score` (trend) | `finalized_at`, `scored_at` |
| roleplays | `justai_student_progress` ⋈ `justai_agents`; recent `justai_conversations` | `first_started_at`, `completed_at`, `last_message_at` |
| pronunciation | `pronunciation_baseline_workout_summary` (latest) | `completed_at` |
| goals | `student_goals` (active) + open `vocab_recommendations` | `created_at`, `last_used_at` |

Each section is wrapped in its own try/catch — a failing section degrades to empty and
never fails the whole session.

### 5.2 `STUDENT_SNAPSHOT` schema (time-aware)

```jsonc
{
  "generated_at": "2026-05-28T14:30:00Z",   // "now" anchor for recency reasoning
  "timezone": "Europe/Moscow",               // from profile, for natural phrasing
  "profile": { "name": "Sergey", "native_language": "Russian", "cefr": "B2" },
  "vocabulary": {
    "known_total": 1840, "stable_total": 1210,
    "recently_acquired": [{ "lemma": "ubiquitous", "cefr": "C1", "acquired_at": "2026-05-25T..." }],
    "current_focus": [{ "lemma": "...", "added_at": "..." }]
  },
  "mistakes": [
    { "type": "subject_verb_agreement", "display_name": "Subject–verb agreement",
      "count": 4, "first_seen": "2026-05-10T...", "last_seen": "2026-05-27T...",
      "examples": [{ "sentence": "...", "at": "2026-05-26T..." }] }
  ],
  "ielts": {
    "latest": { "bands": {"fluency":7,"lexical":6.5,"grammar":6,"pronunciation":7}, "scored_at": "2026-05-20T..." },
    "history": [{ "attempt": 1, "bands": {}, "finalized_at": "2026-04-12T..." }]
  },
  "roleplays": [
    { "scenario": "Job interview", "category": "Interview", "status": "completed",
      "sessions": 3, "best_score": 82, "avg_score": 74,
      "first_started_at": "2026-05-01T...", "completed_at": "2026-05-15T...", "last_session_at": "2026-05-15T..." }
  ],
  "pronunciation": { "avg_pronunciation": 78, "avg_fluency": 72, "completed_at": "2026-05-18T..." },
  "goals": [{ "lexeme": "...", "created_at": "...", "last_used_at": "..." }]
}
```

### 5.3 `CONTEXT_MEMORY` build (last N = 5 sessions)

Read the most recent `justtalk_session` rows for the student (`ended_at not null`),
reverse to chronological order:

```jsonc
{
  "last_talked_at": "2026-05-26T19:00:00Z",
  "sessions": [
    { "at": "2026-05-26T19:00:00Z",
      "summary": "Discussed IELTS Part 2 nerves; agreed to drill cue-card timing.",
      "collected_data": {
        "focus_area_agreed": "cue-card fluency",
        "commitment_made": "2 mock Part-2s this week",
        "student_mood": "motivated",
        "next_session_goal": "review the mocks"
      } }
  ],
  "open_threads": ["review the two Part-2 mocks", "filler-word reduction"]
}
```

`open_threads` = unresolved `next_session_goal` / `unresolved_questions` from recent
sessions.

### 5.4 Flow & return shape

1. Build both objects.
2. `insert into justtalk_session (student_id, dynamic_variables, started_at)` → `id`.
3. Fetch ElevenLabs signed URL using `JUSTTALK_AGENT_ID`.
4. Return:

```jsonc
{
  "session_id": "<justtalk_session.id>",
  "signed_url": "...",
  "dynamic_variables": {
    "STUDENT_SNAPSHOT": "<json string>",
    "CONTEXT_MEMORY": "<json string>",
    "STUDENT_NAME": "Sergey"   // optional
  }
}
```

---

## 6. Edge function `justtalk-post-call-webhook`

Clone of `elevenlabs-post-call-webhook`, isolated:

- Verify `ELEVENLABS_WEBHOOK_SECRET` signature (same logic).
- Handle only `post_call_transcription`.
- Locate the row in `justtalk_session` by `elevenlabs_conversation_id`.
- Reuse the `transformAnalysisData` logic to extract `transcript_summary` +
  `collected_data`; derive a short `title`.
- `update justtalk_session set transcript_summary, collected_data, title, ended_at`.
- No unlock/progress RPC (that is role-play specific). Always return 200.
- Configured as the JustTalk agent's post-call webhook URL only — the existing
  `justai_conversations` webhook stays untouched.

To make analysis structured and re-feedable, the JustTalk agent must define these
`data_collection` fields in its ElevenLabs config: `focus_area_agreed`,
`commitment_made`, `student_mood`, `topics_covered`, `unresolved_questions`,
`next_session_goal`.

---

## 7. Transcript review / history sidebar ("recreate" the conversation)

**No segments stored.** Flow:

1. Sidebar lists the student's past `justtalk_session` rows (RLS-scoped):
   `started_at`, `title`/`transcript_summary`, `collected_data.focus_area_agreed`.
2. Clicking a session calls the existing `getConversationTranscript(elevenlabs_conversation_id)`
   → `elevenlabs-get-conversation` → returns the full ElevenLabs transcript.
3. Render the transcript inline alongside the live panel (read-only review).

Notes:
- ElevenLabs needs a few seconds post-call to finalize a transcript; for historical
  review it is always ready.
- The client only ever holds its own conversation IDs (from RLS-scoped
  `justtalk_session`), so reusing the generic fetch is safe.
- Optional hardening: add an ownership check inside `elevenlabs-get-conversation`.
  Not required for v1.

---

## 8. Client service `src/services/justtalk.service.ts`

```ts
export interface JustTalkStartResult {
  session_id: string;
  signed_url: string;
  dynamic_variables: Record<string, string>;
}
export interface JustTalkSessionRow {
  id: string;
  elevenlabs_conversation_id: string | null;
  title: string | null;
  transcript_summary: string | null;
  collected_data: Record<string, unknown> | null;
  started_at: string;
  ended_at: string | null;
}

export async function startJustTalkSession(): Promise<JustTalkStartResult> { /* invoke 'justtalk-start' */ }
export async function updateJustTalkConversationId(sessionId: string, convId: string): Promise<void> { /* update justtalk_session */ }
export async function listJustTalkSessions(): Promise<JustTalkSessionRow[]> { /* select justtalk_session order started_at desc */ }
export async function getJustTalkTranscript(elevenConvId: string) { return getConversationTranscript(elevenConvId); }
```

Mirrors `startIeltsCoachSession` / `updateCoachSessionConversationId`.

---

## 9. Page `src/pages/JustTalk.tsx`

Structure copied from `IELTSCoach.tsx`: phases `idle → connecting → in_session →
error`, mic-permission probe, `useConversation({ onConnect, onMessage, onError })`,
mute toggle, live transcript, End button. Start logic:

```ts
const res = await startJustTalkSession();
const convId = await conversation.startSession({
  signedUrl: res.signed_url,
  dynamicVariables: res.dynamic_variables,
});
if (typeof convId === 'string') {
  await updateJustTalkConversationId(res.session_id, convId);
} else {
  // fall back to parsing conversation_id from signed_url (as IELTSCoach does)
}
```

Plus a **history sidebar** (section 7): `listJustTalkSessions()` on mount; on row
click → `getJustTalkTranscript()` → render. No lesson / voice-session / vocab writes.

---

## 10. Routing, nav, analytics

- `App.tsx`: `<Route path="/justtalk" element={<ProtectedRoute><JustTalk/></ProtectedRoute>} />` + import.
- Entry point: a card on `AIChatHome` and/or a `BottomNav` item → `navigate('/justtalk')`.
  No nav state (the page self-loads all data).
- `src/lib/posthog.ts`: `trackJustTalkSessionStarted`, `trackJustTalkSessionEnded`,
  `trackJustTalkTranscriptViewed` — mirror IELTS coach events.

---

## 11. ElevenLabs agent (manual, dashboard)

- Create the "JustTalk" agent; set Supabase secret `JUSTTALK_AGENT_ID`.
- System prompt references `{{STUDENT_NAME}}`, `{{STUDENT_SNAPSHOT}}`,
  `{{CONTEXT_MEMORY}}`; instructs: act as a supportive progress coach; cite specific
  events with their dates using `generated_at`/`timezone` to phrase recency; continue
  open threads from `CONTEXT_MEMORY`; end by agreeing a focus + next-session goal.
- `data_collection` fields: `focus_area_agreed`, `commitment_made`, `student_mood`,
  `topics_covered`, `unresolved_questions`, `next_session_goal`.
- Post-call webhook URL → `justtalk-post-call-webhook`.

---

## 12. Build / deploy order

1. `apply_migration` → `justtalk_session` (+ RLS).
2. Deploy `justtalk-start`, `justtalk-post-call-webhook`.
3. Create the agent, set `JUSTTALK_AGENT_ID`, configure data_collection + webhook URL.
4. Add the client service, page (+ sidebar), route, nav, analytics.
5. `npm run build` typecheck.

## 13. Testing checklist

- First-ever session: `CONTEXT_MEMORY` empty, snapshot populated → agent greets fresh.
- After a session: webhook wrote `transcript_summary` / `collected_data` / `title`;
  next session shows continuity.
- Sidebar: lists past sessions; clicking fetches the ElevenLabs transcript; nothing
  written to `lesson_transcription_segments`.
- Timestamp relevance: agent references dates correctly.
- Empty-data student: each section degrades gracefully.
- Regression: role plays + IELTS coach + AIChatVoice unaffected.

## 14. Defaults applied (override if needed)

- Webhook: dedicated `justtalk-post-call-webhook`.
- Memory window: last 5 sessions + latest `collected_data` + open threads.
- Transcript: fetched on demand from ElevenLabs, not stored.
- `data_collection`: the 6 fields in section 11.

---

## 15. Implementation roadmap (task breakdown)

### Phase 1 — Backend foundation
1. **Migration** `justtalk_session` table + indexes + RLS (apply via Supabase MCP).
2. **Edge fn `justtalk-start`**: auth, snapshot builders (per-section, time-stamped),
   `CONTEXT_MEMORY` builder, session insert, signed URL, return shape.
3. **Edge fn `justtalk-post-call-webhook`**: signature verify, locate by conv id,
   `transformAnalysisData`, persist summary/collected_data/title/ended_at.

### Phase 2 — Client core
4. **Service** `justtalk.service.ts`: start, update conv id, list sessions, get transcript.
5. **Page** `JustTalk.tsx`: phases, mic probe, `useConversation`, start/end, live transcript.
6. **Routing + nav**: `/justtalk` route, `AIChatHome` card / `BottomNav` entry.

### Phase 3 — History & polish
7. **History sidebar** in `JustTalk.tsx`: list past sessions + on-demand transcript view.
8. **Analytics**: `trackJustTalk*` helpers + wiring.

### Phase 4 — Agent config & verification (manual + test)
9. **ElevenLabs agent**: create, set `JUSTTALK_AGENT_ID`, data_collection, webhook URL.
10. **End-to-end test** against the testing checklist; `npm run build`.
