import {
  Briefcase,
  Cpu,
  GraduationCap,
  Heart,
  HeartPulse,
  Leaf,
  Palette,
  Plane,
  Scale,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * Each Part-3 theme is mapped to a lucide icon + a brand-tinted accent class.
 * Keep this list in sync with the seeded `ielts_test.theme` values.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  'Society & Culture': Users,
  'Education': GraduationCap,
  'Technology & Media': Cpu,
  'Health & Wellbeing': HeartPulse,
  'Environment & Nature': Leaf,
  'Family & Relationships': Heart,
  'Work & Careers': Briefcase,
  'Crime & Law': Scale,
  'Travel & Tourism': Plane,
  'Food & Eating Habits': UtensilsCrossed,
  'Arts & Creativity': Palette,
  'Shopping & Economy': ShoppingBag,
};

export function iconForTheme(theme: string): LucideIcon {
  return ICON_MAP[theme] ?? Sparkles;
}
