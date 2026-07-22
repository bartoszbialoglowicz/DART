import { useState } from 'react';
import type { LeagueMatch } from '../../types/league';
import { useApproveMatch, useUpdateMatch } from '../../hooks/useLeagues';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { LeagueScoreForm, type LeagueScorePayload } from './LeagueScoreForm';

type Props = {
  leagueId: number;
  match:    LeagueMatch;
  onClose:  () => void;
};

type View = 'review' | 'edit';

export function MatchApprovalModal({ leagueId, match, onClose }: Props) {
  const [view, setView] = useState<View>('review');
  const approveMatch = useApproveMatch(leagueId);
  const updateMatch  = useUpdateMatch(leagueId);

  function handleApprove() {
    approveMatch.mutate(match.id, { onSuccess: onClose });
  }

  function handleSaveEdit(payload: LeagueScorePayload) {
    updateMatch.mutate({ matchId: match.id, data: payload }, { onSuccess: onClose });
  }

  if (view === 'edit') {
    return (
      <Modal size="xs" onClose={onClose} title="Wprowadź zmiany" ariaLabel="Edytuj zgłoszony wynik">
        <LeagueScoreForm
          homeName={match.home_name}
          awayName={match.away_name}
          initial={match}
          onCancel={() => setView('review')}
          onConfirm={handleSaveEdit}
          confirmLabel="Zapisz"
          confirmLoading={updateMatch.isPending}
        />
      </Modal>
    );
  }

  return (
    <Modal size="xs" onClose={onClose} title="Wynik do akceptacji" ariaLabel="Zaakceptuj zgłoszony wynik">
      <div className="flex flex-col gap-4">
        {match.submitted_by_username && (
          <p className="text-xs text-content-secondary">
            Zgłoszone przez <span className="font-medium text-content-primary">{match.submitted_by_username}</span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 rounded-xl border border-border-subtle bg-surface-overlay p-4">
          <MatchSideStats
            name={match.home_name} score={match.home_score}
            count180={match.home_count_180} highCheckouts={match.home_high_checkouts} shortLegs={match.home_short_legs}
          />
          <MatchSideStats
            name={match.away_name} score={match.away_score}
            count180={match.away_count_180} highCheckouts={match.away_high_checkouts} shortLegs={match.away_short_legs}
          />
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setView('edit')}>Wprowadź zmiany</Button>
          <Button variant="primary" fullWidth loading={approveMatch.isPending} onClick={handleApprove}>
            Zaakceptuj
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MatchSideStats({
  name, score, count180, highCheckouts, shortLegs,
}: {
  name: string; score: number | null; count180: number; highCheckouts: number; shortLegs: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="truncate text-sm font-semibold text-content-primary">{name}</p>
      <p className="font-display text-2xl font-bold tabular-nums text-content-primary">{score ?? '—'}</p>
      <p className="text-xs text-content-secondary">180: {count180}</p>
      <p className="text-xs text-content-secondary">High checkout: {highCheckouts}</p>
      <p className="text-xs text-content-secondary">Legi ≤15 lotek: {shortLegs}</p>
    </div>
  );
}
