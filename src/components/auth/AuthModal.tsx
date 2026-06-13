import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Modal';
import { useFormModal } from '../../hooks/useFormModal';

interface Props {
  onClose: () => void;
}

type Tab = 'login' | 'register';

export function AuthModal({ onClose }: Props) {
  const { login, register } = useAuth();
  const { error, isPending, submit, setError } = useFormModal();

  const [tab,      setTab]      = useState<Tab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [tab]);

  function switchTab(t: Tab) {
    setTab(t);
    setError('');
    setUsername('');
    setPassword('');
    setConfirm('');
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (tab === 'register' && password !== confirm) {
      setError('Hasła nie są zgodne.');
      return;
    }
    await submit(async () => {
      if (tab === 'login') await login(username, password);
      else                 await register(username, password);
      onClose();
    });
  }

  return (
    <Modal size="sm" onClose={onClose} aria-labelledby="auth-modal-title">
      <div className="p-8">
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
              className="rounded-lg border border-border-subtle bg-white/5 px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-purple/60 focus:ring-1 focus:ring-brand-purple/40"
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
              className="rounded-lg border border-border-subtle bg-white/5 px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-purple/60 focus:ring-1 focus:ring-brand-purple/40"
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
                className="rounded-lg border border-border-subtle bg-white/5 px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-purple/60 focus:ring-1 focus:ring-brand-purple/40"
              />
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="mt-1 rounded-lg bg-brand-purple/80 py-2 text-sm font-semibold text-brand-white transition-colors hover:bg-brand-purple disabled:opacity-50"
          >
            {isPending ? '...' : tab === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}
          </button>
        </form>
      </div>
    </Modal>
  );
}
