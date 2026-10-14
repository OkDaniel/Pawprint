import { floorDecorations, FLOOR_GRID_SUBDIVISIONS, type FloorVariantId } from '@capstone/shared';
import { floorVariantAssets } from '../decorations/assetManifest';
import sourceManifest from '../decorations/assetSources.json';
import draft from './representatives.draft.json';
import type { Decoration } from './placement';

const sources = import.meta.glob('./assets/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string,string>;
// Wall art remains a development experiment. Floor art/anchors/footprints come
// exclusively from the frozen production contract, including all approved finishes.
const wallExperiments: Decoration[] = draft.filter(item => item.placement === 'wall')
  .map(item => ({ ...item, placement: 'wall', src: sources[`./assets/${item.id}.png`]! }));
const floorItems: Decoration[] = floorDecorations.flatMap(product => product.variants.map(variant => {
  const asset = sourceManifest.variants[variant.id].asset;
  return {
    id: variant.id, familyId: asset.slice(0,14), name: product.displayName,
    src: floorVariantAssets[variant.id as FloorVariantId], placement: 'floor', priorWall: null,
    width: variant.width, height: variant.height, anchor: [...variant.anchor],
    span: [product.floor.footprintU/FLOOR_GRID_SUBDIVISIONS, product.floor.footprintV/FLOOR_GRID_SUBDIVISIONS],
    perimeter: [[0,0],[variant.width,0],[variant.width,variant.height],[0,variant.height]],
    production: product.floor,
  };
}));
export const decorations: Decoration[] = [...wallExperiments, ...floorItems];
export const families = decorations.filter((item,index,all) => all.findIndex(d => d.familyId === item.familyId) === index);
