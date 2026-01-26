import { useEffect, useState } from 'react';
import { getPostHog } from '@/lib/posthog';

/**
 * Hook to get a feature flag variant from PostHog
 * @param flagKey - The feature flag key
 * @param defaultValue - Default variant value if flag is not loaded or doesn't exist
 * @returns The feature flag variant as a string (e.g., 'control', 'test', 'true', 'false')
 */
export function useFeatureFlagVariant(
  flagKey: string,
  defaultValue?: string
): string | boolean | undefined {
  const [flagValue, setFlagValue] = useState<string | boolean | undefined>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const posthog = getPostHog();
    
    console.log('[PostHog Hook] Initializing feature flag:', {
      flagKey,
      posthogAvailable: !!posthog,
      posthogLoaded: posthog?.__loaded,
      defaultValue,
    });
    
    // Check if PostHog is available and loaded
    if (!posthog || !posthog.__loaded) {
      console.log('[PostHog Hook] PostHog not loaded, using default value:', defaultValue);
      setIsLoading(false);
      setFlagValue(defaultValue);
      return;
    }

    // Get initial value - getFeatureFlag returns the variant key as string or boolean
    const initialValue = posthog.getFeatureFlag(flagKey);
    console.log('[PostHog Hook] Feature flag variant from PostHog:', {
      flagKey,
      initialValue,
      type: typeof initialValue,
      defaultValue,
      finalValue: initialValue ?? defaultValue,
    });
    setFlagValue(initialValue ?? defaultValue);
    setIsLoading(false);

    // Listen for flag changes
    const unsubscribe = posthog.onFeatureFlags(() => {
      const newValue = posthog.getFeatureFlag(flagKey);
      console.log('[PostHog Hook] Feature flag changed:', { flagKey, newValue, type: typeof newValue });
      setFlagValue(newValue ?? defaultValue);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [flagKey, defaultValue]);

  return isLoading ? defaultValue : flagValue;
}

/**
 * Hook to get a feature flag value from PostHog (legacy - kept for backwards compatibility)
 * @deprecated Use useFeatureFlagVariant instead for variant-based flags
 * @param flagKey - The feature flag key
 * @param defaultValue - Default value if flag is not loaded or doesn't exist
 * @returns The feature flag value
 */
export function useFeatureFlag<T = boolean>(
  flagKey: string,
  defaultValue?: T
): T | undefined {
  const [flagValue, setFlagValue] = useState<T | undefined>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const posthog = getPostHog();
    
    console.log('[PostHog Hook] Initializing feature flag:', {
      flagKey,
      posthogAvailable: !!posthog,
      posthogLoaded: posthog?.__loaded,
      defaultValue,
    });
    
    // Check if PostHog is available and loaded
    if (!posthog || !posthog.__loaded) {
      console.log('[PostHog Hook] PostHog not loaded, using default value:', defaultValue);
      setIsLoading(false);
      setFlagValue(defaultValue);
      return;
    }

    // Get initial value
    const initialValue = posthog.getFeatureFlag(flagKey) as T;
    console.log('[PostHog Hook] Feature flag value from PostHog:', {
      flagKey,
      initialValue,
      defaultValue,
      finalValue: initialValue ?? defaultValue,
    });
    setFlagValue(initialValue ?? defaultValue);
    setIsLoading(false);

    // Listen for flag changes
    const unsubscribe = posthog.onFeatureFlags(() => {
      const newValue = posthog.getFeatureFlag(flagKey) as T;
      console.log('[PostHog Hook] Feature flag changed:', { flagKey, newValue });
      setFlagValue(newValue ?? defaultValue);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [flagKey, defaultValue]);

  return isLoading ? defaultValue : flagValue;
}

/**
 * Hook to get a feature flag payload from PostHog
 * @param flagKey - The feature flag key
 * @returns The feature flag payload object or null
 */
export function useFeatureFlagPayload<T = any>(
  flagKey: string
): T | null {
  const [payload, setPayload] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const posthog = getPostHog();
    
    console.log('[PostHog Hook] Initializing feature flag payload:', {
      flagKey,
      posthogAvailable: !!posthog,
      posthogLoaded: posthog?.__loaded,
    });
    
    // Check if PostHog is available and loaded
    if (!posthog || !posthog.__loaded) {
      console.log('[PostHog Hook] PostHog not loaded, payload is null');
      setIsLoading(false);
      setPayload(null);
      return;
    }

    // Get initial payload value
    const initialPayload = posthog.getFeatureFlagPayload(flagKey) as T | undefined;
    console.log('[PostHog Hook] Feature flag payload from PostHog:', {
      flagKey,
      initialPayload,
      type: typeof initialPayload,
    });
    setPayload(initialPayload ?? null);
    setIsLoading(false);

    // Listen for flag changes
    const unsubscribe = posthog.onFeatureFlags(() => {
      const newPayload = posthog.getFeatureFlagPayload(flagKey) as T | undefined;
      console.log('[PostHog Hook] Feature flag payload changed:', { flagKey, newPayload });
      setPayload(newPayload ?? null);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [flagKey]);

  return isLoading ? null : payload;
}

/**
 * Hook to track events with PostHog
 */
export function usePostHogTracking() {
  const trackEvent = (eventName: string, properties?: Record<string, any>) => {
    const posthog = getPostHog();
    
    if (!posthog || !posthog.__loaded) {
      console.warn('PostHog not loaded. Event not tracked:', eventName);
      return;
    }
    posthog.capture(eventName, properties);
  };

  const identifyUser = (userId: string, properties?: Record<string, any>) => {
    const posthog = getPostHog();
    
    if (!posthog || !posthog.__loaded) {
      console.warn('PostHog not loaded. User not identified:', userId);
      return;
    }
    posthog.identify(userId, properties);
  };

  return { trackEvent, identifyUser };
}
