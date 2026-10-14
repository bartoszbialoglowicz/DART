import { useState, type ReactNode } from 'react';
import { ApiError } from '../../api/client';
import {
  useAddContact, useCheckContactCode, useCheckLinkCode, useContacts, useLinkGuest, useMyGuests,
  useRemoveContact, useUnlinkGuest,
} from '../../hooks/useLinking';
import type { Contact, GuestPlayer, GuestTournament } from '../../types/linking';
import { plural } from '../../utils/plural';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { OptionButton } from '../ui/OptionButton';

function errorText(err: unknown): string | null {
  if (!err) return null;
  return err instanceof ApiError ? err.detail : 'Coś poszło nie tak, spróbuj ponownie.';
}

function eventsLabel(events: GuestTournament[]): string {
  const t = events.filter(e => e.kind === 'tournament').length;
  const l = events.length - t;
  const parts = [
    t > 0 && `${t} ${plural(t, 'turniej', 'turnieje', 'turniejów')}`,
    l > 0 && `${l} ${plural(l, 'liga', 'ligi', 'lig')}`,
  ].filter(Boolean);
  if (parts.length === 0) return 'jeszcze nie grał';
  return `${parts.join(', ')}: ${events.map(e => e.name).join(', ')}`;
}

function SectionTitle({ label, count, action }: { label: string; count: number; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-content-secondary">{label}</h2>
        {count > 0 && <Badge variant="neutral" mono>{count}</Badge>}
      </div>
      {action}
    </div>
  );
}

/**
 * Who the organizer can put in their tournaments and leagues:
 * - registered players who gave them their code (contacts), and
 * - their own account-less players ("słupy"), created when a player is added
 *   by name only. When such a player registers, linking with their code moves
 *   this history into their account.
 * The organizer never browses accounts — every registered player arrives via
 * their own code.
 */
export function GuestPlayersTab() {
  const { data: guests = [], isLoading } = useMyGuests();
  const { data: contacts = [] }          = useContacts();
  const unlink        = useUnlinkGuest();
  const removeContact = useRemoveContact();
  const [linking, setLinking]       = useState<GuestPlayer | null>(null);
  const [addingContact, setAdding]  = useState(false);

  function handleUnlink(guest: GuestPlayer) {
    if (!confirm(`Odłączyć „${guest.name}” od konta ${guest.linked_to}? Te wyniki przestaną się liczyć do jego statystyk.`)) return;
    unlink.mutate(guest.id);
  }

  function handleRemoveContact(contact: Contact) {
    if (!confirm(`Usunąć ${contact.name} z Twoich graczy? Nie będziesz mógł dodawać go do nowych turniejów, dopóki nie poda Ci ponownie kodu.`)) return;
    removeContact.mutate(contact.id);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Registered players (contacts) ─────────────────────────────── */}
      <section>
        <SectionTitle
          label="Gracze z kontem"
          count={contacts.length}
          action={
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
              + Dodaj przez kod
            </Button>
          }
        />
        <p className="mb-4 text-sm text-content-secondary">
          Zarejestrowanych graczy dodajesz kodem, który znajdą w swoim profilu. Tylko oni pojawiają się
          w kreatorze turnieju i w składach lig.
        </p>
        {contacts.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-content-secondary">
              Nie masz jeszcze graczy z kontem. Poproś gracza o kod i dodaj go przyciskiem powyżej.
            </p>
          </Card>
        ) : (
          <Card padding="none">
            {contacts.map((contact, i) => (
              <div
                key={contact.id}
                className={['flex items-center justify-between gap-4 px-4 py-3', i > 0 ? 'border-t border-border-subtle' : ''].join(' ')}
              >
                <p className="truncate text-sm font-medium text-content-primary">{contact.name}</p>
                <Button variant="ghost" size="sm" loading={removeContact.isPending} onClick={() => handleRemoveContact(contact)}>
                  Usuń
                </Button>
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* ── Account-less players (słupy) ──────────────────────────────── */}
      <section>
        <SectionTitle label="Gracze bez konta" count={guests.length} />
        <p className="mb-4 text-sm text-content-secondary">
          Gracze dodani do Twoich turniejów i lig tylko z imienia. Gdy ktoś z nich założy konto, powiąż go
          z nim — jego wyniki trafią do jego statystyk.
        </p>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-content-secondary">Ładowanie…</p>
        ) : guests.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-content-secondary">
              Nie masz graczy bez konta. Powstają, gdy dodajesz gracza po imieniu w kreatorze turnieju lub w lidze.
            </p>
          </Card>
        ) : (
          <Card padding="none">
            {guests.map((guest, i) => (
              <div
                key={guest.id}
                className={['flex items-center justify-between gap-4 px-4 py-3', i > 0 ? 'border-t border-border-subtle' : ''].join(' ')}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-content-primary">{guest.name}</p>
                  <p className="truncate text-xs text-content-secondary">{eventsLabel(guest.tournaments)}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {guest.linked_to ? (
                    <>
                      <Badge variant="neutral">Konto: {guest.linked_to}</Badge>
                      <Button variant="ghost" size="sm" loading={unlink.isPending} onClick={() => handleUnlink(guest)}>
                        Odłącz
                      </Button>
                    </>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setLinking(guest)}>
                      Powiąż z kontem
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      {linking && <LinkGuestModal guest={linking} contacts={contacts} onClose={() => setLinking(null)} />}
      {addingContact && <AddContactModal onClose={() => setAdding(false)} />}
    </div>
  );
}

// ── Code input shared by both modals ──────────────────────────────────────────

function CodeField({ value, onChange, onSubmit, error }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; error: string | null;
}) {
  return (
    <Field
      label="Kod od gracza"
      hint="Gracz znajdzie go w swoim profilu, w sekcji „Kod dla organizatorów”."
      error={error}
    >
      <Input
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value.toUpperCase())}
        onKeyDown={e => e.key === 'Enter' && value.trim() && onSubmit()}
        placeholder="np. K7QM-3XPA"
        maxLength={12}
      />
    </Field>
  );
}

function AddContactModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const check = useCheckContactCode();
  const add   = useAddContact();
  const name  = check.data?.name;

  function handleChange(value: string) {
    setCode(value);
    check.reset();
    add.reset();
  }

  return (
    <Modal
      title="Dodaj gracza z kontem"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          {name ? (
            <Button variant="primary" loading={add.isPending} onClick={() => add.mutate(code, { onSuccess: onClose })}>
              Dodaj: {name}
            </Button>
          ) : (
            <Button variant="primary" disabled={!code.trim()} loading={check.isPending} onClick={() => check.mutate(code)}>
              Sprawdź kod
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <CodeField value={code} onChange={handleChange} onSubmit={() => !name && check.mutate(code)} error={errorText(check.error) ?? errorText(add.error)} />
        {name && (
          <p className="text-sm text-content-secondary">
            Kod należy do gracza <span className="font-semibold text-content-primary">{name}</span>. Po dodaniu
            pojawi się w kreatorze turnieju i w składach Twoich lig.
          </p>
        )}
      </div>
    </Modal>
  );
}

function LinkGuestModal({ guest, contacts, onClose }: { guest: GuestPlayer; contacts: Contact[]; onClose: () => void }) {
  const [code, setCode]           = useState('');
  const [contactId, setContactId] = useState<number | null>(null);
  const check = useCheckLinkCode();
  const link  = useLinkGuest();

  // A contact already gave their code; anyone else needs a fresh one.
  const target = contactId != null ? { contactId } : { code };
  const owner  = check.data?.linked_to;

  function reset() {
    check.reset();
    link.reset();
  }

  function pickContact(id: number) {
    setContactId(current => (current === id ? null : id));
    setCode('');
    reset();
  }

  function handleCode(value: string) {
    setCode(value);
    setContactId(null);
    reset();
  }

  const canCheck = contactId != null || !!code.trim();

  return (
    <Modal
      title={`Powiąż: ${guest.name}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          {owner ? (
            <Button
              variant="primary"
              loading={link.isPending}
              onClick={() => link.mutate({ guestId: guest.id, target }, { onSuccess: onClose })}
            >
              Powiąż z {owner}
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!canCheck}
              loading={check.isPending}
              onClick={() => check.mutate({ guestId: guest.id, target })}
            >
              Dalej
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {contacts.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-content-secondary">Twój gracz z kontem</p>
            <div className="flex flex-wrap gap-2">
              {contacts.map(c => (
                <OptionButton key={c.id} selected={contactId === c.id} onClick={() => pickContact(c.id)}>
                  {c.name}
                </OptionButton>
              ))}
            </div>
            <p className="text-xs text-content-faint">albo wpisz kod od innego gracza:</p>
          </div>
        )}

        <CodeField
          value={code}
          onChange={handleCode}
          onSubmit={() => !owner && check.mutate({ guestId: guest.id, target })}
          error={errorText(check.error) ?? errorText(link.error)}
        />

        {owner && (
          <p className="text-sm text-content-secondary">
            Łączysz „{guest.name}” z kontem gracza <span className="font-semibold text-content-primary">{owner}</span>.
            Jego wyniki ({eventsLabel(guest.tournaments)}) trafią do statystyk tego gracza. Możesz to później cofnąć.
          </p>
        )}
      </div>
    </Modal>
  );
}
