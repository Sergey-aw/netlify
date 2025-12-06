import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  MoreVertical,
  Plus,
  Sparkles,
  Mic,
  Send,
  AlertCircle,
  X,
  MessageCircle,
  BookOpen,
  Volume2,
  Bookmark,
  Languages,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import {
  mockCurrentUser,
  mockMessages,
} from '@/data/mockData';
import type { AIMessage } from '@/data/mockData';
import { cn } from '@/lib/utils';

// Helper function to highlight mistakes in text
const renderTextWithMistakes = (
  content: string,
  corrections?: Array<{ original: string; corrected: string; type?: string }>
) => {
  if (!corrections || corrections.length === 0) {
    return <span>{content}</span>;
  }

  const parts: Array<{ text: string; isMistake: boolean; correction?: string }> = [];
  let lastIndex = 0;

  // Sort corrections by their position in the text
  const sortedCorrections = [...corrections].sort((a, b) => {
    const aIndex = content.indexOf(a.original);
    const bIndex = content.indexOf(b.original);
    return aIndex - bIndex;
  });

  sortedCorrections.forEach((correction) => {
    const index = content.indexOf(correction.original, lastIndex);
    if (index !== -1) {
      // Add text before the mistake
      if (index > lastIndex) {
        parts.push({ text: content.substring(lastIndex, index), isMistake: false });
      }
      // Add the mistake
      parts.push({
        text: correction.original,
        isMistake: true,
        correction: correction.corrected,
      });
      lastIndex = index + correction.original.length;
    }
  });

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({ text: content.substring(lastIndex), isMistake: false });
  }

  return (
    <>
      {parts.map((part, index) =>
        part.isMistake ? (
          <span
            key={index}
            className="relative inline-block underline decoration-wavy decoration-red-500 decoration-2 underline-offset-2"
            title={`Correction: ${part.correction}`}
          >
            {part.text}
            <span className="inline-block ml-0.5 text-red-500">
              <AlertCircle className="w-3 h-3 inline" />
            </span>
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
};

export default function AIChatConversation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [messages, setMessages] = useState<AIMessage[]>(mockMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showAssessmentDialog, setShowAssessmentDialog] = useState(false);
  const [expandedTranslations, setExpandedTranslations] = useState<Set<string>>(new Set());
  const [showWordDrawer, setShowWordDrawer] = useState(false);
  const [selectedWord, setSelectedWord] = useState<{
    word: string;
    pronunciation: string;
    partOfSpeech: string;
    synonyms: string[];
    meaning: string;
    example: string;
  } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(180); // 3 minutes in seconds
  const [isRolePlay, setIsRolePlay] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if this is a role-play session
  useEffect(() => {
    if (location.state?.rolePlay) {
      setIsRolePlay(true);
    }
  }, [location.state]);

  // Timer for role-play sessions
  useEffect(() => {
    if (isRolePlay) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [isRolePlay]);

  // Format time as MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleBack = () => {
    if (isRolePlay && timeRemaining > 0) { // Timer still running
      setShowAssessmentDialog(true);
    } else {
      navigate(-1);
    }
  };

  const handleQuitRolePlay = () => {
    setShowAssessmentDialog(false);
    navigate(-1);
  };

  const handleContinueRolePlay = () => {
    setShowAssessmentDialog(false);
  };

  const handleWordClick = (word: string) => {
    // Mock word data - in real app, this would fetch from an API
    const wordData = {
      word: word,
      pronunciation: `['${word.toLowerCase()}]`,
      partOfSpeech: 'verb',
      synonyms: ['moving', 'traveling', 'departing', 'progressing', 'advancing'],
      meaning: 'To travel from one place to another.',
      example: `I am ${word} to the park with my friends.`,
    };
    
    setSelectedWord(wordData);
    setShowWordDrawer(true);
  };

  const handleSpeakMessage = (text: string) => {
    // Use Web Speech API to read the message
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const toggleTranslation = (messageId: string) => {
    setExpandedTranslations((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const getTranslation = (text: string) => {
    // Mock translation - in real app, this would call a translation API
    // Using user's native language from profile
    const nativeLanguage = mockCurrentUser.native_language || 'Russian';
    return `[Translated to ${nativeLanguage}]: ${text}`;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newUserMessage: AIMessage = {
      id: `msg_${Date.now()}`,
      conversation_id: id || 'new',
      role: 'user',
      content: input,
      created_at: new Date().toISOString(),
    };

    setMessages([...messages, newUserMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: AIMessage = {
        id: `msg_${Date.now() + 1}`,
        conversation_id: id || 'new',
        role: 'assistant',
        content: "That's a great question! Let me help you with that. In English, we often...",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
    }, 2000);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col page-enter">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <Avatar className="w-10 h-10">
              <AvatarFallback>🤖</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="font-semibold">
                {isRolePlay ? location.state?.rolePlay?.title || 'Role-play' : 'AI Teacher'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isTyping ? 'Typing...' : 'Online'}
              </p>
            </div>
          </div>
          
          {/* Timer for Role-play */}
          {isRolePlay && (
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-gray-200 rounded-full flex items-center gap-1">
                <span className="text-sm font-medium">{formatTimer(timeRemaining)}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          )}
          
          {!isRolePlay && (
            <Button variant="ghost" size="icon" className="rounded-full">
              <MoreVertical className="w-5 h-5" />
            </Button>
          )}
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-2',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {/* AI Avatar */}
            {message.role === 'assistant' && (
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback>🤖</AvatarFallback>
              </Avatar>
            )}

            {/* Message Bubble */}
            <div
              className={cn(
                'max-w-[75%] rounded-2xl px-4 py-3',
                message.role === 'user'
                  ? 'bg-gray-100 text-gray-900 rounded-br-sm'
                  : 'bg-white text-gray-900 rounded-bl-sm'
              )}
            >
              {message.role === 'assistant' ? (
                <>
                  <p className="text-base leading-relaxed whitespace-pre-wrap">
                    {message.content.split(' ').map((word, index) => (
                      <span key={index}>
                        <span
                          onClick={() => handleWordClick(word.replace(/[.,!?;:]/g, ''))}
                          className="cursor-pointer hover:bg-blue-100 hover:text-blue-700 rounded transition-colors"
                        >
                          {word}
                        </span>
                        {index < message.content.split(' ').length - 1 ? ' ' : ''}
                      </span>
                    ))}
                  </p>

                  {/* Translation Block */}
                  {expandedTranslations.has(message.id) && (
                    <div className="mt-3 pt-3 border-t border-gray-200 animate-in slide-in-from-top-2 fade-in duration-300">
                      <div className="flex items-start gap-2 mb-1">
                        <Languages className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm font-semibold text-gray-700">
                          Translation ({mockCurrentUser.native_language || 'Russian'}):
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-gray-600 pl-6">
                        {getTranslation(message.content)}
                      </p>
                    </div>
                  )}

                  {/* Action Icons Row */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSpeakMessage(message.content)}
                        className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-gray-100 transition-colors"
                        title="Listen to pronunciation"
                      >
                        <Volume2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => toggleTranslation(message.id)}
                        className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-gray-100 transition-colors"
                        title="Show translation"
                      >
                        <Languages className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                    {/* Timestamp */}
                    <p className="text-xs opacity-70">
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-base leading-relaxed whitespace-pre-wrap">
                    {renderTextWithMistakes(message.content, message.corrections)}
                  </p>

                  {/* Show corrected version underneath for user messages with mistakes */}
                  {message.corrections && message.corrections.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <div className="flex items-start gap-2 mb-1">
                        <AlertCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm font-semibold text-gray-700">
                          Corrected:
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-gray-600 pl-6">
                        {message.corrections.reduce((text, correction) => {
                          return text.replace(correction.original, correction.corrected);
                        }, message.content)}
                      </p>
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className="text-xs mt-2 opacity-70 text-right">
                    {formatTime(message.created_at)}
                  </p>
                </>
              )}
            </div>

            {/* Student Avatar */}
            {message.role === 'user' && (
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={mockCurrentUser.avatar_url} />
                <AvatarFallback>{mockCurrentUser.display_name?.[0]}</AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex gap-2 justify-start">
            <Avatar className="w-8 h-8">
              <AvatarFallback>🤖</AvatarFallback>
            </Avatar>
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <div
                  className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar - Fixed Bottom */}
      <div className="border-t px-4 py-3 bg-background">
        <div className="flex items-end gap-2">
          <Button variant="ghost" size="icon" className="rounded-full">
            <Plus className="w-5 h-5" />
          </Button>

          <div className="flex-1 flex items-end bg-muted rounded-3xl px-4 py-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 bg-transparent outline-none resize-none max-h-32 placeholder:text-muted-foreground"
              rows={1}
              style={{ minHeight: '24px' }}
            />

            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <Sparkles className="w-5 h-5" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/ai-chat/voice/new')}
            className="rounded-full"
          >
            <Mic className="w-5 h-5" />
          </Button>

          {input.trim() ? (
            <Button
              onClick={sendMessage}
              size="icon"
              className="rounded-full"
            >
              <Send className="w-5 h-5" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Assessment Drawer */}
      <Drawer open={showAssessmentDialog} onOpenChange={setShowAssessmentDialog}>
        <DrawerContent className="px-6 pb-6">
          {/* Assessment Badges */}
          <div className="space-y-3 mb-6 mt-6">
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
              <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-purple-700" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Vocabulary:</span>
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                    Intermediate 👌
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-green-700" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Grammar:</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    Upper-Intermediate 💪
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center mb-4">
            <h3 className="text-lg font-bold mb-2">
              Complete the Role-play to see feedback
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Get a detailed description with strengths and points for growth. 
              Completing the Role-play usually takes 5-10 minutes
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleContinueRolePlay}
              size="lg"
              className="w-full h-14 text-base font-semibold rounded-xl"
            >
              Continue Role-play
            </Button>
            <Button
              onClick={handleQuitRolePlay}
              variant="outline"
              size="lg"
              className="w-full h-14 text-base font-semibold rounded-xl border-2"
            >
              Quit Role-play
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Word Definition Drawer */}
      <Drawer open={showWordDrawer} onOpenChange={setShowWordDrawer}>
        <DrawerContent className="px-6 pb-6">
          {selectedWord && (
            <>
              {/* Word Header */}
              <div className="pt-6 pb-4 border-b">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-3xl font-bold capitalize">{selectedWord.word}</h2>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full bg-purple-100 hover:bg-purple-200 text-purple-700"
                      >
                        <Volume2 className="w-5 h-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full bg-purple-100 hover:bg-purple-200 text-purple-700"
                      >
                        <Bookmark className="w-5 h-5" />
                      </Button>
                    </div>
                    <p className="text-gray-500 text-sm">{selectedWord.pronunciation}</p>
                  </div>
                </div>
              </div>

              {/* Word Content */}
              <div className="py-4 space-y-6">
                {/* Part of Speech & Meaning */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="mb-3">
                    <Badge variant="secondary" className="bg-gray-200 text-gray-700 mb-3">
                      {selectedWord.partOfSpeech}
                    </Badge>
                  </div>
                  
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">Meaning</h3>
                    <p className="text-base">{selectedWord.meaning}</p>
                  </div>
                </div>

                {/* Synonyms */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">Synonyms</h3>
                  <p className="text-base">{selectedWord.synonyms.join(', ')}</p>
                </div>

                {/* Example */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">Example of usage</h3>
                  <p className="text-base">
                    {selectedWord.example.split(selectedWord.word).map((part, index, array) => (
                      <span key={index}>
                        {part}
                        {index < array.length - 1 && (
                          <span className="font-bold">{selectedWord.word}</span>
                        )}
                      </span>
                    ))}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mt-3 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-700"
                  >
                    <Volume2 className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
