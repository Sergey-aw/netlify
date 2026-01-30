import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Target, AlertCircle, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface FocusWord {
  lexeme_id: string;
  lemma: string;
  activation_count: number;
  points: number;
  is_active: boolean;
}

interface Mistake {
  id: string;
  mistake_type: string;
  original_text: string;
  corrected_text: string;
  explanation: string;
}

interface RealtimeGoalsPanelProps {
  lessonId: string;
  studentId: string;
  isVisible: boolean;
}

export function RealtimeGoalsPanel({ lessonId, studentId, isVisible }: RealtimeGoalsPanelProps) {
  const [vocabUpdateTrigger, setVocabUpdateTrigger] = useState(0);
  const [mistakeUpdateTrigger, setMistakeUpdateTrigger] = useState(0);
  const [recentMistakes, setRecentMistakes] = useState<Mistake[]>([]);

  // Listen for real-time vocab updates
  useEffect(() => {
    const handleVocabUpdate = () => {
      console.log('🔔 Vocab update event received');
      setVocabUpdateTrigger(prev => prev + 1);
    };

    window.addEventListener('vocab-realtime-completed', handleVocabUpdate);
    return () => window.removeEventListener('vocab-realtime-completed', handleVocabUpdate);
  }, []);

  // Listen for real-time mistake updates
  useEffect(() => {
    const handleMistakeUpdate = (event: CustomEvent) => {
      console.log('🔔 Mistake update event received', event.detail);
      setMistakeUpdateTrigger(prev => prev + 1);
      
      // Add new mistakes to the list
      if (event.detail.mistakes && event.detail.mistakes.length > 0) {
        setRecentMistakes(prev => [...event.detail.mistakes, ...prev].slice(0, 10));
      }
    };

    window.addEventListener('mistakes-realtime-completed', handleMistakeUpdate as EventListener);
    return () => window.removeEventListener('mistakes-realtime-completed', handleMistakeUpdate as EventListener);
  }, []);

  // Fetch Focus Set snapshot (frozen at lesson start)
  const { data: focusSnapshot, isLoading: loadingSnapshot } = useQuery({
    queryKey: ['focus-snapshot', lessonId, studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_focus_snapshots')
        .select(`
          lexeme_id,
          snapshot_data,
          lexemes (
            lemma
          )
        `)
        .eq('lesson_id', lessonId)
        .eq('student_id', studentId);

      if (error) throw error;

      return data.map(item => ({
        lexeme_id: item.lexeme_id,
        lemma: (item.lexemes as any)?.lemma || 'Unknown',
        activation_count: (item.snapshot_data as any)?.activation_count || 0,
        points: (item.snapshot_data as any)?.points || 0,
        is_active: (item.snapshot_data as any)?.is_active || false,
      })) as FocusWord[];
    },
    enabled: isVisible && !!lessonId && !!studentId,
  });

  // Fetch current vocab progress (updates in real-time)
  const { data: vocabProgress, isLoading: loadingProgress } = useQuery({
    queryKey: ['vocab-progress', lessonId, studentId, vocabUpdateTrigger],
    queryFn: async () => {
      // Get activation counts from vocab_evidence
      const { data, error } = await supabase
        .from('vocab_evidence')
        .select('lexeme_id, was_in_focus')
        .eq('lesson_id', lessonId)
        .eq('student_id', studentId);

      if (error) throw error;

      // Count activations per lexeme
      const activations: Record<string, { total: number; focus: number }> = {};
      
      data.forEach(evidence => {
        if (!activations[evidence.lexeme_id]) {
          activations[evidence.lexeme_id] = { total: 0, focus: 0 };
        }
        activations[evidence.lexeme_id].total++;
        if (evidence.was_in_focus) {
          activations[evidence.lexeme_id].focus++;
        }
      });

      return activations;
    },
    enabled: isVisible && !!lessonId && !!studentId,
    refetchInterval: false, // Only refetch on trigger
  });

  // Fetch mistake counts
  const { data: mistakeStats, isLoading: loadingMistakes } = useQuery({
    queryKey: ['mistake-stats', lessonId, mistakeUpdateTrigger],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_segment_mistakes')
        .select('mistake_type, original_text, corrected_text, explanation')
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Group by mistake type
      const grouped: Record<string, number> = {};
      data.forEach(mistake => {
        grouped[mistake.mistake_type] = (grouped[mistake.mistake_type] || 0) + 1;
      });

      return {
        total: data.length,
        byType: grouped,
        recent: data,
      };
    },
    enabled: isVisible && !!lessonId,
    refetchInterval: false,
  });

  if (!isVisible) return null;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b">
        <Sparkles className="w-5 h-5 text-purple-500" />
        <h3 className="font-semibold text-lg">Real-Time Goals</h3>
      </div>

      {/* Focus Set Section */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-blue-500" />
          <h4 className="font-medium">Focus Set</h4>
          <Badge variant="secondary" className="ml-auto">
            Frozen
          </Badge>
        </div>

        {loadingSnapshot ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : focusSnapshot && focusSnapshot.length > 0 ? (
          <div className="space-y-2">
            {focusSnapshot.map(word => {
              const progress = vocabProgress?.[word.lexeme_id];
              const currentActivations = progress?.focus || 0;
              const isActivated = currentActivations > 0;

              return (
                <div
                  key={word.lexeme_id}
                  className={`p-3 rounded-lg border ${
                    isActivated
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{word.lemma}</span>
                    {isActivated && (
                      <Badge variant="default" className="bg-green-500">
                        +{currentActivations}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${
                            i < currentActivations
                              ? 'bg-green-500'
                              : 'bg-gray-300 dark:bg-gray-700'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs">
                      {currentActivations}/5 activations
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No Focus Set words for this session
          </p>
        )}
      </Card>

      {/* Vocabulary Progress Section */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-green-500" />
          <h4 className="font-medium">Vocabulary Used</h4>
        </div>

        {loadingProgress ? (
          <Skeleton className="h-16 w-full" />
        ) : vocabProgress ? (
          <div className="space-y-2">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {Object.keys(vocabProgress).length}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Unique words used this session
            </p>
            <div className="text-xs text-gray-500">
              {Object.values(vocabProgress).reduce((sum, val) => sum + val.total, 0)} total word instances
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No vocabulary tracked yet</p>
        )}
      </Card>

      {/* Mistakes Section */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 text-orange-500" />
          <h4 className="font-medium">Mistakes</h4>
        </div>

        {loadingMistakes ? (
          <Skeleton className="h-16 w-full" />
        ) : mistakeStats && mistakeStats.total > 0 ? (
          <div className="space-y-3">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {mistakeStats.total}
            </div>
            <div className="space-y-2">
              {Object.entries(mistakeStats.byType).map(([type, count]) => (
                <div key={type} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400 capitalize">
                    {type.replace(/_/g, ' ')}
                  </span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
            
            {/* Recent mistakes */}
            {(recentMistakes.length > 0 || mistakeStats.recent.length > 0) && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium mb-2 text-gray-500">Recent:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(recentMistakes.length > 0 ? recentMistakes : mistakeStats.recent).map((mistake, idx) => (
                    <div key={idx} className="text-xs p-2 bg-gray-50 dark:bg-gray-900 rounded">
                      <div className="flex items-start gap-1">
                        <span className="text-red-500 line-through">{mistake.original_text}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-green-600">{mistake.corrected_text}</span>
                      </div>
                      {mistake.explanation && (
                        <p className="text-gray-500 mt-1">{mistake.explanation}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No mistakes detected yet</p>
        )}
      </Card>

      {/* Info Badge */}
      <div className="text-xs text-center text-gray-500 dark:text-gray-400 pt-2">
        Updates automatically as you speak
      </div>
    </div>
  );
}
