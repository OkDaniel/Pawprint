import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { floorDecorations, legacyFloorVariantAliases } from '@capstone/shared';
import { floorDecorationAsset, floorVariantAssets } from './assetManifest';
import manifest from './assetSources.json';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

// Decode the lossless RGBA8 runtime crops to verify the original pixel hashes and
// explicit exclusions, rather than only trusting filenames or encoded file bytes.
function rgbaPixels(png: Buffer): Uint8Array {
  expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png[24]).toBe(8); expect(png[25]).toBe(6); expect(png[28]).toBe(0);
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20), stride = width*4;
  const chunks: Buffer[] = [];
  for (let offset=8;offset<png.length;) {
    const size=png.readUInt32BE(offset);
    if(png.toString('ascii',offset+4,offset+8)==='IDAT') chunks.push(png.subarray(offset+8,offset+8+size));
    offset += size+12;
  }
  const data=inflateSync(Buffer.concat(chunks)), output=new Uint8Array(stride*height);
  expect(data.length).toBe((stride+1)*height);
  for(let y=0;y<height;y++) {
    const filter=data[y*(stride+1)]!;
    expect(filter).toBeLessThanOrEqual(4);
    for(let x=0;x<stride;x++) {
      const index=y*stride+x, a=x>=4?output[index-4]!:0, b=y>0?output[index-stride]!:0, c=x>=4&&y>0?output[index-stride-4]!:0;
      const p=a+b-c, pa=Math.abs(p-a), pb=Math.abs(p-b), pc=Math.abs(p-c);
      const predictor=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):pa<=pb&&pa<=pc?a:pb<=pc?b:c;
      output[index]=(data[y*(stride+1)+x+1]!+predictor)&255;
    }
  }
  return output;
}

describe('verified semantic floor runtime assets', () => {
  it('maps every approved finish exactly once to an existing lossless crop with reviewed pixels', () => {
    const variantIds=floorDecorations.flatMap(product=>product.variants.map(variant=>variant.id));
    expect(Object.keys(floorVariantAssets).sort()).toEqual(variantIds.slice().sort());
    expect(Object.keys(manifest.variants).sort()).toEqual(variantIds.slice().sort());
    expect(new Set(Object.values(manifest.variants).map(v=>v.asset)).size).toBe(74);
    for(const product of floorDecorations) for(const variant of product.variants) {
      const entry=manifest.variants[variant.id];
      const png=readFileSync(new URL(`./assets/${entry.asset}`,import.meta.url));
      expect(sha256(png),variant.id).toBe(entry.pngSha256);
      expect(png.readUInt32BE(16)).toBe(variant.width); expect(png.readUInt32BE(20)).toBe(variant.height);
      const pixels=rgbaPixels(png);
      expect(sha256(pixels),variant.id).toBe(entry.pixelSha256);
      for(const [x,y] of entry.excludeNeighborPixels) {
        expect(Array.from(pixels.slice((y!*variant.width+x!)*4,(y!*variant.width+x!)*4+4))).toEqual([0,0,0,0]);
      }
      expect(entry.sourceRect.width).toBe(variant.width); expect(entry.sourceRect.height).toBe(variant.height);
      expect(entry.sourceRect.x+variant.width).toBeLessThanOrEqual(1024);
      expect(entry.sourceRect.y+variant.height).toBeLessThanOrEqual(1024);
      expect(floorDecorationAsset(product.id,variant.id)).toBeTruthy();
      expect(floorDecorationAsset(product.id,variant.id)).toBe(floorVariantAssets[variant.id]);
    }
  });

  it('keeps legacy inventory renderable and rejects invented/cross-family identities', () => {
    for(const product of floorDecorations) {
      const legacy=`${product.id}_base`;
      expect(legacyFloorVariantAliases[legacy]).toBe(product.defaultVariantId);
      expect(floorDecorationAsset(product.id,legacy)).toBe(floorDecorationAsset(product.id,product.defaultVariantId));
    }
    expect(floorDecorationAsset('decor_bowl','decor_yarn_ball_sage')).toBeUndefined();
    expect(floorDecorationAsset('room_decor_019','room_decor_019_v13')).toBeUndefined();
  });

  it('freezes production state choices and all documented shelf exclusions', () => {
    expect(Object.values(manifest.variants).filter(v=>v.asset.startsWith('room_decor_014')).reduce((sum,v)=>sum+v.excludeNeighborPixels.length,0)).toBe(26);
    expect(Object.values(manifest.variants).some(v=>v.asset.startsWith('room_decor_004'))).toBe(false);
    expect(Object.values(manifest.variants).filter(v=>v.asset.startsWith('room_decor_024')).map(v=>v.asset)).toEqual(['room_decor_024_v01.png']);
    const bowls=Object.values(manifest.variants).filter(v=>v.asset.startsWith('room_decor_019')).map(v=>v.asset);
    expect(bowls).toEqual([13,14,15,16,17,18].map(n=>`room_decor_019_v${n}.png`));
  });
});
