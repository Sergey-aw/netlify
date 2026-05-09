# Pronunciation Practice System - Mobile API Documentation

## Overview

The JustTalk pronunciation system helps students improve their pronunciation through targeted practice of specific IPA (International Phonetic Alphabet) phonemes. The system uses **SpeechSuper API** for audio analysis and provides structured practice sessions with real-time feedback.

**Key Features:**
- 🎯 Baseline workout to identify pronunciation weaknesses
- 📊 Automated phoneme error detection and tracking
- 🎤 Word and sentence practice with real-time scoring
- 📈 Progress tracking and historical performance analytics
- 🔄 Smart practice session generation based on error patterns

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Authentication](#authentication)
4. [API Endpoints](#api-endpoints)
5. [Practice Flow](#practice-flow)
6. [Audio Requirements](#audio-requirements)
7. [Data Models](#data-models)
8. [Error Handling](#error-handling)
9. [Mobile Integration Guide](#mobile-integration-guide)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mobile App                                │
├─────────────────────────────────────────────────────────────────┤
│  Audio Recording  │  Practice UI  │  Progress Display           │
├─────────────────────────────────────────────────────────────────┤
│                    Supabase Client SDK                           │
├─────────────────────────────────────────────────────────────────┤
│                    Edge Functions (Deno)                         │
├─────────────────────────────────────────────────────────────────┤
│  pronunciation-start-baseline-workout                            │
│  pronunciation-submit-sentence-practice                          │
│  pronunciation-submit-word-practice                              │
│  pronunciation-generate-practice                                 │
├─────────────────────────────────────────────────────────────────┤
│                    SpeechSuper API                               │
├─────────────────────────────────────────────────────────────────┤
│  word.eval.promax  │  sent.eval.promax                          │
├─────────────────────────────────────────────────────────────────┤
│                    Supabase Database                             │
├─────────────────────────────────────────────────────────────────┤
│  pronunciation_sessions  │  pronunciation_practice_items         │
│  pronunciation_practice_results  │  pronunciation_phoneme_attempts│
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Baseline Assessment** → Identify weak phonemes
2. **Practice Generation** → Create targeted exercises
3. **Audio Recording** → Capture student pronunciation
4. **SpeechSuper Analysis** → Get phoneme-level scores
5. **Result Storage** → Persist scores and feedback
6. **Progress Tracking** → Update historical data

---

## Database Schema

### Core Tables

#### `pronunciation_practice_sessions`

Main practice session container.

```sql
CREATE TABLE pronunciation_practice_sessions (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT CHECK (status IN ('active', 'completed', 'abandoned')),
  target_phonemes TEXT[], -- Array of IPA symbols to practice
  is_baseline BOOLEAN DEFAULT false, -- True for baseline workouts
  total_items INTEGER,
  completed_items INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `pronunciation_practice_items`

Individual practice exercises (words or sentences).

```sql
CREATE TABLE pronunciation_practice_items (
  id UUID PRIMARY KEY,
  practice_session_id UUID REFERENCES pronunciation_practice_sessions(id),
  student_id UUID NOT NULL REFERENCES profiles(id),
  practice_type TEXT CHECK (practice_type IN ('word', 'sentence')),
  target_ipa_symbol TEXT NOT NULL, -- IPA phoneme being practiced
  word_text TEXT NOT NULL,
  word_ipa TEXT NOT NULL, -- Full IPA transcription
  reference_sentence TEXT, -- For sentence practice
  difficulty_tier INTEGER,
  phoneme_position INTEGER, -- Position of target phoneme in word
  item_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  selection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `pronunciation_practice_results`

Stores scored attempts for each practice item.

```sql
CREATE TABLE pronunciation_practice_results (
  id UUID PRIMARY KEY,
  practice_item_id UUID REFERENCES pronunciation_practice_items(id),
  practice_session_id UUID REFERENCES pronunciation_practice_sessions(id),
  student_id UUID NOT NULL REFERENCES profiles(id),
  pronunciation_session_id UUID REFERENCES pronunciation_sessions(id),
  attempt_number INTEGER,
  pronunciation_score INTEGER, -- 0-100
  overall_score INTEGER, -- 0-100 (for sentences)
  fluency_score INTEGER, -- 0-100 (for sentences)
  integrity_score INTEGER, -- 0-100 (for sentences)
  word_results JSONB, -- Detailed word-level results
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `pronunciation_phoneme_attempts`

Phoneme-level detailed results for error tracking.

```sql
CREATE TABLE pronunciation_phoneme_attempts (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id),
  pronunciation_session_id UUID REFERENCES pronunciation_sessions(id),
  practice_result_id UUID REFERENCES pronunciation_practice_results(id),
  practice_item_id UUID REFERENCES pronunciation_practice_items(id),
  target_ipa_symbol TEXT NOT NULL,
  phoneme_score INTEGER CHECK (phoneme_score >= 0 AND phoneme_score <= 100),
  read_type INTEGER, -- 0=correct, 1=mispronounced, 2=omitted, 3=added
  sound_like TEXT, -- What it sounded like (if mispronounced)
  inserted_before TEXT[], -- Phonemes inserted before
  inserted_after TEXT[], -- Phonemes inserted after
  word_context TEXT,
  is_target BOOLEAN DEFAULT false, -- True if this is the target phoneme
  is_baseline BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `pronunciation_sessions`

Raw session metadata (links to SpeechSuper API calls).

```sql
CREATE TABLE pronunciation_sessions (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id),
  lesson_id UUID REFERENCES lessons(id),
  source_type TEXT CHECK (source_type IN ('calibration', 'word_drill', 'sentence_drill', 'targeted_practice', 'practice')),
  dict_type TEXT DEFAULT 'IPA88',
  dict_dialect TEXT DEFAULT 'en_us',
  provider_api TEXT CHECK (provider_api IN ('word.eval.promax', 'sent.eval.promax', 'para.eval')),
  is_final BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `pronunciation_raw_payloads`

Forensic storage of all SpeechSuper API requests/responses.

```sql
CREATE TABLE pronunciation_raw_payloads (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES pronunciation_sessions(id),
  request_payload JSONB NOT NULL,
  response_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Key Views

#### `pronunciation_practice_item_progress`

Aggregated progress for each practice item.

```sql
-- Returns for each practice item:
-- - attempt_count: Total attempts
-- - best_score: Highest pronunciation score
-- - latest_score: Most recent score
-- - avg_score: Average of all attempts
-- - is_mastered: True if best_score >= 85
```

---

## Authentication

All API calls require authentication via Supabase JWT token.

### Headers Required

```typescript
{
  'Authorization': 'Bearer <JWT_TOKEN>',
  'Content-Type': 'application/json' // or multipart/form-data for audio uploads
}
```

### Get Auth Token

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sign in
const { data: { user, session }, error } = await supabase.auth.signInWithPassword({
  email: 'student@example.com',
  password: 'password'
});

const authToken = session.access_token;
```

---

## API Endpoints

### 1. Start Baseline Workout

**Purpose**: Creates a 10-sentence baseline assessment to identify pronunciation weaknesses.

**Endpoint**: `POST /functions/v1/pronunciation-start-baseline-workout`

**Request Body**:
```typescript
{
  studentId: string; // UUID of the student
}
```

**Response**:
```typescript
{
  sessionId: string; // UUID of created practice session
  items: Array<{
    id: string;
    item_order: number;
    word_text: string;
    word_ipa: string;
    reference_sentence: string;
    target_ipa_symbol: string;
    practice_type: 'sentence';
  }>;
  message: string;
}
```

**Example**:
```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/pronunciation-start-baseline-workout`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ studentId: 'uuid-here' })
  }
);

const data = await response.json();
console.log('Session ID:', data.sessionId);
console.log('Practice items:', data.items);
```

---

### 2. Submit Word Practice

**Purpose**: Submit recorded audio for word pronunciation evaluation.

**Endpoint**: `POST /functions/v1/pronunciation-submit-word-practice`

**Request**: `multipart/form-data`

**Form Fields**:
- `practice_item_id`: UUID of the practice item
- `audio`: WAV file (PCM16, 16kHz, mono)

**Response**:
```typescript
{
  resultId: string;
  attemptNumber: number;
  pronunciationScore: number; // 0-100
  isCorrect: boolean; // score >= 60
  phonemes: Array<{
    phoneme: string; // IPA symbol
    score: number; // 0-100
    readType: number; // 0=correct, 1=mispronounced, 2=omitted, 3=added
    soundLike?: string;
    insertedBefore?: string[];
    insertedAfter?: string[];
  }>;
  sessionId: string;
}
```

**Example**:
```typescript
// Record audio using WAV recorder
const audioBlob = await recordWavAudio();

// Create form data
const formData = new FormData();
formData.append('practice_item_id', practiceItemId);
formData.append('audio', audioBlob, 'recording.wav');

// Submit
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/pronunciation-submit-word-practice`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: formData
  }
);

const result = await response.json();
console.log('Score:', result.pronunciationScore);
console.log('Phoneme results:', result.phonemes);
```

---

### 3. Submit Sentence Practice

**Purpose**: Submit recorded audio for sentence pronunciation evaluation.

**Endpoint**: `POST /functions/v1/pronunciation-submit-sentence-practice`

**Request**: `multipart/form-data`

**Form Fields**:
- `practice_item_id`: UUID of the practice item
- `audio`: WAV file (PCM16, 16kHz, mono)

**Response**:
```typescript
{
  resultId: string;
  attemptNumber: number;
  pronunciationScore: number; // 0-100
  overallScore: number; // 0-100
  fluencyScore: number; // 0-100
  integrityScore: number; // 0-100
  isCorrect: boolean; // score >= 60
  wordResults: Array<{
    text: string;
    score: number;
    phonemes: Array<{
      phoneme: string;
      score: number;
      readType: number;
      soundLike?: string;
      insertedBefore?: string[];
      insertedAfter?: string[];
    }>;
  }>;
  sessionId: string;
  sessionCompleted: boolean; // True if all items completed
}
```

**Example**:
```typescript
const formData = new FormData();
formData.append('practice_item_id', practiceItemId);
formData.append('audio', audioBlob, 'sentence.wav');

const response = await fetch(
  `${SUPABASE_URL}/functions/v1/pronunciation-submit-sentence-practice`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: formData
  }
);

const result = await response.json();
console.log('Overall Score:', result.overallScore);
console.log('Fluency:', result.fluencyScore);
console.log('Session completed:', result.sessionCompleted);
```

---

### 4. Generate Practice Session

**Purpose**: Create a new targeted practice session based on identified weaknesses.

**Endpoint**: `POST /functions/v1/pronunciation-generate-practice`

**Request Body**:
```typescript
{
  sessionId: string; // UUID of practice session with target phonemes
}
```

**Response**:
```typescript
{
  sessionId: string;
  itemsCreated: number;
  items: Array<{
    id: string;
    practice_type: 'word' | 'sentence';
    word_text: string;
    word_ipa: string;
    reference_sentence?: string;
    target_ipa_symbol: string;
    item_order: number;
  }>;
}
```

**Note**: This is typically called automatically by the system, but can be used to generate additional practice items.

---

## Practice Flow

### Complete Practice Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: Check Baseline Status                                │
│ Query: SELECT * FROM pronunciation_practice_sessions          │
│        WHERE student_id = ? AND is_baseline = true           │
│        ORDER BY created_at DESC LIMIT 1                      │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ├─ No baseline? ────────────────────────┐
                 │                                        │
                 ├─ Has baseline? ──────────────────────┐│
                 │                                       ││
┌────────────────▼──────────────────────┐  ┌────────────▼▼────────────────┐
│ STEP 2A: Start Baseline Workout       │  │ STEP 2B: Get Next Practice   │
│ POST /pronunciation-start-baseline-   │  │ Query recommended phonemes     │
│      workout                           │  │ based on error history         │
│                                        │  │                                │
│ Returns: sessionId + 10 sentence items│  │ Create practice session        │
└────────────────┬──────────────────────┘  └────────────┬──────────────────┘
                 │                                       │
                 │                                       │
┌────────────────▼───────────────────────────────────────▼─────────────────┐
│ STEP 3: Present Practice Items                                           │
│ Query: SELECT * FROM pronunciation_practice_items                        │
│        WHERE practice_session_id = ? AND is_active = true                │
│        ORDER BY item_order                                               │
│                                                                           │
│ For each item:                                                            │
│ - Display: word_text, reference_sentence (if sentence type)              │
│ - Show IPA: word_ipa                                                      │
│ - Highlight target phoneme: target_ipa_symbol                            │
└────────────────┬──────────────────────────────────────────────────────────┘
                 │
┌────────────────▼──────────────────────────────────────────────────────────┐
│ STEP 4: Record Audio                                                      │
│ Requirements:                                                              │
│ - Format: WAV (RIFF/WAVE)                                                 │
│ - Encoding: PCM16 (16-bit)                                                │
│ - Sample Rate: 16kHz                                                      │
│ - Channels: Mono (1)                                                      │
└────────────────┬──────────────────────────────────────────────────────────┘
                 │
┌────────────────▼──────────────────────────────────────────────────────────┐
│ STEP 5: Submit Audio for Evaluation                                       │
│ POST /pronunciation-submit-word-practice (for words)                      │
│ POST /pronunciation-submit-sentence-practice (for sentences)              │
│                                                                            │
│ multipart/form-data:                                                       │
│ - practice_item_id: UUID                                                   │
│ - audio: WAV file                                                          │
└────────────────┬──────────────────────────────────────────────────────────┘
                 │
┌────────────────▼──────────────────────────────────────────────────────────┐
│ STEP 6: Receive & Display Results                                         │
│ Response includes:                                                         │
│ - Overall pronunciation score (0-100)                                      │
│ - Phoneme-level breakdown                                                  │
│ - Visual feedback (correct/incorrect for each sound)                       │
│ - Retry option if score < 85                                               │
└────────────────┬──────────────────────────────────────────────────────────┘
                 │
                 ├─ More items? ────────┐
                 │                      │
                 ├─ All complete? ──────┤
                 │                      │
┌────────────────▼──────────────────────▼───────────────────────────────────┐
│ STEP 7: Session Completion                                                │
│ Auto-update:                                                               │
│ UPDATE pronunciation_practice_sessions                                     │
│ SET status = 'completed', completed_at = now()                            │
│ WHERE id = ?                                                               │
│                                                                            │
│ Show summary: scores, mastered phonemes, next recommendations             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Audio Requirements

### Strict Requirements (SpeechSuper Compatibility)

All audio submissions **MUST** meet these exact specifications:

| Property | Value | Why |
|----------|-------|-----|
| **Format** | WAV (RIFF/WAVE) | SpeechSuper rejects other formats |
| **Encoding** | PCM16 (16-bit signed integer) | Required by SpeechSuper API |
| **Sample Rate** | 16,000 Hz | Locked parameter per contract |
| **Channels** | Mono (1 channel) | Stereo is rejected |
| **Byte Order** | Little-endian | Standard WAV format |

### WAV File Structure

```
Offset  Size  Description
------  ----  -----------
0       4     "RIFF" (chunk ID)
4       4     File size - 8 (chunk size)
8       4     "WAVE" (format)
12      4     "fmt " (subchunk1 ID)
16      4     16 (subchunk1 size for PCM)
20      2     1 (audio format: PCM)
22      2     1 (number of channels: mono)
24      4     16000 (sample rate)
28      4     32000 (byte rate: sample_rate * channels * bytes_per_sample)
32      2     2 (block align: channels * bytes_per_sample)
34      2     16 (bits per sample)
36      4     "data" (subchunk2 ID)
40      4     Data size in bytes
44      ...   Audio samples (16-bit signed integers)
```

### Recording in Mobile Apps

#### React Native Example

```typescript
import AudioRecord from 'react-native-audio-record';

// Configure audio recorder
const options = {
  sampleRate: 16000,
  channels: 1,
  bitsPerSample: 16,
  wavFile: 'recording.wav'
};

AudioRecord.init(options);

// Start recording
AudioRecord.start();

// Stop and get WAV file
const audioFile = await AudioRecord.stop();

// Convert to blob for upload
const audioBlob = await fetch(audioFile).then(r => r.blob());
```

#### iOS (Swift) Example

```swift
import AVFoundation

// Configure audio session
let session = AVAudioSession.sharedInstance()
try session.setCategory(.record, mode: .measurement)
try session.setActive(true)

// Set up recorder settings
let settings: [String: Any] = [
    AVFormatIDKey: kAudioFormatLinearPCM,
    AVSampleRateKey: 16000.0,
    AVNumberOfChannelsKey: 1,
    AVLinearPCMBitDepthKey: 16,
    AVLinearPCMIsFloatKey: false,
    AVLinearPCMIsBigEndianKey: false
]

// Create recorder
let recorder = try AVAudioRecorder(url: fileURL, settings: settings)
recorder.record()

// Stop and get file
recorder.stop()
let wavData = try Data(contentsOf: fileURL)
```

#### Android (Kotlin) Example

```kotlin
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder

// Configuration
val sampleRate = 16000
val channelConfig = AudioFormat.CHANNEL_IN_MONO
val audioFormat = AudioFormat.ENCODING_PCM_16BIT

// Create recorder
val minBufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
val audioRecord = AudioRecord(
    MediaRecorder.AudioSource.MIC,
    sampleRate,
    channelConfig,
    audioFormat,
    minBufferSize
)

// Start recording
audioRecord.startRecording()

// Read data
val buffer = ShortArray(minBufferSize)
audioRecord.read(buffer, 0, minBufferSize)

// Stop and convert to WAV
audioRecord.stop()
val wavFile = convertToWav(buffer, sampleRate)
```

### Audio Validation

Before submitting, validate the audio file:

```typescript
async function validateWavFile(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  
  // Check RIFF header
  const riff = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  
  // Check WAVE format
  const wave = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11)
  );
  
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('Invalid WAV file format');
  }
  
  // Check sample rate (offset 24, 4 bytes, little-endian)
  const sampleRate = view.getUint32(24, true);
  if (sampleRate !== 16000) {
    throw new Error(`Invalid sample rate: ${sampleRate}. Must be 16000 Hz`);
  }
  
  // Check channels (offset 22, 2 bytes, little-endian)
  const channels = view.getUint16(22, true);
  if (channels !== 1) {
    throw new Error(`Invalid channel count: ${channels}. Must be mono (1)`);
  }
  
  // Check bits per sample (offset 34, 2 bytes, little-endian)
  const bitsPerSample = view.getUint16(34, true);
  if (bitsPerSample !== 16) {
    throw new Error(`Invalid bits per sample: ${bitsPerSample}. Must be 16`);
  }
  
  return true;
}
```

---

## Data Models

### TypeScript Interfaces

```typescript
// Practice Session
interface PracticeSession {
  id: string;
  student_id: string;
  status: 'active' | 'completed' | 'abandoned';
  target_phonemes: string[]; // IPA symbols like ['θ', 'ð', 'ɹ']
  is_baseline: boolean;
  total_items: number;
  completed_items: number;
  started_at: string; // ISO timestamp
  completed_at?: string;
  created_at: string;
}

// Practice Item
interface PracticeItem {
  id: string;
  practice_session_id: string;
  student_id: string;
  practice_type: 'word' | 'sentence';
  target_ipa_symbol: string;
  word_text: string;
  word_ipa: string;
  reference_sentence?: string;
  difficulty_tier: number;
  phoneme_position: number | null;
  item_order: number;
  is_active: boolean;
  selection_reason: 'high_error_rate' | 'regressing_trend' | 'baseline_regression' | 'calibration_priority' | 'manual_selection';
  created_at: string;
}

// Practice Result
interface PracticeResult {
  id: string;
  practice_item_id: string;
  practice_session_id: string;
  student_id: string;
  pronunciation_session_id: string;
  attempt_number: number;
  pronunciation_score: number; // 0-100
  overall_score?: number; // 0-100 (sentences only)
  fluency_score?: number; // 0-100 (sentences only)
  integrity_score?: number; // 0-100 (sentences only)
  word_results?: WordResult[];
  metadata?: any;
  created_at: string;
}

// Word Result (from sentence evaluation)
interface WordResult {
  text: string;
  score: number;
  phonemes: PhonemeResult[];
}

// Phoneme Result
interface PhonemeResult {
  phoneme: string; // IPA symbol
  score: number; // 0-100
  readType: number; // 0=correct, 1=mispronounced, 2=omitted, 3=added
  soundLike?: string; // What it sounded like (if mispronounced)
  insertedBefore?: string[]; // Phonemes inserted before this one
  insertedAfter?: string[]; // Phonemes inserted after this one
}

// Phoneme Attempt (detailed error tracking)
interface PhonemeAttempt {
  id: string;
  student_id: string;
  pronunciation_session_id: string;
  practice_result_id: string;
  practice_item_id: string;
  target_ipa_symbol: string;
  phoneme_score: number; // 0-100
  read_type: number; // 0-3
  sound_like?: string;
  inserted_before?: string[];
  inserted_after?: string[];
  word_context: string;
  is_target: boolean; // True if this is the phoneme being practiced
  is_baseline: boolean;
  created_at: string;
}

// Practice Item Progress (view)
interface PracticeItemProgress {
  practice_item_id: string;
  attempt_count: number;
  best_score: number;
  latest_score: number;
  avg_score: number;
  is_mastered: boolean; // best_score >= 85
}
```

---

## Error Handling

### Common Errors

#### 1. Invalid Audio Format

```typescript
{
  error: 'Practice audio must be WAV (RIFF/WAVE).',
  status: 400
}
```

**Solution**: Ensure audio is WAV format with correct parameters.

#### 2. Unauthorized Access

```typescript
{
  error: 'Unauthorized access to practice item',
  status: 403
}
```

**Solution**: Verify the authenticated user owns the practice item.

#### 3. Practice Item Not Found

```typescript
{
  error: 'Practice item not found',
  status: 404
}
```

**Solution**: Check that the practice_item_id exists and is active.

#### 4. SpeechSuper API Error

```typescript
{
  error: 'SpeechSuper evaluation failed',
  details: 'Audio quality too low',
  status: 500
}
```

**Solution**: 
- Check audio quality (no background noise)
- Ensure clear pronunciation
- Verify audio meets technical requirements

#### 5. Session Already Completed

```typescript
{
  error: 'Cannot submit to completed session',
  status: 400
}
```

**Solution**: Start a new practice session.

### Error Response Format

All errors follow this structure:

```typescript
interface ErrorResponse {
  error: string; // Human-readable error message
  details?: string; // Additional context
  code?: string; // Error code for programmatic handling
  status: number; // HTTP status code
}
```

### Retry Logic

Implement exponential backoff for transient errors:

```typescript
async function submitWithRetry(
  submitFn: () => Promise<Response>,
  maxRetries: number = 3
): Promise<any> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await submitFn();
      
      if (response.ok) {
        return await response.json();
      }
      
      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(await response.text());
      }
      
      // Retry server errors (5xx)
      lastError = new Error(`Server error: ${response.status}`);
      
    } catch (error) {
      lastError = error as Error;
    }
    
    // Wait before retry (exponential backoff)
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
  
  throw lastError;
}
```

---

## Mobile Integration Guide

### Complete Integration Example

#### 1. Initialize Supabase Client

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://your-project.supabase.co';
const supabaseAnonKey = 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

#### 2. Check Baseline Status

```typescript
async function checkBaselineStatus(studentId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('pronunciation_practice_sessions')
    .select('id, completed_at, created_at')
    .eq('student_id', studentId)
    .eq('is_baseline', true)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (error) {
    console.error('Error checking baseline:', error);
    return false;
  }
  
  // Check if baseline exists and was completed in last 30 days
  if (data && data.length > 0) {
    const baseline = data[0];
    if (baseline.completed_at) {
      const completedDate = new Date(baseline.completed_at);
      const daysSince = (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 30;
    }
  }
  
  return false;
}
```

#### 3. Start Baseline Workout

```typescript
async function startBaselineWorkout(studentId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(
    `${supabaseUrl}/functions/v1/pronunciation-start-baseline-workout`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ studentId })
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to start baseline workout');
  }
  
  return await response.json();
}
```

#### 4. Get Practice Items

```typescript
async function getPracticeItems(sessionId: string) {
  const { data, error } = await supabase
    .from('pronunciation_practice_items')
    .select('*')
    .eq('practice_session_id', sessionId)
    .eq('is_active', true)
    .order('item_order');
  
  if (error) {
    throw error;
  }
  
  return data;
}
```

#### 5. Record and Submit Audio

```typescript
async function submitPracticeAudio(
  practiceItemId: string,
  audioBlob: Blob,
  practiceType: 'word' | 'sentence'
) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const formData = new FormData();
  formData.append('practice_item_id', practiceItemId);
  formData.append('audio', audioBlob, 'recording.wav');
  
  const endpoint = practiceType === 'word'
    ? 'pronunciation-submit-word-practice'
    : 'pronunciation-submit-sentence-practice';
  
  const response = await fetch(
    `${supabaseUrl}/functions/v1/${endpoint}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      },
      body: formData
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Submission failed');
  }
  
  return await response.json();
}
```

#### 6. Display Results

```typescript
function displayResults(result: PracticeResult) {
  console.log(`Score: ${result.pronunciationScore}/100`);
  console.log(`Attempt: #${result.attemptNumber}`);
  console.log(`Correct: ${result.isCorrect ? 'Yes' : 'No'}`);
  
  // Show phoneme breakdown
  result.phonemes?.forEach(phoneme => {
    const status = 
      phoneme.readType === 0 ? '✓ Correct' :
      phoneme.readType === 1 ? `✗ Mispronounced as [${phoneme.soundLike}]` :
      phoneme.readType === 2 ? '✗ Omitted' :
      '✗ Added';
    
    console.log(`/${phoneme.phoneme}/ - ${phoneme.score} - ${status}`);
  });
}
```

#### 7. Track Progress

```typescript
async function getPracticeProgress(sessionId: string) {
  const { data, error } = await supabase
    .from('pronunciation_practice_item_progress')
    .select('*')
    .in('practice_item_id', 
      supabase
        .from('pronunciation_practice_items')
        .select('id')
        .eq('practice_session_id', sessionId)
    );
  
  if (error) {
    throw error;
  }
  
  return data;
}
```

### Complete Practice Session Flow

```typescript
class PronunciationPractice {
  private supabase: SupabaseClient;
  private studentId: string;
  private currentSessionId?: string;
  private currentItems: PracticeItem[] = [];
  private currentItemIndex: number = 0;
  
  constructor(supabaseUrl: string, anonKey: string, studentId: string) {
    this.supabase = createClient(supabaseUrl, anonKey);
    this.studentId = studentId;
  }
  
  async initialize() {
    // Check if baseline is needed
    const hasBaseline = await this.checkBaselineStatus();
    
    if (!hasBaseline) {
      await this.startBaseline();
    } else {
      await this.startPracticeSession();
    }
  }
  
  async checkBaselineStatus(): Promise<boolean> {
    const { data } = await this.supabase
      .from('pronunciation_practice_sessions')
      .select('completed_at')
      .eq('student_id', this.studentId)
      .eq('is_baseline', true)
      .order('created_at', { ascending: false })
      .limit(1);
    
    return data && data.length > 0 && data[0].completed_at !== null;
  }
  
  async startBaseline() {
    const { data: { session } } = await this.supabase.auth.getSession();
    
    const response = await fetch(
      `${this.supabase.supabaseUrl}/functions/v1/pronunciation-start-baseline-workout`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ studentId: this.studentId })
      }
    );
    
    const data = await response.json();
    this.currentSessionId = data.sessionId;
    this.currentItems = data.items;
    this.currentItemIndex = 0;
  }
  
  async startPracticeSession() {
    // Get recommended phonemes and start practice
    // Implementation similar to baseline
  }
  
  getCurrentItem(): PracticeItem {
    return this.currentItems[this.currentItemIndex];
  }
  
  async submitAudio(audioBlob: Blob) {
    const currentItem = this.getCurrentItem();
    const { data: { session } } = await this.supabase.auth.getSession();
    
    const formData = new FormData();
    formData.append('practice_item_id', currentItem.id);
    formData.append('audio', audioBlob, 'recording.wav');
    
    const endpoint = currentItem.practice_type === 'word'
      ? 'pronunciation-submit-word-practice'
      : 'pronunciation-submit-sentence-practice';
    
    const response = await fetch(
      `${this.supabase.supabaseUrl}/functions/v1/${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: formData
      }
    );
    
    return await response.json();
  }
  
  moveToNextItem(): boolean {
    if (this.currentItemIndex < this.currentItems.length - 1) {
      this.currentItemIndex++;
      return true;
    }
    return false; // Session complete
  }
  
  getProgress(): { current: number; total: number; percentage: number } {
    return {
      current: this.currentItemIndex + 1,
      total: this.currentItems.length,
      percentage: ((this.currentItemIndex + 1) / this.currentItems.length) * 100
    };
  }
}
```

### Usage Example

```typescript
// Initialize
const practice = new PronunciationPractice(
  'https://your-project.supabase.co',
  'your-anon-key',
  'student-uuid'
);

await practice.initialize();

// Practice loop
while (true) {
  const item = practice.getCurrentItem();
  
  console.log(`Practice: ${item.word_text}`);
  console.log(`IPA: ${item.word_ipa}`);
  if (item.reference_sentence) {
    console.log(`Sentence: ${item.reference_sentence}`);
  }
  
  // Record audio
  const audioBlob = await recordAudio();
  
  // Submit and get results
  const result = await practice.submitAudio(audioBlob);
  
  console.log(`Score: ${result.pronunciationScore}/100`);
  
  // Check if should retry (score < 85)
  if (result.pronunciationScore < 85) {
    const retry = await askUserToRetry();
    if (retry) {
      continue; // Record again
    }
  }
  
  // Move to next item
  const hasMore = practice.moveToNextItem();
  if (!hasMore) {
    console.log('Session complete!');
    break;
  }
  
  // Show progress
  const progress = practice.getProgress();
  console.log(`Progress: ${progress.current}/${progress.total} (${progress.percentage}%)`);
}
```

---

## Advanced Features

### 1. Phoneme Error Analysis

Query phoneme errors to identify patterns:

```typescript
async function getPhonemeErrors(studentId: string, phoneme: string) {
  const { data, error } = await supabase
    .from('pronunciation_phoneme_attempts')
    .select(`
      phoneme_score,
      read_type,
      sound_like,
      word_context,
      created_at
    `)
    .eq('student_id', studentId)
    .eq('target_ipa_symbol', phoneme)
    .eq('is_target', true)
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) throw error;
  
  // Analyze error patterns
  const errorPattern = {
    totalAttempts: data.length,
    correctCount: data.filter(a => a.read_type === 0).length,
    mispronounced: data.filter(a => a.read_type === 1).length,
    omitted: data.filter(a => a.read_type === 2).length,
    avgScore: data.reduce((sum, a) => sum + a.phoneme_score, 0) / data.length,
    commonMistakes: [...new Set(data.map(a => a.sound_like).filter(Boolean))]
  };
  
  return errorPattern;
}
```

### 2. Progress Tracking

```typescript
async function getProgressOverTime(studentId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const { data, error } = await supabase
    .from('pronunciation_practice_results')
    .select('pronunciation_score, created_at')
    .eq('student_id', studentId)
    .gte('created_at', startDate.toISOString())
    .order('created_at');
  
  if (error) throw error;
  
  // Group by day and calculate average
  const dailyAverages = data.reduce((acc, result) => {
    const date = result.created_at.split('T')[0];
    if (!acc[date]) {
      acc[date] = { scores: [], avg: 0 };
    }
    acc[date].scores.push(result.pronunciation_score);
    return acc;
  }, {});
  
  Object.keys(dailyAverages).forEach(date => {
    const scores = dailyAverages[date].scores;
    dailyAverages[date].avg = scores.reduce((a, b) => a + b) / scores.length;
  });
  
  return dailyAverages;
}
```

### 3. Practice Recommendations

```typescript
async function getRecommendedPhonemes(studentId: string, limit: number = 3) {
  // Get phonemes with lowest average scores
  const { data, error } = await supabase.rpc('get_recommended_phonemes', {
    p_student_id: studentId,
    p_limit: limit
  });
  
  if (error) throw error;
  
  return data; // Array of { phoneme: string, avg_score: number, attempt_count: number }
}
```

---

## SpeechSuper API Details

### Parameters Used

All requests to SpeechSuper use these locked parameters:

| Parameter | Value | Description |
|-----------|-------|-------------|
| **dict_type** | `IPA88` | IPA symbol set (88 phonemes) |
| **dict_dialect** | `en_us` | US English pronunciation |
| **precision** | `1.0` | Phoneme-level precision |

### API Endpoints

#### 1. word.eval.promax

Evaluates single word pronunciation.

**Endpoint**: `https://api.speechsuper.com/word.eval.promax`

**Request**:
```typescript
POST /word.eval.promax
Content-Type: multipart/form-data

{
  connect_sig: string,    // SHA1(appKey + timestamp + secretKey)
  start_sig: string,      // SHA1(appKey + timestamp + userId + secretKey)
  app_key: string,
  timestamp: number,
  user_id: string,
  audio: File,           // WAV file
  text: string,          // Word to evaluate
  dict_type: 'IPA88',
  dict_dialect: 'en_us'
}
```

**Response**:
```typescript
{
  eof: 1,
  result: {
    overall: number,      // 0-100
    pronunciation: number, // 0-100
    words: [{
      word: string,
      overall: number,
      pronunciation: number,
      phonemes: [{
        phoneme: string,   // IPA symbol
        pronunciation: number,
        readType: number,  // 0-3
        sound_like?: string,
        inserted_before?: string[],
        inserted_after?: string[]
      }]
    }]
  }
}
```

#### 2. sent.eval.promax

Evaluates sentence pronunciation with fluency and integrity.

**Endpoint**: `https://api.speechsuper.com/sent.eval.promax`

**Request**: Same as word.eval.promax but with full sentence text.

**Response**:
```typescript
{
  eof: 1,
  result: {
    overall: number,       // 0-100
    pronunciation: number, // 0-100
    fluency: number,       // 0-100
    integrity: number,     // 0-100
    words: [{
      text: string,
      overall: number,
      pronunciation: number,
      phonemes: [...]
    }]
  }
}
```

### Read Type Values

| Value | Meaning | Description |
|-------|---------|-------------|
| **0** | Correct | Phoneme pronounced correctly |
| **1** | Mispronounced | Wrong phoneme produced |
| **2** | Omitted | Phoneme missing from pronunciation |
| **3** | Added | Extra phoneme inserted |

---

## Security Considerations

### 1. Row Level Security (RLS)

All tables have RLS enabled. Students can only access their own data:

```sql
-- Example RLS policy
CREATE POLICY "Students can view own practice items"
  ON pronunciation_practice_items
  FOR SELECT
  USING (auth.uid() = student_id);
```

### 2. API Key Management

SpeechSuper credentials are stored as Supabase secrets (not exposed to clients):

```bash
# Set secrets (server-side only)
supabase secrets set SPEECHSUPER_APP_KEY=your_key
supabase secrets set SPEECHSUPER_SECRET_KEY=your_secret
```

### 3. Audio Storage

Audio files are **not** stored in the database. Only scores and metadata are persisted. If you need to store audio:

```typescript
// Upload to Supabase Storage
const { data, error } = await supabase.storage
  .from('pronunciation-audio')
  .upload(`${studentId}/${resultId}.wav`, audioBlob);
```

---

## Testing

### Test Baseline Workflow

```typescript
describe('Pronunciation Baseline', () => {
  it('should complete baseline workout', async () => {
    // 1. Start baseline
    const baseline = await startBaselineWorkout(studentId);
    expect(baseline.items).toHaveLength(10);
    
    // 2. Submit each item
    for (const item of baseline.items) {
      const audio = await generateTestAudio(item.reference_sentence);
      const result = await submitPracticeAudio(item.id, audio, 'sentence');
      expect(result.pronunciationScore).toBeGreaterThanOrEqual(0);
      expect(result.pronunciationScore).toBeLessThanOrEqual(100);
    }
    
    // 3. Verify session completion
    const { data: session } = await supabase
      .from('pronunciation_practice_sessions')
      .select('status, completed_at')
      .eq('id', baseline.sessionId)
      .single();
    
    expect(session.status).toBe('completed');
    expect(session.completed_at).not.toBeNull();
  });
});
```

### Mock Audio for Testing

```typescript
function generateTestWavFile(durationMs: number = 1000): Blob {
  const sampleRate = 16000;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  
  // Generate silence (for testing)
  const samples = new Int16Array(numSamples).fill(0);
  
  // Build WAV file
  const wavBuffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(wavBuffer);
  
  // RIFF header
  view.setUint32(0, 0x46464952, false); // "RIFF"
  view.setUint32(4, 36 + samples.length * 2, true);
  view.setUint32(8, 0x45564157, false); // "WAVE"
  
  // fmt chunk
  view.setUint32(12, 0x20746d66, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  
  // data chunk
  view.setUint32(36, 0x61746164, false); // "data"
  view.setUint32(40, samples.length * 2, true);
  
  // Write samples
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i], true);
  }
  
  return new Blob([wavBuffer], { type: 'audio/wav' });
}
```

---

## Performance Optimization

### 1. Batch Queries

Fetch multiple items in one query:

```typescript
async function getPracticeSessionWithItems(sessionId: string) {
  const { data, error } = await supabase
    .from('pronunciation_practice_sessions')
    .select(`
      *,
      pronunciation_practice_items (*)
    `)
    .eq('id', sessionId)
    .single();
  
  return data;
}
```

### 2. Caching

Cache practice items to avoid repeated queries:

```typescript
class PracticeCache {
  private cache = new Map<string, PracticeItem[]>();
  
  async getItems(sessionId: string): Promise<PracticeItem[]> {
    if (this.cache.has(sessionId)) {
      return this.cache.get(sessionId)!;
    }
    
    const items = await fetchPracticeItems(sessionId);
    this.cache.set(sessionId, items);
    return items;
  }
  
  invalidate(sessionId: string) {
    this.cache.delete(sessionId);
  }
}
```

### 3. Realtime Updates

Subscribe to session changes:

```typescript
const channel = supabase
  .channel('pronunciation-updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'pronunciation_practice_sessions',
      filter: `id=eq.${sessionId}`
    },
    (payload) => {
      console.log('Session updated:', payload.new);
      // Update UI
    }
  )
  .subscribe();
```

---

## Summary

The JustTalk Pronunciation System provides:

✅ **Baseline Assessment**: 10-sentence workout identifies weak phonemes  
✅ **Targeted Practice**: Focus on specific pronunciation challenges  
✅ **Real-time Feedback**: Phoneme-level scoring via SpeechSuper API  
✅ **Progress Tracking**: Historical data and improvement analytics  
✅ **Mobile-Ready**: Complete API for native app integration  
✅ **Secure**: RLS policies protect student data  
✅ **Scalable**: Edge functions handle processing  

**Quick Start**:
1. Check baseline status
2. Start baseline workout (if needed)
3. Record & submit audio (WAV, 16kHz, mono, PCM16)
4. Display results and phoneme feedback
5. Track progress over time

**Key Endpoints**:
- `/functions/v1/pronunciation-start-baseline-workout`
- `/functions/v1/pronunciation-submit-word-practice`
- `/functions/v1/pronunciation-submit-sentence-practice`

**Next Steps**:
- Implement audio recording in your mobile app
- Integrate with Supabase client
- Build UI for practice sessions
- Add progress visualization

For questions or support, refer to the edge function source code in `supabase/functions/pronunciation-*`.
