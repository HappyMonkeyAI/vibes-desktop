import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@arco-design/web-react';
import { Sun, Moon } from '@icon-park/react';

/**
 * Theme toggle for the mission-control shell. Flips `data-theme` on <html>
 * and keeps `arco-theme` in sync. Dark Mission Control (Stitch) is the default;
 * light remains available. Choice persists in localStorage.
 */

type ThemeMode = 'light' | 'dark';

function readStoredTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem('vibes-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore
  }
  return 'dark';
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.setAttribute('arco-theme', mode);
}

export const ThemeToggle: React.FC = () => {
  const [mode, setMode] = useState<ThemeMode>(readStoredTheme);

  useEffect(() => {
    applyTheme(mode);
    try {
      window.localStorage.setItem('vibes-theme', mode);
    } catch {
      // localStorage unavailable — the attribute still flips for the session.
    }
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  return (
    <Button
      size="mini"
      type="outline"
      aria-label={mode === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
      title={mode === 'light' ? 'Dark' : 'Light'}
      onClick={toggle}
    >
      {mode === 'light' ? <Moon size={14} /> : <Sun size={14} />}
    </Button>
  );
};
