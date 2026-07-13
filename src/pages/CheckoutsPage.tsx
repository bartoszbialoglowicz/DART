import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckoutsGame, loadCheckoutsSession, type CheckoutsMode } from '../components/solo/CheckoutsGame';
import { CheckoutsSetup } from '../components/solo/CheckoutsSetup';

export function CheckoutsPage() {
  const navigate = useNavigate();
  // A saved session (from a page refresh, or navigating back into an in-progress
  // game) already carries its mode — skip the setup step and resume straight in.
  const [mode, setMode] = useState<CheckoutsMode | null>(() => loadCheckoutsSession()?.mode ?? null);

  function handleBack() {
    navigate('/solo');
  }

  if (!mode) {
    return <CheckoutsSetup onStart={setMode} onBack={handleBack} />;
  }

  return <CheckoutsGame mode={mode} onBack={handleBack} />;
}
