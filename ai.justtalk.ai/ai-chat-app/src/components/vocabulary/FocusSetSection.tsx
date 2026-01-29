import { FocusSetCard } from './FocusSetCard';
import { EmptyFocusSlot } from './EmptyFocusSlot';
import { Sparkles } from 'lucide-react';
import type { FocusSetWord } from '@/hooks/useFocusSet';

interface FocusSetSectionProps {
  words: FocusSetWord[];
  isLoading: boolean;
  maxSlots?: number;
  onRemove?: (goalId: string) => void;
}

export function FocusSetSection({
  words,
  isLoading,
  maxSlots = 5,
  onRemove,
}: FocusSetSectionProps) {
  const emptySlots = Math.max(0, maxSlots - words.length);

  if (isLoading) {
    return (
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        Loading Focus Set...
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[hsl(var(--brand-blue))]" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Focus Set
          </h2>
        </div>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {words.length} / {maxSlots}
        </span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        These words earn progress when you use them in speech.
      </p>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {words.map((word) => (
          <FocusSetCard
            key={word.id}
            word={word}
            onRemove={onRemove}
          />
        ))}
        
        {/* Empty slots */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <EmptyFocusSlot key={`empty-${i}`} />
        ))}
      </div>
    </div>
  );
}
