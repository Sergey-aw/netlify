/**
 * Phase 9: Baseline Workout Flow
 * Manages the 10-sentence baseline workout recording flow
 * Similar to PracticeSessionFlow but specifically for baseline
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Mic, Square, CheckCircle, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createWavRecorder } from '@/components/pronunciation/wavRecorder';
import { useBaselineWorkout, type BaselineWorkoutItem } from './hooks/useBaselineWorkout';
import { BaselineResultsScreen } from './BaselineResultsScreen';

interface BaselineWorkoutFlowProps {
  studentId: string;
  onClose: () => void;
  onComplete: () => void;
}

type FlowState = 
  | { type: 'loading' }
  | { type: 'recording'; currentIndex: number; items: BaselineWorkoutItem[] }
  | { type: 'submitting'; currentIndex: number; items: BaselineWorkoutItem[] }
  | { type: 'results' }
  | { type: 'error'; message: string };

interface RecordingResult {
  itemId: string;
  overallScore: number;
  pronunciationScore: number;
  fluencyScore: number;
  integrityScore: number;
}

export function BaselineWorkoutFlow({ studentId, onClose, onComplete }: BaselineWorkoutFlowProps) {
  const queryClient = useQueryClient();
  const { startBaselineWorkout, isStarting } = useBaselineWorkout(studentId);
  
  const [flowState, setFlowState] = useState<FlowState>({ type: 'loading' });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [results, setResults] = useState<RecordingResult[]>([]);
  
  const wavRecorderRef = useRef<ReturnType<typeof createWavRecorder> | null>(null);

  // Initialize baseline workout
  const initializeWorkout = useCallback(async () => {
    try {
      const workoutData = await startBaselineWorkout();
      setSessionId(workoutData.session_id);
      
      // Start from the first incomplete item
      const startIndex = workoutData.completed_items;
      setFlowState({
        type: 'recording',
        currentIndex: startIndex,
        items: workoutData.items,
      });
    } catch (error) {
      console.error('Failed to initialize baseline workout:', error);
      setFlowState({ type: 'error', message: 'Failed to start baseline workout' });
    }
  }, [startBaselineWorkout]);

  // Start initialization on mount
  useEffect(() => {
    initializeWorkout();
  }, [initializeWorkout]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      wavRecorderRef.current = createWavRecorder(stream, { targetSampleRate: 16000, numChannels: 1 });
      await wavRecorderRef.current.start();
      setIsRecording(true);
      setAudioBlob(null);
    } catch (err) {
      console.error('Failed to start recording:', err);
      toast.error('Could not access microphone. Please check permissions.');
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!isRecording || !wavRecorderRef.current) return;

    wavRecorderRef.current
      .stop()
      .then((blob) => {
        setAudioBlob(blob);
        setIsRecording(false);
      })
      .catch((e) => {
        console.error('Failed to stop recording:', e);
        toast.error('Recording failed. Please try again.');
        setIsRecording(false);
      });
  }, [isRecording]);

  // Submit recording for current item
  const submitRecording = useCallback(async () => {
    if (!audioBlob || flowState.type !== 'recording') return;
    
    const currentItem = flowState.items[flowState.currentIndex];
    if (!currentItem) return;

    setFlowState({
      type: 'submitting',
      currentIndex: flowState.currentIndex,
      items: flowState.items,
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const formData = new FormData();
      formData.append('practice_item_id', currentItem.item_id);
      formData.append('audio', audioBlob, 'baseline.wav');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pronunciation-submit-sentence-practice`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          body: formData
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit recording');
      }

      // Store result
      const newResult: RecordingResult = {
        itemId: currentItem.item_id,
        overallScore: result.overall_score ?? result.pronunciation_score ?? 0,
        pronunciationScore: result.pronunciation_score ?? 0,
        fluencyScore: result.fluency_score ?? 0,
        integrityScore: result.integrity_score ?? 0,
      };
      setResults(prev => [...prev, newResult]);
      setAudioBlob(null);

      // Check if workout is complete
      if (result.session_completed) {
        // Invalidate queries to refresh summary views
        queryClient.invalidateQueries({ queryKey: ['pronunciation-baseline-summary'] });
        queryClient.invalidateQueries({ queryKey: ['pronunciation-baseline-phoneme-stats'] });
        queryClient.invalidateQueries({ queryKey: ['pronunciation-calibration-status'] });
        queryClient.invalidateQueries({ queryKey: ['pronunciation-practice-candidates'] });
        
        setFlowState({ type: 'results' });
        return;
      }

      // Move to next item
      setFlowState({
        type: 'recording',
        currentIndex: flowState.currentIndex + 1,
        items: flowState.items,
      });

    } catch (error) {
      console.error('Failed to submit recording:', error);
      toast.error('Failed to submit. Please try again.');
      setFlowState({
        type: 'recording',
        currentIndex: flowState.currentIndex,
        items: flowState.items,
      });
    }
  }, [audioBlob, flowState, queryClient]);

  // Handle re-record
  const handleReRecord = useCallback(() => {
    setAudioBlob(null);
  }, []);

  // Render loading state
  if (flowState.type === 'loading' || isStarting) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Preparing your baseline workout...</p>
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (flowState.type === 'error') {
    return (
      <Card className="max-w-2xl mx-auto border-destructive/30 bg-destructive/5">
        <CardContent className="py-12 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-muted-foreground">{flowState.message}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={initializeWorkout}>Try Again</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render results screen
  if (flowState.type === 'results') {
    return (
      <BaselineResultsScreen
        studentId={studentId}
        onComplete={onComplete}
        onRetake={() => {
          setResults([]);
          initializeWorkout();
        }}
      />
    );
  }

  // Render recording/submitting state
  const { currentIndex, items } = flowState;
  const currentItem = items[currentIndex];
  const progress = ((currentIndex) / items.length) * 100;
  const isSubmitting = flowState.type === 'submitting';

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <Button variant="ghost" size="sm" onClick={onClose} className="w-fit -ml-2 mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Exit
        </Button>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            Baseline Workout
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {items.length}
          </span>
        </div>
        <Progress value={progress} className="mt-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sentence to read */}
        <div className="bg-muted/30 p-4 rounded-lg border">
          <p className="text-base leading-relaxed text-center">
            "{currentItem?.reference_sentence}"
          </p>
        </div>

        {/* Recording controls */}
        <div className="flex flex-col items-center gap-4">
          {!audioBlob ? (
            <>
              {!isRecording ? (
                <Button 
                  size="lg" 
                  onClick={startRecording}
                  className="h-16 w-16 rounded-full"
                  disabled={isSubmitting}
                >
                  <Mic className="h-8 w-8" />
                </Button>
              ) : (
                <Button 
                  size="lg" 
                  onClick={stopRecording}
                  variant="destructive"
                  className="h-16 w-16 rounded-full animate-pulse"
                >
                  <Square className="h-6 w-6" />
                </Button>
              )}
              <p className="text-sm text-muted-foreground">
                {isRecording ? 'Recording... Tap to stop' : 'Tap to record'}
              </p>
            </>
          ) : (
            <div className="space-y-4 w-full">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Recording complete</span>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleReRecord}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  Re-record
                </Button>
                <Button 
                  onClick={submitRecording}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
