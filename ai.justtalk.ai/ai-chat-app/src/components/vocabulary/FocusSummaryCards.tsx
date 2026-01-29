import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Target, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useWeeklyFocusTarget } from '@/hooks/useWeeklyFocusTarget';

interface FocusSummaryCardsProps {
  studentId?: string;
  vocabularyCapacity: number;
}

export function FocusSummaryCards({ studentId, vocabularyCapacity }: FocusSummaryCardsProps) {
  const { data: weeklyTarget, isLoading } = useWeeklyFocusTarget(studentId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {/* Vocabulary Capacity Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[hsl(var(--brand-blue))]" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Vocabulary Capacity
            </h3>
          </div>
        </div>
        <div className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          {vocabularyCapacity}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Total words stabilized through focus practice.
        </p>
      </Card>

      {/* Weekly Focus Target Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Weekly Focus Target
            </h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Focus points earned this week</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {isLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : weeklyTarget ? (
          <>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              {weeklyTarget.weekly_focus_points} / {weeklyTarget.weekly_focus_target}
            </div>
            <Progress 
              value={(weeklyTarget.weekly_focus_points / weeklyTarget.weekly_focus_target) * 100} 
              className="h-2 mb-2"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Focus points earned this week · Resets every Monday
            </p>
          </>
        ) : (
          <div className="text-sm text-gray-500">No data available</div>
        )}
      </Card>
    </div>
  );
}
