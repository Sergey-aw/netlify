import { CheckCircle, XCircle, AlertTriangle, RotateCcw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { 
  SubmitWordPracticeResponse, 
  SubmitSentencePracticeResponse,
  PhonemeResult 
} from '@/types/pronunciation';
import { getScoreColor, getScoreCategory, ReadTypeLabels } from '@/types/pronunciation';
import { cn } from '@/lib/utils';

interface ResultsDisplayProps {
  result: SubmitWordPracticeResponse | SubmitSentencePracticeResponse;
  practiceType: 'word' | 'sentence';
  onRetry: () => void;
  onContinue: () => void;
  showContinue?: boolean;
}

export function ResultsDisplay({ 
  result, 
  practiceType, 
  onRetry, 
  onContinue,
  showContinue = true 
}: ResultsDisplayProps) {
  const score = result.pronunciationScore;
  const category = getScoreCategory(score);
  const isSentence = 'wordResults' in result;

  const getScoreBadgeColor = (score: number) => {
    if (score >= 85) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 70) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getReadTypeIcon = (readType: number) => {
    if (readType === 0) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (readType === 1) return <XCircle className="w-4 h-4 text-red-600" />;
    if (readType === 2) return <AlertTriangle className="w-4 h-4 text-orange-600" />;
    return <XCircle className="w-4 h-4 text-red-600" />;
  };

  const renderPhonemeCard = (phoneme: PhonemeResult, index: number) => (
    <div
      key={index}
      className={cn(
        "p-3 rounded-lg border-2",
        phoneme.score >= 60 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getReadTypeIcon(phoneme.readType)}
          <span className="font-mono text-lg font-semibold">{phoneme.phoneme}</span>
        </div>
        <Badge variant="outline" className={getScoreBadgeColor(phoneme.score)}>
          {phoneme.score}
        </Badge>
      </div>
      
      <div className="text-sm space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Status:</span>
          <span className="font-medium">{ReadTypeLabels[phoneme.readType as keyof typeof ReadTypeLabels]}</span>
        </div>
        
        {phoneme.soundLike && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Sounded like:</span>
            <span className="font-mono">{phoneme.soundLike}</span>
          </div>
        )}
        
        {phoneme.insertedBefore && phoneme.insertedBefore.length > 0 && (
          <div className="text-orange-600 text-xs">
            Added before: {phoneme.insertedBefore.join(', ')}
          </div>
        )}
        
        {phoneme.insertedAfter && phoneme.insertedAfter.length > 0 && (
          <div className="text-orange-600 text-xs">
            Added after: {phoneme.insertedAfter.join(', ')}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      {/* Overall Score Card */}
      <Card>
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold",
                category === 'excellent' && "bg-green-100 text-green-700",
                category === 'good' && "bg-blue-100 text-blue-700",
                category === 'fair' && "bg-yellow-100 text-yellow-700",
                category === 'poor' && "bg-red-100 text-red-700"
              )}
            >
              {score}
            </div>
          </div>
          <CardTitle className="text-2xl">
            {category === 'excellent' && '🎉 Excellent!'}
            {category === 'good' && '👍 Good Job!'}
            {category === 'fair' && '👌 Not Bad!'}
            {category === 'poor' && '💪 Keep Practicing!'}
          </CardTitle>
        </CardHeader>

        {isSentence && (
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{result.overallScore}</div>
                <div className="text-sm text-muted-foreground">Overall</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{result.fluencyScore}</div>
                <div className="text-sm text-muted-foreground">Fluency</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{result.integrityScore}</div>
                <div className="text-sm text-muted-foreground">Integrity</div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Phoneme Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Phoneme Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {practiceType === 'word' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {result.phonemes.map((phoneme, index) => renderPhonemeCard(phoneme, index))}
            </div>
          )}

          {isSentence && result.wordResults && (
            <div className="space-y-4">
              {result.wordResults.map((word, wordIndex) => (
                <div key={wordIndex} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-lg">{word.text}</h4>
                    <Badge variant="outline" className={getScoreBadgeColor(word.score)}>
                      {word.score}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {word.phonemes.map((phoneme, phonemeIndex) => renderPhonemeCard(phoneme, phonemeIndex))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onRetry}
          className="flex-1"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Try Again
        </Button>

        {showContinue && (
          <Button
            onClick={onContinue}
            className="flex-1"
          >
            Continue
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>

      {score < 85 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-900">
              <strong>Tip:</strong> {category === 'poor' && 'Focus on the sounds marked in red. Listen to the target pronunciation and practice slowly.'}
              {category === 'fair' && 'You\'re getting close! Pay attention to the mispronounced sounds and try to match the target pronunciation.'}
              {category === 'good' && 'Almost perfect! Just a bit more practice on those challenging sounds and you\'ll master them.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
