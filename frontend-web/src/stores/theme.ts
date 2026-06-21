import { create } from 'zustand';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  initializeTheme: () => void;
}

const storageKey = 'birokt-theme';

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'light',

  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, theme);
    }
    applyTheme(theme);
    set({ theme });
  },

  initializeTheme: () => {
    if (typeof window === 'undefined') return;

    const storedTheme = localStorage.getItem(storageKey);
    const theme: Theme = storedTheme === 'dark' ? 'dark' : 'light';

    applyTheme(theme);
    set({ theme });
  },
}));
