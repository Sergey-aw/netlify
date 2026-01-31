import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Target, TrendingUp, Play } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { PracticeCandidate } from '@/types/pronunciation';

interface TargetedPracticeStarterProps {
  practiceCandidates: PracticeCandidate[];
  onStartPractice: (targetPhonemes: string[]) => void;
}

export function TargetedPracticeStarter({ practiceCandidates, onStartPractice }: TargetedPracticeStarterProps) {
  const [isStarting, setIsStarting] = useState(false);

  // Get top 5 phonemes (already filtered for critical/warning in the view)
  const targetPhonemes = practiceCandidates.slice(0, 5);

  // State to track selected phonemes (all selected by default)
  const [selectedPhonemes, setSelectedPhonemes] = useState<Set<string>>(
    new Set(targetPhonemes.map(p => p.ipa_symbol))
  );

  if (targetPhonemes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Excellent Work!
          </CardTitle>
          <CardDescription>
            You don't have any critical pronunciation issues. Great job!
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleStart = async () => {
    if (selectedPhonemes.size === 0) return;
    
    setIsStarting(true);
    try {
      const phonemesToPractice = Array.from(selectedPhonemes);
      await onStartPractice(phonemesToPractice);
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
        next.add(ipaSymbol);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedPhonemes(new Set(targetPhonemes.map(p => p.ipa_symbol)));
  };

  const deselectAll = () => {
    setSelectedPhonemes(new Set());
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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

      <CardContent className="space-y-6">
        {/* Selection controls */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Select sounds to practice:</h4>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              disabled={selectedPhonemes.size === targetPhonemes.length}
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={deselectAll}
              disabled={selectedPhonemes.size === 0}
            >
              Deselect All
            </Button>
          </div>
        </div>

        {/* Phonemes to practice */}
        <div className="space-y-3">
          {targetPhonemes.map((phoneme) => {
            const isSelected = selectedPhonemes.has(phoneme.ipa_symbol);
            return (
              <div
                key={phoneme.ipa_symbol}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:border-blue-400",
                  isSelected ? "bg-white border-blue-300" : "bg-gray-50 border-gray-200 opacity-60"
                )}
                onClick={() => togglePhoneme(phoneme.ipa_symbol)}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => togglePhoneme(phoneme.ipa_symbol)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex items-center justify-between flex-1">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      isSelected ? "bg-blue-100" : "bg-gray-100"
                    )}>
                      <span className={cn(
                        "text-xl font-mono font-bold",
                        isSelected ? "text-blue-900" : "text-gray-500"
                      )}>
                        /{phoneme.ipa_symbol}/
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{getPhonemeExample(phoneme.ipa_symbol)}</p>
                      <p className="text-xs text-muted-foreground">
                        Error rate: {phoneme.error_rate.toFixed(0)}% • 
                        {phoneme.total_occurrences} attempts • 
                        Avg: {(phoneme.avg_score || 0).toFixed(0)}/100
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={getSeverityColor(phoneme.severity_bucket)}
                  >
                    {phoneme.severity_bucket}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info box */}
        <div className="bg-blue-100 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>What to expect:</strong> You'll practice words and sentences 
            containing these sounds with instant feedback on each attempt.
          </p>
        </div>

        {/* Selection summary and start button */}
        <div className="space-y-3">
          {selectedPhonemes.size > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              {selectedPhonemes.size} sound{selectedPhonemes.size !== 1 ? 's' : ''} selected
            </p>
          )}
          <Button
            onClick={handleStart}
            disabled={isStarting || selectedPhonemes.size === 0}
            size="lg"
            className="w-full"
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
          {selectedPhonemes.size === 0 && (
            <p className="text-sm text-red-600 text-center">
              Please select at least one sound to practice
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
