import { useState } from 'react';
import { Search, BookOpen, TrendingUp, Filter, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVocabularyBuilder } from '@/hooks/useVocabularyBuilder';
import { useVocabSets, useVocabSetWords } from '@/hooks/useVocabSets';
import { useLexemeSearch } from '@/hooks/useLexemeSearch';
import { cn } from '@/lib/utils';

type TabType = 'active' | 'discover';

export default function VocabularyBuilder() {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [cefrFilter, setCefrFilter] = useState<string | null>(null);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Fetch active words
  const {
    words,
    isLoading: isLoadingWords,
    stats,
    removeWord,
    bulkArchive,
    isBulkOperating,
  } = useVocabularyBuilder({
    filters: {
      search: searchQuery,
      cefr: cefrFilter || undefined,
      status: 'active', // Only show active words
    },
  });

  // Fetch vocabulary sets for Discover tab
  const { sets, isLoading: isLoadingSets } = useVocabSets();

  // Lexeme search
  const lexemeSearch = useLexemeSearch();

  const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  const toggleWordSelection = (wordId: string) => {
    const newSelection = new Set(selectedWords);
    if (newSelection.has(wordId)) {
      newSelection.delete(wordId);
    } else {
      newSelection.add(wordId);
    }
    setSelectedWords(newSelection);
  };

  const selectAll = () => {
    if (selectedWords.size === words.length) {
      setSelectedWords(new Set());
    } else {
      setSelectedWords(new Set(words.map(w => w.id)));
    }
  };

  const handleBulkArchive = async () => {
    await bulkArchive(Array.from(selectedWords));
    setSelectedWords(new Set());
  };

  const getCefrBadgeColor = (level: string | null) => {
    if (!level) return 'bg-gray-200 text-gray-700';
    const colors: Record<string, string> = {
      'A1': 'bg-green-100 text-green-700',
      'A2': 'bg-green-200 text-green-800',
      'B1': 'bg-blue-100 text-blue-700',
      'B2': 'bg-blue-200 text-blue-800',
      'C1': 'bg-purple-100 text-purple-700',
      'C2': 'bg-purple-200 text-purple-800',
    };
    return colors[level] || 'bg-gray-200 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 page-enter">
      {/* Header */}
      <header className="bg-white px-4 py-6 border-b sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Vocabulary Builder</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className="rounded-full"
          >
            <Filter className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('active')}
            className={cn(
              'flex-1 py-2 px-4 rounded-lg font-medium transition-colors',
              activeTab === 'active'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>Active</span>
              {stats && stats.activeWords > 0 && (
                <Badge className="bg-white text-blue-500">{stats.activeWords}</Badge>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('discover')}
            className={cn(
              'flex-1 py-2 px-4 rounded-lg font-medium transition-colors',
              activeTab === 'discover'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Discover</span>
            </div>
          </button>
        </div>

        {/* Search Bar - Only for Active tab */}
        {activeTab === 'active' && (
          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-3">
            <Search className="w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search words..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
            />
          </div>
        )}

        {/* Filters */}
        {showFilters && activeTab === 'active' && (
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">CEFR Level</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCefrFilter(null)}
                  className={cn(
                    'px-3 py-1 rounded-full text-sm font-medium transition-colors',
                    cefrFilter === null
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  )}
                >
                  All
                </button>
                {cefrLevels.map((level) => (
                  <button
                    key={level}
                    onClick={() => setCefrFilter(level)}
                    className={cn(
                      'px-3 py-1 rounded-full text-sm font-medium transition-colors',
                      cefrFilter === level
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto">
        {activeTab === 'active' ? (
          <ActiveTab
            words={words}
            isLoading={isLoadingWords}
            selectedWords={selectedWords}
            toggleWordSelection={toggleWordSelection}
            selectAll={selectAll}
            removeWord={removeWord}
            getCefrBadgeColor={getCefrBadgeColor}
          />
        ) : (
          <DiscoverTab
            sets={sets}
            isLoading={isLoadingSets}
            getCefrBadgeColor={getCefrBadgeColor}
            lexemeSearch={lexemeSearch}
          />
        )}
      </main>

      {/* Bulk Actions Bar */}
      {selectedWords.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg z-20">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {selectedWords.size} word{selectedWords.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedWords(new Set())}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkArchive}
                disabled={isBulkOperating}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Active Tab Component
interface ActiveTabProps {
  words: any[];
  isLoading: boolean;
  selectedWords: Set<string>;
  toggleWordSelection: (id: string) => void;
  selectAll: () => void;
  removeWord: (id: string) => void;
  getCefrBadgeColor: (level: string | null) => string;
}

function ActiveTab({
  words,
  isLoading,
  selectedWords,
  toggleWordSelection,
  selectAll,
  removeWord,
  getCefrBadgeColor,
}: ActiveTabProps) {
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading your vocabulary...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selection Controls */}
      {words.length > 0 && (
        <div className="flex items-center justify-between">
          <button
            onClick={selectAll}
            className="flex items-center gap-2 text-sm font-medium text-gray-700"
          >
            <div
              className={cn(
                'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                selectedWords.size === words.length
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-gray-300'
              )}
            >
              {selectedWords.size === words.length && (
                <Check className="w-3 h-3 text-white" />
              )}
            </div>
            <span>
              Select all ({words.length})
            </span>
          </button>
        </div>
      )}

      {/* Word Cards */}
      <div className="space-y-3">
        {words.map((word) => (
          <Card 
            key={word.id} 
            className={cn(
              "p-4 cursor-pointer transition-colors hover:bg-gray-50",
              selectedWords.has(word.id) && "bg-blue-50"
            )}
            onClick={() => toggleWordSelection(word.id)}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <div className="mt-1">
                <div
                  className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                    selectedWords.has(word.id)
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-gray-300'
                  )}
                >
                  {selectedWords.has(word.id) && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
              </div>

              {/* Word Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900">{word.lemma}</h3>
                  {word.cefr_level && (
                    <Badge className={cn('text-xs', getCefrBadgeColor(word.cefr_level))}>
                      {word.cefr_level}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {word.pos}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span>Used {word.usage_count}× in {word.lesson_count} lesson{word.lesson_count !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Actions */}
              {!selectedWords.has(word.id) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeWord(word.id);
                  }}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Remove
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {words.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No active words yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Start adding words from the Discover tab
          </p>
        </div>
      )}
    </div>
  );
}

// Discover Tab Component
interface DiscoverTabProps {
  sets: any[];
  isLoading: boolean;
  getCefrBadgeColor: (level: string | null) => string;
  lexemeSearch: any;
}

function DiscoverTab({ sets, isLoading, getCefrBadgeColor, lexemeSearch }: DiscoverTabProps) {
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
        getCefrBadgeColor={getCefrBadgeColor}
      />

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Curated Vocabulary Sets</h2>
        <p className="text-sm text-gray-600">
          Learn words organized by CEFR level and topic
        </p>
      </div>

      {sets.map((set) => (
        <VocabSetCard
          key={set.set_id}
          set={set}
          getCefrBadgeColor={getCefrBadgeColor}
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
  getCefrBadgeColor: (level: string | null) => string;
}

function VocabSetCard({ set, getCefrBadgeColor }: VocabSetCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{set.set_name}</h3>
            <Badge className={cn('text-xs', getCefrBadgeColor(set.set_type))}>
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
          <VocabSetDetails setId={set.set_id} getCefrBadgeColor={getCefrBadgeColor} />
        </div>
      )}
    </Card>
  );
}

// Vocab Set Details Component
interface VocabSetDetailsProps {
  setId: string;
  getCefrBadgeColor: (level: string | null) => string;
}

function VocabSetDetails({ setId, getCefrBadgeColor }: VocabSetDetailsProps) {
  const { words, isLoading, bulkAddWords, isAdding } = useVocabSetWords({
    setId,
    enabled: true,
  });

  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());

  const toggleWord = (lexemeId: string) => {
    const newSelection = new Set(selectedWords);
    if (newSelection.has(lexemeId)) {
      newSelection.delete(lexemeId);
    } else {
      newSelection.add(lexemeId);
    }
    setSelectedWords(newSelection);
  };

  const addSelectedWords = async () => {
    if (selectedWords.size > 0) {
      await bulkAddWords(Array.from(selectedWords), true);
      setSelectedWords(new Set());
    }
  };

  const toggleSelectAllUnacquired = () => {
    const unacquiredWords = words.filter(w => !w.is_acquired && !w.in_builder);
    const unacquiredIds = new Set(unacquiredWords.map(w => w.lexeme_id));
    
    // Check if all unacquired words are currently selected
    const allSelected = unacquiredWords.every(w => selectedWords.has(w.lexeme_id));
    
    if (allSelected) {
      // Deselect all unacquired words
      const newSelection = new Set(selectedWords);
      unacquiredIds.forEach(id => newSelection.delete(id));
      setSelectedWords(newSelection);
    } else {
      // Select all unacquired words
      setSelectedWords(new Set([...selectedWords, ...unacquiredIds]));
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
      {wordsNotInBuilder.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {unacquiredCount > 0 && (
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
            )}
            {selectedWords.size > 0 && (
              <Button
                onClick={addSelectedWords}
                disabled={isAdding}
                size="sm"
              >
                Add to Active
              </Button>
            )}
          </div>
        </div>
      )}

      {words.map((word) => (
        <div
          key={word.lexeme_id}
          className={cn(
            'flex items-center justify-between p-3 rounded-lg border transition-colors',
            word.in_builder ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300 cursor-pointer hover:bg-gray-50',
            !word.in_builder && selectedWords.has(word.lexeme_id) && 'bg-blue-50'
          )}
          onClick={() => !word.in_builder && toggleWord(word.lexeme_id)}
        >
          <div className="flex items-center gap-3 flex-1">
            {!word.in_builder && (
              <div>
                <div
                  className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                    selectedWords.has(word.lexeme_id)
                      ? 'bg-blue-500 border-blue-500'
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
                <span className="font-medium text-gray-900">{word.display_form}</span>
                {word.cefr_level && (
                  <Badge className={cn('text-xs', getCefrBadgeColor(word.cefr_level))}>
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
  getCefrBadgeColor: (level: string | null) => string;
}

function LexemeSearchSection({ lexemeSearch, getCefrBadgeColor }: LexemeSearchSectionProps) {
  const { searchTerm, setSearchTerm, results, isLoading, isSearching } = lexemeSearch;

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-4">Search Dictionary</h3>
      <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-3 mb-4">
        <Search className="w-5 h-5 text-gray-500" />
        <input
          type="text"
          placeholder="Type to search words..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
        />
      </div>

      {searchTerm.length > 0 && searchTerm.length < 2 && (
        <p className="text-sm text-gray-500">Type at least 2 characters to search</p>
      )}

      {isLoading && isSearching && (
        <p className="text-sm text-gray-500">Searching...</p>
      )}

      {isSearching && !isLoading && results.length === 0 && (
        <p className="text-sm text-gray-500">No words found</p>
      )}

      {isSearching && results.length > 0 && (
        <div className="space-y-2">
          {results.map((result: any) => (
            <LexemeSearchResult
              key={result.lexeme_id}
              result={result}
              getCefrBadgeColor={getCefrBadgeColor}
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
  getCefrBadgeColor: (level: string | null) => string;
}

function LexemeSearchResult({ result, getCefrBadgeColor }: LexemeSearchResultProps) {
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
    <div className="flex items-center justify-between p-3 rounded-lg border bg-white">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-gray-900">{result.lemma}</span>
          {result.cefr_level && (
            <Badge className={cn('text-xs', getCefrBadgeColor(result.cefr_level))}>
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
