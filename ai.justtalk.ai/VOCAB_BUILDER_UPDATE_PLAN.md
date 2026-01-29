# Vocabulary Builder Frontend Update Implementation Plan

**Branch**: `vocab_builder_2`  
**Date**: January 29, 2026  
**Status**: Planning Phase - No Changes Yet

---

## Executive Summary

This plan outlines the frontend-only updates needed to align the existing vocabulary builder UI with the new **Focus Set** system architecture. The Supabase database schema, RPCs, and edge functions are already in place and ready to use. We only need to update React components, hooks, and TypeScript interfaces.

---

## Current State Analysis

### What We Have ✅

**Database & Backend (Ready)**:
- ✅ `student_goals` table with `is_active_for_lessons` column
- ✅ `student_lexeme_history` with `lesson_count` and `focus_lesson_count`
- ✅ `lesson_active_goals_snapshot` for frozen Focus Set state
- ✅ `focus_activation_events` for state transitions
- ✅ RPCs: `get_vocabulary_builder_words`, `get_focus_set_for_lesson`, `get_weekly_focus_target`, `toggle_vocab_active_status`
- ✅ Edge functions: `vocab-ingest-segment` with Focus Set snapshot logic

**Frontend (Exists but needs updates)**:
- ✅ VocabularyBuilder page at [src/pages/VocabularyBuilder.tsx](ai-chat-app/src/pages/VocabularyBuilder.tsx)
- ✅ `useVocabularyBuilder` hook
- ✅ `useLexemeSearch` hook
- ✅ Basic Active/Discover tab structure
- ✅ Word cards with CEFR badges and usage stats

### What's Missing ❌

**Core Concepts Not Yet Implemented**:
- ❌ **Focus Set** (5-word limit) - Currently shows all "active" words without constraint
- ❌ **Goal Pool** (unlimited passive words) - Not visually separated from Focus Set
- ❌ **Activation Dots** (0-3 dots) - Not displayed (uses raw lesson_count)
- ❌ **Focus Points** - Not shown on cards
- ❌ **Weekly Focus Target** card - Missing completely
- ❌ **Vocabulary Capacity** card - Missing completely
- ❌ Empty slot placeholders for Focus Set
- ❌ Swap dialog for full Focus Set
- ❌ Remove from Focus confirmation dialog
- ❌ Stable word visual styling (green border)

**Missing Hooks**:
- ❌ `useFocusSet` - For unified Focus Set across all surfaces
- ❌ `useWeeklyFocusTarget` - For weekly points tracking
- ❌ `useActiveLessonGoals` - Might exist but needs verification

**Missing Components**:
- ❌ `FocusSetSection` - Main 5-slot grid
- ❌ `GoalPoolSection` - Unlimited passive words list
- ❌ `FocusSummaryCards` - Capacity + Weekly Target
- ❌ `FocusSlotNudge` - Empty slot CTA
- ❌ `FocusSwapDialog` - Swap UI when Focus Set is full
- ❌ `RemoveFromFocusDialog` - Removal confirmation
- ❌ `LiveGoalsPanel` - In-lesson Focus Set display
- ❌ `GoalsSummaryPanel` - Dashboard compact view
- ❌ `ActivationDots` - Reusable dot indicator component

---

## Implementation Plan

### Phase 1: Foundation - Update Interfaces & Utility Functions

**Goal**: Ensure TypeScript interfaces match the new data model

#### 1.1 Update `VocabularyBuilderWord` Interface

**File**: [ai-chat-app/src/lib/goals.ts](ai-chat-app/src/lib/goals.ts#L21-L40)

**Current**:
```typescript
export interface VocabularyBuilderWord {
  id: string;
  lexeme_id: string;
  lemma: string;
  pos: string;
  cefr_level: string | null;
  is_active_for_lessons: boolean;
  last_used_at: string | null;
  added_by_user_id: string | null;
  added_by_name: string | null;
  created_at: string;
  archived_at: string | null;
  usage_count: number;
  lesson_count: number;  // Global activation dots
  evidence_preview: Array<{ lesson_id: string; created_at: string; }>;
}
```

**Needs to Add**:
```typescript
export interface VocabularyBuilderWord {
  // ... existing fields ...
  focus_lesson_count: number;  // NEW: Points earned in Focus
  is_stable: boolean;          // NEW: Whether word is stabilized
  points_earned?: number;      // NEW: Points for this word this week (optional)
}
```

#### 1.2 Add New Interfaces

**File**: [ai-chat-app/src/lib/goals.ts](ai-chat-app/src/lib/goals.ts)

```typescript
// Focus Set specific interface
export interface FocusSetWord {
  id: string;
  lexeme_id: string;
  lemma: string;
  pos: string;
  cefr_level: string | null;
  lesson_count: number;         // Activation dots (0-3)
  focus_lesson_count: number;   // Focus points
  is_stable: boolean;
  priority_rank: number;
  last_used_at: string | null;
}

// Weekly Focus Target
export interface WeeklyFocusTarget {
  weekly_focus_points: number;
  weekly_focus_target: number;  // Default: 10
  week_start: string;
  week_end: string;
}

// Vocabulary Capacity
export interface VocabularyCapacity {
  stable_word_count: number;
}
```

#### 1.3 Create Utility Functions

**File**: [ai-chat-app/src/lib/utils.ts](ai-chat-app/src/lib/utils.ts) or new file `ai-chat-app/src/lib/vocabulary-utils.ts`

```typescript
/**
 * Get CEFR level color classes
 */
export function getCefrLevelColor(level: string | null): string {
  switch (level?.toUpperCase()) {
    case 'A1': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'A2': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'B1': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'B2': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
    case 'C1': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'C2': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
  }
}

/**
 * Calculate activation dot count (max 3)
 */
export function getActivationDotCount(lessonCount: number): number {
  return Math.min(lessonCount, 3);
}

/**
 * Get stabilization status
 */
export function isWordStable(lessonCount: number, focusLessonCount: number): boolean {
  return lessonCount >= 3 && focusLessonCount >= 3;
}
```

---

### Phase 2: Core Hooks - useFocusSet & useWeeklyFocusTarget

**Goal**: Create specialized hooks for Focus Set functionality

#### 2.1 Create `useFocusSet` Hook

**File**: `ai-chat-app/src/hooks/useFocusSet.ts` (NEW)

**Purpose**: Unified hook for fetching Focus Set across all surfaces (live or snapshot)

```typescript
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { FocusSetWord } from '@/lib/goals';

interface UseFocusSetOptions {
  studentId?: string;
  lessonId?: string;
  lessonStatus?: 'scheduled' | 'in_progress' | 'completed';
  enabled?: boolean;
}

export function useFocusSet(options: UseFocusSetOptions) {
  const { user } = useAuth();
  const effectiveStudentId = options.studentId || user?.id;

  const {
    data: words = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['focus-set', effectiveStudentId, options.lessonId, options.lessonStatus],
    queryFn: async () => {
      if (!effectiveStudentId) throw new Error('Student ID required');
      
      // Call RPC: get_focus_set_for_lesson
      const { data, error } = await supabase.rpc('get_focus_set_for_lesson', {
        student_uuid: effectiveStudentId,
        lesson_uuid: options.lessonId || null,
      });

      if (error) throw error;
      return (data || []) as FocusSetWord[];
    },
    enabled: options.enabled !== false && !!effectiveStudentId,
    staleTime: 30000,
  });

  const isSnapshot = options.lessonStatus === 'in_progress' || options.lessonStatus === 'completed';
  const emptySlots = Math.max(0, 5 - words.length);

  return {
    words,
    isLoading,
    error,
    refetch,
    isSnapshot,
    emptySlots,
  };
}
```

#### 2.2 Create `useWeeklyFocusTarget` Hook

**File**: `ai-chat-app/src/hooks/useWeeklyFocusTarget.ts` (NEW)

```typescript
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { WeeklyFocusTarget } from '@/lib/goals';

export function useWeeklyFocusTarget(studentId?: string) {
  const { user } = useAuth();
  const effectiveStudentId = studentId || user?.id;

  return useQuery({
    queryKey: ['weekly-focus-target', effectiveStudentId],
    queryFn: async () => {
      if (!effectiveStudentId) throw new Error('Student ID required');
      
      const { data, error } = await supabase.rpc('get_weekly_focus_target', {
        student_uuid: effectiveStudentId,
      });

      if (error) throw error;
      return data as WeeklyFocusTarget;
    },
    enabled: !!effectiveStudentId,
    staleTime: 60000, // 1 minute
  });
}
```

#### 2.3 Update `useVocabularyBuilder` Hook

**File**: [ai-chat-app/src/hooks/useVocabularyBuilder.ts](ai-chat-app/src/hooks/useVocabularyBuilder.ts)

**Changes Needed**:
- Add `swapFocus` mutation for atomic swap when Focus Set is full
- Update filters to separate Focus Set from Goal Pool
- Add invalidation for `focus-set` and `weekly-focus-target` queries

```typescript
// NEW: Swap mutation for atomic Focus Set swap
const swapFocusMutation = useMutation({
  mutationFn: async ({ 
    removeGoalId, 
    addGoalId 
  }: { 
    removeGoalId: string; 
    addGoalId: string; 
  }) => {
    // First, remove from Focus (set to false)
    await toggleVocabActiveStatus(removeGoalId, false);
    // Then, add to Focus (set to true)
    await toggleVocabActiveStatus(addGoalId, true);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['vocabulary-builder', effectiveStudentId] });
    queryClient.invalidateQueries({ queryKey: ['focus-set', effectiveStudentId] });
    queryClient.invalidateQueries({ queryKey: ['weekly-focus-target', effectiveStudentId] });
    toast({ title: 'Focus Set updated', description: 'Words swapped successfully' });
  },
  onError: (error: any) => {
    toast({ title: 'Error', description: 'Failed to swap words', variant: 'destructive' });
  },
});

// Export swapFocus method
return {
  // ... existing returns ...
  swapFocus: (removeGoalId: string, addGoalId: string) => 
    swapFocusMutation.mutate({ removeGoalId, addGoalId }),
  isSwapping: swapFocusMutation.isPending,
};
```

---

### Phase 3: UI Components - Building Blocks

**Goal**: Create reusable UI components for the Focus Set system

#### 3.1 Create `ActivationDots` Component

**File**: `ai-chat-app/src/components/vocabulary/ActivationDots.tsx` (NEW)

**Purpose**: Visual representation of global lesson_count (0-3 dots)

```tsx
import { cn } from '@/lib/utils';

interface ActivationDotsProps {
  count: number;
  max?: number;
  className?: string;
}

export function ActivationDots({ count, max = 3, className }: ActivationDotsProps) {
  const dotCount = Math.min(count, max);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-2 h-2 rounded-full transition-colors",
            i < dotCount 
              ? "bg-[hsl(var(--brand-blue))]" 
              : "bg-muted"
          )}
          aria-label={i < dotCount ? "Used" : "Not used"}
        />
      ))}
    </div>
  );
}
```

#### 3.2 Create `FocusSetCard` Component

**File**: `ai-chat-app/src/components/vocabulary/FocusSetCard.tsx` (NEW)

**Purpose**: Individual word card for Focus Set display

```tsx
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCefrLevelColor } from '@/lib/vocabulary-utils';
import { ActivationDots } from './ActivationDots';
import type { FocusSetWord } from '@/lib/goals';

interface FocusSetCardProps {
  word: FocusSetWord;
  onRemove?: () => void;
  isRemoving?: boolean;
}

export function FocusSetCard({ word, onRemove, isRemoving }: FocusSetCardProps) {
  return (
    <Card
      className={cn(
        "p-4 relative transition-all",
        word.is_stable && "border-green-500/50 bg-green-50/30 dark:bg-green-950/10"
      )}
    >
      {/* Remove button (top-right) */}
      {onRemove && !word.is_stable && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 text-gray-400 hover:text-red-600"
          onClick={onRemove}
          disabled={isRemoving}
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      {/* CEFR Badge */}
      {word.cefr_level && (
        <Badge className={cn("mb-2", getCefrLevelColor(word.cefr_level))}>
          {word.cefr_level}
        </Badge>
      )}

      {/* Word */}
      <h3 className="text-lg font-semibold text-gray-900 mb-3">
        {word.lemma}
      </h3>

      {/* Bottom row: Dots + Points */}
      <div className="flex items-center justify-between">
        <ActivationDots count={word.lesson_count} />
        
        {word.focus_lesson_count > 0 && (
          <span className="text-sm font-medium text-green-600">
            +{word.focus_lesson_count} pts
          </span>
        )}
      </div>

      {/* Stable indicator */}
      {word.is_stable && (
        <div className="mt-2 text-xs text-green-600 font-medium">
          ✓ Stable
        </div>
      )}
    </Card>
  );
}
```

#### 3.3 Create `EmptyFocusSlot` Component

**File**: `ai-chat-app/src/components/vocabulary/EmptyFocusSlot.tsx` (NEW)

```tsx
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function EmptyFocusSlot() {
  return (
    <Card className={cn(
      "p-4 border-dashed border-2 border-muted",
      "flex items-center justify-center h-[120px]"
    )}>
      <span className="text-muted-foreground text-sm">Empty</span>
    </Card>
  );
}
```

#### 3.4 Create `FocusSetSection` Component

**File**: `ai-chat-app/src/components/vocabulary/FocusSetSection.tsx` (NEW)

**Purpose**: Main 5-slot Focus Set grid

```tsx
import { FocusSetCard } from './FocusSetCard';
import { EmptyFocusSlot } from './EmptyFocusSlot';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import type { FocusSetWord } from '@/lib/goals';

interface FocusSetSectionProps {
  words: FocusSetWord[];
  isLoading: boolean;
  onRemoveFromFocus?: (goalId: string) => void;
  isRemoving?: boolean;
  maxFocusSlots?: number;
}

export function FocusSetSection({
  words,
  isLoading,
  onRemoveFromFocus,
  isRemoving,
  maxFocusSlots = 5,
}: FocusSetSectionProps) {
  const emptySlots = Math.max(0, maxFocusSlots - words.length);

  if (isLoading) {
    return <div className="text-center py-6 text-gray-500">Loading Focus Set...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">
          Focus Set ({words.length}/{maxFocusSlots})
        </h2>
        <p className="text-sm text-gray-600">
          Only words in your Focus Set earn progress during lessons
        </p>
      </div>

      {/* Empty slots warning */}
      {emptySlots > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {emptySlots} open Focus slot{emptySlots > 1 ? 's' : ''} — choose words to practice from your Goal Pool below
          </AlertDescription>
        </Alert>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {words.map((word) => (
          <FocusSetCard
            key={word.id}
            word={word}
            onRemove={onRemoveFromFocus ? () => onRemoveFromFocus(word.id) : undefined}
            isRemoving={isRemoving}
          />
        ))}
        
        {/* Empty slots */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <EmptyFocusSlot key={`empty-${i}`} />
        ))}
      </div>
    </div>
  );
}
```

#### 3.5 Create `GoalPoolSection` Component

**File**: `ai-chat-app/src/components/vocabulary/GoalPoolSection.tsx` (NEW)

**Purpose**: Display unlimited passive goals with "Add to Focus" action

```tsx
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCefrLevelColor } from '@/lib/vocabulary-utils';
import { ActivationDots } from './ActivationDots';
import type { VocabularyBuilderWord } from '@/lib/goals';

interface GoalPoolSectionProps {
  words: VocabularyBuilderWord[];
  isLoading: boolean;
  onAddToFocus: (goalId: string) => void;
  onArchive: (goalId: string) => void;
  isAdding?: boolean;
}

export function GoalPoolSection({
  words,
  isLoading,
  onAddToFocus,
  onArchive,
  isAdding,
}: GoalPoolSectionProps) {
  if (isLoading) {
    return <div className="text-center py-6 text-gray-500">Loading Goal Pool...</div>;
  }

  if (words.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Goal Pool is empty</h3>
        <p className="text-sm text-gray-500">
          Add words from the Discover tab
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">
          Goal Pool ({words.length})
        </h2>
        <p className="text-sm text-gray-600">
          Words you want to learn but aren't actively tracking
        </p>
      </div>

      <div className="space-y-2">
        {words.map((word) => (
          <Card key={word.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{word.lemma}</span>
                    {word.cefr_level && (
                      <Badge className={getCefrLevelColor(word.cefr_level)}>
                        {word.cefr_level}
                      </Badge>
                    )}
                    <Badge variant="outline">{word.pos}</Badge>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <ActivationDots count={word.lesson_count} />
                    <span>
                      Used {word.usage_count}× in {word.lesson_count} lesson{word.lesson_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onArchive(word.id)}
                >
                  Archive
                </Button>
                <Button
                  size="sm"
                  onClick={() => onAddToFocus(word.id)}
                  disabled={isAdding}
                >
                  Add to Focus
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

### Phase 4: Dialogs & Interactions

**Goal**: Handle Focus Set constraints and user interactions

#### 4.1 Create `FocusSwapDialog` Component

**File**: `ai-chat-app/src/components/vocabulary/FocusSwapDialog.tsx` (NEW)

**Purpose**: Swap dialog when Focus Set is full (5 words)

```tsx
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { getCefrLevelColor } from '@/lib/vocabulary-utils';
import { ActivationDots } from './ActivationDots';
import type { FocusSetWord } from '@/lib/goals';

interface FocusSwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusWords: FocusSetWord[];
  newWordLemma: string;
  onConfirmSwap: (wordIdToRemove: string) => void;
  isSwapping?: boolean;
}

export function FocusSwapDialog({
  open,
  onOpenChange,
  focusWords,
  newWordLemma,
  onConfirmSwap,
  isSwapping,
}: FocusSwapDialogProps) {
  const [selectedWordId, setSelectedWordId] = useState<string>('');

  const handleConfirm = () => {
    if (selectedWordId) {
      onConfirmSwap(selectedWordId);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Focus Set Full</DialogTitle>
          <DialogDescription>
            Your Focus Set is at capacity (5 words). Choose a word to pause to make room for "{newWordLemma}".
            <br /><br />
            Progress on paused words is preserved.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={selectedWordId} onValueChange={setSelectedWordId}>
          <div className="space-y-2">
            {focusWords.map((word) => (
              <div
                key={word.id}
                className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-gray-50 cursor-pointer"
              >
                <RadioGroupItem value={word.id} id={word.id} />
                <Label htmlFor={word.id} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{word.lemma}</span>
                    {word.cefr_level && (
                      <Badge className={getCefrLevelColor(word.cefr_level)} size="sm">
                        {word.cefr_level}
                      </Badge>
                    )}
                    <ActivationDots count={word.lesson_count} />
                  </div>
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSwapping}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedWordId || isSwapping}
          >
            {isSwapping ? 'Swapping...' : 'Confirm Swap'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### 4.2 Create `RemoveFromFocusDialog` Component

**File**: `ai-chat-app/src/components/vocabulary/RemoveFromFocusDialog.tsx` (NEW)

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface RemoveFromFocusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wordLemma: string;
  onConfirm: () => void;
  isRemoving?: boolean;
}

export function RemoveFromFocusDialog({
  open,
  onOpenChange,
  wordLemma,
  onConfirm,
  isRemoving,
}: RemoveFromFocusDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove from Focus?</AlertDialogTitle>
          <AlertDialogDescription>
            Remove "{wordLemma}" from your Focus Set?
            <br /><br />
            Your progress will be saved. You can add it back to Focus anytime from your Goals.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isRemoving}>
            {isRemoving ? 'Removing...' : 'Remove'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

### Phase 5: Summary Cards

**Goal**: Display Vocabulary Capacity and Weekly Focus Target

#### 5.1 Create `FocusSummaryCards` Component

**File**: `ai-chat-app/src/components/vocabulary/FocusSummaryCards.tsx` (NEW)

```tsx
import { Card } from '@/components/ui/card';
import { BookMarked, Target, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { useWeeklyFocusTarget } from '@/hooks/useWeeklyFocusTarget';

interface FocusSummaryCardsProps {
  studentId?: string;
  vocabularyCapacity: number;
}

export function FocusSummaryCards({ studentId, vocabularyCapacity }: FocusSummaryCardsProps) {
  const { data: weeklyTarget, isLoading } = useWeeklyFocusTarget(studentId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {/* Vocabulary Capacity Card */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <BookMarked className="w-5 h-5 text-[hsl(var(--brand-blue))]" />
          <h3 className="font-semibold text-gray-900">Vocabulary Capacity</h3>
        </div>
        <div className="text-3xl font-bold text-[hsl(var(--brand-blue))] mb-1">
          {vocabularyCapacity}
        </div>
        <p className="text-sm text-gray-600">stable words</p>
        <p className="text-xs text-gray-500 mt-2">Lifetime mastered vocabulary</p>
      </Card>

      {/* Weekly Focus Target Card */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">Weekly Focus Target</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                Only Focus words earn weekly progress
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {isLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : weeklyTarget ? (
          <>
            <div className="mb-2">
              <Progress 
                value={(weeklyTarget.weekly_focus_points / weeklyTarget.weekly_focus_target) * 100} 
                className="h-3"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">
                {weeklyTarget.weekly_focus_points} / {weeklyTarget.weekly_focus_target} pts
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Points earned this week • Resets Monday
            </p>
          </>
        ) : (
          <div className="text-sm text-gray-500">No data</div>
        )}
      </Card>
    </div>
  );
}
```

---

### Phase 6: Refactor VocabularyBuilder Page

**Goal**: Reorganize page to show Focus Set + Goal Pool clearly

#### 6.1 Update Page Structure

**File**: [ai-chat-app/src/pages/VocabularyBuilder.tsx](ai-chat-app/src/pages/VocabularyBuilder.tsx)

**Key Changes**:

1. **Separate Focus Set from Goal Pool**:
   - Fetch Focus Set using `useFocusSet()` 
   - Fetch Goal Pool (passive words) using `useVocabularyBuilder({ filters: { status: 'passive' } })`

2. **Add Summary Cards**:
   - Import and render `<FocusSummaryCards />`
   - Calculate `vocabularyCapacity` from stable words

3. **Replace Active Tab Content**:
   - Remove current `<ActiveTab>` component
   - Add `<FocusSummaryCards />`
   - Add `<FocusSetSection />` with 5-slot grid
   - Add `<GoalPoolSection />` with unlimited passive words

4. **Handle Add to Focus Logic**:
   - Check if Focus Set has < 5 words
   - If yes: Call `toggleActive(goalId, true)`
   - If no: Open `<FocusSwapDialog>` to choose word to swap

5. **Handle Remove from Focus**:
   - Open `<RemoveFromFocusDialog>`
   - On confirm: Call `toggleActive(goalId, false)`

**Updated Structure**:

```tsx
// Focus Tab
{activeTab === 'focus' ? (
  <>
    {/* Summary Cards */}
    <FocusSummaryCards 
      vocabularyCapacity={stableWordCount}
    />

    {/* Focus Set Section */}
    <FocusSetSection
      words={focusWords}
      isLoading={isFocusLoading}
      onRemoveFromFocus={handleRemoveFromFocus}
      isRemoving={isToggling}
    />

    {/* Goal Pool Section */}
    <GoalPoolSection
      words={passiveWords}
      isLoading={isPassiveLoading}
      onAddToFocus={handleAddToFocus}
      onArchive={handleArchive}
      isAdding={isToggling}
    />

    {/* Dialogs */}
    <FocusSwapDialog
      open={swapDialogOpen}
      onOpenChange={setSwapDialogOpen}
      focusWords={focusWords}
      newWordLemma={selectedWordForSwap?.lemma || ''}
      onConfirmSwap={handleSwapConfirm}
      isSwapping={isSwapping}
    />

    <RemoveFromFocusDialog
      open={removeDialogOpen}
      onOpenChange={setRemoveDialogOpen}
      wordLemma={selectedWordForRemoval?.lemma || ''}
      onConfirm={handleRemovalConfirm}
      isRemoving={isToggling}
    />
  </>
) : (
  // Discover Tab (keep existing)
  <DiscoverTab ... />
)}
```

---

### Phase 7: Additional Components (Optional)

**Goal**: Create components for other surfaces

#### 7.1 Create `LiveGoalsPanel` Component

**File**: `ai-chat-app/src/components/lessons/LiveGoalsPanel.tsx` (NEW)

**Purpose**: Display Focus Set during active lessons

```tsx
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';
import { useFocusSet } from '@/hooks/useFocusSet';
import { getCefrLevelColor } from '@/lib/vocabulary-utils';
import { ActivationDots } from '@/components/vocabulary/ActivationDots';

interface LiveGoalsPanelProps {
  lessonId: string;
  studentId: string;
  lessonStatus?: 'scheduled' | 'in_progress' | 'completed';
  className?: string;
}

export function LiveGoalsPanel({
  lessonId,
  studentId,
  lessonStatus,
  className,
}: LiveGoalsPanelProps) {
  const { words, isLoading, isSnapshot } = useFocusSet({
    studentId,
    lessonId,
    lessonStatus,
  });

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  if (words.length === 0) {
    return (
      <Card className={className}>
        <div className="p-4 text-center">
          <p className="text-sm text-gray-500">No Focus words set</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-[hsl(var(--brand-blue))]" />
          <h3 className="font-semibold">Focus Words</h3>
          {isSnapshot && (
            <Badge variant="outline" className="text-xs">Snapshot</Badge>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Track these words during speech
        </p>

        <div className="space-y-2">
          {words.map((word) => (
            <div
              key={word.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{word.lemma}</span>
                {word.cefr_level && (
                  <Badge className={getCefrLevelColor(word.cefr_level)} size="sm">
                    {word.cefr_level}
                  </Badge>
                )}
              </div>
              <ActivationDots count={word.lesson_count} />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
```

#### 7.2 Create `GoalsSummaryPanel` for Dashboard

**File**: `ai-chat-app/src/components/goals/GoalsSummaryPanel.tsx` (NEW)

**Purpose**: Compact Focus Set display on student dashboard

```tsx
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFocusSet } from '@/hooks/useFocusSet';
import { getCefrLevelColor } from '@/lib/vocabulary-utils';
import { ActivationDots } from '@/components/vocabulary/ActivationDots';
import { EmptyFocusSlot } from '@/components/vocabulary/EmptyFocusSlot';

interface GoalsSummaryPanelProps {
  studentId?: string;
}

export function GoalsSummaryPanel({ studentId }: GoalsSummaryPanelProps) {
  const navigate = useNavigate();
  const { words, isLoading, emptySlots } = useFocusSet({ studentId });

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[hsl(var(--brand-blue))]" />
          <h3 className="font-semibold">Focus Set</h3>
        </div>
        <span className="text-sm font-medium text-gray-600">
          {words.length} / 5
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        These words earn progress when you use them in speech.
      </p>

      {/* Horizontal 5-slot grid */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {words.map((word) => (
          <div key={word.id} className="border rounded-lg p-2 bg-white">
            <div className="text-sm font-medium truncate mb-1">{word.lemma}</div>
            <ActivationDots count={word.lesson_count} className="justify-center" />
          </div>
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div key={`empty-${i}`} className="border-2 border-dashed border-gray-200 rounded-lg p-2 flex items-center justify-center">
            <span className="text-xs text-gray-400">Empty</span>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => navigate('/student/vocabulary-builder')}
      >
        📖 Manage Focus Set →
      </Button>
    </Card>
  );
}
```

---

## File Structure Summary

### New Files to Create

```
ai-chat-app/src/
├── hooks/
│   ├── useFocusSet.ts                    # NEW
│   └── useWeeklyFocusTarget.ts           # NEW
│
├── lib/
│   └── vocabulary-utils.ts               # NEW (utility functions)
│
└── components/
    ├── vocabulary/
    │   ├── ActivationDots.tsx            # NEW
    │   ├── FocusSetCard.tsx              # NEW
    │   ├── EmptyFocusSlot.tsx            # NEW
    │   ├── FocusSetSection.tsx           # NEW
    │   ├── GoalPoolSection.tsx           # NEW
    │   ├── FocusSwapDialog.tsx           # NEW
    │   ├── RemoveFromFocusDialog.tsx     # NEW
    │   └── FocusSummaryCards.tsx         # NEW
    │
    ├── lessons/
    │   └── LiveGoalsPanel.tsx            # NEW (optional)
    │
    └── goals/
        └── GoalsSummaryPanel.tsx         # NEW (optional)
```

### Files to Update

```
ai-chat-app/src/
├── lib/
│   └── goals.ts                          # UPDATE interfaces
│
├── hooks/
│   ├── useVocabularyBuilder.ts          # UPDATE add swapFocus
│   └── useLexemeSearch.ts               # MINOR updates (if needed)
│
└── pages/
    └── VocabularyBuilder.tsx            # MAJOR refactor
```

---

## Testing Checklist

### Functional Tests

- [ ] Focus Set displays max 5 words
- [ ] Empty slots show dashed borders
- [ ] Activation dots correctly show 0-3 state
- [ ] Points display correctly for Focus words
- [ ] "Add to Focus" opens swap dialog when full (5 words)
- [ ] Swap dialog successfully swaps words
- [ ] Remove from Focus moves word to Goal Pool
- [ ] Goal Pool displays unlimited passive words
- [ ] Weekly Focus Target card shows correct progress
- [ ] Vocabulary Capacity shows stable word count
- [ ] Stable words show green border/background
- [ ] Search in Discover tab still works
- [ ] Bulk operations (select all, archive) still work

### Edge Cases

- [ ] What happens when all 5 Focus slots are stable? (Should auto-remove)
- [ ] Can archived words be added back to Focus?
- [ ] Does lesson snapshot show frozen Focus Set?
- [ ] Do stable words permanently lock out of Focus?

---

## Migration Strategy

### Option 1: Feature Flag (Recommended)

Add a feature flag to test new UI alongside old:

```typescript
// In environment or config
const FOCUS_SET_ENABLED = import.meta.env.VITE_FOCUS_SET_ENABLED === 'true';

// In VocabularyBuilder.tsx
{FOCUS_SET_ENABLED ? (
  <NewFocusSetUI />
) : (
  <LegacyActiveTabUI />
)}
```

### Option 2: Incremental Rollout

1. Deploy new components to production (hidden)
2. Test internally with specific user IDs
3. Gradual rollout to 10% → 50% → 100%

---

## Performance Considerations

1. **Query Invalidation**: Ensure all related queries are invalidated on mutations
   - `['vocabulary-builder', studentId]`
   - `['focus-set', studentId]`
   - `['weekly-focus-target', studentId]`

2. **Optimistic Updates**: Consider adding optimistic UI updates for instant feedback

3. **Debouncing**: Already implemented in `useLexemeSearch` (300ms)

4. **Caching**: Use appropriate `staleTime` for each query type
   - Focus Set: 30 seconds
   - Weekly Target: 60 seconds
   - Vocab Builder: 30 seconds

---

## Timeline Estimate

| Phase | Effort | Duration |
|-------|--------|----------|
| Phase 1: Interfaces & Utils | Low | 2-3 hours |
| Phase 2: Core Hooks | Medium | 4-5 hours |
| Phase 3: UI Components | High | 8-10 hours |
| Phase 4: Dialogs | Medium | 4-5 hours |
| Phase 5: Summary Cards | Low | 2-3 hours |
| Phase 6: Page Refactor | High | 6-8 hours |
| Phase 7: Additional Components | Medium | 4-6 hours (optional) |
| **Total** | - | **30-40 hours** |

---

## Next Steps

1. ✅ Review and approve this plan
2. Start with Phase 1 (Foundation)
3. Create components in isolation (Storybook optional)
4. Test each phase incrementally
5. Deploy behind feature flag
6. Gradual rollout to users

---

## Questions for Clarification

1. **Vocabulary Capacity**: Where do we fetch the stable word count from? Is there an RPC for this or do we calculate client-side?

2. **Automatic Stabilization**: Should the UI show a toast notification when a word becomes stable during a lesson? Or is this handled by the backend only?

3. **Mobile Responsiveness**: The plan assumes mobile will use 2-3 column grid for Focus Set. Is this acceptable or should it be vertical stack?

4. **Dashboard Integration**: Should `GoalsSummaryPanel` be added to the student dashboard now, or is that a later enhancement?

5. **Real-time Updates**: Do we need to implement real-time subscriptions for Focus Set changes (e.g., when teacher adds words to student's goals)?

---

**End of Implementation Plan**
