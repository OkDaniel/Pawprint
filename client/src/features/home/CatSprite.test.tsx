// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatSprite } from './CatSprite';
import { CAT_ANIMATION_KEYS, CAT_APPEARANCES, resolveCatAnimation } from './catCatalog';

afterEach(cleanup);

describe('CatSprite', () => {
  it('renders the Classical Mochi idle animation by default', () => {
    render(<CatSprite />);
    const sprite = screen.getByRole('img', { name: 'Mochi the cat resting' });
    expect(sprite).toHaveAttribute('data-appearance', 'mochi-classic');
    expect(sprite).toHaveAttribute('data-animation', 'idle');
    expect(sprite).toHaveAttribute('data-frame-count', '10');
    expect(sprite).toHaveAttribute('data-frame-size', '32x32');
  });

  it('uses the same renderer for an alternate Mochi skin', () => {
    render(<CatSprite appearance="mochi-grey" animation="sleep" />);
    const sprite = screen.getByRole('img', { name: 'Grey Mochi the cat sleeping' });
    expect(sprite).toHaveAttribute('data-appearance', 'mochi-grey');
    expect(sprite).toHaveAttribute('data-animation', 'sleep');
    expect(sprite).toHaveAttribute('data-frame-count', '4');
    expect(sprite).toHaveAttribute('data-layout', 'horizontal');
  });

  it('restarts changed animations on a fresh sheet and only reports one-shot completion', () => {
    const onAnimationEnd = vi.fn();
    const view = render(<CatSprite appearance="mochi-orange" animation="idle" onAnimationEnd={onAnimationEnd} />);
    const idleSprite = screen.getByRole('img', { name: 'Orange Mochi the cat resting' });
    const idleSheet = idleSprite.querySelector('img')!;
    fireEvent.animationEnd(idleSheet);
    expect(onAnimationEnd).not.toHaveBeenCalled();

    view.rerender(<CatSprite appearance="mochi-orange" animation="excited" loop={false} onAnimationEnd={onAnimationEnd} />);
    const sprite = screen.getByRole('img', { name: 'Orange Mochi the cat excited' });
    const excitedSheet = sprite.querySelector('img')!;
    expect(sprite).toHaveAttribute('data-loop', 'false');
    expect(sprite).toHaveAttribute('data-frame-count', '12');
    expect(sprite).toHaveAttribute('data-frame-duration', '140');
    expect(excitedSheet).not.toBe(idleSheet);
    fireEvent.animationEnd(excitedSheet);
    expect(onAnimationEnd).toHaveBeenCalledOnce();
  });

  it('falls back safely for unknown appearances or animations', () => {
    expect(resolveCatAnimation('unknown', 'walk').appearance.key).toBe('mochi-classic');
    const unsupportedAnimation = resolveCatAnimation('mochi-grey', 'walk');
    expect(unsupportedAnimation.animationKey).toBe('idle');
    expect(unsupportedAnimation.animation).toBe(CAT_APPEARANCES['mochi-grey'].animations.idle);
  });

  it('resolves every verified animation for all four appearances', () => {
    expect(Object.keys(CAT_APPEARANCES)).toEqual(['mochi-classic', 'mochi-grey', 'mochi-orange', 'mochi-white']);
    for (const appearance of Object.values(CAT_APPEARANCES)) {
      for (const animationKey of CAT_ANIMATION_KEYS) {
        const resolved = resolveCatAnimation(appearance.key, animationKey);
        expect(resolved.appearance.key).toBe(appearance.key);
        expect(resolved.animationKey).toBe(animationKey);
        expect(resolved.animation.frameWidth).toBe(32);
        expect(resolved.animation.frameHeight).toBe(32);
      }
    }
  });
});
