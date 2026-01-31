/**
 * Phase 8.3: Sentence Practice Recorder Component
 * 
 * Recording UI for sentence practice attempts
 * Shows full sentence, word-by-word breakdown in results
 */

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Mic, 
  Square, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  ArrowLeft, 
  RotateCcw,
  MessageSquare,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { createWavRecorder } from './wavRecorder';
import { useSubmitSentencePractice, type SentencePracticeResult } from './hooks/useSubmitSentencePractice';
import type { PracticeItemProgress, ActivePracticeSession } from './types';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface SentencePracticeRecorderProps {
  item: PracticeItemProgress;
  session: ActivePracticeSession;
  onAttemptComplete?: (result: SentencePracticeResult) => void;
  onClose: () => void;
}

type RecordingState = 'idle' | 'recording' | 'submitting' | 'result';

export function SentencePracticeRecorder({ 
  item, 
  session, 
  onAttemptComplete, 
  onClose 
}: SentencePracticeRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [lastResult, setLastResult] = useState<SentencePracticeResult | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  
  const wavRecorderRef = useRef<ReturnType<typeof createWavRecorder> | null>(null);
  const submitMutation = useSubmitSentencePractice();

  const sentenceText = item.reference_sentence || '';

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      console.log('Starting WAV recording for sentence practice');
      wavRecorderRef.current = createWavRecorder(stream, { targetSampleRate: 16000, numChannels: 1 });
      await wavRecorderRef.current.start();
      setRecordingState('recording');
    } catch (err) {
      console.error('Failed to start recording:', err);
      toast.error('Could not access microphone. Please check permissions.');
    }
  }, []);

  // Stop recording and submit
  const stopRecording = useCallback(async () => {
    if (!wavRecorderRef.current) return;

    try {
      const blob = await wavRecorderRef.current.stop();
      wavRecorderRef.current = null;
      setRecordingState('submitting');

      // Submit immediately
      const result = await submitMutation.mutateAsync({
        practiceItemId: item.item_id,
        audioBlob: blob,
      });

      setLastResult(result);
      setRecordingState('result');
      onAttemptComplete?.(result);
    } catch (err) {
      console.error('Failed to submit sentence practice:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to submit practice');
      setRecordingState('idle');
    }
  }, [item.item_id, submitMutation, onAttemptComplete]);

  // Try again
  const handleRetry = useCallback(() => {
    setLastResult(null);
    setShowTechnicalDetails(false);
    setRecordingState('idle');
  }, []);

  // Score color based on result
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 border-green-500/30';
    if (score >= 60) return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="pb-3">
        <Button variant="ghost" size="sm" onClick={onClose} className="w-fit -ml-2 mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to list
        </Button>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-primary" />
          Practice Sentence
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Sentence display */}
        <div className="text-center py-4 bg-muted/30 rounded-lg border">
          <p className="text-lg font-medium px-4 leading-relaxed">{sentenceText}</p>
          {item.target_ipa_symbol && (
            <p className="text-xs text-primary mt-3">
              Focus: /{item.target_ipa_symbol}/
            </p>
          )}
        </div>

        {/* Recording controls */}
        {recordingState === 'idle' && (
          <div className="flex flex-col items-center gap-4">
            <Button 
              size="lg" 
              onClick={startRecording}
              className="h-20 w-20 rounded-full"
            >
              <Mic className="h-10 w-10" />
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Tap the microphone and read the sentence aloud
            </p>
            {item.attempt_count > 0 && (
              <p className="text-xs text-muted-foreground">
                Previous attempts: {item.attempt_count}
                {item.latest_score !== null && ` (last score: ${Math.round(item.latest_score)})`}
              </p>
            )}
          </div>
        )}

        {/* Recording state */}
        {recordingState === 'recording' && (
          <div className="flex flex-col items-center gap-4">
            <Button 
              size="lg" 
              onClick={stopRecording}
              variant="destructive"
              className="h-20 w-20 rounded-full animate-pulse"
            >
              <Square className="h-8 w-8" />
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Recording... Tap to stop when finished
            </p>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-red-500 font-medium">Recording</span>
            </div>
          </div>
        )}

        {/* Submitting state */}
        {recordingState === 'submitting' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Analyzing pronunciation...
            </p>
          </div>
        )}

        {/* Result state */}
        {recordingState === 'result' && lastResult && (
          <div className="space-y-4">
            {/* Score display */}
            <div className={cn(
              "text-center py-6 rounded-lg border",
              getScoreBgColor(lastResult.pronunciation_score)
            )}>
              <div className="flex items-center justify-center gap-2 mb-2">
                {lastResult.was_correct ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-600" />
                )}
              </div>
              <p className={cn(
                "text-4xl font-bold",
                getScoreColor(lastResult.pronunciation_score)
              )}>
                {Math.round(lastResult.pronunciation_score)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {lastResult.was_correct ? 'Great job!' : 'Keep practicing!'}
              </p>
            </div>

            {/* Word-by-word breakdown */}
            {lastResult.words && lastResult.words.length > 0 && (
              <div className="p-3 bg-muted/20 rounded-lg border">
                <p className="text-sm font-medium mb-2">Word Scores</p>
                <div className="flex flex-wrap gap-2">
                  {lastResult.words.map((word, index) => (
                    <div 
                      key={index}
                      className={cn(
                        "px-2 py-1 rounded text-sm",
                        word.score >= 80 ? "bg-green-500/20 text-green-700" :
                        word.score >= 60 ? "bg-amber-500/20 text-amber-700" :
                        "bg-red-500/20 text-red-700"
                      )}
                    >
                      <span className="font-medium">{word.text}</span>
                      <span className="ml-1 text-xs opacity-75">{Math.round(word.score)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attempt info */}
            <p className="text-xs text-center text-muted-foreground">
              Attempt #{lastResult.attempt_number}
            </p>

            {/* Technical Details Accordion */}
            {lastResult.raw_response && (
              <Collapsible open={showTechnicalDetails} onOpenChange={setShowTechnicalDetails}>
                <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <span>Technical Details</span>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    showTechnicalDetails && "rotate-180"
                  )} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-3 bg-muted/30 rounded-lg border overflow-x-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                      {JSON.stringify(lastResult.raw_response, null, 2)}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={handleRetry}
                className="flex-1"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button 
                onClick={onClose}
                className="flex-1"
              >
                {lastResult.was_correct ? 'Done' : 'Back to List'}
              </Button>
            </div>
          </div>
        )}

        {/* Session progress */}
        <div className="pt-2 border-t">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Session Progress</span>
            <span>{session.completed_items} / {session.total_items}</span>
          </div>
          <Progress value={session.progress_percent} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
