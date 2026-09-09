import type { CSSProperties } from 'react';
import glyphSheet from '../assets/ui/pixel-letters-7-8x14.png';
import styles from './PixelGlyph.module.css';

const GLYPH_WIDTH = 8;
const GLYPH_HEIGHT = 14;
const SHEET_WIDTH = 118;
const SHEET_HEIGHT = 106;

const glyphCoordinates = {
  C: [19, 1], E: [37, 1], H: [64, 1], I: [73, 1], K: [91, 1], N: [1, 16],
  '0': [82, 31], '1': [1, 31], '2': [10, 31], '3': [19, 31], '4': [28, 31],
  '5': [37, 31], '6': [46, 31], '7': [55, 31], '8': [64, 31], '9': [73, 31],
} as const;

export type PixelCharacter = keyof typeof glyphCoordinates;

export function PixelGlyph({ character, scale = 2 }: { character: PixelCharacter; scale?: 1 | 2 | 3 }) {
  const [x, y] = glyphCoordinates[character];
  const style: CSSProperties = {
    width: GLYPH_WIDTH * scale,
    height: GLYPH_HEIGHT * scale,
    backgroundImage: `url(${glyphSheet})`,
    backgroundSize: `${SHEET_WIDTH * scale}px ${SHEET_HEIGHT * scale}px`,
    backgroundPosition: `${-x * scale}px ${-y * scale}px`,
  };
  return <span className={styles.glyph!} style={style} aria-hidden="true" data-pixel-glyph={character} />;
}

export function PixelNumber({ value, scale = 2 }: { value: number; scale?: 1 | 2 | 3 }) {
  return <span className={styles.number!} aria-hidden="true" data-pixel-number={value}>
    {String(value).split('').map((character, index) => (
      <PixelGlyph key={`${character}-${index}`} character={character as PixelCharacter} scale={scale} />
    ))}
  </span>;
}

export function CheckInPixelLabel() {
  return <span className={styles.text!} aria-hidden="true" data-pixel-text="CHECK IN">
    <span className={styles.word!}>{toGlyphs('CHECK')}</span>
    <span className={styles.word!}>{toGlyphs('IN')}</span>
  </span>;
}

function toGlyphs(word: string) {
  return [...word].map((character, index) => (
    <PixelGlyph key={`${character}-${index}`} character={character as PixelCharacter} />
  ));
}
