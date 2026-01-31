/**
 * Phase 8.2b: Phoneme Accuracy Breakdown Component
 * Displays per-phoneme pronunciation scores with visual indicators
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface PhonemeData {
  phoneme: string;
  score: number;
  readType: number;
  soundLike?: string;
  insertedBefore?: string[];
  insertedAfter?: string[];
}

interface PhonemeAccuracyBreakdownProps {
  phonemes: PhonemeData[];
  word?: string;
}

// readType values from SpeechSuper:
// 0 = normal, 1 = added, 2 = repetition, 3 = missing/deletion, 6 = substitution
const READ_TYPE_LABELS: Record<number, string> = {
  0: 'Correct',
  1: 'Added',
  2: 'Repeated',
  3: 'Missing',
  6: 'Substituted',
};

function getPhonemeStatus(phoneme: PhonemeData): 'success' | 'warning' | 'error' {
  // Error conditions: deletion (3), substitution (6), or low score
  if (phoneme.readType === 3 || phoneme.readType === 6 || phoneme.score < 60) {
    return 'error';
  }
  if (phoneme.score < 80) {
    return 'warning';
  }
  return 'success';
}

function getStatusColors(status: 'success' | 'warning' | 'error') {
  switch (status) {
    case 'success':
      return 'bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400 dark:border-green-500/40';
    case 'warning':
      return 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400 dark:border-amber-500/40';
    case 'error':
      return 'bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400 dark:border-red-500/40';
  }
}

function PhonemeChip({ phoneme }: { phoneme: PhonemeData }) {
  const status = getPhonemeStatus(phoneme);
  const isError = phoneme.readType === 3 || phoneme.readType === 6;
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg border transition-all',
            'hover:scale-105 hover:shadow-md cursor-pointer',
            getStatusColors(status)
          )}
        >
          <span className="text-lg font-mono font-medium">{phoneme.phoneme}</span>
          <span className="text-xs font-medium">{Math.round(phoneme.score)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="center">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{phoneme.phoneme}</span>
            <span className={cn(
              'text-sm font-semibold',
              status === 'success' && 'text-green-600',
              status === 'warning' && 'text-amber-600',
              status === 'error' && 'text-red-600'
            )}>
              {Math.round(phoneme.score)}%
            </span>
          </div>
          
          <div className="text-xs text-muted-foreground">
            Status: {READ_TYPE_LABELS[phoneme.readType] ?? `Type ${phoneme.readType}`}
          </div>
          
          {isError && phoneme.soundLike && (
            <div className="text-xs bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">Sounded like: </span>
              <span className="font-mono font-medium">{phoneme.soundLike}</span>
            </div>
          )}
          
          {phoneme.insertedBefore && phoneme.insertedBefore.length > 0 && (
            <div className="text-xs bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">Inserted before: </span>
              <span className="font-mono">{phoneme.insertedBefore.join(', ')}</span>
            </div>
          )}
          
          {phoneme.insertedAfter && phoneme.insertedAfter.length > 0 && (
            <div className="text-xs bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">Inserted after: </span>
              <span className="font-mono">{phoneme.insertedAfter.join(', ')}</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PhonemeAccuracyBreakdown({ phonemes, word }: PhonemeAccuracyBreakdownProps) {
  if (!phonemes || phonemes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-2">
        No phoneme data available
      </div>
    );
  }

  const errorCount = phonemes.filter(p => getPhonemeStatus(p) === 'error').length;
  const warningCount = phonemes.filter(p => getPhonemeStatus(p) === 'warning').length;
  const successCount = phonemes.filter(p => getPhonemeStatus(p) === 'success').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Phoneme Accuracy</h4>
        <div className="flex gap-2 text-xs">
          {successCount > 0 && (
            <span className="text-green-600 dark:text-green-400">{successCount} good</span>
          )}
          {warningCount > 0 && (
            <span className="text-amber-600 dark:text-amber-400">{warningCount} fair</span>
          )}
          {errorCount > 0 && (
            <span className="text-red-600 dark:text-red-400">{errorCount} need work</span>
          )}
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 justify-center py-2">
        {phonemes.map((phoneme, index) => (
          <PhonemeChip key={`${phoneme.phoneme}-${index}`} phoneme={phoneme} />
        ))}
      </div>
      
      <p className="text-xs text-center text-muted-foreground">
        Tap any phoneme for details
      </p>
    </div>
  );
}
