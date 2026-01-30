import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, AlertCircle, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useFocusSet } from '@/hooks/useFocusSet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';



interface RealtimeGoalsSidebarProps {
  lessonId: string;
  studentId: string;
  isOpen: boolean;
  onToggle: () => void;
}

export function RealtimeGoalsSidebar({ lessonId, studentId, isOpen, onToggle }: RealtimeGoalsSidebarProps) {
  const [vocabUpdateTrigger, setVocabUpdateTrigger] = useState(0);
  const [mistakeUpdateTrigger, setMistakeUpdateTrigger] = useState(0);

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
    };

    window.addEventListener('mistakes-realtime-completed', handleMistakeUpdate as EventListener);
    return () => window.removeEventListener('mistakes-realtime-completed', handleMistakeUpdate as EventListener);
  }, []);

  // Fetch Focus Set snapshot
  const { 
    words: focusSnapshot, 
    isLoading: loadingSnapshot,
  } = useFocusSet({
    studentId,
    lessonId,
    lessonStatus: 'in_progress',
    enabled: !!lessonId && !!studentId,
  });

  // Fetch vocab progress
  const { data: vocabProgress, isLoading: loadingProgress } = useQuery({
    queryKey: ['vocab-progress', lessonId, studentId, vocabUpdateTrigger],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vocab_evidence')
        .select('lexeme_id, was_in_focus')
        .eq('lesson_id', lessonId)
        .eq('student_id', studentId);

      if (error) throw error;

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
    enabled: !!lessonId && !!studentId,
    refetchInterval: false,
  });

  // Fetch mistakes
  const { data: mistakeStats, isLoading: loadingMistakes } = useQuery({
    queryKey: ['mistake-stats', lessonId, mistakeUpdateTrigger],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_mistakes_view')
        .select('error_type, general_error_type, display_group, sentence, replacement, start_pos, end_pos')
        .eq('lesson_id', lessonId)
        .eq('ai_validated', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const grouped: Record<string, number> = {};
      data.forEach(mistake => {
        const type = mistake.display_group || mistake.general_error_type || mistake.error_type || 'other';
        grouped[type] = (grouped[type] || 0) + 1;
      });

      return {
        total: data.length,
        byType: grouped,
        recent: data.map(m => ({
          mistake_type: m.general_error_type || m.error_type,
          display_group: m.display_group || m.general_error_type || m.error_type,
          original_text: m.sentence,
          corrected_text: m.replacement,
          explanation: m.general_error_type ? `${m.error_type}` : undefined,
          start_pos: m.start_pos,
          end_pos: m.end_pos,
        })),
      };
    },
    enabled: !!lessonId,
    refetchInterval: false,
  });

  // Count unchecked words (words without activations yet)
  const uncheckedWordsCount = focusSnapshot.filter(word => {
    const progress = vocabProgress?.[word.lexeme_id];
    const currentActivations = progress?.focus || 0;
    return currentActivations === 0;
  }).length;
  
  const focusWordsCount = focusSnapshot.length;
  const uniqueWordsCount = vocabProgress ? Object.keys(vocabProgress).length : 0;
  const mistakesCount = mistakeStats?.total || 0;

  return (
    <>
      {/* Collapsed Sidebar - Icon Bar (overlay with fit height) */}
      {!isOpen && (
        <div className="fixed right-2 top-20 w-12 bg-white dark:bg-gray-900 rounded-[40px] shadow-lg flex flex-col items-center py-2 gap-4 z-50">
          {/* Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="rounded-full h-8 w-8"
          >
            <PanelRightOpen className="w-4 h-4" />
          </Button>

          {/* Metrics Icons */}
          <div className="flex flex-col gap-3">
            {/* Focus Set */}
            <div className="relative flex items-center justify-center">
              <Target className="w-4 h-4 text-blue-500" />
              <Badge variant="secondary" className="absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center p-0 text-[10px]">
                {uncheckedWordsCount}
              </Badge>
            </div>

            {/* Unique Words */}
            <div className="relative flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <Badge variant="secondary" className="absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center p-0 text-[10px]">
                {uniqueWordsCount}
              </Badge>
            </div>

            {/* Mistakes */}
            <div className="relative flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <Badge variant="secondary" className="absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center p-0 text-[10px]">
                {mistakesCount}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Sidebar - Overlay (fixed position) */}
      {isOpen && (
        <div className="fixed right-2 top-20 bottom-2 w-80 bg-white dark:bg-gray-900 rounded-[20px] shadow-xl z-50 overflow-hidden">
          <div className="h-full overflow-y-auto p-3 space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Header with Close Button */}
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="font-semibold text-base">Real-Time Goals</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="rounded-full h-8 w-8"
              >
                <PanelRightClose className="w-4 h-4" />
              </Button>
            </div>

            {/* Focus Set Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-500" />
                <h4 className="font-medium text-sm">Focus Set</h4>
                <Badge variant="outline" className="ml-auto text-xs">
                  {focusWordsCount} / 5
                </Badge>
              </div>

              {loadingSnapshot ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : focusSnapshot && focusSnapshot.length > 0 ? (
                <div className="space-y-2">
                  {focusSnapshot.map(word => {
                    const progress = vocabProgress?.[word.lexeme_id];
                    const currentActivations = progress?.focus || 0;
                    const isActivated = currentActivations > 0;
                    const totalActivations = word.lesson_count || 0;

                    return (
                      <div
                        key={word.lexeme_id}
                        className={cn(
                          "p-2 rounded-lg border text-sm",
                          isActivated
                            ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                            : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{word.lemma}</span>
                          {word.cefr_level && (
                            <Badge variant="outline" className="text-xs h-5">
                              {word.cefr_level}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {[...Array(3)].map((_, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  i < totalActivations + currentActivations
                                    ? "bg-blue-500"
                                    : "bg-gray-300 dark:bg-gray-600"
                                )}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-gray-500">
                            {totalActivations + currentActivations}/3
                          </span>
                          {isActivated && (
                            <Badge variant="default" className="bg-green-500 text-xs ml-auto h-5">
                              +{currentActivations}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No Focus Set words</p>
              )}
            </div>

            {/* Vocabulary Used */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <h4 className="font-medium text-sm">Vocabulary</h4>
              </div>

              {loadingProgress ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    {uniqueWordsCount}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Unique words used
                  </p>
                </div>
              )}
            </div>

            {/* Mistakes Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <h4 className="font-medium text-sm">Mistakes</h4>
              </div>

              {loadingMistakes ? (
                <Skeleton className="h-12 w-full" />
              ) : mistakeStats && mistakeStats.total > 0 ? (
                <div className="space-y-2">
                  <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-2">
                    <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {mistakesCount}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Mistakes detected
                    </p>
                  </div>

                  {/* Recent Mistakes */}
                  <div className="space-y-2">
                    {mistakeStats.recent.map((mistake, idx) => {
                      const renderSentence = () => {
                        if (mistake.start_pos !== undefined && mistake.end_pos !== undefined) {
                          const before = mistake.original_text.slice(0, mistake.start_pos);
                          const highlighted = mistake.original_text.slice(mistake.start_pos, mistake.end_pos);
                          const after = mistake.original_text.slice(mistake.end_pos);
                          
                          return (
                            <>
                              {before}
                              <span className="bg-yellow-200 dark:bg-yellow-900/50 px-0.5 rounded">
                                {highlighted}
                              </span>
                              {after}
                            </>
                          );
                        }
                        return mistake.original_text;
                      };

                      return (
                        <div key={idx} className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-1.5">
                          {mistake.display_group && (
                            <Badge variant="outline" className="text-xs">
                              {mistake.display_group}
                            </Badge>
                          )}
                          
                          <div className="space-y-1">
                            <span className="text-gray-500 dark:text-gray-400 text-xs block">Sentence:</span>
                            <p className="text-gray-900 dark:text-gray-100 text-xs">
                              {renderSentence()}
                            </p>
                          </div>
                          
                          <div className="space-y-1">
                            <span className="text-gray-500 dark:text-gray-400 text-xs block">Suggestion:</span>
                            <p className="text-green-600 dark:text-green-400 font-medium text-xs">
                              {mistake.corrected_text}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">No mistakes detected</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
