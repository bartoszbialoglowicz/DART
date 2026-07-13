import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Modal';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { useFormModal } from '../../hooks/useFormModal';

interface Props {
  onClose: () => void;
}

type Tab = 'login' | 'register';

const TABS = [
  { value: 'login', label: 'Logowanie' },
  { value: 'register', label: 'Rejestracja' },
] as const;

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
    <Modal size="sm" onClose={onClose} showClose ariaLabel="Logowanie lub rejestracja">
      <SegmentedControl
        fullWidth
        className="mb-6"
        aria-label="Tryb"
        value={tab}
        onChange={switchTab}
        options={TABS}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Login">
          <Input
            ref={inputRef}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </Field>

        <Field label="Hasło">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            required
          />
        </Field>

        {tab === 'register' && (
          <Field label="Potwierdź hasło">
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
        )}

        {error && <p className="text-xs text-score-down-text">{error}</p>}

        <Button type="submit" loading={isPending} fullWidth className="mt-1">
          {tab === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}
        </Button>
      </form>
    </Modal>
  );
}
