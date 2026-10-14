import type { ArtworkEnvelope, FloorPlacementContract, PixelPoint } from './floorCatalog.js';
import { floorDecoration, type FloorDecorationDefinition } from './floorCatalog.js';

export const ROOM_SCENE_SIZE = 512;
export const FLOOR_GRID_SUBDIVISIONS = 16;
export const MAX_FLOOR_PLACEMENTS = 20;
export const MOCHI_RESERVED_REGION = { minU: 10, maxU: 12, minV: 11, maxV: 13 } as const;
// Reviewed sandbox silhouette; tall floor art may rise onto walls. Floor occupancy
// separately stays inside the inset floor lattice, never inside the upright art box.
export const ROOM_ARTWORK_BOUNDARY: readonly PixelPoint[] = [[257,27],[504,157],[504,334],[257,462],[9,335],[9,157]];
export const FLOOR_ORIGIN: PixelPoint = [257,203];
export const FLOOR_AXIS_U: PixelPoint = [230,120];
export const FLOOR_AXIS_V: PixelPoint = [-230,120];

export function floorScenePoint(gridU: number, gridV: number): PixelPoint {
  return normalizedFloorPoint(gridU / FLOOR_GRID_SUBDIVISIONS, gridV / FLOOR_GRID_SUBDIVISIONS);
}

export function normalizedFloorPoint(u: number, v: number): PixelPoint {
  return [FLOOR_ORIGIN[0] + FLOOR_AXIS_U[0]*u + FLOOR_AXIS_V[0]*v,
    FLOOR_ORIGIN[1] + FLOOR_AXIS_U[1]*u + FLOOR_AXIS_V[1]*v];
}

export function normalizedFloorCoordinates([x,y]: PixelPoint): PixelPoint {
  const dx = x-FLOOR_ORIGIN[0], dy = y-FLOOR_ORIGIN[1];
  const determinant = FLOOR_AXIS_U[0]*FLOOR_AXIS_V[1]-FLOOR_AXIS_U[1]*FLOOR_AXIS_V[0];
  return [(dx*FLOOR_AXIS_V[1]-dy*FLOOR_AXIS_V[0])/determinant,
    (dy*FLOOR_AXIS_U[0]-dx*FLOOR_AXIS_U[1])/determinant];
}

export function floorFootprintCells(gridU: number, gridV: number, floor: Pick<FloorPlacementContract, 'footprintU' | 'footprintV'>): PixelPoint[] {
  return Array.from({ length: floor.footprintU * floor.footprintV }, (_, index) => [
    gridU - floor.footprintU + index % floor.footprintU,
    gridV - floor.footprintV + Math.floor(index / floor.footprintU),
  ]);
}

export function isMochiReservedCell(u: number, v: number): boolean {
  return u >= MOCHI_RESERVED_REGION.minU && u <= MOCHI_RESERVED_REGION.maxU
    && v >= MOCHI_RESERVED_REGION.minV && v <= MOCHI_RESERVED_REGION.maxV;
}

export function insideConvexBoundary(point: PixelPoint, polygon: readonly PixelPoint[]): boolean {
  const crosses = polygon.map((a, index) => {
    const b = polygon[(index + 1) % polygon.length]!;
    return (b[0]-a[0])*(point[1]-a[1]) - (b[1]-a[1])*(point[0]-a[0]);
  });
  return crosses.every(cross => cross >= -0.01) || crosses.every(cross => cross <= 0.01);
}

export function familyArtworkFitsRoom(gridU: number, gridV: number, envelope: ArtworkEnvelope): boolean {
  const [x,y] = floorScenePoint(gridU, gridV);
  return [[envelope.left,envelope.top],[envelope.right,envelope.top],
    [envelope.right,envelope.bottom],[envelope.left,envelope.bottom]]
    .every(([dx,dy]) => insideConvexBoundary([x+dx!,y+dy!], ROOM_ARTWORK_BOUNDARY));
}

export interface FloorGeometryPlacement { inventoryInstanceId: number; productId: string; gridU: number; gridV: number }
export interface PlacementIssue { code: string; message: string }

export function snapFloorNode(point: PixelPoint): PixelPoint {
  const [u, v] = normalizedFloorCoordinates(point);
  return [Math.round(u * FLOOR_GRID_SUBDIVISIONS) || 0, Math.round(v * FLOOR_GRID_SUBDIVISIONS) || 0];
}

// The same geometric verdict drives Build feedback and authoritative server validation.
export function floorPlacementIssue(candidate: FloorGeometryPlacement, product: FloorDecorationDefinition, existing: readonly FloorGeometryPlacement[]): PlacementIssue | null {
  const { gridU, gridV } = candidate;
  if (!Number.isInteger(gridU) || !Number.isInteger(gridV) || gridU < 0 || gridV < 0 || gridU > FLOOR_GRID_SUBDIVISIONS || gridV > FLOOR_GRID_SUBDIVISIONS) {
    return { code: 'PLACEMENT_OUT_OF_BOUNDS', message: 'Choose a location inside the floor.' };
  }
  const cells = floorFootprintCells(gridU, gridV, product.floor);
  if (cells.some(([u, v]) => u < 0 || v < 0 || u >= FLOOR_GRID_SUBDIVISIONS || v >= FLOOR_GRID_SUBDIVISIONS)) {
    return { code: 'PLACEMENT_OUT_OF_BOUNDS', message: 'The item’s base extends outside the floor.' };
  }
  if (!familyArtworkFitsRoom(gridU, gridV, product.floor.artworkEnvelope)) {
    return { code: 'PLACEMENT_ARTWORK_OUT_OF_BOUNDS', message: 'The artwork extends outside the room. Try farther inward.' };
  }
  if (cells.some(([u, v]) => isMochiReservedCell(u, v))) {
    return { code: 'MOCHI_CLEARANCE_REQUIRED', message: 'Keep Mochi’s resting area clear.' };
  }
  const occupied = new Set(cells.map(([u, v]) => `${u}:${v}`));
  for (const peer of existing) {
    if (peer.inventoryInstanceId === candidate.inventoryInstanceId) continue;
    const definition = floorDecoration(peer.productId);
    if (definition && floorFootprintCells(peer.gridU, peer.gridV, definition.floor).some(([u, v]) => occupied.has(`${u}:${v}`))) {
      return { code: 'PLACEMENT_COLLISION', message: 'The base overlaps another item. Choose a clear spot.' };
    }
  }
  return null;
}
