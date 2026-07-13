import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SectorPracticeGame, loadSectorPracticeSession } from '../components/solo/SectorPracticeGame';
import { SectorPracticeSetup } from '../components/solo/SectorPracticeSetup';
import { useAddSectorPracticeSession } from '../hooks/useSectorPractice';

type Config = { sector: string; dartsLimit: number };

export function SectorPracticePage() {
  const navigate = useNavigate();
  // A saved session (from a page refresh) already carries its sector/limit —
  // skip the setup step and resume straight into the game.
  const [config, setConfig] = useState<Config | null>(() => {
    const saved = loadSectorPracticeSession();
    return saved ? { sector: saved.sector, dartsLimit: saved.dartsLimit } : null;
  });
  const addSectorPracticeSession = useAddSectorPracticeSession();

  function handleBack() {
    navigate('/solo');
  }

  function handleFinish(hitRate: number, score: number) {
    if (!config) return;
    addSectorPracticeSession.mutate({
      played_at: new Date().toISOString().slice(0, 10),
      sector:    config.sector,
      hit_rate:  Math.round(hitRate * 10) / 10,
      score,
    });
  }

  if (!config) {
    return (
      <SectorPracticeSetup
        onStart={(sector, dartsLimit) => setConfig({ sector, dartsLimit })}
        onBack={handleBack}
      />
    );
  }

  return (
    <SectorPracticeGame
      sector={config.sector}
      dartsLimit={config.dartsLimit}
      onBack={handleBack}
      onFinish={handleFinish}
    />
  );
}
