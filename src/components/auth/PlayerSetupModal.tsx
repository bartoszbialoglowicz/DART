import { useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import { playersApi } from '../../api/players';
import { useAuth } from '../../context/AuthContext';

export function PlayerSetupModal() {
  const { setPlayerId } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const player = await playersApi.setupProfile({
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
      });
      setPlayerId(player.id);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-brand-black p-8 shadow-xl">

        <div className="mb-7 text-center">
          <span className="text-xs font-medium uppercase tracking-widest text-brand-purple">
            Jeszcze jeden krok
          </span>
          <h2 className="mt-2 text-xl font-bold text-brand-white">Utwórz profil gracza</h2>
          <p className="mt-2 text-xs leading-relaxed text-content-secondary">
            Twoje imię i nazwisko będą widoczne w turniejach i rankingach.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-content-secondary">Imię</label>
            <input
              ref={firstRef}
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoFocus
              maxLength={100}
              className="rounded-lg border border-border-subtle bg-white/5 px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-purple/60 focus:ring-1 focus:ring-brand-purple/40"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-content-secondary">Nazwisko</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              maxLength={100}
              className="rounded-lg border border-border-subtle bg-white/5 px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-purple/60 focus:ring-1 focus:ring-brand-purple/40"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !firstName.trim() || !lastName.trim()}
            className="mt-1 rounded-lg bg-brand-purple/80 py-2.5 text-sm font-semibold text-brand-white transition-colors hover:bg-brand-purple disabled:opacity-50"
          >
            {loading ? '...' : 'Zapisz profil'}
          </button>
        </form>
      </div>
    </div>
  );
}
