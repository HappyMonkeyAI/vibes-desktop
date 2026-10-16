import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from '../src/renderer/App';

// Theme toggle (Roles-tab polish): the control flips data-theme on <html>,
// keeps arco-theme in sync, and persists the choice in localStorage.

describe('theme toggle', () => {
  it('renders a theme control in the header', async () => {
    render(<App />);
    const toggle = await screen.findByRole('button', { name: /switch to (dark|light) theme/i });
    expect(toggle).toBeTruthy();
  });

  it('flips data-theme and arco-theme on <html> and persists the mode', async () => {
    render(<App />);
    const toggle = await screen.findByRole('button', { name: /switch to (dark|light) theme/i });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('arco-theme')).toBe('light');

    act(() => {
      toggle.click();
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('arco-theme')).toBe('dark');
    expect(window.localStorage.getItem('vibes-theme')).toBe('dark');

    act(() => {
      toggle.click();
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('arco-theme')).toBe('light');
    expect(window.localStorage.getItem('vibes-theme')).toBe('light');
  });

  it('honors a stored dark mode on mount', async () => {
    window.localStorage.setItem('vibes-theme', 'dark');
    render(<App />);
    await screen.findByRole('button', { name: /switch to (dark|light) theme/i });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('arco-theme')).toBe('dark');
    window.localStorage.removeItem('vibes-theme');
  });
});
