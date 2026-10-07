import {
  catAppearanceKeys,
  DEFAULT_CAT_APPEARANCE,
  type CatAppearanceKey,
} from '@capstone/shared';

export { DEFAULT_CAT_APPEARANCE, type CatAppearanceKey };

export const CAT_ANIMATION_KEYS = [
  'idle',
  'idle-2',
  'sleep',
  'dance',
  'sleepy',
  'excited',
  'lay-down',
  'sad',
  'cry',
  'box-1',
  'box-2',
  'box-3',
  'surprised',
  'eating',
  'waiting',
] as const;

export type CatAnimationKey = typeof CAT_ANIMATION_KEYS[number];

export interface CatAnimationDefinition {
  src: string;
  frameWidth: 32;
  frameHeight: 32;
  frameCount: number;
  frameDurationMs: number;
  layout: 'horizontal';
  ariaAction: string;
}

export interface CatAppearanceDefinition {
  key: CatAppearanceKey;
  displayName: string;
  animations: Record<CatAnimationKey, CatAnimationDefinition>;
}

type AnimationMetadata = Omit<CatAnimationDefinition, 'src'>;

// The source pack contains no animation-timing metadata. These catalog values are
// intentionally tuneable defaults selected by motion type rather than one global speed.
const ANIMATION_METADATA: Record<CatAnimationKey, AnimationMetadata> = {
  idle: animation(10, 180, 'resting'),
  'idle-2': animation(10, 180, 'resting'),
  sleep: animation(4, 400, 'sleeping'),
  dance: animation(4, 160, 'dancing'),
  sleepy: animation(8, 240, 'getting sleepy'),
  excited: animation(12, 140, 'excited'),
  'lay-down': animation(12, 220, 'lying down'),
  sad: animation(9, 240, 'sitting sadly'),
  cry: animation(4, 240, 'crying'),
  'box-1': animation(4, 220, 'playing in a box'),
  'box-2': animation(12, 180, 'climbing into a box'),
  'box-3': animation(4, 220, 'playing in a box'),
  surprised: animation(12, 160, 'surprised'),
  eating: animation(15, 180, 'eating'),
  waiting: animation(6, 240, 'waiting'),
};

const assetModules = import.meta.glob('../../assets/cat/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const displayNames: Record<CatAppearanceKey, string> = {
  'mochi-classic': 'Mochi',
  'mochi-grey': 'Grey Mochi',
  'mochi-orange': 'Orange Mochi',
  'mochi-white': 'White Mochi',
};

export const CAT_APPEARANCES = Object.fromEntries(catAppearanceKeys.map((key) => [
  key,
  {
    key,
    displayName: displayNames[key],
    animations: Object.fromEntries(CAT_ANIMATION_KEYS.map((animationKey) => [
      animationKey,
      { src: resolveAsset(key, animationKey), ...ANIMATION_METADATA[animationKey] },
    ])) as Record<CatAnimationKey, CatAnimationDefinition>,
  },
])) as Record<CatAppearanceKey, CatAppearanceDefinition>;

export function resolveCatAnimation(appearance: string, animationKey: string) {
  const selectedAppearance = CAT_APPEARANCES[appearance as CatAppearanceKey]
    ?? CAT_APPEARANCES[DEFAULT_CAT_APPEARANCE];
  const selectedAnimationKey = CAT_ANIMATION_KEYS.includes(animationKey as CatAnimationKey)
    ? animationKey as CatAnimationKey
    : 'idle';
  return {
    appearance: selectedAppearance,
    animationKey: selectedAnimationKey,
    animation: selectedAppearance.animations[selectedAnimationKey],
  };
}

function animation(frameCount: number, frameDurationMs: number, ariaAction: string): AnimationMetadata {
  return { frameWidth: 32, frameHeight: 32, frameCount, frameDurationMs, layout: 'horizontal', ariaAction };
}

function resolveAsset(appearance: CatAppearanceKey, animationKey: CatAnimationKey): string {
  const filename = appearance === 'mochi-classic' && animationKey === 'idle'
    ? 'idle.png'
    : `${appearance}-${animationKey}.png`;
  const source = assetModules[`../../assets/cat/${filename}`];
  if (!source) throw new Error(`Missing runtime cat animation asset: ${filename}`);
  return source;
}
