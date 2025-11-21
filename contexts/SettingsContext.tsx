import React, { createContext, ReactNode, useState, useEffect } from 'react';
import { Theme, Wallpaper } from '../types';
import { ACCENT_COLORS } from '../constants';
import { getItem, putItem, DBSettings, STORE_NAMES } from '../utils/db';

interface SettingsContextProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  wallpaper: Wallpaper;
  setWallpaper: (wallpaper: Wallpaper) => void;
}

export const SettingsContext = createContext<SettingsContextProps | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [accentColor, setAccentColorState] = useState<string>(ACCENT_COLORS[0]);
  const [wallpaper, setWallpaperState] = useState<Wallpaper>('wallpaper2');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await getItem<DBSettings>(STORE_NAMES.SETTINGS, 'userSettings');
        if (savedSettings) {
          setThemeState(savedSettings.theme);
          setAccentColorState(savedSettings.accentColor);
          setWallpaperState(savedSettings.wallpaper);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        // Defaults will be used
      } finally {
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  const saveSettings = (newSettings: Omit<DBSettings, 'id'>) => {
    const settingsToSave: DBSettings = {
      id: 'userSettings',
      ...newSettings,
    };
    putItem(STORE_NAMES.SETTINGS, settingsToSave);
  };
  
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if(isLoaded) saveSettings({ theme: newTheme, accentColor, wallpaper });
  };
  
  const setAccentColor = (newAccentColor: string) => {
    setAccentColorState(newAccentColor);
    if(isLoaded) saveSettings({ theme, accentColor: newAccentColor, wallpaper });
  };
  
  const setWallpaper = (newWallpaper: Wallpaper) => {
    setWallpaperState(newWallpaper);
    if(isLoaded) saveSettings({ theme, accentColor, wallpaper: newWallpaper });
  };

  if (!isLoaded) {
    return null; // Or a loading spinner
  }

  return (
    <SettingsContext.Provider value={{ theme, setTheme, accentColor, setAccentColor, wallpaper, setWallpaper }}>
      {children}
    </SettingsContext.Provider>
  );
};