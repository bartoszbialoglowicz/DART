import { useState } from 'react';
import type { BracketMatch, Group, GroupsBracketData, MatchSlot } from '../../types/bracket';
import type { MatchFormat } from '../../types/tournament';
import { areGroupsComplete, computeGroupStandings, type GroupStanding } from '../../utils/bracket';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';
import { MatchActionMenu } from './MatchActionMenu';
import { KnockoutBracket } from './KnockoutBracket';

type Props = {
  data:                  GroupsBracketData;
  isOwner:               boolean;
  onSimulateGroup?:      (groupId: string, matchId: string) => void;
  onEnterGroupResult?:   (groupId: string, matchId: string, top: number, bottom: number) => void;
  onGeneratePlayoff?:    () => void;
  onSimulatePlayoff?:    (matchId: string) => void;
  onEnterPlayoffResult?: (matchId: string, top: number, bottom: number) => void;
};

const QUALIFIERS_PER_GROUP = 2;

export function GroupsBracket({
  data, isOwner,
  onSimulateGroup, onEnterGroupResult, onGeneratePlayoff,
  onSimulatePlayoff, onEnterPlayoffResult,
}: Props) {
  const { groups, playoff, matchFormat } = data;
  const allDone = areGroupsComplete(groups);

  return (
    <div className="flex flex-col gap-10 p-6">

      {/* ── Group stage ───────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-content-secondary">
          Faza grupowa
        </h2>
        <div className="flex flex-wrap gap-6">
          {groups.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              matchFormat={matchFormat}
              isOwner={isOwner}
              onSimulate={onSimulateGroup ? (matchId) => onSimulateGroup(group.id, matchId) : undefined}
              onEnterResult={onEnterGroupResult ? (matchId, t, b) => onEnterGroupResult(group.id, matchId, t, b) : undefined}
            />
          ))}
        </div>

        {isOwner && allDone && !playoff && (
          <Button variant="primary" size="lg" className="mt-6" onClick={onGeneratePlayoff}>
            Generuj play-off →
          </Button>
        )}
      </section>

      {/* ── Playoff ───────────────────────────────────────────── */}
      {playoff && (
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-content-secondary">
            Play-off
          </h2>
          <KnockoutBracket
            rounds={playoff.rounds}
            playerCount={(playoff.rounds[0]?.matches.length ?? 1) * 2}
            matchFormat={matchFormat}
            isOwner={isOwner}
            onSimulate={onSimulatePlayoff}
            onEnterResult={onEnterPlayoffResult}
          />
        </section>
      )}
    </div>
  );
}

// ── Group card ────────────────────────────────────────────────────────────────

function GroupCard({
  group, matchFormat, isOwner, onSimulate, onEnterResult,
}: {
  group:          Group;
  matchFormat:    MatchFormat;
  isOwner:        boolean;
  onSimulate?:    (matchId: string) => void;
  onEnterResult?: (matchId: string, top: number, bottom: number) => void;
}) {
  const standings = computeGroupStandings(group);
  const matches   = group.matches ?? [];

  return (
    <Card padding="none" className="w-72 shrink-0 overflow-hidden">
      <div className="border-b border-border-subtle bg-accent-soft px-4 py-2.5">
        <span className="text-xs font-bold uppercase tracking-widest text-content-accent">
          Grupa {group.label}
        </span>
      </div>

      <StandingsTable standings={standings} qualifiers={QUALIFIERS_PER_GROUP} />

      <div className="border-t border-border-subtle">
        <p className="px-4 py-2 text-xs font-medium uppercase tracking-widest text-content-faint">
          Mecze
        </p>
        {matches.map(match => (
          <GroupMatchRow
            key={match.id}
            match={match}
            matchFormat={matchFormat}
            isOwner={isOwner}
            onSimulate={onSimulate}
            onEnterResult={onEnterResult}
          />
        ))}
      </div>
    </Card>
  );
}

// ── Standings table ───────────────────────────────────────────────────────────

function StandingsTable({ standings, qualifiers }: { standings: GroupStanding[]; qualifiers: number }) {
  return (
    <div className="px-4 py-3">
      <div className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-widest text-content-faint">
        <span className="w-5 shrink-0" />
        <span className="flex-1">Gracz</span>
        <span className="w-6 text-center">M</span>
        <span className="w-6 text-center">W</span>
        <span className="w-6 text-center">L</span>
        <span className="w-8 text-center">Pkt</span>
      </div>
      {standings.map((s, i) => (
        <StandingRow key={s.slot.playerId} standing={s} rank={i + 1} advances={i < qualifiers} />
      ))}
    </div>
  );
}

function StandingRow({ standing: s, rank, advances }: { standing: GroupStanding; rank: number; advances: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-1 rounded py-1 text-xs',
      advances ? 'text-content-primary' : 'text-content-secondary opacity-70',
    )}>
      <span className="w-5 shrink-0 text-center font-bold text-content-accent">{rank}</span>
      <span className="flex-1 truncate font-medium">{s.slot.playerName ?? '—'}</span>
      <span className="w-6 text-center tabular-nums">{s.played}</span>
      <span className="w-6 text-center tabular-nums">{s.wins}</span>
      <span className="w-6 text-center tabular-nums">{s.losses}</span>
      <span className="w-8 text-center font-bold tabular-nums text-content-accent">{s.points}</span>
    </div>
  );
}

// ── Group match row ───────────────────────────────────────────────────────────

function GroupMatchRow({
  match, matchFormat, isOwner, onSimulate, onEnterResult,
}: {
  match:          BracketMatch;
  matchFormat:    MatchFormat;
  isOwner:        boolean;
  onSimulate?:    (matchId: string) => void;
  onEnterResult?: (matchId: string, top: number, bottom: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const canInteract = isOwner && !match.result
    && match.top.playerId !== null && match.bottom.playerId !== null;

  return (
    <>
      <button
        type="button"
        disabled={!canInteract}
        onClick={canInteract ? () => setOpen(true) : undefined}
        className={cn(
          'flex w-full items-center gap-2 border-t border-border-subtle px-4 py-2 text-left text-xs',
          canInteract ? 'cursor-pointer hover:bg-surface-muted' : 'cursor-default',
        )}
      >
        <PlayerLabel slot={match.top}    winner={match.result?.winner === 'top'} />
        {match.result ? (
          <span className="w-10 shrink-0 text-center font-bold tabular-nums text-content-accent">
            {match.result.displayScore}
          </span>
        ) : (
          <span className="w-10 shrink-0 text-center text-content-faint">–</span>
        )}
        <PlayerLabel slot={match.bottom} winner={match.result?.winner === 'bottom'} right />
      </button>

      {open && (
        <MatchActionMenu
          match={match}
          matchFormat={matchFormat}
          isOwner={isOwner}
          onSimulate={onSimulate}
          onEnterResult={onEnterResult}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function PlayerLabel({ slot, winner, right = false }: { slot: MatchSlot; winner: boolean; right?: boolean }) {
  return (
    <span className={cn(
      'flex-1 truncate',
      right && 'text-right',
      winner ? 'font-semibold text-content-primary' : 'text-content-secondary',
    )}>
      {slot.playerName ?? '—'}
    </span>
  );
}
