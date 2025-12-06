// Authentication utility functions
import { supabase } from './supabase';

interface OnboardingData {
  goals?: string[];
  interests?: string[];
  nativeLanguage?: string;
  cefrLevel?: string;
  correctionStyle?: string;
}

// LocalStorage keys
const ONBOARDING_KEY = 'justai_onboarding_data';
const ONBOARDING_EMAIL_KEY = 'justai_onboarding_email';

/**
 * Save onboarding data to localStorage
 */
export function saveOnboardingData(data: Partial<OnboardingData>) {
  const existing = getOnboardingData();
  const updated = { ...existing, ...data };
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(updated));
}

/**
 * Get onboarding data from localStorage
 */
export function getOnboardingData(): OnboardingData {
  const stored = localStorage.getItem(ONBOARDING_KEY);
  return stored ? JSON.parse(stored) : {};
}

/**
 * Save email for onboarding flow
 */
export function saveOnboardingEmail(email: string) {
  localStorage.setItem(ONBOARDING_EMAIL_KEY, email);
}

/**
 * Get email for onboarding flow
 */
export function getOnboardingEmail(): string | null {
  return localStorage.getItem(ONBOARDING_EMAIL_KEY);
}

/**
 * Clear onboarding data from localStorage
 */
export function clearOnboardingData() {
  localStorage.removeItem(ONBOARDING_KEY);
  localStorage.removeItem(ONBOARDING_EMAIL_KEY);
}

/**
 * Check if user has completed onboarding
 */
export async function checkOnboardingStatus(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('justai_onboarding_completed')
    .eq('id', user.id)
    .single();

  return profile?.justai_onboarding_completed || false;
}

/**
 * Complete onboarding and save data to database
 */
export async function completeOnboarding(userId: string, data: OnboardingData) {
  // Update profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      learning_goals: data.goals,
      interests: data.interests,
      native_language: data.nativeLanguage,
      cefr_level: data.cefrLevel,
      justai_onboarding_completed: true,
      justai_correction_style: data.correctionStyle,
    })
    .eq('id', userId);

  if (profileError) throw profileError;

  // Create agent config
  const { error: configError } = await supabase
    .from('justai_agent_configs')
    .insert({
      student_id: userId,
      learning_goals: data.goals || [],
      interests: data.interests || [],
      cefr_level: data.cefrLevel || 'B1',
      correction_style: data.correctionStyle || 'balanced',
      system_prompt_template: 'default',
      onboarding_completed: true,
    });

  if (configError) throw configError;

  // Clear localStorage
  clearOnboardingData();
}

/**
 * Send passwordless login email
 */
export async function sendMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) throw error;
}

/**
 * Sign out user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current session
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session;
}
