import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/auth';

interface AuthState {
  token:    string | null;
  username: string | null;
  playerId: number | null;
}

interface AuthContextValue extends AuthState {
  login:       (username: string, password: string) => Promise<void>;
  register:    (username: string, password: string) => Promise<void>;
  logout:      () => Promise<void>;
  setPlayerId: (id: number) => void;
}

const TOKEN_KEY     = 'auth_token';
const USER_KEY      = 'auth_username';
const PLAYER_ID_KEY = 'auth_player_id';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token,    setToken]    = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(USER_KEY));
  const [playerId, setPlayerIdState] = useState<number | null>(() => {
    const v = localStorage.getItem(PLAYER_ID_KEY);
    return v !== null ? parseInt(v) : null;
  });

  function persist(t: string, u: string, pid: number | null) {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, u);
    if (pid !== null) localStorage.setItem(PLAYER_ID_KEY, String(pid));
    else              localStorage.removeItem(PLAYER_ID_KEY);
    setToken(t);
    setUsername(u);
    setPlayerIdState(pid);
  }

  function clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PLAYER_ID_KEY);
    setToken(null);
    setUsername(null);
    setPlayerIdState(null);
  }

  useEffect(() => {
    if (!token) return;
    authApi.me()
      .then(res => {
        setUsername(res.username);
        setPlayerIdState(res.player_id);
        if (res.player_id !== null) localStorage.setItem(PLAYER_ID_KEY, String(res.player_id));
        else                        localStorage.removeItem(PLAYER_ID_KEY);
      })
      .catch(clear);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (u: string, p: string) => {
    const res = await authApi.login(u, p);
    persist(res.token, res.username, res.player_id);
  }, []);

  const register = useCallback(async (u: string, p: string) => {
    const res = await authApi.register(u, p);
    persist(res.token, res.username, res.player_id);
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* token already invalid */ }
    clear();
  }, []);

  const setPlayerId = useCallback((id: number) => {
    setPlayerIdState(id);
    localStorage.setItem(PLAYER_ID_KEY, String(id));
  }, []);

  return (
    <AuthContext.Provider value={{ token, username, playerId, login, register, logout, setPlayerId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
