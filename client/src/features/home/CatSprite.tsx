import type { CSSProperties } from 'react';
import styles from './CatSprite.module.css';
import {
  DEFAULT_CAT_APPEARANCE,
  resolveCatAnimation,
  type CatAnimationKey,
  type CatAppearanceKey,
} from './catCatalog';

type SpriteStyle = CSSProperties & {
  '--frame-count': number;
  '--animation-duration': string;
};

interface CatSpriteProps {
  appearance?: CatAppearanceKey;
  animation?: CatAnimationKey;
  loop?: boolean;
  onAnimationEnd?: () => void;
}

export function CatSprite({
  appearance = DEFAULT_CAT_APPEARANCE,
  animation = 'idle',
  loop = true,
  onAnimationEnd,
}: CatSpriteProps) {
  const resolved = resolveCatAnimation(appearance, animation);
  const animationDefinition = resolved.animation;
  const style: SpriteStyle = {
    '--frame-count': animationDefinition.frameCount,
    '--animation-duration': `${animationDefinition.frameCount * animationDefinition.frameDurationMs}ms`,
  };

  return (
    <span
      className={styles.viewport!}
      role="img"
      aria-label={`${resolved.appearance.displayName} the cat ${animationDefinition.ariaAction}`}
      data-appearance={resolved.appearance.key}
      data-animation={resolved.animationKey}
      data-frame-count={animationDefinition.frameCount}
      data-frame-size={`${animationDefinition.frameWidth}x${animationDefinition.frameHeight}`}
      data-frame-duration={animationDefinition.frameDurationMs}
      data-layout={animationDefinition.layout}
      data-loop={loop}
      style={style}
    >
      <img
        key={`${resolved.appearance.key}:${resolved.animationKey}:${loop ? 'loop' : 'once'}`}
        className={`${styles.sheet!} ${loop ? '' : styles.oneShot!}`}
        src={animationDefinition.src}
        alt=""
        aria-hidden="true"
        onAnimationEnd={loop ? undefined : onAnimationEnd}
      />
    </span>
  );
}
