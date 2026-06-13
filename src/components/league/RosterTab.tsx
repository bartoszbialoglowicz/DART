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

type PendingLink = { memberId: number; memberName: string; player: Player };

export function RosterTab({ leagueId, isDraft }: { leagueId: number; isDraft: boolean }) {
  const { data: league }      = useLeague(leagueId);
  const { data: playersData } = usePlayers();
  const addMember             = useAddLeagueMember(leagueId);
  const removeMember          = useRemoveLeagueMember(leagueId);
  const linkPlayer            = useLinkPlayer(leagueId);

  const [mode, setMode]                         = useState<'player' | 'placeholder'>('player');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [placeholderName, setPlaceholderName]   = useState('');
  const [search, setSearch]                     = useState('');
  const [linkingId, setLinkingId]               = useState<number | null>(null);
  const [linkSearch, setLinkSearch]             = useState('');
  const [pendingLink, setPendingLink]           = useState<PendingLink | null>(null);

  const allPlayers: Player[]  = playersData ?? [];
  const members               = league?.members ?? [];
  const memberPlayerIds       = new Set(members.map(m => m.player_id).filter(Boolean));

  const filtered = allPlayers.filter(p =>
    !memberPlayerIds.has(p.id) &&
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const linkFiltered = allPlayers.filter(p =>
    !memberPlayerIds.has(p.id) &&
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(linkSearch.toLowerCase())
  );

  function handleAdd() {
    if (mode === 'player' && selectedPlayerId) {
      addMember.mutate({ player_id: selectedPlayerId }, {
        onSuccess: () => { setSelectedPlayerId(null); setSearch(''); },
      });
    } else if (mode === 'placeholder' && placeholderName.trim()) {
      addMember.mutate({ display_name: placeholderName.trim() }, {
        onSuccess: () => setPlaceholderName(''),
      });
    }
  }

  function selectPlayerForLink(memberId: number, memberName: string, player: Player) {
    setPendingLink({ memberId, memberName, player });
    setLinkSearch('');
  }

  function confirmLink() {
    if (!pendingLink) return;
    linkPlayer.mutate(
      { memberId: pendingLink.memberId, playerId: pendingLink.player.id },
      { onSuccess: () => { setPendingLink(null); setLinkingId(null); } },
    );
  }

  function closeLinkPanel(memberId: number) {
    if (linkingId === memberId) { setLinkingId(null); setLinkSearch(''); setPendingLink(null); }
    else { setLinkingId(memberId); setLinkSearch(''); setPendingLink(null); }
  }

  const pendingMembers = members.filter(m => m.status === 'pending');
  const activeMembers  = members.filter(m => m.status === 'active');

  return (
    <div className="flex flex-col gap-5">

      {/* Add form — only when draft */}
      {isDraft && (
        <div className="rounded-xl border border-border-subtle bg-white/3 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-content-secondary">Dodaj gracza</p>

          <div className="mb-3 flex gap-2">
            {(['player', 'placeholder'] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={[
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  mode === m
                    ? 'border-brand-purple bg-brand-purple/10 text-brand-white'
                    : 'border-border-subtle text-content-secondary hover:border-brand-purple/50 hover:text-brand-white',
                ].join(' ')}>
                {m === 'player' ? 'Zarejestrowany gracz' : 'Placeholder (niezarejestrowany)'}
              </button>
            ))}
          </div>

          {mode === 'player' ? (
            <div className="flex flex-col gap-2">
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Szukaj gracza…"
                className="rounded-lg border border-border-subtle bg-brand-black px-3 py-2 text-sm text-brand-white placeholder:text-content-secondary focus:border-brand-purple focus:outline-none transition-colors"
              />
              {search && (
                <div className="max-h-44 overflow-y-auto rounded-lg border border-border-subtle bg-brand-black">
                  {filtered.length === 0
                    ? <p className="px-4 py-3 text-sm text-content-secondary">Brak wyników.</p>
                    : filtered.slice(0, 8).map(p => (
                      <button key={p.id} type="button"
                        onClick={() => { setSelectedPlayerId(p.id); setSearch(`${p.first_name} ${p.last_name}`); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-content-secondary hover:bg-white/5 hover:text-brand-white transition-colors">
                        {p.first_name} {p.last_name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <input
              type="text" value={placeholderName} onChange={e => setPlaceholderName(e.target.value)}
              placeholder="Imię i nazwisko (np. Anna Kowalska)"
              className="w-full rounded-lg border border-border-subtle bg-brand-black px-3 py-2 text-sm text-brand-white placeholder:text-content-secondary focus:border-brand-purple focus:outline-none transition-colors"
            />
          )}

          <button
            type="button" onClick={handleAdd}
            disabled={addMember.isPending || (mode === 'player' ? !selectedPlayerId : !placeholderName.trim())}
            className="mt-3 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-brand-white transition-opacity disabled:opacity-40 hover:bg-brand-purple/80">
            {addMember.isPending ? 'Dodawanie…' : 'Dodaj'}
          </button>
        </div>
      )}

      {/* Members list */}
      {members.length === 0 ? (
        <EmptyMsg>Brak graczy w lidze.</EmptyMsg>
      ) : (
        <div className="flex flex-col gap-2">

          {activeMembers.map(member => (
            <div key={member.id}
              className="flex items-center justify-between rounded-xl border border-border-subtle bg-white/3 px-4 py-3">
              <span className="text-sm font-medium text-brand-white">{member.display_name}</span>
              {isDraft && (
                <button type="button"
                  onClick={() => { if (confirm(`Usunąć ${member.display_name}?`)) removeMember.mutate(member.id); }}
                  className="rounded p-1 text-content-secondary hover:text-red-400 transition-colors"
                  aria-label="Usuń">
                  ✕
                </button>
              )}
            </div>
          ))}

          {pendingMembers.map(member => (
            <div key={member.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-brand-white">{member.display_name}</span>
                  <PendingBadge />
                </div>
                <div className="flex items-center gap-2">
                  <button type="button"
                    onClick={() => closeLinkPanel(member.id)}
                    className="rounded-lg border border-amber-500/30 px-3 py-1 text-xs font-medium text-amber-400 hover:border-amber-500/60 transition-colors">
                    {linkingId === member.id ? 'Zamknij' : 'Powiąż z kontem'}
                  </button>
                  {isDraft && (
                    <button type="button"
                      onClick={() => { if (confirm(`Usunąć ${member.display_name}?`)) removeMember.mutate(member.id); }}
                      className="rounded p-1 text-content-secondary hover:text-red-400 transition-colors"
                      aria-label="Usuń">
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Link panel */}
              {linkingId === member.id && (
                <div className="mt-3 border-t border-amber-500/15 pt-3">
                  {pendingLink && pendingLink.memberId === member.id ? (
                    <div className="rounded-lg border border-brand-purple/30 bg-brand-purple/8 px-4 py-3">
                      <p className="mb-0.5 text-xs text-content-secondary">Potwierdzenie powiązania</p>
                      <p className="text-sm text-brand-white">
                        Czy chcesz powiązać{' '}
                        <span className="font-semibold text-amber-300">{pendingLink.memberName}</span>
                        {' '}z kontem{' '}
                        <span className="font-semibold text-brand-purple">
                          {pendingLink.player.first_name} {pendingLink.player.last_name}
                        </span>
                        ?
                      </p>
                      <p className="mt-0.5 text-xs text-content-secondary">
                        Ta operacja jest nieodwracalna — wyniki meczów pozostaną przypisane do tego gracza.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={confirmLink}
                          disabled={linkPlayer.isPending}
                          className="rounded-lg bg-brand-purple px-4 py-1.5 text-sm font-semibold text-brand-white transition-opacity disabled:opacity-40 hover:bg-brand-purple/80">
                          {linkPlayer.isPending ? 'Zapisywanie…' : 'Potwierdź'}
                        </button>
                        <button type="button" onClick={() => setPendingLink(null)}
                          className="rounded-lg border border-border-subtle px-4 py-1.5 text-sm font-medium text-content-secondary hover:text-brand-white transition-colors">
                          Anuluj
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text" value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
                        placeholder="Szukaj zarejestrowanego gracza…"
                        autoFocus
                        className="rounded-lg border border-border-subtle bg-brand-black px-3 py-2 text-sm text-brand-white placeholder:text-content-secondary focus:border-brand-purple focus:outline-none transition-colors"
                      />
                      {linkSearch && (
                        <div className="max-h-36 overflow-y-auto rounded-lg border border-border-subtle bg-brand-black">
                          {linkFiltered.length === 0
                            ? <p className="px-4 py-3 text-sm text-content-secondary">Brak wyników.</p>
                            : linkFiltered.slice(0, 6).map(p => (
                              <button key={p.id} type="button"
                                onClick={() => selectPlayerForLink(member.id, member.display_name, p)}
                                className="w-full px-4 py-2.5 text-left text-sm text-content-secondary hover:bg-white/5 hover:text-brand-white transition-colors">
                                {p.first_name} {p.last_name}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
