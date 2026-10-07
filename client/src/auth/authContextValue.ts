import { createContext } from 'react';
import type { AuthUser, CatAppearanceKey, OnboardingCompletionInput } from '@capstone/shared';

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login(username: string, password: string): Promise<void>;
  register(username: string, password: string): Promise<void>;
  updateCompanion(catAppearance: CatAppearanceKey, catName: string): Promise<void>;
  completeOnboarding(input: OnboardingCompletionInput): Promise<void>;
  logout(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
