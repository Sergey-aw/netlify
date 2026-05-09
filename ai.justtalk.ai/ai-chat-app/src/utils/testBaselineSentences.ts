/**
 * Test utility to verify baseline sentences are correctly configured
 * Run this in browser console to verify sentence availability
 */

import { BASELINE_SENTENCES_V1 } from '@/constants/baselineSentences';

export function testBaselineSentences() {
  console.group('🧪 Baseline Sentences Test');
  
  console.log('✅ Total sentences:', BASELINE_SENTENCES_V1.length);
  console.log('✅ Expected: 10');
  
  if (BASELINE_SENTENCES_V1.length === 10) {
    console.log('✅ Correct number of sentences');
  } else {
    console.error('❌ Incorrect number of sentences');
  }
  
  console.log('\n📝 All sentences:');
  BASELINE_SENTENCES_V1.forEach((sentence, index) => {
    console.log(`${index + 1}. ${sentence}`);
  });
  
  // Verify each sentence is not empty
  const allValid = BASELINE_SENTENCES_V1.every(s => s.length > 0);
  if (allValid) {
    console.log('\n✅ All sentences have content');
  } else {
    console.error('\n❌ Some sentences are empty');
  }
  
  // Check sentence lengths (should be 8-14 words)
  console.log('\n📊 Word counts:');
  BASELINE_SENTENCES_V1.forEach((sentence, index) => {
    const wordCount = sentence.split(' ').length;
    const isValid = wordCount >= 8 && wordCount <= 14;
    console.log(
      `${index + 1}. ${wordCount} words ${isValid ? '✅' : '⚠️'}`
    );
  });
  
  console.groupEnd();
  
  return {
    count: BASELINE_SENTENCES_V1.length,
    isValid: BASELINE_SENTENCES_V1.length === 10 && allValid,
    sentences: BASELINE_SENTENCES_V1
  };
}

// Auto-run in development
if (import.meta.env.DEV) {
  console.log('Run testBaselineSentences() to verify sentences');
}
