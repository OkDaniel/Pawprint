export function isOnboardingPreviewEnabled(mode: string): boolean {
  return mode === 'development' || mode === 'test';
}
