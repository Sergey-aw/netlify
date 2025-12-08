/**
 * Speechace API Integration
 * API for pronunciation assessment
 */

export interface SpeechaceWordScore {
  word: string;
  quality_score: number;
  phone_score_list: Array<{
    phone: string;
    quality_score: number;
    extent: [number, number];
  }>;
}

export interface SpeechaceResponse {
  status: string;
  text_score: {
    text: string;
    word_score_list: SpeechaceWordScore[];
    speechace_score: {
      pronunciation: number;
    };
    cefr_score: {
      pronunciation: string;
    };
  };
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
 * Score pronunciation using Speechace API via Edge Function
 */
export async function scorePronunciation(
  audioBlob: Blob,
  text: string
): Promise<PronunciationResult> {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('user_audio_file', audioBlob, 'recording.wav');

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/speechace-score`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Speechace API error: ${response.statusText}`);
    }

    const data: SpeechaceResponse = await response.json();

    if (data.status !== 'success') {
      throw new Error('Speechace API returned non-success status');
    }

    // Calculate words to improve (score < 75)
    const wordsToImprove = data.text_score.word_score_list
      .filter((word) => word.quality_score < 75)
      .map((word) => ({
        word: word.word,
        score: word.quality_score,
      }))
      .sort((a, b) => a.score - b.score);

    const totalWords = data.text_score.word_score_list.length;
    const correctWords = data.text_score.word_score_list.filter(
      (word) => word.quality_score >= 90
    ).length;

    // Get all words with scores
    const allWords = data.text_score.word_score_list.map((word) => ({
      word: word.word,
      score: Math.round(word.quality_score),
    }));

    return {
      overallScore: data.text_score.speechace_score.pronunciation,
      cefrLevel: data.text_score.cefr_score.pronunciation,
      accuracy: Math.round((correctWords / totalWords) * 100),
      totalWords,
      correctWords,
      wordsToImprove,
      allWords,
      transcript: data.text_score.text,
    };
  } catch (error) {
    console.error('Error scoring pronunciation:', error);
    throw error;
  }
}
