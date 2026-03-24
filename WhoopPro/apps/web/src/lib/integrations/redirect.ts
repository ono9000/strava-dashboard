export function resolveCallbackDestination(
  outcome: 'success' | 'error',
  returnTo: 'onboarding' | 'settings' | undefined,
  providerValue: string,
): string {
  const base = returnTo === 'onboarding' ? '/onboarding' : '/settings/integrations';
  if (outcome === 'success') {
    return `${base}?connected=${providerValue}`;
  }
  return `${base}?error=connect_failed`;
}
