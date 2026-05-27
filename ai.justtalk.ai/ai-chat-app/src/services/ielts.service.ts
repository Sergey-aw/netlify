import { supabase } from '@/lib/supabase';

export type AccessTier = 'free' | 'paid';
export type AttemptStatus =
  | 'in_progress'
  | 'examiner_complete'
  | 'coach_complete'
  | 'abandoned';

export interface IeltsScore {
  pronunciation_band: number;
  fluency_band: number;
  lexical_band: number;
  grammar_band: number;
}

export interface IeltsAttempt {
  id: string;
  attempt_number: number;
  status: AttemptStatus;
  finalized_at: string | null;
  ielts_score: IeltsScore | null;
}

export interface IeltsPart {
  id: string;
  part_number: 1 | 2 | 3;
  max_response_sec: number;
  access_tier: AccessTier;
  ielts_attempt: IeltsAttempt[];
}

export interface IeltsTestRow {
  id: string;
  theme: string;
  ordering: number;
  access_tier: AccessTier;
  ielts_test_part: IeltsPart[];
}

/**
 * Per-Part summary derived from a user's attempt history.
 */
export interface PartSummary {
  partId: string;
  partNumber: 1 | 2 | 3;
  accessTier: AccessTier;
  attemptCount: number; // count of examiner_complete attempts
  latestScore: IeltsScore | null;
  status: 'untouched' | 'in_progress' | 'examiner_complete' | 'coach_complete';
}

export interface TestLevelScore {
  pronunciation_band: number;
  fluency_band: number;
  lexical_band: number;
  grammar_band: number;
  scored_at: string;
}

export interface IeltsTestSummary {
  id: string;
  theme: string;
  ordering: number;
  accessTier: AccessTier;
  parts: [PartSummary, PartSummary, PartSummary]; // always 3 parts, indexed by part_number-1
  fullyCompleted: boolean; // all 3 parts have at least one examiner_complete attempt
  testScore: TestLevelScore | null; // latest cross-Part aggregate, if any
}

/**
 * Fetch the full IELTS test catalog with the current user's attempts/scores.
 * RLS filters `ielts_attempt` and `ielts_score` rows to the calling user.
 */
export async function fetchIeltsCatalog(): Promise<IeltsTestSummary[]> {
  const { data, error } = await supabase
    .from('ielts_test')
    .select(
      `
      id, theme, ordering, access_tier,
      ielts_test_part (
        id, part_number, max_response_sec, access_tier,
        ielts_attempt (
          id, attempt_number, status, finalized_at,
          ielts_score ( pronunciation_band, fluency_band, lexical_band, grammar_band )
        )
      ),
      ielts_test_score (
        pronunciation_band, fluency_band, lexical_band, grammar_band, scored_at
      )
    `
    )
    .order('ordering', { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<
    IeltsTestRow & { ielts_test_score: TestLevelScore[] | null }
  >;

  return rows.map((row) => {
    const summary = toSummary(row);
    const testScores = (row.ielts_test_score ?? []) as TestLevelScore[];
    // Use the most recent test-level score, if any (RLS limits to caller's rows).
    summary.testScore = testScores.length
      ? testScores
          .slice()
          .sort((a, b) => Date.parse(b.scored_at) - Date.parse(a.scored_at))[0]
      : null;
    return summary;
  });
}

function toSummary(row: IeltsTestRow): IeltsTestSummary {
  // sort parts by part_number ascending so the tuple positions are deterministic
  const partsByNumber = [...row.ielts_test_part].sort(
    (a, b) => a.part_number - b.part_number
  );
  const parts = [1, 2, 3].map((n) => {
    const part = partsByNumber.find((p) => p.part_number === n);
    if (!part) {
      // catalog should always have all three parts — but be defensive
      return {
        partId: '',
        partNumber: n as 1 | 2 | 3,
        accessTier: row.access_tier,
        attemptCount: 0,
        latestScore: null,
        status: 'untouched' as const,
      };
    }
    return summarizePart(part);
  }) as [PartSummary, PartSummary, PartSummary];

  const fullyCompleted = parts.every(
    (p) =>
      p.status === 'examiner_complete' || p.status === 'coach_complete'
  );

  return {
    id: row.id,
    theme: row.theme,
    ordering: row.ordering,
    accessTier: row.access_tier,
    parts,
    fullyCompleted,
    testScore: null,
  };
}

function summarizePart(part: IeltsPart): PartSummary {
  const completed = part.ielts_attempt.filter(
    (a) => a.status === 'examiner_complete' || a.status === 'coach_complete'
  );
  const latest = pickLatest(completed);
  const anyInProgress = part.ielts_attempt.some(
    (a) => a.status === 'in_progress'
  );

  let status: PartSummary['status'] = 'untouched';
  if (latest) {
    status = latest.status === 'coach_complete' ? 'coach_complete' : 'examiner_complete';
  } else if (anyInProgress) {
    status = 'in_progress';
  }

  return {
    partId: part.id,
    partNumber: part.part_number,
    accessTier: part.access_tier,
    attemptCount: completed.length,
    latestScore: latest?.ielts_score ?? null,
    status,
  };
}

function pickLatest(attempts: IeltsAttempt[]): IeltsAttempt | null {
  if (attempts.length === 0) return null;
  return [...attempts].sort((a, b) => {
    const ta = a.finalized_at ? Date.parse(a.finalized_at) : 0;
    const tb = b.finalized_at ? Date.parse(b.finalized_at) : 0;
    if (ta !== tb) return tb - ta;
    return b.attempt_number - a.attempt_number;
  })[0];
}

/**
 * Average the 4 criterion bands into a single overall band (display only).
 * Rounds to nearest 0.5 per the project's aggregation rule.
 */
export function overallBand(score: IeltsScore): number {
  const mean =
    (score.pronunciation_band +
      score.fluency_band +
      score.lexical_band +
      score.grammar_band) /
    4;
  return Math.round(mean * 2) / 2;
}

// ============================================================
// Detail view (single test with topics + questions + attempts)
// ============================================================

export interface IeltsQuestion {
  id: string;
  question_text: string;
  ordering: number;
  test_topic_id: string | null;
}

export interface IeltsTopic {
  id: string;
  topic_name: string;
  ordering: number;
}

export interface IeltsPartDetail {
  id: string;
  part_number: 1 | 2 | 3;
  max_response_sec: number;
  access_tier: AccessTier;
  topics: IeltsTopic[];
  /** All questions for this part, in display order, including standalone (test_topic_id null). */
  questions: IeltsQuestion[];
  attempts: IeltsAttempt[];
}

export interface IeltsTestDetail {
  id: string;
  theme: string;
  ordering: number;
  access_tier: AccessTier;
  parts: [IeltsPartDetail, IeltsPartDetail, IeltsPartDetail];
}

interface IeltsTestDetailRow {
  id: string;
  theme: string;
  ordering: number;
  access_tier: AccessTier;
  ielts_test_part: Array<{
    id: string;
    part_number: 1 | 2 | 3;
    max_response_sec: number;
    access_tier: AccessTier;
    ielts_test_topic: IeltsTopic[];
    ielts_test_question: IeltsQuestion[];
    ielts_attempt: IeltsAttempt[];
  }>;
}

export async function fetchIeltsTestDetail(
  testId: string
): Promise<IeltsTestDetail | null> {
  const { data, error } = await supabase
    .from('ielts_test')
    .select(
      `
      id, theme, ordering, access_tier,
      ielts_test_part (
        id, part_number, max_response_sec, access_tier,
        ielts_test_topic ( id, topic_name, ordering ),
        ielts_test_question ( id, question_text, ordering, test_topic_id ),
        ielts_attempt (
          id, attempt_number, status, finalized_at,
          ielts_score ( pronunciation_band, fluency_band, lexical_band, grammar_band )
        )
      )
    `
    )
    .eq('id', testId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as IeltsTestDetailRow;

  const partsByNumber = [...row.ielts_test_part].sort(
    (a, b) => a.part_number - b.part_number
  );
  const parts = [1, 2, 3].map((n) => {
    const part = partsByNumber.find((p) => p.part_number === n);
    if (!part) {
      // shouldn't happen given the catalog seed
      return {
        id: '',
        part_number: n as 1 | 2 | 3,
        max_response_sec: 0,
        access_tier: row.access_tier,
        topics: [],
        questions: [],
        attempts: [],
      } as IeltsPartDetail;
    }
    return {
      id: part.id,
      part_number: part.part_number,
      max_response_sec: part.max_response_sec,
      access_tier: part.access_tier,
      topics: [...part.ielts_test_topic].sort((a, b) => a.ordering - b.ordering),
      questions: [...part.ielts_test_question].sort(
        (a, b) => a.ordering - b.ordering
      ),
      attempts: part.ielts_attempt,
    } as IeltsPartDetail;
  }) as [IeltsPartDetail, IeltsPartDetail, IeltsPartDetail];

  return {
    id: row.id,
    theme: row.theme,
    ordering: row.ordering,
    access_tier: row.access_tier,
    parts,
  };
}

// ============================================================
// Examiner runtime — attempt lifecycle + per-question scoring
// ============================================================

export interface ResponseRow {
  id: string;
  question_id: string;
  pronunciation_band: number | null;
  fluency_band: number | null;
  lexical_band: number | null;
  grammar_band: number | null;
  transcript: string | null;
  scored_at: string | null;
}

/**
 * Return the user's in-progress attempt for this part, or create a new one.
 * If a prior attempt is `abandoned`/`coach_complete`/`examiner_complete`, we
 * start a fresh one with attempt_number = max+1.
 */
export async function startOrResumeExaminerAttempt(
  testPartId: string
): Promise<{ id: string; attempt_number: number; created: boolean }> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error('Not authenticated.');

  // Look for an existing in_progress attempt
  const { data: existing, error: existingErr } = await supabase
    .from('ielts_attempt')
    .select('id, attempt_number')
    .eq('user_id', userId)
    .eq('test_part_id', testPartId)
    .eq('status', 'in_progress')
    .order('attempt_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing) {
    return { id: existing.id, attempt_number: existing.attempt_number, created: false };
  }

  // Find max attempt_number so far → next is +1
  const { data: max, error: maxErr } = await supabase
    .from('ielts_attempt')
    .select('attempt_number')
    .eq('user_id', userId)
    .eq('test_part_id', testPartId)
    .order('attempt_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) throw maxErr;
  const nextAttempt = (max?.attempt_number ?? 0) + 1;

  const { data: created, error: insertErr } = await supabase
    .from('ielts_attempt')
    .insert({
      user_id: userId,
      test_part_id: testPartId,
      attempt_number: nextAttempt,
      status: 'in_progress',
    })
    .select('id, attempt_number')
    .single();
  if (insertErr || !created) throw insertErr ?? new Error('Failed to create attempt.');

  return { id: created.id, attempt_number: created.attempt_number, created: true };
}

export async function fetchAttemptResponses(attemptId: string): Promise<ResponseRow[]> {
  const { data, error } = await supabase
    .from('ielts_response')
    .select(
      'id, question_id, pronunciation_band, fluency_band, lexical_band, grammar_band, transcript, scored_at'
    )
    .eq('attempt_id', attemptId);
  if (error) throw error;
  return (data ?? []) as ResponseRow[];
}

export interface ProcessResponseResult {
  response_id: string;
  pronunciation_band: number;
  fluency_band: number;
  lexical_band: number;
  grammar_band: number;
  transcript: string;
  duration_ms: number;
}

/**
 * Upload a WAV recording for one question. Returns the parsed bands + transcript.
 * Calls the `ielts-process-response` edge function.
 */
export async function processIeltsResponse(
  attemptId: string,
  questionId: string,
  audio: Blob,
): Promise<ProcessResponseResult> {
  const form = new FormData();
  form.append('attempt_id', attemptId);
  form.append('question_id', questionId);
  form.append('audio', audio, 'response.wav');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated.');

  const { data, error } = await supabase.functions.invoke<ProcessResponseResult>(
    'ielts-process-response',
    { body: form },
  );
  if (error) throw error;
  if (!data) throw new Error('Empty response from process-response.');
  return data;
}

// ============================================================
// Finalize + results data
// ============================================================

export interface FinalizePartResult {
  attempt_status: AttemptStatus;
  score: {
    id: string;
    pronunciation_band: number;
    fluency_band: number;
    lexical_band: number;
    grammar_band: number;
    scored_at: string;
  };
  response_count: number;
}

export async function finalizeIeltsPart(attemptId: string): Promise<FinalizePartResult> {
  const { data, error } = await supabase.functions.invoke<FinalizePartResult>(
    'ielts-finalize-part',
    { body: { attempt_id: attemptId } },
  );
  if (error) throw error;
  if (!data) throw new Error('Empty response from finalize-part.');
  return data;
}

export interface FinalizeTestResult {
  pending: boolean;
  message?: string;
  test_score?: {
    id: string;
    pronunciation_band: number;
    fluency_band: number;
    lexical_band: number;
    grammar_band: number;
    scored_at: string;
  };
  part_attempts?: { part1: string; part2: string; part3: string };
}

/**
 * Opportunistically compute the test-level aggregate. Returns `{ pending: true }`
 * if any Part is unfinished.
 */
export async function finalizeIeltsTest(testId: string): Promise<FinalizeTestResult> {
  const { data, error } = await supabase.functions.invoke<FinalizeTestResult>(
    'ielts-finalize-test',
    { body: { test_id: testId } },
  );
  if (error) throw error;
  if (!data) throw new Error('Empty response from finalize-test.');
  return data;
}

/** Fetch the most recent ielts_test_score for a (user, test). */
export async function fetchLatestTestScore(testId: string): Promise<FinalizeTestResult['test_score'] | null> {
  const { data, error } = await supabase
    .from('ielts_test_score')
    .select(
      'id, pronunciation_band, fluency_band, lexical_band, grammar_band, scored_at',
    )
    .eq('test_id', testId)
    .order('scored_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as FinalizeTestResult['test_score']) ?? null;
}

/** Rich per-response record including the original SpeechSuper jsonb. */
export interface ResponseDetail {
  id: string;
  question_id: string;
  pronunciation_band: number;
  fluency_band: number;
  lexical_band: number;
  grammar_band: number;
  transcript: string | null;
  duration_ms: number | null;
  scored_at: string | null;
  speechsuper_response: Record<string, unknown> | null;
  question: {
    id: string;
    question_text: string;
    ordering: number;
    test_topic_id: string | null;
  } | null;
}

export interface AttemptResultBundle {
  attempt: {
    id: string;
    test_part_id: string;
    attempt_number: number;
    status: AttemptStatus;
    started_at: string;
    finalized_at: string | null;
    test_part: {
      id: string;
      part_number: 1 | 2 | 3;
      max_response_sec: number;
      test: {
        id: string;
        theme: string;
        ordering: number;
      };
    };
  };
  score: {
    pronunciation_band: number;
    fluency_band: number;
    lexical_band: number;
    grammar_band: number;
    full_transcript: string | null;
    scored_at: string;
  } | null;
  responses: ResponseDetail[];
}

export async function fetchAttemptResultBundle(
  attemptId: string,
): Promise<AttemptResultBundle | null> {
  const { data: attemptData, error: attemptErr } = await supabase
    .from('ielts_attempt')
    .select(
      `
      id, test_part_id, attempt_number, status, started_at, finalized_at,
      test_part:test_part_id (
        id, part_number, max_response_sec,
        test:test_id ( id, theme, ordering )
      )
    `,
    )
    .eq('id', attemptId)
    .maybeSingle();
  if (attemptErr) throw attemptErr;
  if (!attemptData) return null;

  const { data: scoreRow, error: scoreErr } = await supabase
    .from('ielts_score')
    .select(
      'pronunciation_band, fluency_band, lexical_band, grammar_band, full_transcript, scored_at',
    )
    .eq('attempt_id', attemptId)
    .maybeSingle();
  if (scoreErr) throw scoreErr;

  const { data: respRows, error: respErr } = await supabase
    .from('ielts_response')
    .select(
      `
      id, question_id, pronunciation_band, fluency_band, lexical_band, grammar_band,
      transcript, duration_ms, scored_at, speechsuper_response,
      question:question_id ( id, question_text, ordering, test_topic_id )
    `,
    )
    .eq('attempt_id', attemptId);
  if (respErr) throw respErr;

  const responses = ((respRows ?? []) as unknown as ResponseDetail[]).sort(
    (a, b) => (a.question?.ordering ?? 0) - (b.question?.ordering ?? 0),
  );

  return {
    attempt: attemptData as unknown as AttemptResultBundle['attempt'],
    score: scoreRow as AttemptResultBundle['score'],
    responses,
  };
}

// ============================================================
// Coach session
// ============================================================

export type CoachMode = 'part_review' | 'mock_review' | 'retry';

export interface CoachStartResult {
  mode: CoachMode;
  coach_session_id: string;
  signed_url: string;
  dynamic_variables: Record<string, string>;
  part_number?: 1 | 2 | 3;
  part_label?: string;
  test_theme: string;
}

export interface CoachTargetMoment {
  quote: string;
  category?: string;
  rationale?: string;
  question_text?: string;
}

export interface CoachStartParams {
  mode?: CoachMode;
  attemptId?: string;
  testId?: string;
  targetMoment?: CoachTargetMoment;
}

/**
 * Start an IELTS Coach session — picks the right mode based on inputs:
 *   - part_review : pass attemptId
 *   - mock_review : pass testId
 *   - retry       : pass attemptId + targetMoment
 */
export async function startIeltsCoachSession(
  params: CoachStartParams | string, // string-only signature kept for backward compat
): Promise<CoachStartResult> {
  const body: Record<string, unknown> = {};
  if (typeof params === 'string') {
    body.attempt_id = params;
  } else {
    if (params.mode) body.mode = params.mode;
    if (params.attemptId) body.attempt_id = params.attemptId;
    if (params.testId) body.test_id = params.testId;
    if (params.targetMoment) body.target_moment = params.targetMoment;
  }
  const { data, error } = await supabase.functions.invoke<CoachStartResult>(
    'ielts-coach-start',
    { body },
  );
  if (error) throw error;
  if (!data) throw new Error('Empty response from coach-start.');
  return data;
}

/**
 * Update the coach session row with the ElevenLabs conversation_id once known.
 * Done client-side via RLS-gated update.
 */
export async function updateCoachSessionConversationId(
  coachSessionId: string,
  elevenlabsConversationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('ielts_coach_session')
    .update({ elevenlabs_conversation_id: elevenlabsConversationId })
    .eq('id', coachSessionId);
  if (error) throw error;
}

/**
 * Mark a Coach session ended. Sets ended_at and optionally stores the
 * Coach-emitted mistake_profile JSON. When `attemptId` is provided, also
 * bumps that attempt to coach_complete (skip this for mock_review since we
 * don't want to mutate per-Part attempt status from a test-level debrief).
 */
export async function endCoachSession(
  coachSessionId: string,
  attemptId: string | null,
  options: { mistakeProfile?: Record<string, unknown> } = {},
): Promise<void> {
  const updates: Record<string, unknown> = { ended_at: new Date().toISOString() };
  if (options.mistakeProfile) updates.mistake_profile = options.mistakeProfile;

  const { error: csErr } = await supabase
    .from('ielts_coach_session')
    .update(updates)
    .eq('id', coachSessionId);
  if (csErr) throw csErr;

  if (attemptId) {
    const { error: aErr } = await supabase
      .from('ielts_attempt')
      .update({ status: 'coach_complete' })
      .eq('id', attemptId);
    if (aErr) throw aErr;
  }
}

/** Convenience: given a part's attempts, return the latest finalized one (examiner or coach complete). */
export function latestFinalizedAttempt(
  attempts: IeltsAttempt[]
): IeltsAttempt | null {
  const finalized = attempts.filter(
    (a) => a.status === 'examiner_complete' || a.status === 'coach_complete'
  );
  if (finalized.length === 0) return null;
  return [...finalized].sort((a, b) => {
    const ta = a.finalized_at ? Date.parse(a.finalized_at) : 0;
    const tb = b.finalized_at ? Date.parse(b.finalized_at) : 0;
    if (ta !== tb) return tb - ta;
    return b.attempt_number - a.attempt_number;
  })[0];
}

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

const CEFR_ORDER: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/**
 * Average several SpeechSuper-reported CEFR levels for the same criterion
 * (one per question) by mapping each to an ordinal (A1=1 … C2=6), taking the
 * mean, and rounding to the nearest level. Returns null if no inputs.
 */
export function averageCefr(levels: Array<CefrLevel | string | null | undefined>): CefrLevel | null {
  const numeric: number[] = [];
  for (const l of levels) {
    if (!l) continue;
    const idx = CEFR_ORDER.indexOf(l.toUpperCase() as CefrLevel);
    if (idx >= 0) numeric.push(idx + 1);
  }
  if (numeric.length === 0) return null;
  const mean = numeric.reduce((a, b) => a + b, 0) / numeric.length;
  const rounded = Math.max(1, Math.min(CEFR_ORDER.length, Math.round(mean)));
  return CEFR_ORDER[rounded - 1];
}

/** URL-safe slug for a theme (e.g., "Society & Culture" → "society-culture"). */
export function themeSlug(theme: string): string {
  return theme
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface ThemeSummary {
  theme: string;
  slug: string;
  tests: IeltsTestSummary[];
  /** Tests where all 3 Parts have at least one examiner_complete attempt. */
  fullyCompletedTests: number;
  /** Tests with at least one Part attempted. */
  startedTests: number;
}

/**
 * Group tests by theme. Themes appear in the order they first occur in the input.
 */
export function groupByTheme(tests: IeltsTestSummary[]): ThemeSummary[] {
  const buckets = new Map<string, IeltsTestSummary[]>();
  for (const t of tests) {
    const existing = buckets.get(t.theme);
    if (existing) existing.push(t);
    else buckets.set(t.theme, [t]);
  }
  return Array.from(buckets, ([theme, items]) => ({
    theme,
    slug: themeSlug(theme),
    tests: items,
    fullyCompletedTests: items.filter((t) => t.fullyCompleted).length,
    startedTests: items.filter((t) =>
      t.parts.some((p) => p.status !== 'untouched')
    ).length,
  }));
}
