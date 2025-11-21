

import React, { createContext, ReactNode, useState, useCallback } from 'react';
import { AppDefinition, WindowInstance } from '../types';

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
}

export interface WindowManagerContextProps {
  windows: WindowInstance[];
  openWindow: (app: AppDefinition) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  toggleMinimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  updateWindowState: (id: string, updates: Partial<WindowInstance>) => void;
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'> & { id?: string }) => void;
  removeNotification: (id: string) => void;
}

export const WindowManagerContext = createContext<WindowManagerContextProps | undefined>(undefined);

export const WindowManagerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [windows, setWindows] = useState<WindowInstance[]>([]);
  const [nextZIndex, setNextZIndex] = useState(10);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id'> & { id?: string }) => {
    const newNotification = { ...notification, id: notification.id || crypto.randomUUID() };
    setNotifications(prev => [...prev, newNotification]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const openWindow = useCallback((app: AppDefinition) => {
    if (!app) return;

    const existingWindow = windows.find(w => w.appId === app.id);
    if (existingWindow) {
      focusWindow(existingWindow.id);
      if (existingWindow.isMinimized) {
        toggleMinimize(existingWindow.id);
      }
      return;
    }
    
    const isMobile = window.innerWidth < 768; // Tailwind md breakpoint

    const newWindow: WindowInstance = {
      id: crypto.randomUUID(),
      appId: app.id,
      x: isMobile ? 0 : window.innerWidth / 2 - app.defaultSize.width / 2,
      y: isMobile ? 0 : window.innerHeight / 2 - app.defaultSize.height / 2 - 50,
      width: app.defaultSize.width,
      height: app.defaultSize.height,
      isMinimized: false,
      isMaximized: isMobile,
      zIndex: nextZIndex,
    };
    setWindows(prev => [...prev, newWindow]);
    setNextZIndex(prev => prev + 1);
  }, [windows, nextZIndex]);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  }, []);

  const focusWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: nextZIndex } : w));
    setNextZIndex(prev => prev + 1);
  }, [nextZIndex]);

  const toggleMinimize = useCallback((id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: !w.isMinimized } : w));
  }, []);

  const toggleMaximize = useCallback((id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMaximized: !w.isMaximized } : w));
  }, []);

  const updateWindowState = useCallback((id: string, updates: Partial<WindowInstance>) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  }, []);

  return (
    <WindowManagerContext.Provider value={{
      windows,
      openWindow,
      closeWindow,
      focusWindow,
      toggleMinimize,
      toggleMaximize,
      updateWindowState,
      notifications,
      addNotification,
      removeNotification
    }}>
      {children}
    </WindowManagerContext.Provider>
  );
};