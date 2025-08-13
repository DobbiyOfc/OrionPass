import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

type Theme = 'light' | 'dark' | 'system';

declare const chrome: any;

interface SettingsContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: string;
  setLanguage: (language: string) => void;
  logoutOnInactive: boolean;
  setLogoutOnInactive: (enabled: boolean) => void;
  inactivityDuration: number; // in minutes
  setInactivityDuration: (duration: number) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  
  // States with default values
  const [theme, setThemeState] = useState<Theme>('system');
  const [language, setLanguageState] = useState(i18n.language || 'en');
  const [logoutOnInactive, setLogoutOnInactiveState] = useState(true);
  const [inactivityDuration, setInactivityDurationState] = useState(15);

  // Load all settings from chrome.storage.sync on initial mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['theme', 'language', 'logoutOnInactive', 'inactivityDuration'], (result: any) => {
            if (result.theme) setThemeState(result.theme);
            if (result.language) {
                setLanguageState(result.language);
                i18n.changeLanguage(result.language);
            }
            if (result.logoutOnInactive !== undefined) setLogoutOnInactiveState(result.logoutOnInactive);
            if (result.inactivityDuration !== undefined) setInactivityDurationState(result.inactivityDuration);
        });
    } else {
        // Fallback to localStorage for non-extension environments
        const localTheme = localStorage.getItem('theme') as Theme;
        if(localTheme) setThemeState(localTheme);
        const localLang = localStorage.getItem('i18nextLng');
        if(localLang) {
            setLanguageState(localLang);
            i18n.changeLanguage(localLang);
        }
    }
  }, [i18n]);


  useEffect(() => {
    const handleThemeChange = () => {
      if (theme === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', systemPrefersDark);
      } else {
        document.documentElement.classList.toggle('dark', theme === 'dark');
      }
    };

    handleThemeChange();
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);

  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ theme: newTheme });
    } else {
      localStorage.setItem('theme', newTheme);
    }
  }, []);
  
  const setLanguage = useCallback((newLanguage: string) => {
    i18n.changeLanguage(newLanguage).then(() => {
      setLanguageState(newLanguage);
       if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ language: newLanguage });
      }
    });
  }, [i18n]);

  const setLogoutOnInactive = useCallback((enabled: boolean) => {
    setLogoutOnInactiveState(enabled);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ logoutOnInactive: enabled });
    }
  }, []);

  const setInactivityDuration = useCallback((duration: number) => {
    setInactivityDurationState(duration);
     if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ inactivityDuration: duration });
    }
  }, []);


  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
       setLanguageState(lng);
       localStorage.setItem('i18nextLng', lng);
    };
    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  const value = useMemo(() => ({
    theme,
    setTheme,
    language,
    setLanguage,
    logoutOnInactive,
    setLogoutOnInactive,
    inactivityDuration,
    setInactivityDuration
  }), [theme, language, logoutOnInactive, inactivityDuration, setTheme, setLanguage, setLogoutOnInactive, setInactivityDuration]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
