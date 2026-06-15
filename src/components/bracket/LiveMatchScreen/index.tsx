import type { BracketMatch, LegRecord, LegRound } from '../../../types/bracket';
import type { MatchFormat } from '../../../types/tournament';
import { MatchSummaryScreen } from '../../match/MatchSummaryScreen';
import { useMatchEngine } from './useMatchEngine';
import { PlayerHeader } from './PlayerHeader';
import { DoubleModal } from './DoubleModal';
import { NumKey, type KeyVar } from './NumKey';

type Props = {
  match:            BracketMatch;
  matchFormat:      MatchFormat;
  isOwner:          boolean;
  onClose:          () => void;
  onResult:         (topScore: number, bottomScore: number) => void;
  onLegComplete?:   (legs: LegRecord[], rounds: LegRound[], activePlayer: 0 | 1) => void;
  onScoreEntered?:  (rounds: LegRound[], activePlayer: 0 | 1) => void;
};

export function LiveMatchScreen(props: Props) {
  const { match, matchFormat, isOwner, onClose, onResult } = props;
  const { top, bottom } = match;

  const engine = useMatchEngine(props);
  const {
    rounds, activePlayer, input, editTarget, legsWon, setsWon,
    phase, legWinner, completedLegs, doubleModalPending,
    p0Remaining, p1Remaining, inputNum, effectiveMax,
    isOverMax, editWouldCheckout, canConfirm,
    isCpuTurn, isMultiSet, canToggleStart,
    p0Pending, p1Pending, overlayScore, activeSlot,
    p0LegAvg, p1LegAvg, p0MatchAvg, p1MatchAvg,
    bottomRef,
    pressDigit, pressClear, confirmScore, applyScore,
    setStartPlayer, startNext, finishMatch,
    setEditTarget, setDoubleModalPending, openEdit,
  } = engine;

  const playerName = (idx: 0 | 1) =>
    idx === 0 ? (top.playerName ?? 'Gracz 1') : (bottom.playerName ?? 'Gracz 2');

  type Key = { label: string; onPress: () => void; variant: KeyVar };
  const rows: Key[][] = [
    [
      { label: '1', onPress: () => pressDigit('1'), variant: 'digit' },
      { label: '2', onPress: () => pressDigit('2'), variant: 'digit' },
      { label: '3', onPress: () => pressDigit('3'), variant: 'digit' },
    ],
    [
      { label: '4', onPress: () => pressDigit('4'), variant: 'digit' },
      { label: '5', onPress: () => pressDigit('5'), variant: 'digit' },
      { label: '6', onPress: () => pressDigit('6'), variant: 'digit' },
    ],
    [
      { label: '7', onPress: () => pressDigit('7'), variant: 'digit' },
      { label: '8', onPress: () => pressDigit('8'), variant: 'digit' },
      { label: '9', onPress: () => pressDigit('9'), variant: 'digit' },
    ],
    [
      { label: 'C',  onPress: pressClear,            variant: 'clear' },
      { label: '0',  onPress: () => pressDigit('0'), variant: 'digit' },
      { label: 'OK', onPress: confirmScore,          variant: 'ok'    },
    ],
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-black select-none">

      {/* ── Top section ──────────────────────────────────── */}
      <div className="flex flex-col overflow-hidden" style={{ height: isOwner ? '60%' : '100%' }}>

        {/* Header bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">
            Na żywo
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-content-secondary hover:text-brand-white transition-colors"
          >
            Zamknij
          </button>
        </div>

        {/* Player headers */}
        <div className="flex shrink-0 border-b border-border-subtle">
          <PlayerHeader
            name={top.playerName ?? 'Gracz 1'}
            remaining={p0Remaining}
            legsWon={legsWon[0]}
            setsWon={isMultiSet ? setsWon[0] : undefined}
            legAvg={p0LegAvg}
            matchAvg={p0MatchAvg}
            isActive={activePlayer === 0}
            align="left"
            onClick={canToggleStart ? () => setStartPlayer(0) : undefined}
          />
          <div className="w-14 shrink-0 border-x border-border-subtle flex flex-col items-center justify-center py-3 gap-1">
            {canToggleStart ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4 text-brand-purple/50">
                <path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" />
              </svg>
            ) : (
              <span className="text-xs text-content-secondary">🎯</span>
            )}
          </div>
          <PlayerHeader
            name={bottom.playerName ?? 'Gracz 2'}
            remaining={p1Remaining}
            legsWon={legsWon[1]}
            setsWon={isMultiSet ? setsWon[1] : undefined}
            legAvg={p1LegAvg}
            matchAvg={p1MatchAvg}
            isActive={activePlayer === 1}
            align="right"
            onClick={canToggleStart ? () => setStartPlayer(1) : undefined}
          />
        </div>

        {/* Scoreboard */}
        <div className="flex-1 overflow-y-auto">
          {rounds.map((round, i) => {
            const darts         = (i + 1) * 3;
            const showP1Preview = p1Pending && i === rounds.length - 1;
            const isEditRow     = editTarget?.roundIdx === i;
            const canEdit       = isOwner && phase === 'playing' && !isCpuTurn;

            return (
              <div key={i} className={`flex items-center border-b border-border-subtle/20 ${isEditRow ? 'bg-brand-purple/10' : ''}`}>
                <div
                  className={[
                    'flex flex-1 items-center justify-between px-3 py-2.5',
                    canEdit && round.p0 ? 'cursor-pointer active:bg-brand-purple/10' : '',
                  ].join(' ')}
                  onPointerDown={canEdit && round.p0 ? (e) => { e.preventDefault(); openEdit(i, 0); } : undefined}
                >
                  {round.p0 && (
                    <>
                      <span className={[
                        'text-xl font-semibold tabular-nums',
                        isEditRow && editTarget?.player === 0 ? 'text-brand-purple' : 'text-brand-white',
                      ].join(' ')}>
                        {round.p0.score}
                      </span>
                      <span className="text-xl tabular-nums text-content-secondary">
                        {round.p0.remaining}
                      </span>
                    </>
                  )}
                </div>

                <div className="w-14 shrink-0 border-x border-border-subtle flex items-center justify-center py-2.5">
                  <span className="text-base tabular-nums text-content-secondary">{darts}</span>
                </div>

                <div
                  className={[
                    'flex flex-1 items-center justify-between px-3 py-2.5',
                    canEdit && round.p1 ? 'cursor-pointer active:bg-brand-purple/10' : '',
                  ].join(' ')}
                  onPointerDown={canEdit && round.p1 ? (e) => { e.preventDefault(); openEdit(i, 1); } : undefined}
                >
                  {round.p1 ? (
                    <>
                      <span className="text-xl tabular-nums text-content-secondary">
                        {round.p1.remaining}
                      </span>
                      <span className={[
                        'text-xl font-semibold tabular-nums',
                        isEditRow && editTarget?.player === 1 ? 'text-brand-purple' : 'text-brand-white',
                      ].join(' ')}>
                        {round.p1.score}
                      </span>
                    </>
                  ) : showP1Preview ? (
                    <>
                      <span className="text-base tabular-nums text-content-secondary opacity-50">
                        {p1Remaining - inputNum}
                      </span>
                      <span className="text-base font-semibold tabular-nums text-brand-purple opacity-60">
                        {inputNum}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}

          {p0Pending && (
            <div className="flex items-center border-b border-border-subtle/20 opacity-50">
              <div className="flex flex-1 items-center justify-between px-3 py-2.5">
                <span className="text-base font-semibold tabular-nums text-brand-purple">{inputNum}</span>
                <span className="text-base tabular-nums text-content-secondary">{p0Remaining - inputNum}</span>
              </div>
              <div className="w-14 shrink-0 border-x border-border-subtle flex items-center justify-center py-2.5">
                <span className="text-sm tabular-nums text-white/20">{(rounds.length + 1) * 3}</span>
              </div>
              <div className="flex-1" />
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {input !== '' && (
          <div className="shrink-0 flex items-baseline justify-center gap-3 border-t border-border-subtle/30 px-4 py-2.5">
            <span className={[
              'text-4xl font-black tabular-nums leading-none',
              isOverMax || editWouldCheckout ? 'text-red-400' : 'text-brand-white',
            ].join(' ')}>
              {inputNum}
            </span>
            {!isOverMax && !editWouldCheckout ? (
              <span className="text-lg tabular-nums text-content-secondary leading-none">
                → {effectiveMax - inputNum}
              </span>
            ) : (
              <span className="text-sm text-red-400 leading-none">
                {isOverMax ? `max ${effectiveMax}` : 'nie można zamknąć lega'}
              </span>
            )}
          </div>
        )}
      </div>

      {isOwner && (
        <>
          <div className="h-px shrink-0 bg-border-subtle" />

          {/* ── Bottom 40% — numpad or CPU thinking ──────────── */}
          <div className="flex flex-col gap-2 p-4" style={{ height: '40%' }}>
            {editTarget !== null && (
              <div className="flex shrink-0 items-center justify-between rounded-lg border border-brand-purple/30 bg-brand-purple/10 px-3 py-1.5">
                <span className="text-xs text-content-secondary">
                  Edycja: <span className="font-semibold text-brand-white">{playerName(editTarget.player)}</span>
                  {' · runda '}{editTarget.roundIdx + 1}
                  {' · stary wynik: '}
                  <span className="font-semibold text-brand-white">
                    {editTarget.player === 0
                      ? rounds[editTarget.roundIdx].p0?.score
                      : rounds[editTarget.roundIdx].p1?.score}
                  </span>
                </span>
                <button
                  type="button"
                  onPointerDown={(e) => { e.preventDefault(); setEditTarget(null); setInput(''); }}
                  className="ml-2 shrink-0 text-xs text-content-secondary hover:text-brand-white"
                >
                  Anuluj
                </button>
              </div>
            )}
            {isCpuTurn ? (
              <div className="flex flex-1 items-center justify-center">
                <span className="animate-pulse text-sm text-content-secondary">
                  {activeSlot.playerName ?? 'CPU'} rzuca…
                </span>
              </div>
            ) : (
              <>
                {rows.map((row, ri) => (
                  <div key={ri} className="grid grid-cols-3 gap-2 flex-1">
                    {row.map(({ label, onPress, variant }) => (
                      <NumKey
                        key={label}
                        label={label}
                        variant={variant}
                        onPress={onPress}
                        disabled={variant === 'ok' && !canConfirm}
                      />
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* ── Leg / Set won overlay ─────────────────── */}
      {(phase === 'leg-won' || phase === 'set-won') && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-brand-black/95 px-8">
          <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">
            {phase === 'set-won' ? 'Set dla' : 'Leg dla'}
          </span>
          <span className="mt-2 text-center text-4xl font-black text-brand-white">
            {playerName(legWinner)}
          </span>
          <span className="mt-3 text-2xl tabular-nums font-bold text-brand-purple">
            {overlayScore}
          </span>
          <div className="mt-10 flex gap-3 w-full max-w-xs">
            <button
              type="button"
              onClick={startNext}
              className="flex-1 rounded-xl bg-brand-purple/80 py-3 text-sm font-semibold text-brand-white hover:bg-brand-purple transition-colors"
            >
              {phase === 'set-won' ? 'Następny set' : 'Następny leg'}
            </button>
          </div>
        </div>
      )}

      {/* ── Double attempt modal ─────────────────────────── */}
      {doubleModalPending && (
        <DoubleModal
          state={doubleModalPending}
          playerName={playerName(activePlayer)}
          onConfirm={(dartsAtDouble, dartsToClose) => {
            applyScore(doubleModalPending.score, { dartsAtDouble, dartsToClose });
            setDoubleModalPending(null);
          }}
          onSkip={() => {
            applyScore(doubleModalPending.score);
            setDoubleModalPending(null);
          }}
        />
      )}

      {/* ── Match won: full summary screen ────────────────── */}
      {phase === 'match-won' && (
        <MatchSummaryScreen
          matchId={match.id}
          playerTop={top}
          playerBottom={bottom}
          completedLegs={completedLegs}
          legsWon={legsWon}
          setsWon={setsWon}
          isMultiSet={isMultiSet}
          onClose={onClose}
          onSave={isOwner ? finishMatch : undefined}
        />
      )}
    </div>
  );
}
