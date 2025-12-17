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
  Clock,
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
  // New structure: separate memory and language feedback
  memory?: {
    conversation_summary: string;
    emotional_notes: string;
    open_threads: string[];
    unlock_next_scenario: boolean;
  };
  language_feedback?: {
    score: number;
    label: string;
    diagnosis: string;
    improvement_instruction: string;
    example: {
      original: string;
      better: string;
    };
  };
  // Legacy structure for backwards compatibility
  scores?: Array<{
    category: string;
    score: number;
    maxScore: number;
  }>;
  advice?: Array<{
    category: string;
    feedback: string;
  }>;
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
  const [activeTab, setActiveTab] = useState<'snapshot' | 'vocabulary' | 'suggestions' | 'memory' | 'feedback'>('snapshot');

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      <DrawerContent className="px-6 pb-6 max-h-[85vh]">
        <DrawerHeader className="px-0">
          <DrawerTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
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
              <Button
                variant={activeTab === 'snapshot' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('snapshot')}
                className="whitespace-nowrap"
              >
                <Clock className="w-4 h-4 mr-1" />
                Summary
              </Button>
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
              {feedbackData.llmFeedback?.language_feedback && (
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
            {activeTab === 'snapshot' && (
              <div className="space-y-3">
                <Card className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <Clock className="w-4 h-4" />
                        Duration
                      </div>
                      <div className="text-2xl font-bold text-blue-600">
                        {formatDuration(feedbackData.snapshot.duration)}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <MessageSquare className="w-4 h-4" />
                        Turns
                      </div>
                      <div className="text-2xl font-bold text-purple-600">
                        {feedbackData.snapshot.turns}
                      </div>
                    </div>
                  </div>
                </Card>

                <div className="grid grid-cols-3 gap-2">
                  <Card className="p-3 text-center">
                    <div className="text-sm text-gray-600 mb-1">Total Words</div>
                    <div className="text-xl font-semibold">{feedbackData.snapshot.words}</div>
                  </Card>
                  <Card className="p-3 text-center bg-green-50">
                    <div className="text-sm text-gray-600 mb-1">You</div>
                    <div className="text-xl font-semibold text-green-700">
                      {feedbackData.snapshot.studentWords}
                    </div>
                  </Card>
                  <Card className="p-3 text-center bg-blue-50">
                    <div className="text-sm text-gray-600 mb-1">AI</div>
                    <div className="text-xl font-semibold text-blue-700">
                      {feedbackData.snapshot.aiWords}
                    </div>
                  </Card>
                </div>
              </div>
            )}

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
                    {goal.note && (
                      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                        {goal.note}
                      </p>
                    )}
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
                <Card className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-purple-600" />
                    Conversation Summary
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {feedbackData.llmFeedback.memory.conversation_summary}
                  </p>
                </Card>

                {feedbackData.llmFeedback.memory.emotional_notes && (
                  <Card className="p-4 bg-gradient-to-br from-pink-50 to-purple-50 border-pink-200">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <span className="text-lg">💭</span>
                      Emotional Notes
                    </h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {feedbackData.llmFeedback.memory.emotional_notes}
                    </p>
                  </Card>
                )}

                {feedbackData.llmFeedback.memory.open_threads && feedbackData.llmFeedback.memory.open_threads.length > 0 && (
                  <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <span className="text-lg">🧵</span>
                      Open Threads
                    </h4>
                    <ul className="space-y-2">
                      {feedbackData.llmFeedback.memory.open_threads.map((thread, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <ChevronRight className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <span>{thread}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {feedbackData.llmFeedback.memory.unlock_next_scenario && (
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

            {activeTab === 'feedback' && feedbackData.llmFeedback && (
              <div className="space-y-4">
                {/* New structured feedback */}
                {feedbackData.llmFeedback.language_feedback && (
                  <>
                    <Card className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-blue-600" />
                          Overall Score
                        </h4>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-blue-600">
                            {feedbackData.llmFeedback.language_feedback.score}
                          </div>
                          <div className="text-xs text-gray-600">out of 100</div>
                        </div>
                      </div>
                      <Badge 
                        variant="secondary"
                        className={cn(
                          'text-sm',
                          feedbackData.llmFeedback.language_feedback.score >= 80 ? 'bg-green-100 text-green-800' :
                          feedbackData.llmFeedback.language_feedback.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-orange-100 text-orange-800'
                        )}
                      >
                        {feedbackData.llmFeedback.language_feedback.label}
                      </Badge>
                    </Card>

                    <Card className="p-4 bg-gray-50">
                      <h4 className="font-semibold mb-2">Diagnosis</h4>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {feedbackData.llmFeedback.language_feedback.diagnosis}
                      </p>
                    </Card>

                    <Card className="p-4 bg-purple-50 border-purple-200">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        How to Improve
                      </h4>
                      <p className="text-sm text-gray-700 leading-relaxed mb-3">
                        {feedbackData.llmFeedback.language_feedback.improvement_instruction}
                      </p>
                      
                      <div className="space-y-2 mt-3 pt-3 border-t border-purple-200">
                        <div className="text-xs font-semibold text-purple-900 mb-1">Example:</div>
                        <div className="bg-red-50 border border-red-200 rounded p-2">
                          <div className="text-xs text-red-600 font-medium mb-1">❌ Original</div>
                          <p className="text-sm text-gray-700 italic">
                            "{feedbackData.llmFeedback.language_feedback.example.original}"
                          </p>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded p-2">
                          <div className="text-xs text-green-600 font-medium mb-1">✅ Better</div>
                          <p className="text-sm text-gray-700 italic">
                            "{feedbackData.llmFeedback.language_feedback.example.better}"
                          </p>
                        </div>
                      </div>
                    </Card>
                  </>
                )}

                {/* Legacy format for backwards compatibility */}
                {feedbackData.llmFeedback.scores && feedbackData.llmFeedback.advice && (
                  <>
                    {/* Scores */}
                    <div>
                      <h4 className="font-semibold mb-3">Performance Scores</h4>
                      <div className="space-y-3">
                        {feedbackData.llmFeedback.scores.map((score, idx) => (
                          <div key={idx}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium">{score.category}</span>
                              <span className="text-sm font-semibold">
                                {score.score}/{score.maxScore}
                              </span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full transition-all',
                                  score.score / score.maxScore >= 0.8
                                    ? 'bg-green-500'
                                    : score.score / score.maxScore >= 0.6
                                    ? 'bg-yellow-500'
                                    : 'bg-orange-500'
                                )}
                                style={{ width: `${(score.score / score.maxScore) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Advice */}
                    <div>
                      <h4 className="font-semibold mb-3">Personalized Advice</h4>
                      <div className="space-y-3">
                        {feedbackData.llmFeedback.advice.map((item, idx) => (
                      <Card key={idx} className="p-4 bg-purple-50 border-purple-200">
                        <div className="flex items-start gap-2">
                          <ChevronRight className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                          <ChevronRight className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-medium text-sm text-purple-900 mb-1">
                              {item.category}
                            </div>
                            <p className="text-sm text-gray-700">{item.feedback}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
                  </>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 sticky bottom-0 bg-white pb-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
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
