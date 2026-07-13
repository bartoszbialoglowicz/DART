import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Solo501Game, loadSolo501Session } from '../components/solo/Solo501Game';
import { Solo501Setup } from '../components/solo/Solo501Setup';
import { useAddTrainingSession } from '../hooks/useTraining';
import type { PlayerMatchStats } from '../utils/statistics';

export function Solo501Page() {
  const navigate = useNavigate();
  // A saved session (from a page refresh) already carries its legs target —
  // skip the setup step and resume straight into the game.
  const [legsTarget, setLegsTarget] = useState<number | null>(() => loadSolo501Session()?.legsTarget ?? null);
  const addTrainingSession = useAddTrainingSession();

  function handleBack() {
    navigate('/solo');
  }

  function handleFinish(stats: PlayerMatchStats) {
    if (stats.match_average > 0 && legsTarget) {
      addTrainingSession.mutate({
        played_at:       new Date().toISOString().slice(0, 10),
        average:         Math.round(stats.match_average * 100) / 100,
        legs:            legsTarget,
        double_attempts: stats.double_attempts,
        double_hits:     stats.double_hits,
      });
    }
  }

  if (!legsTarget) {
    return <Solo501Setup onStart={setLegsTarget} onBack={handleBack} />;
  }

  return <Solo501Game legsTarget={legsTarget} onBack={handleBack} onFinish={handleFinish} />;
}
