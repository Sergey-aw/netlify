/**
 * Phase 6.7: Sentence Phoneme Results Display
 * Shows sentence-level calibration results with word-grouped IPA phoneme tiles
 * Matches reference design: accordion cards with color-coded tiles and scores
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Beaker, Code2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types for SpeechSuper Promax response
export interface PhonemeData {
  ipa: string;
  pronunciation?: number;
  readType?: number;
  stress?: number;
  tone?: number;
  ref_ipa?: string;
}

export interface WordData {
  text: string;
  overall?: number;
  pronunciation?: number;
  phonemes?: PhonemeData[];
  startTime?: number;
  endTime?: number;
}

export interface SentenceResultData {
  overall?: number;
  pronunciation?: number;
  fluency?: {
    overall?: number;
  };
  words?: WordData[];
}

export interface SentenceResult {
  sentenceIndex: number;
  sentenceText: string;
  sessionId: string;
  result?: SentenceResultData;
  debugData?: {
    rawPayload: Record<string, unknown> | null;
    hasWordData: boolean;
    wordCount: number;
    providerApi: string;
    dictType: string;
    dictDialect: string;
    calibratedAt: string;
  };
}

interface SentencePhonemeResultsProps {
  results: SentenceResult[];
  className?: string;
}

// Get color based on score
function getScoreColor(score: number | undefined): 'green' | 'yellow' | 'red' {
  if (score === undefined) return 'yellow';
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

// Get badge variant styling based on score
function getScoreBadgeClass(score: number | undefined): string {
  const color = getScoreColor(score);
  switch (color) {
    case 'green':
      return 'bg-green-500/10 text-green-600 border-green-500/40';
    case 'yellow':
      return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/40';
    case 'red':
      return 'bg-red-500/10 text-red-500 border-red-500/40';
  }
}

// Get phoneme tile background color
function getPhonemeTileClass(score: number | undefined): string {
  const color = getScoreColor(score);
  switch (color) {
    case 'green':
      return 'bg-green-500 text-white';
    case 'yellow':
      return 'bg-amber-400 text-white';
    case 'red':
      return 'bg-red-400 text-white';
  }
}

// Get score text color
function getScoreTextClass(score: number | undefined): string {
  const color = getScoreColor(score);
  switch (color) {
    case 'green':
      return 'text-green-600';
    case 'yellow':
      return 'text-amber-500';
    case 'red':
      return 'text-red-500';
  }
}

// Get readType description
function getReadTypeLabel(readType: number | undefined): string {
  switch (readType) {
    case 0: return 'Correct';
    case 1: return 'Insertion';
    case 2: return 'Repetition';
    case 3: return 'Deletion';
    case 4: return 'Pause';
    case 5: return 'Rush';
    case 6: return 'Substitution';
    default: return 'Unknown';
  }
}

// Single phoneme tile with score below
function PhonemeTile({ phoneme }: { phoneme: PhonemeData }) {
  const score = phoneme.pronunciation;
  const tileClass = getPhonemeTileClass(score);
  const scoreTextClass = getScoreTextClass(score);
  const hasError = phoneme.readType !== undefined && phoneme.readType !== 0;
  
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <div className="flex flex-col items-center gap-0.5 cursor-help">
          <div
            className={cn(
              'flex items-center justify-center rounded-md w-9 h-9',
              'font-medium text-sm',
              tileClass
            )}
          >
            {phoneme.ipa}
          </div>
          <span className={cn('text-xs font-medium', scoreTextClass)}>
            {score !== undefined ? `${score}%` : '—'}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1 py-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg">{phoneme.ipa}</span>
            {score !== undefined && (
              <Badge variant="outline" className="text-xs">
                {score}%
              </Badge>
            )}
          </div>
          {hasError && (
            <p className="text-xs text-destructive">
              Issue: {getReadTypeLabel(phoneme.readType)}
            </p>
          )}
          {phoneme.ref_ipa && phoneme.ref_ipa !== phoneme.ipa && (
            <p className="text-xs text-muted-foreground">
              Expected: {phoneme.ref_ipa}
            </p>
          )}
          {phoneme.stress !== undefined && phoneme.stress > 0 && (
            <p className="text-xs text-muted-foreground">
              Stress level: {phoneme.stress}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Word group with header and phoneme tiles
function WordPhonemeGroup({ word, isLast }: { word: WordData; isLast: boolean }) {
  const hasPhonemes = word.phonemes && word.phonemes.length > 0;
  
  if (!hasPhonemes) return null;
  
  return (
    <div className={cn(
      "flex flex-col gap-2",
      !isLast && "pr-4 border-r border-border/50"
    )}>
      <span className="text-sm font-medium text-foreground">
        {word.text}
      </span>
      <div className="flex gap-1.5">
        {word.phonemes!.map((phoneme, idx) => (
          <PhonemeTile key={idx} phoneme={phoneme} />
        ))}
      </div>
    </div>
  );
}

// Raw JSON display component (debug mode)
function RawPayloadDisplay({ payload, debugData }: { 
  payload: Record<string, unknown> | null;
  debugData?: SentenceResult['debugData'];
}) {
  if (!payload) return <p className="text-xs text-muted-foreground">No raw payload available</p>;
  
  return (
    <div className="space-y-2">
      <div className="max-h-64 overflow-auto bg-muted/50 rounded-md p-3">
        <pre className="text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>
      {debugData && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>API: {debugData.providerApi}</span>
          <span>•</span>
          <span>Dict: {debugData.dictType}/{debugData.dictDialect}</span>
          <span>•</span>
          <span>Words: {debugData.wordCount}</span>
        </div>
      )}
    </div>
  );
}

// Single sentence result card (accordion style)
function SentenceResultCard({ result }: { result: SentenceResult }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showRawPayload, setShowRawPayload] = useState(false);
  const hasWordData = result.result?.words && result.result.words.length > 0;
  const overallScore = result.result?.overall;
  
  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            {/* Sentence number circle */}
            <div className="flex items-center justify-center w-7 h-7 rounded-full border border-border text-sm font-medium text-muted-foreground">
              {result.sentenceIndex + 1}
            </div>
            <span className="text-sm font-medium text-foreground">
              {result.sentenceText}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Score badge */}
            {overallScore !== undefined && (
              <Badge 
                variant="outline"
                className={cn('text-sm font-medium px-3', getScoreBadgeClass(overallScore))}
              >
                {overallScore}%
              </Badge>
            )}
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            {/* Phoneme tiles grouped by word */}
            {hasWordData ? (
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex flex-wrap gap-4">
                  {result.result!.words!.map((word, idx) => (
                    <WordPhonemeGroup 
                      key={idx} 
                      word={word} 
                      isLast={idx === result.result!.words!.length - 1}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                No phoneme data available for this sentence
              </p>
            )}
            
            {/* Pronunciation score summary */}
            {result.result?.pronunciation !== undefined && (
              <div className="border-t pt-3">
                <span className="text-sm text-muted-foreground">
                  Pronunciation: {result.result.pronunciation}%
                </span>
              </div>
            )}

            {/* Raw payload toggle */}
            {result.debugData?.rawPayload && (
              <div className="border-t pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRawPayload(!showRawPayload);
                  }}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  Show Raw Payload
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                
                {showRawPayload && (
                  <div className="mt-3">
                    <RawPayloadDisplay 
                      payload={result.debugData.rawPayload} 
                      debugData={result.debugData}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function SentencePhonemeResults({ results, className }: SentencePhonemeResultsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (results.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <Card className={className}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CardHeader className="pb-3">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Beaker className="h-5 w-5 text-amber-500" />
                Phoneme-level score
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                  {results.length} sentences
                </Badge>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          
          <CollapsibleContent>
            <CardContent className="space-y-3">
              {/* Sentence result cards */}
              <div className="space-y-3">
                {results.map((result) => (
                  <SentenceResultCard key={result.sessionId} result={result} />
                ))}
              </div>

              {/* Info note */}
              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg mt-4">
                Hover or tap on any IPA symbol to see detailed score and error information.
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </TooltipProvider>
  );
}
