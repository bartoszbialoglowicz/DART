import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/auth';

interface AuthState {
  token: string | null;
  username: string | null;
}

interface AuthContextValue extends AuthState {
  login:    (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout:   () => Promise<void>;
}

const TOKEN_KEY = 'auth_token';
const USER_KEY  = 'auth_username';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token,    setToken]    = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(USER_KEY));

  function persist(t: string, u: string) {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, u);
    setToken(t);
    setUsername(u);
  }

  function clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUsername(null);
  }

  useEffect(() => {
    if (!token) return;
    authApi.me().catch(clear);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (u: string, p: string) => {
    const res = await authApi.login(u, p);
    persist(res.token, res.username);
  }, []);

  const register = useCallback(async (u: string, p: string) => {
    const res = await authApi.register(u, p);
    persist(res.token, res.username);
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* token already invalid */ }
    clear();
  }, []);

  return (
    <AuthContext.Provider value={{ token, username, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
