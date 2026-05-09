/**
 * SpeechSuper API Integration
 * API for pronunciation assessment in onboarding flow
 */

export interface SpeechSuperWordScore {
  word: string;
  quality_score: number;
  phone_score_list?: Array<{
    phone: string;
    quality_score: number;
  }>;
}

export interface SpeechSuperResponse {
  overall: number;
  words: SpeechSuperWordScore[];
  fluency?: number;
  completeness?: number;
  pronunciation?: number;
}

export interface PronunciationResult {
  overallScore: number;
  cefrLevel: string;
  accuracy: number;
  totalWords: number;
  correctWords: number;
  wordsToImprove: Array<{
    word: string;
    score: number;
  }>;
  allWords: Array<{
    word: string;
    score: number;
  }>;
  transcript: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

/**
 * Map overall score to CEFR level
 * Based on common pronunciation proficiency scales
 */
function mapScoreToCEFR(score: number): string {
  if (score >= 90) return 'C2';
  if (score >= 80) return 'C1';
  if (score >= 70) return 'B2';
  if (score >= 60) return 'B1';
  if (score >= 50) return 'A2';
  return 'A1';
}

/**
 * Score pronunciation using SpeechSuper API via Edge Function
 */
export async function scorePronunciation(
  audioBlob: Blob,
  text: string
): Promise<PronunciationResult> {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('user_audio_file', audioBlob, 'recording.wav');

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/speechsuper-score`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SpeechSuper API error:', errorText);
      throw new Error(`SpeechSuper API error: ${response.statusText}`);
    }

    const data: SpeechSuperResponse = await response.json();

    // Calculate overall score (use pronunciation score if available, otherwise overall)
    const overallScore = Math.round(data.pronunciation || data.overall || 0);

    // Calculate words to improve (score < 75)
    const wordsToImprove = data.words
      .filter((word) => word.quality_score < 75)
      .map((word) => ({
        word: word.word,
        score: Math.round(word.quality_score),
      }))
      .sort((a, b) => a.score - b.score);

    const totalWords = data.words.length;
    const correctWords = data.words.filter(
      (word) => word.quality_score >= 90
    ).length;

    // Get all words with scores
    const allWords = data.words.map((word) => ({
      word: word.word,
      score: Math.round(word.quality_score),
    }));

    // Extract transcript from words
    const transcript = data.words.map((word) => word.word).join(' ');

    return {
      overallScore,
      cefrLevel: mapScoreToCEFR(overallScore),
      accuracy: Math.round((correctWords / totalWords) * 100),
      totalWords,
      correctWords,
      wordsToImprove,
      allWords,
      transcript,
    };
  } catch (error) {
    console.error('Error scoring pronunciation:', error);
    throw error;
  }
}
