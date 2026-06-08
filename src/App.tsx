import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { SoloPage } from './pages/SoloPage';
import { TurniejePage } from './pages/TurniejePage';
import { TournamentPage } from './pages/TournamentPage';
import { LiveMatchPage } from './pages/LiveMatchPage';
import { RankingPage } from './pages/RankingPage';
import { GraczePage } from './pages/GraczePage';

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
      { path: 'turnieje',     element: <TurniejePage />   },
      { path: 'turnieje/:id', element: <TournamentPage /> },
      { path: 'rankingi',     element: <RankingPage />    },
      { path: 'gracze',       element: <GraczePage />     },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
