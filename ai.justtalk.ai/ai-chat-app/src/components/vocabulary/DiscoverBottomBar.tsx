import { Button } from '@/components/ui/button';
import { useVocabularyBuilder } from '@/hooks/useVocabularyBuilder';
import { toast } from '@/hooks/use-toast';

interface DiscoverBottomBarProps {
  selectedCount: number;
  selectedWords: Set<string>;
  onCancel: () => void;
  setId: string | null;
}

export function DiscoverBottomBar({
  selectedCount,
  selectedWords,
  onCancel,
  setId,
}: DiscoverBottomBarProps) {
  const { bulkAddWords, isAdding } = useVocabularyBuilder();

  const handleAddSelected = async () => {
    try {
      const wordsArray = Array.from(selectedWords);
      // Add words to Goal Pool (isActive = false)
      // Note: targetCodes would be 'en' for English words typically
      const targetCodes = wordsArray.map(() => 'en');
      await bulkAddWords(wordsArray, targetCodes, false);
      toast({
        title: 'Words added',
        description: `${selectedCount} word${selectedCount > 1 ? 's' : ''} added to Goal Pool`,
      });
      onCancel();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add words',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t dark:border-gray-800 px-4 py-3 shadow-lg z-20">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {selectedCount} word{selectedCount > 1 ? 's' : ''} selected
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isAdding}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleAddSelected}
            disabled={isAdding}
            className="bg-[hsl(var(--brand-blue))] hover:bg-[hsl(var(--brand-blue))]/90"
          >
            Add to Builder
          </Button>
        </div>
      </div>
    </div>
  );
}
