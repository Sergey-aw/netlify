/**
 * Sample texts for pronunciation assessment
 * Each text is designed to test different phonetic patterns
 */

export interface PronunciationText {
  id: number;
  text: string;
  description: string;
}

export const PRONUNCIATION_TEXTS: PronunciationText[] = [
  {
    id: 1,
    text: "I thought I saw a ghost in the garage. Can you really rely on her to arrive early? The quick brown fox jumps over the lazy dog.",
    description: "Mixed vowel and consonant sounds"
  },
  {
    id: 2,
    text: "She sells seashells by the seashore. The shells she sells are surely seashells. So if she sells shells on the seashore, I'm sure she sells seashore shells.",
    description: "Sibilant sounds and tongue twisters"
  },
  {
    id: 3,
    text: "The weather today is absolutely beautiful. I thoroughly enjoyed watching the magnificent sunset while walking through the neighborhood. It was a truly memorable experience.",
    description: "Complex vocabulary and varied sounds"
  },
  {
    id: 4,
    text: "Technology has revolutionized communication worldwide. People can instantly connect across continents using smartphones and internet.",
    description: "Modern vocabulary and natural flow"
  }
];

/**
 * Get a random pronunciation text
 */
export function getRandomPronunciationText(): PronunciationText {
  const randomIndex = Math.floor(Math.random() * PRONUNCIATION_TEXTS.length);
  return PRONUNCIATION_TEXTS[randomIndex];
}

/**
 * Get a specific pronunciation text by ID
 */
export function getPronunciationTextById(id: number): PronunciationText | undefined {
  return PRONUNCIATION_TEXTS.find(text => text.id === id);
}
