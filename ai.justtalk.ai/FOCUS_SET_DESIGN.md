# Focus Set Design - UI/UX Specifications

## Overview

The Focus Set is the core UI paradigm for vocabulary learning in JustTalk. It represents exactly **5 words** that a student is actively practicing, with visual feedback for progress and state transitions.

---

## Design Philosophy

### Core Principles

1. **Constraint Creates Focus**: The 5-word limit forces intentional word selection
2. **Progress Over Quantity**: Emphasize state transitions, not raw counts
3. **Immediate Feedback**: Real-time visual updates during lessons
4. **Consistent Representation**: Same 5-slot grid across all surfaces

### Mental Model for Users

> "JustTalk tracks everything you say — but only what you intentionally practice becomes permanent."

- **Dots** show familiarity (global usage)
- **Focus** confirms mastery
- **Stability** is earned, not accidental

---

## Visual Components

### Focus Set Card

Each Focus Set card displays:

```
┌─────────────────────────────────────┐
│  ┌─────┐                            │
│  │ B1  │  negotiate                 │
│  └─────┘                            │
│                                     │
│  ● ● ○    +2 pts                    │
│                                     │
└─────────────────────────────────────┘
```

**Elements:**
1. **CEFR Badge** (top-left): Color-coded level indicator
2. **Word** (lemma): The vocabulary item
3. **Activation Dots** (bottom-left): 0-3 filled dots showing global usage
4. **Points Indicator** (bottom-right): Points earned while in Focus

### Activation Dots

```tsx
// Visual representation of global lesson_count
function ActivationDots({ count, max = 3 }: { count: number; max?: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-2 h-2 rounded-full transition-colors",
            i < count 
              ? "bg-[hsl(var(--brand-blue))]" 
              : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}
```

**Dot States:**
| Dots | State | Meaning |
|------|-------|---------|
| ○ ○ ○ | Not Used | Never used in a lesson |
| ● ○ ○ | Practiced | Used in 1 distinct session |
| ● ● ○ | Activated | Used in 2 distinct sessions |
| ● ● ● | Ready for Stable | Used in 3+ sessions, needs Focus confirmation |

### Empty Slot Placeholder

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│                                       │
│              Empty                    │
│                                       │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

- Dashed border (`border-dashed`)
- Muted text ("Empty")
- Same dimensions as filled cards

### Stable Word Styling

When a word reaches stable status (before removal):

```tsx
className={cn(
  "transition-all",
  isStable && "border-green-500/50 bg-green-50/30 dark:bg-green-950/10"
)}
```

---

## Page Layouts

### Vocabulary Builder Page (`/student/vocabulary-builder`)

```
┌─────────────────────────────────────────────────────────┐
│  Vocabulary Builder                                      │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐                              │
│  │  Focus   │ │ Discover │                              │
│  └──────────┘ └──────────┘                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │ Vocabulary      │  │ Weekly Focus    │               │
│  │ Capacity: 12    │  │ Target: 6/10    │               │
│  └─────────────────┘  └─────────────────┘               │
│                                                          │
│  Focus Set (5 slots)                                     │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐               │
│  │word1│ │word2│ │word3│ │ --- │ │ --- │               │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘               │
│                                                          │
│  ⚠️ 2 open Focus slots — choose words to practice       │
│                                                          │
│  All Goals (Goal Pool)                                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │ word4  │ A2 │ ● ○ ○ │ [Add to Focus]           │    │
│  │ word5  │ B1 │ ○ ○ ○ │ [Add to Focus]           │    │
│  │ word6  │ B2 │ ● ● ● │ [Add to Focus]           │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Dashboard Focus Summary (`GoalsSummaryPanel`)

Compact 5-slot horizontal grid:

```
┌─────────────────────────────────────────────────────────┐
│  ✨ Focus Set                              3 / 5        │
│  These words earn progress when you use them in speech. │
├─────────────────────────────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌ ─ ─ ┐ ┌ ─ ─ ┐              │
│  │word1│ │word2│ │word3│ │Empty│ │Empty│              │
│  │● ● ○│ │● ○ ○│ │● ● ●│ │     │ │     │              │
│  └─────┘ └─────┘ └─────┘ └ ─ ─ ┘ └ ─ ─ ┘              │
│                                                          │
│  [📖 Manage Focus Set →]                                │
└─────────────────────────────────────────────────────────┘
```

### Live Lesson Panel (`LiveGoalsPanel`)

Vertical stack during active lessons:

```
┌─────────────────────────────────────┐
│  🎯 Focus Words                      │
│  Track these words during speech    │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ negotiate        B1  ● ● ○  │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ collaborate      B2  ● ○ ○  │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ enthusiasm       B1  ● ● ●  │    │
│  └─────────────────────────────┘    │
│                                      │
│  [📖 Manage Focus Set]              │
└─────────────────────────────────────┘
```

---

## Interaction Patterns

### Adding to Focus Set

**When slots available (< 5 words):**
1. User clicks "Add to Focus" on Goal Pool item
2. Word moves to Focus Set immediately
3. Toast: "Added 'negotiate' to Focus Set"

**When Focus Set is full (5 words):**
1. User clicks "Add to Focus"
2. **Swap Dialog** appears:

```
┌─────────────────────────────────────────────────────────┐
│  Focus Set Full                                    [×]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Your Focus Set is at capacity (5 words).               │
│  Choose a word to pause to make room for "negotiate".   │
│                                                          │
│  Progress on paused words is preserved.                 │
│                                                          │
│  ○ collaborate      B2  ● ○ ○                           │
│  ○ enthusiasm       B1  ● ● ●                           │
│  ○ perspective      B2  ● ● ○                           │
│  ○ implement        B2  ○ ○ ○                           │
│  ○ strategy         B1  ● ○ ○                           │
│                                                          │
│  [Cancel]                              [Confirm Swap]   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

3. User selects word to pause
4. Swap executed atomically
5. Toast: "Swapped 'collaborate' for 'negotiate'"

### Removing from Focus Set

1. User clicks remove button on Focus card
2. **Confirmation Dialog** appears:

```
┌─────────────────────────────────────────────────────────┐
│  Remove from Focus?                                [×]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Remove "negotiate" from your Focus Set?                │
│                                                          │
│  Your progress will be saved. You can add it back       │
│  to Focus anytime from your Goals.                      │
│                                                          │
│  [Cancel]                                     [Remove]  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

3. Word moves to Goal Pool
4. Toast: "Removed 'negotiate' from Focus Set"

### Automatic Stabilization

When a word becomes stable during a lesson:

1. Word reaches 3 dots + 1 Focus usage
2. **Visual transition**: Green border/background appears briefly
3. Word is automatically removed from Focus Set
4. Toast: "🎉 'negotiate' is now stable! +1 Vocabulary Capacity"
5. Empty slot appears in Focus Set

---

## Summary Cards

### Vocabulary Capacity Card

```
┌─────────────────────────────────────┐
│  📚 Vocabulary Capacity             │
│                                      │
│     12                              │
│  stable words                       │
│                                      │
│  Lifetime mastered vocabulary       │
└─────────────────────────────────────┘
```

- **Value**: Count of words with `focus_lesson_count >= 3`
- **Never resets**: Lifetime achievement metric

### Weekly Focus Target Card

```
┌─────────────────────────────────────┐
│  🎯 Weekly Focus Target    ℹ️       │
│                                      │
│  ████████░░░░░░░░░░░░  6 / 10 pts   │
│                                      │
│  Points earned this week            │
│  Resets Monday                      │
└─────────────────────────────────────┘
```

- **Progress bar**: Shows points toward weekly goal
- **Tooltip**: "Only Focus words earn weekly progress"
- **Resets**: Every Monday at 00:00 UTC

---

## Color System

### CEFR Level Colors

```tsx
export function getCefrLevelColor(level: string): string {
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
```

### State Colors

| Element | Token/Class |
|---------|-------------|
| Active dot | `bg-[hsl(var(--brand-blue))]` |
| Inactive dot | `bg-muted` |
| Stable border | `border-green-500/50` |
| Stable background | `bg-green-50/30` (light) / `bg-green-950/10` (dark) |
| Empty slot border | `border-dashed border-muted` |

---

## Responsive Behavior

### Desktop (≥768px)

- Focus Set: 5 columns, equal width cards
- Goal Pool: Full table with all columns
- Summary cards: Side by side

### Mobile (<768px)

- Focus Set: 2-3 columns, wrapping grid
- Goal Pool: Stacked cards, simplified
- Summary cards: Stacked vertically

---

## Component Reference

| Component | File | Purpose |
|-----------|------|---------|
| `FocusSetSection` | `src/components/vocabulary/FocusSetSection.tsx` | Main Focus Set grid |
| `GoalPoolSection` | `src/components/vocabulary/GoalPoolSection.tsx` | Goal wishlist table |
| `FocusSummaryCards` | `src/components/vocabulary/FocusSummaryCards.tsx` | Capacity + Weekly Target |
| `FocusSlotNudge` | `src/components/vocabulary/FocusSlotNudge.tsx` | Empty slot CTA |
| `FocusSwapDialog` | `src/components/vocabulary/FocusSwapDialog.tsx` | Full set swap UI |
| `RemoveFromFocusDialog` | `src/components/vocabulary/RemoveFromFocusDialog.tsx` | Removal confirmation |
| `GoalsSummaryPanel` | `src/components/goals/GoalsSummaryPanel.tsx` | Dashboard compact view |
| `LiveGoalsPanel` | `src/components/lessons/LiveGoalsPanel.tsx` | In-lesson tracking |

---

## Accessibility

- All interactive elements are keyboard navigable
- Focus indicators on cards and buttons
- Screen reader labels for activation dots
- Semantic HTML structure (headings, lists)
- Color is not the only indicator (dots + count)
