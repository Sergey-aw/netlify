import { useState } from 'react';
import { Search, Volume2, BookmarkPlus, BookmarkCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface WordEntry {
  word: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  isSaved: boolean;
}

const recentWords: WordEntry[] = [
  {
    word: 'eloquent',
    pronunciation: '/ˈel.ə.kwənt/',
    partOfSpeech: 'adjective',
    definition: 'Fluent or persuasive in speaking or writing',
    example: 'She gave an eloquent speech at the conference.',
    isSaved: false,
  },
  {
    word: 'persevere',
    pronunciation: '/ˌpɜr.səˈvɪr/',
    partOfSpeech: 'verb',
    definition: 'Continue in a course of action despite difficulty',
    example: 'You must persevere through the challenges.',
    isSaved: true,
  },
  {
    word: 'ambiguous',
    pronunciation: '/æmˈbɪɡ.ju.əs/',
    partOfSpeech: 'adjective',
    definition: 'Open to more than one interpretation; unclear',
    example: 'The instructions were ambiguous and confusing.',
    isSaved: false,
  },
];

export default function Dictionary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [words, setWords] = useState<WordEntry[]>(recentWords);

  const toggleSave = (word: string) => {
    setWords(words.map(w => 
      w.word === word ? { ...w, isSaved: !w.isSaved } : w
    ));
  };

  const playPronunciation = (word: string) => {
    console.log('Playing pronunciation for:', word);
    // In a real app, this would play audio
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 page-enter">
      {/* Header */}
      <header className="bg-white px-4 py-6 border-b">
        <h1 className="text-2xl font-bold mb-4">Dictionary</h1>
        
        {/* Search Bar */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-3">
          <Search className="w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search for words..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
          />
        </div>
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto">
        {/* Section Title */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {searchQuery ? 'Search Results' : 'Recently Learned'}
          </h2>
          <Button variant="ghost" size="sm">
            View All Saved
          </Button>
        </div>

        {/* Word Cards */}
        <div className="space-y-3">
          {words.map((entry) => (
            <Card key={entry.word} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-bold">{entry.word}</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => playPronunciation(entry.word)}
                    >
                      <Volume2 className="w-4 h-4 text-blue-600" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">
                      {entry.pronunciation}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {entry.partOfSpeech}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={() => toggleSave(entry.word)}
                >
                  {entry.isSaved ? (
                    <BookmarkCheck className="w-5 h-5 text-blue-600 fill-blue-600" />
                  ) : (
                    <BookmarkPlus className="w-5 h-5 text-gray-400" />
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm">{entry.definition}</p>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground italic">
                    "{entry.example}"
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {words.length === 0 && (
          <div className="text-center py-12">
            <BookmarkPlus className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No words found</h3>
            <p className="text-sm text-muted-foreground">
              Try searching for a different word
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
