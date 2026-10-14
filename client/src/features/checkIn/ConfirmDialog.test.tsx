// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { StrictMode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('keeps focus in a StrictMode confirmation and restores the trigger only after closing', () => {
  const frames = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++sequence, callback); return sequence; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  const trigger = document.createElement('button');
  document.body.append(trigger); trigger.focus();
  const view = render(<StrictMode><ConfirmDialog title="Discard room changes?" body="Your draft will be discarded." cancelLabel="Keep editing" confirmLabel="Discard changes" onCancel={() => {}} onConfirm={() => {}} /></StrictMode>);
  for (const callback of frames.values()) callback(0);
  expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus();
  frames.clear(); view.unmount();
  for (const callback of frames.values()) callback(0);
  expect(trigger).toHaveFocus(); trigger.remove();
});
