import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Target, CheckCircle, Award, BarChart3, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getBaselineSummary, getPracticeCandidates } from '@/services/pronunciationApi';
import { TargetedPracticeStarter } from './TargetedPracticeStarter';
import { cn } from '@/lib/utils';

interface ProgressDashboardProps {
  studentId: string;
  onStartPractice?: (targetPhonemes: string[]) => void | Promise<void>;
}

export function ProgressDashboard({ studentId, onStartPractice }: ProgressDashboardProps) {
  // Fetch baseline summary
  const { data: baselineSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['baseline-summary', studentId],
    queryFn: () => getBaselineSummary(studentId),
  });

  // Fetch practice candidates (includes all attempts, not just baseline)
  const { data: practiceCandidates, isLoading: statsLoading } = useQuery({
    queryKey: ['pronunciation-practice-candidates', studentId],
    queryFn: () => getPracticeCandidates(studentId),
    enabled: !!baselineSummary, // Only fetch if baseline exists
  });

  const handleStartTargetedPractice = async (targetPhonemes: string[]) => {
    console.log('🎯 ProgressDashboard: Starting targeted practice for phonemes:', targetPhonemes);
    if (onStartPractice) {
      await onStartPractice(targetPhonemes);
    }
  };

  const isLoading = summaryLoading || statsLoading;
  const hasBaseline = !!baselineSummary;

  // Calculate summary stats from baseline
  const totalSentences = baselineSummary?.total_sentences || 0;
  const avgPronunciation = baselineSummary?.avg_pronunciation || 0;
  const avgFluency = baselineSummary?.avg_fluency || 0;
  const isValidBaseline = baselineSummary?.is_valid_baseline || false;
  
  // Practice candidate stats
  const criticalPhonemes = practiceCandidates?.filter(p => p.severity_bucket === 'critical').length || 0;
  const warningPhonemes = practiceCandidates?.filter(p => p.severity_bucket === 'warning').length || 0;

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-64" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show empty state if no baseline completed yet
  if (!hasBaseline) {
    return (
      <div className="p-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Baseline Assessment Yet</AlertTitle>
          <AlertDescription>
            Complete the baseline assessment in the Practice tab to see your progress and phoneme statistics here.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      {/* Baseline Validity Alert */}
      {!isValidBaseline && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 h-4" />
          <AlertTitle>Baseline Incomplete</AlertTitle>
          <AlertDescription>
            Your baseline assessment needs more valid recordings (minimum 6 of 10 sentences). 
            Please complete it in the Practice tab to unlock targeted practice.
          </AlertDescription>
        </Alert>
      )}

    
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sentences</p>
                <p className="text-3xl font-bold">{totalSentences}</p>
                <p className="text-xs text-muted-foreground">assessed</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pronunciation</p>
                <p className="text-3xl font-bold">{Math.round(avgPronunciation)}</p>
                <p className="text-xs text-muted-foreground">average score</p>
              </div>
              <Target className="w-10 h-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fluency</p>
                <p className="text-3xl font-bold">{Math.round(avgFluency)}</p>
                <p className="text-xs text-muted-foreground">average score</p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Problem Sounds</p>
                <p className="text-3xl font-bold">{criticalPhonemes + warningPhonemes}</p>
                <p className="text-xs text-muted-foreground">need practice</p>
              </div>
              <Award className="w-10 h-10 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Phoneme Error Analysis */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Phoneme Error Analysis</CardTitle>
              <CardDescription>Sounds that need the most practice (from baseline assessment)</CardDescription>
            </div>
            <BarChart3 className="w-6 h-6 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {practiceCandidates && practiceCandidates.length > 0 ? (
            <div className="space-y-4">
              {practiceCandidates.slice(0, 15).map((stat) => {
                const getSeverityColor = (bucket: string) => {
                  switch (bucket) {
                    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
                    case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                    case 'stable': return 'bg-green-100 text-green-800 border-green-200';
                    default: return 'bg-gray-100 text-gray-800 border-gray-200';
                  }
                };

                return (
                  <div key={stat.ipa_symbol} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-2xl w-14 text-center">{stat.ipa_symbol}</span>
                        <div className="text-sm">
                          <div className="font-medium">{stat.total_occurrences} attempts</div>
                          <div className="text-muted-foreground text-xs">
                            {stat.error_count} errors ({Math.round(stat.error_rate)}% error rate)
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(getSeverityColor(stat.severity_bucket))}
                      >
                        {stat.severity_bucket}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress 
                        value={stat.avg_score || 0} 
                        className="flex-1"
                      />
                      <span className="text-sm font-medium w-12 text-right">
                        {Math.round(stat.avg_score || 0)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No phoneme data available yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
