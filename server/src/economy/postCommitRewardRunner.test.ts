import { describe, expect, it, vi } from 'vitest';
import { PostCommitRewardRunner } from './postCommitRewardRunner.js';

describe('PostCommitRewardRunner', () => {
  it('catches a failed game/database attempt and continues to the next bounded job', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const next = vi.fn(async () => undefined);
    const runner = new PostCommitRewardRunner(2, 1000);
    expect(runner.enqueue(async () => { throw new Error('connection failed'); })).toBe(true);
    expect(runner.enqueue(next)).toBe(true);
    await vi.waitFor(() => expect(next).toHaveBeenCalledOnce());
    expect(error).toHaveBeenCalledWith('Post-commit Pawprint reward attempt failed.', expect.any(Error));
    error.mockRestore();
  });

  it('never lets a hung reward create an unbounded detached queue', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let finish!: () => void;
    const hung = new Promise<void>((resolve) => { finish = resolve; });
    const runner = new PostCommitRewardRunner(1, 1);
    expect(runner.enqueue(() => hung)).toBe(true);
    expect(runner.enqueue(async () => undefined)).toBe(false);
    await vi.waitFor(() => expect(warning).toHaveBeenCalledWith(expect.stringContaining('slow')));
    finish();
    await vi.waitFor(() => expect(runner.enqueue(async () => undefined)).toBe(true));
    warning.mockRestore();
  });
});
