import { Outlet } from 'react-router-dom';
import { HomePage } from './HomePage';
import { RoomProvider } from '../room/RoomProvider';
import { useAuth } from '../../auth/useAuth';

export function HomeLayer() {
  const { user } = useAuth();
  return <RoomProvider key={user?.id}><HomePage /><Outlet /></RoomProvider>;
}
