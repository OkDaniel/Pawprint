import type { ReactNode } from 'react';
import type { FloorLayoutResponse } from '@capstone/shared';
import { RoomContext } from './roomContext';
import { useResource } from './useResource';

export function RoomProvider({ children }: { children: ReactNode }) {
  const room = useResource<FloorLayoutResponse>('/api/room/floor-layout');
  return <RoomContext.Provider value={room}>{children}</RoomContext.Provider>;
}
