import { useState } from 'react';
import {
  useLeague,
  useAddLeagueMember,
  useRemoveLeagueMember,
  useLinkPlayer,
} from '../../hooks/useLeagues';
import { usePlayers } from '../../hooks/usePlayers';
import type { Player } from '../../types/player';
import { PendingBadge, EmptyMsg } from './shared';
import { PlayerSearchSelect } from './PlayerSearchSelect';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Tag } from '../ui/Tag';
import { Modal } from '../ui/Modal';

type Mode = 'player' | 'placeholder';
type PendingLink = { memberId: number; memberName: string; player: Player };
type RemoveTarget = { id: number; name: string };

const MODE_OPTIONS = [
  { value: 'player'      as Mode, label: 'Zarejestrowany' },
  { value: 'placeholder' as Mode, label: 'Placeholder' },
];

export function RosterTab({ leagueId, isDraft, isOwner }: { leagueId: number; isDraft: boolean; isOwner: boolean }) {
  const { data: league }      = useLeague(leagueId);
  const { data: playersData } = usePlayers();
  const addMember             = useAddLeagueMember(leagueId);
  const removeMember          = useRemoveLeagueMember(leagueId);
  const linkPlayer            = useLinkPlayer(leagueId);

  const [mode, setMode]                       = useState<Mode>('player');
  const [selectedPlayer, setSelectedPlayer]   = useState<Player | null>(null);
  const [placeholderName, setPlaceholderName] = useState('');
  const [linkingId, setLinkingId]             = useState<number | null>(null);
  const [pendingLink, setPendingLink]         = useState<PendingLink | null>(null);
  const [removeTarget, setRemoveTarget]       = useState<RemoveTarget | null>(null);

  const allPlayers: Player[] = playersData ?? [];
  const members              = league?.members ?? [];
  const memberPlayerIds      = new Set(
    members.map(m => m.player_id).filter((id): id is number => id != null),
  );

  function handleAdd() {
    if (mode === 'player' && selectedPlayer) {
      addMember.mutate({ player_id: selectedPlayer.id }, {
        onSuccess: () => setSelectedPlayer(null),
      });
    } else if (mode === 'placeholder' && placeholderName.trim()) {
      addMember.mutate({ display_name: placeholderName.trim() }, {
        onSuccess: () => setPlaceholderName(''),
      });
    }
  }

  function toggleLinkPanel(memberId: number) {
    setPendingLink(null);
    setLinkingId(id => (id === memberId ? null : memberId));
  }

  function confirmLink() {
    if (!pendingLink) return;
    linkPlayer.mutate(
      { memberId: pendingLink.memberId, playerId: pendingLink.player.id },
      { onSuccess: () => { setPendingLink(null); setLinkingId(null); } },
    );
  }

  const canAdd = mode === 'player' ? !!selectedPlayer : !!placeholderName.trim();

  const pendingMembers = members.filter(m => m.status === 'pending');
  const activeMembers  = members.filter(m => m.status === 'active');

  return (
    <div className="flex flex-col gap-5">

      {/* Add form — only when draft */}
      {isDraft && (
        <div className="rounded-xl border border-border-subtle bg-surface-overlay p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-content-secondary">Dodaj gracza</p>

          <SegmentedControl
            className="mb-3"
            fullWidth
            aria-label="Typ gracza"
            value={mode}
            onChange={setMode}
            options={MODE_OPTIONS}
          />

          {mode === 'player' ? (
            <div className="flex flex-col gap-2">
              <PlayerSearchSelect
                players={allPlayers}
                excludeIds={memberPlayerIds}
                placeholder="Szukaj gracza…"
                onSelect={setSelectedPlayer}
              />
              {selectedPlayer && (
                <div className="flex items-center gap-2 text-sm text-content-secondary">
                  <span>Wybrany:</span>
                  <Tag>{selectedPlayer.first_name} {selectedPlayer.last_name}</Tag>
                  <button
                    type="button"
                    onClick={() => setSelectedPlayer(null)}
                    className="text-content-faint transition-colors hover:text-content-primary"
                    aria-label="Wyczyść wybór"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Input
              type="text"
              value={placeholderName}
              onChange={e => setPlaceholderName(e.target.value)}
              placeholder="Imię i nazwisko (np. Anna Kowalska)"
            />
          )}

          <Button
            className="mt-3"
            variant="primary"
            loading={addMember.isPending}
            disabled={addMember.isPending || !canAdd}
            onClick={handleAdd}
          >
            Dodaj
          </Button>
        </div>
      )}

      {/* Members list */}
      {members.length === 0 ? (
        <EmptyMsg>Brak graczy w lidze.</EmptyMsg>
      ) : (
        <div className="flex flex-col gap-2">

          {activeMembers.map(member => (
            <div key={member.id}
              className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-overlay px-4 py-3">
              <span className="text-sm font-medium text-content-primary">{member.display_name}</span>
              {isDraft && (
                <button type="button"
                  onClick={() => setRemoveTarget({ id: member.id, name: member.display_name })}
                  className="rounded p-1 text-content-secondary transition-colors hover:text-score-down-text"
                  aria-label="Usuń">
                  ✕
                </button>
              )}
            </div>
          ))}

          {pendingMembers.map(member => (
            <div key={member.id} className="rounded-xl border border-border-subtle bg-rank-soft px-4 py-3">
              {/* Header row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-content-primary">{member.display_name}</span>
                  <PendingBadge />
                </div>
                <div className="flex items-center gap-2">
                  {isOwner && (
                    <Button variant="secondary" size="sm" onClick={() => toggleLinkPanel(member.id)}>
                      {linkingId === member.id ? 'Zamknij' : 'Powiąż z kontem'}
                    </Button>
                  )}
                  {isDraft && (
                    <button type="button"
                      onClick={() => setRemoveTarget({ id: member.id, name: member.display_name })}
                      className="rounded p-1 text-content-secondary transition-colors hover:text-score-down-text"
                      aria-label="Usuń">
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Link panel */}
              {linkingId === member.id && (
                <div className="mt-3 border-t border-border-subtle pt-3">
                  {pendingLink && pendingLink.memberId === member.id ? (
                    <div className="rounded-lg border border-border-subtle bg-accent-soft px-4 py-3">
                      <p className="mb-0.5 text-xs text-content-secondary">Potwierdzenie powiązania</p>
                      <p className="text-sm text-content-primary">
                        Czy chcesz powiązać{' '}
                        <span className="font-semibold text-rank-text">{pendingLink.memberName}</span>
                        {' '}z kontem{' '}
                        <span className="font-semibold text-content-accent">
                          {pendingLink.player.first_name} {pendingLink.player.last_name}
                        </span>
                        ?
                      </p>
                      <p className="mt-0.5 text-xs text-content-secondary">
                        Ta operacja jest nieodwracalna — wyniki meczów pozostaną przypisane do tego gracza.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button variant="primary" size="sm" loading={linkPlayer.isPending} onClick={confirmLink}>
                          Potwierdź
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setPendingLink(null)}>
                          Anuluj
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <PlayerSearchSelect
                      players={allPlayers}
                      excludeIds={memberPlayerIds}
                      placeholder="Szukaj zarejestrowanego gracza…"
                      autoFocus
                      limit={6}
                      onSelect={p => setPendingLink({ memberId: member.id, memberName: member.display_name, player: p })}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Remove confirmation */}
      {removeTarget && (
        <Modal title="Usunąć gracza?" size="xs" onClose={() => setRemoveTarget(null)}>
          <p className="text-sm text-content-secondary">
            Czy na pewno usunąć <span className="font-semibold text-content-primary">{removeTarget.name}</span> z ligi?
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>Anuluj</Button>
            <Button
              variant="danger"
              loading={removeMember.isPending}
              onClick={() => removeMember.mutate(removeTarget.id, { onSuccess: () => setRemoveTarget(null) })}
            >
              Usuń
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
