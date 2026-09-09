// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the application home shell', () => {
    render(<MemoryRouter initialEntries={['/app']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Cat Room' })).toBeInTheDocument();
  });
});
