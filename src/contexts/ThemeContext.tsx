import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Theme, UiSettings } from '../types';

type ThemeContextType = {
  theme: Theme;
  isDarkMode: boolean;
  settings: UiSettings;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  updateSettings: (newSettings: Partial<UiSettings>) => void;
};

const defaultSettings: UiSettings = {
  theme: 'system',
  fontSize: 'medium',
  compactMode: false,
  notifications: {
    email: true,
    push: true,
    inApp: true,
  },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'quroa_ui_settings';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UiSettings>(() => {
    // Load settings from localStorage if available
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem(THEME_STORAGE_KEY);
      return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
    }
    return defaultSettings;
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (settings.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return settings.theme === 'dark';
  });

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Update dark mode when system theme preference changes
  useEffect(() => {
    if (settings.theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings.theme]);

  // Update document class when dark mode changes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
    setIsDarkMode(prev => !prev);
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    setSettings(prev => ({
      ...prev,
      theme,
    }));
    
    if (theme === 'system') {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    } else {
      setIsDarkMode(theme === 'dark');
    }
  }, []);

  const updateSettings = useCallback((newSettings: Partial<UiSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      
      // If theme is being updated, update the dark mode state
      if (newSettings.theme !== undefined) {
        if (newSettings.theme === 'system') {
          setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
        } else {
          setIsDarkMode(newSettings.theme === 'dark');
        }
      }
      
      return updated;
    });
  }, []);

  // Handle system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (settings.theme === 'system') {
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [settings.theme]);

  // Apply font size class to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all font size classes
    root.classList.remove('text-sm', 'text-base', 'text-lg');
    
    // Add the current font size class
    switch (settings.fontSize) {
      case 'small':
        root.classList.add('text-sm');
        break;
      case 'large':
        root.classList.add('text-lg');
        break;
      default: // medium
        root.classList.add('text-base');
    }
  }, [settings.fontSize]);

  // Apply compact mode class to document
  useEffect(() => {
    if (settings.compactMode) {
      document.documentElement.classList.add('compact-mode');
    } else {
      document.documentElement.classList.remove('compact-mode');
    }
  }, [settings.compactMode]);

  const value = {
    theme: settings.theme,
    isDarkMode,
    settings,
    toggleTheme,
    setTheme,
    updateSettings,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Helper hook to use theme colors
export const useThemeColors = () => {
  const { isDarkMode } = useTheme();
  
  return {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-white',
    bgSecondary: isDarkMode ? 'bg-gray-800' : 'bg-gray-50',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-300' : 'text-gray-600',
    border: isDarkMode ? 'border-gray-700' : 'border-gray-200',
    hoverBg: isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50',
    ring: isDarkMode ? 'ring-gray-700' : 'ring-gray-200',
    inputBg: isDarkMode ? 'bg-gray-800' : 'bg-white',
    inputBorder: isDarkMode ? 'border-gray-700' : 'border-gray-300',
    inputText: isDarkMode ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500',
    cardBg: isDarkMode ? 'bg-gray-800' : 'bg-white',
    cardBorder: isDarkMode ? 'border-gray-700' : 'border-gray-200',
    buttonPrimaryBg: isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700',
    buttonPrimaryText: 'text-white',
    buttonSecondaryBg: isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200',
    buttonSecondaryText: isDarkMode ? 'text-white' : 'text-gray-700',
    link: isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800',
    danger: isDarkMode ? 'text-red-400' : 'text-red-600',
    success: isDarkMode ? 'text-green-400' : 'text-green-600',
    warning: isDarkMode ? 'text-yellow-400' : 'text-yellow-600',
    info: isDarkMode ? 'text-blue-400' : 'text-blue-600',
  };
};
