import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Search, PanelLeft, Sparkles, TrendingUp, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useVocabularyBuilder } from '@/hooks/useVocabularyBuilder';
import { useVocabSets, useVocabSetWords } from '@/hooks/useVocabSets';
import { useLexemeSearch } from '@/hooks/useLexemeSearch';
import { useFocusSet } from '@/hooks/useFocusSet';
import { cn } from '@/lib/utils';
import { AppSidebar } from '@/components/AppSidebar';
import { supabase } from '@/lib/supabase';
import { FocusSummaryCards } from '@/components/vocabulary/FocusSummaryCards';
import { FocusSetSection } from '@/components/vocabulary/FocusSetSection';
import { GoalPoolSection } from '@/components/vocabulary/GoalPoolSection';
import { SwapFocusDialog } from '@/components/vocabulary/SwapFocusDialog';
import { getCefrLevelColor } from '@/lib/vocabulary-utils';
import { toast } from '@/hooks/use-toast';

type TabType = 'focus' | 'discover';

export default function VocabularyBuilder() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('focus');
  const [searchQuery] = useState('');
  const [selectedDiscoverWords, setSelectedDiscoverWords] = useState<Set<string>>(new Set());
  const [currentSetId, setCurrentSetId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [wordToSwap, setWordToSwap] = useState<{ id: string; lemma: string; cefr_level: string | null } | null>(null);

  // Add swipe gesture to open sidebar
  useSwipeGesture({
    onSwipeRight: () => {
      if (!showSidebar) {
        setShowSidebar(true);
      }
    },
    minSwipeDistance: 50,
    maxVerticalDistance: 100,
  });

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch Focus Set words (is_active_for_lessons = true, max 5)
  const {
    words: focusWords,
    isLoading: isFocusLoading,
    isFull: isFocusSetFull,
  } = useFocusSet();

  // Fetch Goal Pool words (non-Focus Set, unlimited)
  // Get all goals and filter out Focus Set words
  const allGoalsQuery = useVocabularyBuilder({
    filters: {
      search: searchQuery,
      status: 'all', // Get all non-archived goals
    },
  });

  // Filter out Focus Set words (those that are active)
  const goalPoolWords = allGoalsQuery.words.filter(w => !w.is_active_for_lessons);
  const isGoalPoolLoading = allGoalsQuery.isLoading;
  const toggleActive = allGoalsQuery.toggleActive;
  const isToggling = allGoalsQuery.isToggling;
  const swapFocus = allGoalsQuery.swapFocus;
  const isSwapping = allGoalsQuery.isSwapping;

  // Calculate vocabulary capacity (stable words)
  const vocabularyCapacity = focusWords.filter(w => w.is_stable).length;
  
  // Fetch vocabulary sets for Discover tab
  const { sets, isLoading: isLoadingSets } = useVocabSets();

  // Lexeme search
  const lexemeSearch = useLexemeSearch();

  const toggleDiscoverWordSelection = (lexemeId: string) => {
    const newSelection = new Set(selectedDiscoverWords);
    if (newSelection.has(lexemeId)) {
      newSelection.delete(lexemeId);
    } else {
      newSelection.add(lexemeId);
    }
    setSelectedDiscoverWords(newSelection);
  };

  const clearDiscoverSelection = () => {
    setSelectedDiscoverWords(new Set());
  };

  const handleAddToFocus = async (goalId: string, lemma: string, cefrLevel: string | null) => {
    if (isFocusSetFull) {
      // Show swap dialog
      setWordToSwap({ id: goalId, lemma, cefr_level: cefrLevel });
      setShowSwapDialog(true);
      return;
    }

    try {
      await toggleActive(goalId, true);
      toast({
        title: 'Added to Focus Set',
        description: 'Word will now earn progress during lessons',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add word to Focus Set',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveFromFocus = async (goalId: string) => {
    try {
      await toggleActive(goalId, false);
      toast({
        title: 'Removed from Focus Set',
        description: 'Word moved to Goal Pool. Progress preserved.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove word from Focus Set',
        variant: 'destructive',
      });
    }
  };

  const handleConfirmSwap = async (removeWordId: string) => {
    if (!wordToSwap) return;

    try {
      await swapFocus(removeWordId, wordToSwap.id);
      toast({
        title: 'Words swapped',
        description: `"${wordToSwap.lemma}" added to Focus Set`,
      });
      setShowSwapDialog(false);
      setWordToSwap(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to swap words',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24 page-enter">
      {/* Sidebar */}
      <AppSidebar open={showSidebar} onOpenChange={setShowSidebar} />

      {/* Header */}
      <header className="bg-white dark:bg-gray-900 px-4 py-6 border-b dark:border-gray-800 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            <PanelLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </Button>
          <h1 className="text-2xl font-bold flex-1 text-center text-gray-900 dark:text-gray-100">
            Vocabulary Builder
          </h1>
          <Avatar className="w-10 h-10 cursor-pointer" onClick={() => navigate('/profile')}>
            <AvatarImage src={user?.profile_photo_url} />
            <AvatarFallback>{user?.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('focus')}
            className={cn(
              'flex-1 py-2 px-4 rounded-lg font-medium transition-colors',
              activeTab === 'focus'
                ? 'bg-[hsl(var(--brand-blue))] text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Focus</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('discover')}
            className={cn(
              'flex-1 py-2 px-4 rounded-lg font-medium transition-colors',
              activeTab === 'discover'
                ? 'bg-[hsl(var(--brand-blue))] text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Discover</span>
            </div>
          </button>
        </div>

        {/* Search Bar - only show on Discover tab */}
        {activeTab === 'discover' && (
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-2">
            <Search className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <input
              type="text"
              placeholder="Type to search words..."
              value={lexemeSearch.searchTerm}
              onChange={(e) => lexemeSearch.setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>
        )}
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto">
        {activeTab === 'focus' ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <FocusSummaryCards vocabularyCapacity={vocabularyCapacity} />

            {/* Focus Set Section */}
            <FocusSetSection
              words={focusWords}
              isLoading={isFocusLoading}
              onRemove={handleRemoveFromFocus}
            />

            {/* Goal Pool Section */}
            <GoalPoolSection
              words={goalPoolWords}
              isLoading={isGoalPoolLoading}
              onAddToFocus={handleAddToFocus}
              isAdding={isToggling}
            />
          </div>
        ) : (
          <DiscoverTab
            sets={sets}
            isLoading={isLoadingSets}
            lexemeSearch={lexemeSearch}
            selectedDiscoverWords={selectedDiscoverWords}
            toggleDiscoverWordSelection={toggleDiscoverWordSelection}
            clearDiscoverSelection={clearDiscoverSelection}
            currentSetId={currentSetId}
            setCurrentSetId={setCurrentSetId}
          />
        )}
      </main>

      {/* Swap Focus Dialog */}
      <SwapFocusDialog
        open={showSwapDialog}
        onOpenChange={setShowSwapDialog}
        focusWords={focusWords}
        wordToAdd={wordToSwap}
        onConfirmSwap={handleConfirmSwap}
        isSwapping={isSwapping}
      />

      {/* Bottom Bar for Discover Tab - Hidden for now */}
      {/*activeTab === 'discover' && selectedDiscoverWords.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t dark:border-gray-800 px-4 py-3 shadow-lg z-20">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {selectedDiscoverWords.size} word{selectedDiscoverWords.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearDiscoverSelection}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[hsl(var(--brand-blue))] hover:bg-[hsl(var(--brand-blue))]/90"
              >
                Add to Builder
              </Button>
            </div>
          </div>
        </div>
      )*/}
    </div>
  );
}

// Discover Tab Component
interface DiscoverTabProps {
  sets: any[];
  isLoading: boolean;
  lexemeSearch: any;
  selectedDiscoverWords: Set<string>;
  toggleDiscoverWordSelection: (lexemeId: string) => void;
  clearDiscoverSelection: () => void;
  currentSetId: string | null;
  setCurrentSetId: (setId: string | null) => void;
}

function DiscoverTab({ 
  sets, 
  isLoading, 
  lexemeSearch,
  selectedDiscoverWords,
  toggleDiscoverWordSelection,
  setCurrentSetId
}: DiscoverTabProps) {
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading vocabulary sets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Lexeme Search Section at the top */}
      <LexemeSearchSection
        lexemeSearch={lexemeSearch}
      />

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Curated Vocabulary Sets</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Learn words organized by CEFR level and topic
        </p>
      </div>

      {sets.map((set) => (
        <VocabSetCard
          key={set.set_id}
          set={set}
          selectedDiscoverWords={selectedDiscoverWords}
          toggleDiscoverWordSelection={toggleDiscoverWordSelection}
          setCurrentSetId={setCurrentSetId}
        />
      ))}

      {sets.length === 0 && (
        <div className="text-center py-12">
          <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No sets available</h3>
          <p className="text-sm text-gray-500">
            Vocabulary sets will appear here
          </p>
        </div>
      )}
    </div>
  );
}

// Vocab Set Card Component
interface VocabSetCardProps {
  set: any;
  selectedDiscoverWords: Set<string>;
  toggleDiscoverWordSelection: (lexemeId: string) => void;
  setCurrentSetId: (setId: string | null) => void;
}

function VocabSetCard({ 
  set, 
  selectedDiscoverWords,
  toggleDiscoverWordSelection,
  setCurrentSetId
}: VocabSetCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{set.set_name}</h3>
            <Badge className={cn('text-xs', getCefrLevelColor(set.set_type))}>
              {set.set_type}
            </Badge>
          </div>
          <div className="mb-3">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${set.progress_percentage}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              {set.acquired_count}/{set.total_words} acquired ({Math.round(set.progress_percentage)}%)
            </p>
          </div>
        </div>
      </div>

      <Button
        onClick={() => setShowDetails(!showDetails)}
        variant="outline"
        size="sm"
        className="w-full"
      >
        {showDetails ? 'Hide Words' : `View ${set.total_words} Words`}
      </Button>

      {showDetails && (
        <div className="mt-4 pt-4 border-t">
          <VocabSetDetails 
            setId={set.set_id} 
            selectedWords={selectedDiscoverWords}
            toggleWord={toggleDiscoverWordSelection}
            setCurrentSetId={() => setCurrentSetId(set.set_id)}
          />
        </div>
      )}
    </Card>
  );
}

// Vocab Set Details Component
interface VocabSetDetailsProps {
  setId: string;
  selectedWords: Set<string>;
  toggleWord: (lexemeId: string) => void;
  setCurrentSetId: () => void;
}

function VocabSetDetails({ 
  setId, 
  selectedWords,
  toggleWord,
  setCurrentSetId
}: VocabSetDetailsProps) {
  const { words, isLoading } = useVocabSetWords({
    setId,
    enabled: true,
  });

  const toggleSelectAllUnacquired = () => {
    const unacquiredWords = words.filter(w => !w.is_acquired && !w.in_builder);
    const unacquiredIds = new Set(unacquiredWords.map(w => w.lexeme_id));
    
    // Check if all unacquired words are currently selected
    const allSelected = unacquiredWords.every(w => selectedWords.has(w.lexeme_id));
    
    // Update parent state by toggling each word
    unacquiredIds.forEach(id => {
      const isCurrentlySelected = selectedWords.has(id);
      if ((allSelected && isCurrentlySelected) || (!allSelected && !isCurrentlySelected)) {
        toggleWord(id);
      }
    });
    
    // Set this as the current set when selecting words
    if (!allSelected) {
      setCurrentSetId();
    }
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading words...</p>;
  }

  const wordsNotInBuilder = words.filter(w => !w.in_builder);
  const unacquiredWords = words.filter(w => !w.is_acquired && !w.in_builder);
  const unacquiredCount = unacquiredWords.length;
  const allUnacquiredSelected = unacquiredWords.length > 0 && 
    unacquiredWords.every(w => selectedWords.has(w.lexeme_id));

  return (
    <div className="space-y-3">
      {wordsNotInBuilder.length > 0 && unacquiredCount > 0 && (
        <div className="flex items-center justify-between mb-3">
          <Button
            onClick={toggleSelectAllUnacquired}
            variant="outline"
            size="sm"
          >
            {allUnacquiredSelected 
              ? `Deselect all (${unacquiredCount}) unacquired words`
              : `Select all (${unacquiredCount}) unacquired words`
            }
          </Button>
        </div>
      )}

      {words.map((word) => (
        <div
          key={word.lexeme_id}
          className={cn(
            'flex items-center justify-between p-3 rounded-lg border transition-colors',
            word.in_builder ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300 cursor-pointer hover:bg-gray-50',
            !word.in_builder && selectedWords.has(word.lexeme_id) && 'bg-[hsl(var(--brand-blue))]/10'
          )}
          onClick={() => {
            if (!word.in_builder) {
              toggleWord(word.lexeme_id);
              setCurrentSetId();
            }
          }}
        >
          <div className="flex items-center gap-3 flex-1">
            {!word.in_builder && (
              <div>
                <div
                  className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                    selectedWords.has(word.lexeme_id)
                      ? 'bg-[hsl(var(--brand-blue))] border-[hsl(var(--brand-blue))]'
                      : 'border-gray-300'
                  )}
                >
                  {selectedWords.has(word.lexeme_id) && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100">{word.display_form}</span>
                {word.cefr_level && (
                  <Badge className={cn('text-xs', getCefrLevelColor(word.cefr_level))}>
                    {word.cefr_level}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {word.part}
                </Badge>
              </div>
              {word.in_builder && (
                <p className="text-xs text-gray-500 mt-1">
                  {word.builder_status === 'active' ? '✓ In Active' : 'In Builder'}
                </p>
              )}
              {word.is_acquired && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ Acquired ({word.usage_count}× used)
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Lexeme Search Section
interface LexemeSearchSectionProps {
  lexemeSearch: any;
}

function LexemeSearchSection({ lexemeSearch }: LexemeSearchSectionProps) {
  const { searchTerm, results, isLoading, isSearching } = lexemeSearch;

  return (
    <div className="mb-6">
      {searchTerm.length > 0 && searchTerm.length < 2 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Type at least 2 characters to search</p>
      )}

      {isLoading && isSearching && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Searching...</p>
      )}

      {isSearching && !isLoading && results.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No words found</p>
      )}

      {isSearching && results.length > 0 && (
        <div className="space-y-2 mb-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">Search Results</h3>
          {results.map((result: any) => (
            <LexemeSearchResult
              key={result.lexeme_id}
              result={result}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Lexeme Search Result Component
interface LexemeSearchResultProps {
  result: any;
}

function LexemeSearchResult({ result }: LexemeSearchResultProps) {
  const { addWord, removeWord, isAdding } = useVocabularyBuilder();

  const handleAdd = () => {
    addWord(result.lexeme_id, result.lemma);
  };

  const handleRemove = () => {
    if (result.goal_id) {
      removeWord(result.goal_id);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-gray-900 dark:text-gray-100">{result.lemma}</span>
          {result.cefr_level && (
            <Badge className={cn('text-xs', getCefrLevelColor(result.cefr_level))}>
              {result.cefr_level}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {result.pos}
          </Badge>
        </div>
        {result.total_count > 0 ? (
          <p className="text-xs text-gray-500">
            Used {result.total_count}× in {result.lesson_count} lesson{result.lesson_count !== 1 ? 's' : ''}
          </p>
        ) : (
          <p className="text-xs text-gray-500">Not used yet</p>
        )}
      </div>
      <div>
        {result.is_in_goals ? (
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-700">
              {result.is_active_for_lessons ? '✓ Active' : 'In Builder'}
            </Badge>
            <Button
              onClick={handleRemove}
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
            >
              Remove
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleAdd}
            disabled={isAdding}
            size="sm"
          >
            + Add
          </Button>
        )}
      </div>
    </div>
  );
}

