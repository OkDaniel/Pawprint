import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAT_ANIMATION_KEYS, CAT_APPEARANCES } from './catCatalog';

describe('Mochi runtime assets', () => {
  it('matches every catalogued frame count to the extracted PNG dimensions', async () => {
    const sources = new Set<string>();
    for (const appearance of Object.values(CAT_APPEARANCES)) {
      for (const animationKey of CAT_ANIMATION_KEYS) {
        const definition = appearance.animations[animationKey];
        const filename = path.basename(definition.src).split('?')[0]!;
        const png = await readFile(path.resolve(process.cwd(), 'src/assets/cat', filename));
        expect(png.subarray(1, 4).toString()).toBe('PNG');
        expect(png.readUInt32BE(16), filename).toBe(definition.frameWidth * definition.frameCount);
        expect(png.readUInt32BE(20), filename).toBe(definition.frameHeight);
        sources.add(filename);
      }
    }
    expect(sources.size).toBe(60);
  });

  it('retains integer display scales and reduced-motion pausing', async () => {
    const css = await readFile(path.resolve(process.cwd(), 'src/features/home/CatSprite.module.css'), 'utf8');
    expect(css).toContain('width: 6rem');
    expect(css).toContain('width: 4rem');
    expect(css).toContain('width: 2rem');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation-play-state: paused');
    expect(css).toContain('image-rendering: pixelated');
  });
});
