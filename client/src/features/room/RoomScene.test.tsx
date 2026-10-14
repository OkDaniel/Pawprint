// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RoomScene } from './RoomScene';
import { CatSprite } from '../home/CatSprite';
import { CAT_BASE_DEPTH, sceneObjects } from './sceneModel';

const placement = (id: number, u: number, v: number) => ({ inventoryInstanceId: id, gridU: u, gridV: v, productId: 'decor_yarn_ball', selectedVariantId: 'decor_yarn_ball_sage' });
afterEach(cleanup);
describe('shared Home/Build scene', () => {
  it('sorts floor objects and the animated cat by base contact with stable ties', () => {
    const objects = sceneObjects([placement(4, 16, 16), placement(3, 8, 8), placement(2, 8, 8)]);
    expect(objects.map(o => o.key)).toEqual([2, 3, 0, 4]);
    expect(objects.find(o => o.kind === 'cat')?.depth).toBe(CAT_BASE_DEPTH);
    render(<RoomScene placements={[placement(1, 8, 8)]} cat={<CatSprite />} />);
    expect(screen.getByRole('img', { name: 'Mochi the cat resting' })).toHaveAttribute('data-frame-count', '10');
    expect(screen.getByRole('img', { name: 'Yarn Ball' }).parentElement).toHaveStyle({ left: '48.046875%', top: '59.375%', width: '4.296875%' });
  });
  it('resolves legacy finishes, ignores unknown metadata and survives a broken decoration image', () => {
    render(<RoomScene placements={[{ ...placement(1, 8, 8), selectedVariantId: 'decor_yarn_ball_base' }, { ...placement(2, 4, 4), productId: 'unknown' }]} cat={<CatSprite />} />);
    expect(screen.getAllByRole('img', { name: 'Yarn Ball' })).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Yarn Ball' })).toHaveAttribute('src', expect.stringContaining('room_decor_003_v01'));
    fireEvent.error(screen.getByRole('img', { name: 'Yarn Ball' }));
    expect(screen.getByRole('img', { name: 'Mochi the cat resting' })).toBeInTheDocument();
    expect(screen.getByTestId('room-background')).toBeInTheDocument();
  });
});
