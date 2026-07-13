import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePendingResults } from '../../hooks/usePendingResults';
import { PlayerSetupModal } from '../auth/PlayerSetupModal';
import { PendingResultsModal } from '../profile/PendingResultsModal';
import { Navbar } from './Navbar';

export function Layout() {
  const { username, playerId } = useAuth();
  const { data: pendingResults = [] } = usePendingResults(!!playerId);

  return (
    <div className="flex min-h-screen flex-col bg-surface-base text-content-primary">
      <Navbar />
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      {username && playerId === null && <PlayerSetupModal />}
      {pendingResults.length > 0 && <PendingResultsModal pending={pendingResults} />}
    </div>
  );
}
