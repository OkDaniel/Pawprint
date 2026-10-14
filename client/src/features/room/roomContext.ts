import { createContext, useContext } from 'react';
import type { FloorLayoutResponse } from '@capstone/shared';
import type { useResource } from './useResource';

export const RoomContext = createContext<ReturnType<typeof useResource<FloorLayoutResponse>> | null>(null);
export function useRoom() {
  const room = useContext(RoomContext);
  if (!room) throw new Error('Room provider is required.');
  return room;
}
