import { create } from 'zustand';
import type { User } from 'shared';

interface AppState {
  token: string | null;
  user: User | null;
  theme: 'light' | 'dark';
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>((set) => {
  // Read initial states from localStorage
  const savedToken = localStorage.getItem('lrms_token');
  const savedUserRaw = localStorage.getItem('lrms_user');
  const savedTheme = (localStorage.getItem('lrms_theme') as 'light' | 'dark') || 'light';
  
  let savedUser: User | null = null;
  if (savedUserRaw) {
    try {
      savedUser = JSON.parse(savedUserRaw);
    } catch (e) {
      localStorage.removeItem('lrms_user');
    }
  }

  // Set dark class initially if dark theme saved
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  return {
    token: savedToken,
    user: savedUser,
    theme: savedTheme,
    setAuth: (token, user) => {
      localStorage.setItem('lrms_token', token);
      localStorage.setItem('lrms_user', JSON.stringify(user));
      set({ token, user });
    },
    clearAuth: () => {
      localStorage.removeItem('lrms_token');
      localStorage.removeItem('lrms_user');
      set({ token: null, user: null });
    },
    toggleTheme: () => set((state) => {
      const nextTheme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('lrms_theme', nextTheme);
      
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      return { theme: nextTheme };
    })
  };
});
