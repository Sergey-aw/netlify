import posthog from 'posthog-js';

let isInitialized = false;

// Initialize PostHog
export const initPostHog = () => {
  if (isInitialized) {
    return posthog;
  }

  const apiKey = import.meta.env.VITE_POSTHOG_API_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    console.warn('PostHog API key not found. Analytics disabled.');
    return null;
  }

  try {
    posthog.init(apiKey, {
      api_host: host,
      person_profiles: 'identified_only', // Only create profiles for identified users
      capture_pageview: false, // We'll manually track page views
      capture_pageleave: true,
      // Enable feature flags
      bootstrap: {
        featureFlags: {},
      },
    });
    isInitialized = true;
    
    // Expose posthog to window for debugging in development
    if (import.meta.env.DEV) {
      (window as any).posthog = posthog;
      console.log('PostHog initialized and exposed to window.posthog for debugging');
    }
  } catch (error) {
    console.error('Failed to initialize PostHog:', error);
    return null;
  }

  return posthog;
};

// Safe getter for posthog instance
export const getPostHog = () => {
  try {
    return posthog;
  } catch {
    return null;
  }
};

export { posthog };
