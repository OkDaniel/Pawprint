// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../auth/authContextValue';
import { AuthPage } from './AuthPage';

afterEach(cleanup);

describe('registration', () => {
  it('collects credentials without showing or submitting a cat appearance', async () => {
    const register = vi.fn(async () => undefined);
    render(<MemoryRouter><AuthContext.Provider value={{ user: null, loading: false, login: vi.fn(), register, updateCompanion: vi.fn(), completeOnboarding: vi.fn(), logout: vi.fn() }}><AuthPage mode="register" /></AuthContext.Provider></MemoryRouter>);

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'daniel' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => expect(register).toHaveBeenCalledWith('daniel', 'password123'));
  });
});
