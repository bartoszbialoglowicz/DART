import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { SoloPage } from './pages/SoloPage';
import { Bob27Page } from './pages/Bob27Page';
import { CheckoutsPage } from './pages/CheckoutsPage';
import { Solo501Page } from './pages/Solo501Page';
import { HighscorePage } from './pages/HighscorePage';
import { SectorPracticePage } from './pages/SectorPracticePage';
import { TournamentsPage } from './pages/TournamentsPage';
import { TournamentPage } from './pages/TournamentPage';
import { TournamentSetupPage } from './pages/TournamentSetupPage';
import { LiveMatchPage } from './pages/LiveMatchPage';
import { LeagueLiveMatchPage } from './pages/LeagueLiveMatchPage';
import { RankingPage } from './pages/RankingPage';
import { ProfilePage } from './pages/ProfilePage';
import { LeaguesPage } from './pages/LeaguesPage';
import { LeagueDetailPage } from './pages/LeagueDetailPage';
import { CreateCyclePage } from './pages/CreateCyclePage';
import { CycleDetailPage } from './pages/CycleDetailPage';
import { HubPage } from './pages/HubPage';

const router = createBrowserRouter([
  {
    path: '/turnieje/:id/live/:matchId',
    element: <LiveMatchPage />,
  },
  {
    path: '/ligi/:id/live/:matchId',
    element: <LeagueLiveMatchPage />,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true,          element: <Navigate to="/solo" replace /> },
      { path: 'solo',         element: <SoloPage />       },
      { path: 'solo/bob27',      element: <Bob27Page />      },
      { path: 'solo/checkouts',  element: <CheckoutsPage />  },
      { path: 'solo/501-solo',   element: <Solo501Page />    },
      { path: 'solo/highscore',  element: <HighscorePage />  },
      { path: 'solo/sector',     element: <SectorPracticePage /> },
      { path: 'turnieje',        element: <TournamentsPage /> },
      { path: 'turnieje/nowy',   element: <TournamentSetupPage /> },
      { path: 'turnieje/:id',    element: <TournamentPage /> },
      { path: 'rankingi',     element: <RankingPage />    },

      { path: 'profil',       element: <ProfilePage />    },
      { path: 'ligi',            element: <LeaguesPage />    },
      { path: 'ligi/cykle/nowy', element: <CreateCyclePage /> },
      { path: 'ligi/cykle/:id',  element: <CycleDetailPage /> },
      { path: 'ligi/:id',        element: <LeagueDetailPage /> },
      { path: 'hub',          element: <HubPage /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
