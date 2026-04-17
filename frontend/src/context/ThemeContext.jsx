import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { lightColors, darkColors } from '../theme/themeColors';

const ThemeContext = createContext();

/**
 * Shared localStorage key — same as CNC module ('cnc-theme').
 * Both modules read/write the same key so toggling in one
 * module applies everywhere.
 */
const STORAGE_KEY = 'cnc-theme';

/**
 * ThemeProvider — global dark/light theme state.
 *
 * Aligned with the existing CNC module theme system:
 *   • Default theme: DARK (matches CNC's default)
 *   • localStorage key: 'cnc-theme' (shared with CNC)
 *   • Sets data-theme on <html> for Ant Design + CSS variables
 *   • Provides useTheme() hook for Box Schedule inline styles
 *
 * CNC uses CSS variables (.cnc[data-theme="dark"]).
 * Box Schedule uses the JS `colors` object from useTheme() for inline styles.
 * Both approaches read the same data-theme attribute and share the same toggle.
 */
export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Default to 'dark' (matching CNC module default)
      if (stored === 'light') return 'light';
      if (stored === 'dark') return 'dark';
      return 'dark'; // default
    } catch {
      return 'dark';
    }
  });

  const colors = useMemo(() => (mode === 'dark' ? darkColors : lightColors), [mode]);
  const isDark = mode === 'dark';

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch { /* ignore */ }
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  // Listen for storage changes from other tabs or CNC module toggling
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
        setMode(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleTheme = () => setMode((m) => (m === 'light' ? 'dark' : 'light'));

  const value = useMemo(
    () => ({ mode, colors, toggleTheme, isDark }),
    [mode, colors, isDark]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * useTheme() — access the current theme.
 *
 * Returns:
 *   mode       — 'light' | 'dark'
 *   colors     — semantic color map (e.g. colors.surface, colors.textPrimary)
 *   toggleTheme — flip between light and dark
 *   isDark     — boolean shorthand for mode === 'dark'
 */
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
};
