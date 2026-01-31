import { useState } from 'react';
import { Mic, Target, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { startBaselineWorkout } from '@/services/pronunciationApi';
import { toast } from '@/hooks/use-toast';
import { BASELINE_SENTENCES_V1 } from '@/constants/baselineSentences';

interface BaselineIntroProps {
  studentId: string;
  onSessionCreated: (sessionId: string, items: any[]) => void;
}

export function BaselineIntro({ studentId, onSessionCreated }: BaselineIntroProps) {
  const [isStarting, setIsStarting] = useState(false);

  const handleStartBaseline = async () => {
    setIsStarting(true);
    try {
      const response = await startBaselineWorkout(studentId);
      console.group('🎯 Baseline Workout Started');
      console.log('Full API Response:', JSON.stringify(response, null, 2));
      console.log('Response keys:', Object.keys(response));
      console.log('Items count:', response.items?.length);
      console.log('First item raw:', JSON.stringify(response.items?.[0], null, 2));
      console.log('First item keys:', response.items?.[0] ? Object.keys(response.items[0]) : 'no item');
      console.log('First item has id?', !!response.items?.[0]?.id);
      console.log('First item has item_id?', !!(response.items?.[0] as any)?.item_id);
      console.log('First item has reference_sentence?', !!response.items?.[0]?.reference_sentence);
      
      // Ensure all items have reference_sentence and practice_type populated
      const itemsWithSentences = response.items.map((item, index) => {
        const hasSentence = !!item.reference_sentence;
        const hasType = !!item.practice_type;
        const hasId = !!item.id;
        
        // Check if API returns item_id instead of id
        const actualId = item.id || (item as any).item_id;
        
        console.log(`Item ${index + 1}: id ${hasId ? '✅' : '❌'} (${actualId}), sentence ${hasSentence ? '✅' : '❌'}, type ${hasType ? '✅' : '❌'}`, 
          hasSentence ? `"${item.reference_sentence.substring(0, 50)}..."` : 'MISSING');
        
        return {
          ...item,
          // Ensure id field is present (API might return item_id)
          id: actualId,
          // Fallback to predefined sentences if reference_sentence is missing
          reference_sentence: item.reference_sentence || BASELINE_SENTENCES_V1[index] || '',
          // Ensure practice_type is set to 'sentence' for baseline items
          practice_type: item.practice_type || 'sentence',
        };
      });
      
      console.log('Items after fallback:', itemsWithSentences.length);
      console.log('All items have sentences?', itemsWithSentences.every(i => !!i.reference_sentence));
      console.log('First item final:', itemsWithSentences[0]);
      console.groupEnd();
      
      toast({
        title: 'Baseline workout started!',
        description: `${itemsWithSentences.length} practice items ready.`,
      });
      onSessionCreated(response.session_id, itemsWithSentences);
    } catch (error) {
      console.error('Failed to start baseline:', error);
      toast({
        title: 'Failed to start baseline',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
         
          <CardTitle className="text-xl">Start Pronunciation Practice</CardTitle>
          <CardDescription className="text-sm mt-2">
            Improve your English pronunciation with personalized practice using JustTalk AI
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">How it works:</h3>
            
            <div className="flex items-start gap-3">
              <div className="bg-green-100 p-2 rounded-lg flex-shrink-0">
                <Target className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium">1. Baseline Assessment</h4>
                <p className="text-sm text-muted-foreground">
                  Read 10 sentences to identify which sounds you need to practice
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                <Mic className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium">2. Targeted Practice</h4>
                <p className="text-sm text-muted-foreground">
                  Practice specific phonemes with instant feedback
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-purple-100 p-2 rounded-lg flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium">3. Track Progress</h4>
                <p className="text-sm text-muted-foreground">
                  See your improvement over time and master challenging sounds
                </p>
              </div>
            </div>
          </div>

          {/* <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Tip:</strong> Find a quiet place and speak clearly into your microphone. 
              The assessment takes about 5-10 minutes.
            </p>
          </div> */}

          <Button
            onClick={handleStartBaseline}
            disabled={isStarting}
            size="lg"
            className="w-full bg-[hsl(var(--brand-blue))] hover:bg-[hsl(var(--brand-blue))]/90 text-white"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-2" />
                Start Assessment
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
