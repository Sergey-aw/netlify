import { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  MessageSquare,
  TrendingUp,
  BookOpen,
  Target,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConversationSnapshot {
  duration: number; // seconds
  turns: number;
  words: number;
  studentWords: number;
  aiWords: number;
}

export interface VocabularyGoalUsed {
  lemma: string;
  pos: string;
  usedCorrectly: boolean;
  context: string;
  note?: string;
}

export interface VocabularySuggestion {
  lemma: string;
  pos: string;
  reason: 'useful' | 'synonym';
  context?: string;
  overusedWord?: string;
}

export interface LLMFeedback {
  scores?: {
    clarity: {
      score: number;
      justification: string;
      supporting_quotes: string[];
    };
    range: {
      score: number;
      justification: string;
      supporting_quotes: string[];
    };
    flow: {
      score: number;
      justification: string;
      supporting_quotes: string[];
    };
    overall: number;
  };
  mistakes?: Array<{
    category: string;
    description: string;
    quote: string;
    correction: string;
    explanation: string;
  }>;
  patterns?: string[];
  vocabulary_level?: string;
  fluency_notes?: string[];
  memory?: {
    source?: string;
    extracted_at?: string;
    collected_data?: Array<{
      name: string;
      value: string;
      rationale: string;
    }>;
    call_successful?: string;
    next_stage_result?: string;
    transcript_summary?: string;
    next_stage_rationale?: string;
    conversation_timestamp?: string;
  };
}

export interface FeedbackData {
  snapshot: ConversationSnapshot;
  vocabularyGoals?: VocabularyGoalUsed[];
  vocabularySuggestions?: VocabularySuggestion[];
  llmFeedback?: LLMFeedback;
}

interface FeedbackDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  elevenLabsConvId: string | null;
  isLoading?: boolean;
  feedbackData?: FeedbackData | null;
  onContinue?: () => void;
  showContinuePrompt?: boolean; // Show "talk more to get insights"
}

export function FeedbackDrawer({
  open,
  onOpenChange,
  isLoading = false,
  feedbackData,
  onContinue,
  showContinuePrompt = false,
}: FeedbackDrawerProps) {
  const [activeTab, setActiveTab] = useState<'snapshot' | 'vocabulary' | 'suggestions' | 'memory' | 'evaluation' | 'feedback'>('feedback');

  // const formatDuration = (seconds: number) => {
  //   const mins = Math.floor(seconds / 60);
  //   const secs = seconds % 60;
  //   return `${mins}:${secs.toString().padStart(2, '0')}`;
  // };

  // Show "talk more" prompt if requested and no full feedback
  if (showContinuePrompt) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-6 pb-6">
          <div className="pt-6 pb-4 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Keep Going!</h3>
              <p className="text-gray-600 text-sm">
                Talk a bit more to unlock detailed insights about your conversation, including vocabulary
                analysis, pronunciation feedback, and personalized suggestions.
              </p>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                End Session
              </Button>
              {onContinue && (
                <Button
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600"
                  onClick={onContinue}
                >
                  Continue Talking
                </Button>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-6 pb-2 max-h-[85vh]">
        <DrawerHeader className="px-0">
          <DrawerTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Conversation Insights
          </DrawerTitle>
        </DrawerHeader>

        {isLoading ? (
          <div className="py-12 text-center space-y-6">
            {/* Animated Circle with rotating gradient */}
            <div className="relative w-24 h-24 mx-auto">
              {/* Rotating gradient ring */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-500 via-blue-500 to-purple-500 animate-spin" 
                   style={{ animationDuration: '2s' }}>
                <div className="absolute inset-2 rounded-full bg-white" />
              </div>
              {/* Center icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-purple-600 animate-pulse" />
              </div>
            </div>
            
            {/* Animated text */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">
                JustTalk AI is analyzing your conversation
              </h3>
              <div className="flex items-center justify-center gap-1">
                <span className="text-sm text-gray-600">Please wait</span>
                <span className="flex gap-0.5">
                  <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                </span>
              </div>
            </div>

            {/* Optional: Processing steps */}
            <div className="space-y-2 text-xs text-gray-500 max-w-xs mx-auto">
              <div className="flex items-center gap-2 animate-pulse" style={{ animationDelay: '0ms' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span>Analyzing vocabulary usage...</span>
              </div>
              <div className="flex items-center gap-2 animate-pulse" style={{ animationDelay: '400ms' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>Evaluating fluency and clarity...</span>
              </div>
              <div className="flex items-center gap-2 animate-pulse" style={{ animationDelay: '800ms' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span>Generating personalized feedback...</span>
              </div>
            </div>
          </div>
        ) : feedbackData ? (
          <div className="space-y-4 overflow-y-auto">
            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {feedbackData.llmFeedback?.memory && (
                <Button
                  variant={activeTab === 'memory' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('memory')}
                  className="whitespace-nowrap"
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Memory
                </Button>
              )}
              {feedbackData.llmFeedback?.memory?.next_stage_result && (
                <Button
                  variant={activeTab === 'evaluation' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('evaluation')}
                  className="whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Evaluation
                </Button>
              )}
              {feedbackData.llmFeedback?.scores && (
                <Button
                  variant={activeTab === 'feedback' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('feedback')}
                  className="whitespace-nowrap"
                >
                  <TrendingUp className="w-4 h-4 mr-1" />
                  Performance
                </Button>
              )}
              {feedbackData.vocabularyGoals && feedbackData.vocabularyGoals.length > 0 && (
                <Button
                  variant={activeTab === 'vocabulary' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('vocabulary')}
                  className="whitespace-nowrap"
                >
                  <Target className="w-4 h-4 mr-1" />
                  Goals ({feedbackData.vocabularyGoals.length})
                </Button>
              )}
              {feedbackData.vocabularySuggestions && feedbackData.vocabularySuggestions.length > 0 && (
                <Button
                  variant={activeTab === 'suggestions' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('suggestions')}
                  className="whitespace-nowrap"
                >
                  <BookOpen className="w-4 h-4 mr-1" />
                  Suggestions ({feedbackData.vocabularySuggestions.length})
                </Button>
              )}
            </div>

            {/* Tab Content */}
            {activeTab === 'vocabulary' && feedbackData.vocabularyGoals && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Words from your vocabulary goals that you used in this conversation:
                </p>
                {feedbackData.vocabularyGoals.map((goal, idx) => (
                  <Card key={idx} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">{goal.lemma}</span>
                          <Badge variant="secondary" className="text-xs">
                            {goal.pos}
                          </Badge>
                        </div>
                      </div>
                      {goal.usedCorrectly ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 italic mb-2">"{goal.context}"</p>
                   
                   {/* Goal note from Supabase grammar feedback json */}
                    {/* {goal.note && (
                      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                        {goal.note}
                      </p>
                    )} */}
                  </Card>
                ))}
              </div>
            )}

            {activeTab === 'suggestions' && feedbackData.vocabularySuggestions && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Words that could enhance your vocabulary:
                </p>
                {feedbackData.vocabularySuggestions.map((suggestion, idx) => (
                  <Card key={idx} className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-lg">{suggestion.lemma}</span>
                          <Badge variant="secondary" className="text-xs">
                            {suggestion.pos}
                          </Badge>
                        </div>
                        <div className="text-xs text-amber-700">
                          {suggestion.reason === 'useful'
                            ? '💡 Useful for this conversation'
                            : `🔄 Alternative to "${suggestion.overusedWord}"`}
                        </div>
                      </div>
                    </div>
                    {suggestion.context && (
                      <p className="text-sm text-gray-700 mt-2">
                        Example: "{suggestion.context}"
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {activeTab === 'memory' && feedbackData.llmFeedback?.memory && (
              <div className="space-y-4">
                {/* Conversation Summary */}
                {feedbackData.llmFeedback.memory.transcript_summary && (
                  <Card className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-purple-600" />
                      Conversation Summary
                    </h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {feedbackData.llmFeedback.memory.transcript_summary}
                    </p>
                  </Card>
                )}

                {/* Collected Data - Key Moments */}
                {feedbackData.llmFeedback.memory.collected_data && feedbackData.llmFeedback.memory.collected_data.length > 0 && (
                  <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <span className="text-lg">🎯</span>
                      Key Moments & Insights
                    </h4>
                    <div className="space-y-3">
                      {feedbackData.llmFeedback.memory.collected_data.map((item, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-blue-200">
                          <div className="font-medium text-sm text-gray-900 mb-1">
                            {item.name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                          </div>
                          {item.value && (
                            <div className="text-sm text-blue-700 font-medium mb-2">
                              {item.value}
                            </div>
                          )}
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {item.rationale}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Success Badge */}
                {feedbackData.llmFeedback.memory.next_stage_result === 'success' && (
                  <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                      <div>
                        <h4 className="font-semibold text-green-900">Ready for Next Step!</h4>
                        <p className="text-sm text-green-700">You've completed this scenario successfully.</p>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'evaluation' && feedbackData.llmFeedback?.memory && (
              <div className="space-y-4">
                {/* Evaluation Result Card */}
                <Card className={cn(
                  "p-4 border-2",
                  feedbackData.llmFeedback.memory.next_stage_result === 'success'
                    ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-300"
                    : "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300"
                )}>
                  <div className="flex items-start gap-3">
                    {feedbackData.llmFeedback.memory.next_stage_result === 'success' ? (
                      <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-8 h-8 text-amber-600 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-bold text-lg mb-2">
                        {feedbackData.llmFeedback.memory.next_stage_result === 'success'
                          ? '🎉 Scenario Complete!'
                          : '📝 Keep Practicing'}
                      </h4>
                      <Badge
                        variant={feedbackData.llmFeedback.memory.next_stage_result === 'success' ? 'default' : 'secondary'}
                        className={cn(
                          "mb-3",
                          feedbackData.llmFeedback.memory.next_stage_result === 'success'
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-amber-600 hover:bg-amber-700 text-white"
                        )}
                      >
                        {feedbackData.llmFeedback.memory.next_stage_result?.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </Card>

                {/* Rationale Card */}
                {feedbackData.llmFeedback.memory.next_stage_rationale && (
                  <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                      Evaluation Feedback
                    </h4>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {feedbackData.llmFeedback.memory.next_stage_rationale}
                    </p>
                  </Card>
                )}

                {/* Call Successful Status */}
                {feedbackData.llmFeedback.memory.call_successful && (
                  <Card className="p-3 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-700">Call Status:</span>
                      <Badge variant="secondary" className="bg-purple-100">
                        {feedbackData.llmFeedback.memory.call_successful}
                      </Badge>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'feedback' && feedbackData.llmFeedback && (
              <div className="space-y-4">
                {/* Overall Score */}
                {feedbackData.llmFeedback.scores && (
                  <Card className="p-5 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        Overall Score
                      </h4>
                      <div className="text-right">
                        <div className="text-4xl font-bold text-blue-600">
                          {feedbackData.llmFeedback.scores.overall}
                        </div>
                        <div className="text-xs text-gray-600">out of 3</div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Scores Breakdown */}
                {feedbackData.llmFeedback.scores && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-gray-700">Score Breakdown</h4>
                    
                    {/* Clarity */}
                    <Card className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">💡 Clarity</span>
                        <Badge variant="secondary" className="text-lg px-3">
                          {feedbackData.llmFeedback.scores.clarity.score}/3
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-3">
                        {feedbackData.llmFeedback.scores.clarity.justification}
                      </p>
                      {feedbackData.llmFeedback.scores.clarity.supporting_quotes.length > 0 && (
                        <div className="space-y-1 mt-2 pt-2 border-t">
                          <div className="text-xs font-medium text-gray-500">Examples:</div>
                          {feedbackData.llmFeedback.scores.clarity.supporting_quotes.map((quote, idx) => (
                            <div key={idx} className="text-xs italic text-gray-600 bg-gray-50 p-2 rounded">
                              "{quote}"
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                    {/* Range */}
                    <Card className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">🎨 Range</span>
                        <Badge variant="secondary" className="text-lg px-3">
                          {feedbackData.llmFeedback.scores.range.score}/3
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-3">
                        {feedbackData.llmFeedback.scores.range.justification}
                      </p>
                      {feedbackData.llmFeedback.scores.range.supporting_quotes.length > 0 && (
                        <div className="space-y-1 mt-2 pt-2 border-t">
                          <div className="text-xs font-medium text-gray-500">Examples:</div>
                          {feedbackData.llmFeedback.scores.range.supporting_quotes.map((quote, idx) => (
                            <div key={idx} className="text-xs italic text-gray-600 bg-gray-50 p-2 rounded">
                              "{quote}"
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                    {/* Flow */}
                    <Card className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">🌊 Flow</span>
                        <Badge variant="secondary" className="text-lg px-3">
                          {feedbackData.llmFeedback.scores.flow.score}/3
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-3">
                        {feedbackData.llmFeedback.scores.flow.justification}
                      </p>
                      {feedbackData.llmFeedback.scores.flow.supporting_quotes.length > 0 && (
                        <div className="space-y-1 mt-2 pt-2 border-t">
                          <div className="text-xs font-medium text-gray-500">Examples:</div>
                          {feedbackData.llmFeedback.scores.flow.supporting_quotes.map((quote, idx) => (
                            <div key={idx} className="text-xs italic text-gray-600 bg-gray-50 p-2 rounded">
                              "{quote}"
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>
                )}

                {/* Mistakes */}
                {feedbackData.llmFeedback.mistakes && feedbackData.llmFeedback.mistakes.length > 0 && (
                  <Card className="p-4 border-red-200 bg-red-50">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      Mistakes to Fix
                    </h4>
                    <div className="space-y-3">
                      {feedbackData.llmFeedback.mistakes.map((mistake, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-red-200">
                          <div className="flex items-start gap-2 mb-2">
                            <Badge variant="secondary" className="text-xs bg-red-100 text-red-800">
                              {mistake.category}
                            </Badge>
                            <span className="text-sm font-medium text-gray-900 flex-1">
                              {mistake.description}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="bg-red-50 border border-red-200 rounded p-2">
                              <div className="text-xs text-red-600 font-medium mb-1">❌ What you said:</div>
                              <p className="text-sm text-gray-700 italic">"{mistake.quote}"</p>
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded p-2">
                              <div className="text-xs text-green-600 font-medium mb-1">✅ Better:</div>
                              <p className="text-sm text-gray-700 italic">"{mistake.correction}"</p>
                            </div>
                            <p className="text-xs text-gray-600 mt-2">
                              💡 {mistake.explanation}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Patterns */}
                {feedbackData.llmFeedback.patterns && feedbackData.llmFeedback.patterns.length > 0 && (
                  <Card className="p-4 bg-amber-50 border-amber-200">
                    <h4 className="font-semibold mb-3">📊 Patterns in Your Speech</h4>
                    <ul className="space-y-2">
                      {feedbackData.llmFeedback.patterns.map((pattern, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <ChevronRight className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <span>{pattern}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* Vocabulary Level */}
                {feedbackData.llmFeedback.vocabulary_level && (
                  <Card className="p-4 bg-blue-50 border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold">Vocabulary Level</span>
                      </div>
                      <Badge className="bg-blue-600 text-white">
                        {feedbackData.llmFeedback.vocabulary_level.replace('-', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </Card>
                )}

                {/* Fluency Notes */}
                {feedbackData.llmFeedback.fluency_notes && feedbackData.llmFeedback.fluency_notes.length > 0 && (
                  <Card className="p-4 bg-purple-50 border-purple-200">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                      Fluency Observations
                    </h4>
                    <ul className="space-y-2">
                      {feedbackData.llmFeedback.fluency_notes.map((note, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <ChevronRight className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            )}

            {/* Actions */}
            {/* <div className="flex gap-3 pt-4 sticky bottom-0 bg-white pb-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div> */}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">
            No feedback data available
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
