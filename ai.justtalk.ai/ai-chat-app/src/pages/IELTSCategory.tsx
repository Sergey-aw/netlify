import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PanelLeft, ArrowLeft, GraduationCap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AppSidebar } from '@/components/AppSidebar';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { IeltsTestCard } from '@/components/ielts/IeltsTestCard';
import {
  fetchIeltsCatalog,
  groupByTheme,
} from '@/services/ielts.service';

export default function IELTSCategory() {
  const { slug = '' } = useParams<{ slug: string }>();
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

  const themeSummary = useMemo(() => {
    if (!tests) return null;
    return groupByTheme(tests).find((t) => t.slug === slug) ?? null;
  }, [tests, slug]);

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
          <button
            onClick={() => navigate('/ielts')}
            className="p-1.5 rounded-md hover:bg-muted flex items-center gap-1.5 text-sm"
            aria-label="Back to categories"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Categories</span>
          </button>
          <GraduationCap className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold truncate">
            {themeSummary?.theme ?? 'IELTS Speaking'}
          </h1>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto p-4 sm:p-6">
            {isPending && <CatGridSkeleton />}

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                Couldn't load tests. {(error as Error).message}
              </div>
            )}

            {tests && !isPending && !themeSummary && (
              <div className="rounded-md border bg-muted/40 p-6 text-sm text-muted-foreground">
                Category not found.{' '}
                <button
                  className="underline"
                  onClick={() => navigate('/ielts')}
                >
                  Back to categories
                </button>
                .
              </div>
            )}

            {themeSummary && (
              <>
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    Mock tests
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {themeSummary.tests.length}{' '}
                    {themeSummary.tests.length === 1 ? 'test' : 'tests'} in
                    this category.
                  </p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {themeSummary.tests.map((t) => (
                    <IeltsTestCard
                      key={t.id}
                      test={t}
                      onClick={() => navigate(`/ielts/test/${t.id}`)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function CatGridSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 sm:p-5">
            <Skeleton className="w-10 h-10 rounded-xl mb-3" />
            <Skeleton className="h-3 w-1/3 mb-1" />
            <Skeleton className="h-4 w-2/3 mb-3" />
            <div className="flex gap-1.5 mb-4">
              <Skeleton className="h-5 w-7" />
              <Skeleton className="h-5 w-7" />
              <Skeleton className="h-5 w-7" />
            </div>
            <Skeleton className="h-1 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
