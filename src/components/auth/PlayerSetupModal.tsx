import { useState } from 'react';
import { playersApi } from '../../api/players';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Modal';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useFormModal } from '../../hooks/useFormModal';

export function PlayerSetupModal() {
  const { setPlayerId } = useAuth();
  const { error, isPending, submit } = useFormModal();

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    await submit(async () => {
      const player = await playersApi.setupProfile({
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
      });
      setPlayerId(player.id);
    });
  }

  return (
    <Modal
      size="sm"
      showClose={false}
      closeOnEsc={false}
      closeOnOverlayClick={false}
      ariaLabel="Utwórz profil gracza"
    >
      <div className="mb-6 text-center">
        <span className="text-xs font-medium uppercase tracking-widest text-content-accent">
          Jeszcze jeden krok
        </span>
        <h2 className="mt-2 text-xl font-bold text-content-primary">
          Utwórz profil gracza
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-content-secondary">
          Twoje imię i nazwisko będą widoczne w turniejach i rankingach.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Imię">
          <Input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoFocus
            maxLength={100}
          />
        </Field>

        <Field label="Nazwisko">
          <Input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            maxLength={100}
          />
        </Field>

        {error && <p className="text-xs text-score-down-text">{error}</p>}

        <Button
          type="submit"
          loading={isPending}
          disabled={!firstName.trim() || !lastName.trim()}
          fullWidth
          className="mt-1"
        >
          Zapisz profil
        </Button>
      </form>
    </Modal>
  );
}
