'use client'

import { useEffect } from 'react'

/**
 * Suppresses expected unhandled promise rejections from triggering
 * the Next.js 15 dev overlay. These are known-safe errors:
 * - Axios 401 redirects to /auth during navigation
 * - Network errors when backend is temporarily unreachable
 * - AbortError from cancelled fetch requests on page transitions
 */
export function DevOverlaySuppressor() {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      if (!reason) return

      const msg: string =
        (typeof reason === 'string' ? reason : reason?.message || reason?.code || '') + ''

      const isSafe =
        // Axios network/auth errors
        msg.includes('Network Error') ||
        msg.includes('401') ||
        msg.includes('Request failed with status code 401') ||
        msg.includes('Request failed with status code 403') ||
        // Navigation-cancelled fetch
        msg.includes('AbortError') ||
        msg.includes('The user aborted a request') ||
        // Expected backend-unreachable during startup
        msg.includes('ECONNREFUSED') ||
        msg.includes('ERR_NETWORK') ||
        // React strict-mode double-invoke artefacts
        msg.includes('Cannot update a component') ||
        // Auth redirect races
        (reason?.config?.url && reason.config.url.includes('/api/v1/'))

      if (isSafe) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }

    window.addEventListener('unhandledrejection', handler, true)
    return () => window.removeEventListener('unhandledrejection', handler, true)
  }, [])

  return null
}
