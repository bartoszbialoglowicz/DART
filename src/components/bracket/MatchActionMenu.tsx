import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { BracketMatch, MatchSlot } from '../../types/bracket';
import type { MatchFormat } from '../../types/tournament';

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSimulate() {
    onSimulate?.(match.id);
    onClose();
  }

  function handleConfirm() {
    onEnterResult?.(match.id, topScore, bottomScore);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-72 rounded-2xl border border-border-subtle bg-brand-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Match header */}
        <div className="border-b border-border-subtle px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-widest text-content-secondary">
            Mecz
          </p>
          <div className="mt-2 flex flex-col gap-1">
            <PlayerRow slot={top} />
            <span className="text-[10px] text-content-secondary self-center">vs</span>
            <PlayerRow slot={bottom} />
          </div>
        </div>

        {/* Content */}
        {view === 'menu' ? (
          <div className="flex flex-col p-2">
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
          <div className="flex flex-col gap-3 px-5 py-4">
            <ScoreRow slot={top}    score={topScore}    toWin={toWin} onChange={d => setTopScore(v    => Math.max(0, Math.min(toWin, v + d)))} />
            <ScoreRow slot={bottom} score={bottomScore} toWin={toWin} onChange={d => setBottomScore(v => Math.max(0, Math.min(toWin, v + d)))} />

            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setView('menu')}
                className="flex-1 rounded-lg border border-border-subtle py-2 text-xs font-medium text-content-secondary transition-colors hover:text-brand-white"
              >
                Wróć
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="flex-1 rounded-lg bg-brand-purple/80 py-2 text-xs font-semibold text-brand-white transition-colors hover:bg-brand-purple disabled:opacity-30"
              >
                Potwierdź
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerRow({ slot }: { slot: MatchSlot }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-brand-white">
        {slot.playerName ?? <span className="text-content-secondary opacity-50">TBD</span>}
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
      className={[
        'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-left transition-colors',
        disabled
          ? 'cursor-default text-content-secondary opacity-40'
          : 'text-brand-white hover:bg-white/5',
      ].join(' ')}
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
      {disabled && (
        <span className="ml-auto text-[10px] font-normal tracking-wide text-content-secondary opacity-70">
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
    <div className="flex items-center justify-between">
      <span className="text-sm text-brand-white truncate max-w-[140px]">
        {slot.playerName ?? '—'}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(-1)}
          disabled={score <= 0}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-subtle text-sm text-content-secondary transition-colors hover:text-brand-white disabled:opacity-30"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-bold tabular-nums text-brand-white">
          {score}
        </span>
        <button
          type="button"
          onClick={() => onChange(1)}
          disabled={score >= toWin}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-subtle text-sm text-content-secondary transition-colors hover:text-brand-white disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
