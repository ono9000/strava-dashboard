const PUBLIC_PATHS = new Set(['/login', '/signup'])

/**
 * Returns the path to redirect to, or null if no redirect is needed.
 * Pure function — no side effects, fully unit testable.
 */
export function getRedirectPath(
  hasSession: boolean,
  onboardingComplete: boolean,
  currentPath: string
): string | null {
  const isPublic = PUBLIC_PATHS.has(currentPath)

  if (!hasSession && !isPublic) return '/login'
  if (hasSession && onboardingComplete && isPublic) return '/dashboard'
  if (hasSession && !onboardingComplete && currentPath !== '/onboarding') return '/onboarding'
  return null
}
