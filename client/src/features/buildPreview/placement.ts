// DEVELOPMENT LAB: 12x12, 2x scale and wall placement are experiments.
// Native 16x16 floor metadata and geometry consume the production contract.
import { familyArtworkFitsRoom, floorFootprintCells, isMochiReservedCell, normalizedFloorPoint, normalizedFloorCoordinates, FLOOR_GRID_SUBDIVISIONS,
  ROOM_ARTWORK_BOUNDARY, type FloorPlacementContract } from '@capstone/shared';
export type Point = readonly [number, number];
export type GridSize = 12 | 16;
export type Wall = 'left' | 'right';
export interface Decoration {
  id: string; familyId: string; name: string; src: string;
  placement: 'wall' | 'floor'; priorWall: string | null;
  width: number; height: number; anchor: number[]; span: number[]; perimeter: number[][];
  production?: FloorPlacementContract;
}
export interface PlacedItem {
  key: number; itemId: string; scale: number;
  // Normalized plane nodes retain scene relationship when the comparison grid changes.
  u: number; v: number; wall: Wall | null; position: Point;
}
export const FLOOR: Point[] = [[257,200],[492,325],[257,445],[21,325]];
export const WALLS: Record<Wall, Point[]> = {
  left: [[21,168],[257,42],[257,198],[21,324]],
  right: [[259,42],[492,166],[492,323],[259,198]],
};
export const SHELL: Point[] = [...ROOM_ARTWORK_BOUNDARY];
export const CAT_CENTER: Point = [256,512*.65];
// Static idle frame alpha bounds: x=0..23, y=4..31, rendered at Home's desktop 3x.
export const CAT_BASE: Point = [CAT_CENTER[0]-48+12*3,CAT_CENTER[1]-48+31*3];
export const MAX_ITEMS = 28;

export function floorPoint(u: number, v: number): Point {
  // True affine isometric lattice inset from Room5 trim (not a screen-space grid).
  return normalizedFloorPoint(u,v);
}
export function floorCoordinates([x,y]: Point): Point {
  return normalizedFloorCoordinates([x,y]);
}
export function snapFloor(point: Point, grid: GridSize): Point {
  const [u,v] = floorCoordinates(point);
  return [Math.round(u*grid)/grid || 0,Math.round(v*grid)/grid || 0];
}
export function inside(point: Point, polygon: Point[]): boolean {
  const crosses = polygon.map((a,i) => {
    const b = polygon[(i+1)%polygon.length]!;
    return (b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0]);
  });
  return crosses.every(c => c >= -.01) || crosses.every(c => c <= .01);
}
export function anchorPosition(p: PlacedItem, grid: GridSize): Point {
  return p.wall ? p.position : floorPoint(Math.round(p.u*grid)/grid,Math.round(p.v*grid)/grid);
}
export function occupiedCells(p: PlacedItem, d: Decoration, grid: GridSize): Point[] {
  if (p.wall) return [];
  const u = Math.round(p.u*grid), v = Math.round(p.v*grid);
  if (d.production && grid === FLOOR_GRID_SUBDIVISIONS && p.scale === 1) return floorFootprintCells(u,v,d.production);
  const w = Math.max(1,Math.ceil(d.span[0]!*p.scale*grid));
  const h = Math.max(1,Math.ceil(d.span[1]!*p.scale*grid));
  return Array.from({length:w*h},(_,i) => [u-w+i%w,v-h+Math.floor(i/w)] as Point);
}
export function spriteOrigin(p: PlacedItem, d: Decoration, grid: GridSize): Point {
  const a = anchorPosition(p,grid);
  return [a[0]-d.anchor[0]!*p.scale,a[1]-d.anchor[1]!*p.scale];
}
export function fitsArt(p: PlacedItem, d: Decoration, grid: GridSize, polygon = p.wall ? WALLS[p.wall] : SHELL): boolean {
  if (!p.wall && d.production && grid === FLOOR_GRID_SUBDIVISIONS && p.scale === 1 && polygon === SHELL) {
    return familyArtworkFitsRoom(Math.round(p.u*grid),Math.round(p.v*grid),d.production.artworkEnvelope);
  }
  const [x,y] = spriteOrigin(p,d,grid);
  return d.perimeter.every(([px,py]) => inside([x+px!*p.scale,y+py!*p.scale],polygon));
}
function wallOverlap(a: PlacedItem, ad: Decoration, b: PlacedItem, bd: Decoration, grid: GridSize): boolean {
  if (a.wall !== b.wall) return false;
  const [ax,ay] = spriteOrigin(a,ad,grid), [bx,by] = spriteOrigin(b,bd,grid);
  return ax < bx+bd.width*b.scale && ax+ad.width*a.scale > bx && ay < by+bd.height*b.scale && ay+ad.height*a.scale > by;
}
export function placementError(p: PlacedItem, d: Decoration, existing: PlacedItem[], items: Decoration[], grid: GridSize, productionRules = false): string | null {
  if (productionRules && (p.wall || !d.production || p.scale !== 1 || grid !== FLOOR_GRID_SUBDIVISIONS)) return 'Production supports only native 1× floor art on the 16×16 grid.';
  if (!p.wall && occupiedCells(p,d,grid).some(([u,v]) => u<0 || v<0 || u>=grid || v>=grid)) return 'The base footprint must stay inside the floor.';
  if (!fitsArt(p,d,grid)) return p.wall ? 'The complete artwork must fit inside this wall face. Try the other wall or a smaller item.' : 'The artwork would cross the room silhouette/trim.';
  if (productionRules && occupiedCells(p,d,grid).some(([u,v])=>isMochiReservedCell(u,v))) return 'Keep Mochi’s reserved floor area clear.';
  const peers = existing.filter(i=>i.key!==p.key && Boolean(i.wall)===Boolean(p.wall));
  if (p.wall) {
    if (peers.some(other=>wallOverlap(p,d,other,items.find(i=>i.id===other.itemId)!,grid))) return 'This wall area is already occupied.';
  } else {
    const cells = new Set(occupiedCells(p,d,grid).map(c=>c.join(',')));
    if (peers.some(other=>occupiedCells(other,items.find(i=>i.id===other.itemId)!,grid).some(c=>cells.has(c.join(','))))) return 'The base footprint overlaps another floor object.';
  }
  return null;
}
export function depthOrder(a: {depth:number;key:number}, b: {depth:number;key:number}): number {
  return a.depth-b.depth || a.key-b.key;
}

export type ReviewState = 'Sparse 12' | 'Sparse 16' | 'Table in front of Mochi' | 'Table behind Mochi' | 'Tree in front of Mochi' | 'Tree behind Mochi' | 'Small props' | 'Left wall' | 'Right wall' | 'Crowded';
export const REVIEW_STATES: ReviewState[] = ['Sparse 12','Sparse 16','Table in front of Mochi','Table behind Mochi','Tree in front of Mochi','Tree behind Mochi','Small props','Left wall','Right wall','Crowded'];
export function reviewLayout(state: ReviewState, items: Decoration[], grid: GridSize): PlacedItem[] {
  const result: PlacedItem[] = [];
  const add = (family:number,u:number,v:number) => {
    const d = items.find(i=>i.familyId===`room_decor_${String(family).padStart(3,'0')}`)!;
    const p: PlacedItem = {key:result.length+1,itemId:d.id,scale:1,u:Math.round(u*grid)/grid,v:Math.round(v*grid)/grid,wall:null,position:[0,0]};
    if (!placementError(p,d,result,items,grid)) result.push(p);
  };
  if (state.includes('Mochi')) {
    const family = state.startsWith('Tree') ? 6 : 22;
    // Front anchor is below cat base; back anchor is above it, with overlapping art.
    const node = state.includes('in front') ? .83 : .67;
    add(family,node,node);
  } else if (state==='Crowded') {
    for (let v=3;v<=grid && result.length<24;v+=2) for (let u=3;u<=grid && result.length<24;u+=2) add([23,24,3,19,8][result.length%5]!,u/grid,v/grid);
  } else if (state==='Small props') {
    [23,24,26,3,19,27,8].forEach((f,i)=>add(f,.32+(i%3)*.24,.38+Math.floor(i/3)*.22));
  } else if (!state.includes('wall')) {
    add(7,.45,.85); add(14,.85,.4); add(15,.4,.4); add(19,.88,.83); add(3,.64,.85);
  }
  return result;
}
