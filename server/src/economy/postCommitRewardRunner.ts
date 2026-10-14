export interface RewardRunner {
  enqueue(task: () => Promise<unknown>): boolean;
}

/**
 * A process-local, deliberately bounded best-effort runner. It never owns health
 * persistence. Slow jobs keep their single slot until they settle, while the
 * small queue rejects excess work for the reconciliation endpoint to recover.
 */
export class PostCommitRewardRunner implements RewardRunner {
  private active = false;
  private readonly queue: Array<() => Promise<unknown>> = [];

  constructor(
    private readonly capacity = 16,
    private readonly slowWarningMs = 750,
  ) {}

  enqueue(task: () => Promise<unknown>): boolean {
    if (this.queue.length + (this.active ? 1 : 0) >= this.capacity) {
      console.warn('Pawprint reward runner is full; reconciliation will retry the reward.');
      return false;
    }
    this.queue.push(task);
    this.runNext();
    return true;
  }

  private runNext(): void {
    if (this.active) return;
    const task = this.queue.shift();
    if (!task) return;
    this.active = true;
    let settled = false;
    const warning = setTimeout(() => {
      if (!settled) console.warn('A Pawprint reward attempt is slow; Tracking has already succeeded.');
    }, this.slowWarningMs);
    warning.unref?.();
    void Promise.resolve()
      .then(task)
      .catch((error: unknown) => console.error('Post-commit Pawprint reward attempt failed.', error))
      .finally(() => {
        settled = true;
        clearTimeout(warning);
        this.active = false;
        this.runNext();
      });
  }
}

export const postCommitRewardRunner = new PostCommitRewardRunner();
