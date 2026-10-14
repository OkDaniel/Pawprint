import { describe, expect, it } from 'vitest';
import { decorations } from './catalog';
import { anchorPosition, CAT_BASE, depthOrder, fitsArt, FLOOR, floorCoordinates, floorPoint, inside, occupiedCells, placementError, REVIEW_STATES, reviewLayout, snapFloor, type Decoration, type GridSize, type PlacedItem } from './placement';

const find = (family:number) => decorations.find(d=>d.familyId===`room_decor_${String(family).padStart(3,'0')}`)!;
function placement(d: Decoration, u=.75,v=.75,key=1): PlacedItem {
  return {key,itemId:d.id,u,v,wall:null,position:[0,0],scale:1};
}
describe('development placement geometry',()=>{
  it.each([12,16] as GridSize[])('maps every %s lattice node inside the inset Room5 floor and reverses the transform',grid=>{
    for (let u=0;u<=grid;u++) for(let v=0;v<=grid;v++) {
      const p=floorPoint(u/grid,v/grid);
      expect(inside(p,FLOOR)).toBe(true);
      const inverse=floorCoordinates(p);
      expect(inverse[0]).toBeCloseTo(u/grid); expect(inverse[1]).toBeCloseTo(v/grid);
      expect(snapFloor(p,grid)).toEqual([u/grid,v/grid]);
    }
    const edge=floorPoint(1/grid,0), origin=floorPoint(0,0);
    expect(edge[0]).not.toBe(origin[0]); expect(edge[1]).not.toBe(origin[1]);
  });
  it('rejects outside footprints and overlapping bases without treating sprite height as occupancy',()=>{
    const tree=find(6), p=placement(tree);
    expect(placementError(placement(tree,0,0),tree,[],decorations,12)).toContain('footprint');
    expect(placementError(p,tree,[],decorations,12)).toBeNull();
    expect(placementError({...p,key:2},tree,[p],decorations,12)).toContain('overlaps');
    expect(occupiedCells(p,tree,12)).toHaveLength(9);
    expect(tree.height).toBe(175);
  });
  it('rejects artwork outside the room silhouette even when a tiny base fits',()=>{
    const tree={...find(6),height:900,perimeter:[[0,-500]],span:[.01,.01]};
    expect(placementError(placement(tree),tree,[],decorations,12)).toContain('silhouette');
  });
  it.each([12,16] as GridSize[])('allows every extracted floor variant at native scale on grid %s',grid=>{
    for (const d of decorations.filter(item=>item.placement==='floor')) {
      expect(placementError(placement(d),d,[],decorations,grid),d.id).toBeNull();
    }
  });
  it('uses separate wall and floor occupancy, while rejecting overlapping wall art',()=>{
    const window=find(1), bowl=find(19);
    const wall: PlacedItem={...placement(window),wall:'right',position:[376,183]};
    expect(placementError(wall,window,[],decorations,12)).toBeNull();
    const floor=placement(bowl,.75,.75,2);
    expect(placementError(floor,bowl,[wall],decorations,12)).toBeNull();
    expect(placementError({...wall,key:3},window,[wall,floor],decorations,12)).toContain('wall area');
    expect(occupiedCells(wall,window,12)).toEqual([]);
  });
  it('keeps yarn small poses inactive, bowls to six kibble variants, and production identities explicit',()=>{
    expect(decorations.some(d=>d.familyId==='room_decor_004')).toBe(false);
    expect(decorations.filter(d=>d.familyId==='room_decor_019').map(d=>d.id)).toEqual(['blue','sand','purple','white','rose','sage'].map(finish=>`decor_bowl_${finish}`));
    expect(new Set(decorations.map(d=>d.id)).size).toBe(87);
    expect(decorations.every(d=>Boolean(d.src))).toBe(true);
  });
  it.each([12,16] as GridSize[])('produces valid reproducible review layouts for grid %s',grid=>{
    for (const state of REVIEW_STATES) {
      const result=reviewLayout(state,decorations,grid);
      for (const p of result) expect(placementError(p,decorations.find(d=>d.id===p.itemId)!,result,decorations,grid),state).toBeNull();
      if(state.includes('Mochi')) expect(result).toHaveLength(1);
      if(state==='Small props') expect(result).toHaveLength(7);
      if(state==='Crowded') expect(result.length).toBeGreaterThanOrEqual(15);
      if(state.startsWith('Sparse')) expect(result.length).toBeGreaterThanOrEqual(4);
    }
  });
  it.each([12,16] as GridSize[])('sorts table/tree on either side of Mochi by base depth at %s',grid=>{
    for (const family of ['Table','Tree']) for (const side of ['in front','behind']) {
      const state=`${family} ${side} of Mochi`;
      const p=reviewLayout(state as Parameters<typeof reviewLayout>[0],decorations,grid)[0]!;
      const depth=anchorPosition(p,grid)[1];
      expect(fitsArt(p,decorations.find(d=>d.id===p.itemId)!,grid)).toBe(true);
      expect(side==='in front'?depth>CAT_BASE[1]:depth<CAT_BASE[1]).toBe(true);
    }
    expect([{key:2,depth:400},{key:1,depth:400},{key:0,depth:350}].sort(depthOrder).map(d=>d.key)).toEqual([0,1,2]);
  });
});


describe('production contract review in the development lab', () => {
  it('enforces reserved Mochi cells, native scale and floor-only placement when requested', () => {
    const yarn=find(3);
    expect(placementError(placement(yarn,11/16,12/16),yarn,[],decorations,16,true)).toContain('Mochi');
    expect(placementError(placement(yarn,11/16,12/16),yarn,[],decorations,16)).toBeNull();
    expect(placementError({...placement(yarn),scale:2},yarn,[],decorations,16,true)).toContain('native');
    expect(placementError(placement(yarn),yarn,[],decorations,12,true)).toContain('16×16');
    const window=find(1);
    expect(placementError({...placement(window),wall:'right',position:[376,183]},window,[],decorations,16,true)).toContain('floor');
  });
  it('uses the family envelope and cells for every native production variant', () => {
    for(const d of decorations.filter(d=>d.production)) {
      expect(occupiedCells(placement(d,.5,.5),d,16)).toHaveLength(d.production!.footprintU*d.production!.footprintV);
      expect(placementError(placement(d,.5,.5),d,[],decorations,16,true),d.id).toBeNull();
    }
    const bed=find(7);
    expect(placementError(placement(bed,1,.25),bed,[],decorations,16,true)).toContain('silhouette');
  });
});
