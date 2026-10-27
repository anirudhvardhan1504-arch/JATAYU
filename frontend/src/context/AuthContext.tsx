import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  roleVersion: number;
}

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null; // In-memory only: strictly NOT persisted to localStorage, sessionStorage, cookies, or IndexedDB
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  invalidateSession: (reason?: string) => void;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Memory-only authentication state
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const invalidateSession = useCallback((reason?: string) => {
    setToken(null);
    setUser(null);
    setPermissions([]);
    if (reason) {
      setError(reason);
    }
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed. Please verify your credentials.');
      }

      if (!data.token || !data.user) {
        throw new Error('Malformed authentication response from server.');
      }

      // Store in memory ONLY
      setToken(data.token);
      setUser({
        id: data.user.id,
        username: data.user.username,
        displayName: data.user.displayName || data.user.username,
        role: data.user.role,
        roleVersion: data.user.roleVersion ?? 1,
      });
      setPermissions(Array.isArray(data.user.permissions) ? data.user.permissions : []);
      setError(null);
    } catch (err: any) {
      setToken(null);
      setUser(null);
      setPermissions([]);
      setError(err.message || 'Authentication error.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    const activeToken = token;

    try {
      if (activeToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeToken}`,
          },
        }).catch((err) => {
          console.warn('Backend logout notification failed, clearing local memory session:', err);
        });
      }
    } finally {
      // Unconditionally wipe in-memory authentication state
      setToken(null);
      setUser(null);
      setPermissions([]);
      setError(null);
      setIsLoading(false);
    }
  }, [token]);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!permission) return false;
      return permissions.includes(permission);
    },
    [permissions]
  );

  const hasRole = useCallback(
    (role: string): boolean => {
      if (!user || !role) return false;
      return user.role === role;
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      permissions,
      isAuthenticated: Boolean(token && user),
      isLoading,
      error,
      login,
      logout,
      hasPermission,
      hasRole,
      invalidateSession,
      clearError,
    }),
    [user, token, permissions, isLoading, error, login, logout, hasPermission, hasRole, invalidateSession, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
