/**
 * Utility functions for vocabulary builder
 */

/**
 * Get CEFR level color classes matching the design system
 */
export function getCefrLevelColor(level: string | null): string {
  if (!level) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  
  switch (level.toUpperCase()) {
    case 'A1': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'A2': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'B1': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'B2': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
    case 'C1': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'C2': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
}

/**
 * Calculate activation dot count (max 3)
 */
export function getActivationDotCount(lessonCount: number): number {
  return Math.min(lessonCount, 3);
}

/**
 * Check if word is stable based on lesson counts
 */
export function isWordStable(lessonCount: number, focusLessonCount: number): boolean {
  return lessonCount >= 3 && focusLessonCount >= 3;
}

/**
 * Format points display
 */
export function formatPoints(points: number): string {
  return points > 0 ? `+${points} pt` : '';
}
