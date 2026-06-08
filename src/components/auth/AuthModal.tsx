import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';

interface Props {
  onClose: () => void;
}

type Tab = 'login' | 'register';

export function AuthModal({ onClose }: Props) {
  const { login, register } = useAuth();
  const [tab, setTab]           = useState<Tab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [tab]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function switchTab(t: Tab) {
    setTab(t);
    setError('');
    setUsername('');
    setPassword('');
    setConfirm('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (tab === 'register' && password !== confirm) {
      setError('Hasła nie są zgodne.');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'login') {
        await login(username, password);
      } else {
        await register(username, password);
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        try {
          const body = JSON.parse(err.message);
          setError(body.error ?? err.message);
        } catch {
          setError(err.message);
        }
      } else {
        setError('Błąd połączenia.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border-subtle bg-brand-black p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tabs */}
        <div className="mb-7 flex rounded-lg border border-border-subtle p-1">
          {(['login', 'register'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={[
                'flex-1 rounded-md py-1.5 text-sm font-medium transition-colors',
                tab === t
                  ? 'bg-brand-purple/20 text-brand-white'
                  : 'text-content-secondary hover:text-brand-white',
              ].join(' ')}
            >
              {t === 'login' ? 'Logowanie' : 'Rejestracja'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-content-secondary">Login</label>
            <input
              ref={inputRef}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="rounded-lg border border-border-subtle bg-white/5 px-3 py-2 text-sm text-brand-white placeholder-content-secondary outline-none focus:border-brand-purple/60 focus:ring-1 focus:ring-brand-purple/40"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-content-secondary">Hasło</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              required
              className="rounded-lg border border-border-subtle bg-white/5 px-3 py-2 text-sm text-brand-white placeholder-content-secondary outline-none focus:border-brand-purple/60 focus:ring-1 focus:ring-brand-purple/40"
            />
          </div>

          {tab === 'register' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-content-secondary">Potwierdź hasło</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                className="rounded-lg border border-border-subtle bg-white/5 px-3 py-2 text-sm text-brand-white placeholder-content-secondary outline-none focus:border-brand-purple/60 focus:ring-1 focus:ring-brand-purple/40"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-lg bg-brand-purple/80 py-2 text-sm font-semibold text-brand-white transition-colors hover:bg-brand-purple disabled:opacity-50"
          >
            {loading ? '...' : tab === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}
          </button>
        </form>
      </div>
    </div>
  );
}
