import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter } from '@/components/ui/drawer';
import { Target, Play } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { PracticeCandidate } from '@/types/pronunciation';

interface TargetedPracticeStarterProps {
  practiceCandidates: PracticeCandidate[];
  onStartPractice: (targetPhonemes: string[]) => void;
}

export function TargetedPracticeStarter({ practiceCandidates, onStartPractice }: TargetedPracticeStarterProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // State to track selected phonemes (empty by default)
  const [selectedPhonemes, setSelectedPhonemes] = useState<Set<string>>(new Set());

  const handleStart = async () => {
    if (selectedPhonemes.size === 0) return;
    
    setIsStarting(true);
    try {
      const phonemesToPractice = Array.from(selectedPhonemes);
      await onStartPractice(phonemesToPractice);
      setIsDrawerOpen(false);
    } finally {
      setIsStarting(false);
    }
  };

  const togglePhoneme = (ipaSymbol: string) => {
    setSelectedPhonemes(prev => {
      const next = new Set(prev);
      if (next.has(ipaSymbol)) {
        next.delete(ipaSymbol);
      } else {
        // Limit to 2 selections
        if (next.size >= 2) {
          return prev;
        }
        next.add(ipaSymbol);
      }
      return next;
    });
  };

  const getPhonemeColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-200/30 border-red-300';
      case 'warning': return 'bg-amber-300/20 border-yellow-300';
      default: return 'bg-green-100 border-green-300';
    }
  };

  const getPhonemeExample = (ipa: string): string => {
    const examples: Record<string, string> = {
      'θ': 'th in "think"',
      'ð': 'th in "this"',
      'ɹ': 'r in "red"',
      'l': 'l in "light"',
      'w': 'w in "water"',
      'v': 'v in "voice"',
      'f': 'f in "fish"',
      'ʃ': 'sh in "ship"',
      'ʒ': 's in "measure"',
      'tʃ': 'ch in "chair"',
      'dʒ': 'j in "jump"',
      'æ': 'a in "cat"',
      'ɛ': 'e in "bed"',
      'ɪ': 'i in "bit"',
      'ʊ': 'oo in "book"',
      'ə': 'a in "about"',
      'ɔ': 'o in "dog"',
      'ɑ': 'a in "father"',
      'i': 'ee in "see"',
      'u': 'oo in "food"',
      'eɪ': 'a in "say"',
      'aɪ': 'i in "time"',
      'ɔɪ': 'oy in "boy"',
      'aʊ': 'ow in "how"',
      'oʊ': 'o in "go"'
    };
    return examples[ipa] || ipa;
  };

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-600" />
          Start Targeted Practice
        </CardTitle>
        <CardDescription>
          Focus on your challenging sounds to improve faster
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerTrigger asChild>
            <Button 
              size="lg" 
              className="w-full bg-[hsl(var(--brand-blue))] hover:bg-[hsl(var(--brand-blue))]/90 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Select Sounds to Practice
            </Button>
          </DrawerTrigger>
          <DrawerContent className="h-[85vh]">
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Select sounds to practice
              </DrawerTitle>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {/* Selection controls */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">Choose up to 2 sounds</p>
             
              </div>

              {/* Phonemes list - scrollable */}
              <div className="space-y-2 mb-4">
                {practiceCandidates.map((phoneme) => {
                  const isSelected = selectedPhonemes.has(phoneme.ipa_symbol);
                  const canSelect = selectedPhonemes.size < 2 || isSelected;
                  
                  return (
                    <div
                      key={phoneme.ipa_symbol}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border-2 transition-all",
                        isSelected ? "bg-gray-100 border-gray-400" : "bg-white border-gray-200",
                        canSelect ? "cursor-pointer hover:border-blue-400" : "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => canSelect && togglePhoneme(phoneme.ipa_symbol)}
                    >
                      <Checkbox
                        checked={isSelected}
                        className="border-slate-500 data-[state=checked]:bg-blue-400 data-[state=checked]:border-blue-400"
                        onCheckedChange={() => canSelect && togglePhoneme(phoneme.ipa_symbol)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={!canSelect}
                      />
                      <div className="flex items-center gap-3 flex-1">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          getPhonemeColor(phoneme.severity_bucket)
                        )}>
                          <span className="text-large font-mono font-semibold">
                            {phoneme.ipa_symbol}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{getPhonemeExample(phoneme.ipa_symbol)}</p>
                          <p className="text-sm text-muted-foreground">
                            {phoneme.total_occurrences} attempts • Avg: {(phoneme.avg_score || 0).toFixed(0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Info box */}
              {/* <div className="bg-blue-100 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>What to expect:</strong> You'll practice words and sentences 
                  containing these sounds with instant feedback on each attempt.
                </p>
              </div> */}
            </div>

            {/* Fixed footer with start button */}
            <DrawerFooter className="border-t pt-4">
              {selectedPhonemes.size > 0 && (
                <p className="text-sm text-muted-foreground text-center mb-2">
                  {selectedPhonemes.size} sound{selectedPhonemes.size !== 1 ? 's' : ''} selected
                </p>
              )}
              <Button
                onClick={handleStart}
                disabled={isStarting || selectedPhonemes.size === 0}
                size="lg"
                className="w-full bg-[hsl(var(--brand-blue))] hover:bg-[hsl(var(--brand-blue))]/90 text-white"
              >
                {isStarting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Generating Practice...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Practice Session
                  </>
                )}
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </CardContent>
    </Card>
  );
}
