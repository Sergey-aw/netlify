import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PanelLeft, GraduationCap, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AppSidebar } from '@/components/AppSidebar';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { iconForTheme } from '@/components/ielts/themeIcon';
import {
  fetchIeltsCatalog,
  groupByTheme,
  type ThemeSummary,
} from '@/services/ielts.service';

export default function IELTS() {
  const navigate = useNavigate();
  const [showSidebar, setShowSidebar] = useState(false);

  useSwipeGesture({
    onSwipeRight: () => {
      if (!showSidebar) setShowSidebar(true);
    },
    minSwipeDistance: 50,
    maxVerticalDistance: 100,
    ignoreSelectors: ['[data-swipe-ignore]'],
  });

  const { data: tests, isPending, error } = useQuery({
    queryKey: ['ielts-catalog'],
    queryFn: fetchIeltsCatalog,
    staleTime: 60 * 1000,
  });

  const themes = tests ? groupByTheme(tests) : [];

  return (
    <div className="flex h-screen bg-gray-50">
      <AppSidebar open={showSidebar} onOpenChange={setShowSidebar} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="p-4 border-b bg-white flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowSidebar(true)}
            className="p-1.5 rounded-md hover:bg-muted"
            aria-label="Open menu"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
          <GraduationCap className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">IELTS Speaking</h1>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto p-4 sm:p-6">
            <div className="mb-6">
              <h2 className="text-sm font-medium text-muted-foreground">
                Categories
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Pick a category to see its mock tests. Each test has 3 parts,
                scored independently for Pronunciation, Fluency, Lexical
                Resource, and Grammatical Range &amp; Accuracy.
              </p>
            </div>

            {isPending && <ThemeGridSkeleton />}

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                Couldn't load tests. {(error as Error).message}
              </div>
            )}

            {tests && themes.length > 0 && (
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                {themes.map((t) => (
                  <ThemeCard
                    key={t.slug}
                    theme={t}
                    onClick={() => navigate(`/ielts/category/${t.slug}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function ThemeCard({
  theme,
  onClick,
}: {
  theme: ThemeSummary;
  onClick: () => void;
}) {
  const Icon = iconForTheme(theme.theme);
  const totalTests = theme.tests.length;
  const allDone = theme.fullyCompletedTests === totalTests && totalTests > 0;
  const inProgress = theme.startedTests - theme.fullyCompletedTests;
  const progressPct = totalTests
    ? Math.round((theme.fullyCompletedTests / totalTests) * 100)
    : 0;

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
      className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-1 hover:border-primary relative overflow-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between mb-3 relative z-10">
        <Icon className="w-8 h-8 text-primary" />
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </div>

      <h4 className="font-medium text-lg mb-2 relative z-10">{theme.theme}</h4>

      <div className="flex items-center justify-between text-sm relative z-10">
        <span className="text-muted-foreground">
          {totalTests} mock test{totalTests !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1.5">
          {inProgress > 0 && (
            <Badge
              variant="secondary"
              className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 text-[10px] px-1.5 py-0 h-5 gap-1"
            >
              <span className="relative inline-flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-60" />
                <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
              </span>
              {inProgress}
            </Badge>
          )}
          {allDone && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        </div>
      </div>

      {/* Progress bar — visible once the user has started anything in this category */}
      {theme.startedTests > 0 && (
        <div className="mt-3 relative z-10 space-y-1">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-[11px] text-muted-foreground">
            {theme.fullyCompletedTests}/{totalTests} completed
          </div>
        </div>
      )}
    </Card>
  );
}

function ThemeGridSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <Card key={i} className="p-6">
          <div className="flex items-start justify-between mb-3">
            <Skeleton className="w-8 h-8 rounded-md" />
            <Skeleton className="w-5 h-5 rounded-sm" />
          </div>
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/3" />
        </Card>
      ))}
    </div>
  );
}
