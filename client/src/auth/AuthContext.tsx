import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthResponse, AuthUser } from '@capstone/shared';
import { ApiError, apiRequest } from '../api/api';
import { AuthContext, type AuthContextValue } from './authContextValue';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<AuthResponse>('/api/auth/me')
      .then((result) => setUser(result.user))
      .catch((error: unknown) => { if (!(error instanceof ApiError && error.status === 401)) console.error(error); })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async login(username, password) {
      const result = await apiRequest<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      setUser(result.user);
    },
    async register(username, password) {
      const result = await apiRequest<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
      setUser(result.user);
    },
    async logout() { await apiRequest('/api/auth/logout', { method: 'POST' }); setUser(null); },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
