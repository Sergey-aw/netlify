import { Lock, CheckCircle2, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { iconForTheme } from '@/components/ielts/themeIcon';
import {
  type IeltsTestSummary,
  type PartSummary,
  overallBand,
} from '@/services/ielts.service';

const PART_SHORT: Record<1 | 2 | 3, string> = {
  1: 'P1',
  2: 'P2',
  3: 'P3',
};

export function IeltsTestCard({
  test,
  onClick,
}: {
  test: IeltsTestSummary;
  onClick: () => void;
}) {
  const { hasActiveSubscription } = useSubscription();
  const Icon = iconForTheme(test.theme);

  const completedParts = test.parts.filter(
    (p) => p.status === 'examiner_complete' || p.status === 'coach_complete',
  ).length;
  const anyInProgress = test.parts.some((p) => p.status === 'in_progress');
  const isLocked =
    test.accessTier === 'paid' &&
    !hasActiveSubscription &&
    completedParts === 0;

  const progressPct = Math.round((completedParts / test.parts.length) * 100);

  return (
    <Card
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group relative cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <CardContent className="p-4 sm:p-5">
        {/* Top row — icon, in-progress / Pro / done badges */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {anyInProgress && (
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 text-[10px] px-1.5 py-0 h-5 gap-1"
              >
                <span className="relative inline-flex w-1.5 h-1.5">
                  <span className="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-60" />
                  <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                </span>
                Resume
              </Badge>
            )}
            {test.fullyCompleted && !anyInProgress && (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            )}
            {test.accessTier === 'paid' && !test.fullyCompleted && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5"
              >
                Pro
              </Badge>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-0.5">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            Test {test.ordering}
          </div>
          <div
            className="font-semibold text-sm sm:text-base leading-tight line-clamp-2"
            title={test.theme}
          >
            {test.theme}
          </div>
        </div>

        {/* Part chips */}
        <div className="flex items-center gap-1.5 mt-3">
          {test.parts.map((p) => (
            <PartChip key={p.partId || p.partNumber} part={p} />
          ))}
        </div>

        {/* Progress + footer */}
        <div className="mt-4 space-y-1.5">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all ${
                anyInProgress && completedParts === 0
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-primary'
              }`}
              style={{
                width: `${
                  anyInProgress && completedParts === 0
                    ? 12
                    : progressPct
                }%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-muted-foreground">
            <span>
              {test.testScore ? (
                <>
                  Band{' '}
                  <span className="font-semibold text-foreground tabular-nums">
                    {overallBand(test.testScore).toFixed(1)}
                  </span>
                </>
              ) : completedParts > 0 ? (
                <>
                  {completedParts}/{test.parts.length} parts
                  {anyInProgress && ' · in progress'}
                </>
              ) : anyInProgress ? (
                'In progress'
              ) : isLocked ? (
                <span className="inline-flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Subscription required
                </span>
              ) : (
                'Not started'
              )}
            </span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Compact per-Part status chip — solid for done, outlined for current/locked, dot for untouched. */
function PartChip({ part }: { part: PartSummary }) {
  const { hasActiveSubscription } = useSubscription();
  const isCompleted =
    part.status === 'examiner_complete' || part.status === 'coach_complete';
  const isInProgress = part.status === 'in_progress';
  const isLocked = part.accessTier === 'paid' && !hasActiveSubscription;

  // Three visual states: completed (filled brand), in_progress (amber outline + pulse), untouched (neutral)
  let classes =
    'inline-flex items-center justify-center text-[10px] font-medium rounded-md h-5 w-7 border';
  let inner: React.ReactNode = PART_SHORT[part.partNumber];

  if (isCompleted && part.latestScore) {
    classes +=
      ' bg-primary text-primary-foreground border-primary';
    inner = overallBand(part.latestScore).toFixed(1);
  } else if (isInProgress) {
    classes +=
      ' bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800 animate-pulse';
  } else if (isLocked) {
    classes +=
      ' bg-muted/40 text-muted-foreground border-dashed border-muted-foreground/30';
  } else {
    classes +=
      ' bg-muted/40 text-muted-foreground border-transparent';
  }

  return <span className={classes}>{inner}</span>;
}
