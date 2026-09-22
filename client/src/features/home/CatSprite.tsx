import type { CSSProperties } from 'react';
import idleSheet from '../../assets/cat/idle.png';
import styles from './CatSprite.module.css';

const IDLE_SPRITE = {
  frameWidth: 32,
  frameHeight: 32,
  frameCount: 10,
  frameDurationMs: 180,
} as const;

type SpriteStyle = CSSProperties & {
  '--frame-count': number;
  '--animation-duration': string;
};

export function CatSprite() {
  const style: SpriteStyle = {
    '--frame-count': IDLE_SPRITE.frameCount,
    '--animation-duration': `${IDLE_SPRITE.frameCount * IDLE_SPRITE.frameDurationMs}ms`,
  };

  return (
    <span
      className={styles.viewport!}
      role="img"
      aria-label="Mochi the cat resting"
      data-frame-count={IDLE_SPRITE.frameCount}
      data-frame-size={`${IDLE_SPRITE.frameWidth}x${IDLE_SPRITE.frameHeight}`}
      style={style}
    >
      <img className={styles.sheet!} src={idleSheet} alt="" aria-hidden="true" />
    </span>
  );
}
