import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getCefrLevelColor, getActivationDotCount } from '@/lib/vocabulary-utils';
import { ActivationDots } from './ActivationDots';
import type { FocusSetWord } from '@/hooks/useFocusSet';
import React from 'react';

interface SwapFocusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusWords: FocusSetWord[];
  wordToAdd: {
    id: string;
    lemma: string;
    cefr_level: string | null;
  } | null;
  onConfirmSwap: (removeWordId: string) => void;
  isSwapping?: boolean;
}

export function SwapFocusDialog({
  open,
  onOpenChange,
  focusWords,
  wordToAdd,
  onConfirmSwap,
  isSwapping,
}: SwapFocusDialogProps) {
  const [selectedWordId, setSelectedWordId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setSelectedWordId(null);
    }
  }, [open]);

  const handleConfirm = () => {
    if (selectedWordId) {
      onConfirmSwap(selectedWordId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Focus Set is full (5/5)
          </DialogTitle>
          <DialogDescription className="text-base">
            To add <span className="font-semibold text-gray-900 dark:text-gray-100">"{wordToAdd?.lemma}"</span>, choose one word to pause for now.
            <br />
            <span className="text-sm mt-2 block">
              You'll keep all progress on the word you remove — it just won't earn focus points until you bring it back.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Select a word to remove from Focus:
          </h3>
          
          {focusWords.map((word) => (
            <button
              key={word.id}
              onClick={() => setSelectedWordId(word.id)}
              className={cn(
                'w-full p-4 rounded-lg border-2 transition-all text-left',
                'hover:border-gray-400 dark:hover:border-gray-600',
                selectedWordId === word.id
                  ? 'border-[hsl(var(--brand-blue))] bg-[hsl(var(--brand-blue))]/10'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {word.lemma}
                  </span>
                  {word.cefr_level && (
                    <Badge className={cn('text-xs', getCefrLevelColor(word.cefr_level))}>
                      {word.cefr_level}
                    </Badge>
                  )}
                </div>
                <ActivationDots count={getActivationDotCount(word.lesson_count)} size="md" />
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSwapping}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedWordId || isSwapping}
            className="bg-gray-600 hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700"
          >
            Confirm swap
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
