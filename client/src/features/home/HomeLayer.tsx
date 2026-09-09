import { Outlet } from 'react-router-dom';
import { HomePage } from './HomePage';

export function HomeLayer() {
  return <><HomePage /><Outlet /></>;
}
