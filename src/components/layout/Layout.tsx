import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PlayerSetupModal } from '../auth/PlayerSetupModal';
import { Navbar } from './Navbar';

export function Layout() {
  const { username, playerId } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-surface-base text-content-primary">
      <Navbar />
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      {username && playerId === null && <PlayerSetupModal />}
    </div>
  );
}
