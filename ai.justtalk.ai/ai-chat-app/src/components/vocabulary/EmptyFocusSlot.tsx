import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function EmptyFocusSlot() {
  return (
    <Card className={cn(
      "p-4 border-dashed border-2 border-gray-200 dark:border-gray-700",
      "flex items-center justify-center min-h-[100px] bg-gray-50/50 dark:bg-gray-900/50"
    )}>
      <span className="text-gray-400 dark:text-gray-600 text-sm">Empty</span>
    </Card>
  );
}
