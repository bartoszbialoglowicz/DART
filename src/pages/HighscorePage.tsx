import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HighscoreGame, loadHighscoreSession } from '../components/solo/HighscoreGame';
import { HighscoreSetup } from '../components/solo/HighscoreSetup';
import { useAddHighscoreSession, useHighscoreSessions } from '../hooks/useHighscore';

export function HighscorePage() {
  const navigate = useNavigate();
  // A saved session (from a page refresh) already carries its dart count —
  // skip the setup step and resume straight into the game.
  const [dartsTarget, setDartsTarget] = useState<number | null>(() => loadHighscoreSession()?.dartsTarget ?? null);
  const { data: sessions } = useHighscoreSessions();
  const addHighscoreSession = useAddHighscoreSession();

  function handleBack() {
    navigate('/solo');
  }

  function handleFinish(score: number) {
    if (!dartsTarget) return;
    addHighscoreSession.mutate({
      played_at: new Date().toISOString().slice(0, 10),
      darts:     dartsTarget,
      score,
    });
  }

  if (!dartsTarget) {
    return <HighscoreSetup sessions={sessions ?? []} onStart={setDartsTarget} onBack={handleBack} />;
  }

  const personalBest = (sessions ?? [])
    .filter(s => s.darts === dartsTarget)
    .reduce<number | null>((max, s) => (max === null || s.score > max ? s.score : max), null);

  return (
    <HighscoreGame dartsTarget={dartsTarget} personalBest={personalBest} onBack={handleBack} onFinish={handleFinish} />
  );
}
