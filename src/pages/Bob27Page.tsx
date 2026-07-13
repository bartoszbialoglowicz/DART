import { useNavigate } from 'react-router-dom';
import { Bob27Game } from '../components/solo/Bob27Game';

export function Bob27Page() {
  const navigate = useNavigate();
  return <Bob27Game onBack={() => navigate('/solo')} />;
}
