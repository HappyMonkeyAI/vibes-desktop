import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from '../src/renderer/App';

// Theme toggle: dark Mission Control is default; control flips data-theme /
// arco-theme and persists the choice in localStorage.

describe('theme toggle', () => {
  beforeEach(() => {
    window.localStorage.removeItem('vibes-theme');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('arco-theme');
  });

  it('renders a theme control in the header', async () => {
    render(<App />);
    const toggle = await screen.findByRole('button', { name: /switch to (dark|light) theme/i });
    expect(toggle).toBeTruthy();
  });

  it('defaults to dark and flips to light on toggle', async () => {
    render(<App />);
    const toggle = await screen.findByRole('button', { name: /switch to (dark|light) theme/i });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('arco-theme')).toBe('dark');

    act(() => {
      toggle.click();
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('arco-theme')).toBe('light');
    expect(window.localStorage.getItem('vibes-theme')).toBe('light');

    act(() => {
      toggle.click();
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('arco-theme')).toBe('dark');
    expect(window.localStorage.getItem('vibes-theme')).toBe('dark');
  });

  it('honors a stored light mode on mount', async () => {
    window.localStorage.setItem('vibes-theme', 'light');
    render(<App />);
    await screen.findByRole('button', { name: /switch to (dark|light) theme/i });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('arco-theme')).toBe('light');
  });
});
