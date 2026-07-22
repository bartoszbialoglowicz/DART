import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LeagueMatch } from '../../types/league';
import { Modal } from '../ui/Modal';
import { cn } from '../ui/cn';
import { LeagueScoreForm, type LeagueScorePayload } from './LeagueScoreForm';

type Props = {
  leagueId:      number;
  match:         LeagueMatch;
  homeIsCpu:     boolean;
  awayIsCpu:     boolean;
  onEnterResult: (matchId: number, payload: LeagueScorePayload) => void;
  onClose:       () => void;
  entering?:     boolean;
};

type View = 'menu' | 'enter';

export function LeagueMatchActionMenu({
  leagueId, match, homeIsCpu, awayIsCpu, onEnterResult, onClose, entering,
}: Props) {
  const navigate     = useNavigate();
  const [view, setView] = useState<View>('menu');
  const bothCpu = homeIsCpu && awayIsCpu;

  function handleConfirm(payload: LeagueScorePayload) {
    onEnterResult(match.id, payload);
  }

  return (
    <Modal size="xs" onClose={onClose} ariaLabel="Akcje meczu">
      <div className="mb-3 border-b border-border-subtle pb-3">
        <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">Mecz</p>
        <div className="mt-2 flex flex-col gap-1">
          <span className="text-sm font-medium text-content-primary">{match.home_name}</span>
          <span className="self-center text-xs text-content-secondary">vs</span>
          <span className="text-sm font-medium text-content-primary">{match.away_name}</span>
        </div>
      </div>

      {view === 'menu' ? (
        <div className="flex flex-col">
          <MenuButton
            onClick={() => navigate(`/ligi/${leagueId}/live/${match.id}`)}
            icon="📡"
            label={bothCpu ? 'Symuluj na żywo' : 'Na żywo'}
          />
          <MenuButton
            onClick={() => setView('enter')}
            icon="✏️"
            label="Wpisz wynik"
          />
        </div>
      ) : (
        <LeagueScoreForm
          homeName={match.home_name}
          awayName={match.away_name}
          initial={match}
          onCancel={() => setView('menu')}
          onConfirm={handleConfirm}
          confirmLoading={entering}
        />
      )}
    </Modal>
  );
}

function MenuButton({ onClick, icon, label }: { onClick: () => void; icon: string; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors',
        'text-content-primary hover:bg-surface-muted',
      )}
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
