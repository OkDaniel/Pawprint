import { createContext } from 'react';
import type { AuthUser } from '@capstone/shared';

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login(username: string, password: string): Promise<void>;
  register(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
