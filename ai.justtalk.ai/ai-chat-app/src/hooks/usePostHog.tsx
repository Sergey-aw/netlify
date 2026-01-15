import { usePostHog as usePostHogContext } from 'posthog-js/react'
import { getPostHog, initPostHog } from '../lib/posthog'

/**
 * Custom hook to get the PostHog client instance.
 * It first tries to read from the React context provided by PostHogProvider,
 * then falls back to the singleton instance from our lib, initializing it if needed.
 */
export function usePostHog() {
  // Try context from PostHogProvider
  const contextClient = usePostHogContext()
  if (contextClient) {
    return contextClient
  }

  // Fallback to our standalone singleton
  let client = getPostHog()
  if (!client) {
    client = initPostHog()
  }

  if (!client) {
    throw new Error('PostHog is not initialized')
  }

  return client
}
