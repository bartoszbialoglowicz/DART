import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { SoloPage } from './pages/SoloPage';
import { TournamentsPage } from './pages/TournamentsPage';
import { TournamentPage } from './pages/TournamentPage';
import { LiveMatchPage } from './pages/LiveMatchPage';
import { RankingPage } from './pages/RankingPage';
import { PlayersPage } from './pages/PlayersPage';
import { ProfilePage } from './pages/ProfilePage';
import { LeaguesPage } from './pages/LeaguesPage';
import { LeagueDetailPage } from './pages/LeagueDetailPage';

const router = createBrowserRouter([
  {
    path: '/turnieje/:id/live/:matchId',
    element: <LiveMatchPage />,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true,          element: <Navigate to="/solo" replace /> },
      { path: 'solo',         element: <SoloPage />       },
      { path: 'turnieje',     element: <TournamentsPage /> },
      { path: 'turnieje/:id', element: <TournamentPage /> },
      { path: 'rankingi',     element: <RankingPage />    },
      { path: 'gracze',       element: <PlayersPage />    },
      { path: 'profil',       element: <ProfilePage />    },
      { path: 'ligi',         element: <LeaguesPage />    },
      { path: 'ligi/:id',     element: <LeagueDetailPage /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
