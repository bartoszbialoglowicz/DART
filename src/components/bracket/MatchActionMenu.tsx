import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { BracketMatch, MatchSlot } from '../../types/bracket';
import type { MatchFormat } from '../../types/tournament';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';

type Props = {
  match:          BracketMatch;
  matchFormat:    MatchFormat;
  isOwner:        boolean;
  onSimulate?:    (matchId: string) => void;
  onEnterResult?: (matchId: string, topScore: number, bottomScore: number) => void;
  onClose:        () => void;
  hideLive?:      boolean;
};

type View = 'menu' | 'enter';

export function MatchActionMenu({ match, matchFormat, isOwner, onSimulate, onEnterResult, onClose, hideLive = false }: Props) {
  const { top, bottom } = match;
  const { id }          = useParams<{ id: string }>();
  const navigate        = useNavigate();
  const [view,        setView]        = useState<View>('menu');
  const [topScore,    setTopScore]    = useState(0);
  const [bottomScore, setBottomScore] = useState(0);

  const hasPlayers = top.playerId !== null && bottom.playerId !== null;
  const bothCpu    = top.isCpu && bottom.isCpu;

  const toWin = matchFormat.sets === 1
    ? Math.ceil(matchFormat.legs / 2)
    : Math.ceil(matchFormat.sets / 2);

  const canConfirm = (topScore === toWin && bottomScore < toWin)
                  || (bottomScore === toWin && topScore < toWin);

  function handleSimulate() {
    onSimulate?.(match.id);
    onClose();
  }

  function handleConfirm() {
    onEnterResult?.(match.id, topScore, bottomScore);
    onClose();
  }

  return (
    <Modal size="xs" onClose={onClose} ariaLabel="Akcje meczu">
      {/* Match header */}
      <div className="mb-3 border-b border-border-subtle pb-3">
        <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">
          Mecz
        </p>
        <div className="mt-2 flex flex-col gap-1">
          <PlayerRow slot={top} />
          <span className="self-center text-xs text-content-secondary">vs</span>
          <PlayerRow slot={bottom} />
        </div>
      </div>

      {/* Content */}
      {view === 'menu' ? (
        <div className="flex flex-col">
          {isOwner && hasPlayers && bothCpu && (
            <MenuButton onClick={handleSimulate} icon="⚡" label="Symuluj" />
          )}
          {isOwner && hasPlayers && (
            <MenuButton
              onClick={() => { setTopScore(0); setBottomScore(0); setView('enter'); }}
              icon="✏️"
              label="Wpisz wynik"
            />
          )}
          {isOwner && (
            <MenuButton onClick={() => {}} icon="👁" label="Podgląd" disabled />
          )}
          {!hideLive && <MenuButton onClick={() => navigate(`/turnieje/${id}/live/${match.id}`)} icon="📡" label="Na żywo" />}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ScoreRow slot={top}    score={topScore}    toWin={toWin} onChange={d => setTopScore(v    => Math.max(0, Math.min(toWin, v + d)))} />
          <ScoreRow slot={bottom} score={bottomScore} toWin={toWin} onChange={d => setBottomScore(v => Math.max(0, Math.min(toWin, v + d)))} />

          <div className="mt-1 flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setView('menu')}>Wróć</Button>
            <Button variant="primary" fullWidth disabled={!canConfirm} onClick={handleConfirm}>Potwierdź</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function PlayerRow({ slot }: { slot: MatchSlot }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-content-primary">
        {slot.playerName ?? <span className="text-content-faint">TBD</span>}
      </span>
      {slot.playerAvg !== null && (
        <span className="text-xs text-content-secondary">{slot.playerAvg}</span>
      )}
    </div>
  );
}

function MenuButton({
  onClick, icon, label, disabled = false,
}: {
  onClick: () => void; icon: string; label: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors',
        disabled
          ? 'cursor-default text-content-secondary opacity-40'
          : 'text-content-primary hover:bg-surface-muted',
      )}
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
      {disabled && (
        <span className="ml-auto text-xs font-normal tracking-wide text-content-faint">
          wkrótce
        </span>
      )}
    </button>
  );
}

function ScoreRow({
  slot, score, toWin, onChange,
}: {
  slot: MatchSlot; score: number; toWin: number; onChange: (delta: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 flex-1 truncate text-sm text-content-primary">
        {slot.playerName ?? '—'}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(-1)}
          disabled={score <= 0}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-subtle text-sm text-content-secondary transition-colors hover:text-content-primary disabled:opacity-30"
        >
          −
        </button>
        <span className="w-6 text-center font-display text-sm font-bold tabular-nums text-content-primary">
          {score}
        </span>
        <button
          type="button"
          onClick={() => onChange(1)}
          disabled={score >= toWin}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-subtle text-sm text-content-secondary transition-colors hover:text-content-primary disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
