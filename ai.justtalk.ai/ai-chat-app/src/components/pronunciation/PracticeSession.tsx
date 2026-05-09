import { useState, useEffect, useRef } from 'react';
import { Square, Loader2, Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AudioRecorder } from '@/lib/audioRecorder';
import { submitWordPractice, submitSentencePractice } from '@/services/pronunciationApi';
import type { PracticeItem, PracticeResult, SubmitWordPracticeResponse, SubmitSentencePracticeResponse } from '@/types/pronunciation';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useCompletePracticeSession } from '@/hooks/useCompletePracticeSession';

interface PracticeSessionProps {
  items: PracticeItem[];
  currentIndex: number;
  sessionId: string;
  existingResults?: Map<string, PracticeResult>;
  onComplete: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onExit: () => void;
}

type ResultType = SubmitWordPracticeResponse | SubmitSentencePracticeResponse | null;

export function PracticeSession({ items, currentIndex, sessionId, existingResults, onComplete, onNext, onPrevious, onExit }: PracticeSessionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ResultType>(null);
  // Initialize with existing results converted to ResultType format
  const [itemResults, setItemResults] = useState<Map<string, ResultType>>(() => {
    const map = new Map<string, ResultType>();
    if (existingResults) {
      existingResults.forEach((result, itemId) => {
        // Convert PracticeResult to ResultType format
        const resultData: any = {
          pronunciationScore: result.pronunciation_score,
          overallScore: result.overall_score,
          fluencyScore: result.fluency_score,
          integrityScore: result.integrity_score,
        };
        map.set(itemId, resultData as ResultType);
      });
      console.log('💾 Loaded', map.size, 'existing results into itemResults');
    }
    return map;
  });
  const [recordingTime, setRecordingTime] = useState(0);
  const [showingResult, setShowingResult] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const { mutateAsync: completeSession } = useCompletePracticeSession();
  
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  const currentItem = items[currentIndex];
  const progress = currentIndex; // 0-based for display
  const isLastItem = currentIndex === items.length - 1;

  // Debug log current item
  console.log('PracticeSession - Current item:', currentItem);
  console.log('PracticeSession - practice_type:', currentItem?.practice_type);
  console.log('PracticeSession - reference_sentence:', currentItem?.reference_sentence);
  console.log('PracticeSession - word_text:', currentItem?.word_text);

  // Safety check: ensure we have a valid current item
  if (!currentItem) {
    console.error('No current item available at index:', currentIndex);
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              No practice item available. Please restart the assessment.
            </p>
            <Button onClick={() => window.location.reload()}>
              Restart
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (audioRecorderRef.current) {
        audioRecorderRef.current.cleanup();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // Load saved result when switching items
  useEffect(() => {
    const savedResult = itemResults.get(currentItem.id);
    if (savedResult) {
      console.log('📋 Loading saved result for item:', currentItem.id, savedResult);
      setResult(savedResult);
      setShowingResult(true);
    } else {
      console.log('🆕 No saved result for item:', currentItem.id);
      setResult(null);
      setShowingResult(false);
    }
  }, [currentIndex, currentItem.id, itemResults]);

  const initializeRecorder = async () => {
    try {
      if (!audioRecorderRef.current) {
        audioRecorderRef.current = new AudioRecorder();
        await audioRecorderRef.current.initialize();
      }
    } catch (error) {
      console.error('Failed to initialize recorder:', error);
      toast({
        title: 'Microphone access denied',
        description: 'Please allow microphone access to practice pronunciation.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const startRecording = async () => {
    try {
      await initializeRecorder();
      audioRecorderRef.current!.startRecording();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = async () => {
    if (!audioRecorderRef.current) return;

    try {
      const audioBlob = await audioRecorderRef.current.stopRecording();
      setIsRecording(false);

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      // Submit audio
      await submitAudio(audioBlob);

    } catch (error) {
      console.error('Failed to stop recording:', error);
      toast({
        title: 'Recording failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      setIsRecording(false);
    }
  };

  const submitAudio = async (audioBlob: Blob) => {
    setIsSubmitting(true);
    console.log('🎤 Starting audio submission...');
    try {
      console.log('Submitting audio for item:', {
        id: currentItem.id,
        practice_type: currentItem.practice_type,
        has_reference_sentence: !!currentItem.reference_sentence
      });
      
      let response: ResultType;
      
      if (currentItem.practice_type === 'word') {
        console.log('📝 Calling submitWordPractice...');
        response = await submitWordPractice(currentItem.id, audioBlob);
      } else {
        console.log('📝 Calling submitSentencePractice...');
        response = await submitSentencePractice(currentItem.id, audioBlob);
      }

      console.log('✅ Raw API response:', response);
      console.log('✅ Score from response:', (response as any).pronunciation_score);

      // Save result to the map for this specific item
      setItemResults(prev => {
        const newMap = new Map(prev);
        newMap.set(currentItem.id, response);
        console.log('💾 Saved result for item:', currentItem.id, 'Total saved results:', newMap.size);
        return newMap;
      });

      setResult(response);
      setShowingResult(true);

      console.log('✅ State updated - result:', response);
      console.log('✅ State updated - showingResult: true');

      // Auto-continue after 3 seconds if score is good
      const score = (response as any).pronunciation_score;
      if (score >= 70) {
        console.log('⏱️ Auto-continue in 3 seconds...');
        setTimeout(() => {
          handleContinue();
        }, 3000);
      } else {
        console.log('⚠️ Score too low for auto-continue:', score);
      }

    } catch (error) {
      console.error('❌ Failed to submit audio:', error);
      console.error('Item that failed:', currentItem);
      toast({
        title: 'Submission failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      console.log('🏁 Submission complete, isSubmitting set to false');
    }
  };

  const handleRetry = () => {
    console.log('🔄 Retrying item:', currentItem.id);
    // Clear result for this specific item
    setItemResults(prev => {
      const newMap = new Map(prev);
      newMap.delete(currentItem.id);
      return newMap;
    });
    setResult(null);
    setShowingResult(false);
    setRecordingTime(0);
  };

  const handleContinue = async () => {
    setResult(null);
    setShowingResult(false);
    setRecordingTime(0);
    
    if (isLastItem) {
      // Mark session as complete in database before calling onComplete
      setIsCompleting(true);
      try {
        await completeSession(sessionId);
        toast({
          title: 'Session Complete!',
          description: 'Your practice session has been saved.',
        });
        onComplete();
      } catch (error) {
        console.error('Failed to complete session:', error);
        // Still call onComplete even if marking complete fails
        onComplete();
      } finally {
        setIsCompleting(false);
      }
    } else {
      onNext();
    }
  };

  // Utility functions for potential future use
  // const getScoreColor = (score: number) => {
  //   if (score >= 85) return 'text-green-600';
  //   if (score >= 70) return 'text-blue-600';
  //   if (score >= 60) return 'text-yellow-600';
  //   return 'text-red-600';
  // };

  // const getScoreBgColor = (score: number) => {
  //   if (score >= 85) return 'bg-green-50 border-green-200';
  //   if (score >= 70) return 'bg-blue-50 border-blue-200';
  //   if (score >= 60) return 'bg-yellow-50 border-yellow-200';
  //   return 'bg-red-50 border-red-200';
  // };

  // const getPhonemeIcon = (phoneme: PhonemeResult) => {
  //   if (phoneme.readType === 0) return <Check className="w-4 h-4 text-green-600" />;
  //   if (phoneme.readType === 2) return <X className="w-4 h-4 text-red-600" />;
  //   return <AlertCircle className="w-4 h-4 text-yellow-600" />;
  // };

  // const getPhonemeLabel = (phoneme: PhonemeResult) => {
  //   if (phoneme.readType === 0) return 'Correct';
  //   if (phoneme.readType === 1) return phoneme.soundLike ? `→ ${phoneme.soundLike}` : 'Mispronounced';
  //   if (phoneme.readType === 2) return 'Omitted';
  //   return 'Added';
  // };

  return (
    <div className="max-w-4xl mx-auto px-4 space-y-6">
      {/* Header with Back Button */}
      <button 
        onClick={onExit}
        className="flex items-center gap-2 text-lg font-semibold hover:opacity-70 transition-opacity"
      >
        <ArrowLeft className="w-5 h-5" />
        Exit Practice
      </button>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Progress</span>
          <span className="text-xl font-bold">{progress} / {items.length}</span>
        </div>
        <Progress value={(progress / items.length) * 100} className="h-2" />
      </div>

      {/* Main Practice Card */}
      <Card className="border-2">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Item {currentIndex + 1} of {items.length}</h3>
            <Badge variant="secondary" className="px-3 py-1 text-sm capitalize">
              {currentItem.practice_type}
            </Badge>
          </div>

          {/* Word/Sentence Display */}
          <div className="bg-muted/30 rounded-lg p-6 mb-4 text-center">
            {currentItem.practice_type === 'word' ? (
              <>
                <div className="text-5xl font-bold mb-3">{currentItem.word_text}</div>
                {currentItem.word_ipa && (
                  <div className="text-xl text-muted-foreground font-mono mb-3">
                    /{currentItem.word_ipa}/
                  </div>
                )}
                {currentItem.target_ipa_symbol && (
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-semibold">Target: {currentItem.target_ipa_symbol}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-xl leading-relaxed">
                "{currentItem.reference_sentence}"
              </div>
            )}
          </div>

          {/* Results Display (Inline) */}
          {(() => {
            console.log('🔍 Render check - showingResult:', showingResult, 'result:', result);
            return showingResult && result && (
              <div className="space-y-3 mb-4">
                {/* Score Display */}
                <div className="text-center py-2">
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <Check className="w-5 h-5" />
                    <span className="text-lg font-semibold">
                      Recorded (Score: {(result as any).pronunciation_score})
                    </span>
                  </div>
                </div>

                {/* Re-record Button */}
                <Button 
                  onClick={handleRetry} 
                  variant="default" 
                  className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white"
                >
                  Re-record
                </Button>
              </div>
            );
          })()}

          {/* Recording Button */}
          {!showingResult && (
            <div className="flex flex-col items-center gap-3">
              {isSubmitting ? (
                <div className="text-center py-6">
                  <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-3" />
                  <p className="font-semibold">Analyzing...</p>
                  <p className="text-xs text-muted-foreground mt-1">Processing your pronunciation</p>
                </div>
              ) : (
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isSubmitting}
                  size="lg"
                  className="w-full h-14"
                >
                  {isRecording ? (
                    <>
                      <Square className="w-4 h-4 mr-2" />
                      Stop Recording ({recordingTime}s)
                    </>
                  ) : (
                    <>Start Recording</>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          onClick={onPrevious}
          variant="outline"
          disabled={currentIndex === 0}
          className="px-6"
        >
          Previous
        </Button>
        <Button
          onClick={handleContinue}
          variant="outline"
          disabled={isCompleting}
          className="px-6"
        >
          {isCompleting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Completing...
            </>
          ) : isLastItem ? (
            'Finish'
          ) : (
            'Next'
          )}
        </Button>
      </div>

      {/* All Items Progress */}
      <div>
        <h4 className="text-sm text-muted-foreground mb-2">All Items</h4>
        <div className="flex flex-wrap gap-2">
          {items.map((item, idx) => {
            const hasResult = itemResults.has(item.id);
            return (
              <div
                key={idx}
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center text-base font-semibold border-2 transition-all",
                  idx === currentIndex
                    ? "bg-white text-foreground border-foreground ring-2 ring-offset-2 ring-foreground"
                    : hasResult
                    ? "bg-green-100 text-green-700 border-green-300"
                    : "bg-muted text-muted-foreground border-muted"
                )}
              >
                {hasResult ? <Check className="w-5 h-5" /> : idx + 1}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
