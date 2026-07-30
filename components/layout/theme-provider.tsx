'use client';

import { createContext, useContext, useEffect, useState } from 'react';

/** Renk temaları — her biri açık/koyu modda çalışır. */
export type ColorTheme = 'walnut' | 'ocean' | 'forest' | 'grape' | 'graphite';
export type Mode = 'light' | 'dark';

export const COLOR_THEMES: { id: ColorTheme; label: string; swatch: string }[] = [
  { id: 'walnut', label: 'Ceviz', swatch: '#A6683B' },
  { id: 'ocean', label: 'Okyanus', swatch: '#2F6F8F' },
  { id: 'forest', label: 'Orman', swatch: '#3E7C54' },
  { id: 'grape', label: 'Üzüm', swatch: '#7A5299' },
  { id: 'graphite', label: 'Antrasit', swatch: '#5A6270' },
];

type Ctx = {
  mode: Mode;
  colorTheme: ColorTheme;
  toggleMode: () => void;
  setColorTheme: (t: ColorTheme) => void;
};

const ThemeContext = createContext<Ctx>({
  mode: 'light',
  colorTheme: 'walnut',
  toggleMode: () => {},
  setColorTheme: () => {},
});

function apply(mode: Mode, colorTheme: ColorTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.setAttribute('data-theme', colorTheme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>('light');
  const [colorTheme, setColorThemeState] = useState<ColorTheme>('walnut');

  useEffect(() => {
    const storedMode = window.localStorage.getItem('yonga-theme') as Mode | null;
    const storedColor = window.localStorage.getItem('yonga-color-theme') as ColorTheme | null;
    const initialMode = storedMode ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const initialColor = storedColor ?? 'walnut';
    setMode(initialMode);
    setColorThemeState(initialColor);
    apply(initialMode, initialColor);
  }, []);

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem('yonga-theme', next);
      apply(next, colorTheme);
      return next;
    });
  };

  const setColorTheme = (t: ColorTheme) => {
    setColorThemeState(t);
    window.localStorage.setItem('yonga-color-theme', t);
    apply(mode, t);
  };

  return (
    <ThemeContext.Provider value={{ mode, colorTheme, toggleMode, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
