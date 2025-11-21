import React, { useContext } from 'react';
import { WindowManagerContext } from '../contexts/WindowManagerContext';
import Window from './Window';
import { Wallpaper } from '../types';
import { WALLPAPERS } from '../constants';
import { APPS } from '../windows/apps';
import { SettingsContext } from '../contexts/SettingsContext';
import { AuthContext } from '../contexts/AuthContext';

interface DesktopProps {
  wallpaper: Wallpaper;
}

const Desktop: React.FC<DesktopProps> = ({ wallpaper }) => {
  const windowManager = useContext(WindowManagerContext);
  const settings = useContext(SettingsContext);
  const auth = useContext(AuthContext);

  if (!windowManager || !settings || !auth) return null;

  const { openWindow } = windowManager;
  const wallpaperUrl = WALLPAPERS.find(w => w.id === wallpaper)?.url || WALLPAPERS[0].url;

  const visibleApps = APPS.filter(app => {
    if (!app.role) return true; // App is for everyone
    if (!auth.currentUser) return false;
    return auth.currentUser.role === app.role;
  });
  
  // Exclui apps de configuração/gerenciamento dos ícones do desktop para uma aparência mais limpa
  const lancamentoApps = visibleApps.filter(app => ['cashflow', 'boleto-control', 'faturamento', 'faturamento-sn'].includes(app.id));
  const dashboardApps = visibleApps.filter(app => app.id.includes('dashboard'));
  const analysisApps = visibleApps.filter(app => ['financial-forecast'].includes(app.id));


  const AppIcon: React.FC<{ app: typeof APPS[0] }> = ({ app }) => {
    const Icon = app.icon;
    return (
      <button 
        onDoubleClick={() => openWindow(app)}
        className="flex flex-col items-center justify-center w-24 p-2 rounded-md transition-colors hover:bg-white/20 focus:bg-white/30 focus:outline-none"
        title={`Abrir ${app.title}`}
      >
        {/* FIX: The Icon component does not accept a 'style' prop, causing a TypeScript error. Wrapped in a span to apply color via CSS inheritance. */}
        <span style={{ color: settings.accentColor }}>
          <Icon className="w-10 h-10" />
        </span>
        <span className="mt-1 text-xs text-white text-center select-none" style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.8)' }}>
          {app.title}
        </span>
      </button>
    );
  };

  return (
    <div className="flex-grow w-full relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-500"
        style={{ backgroundImage: `url(${wallpaperUrl})` }}
      />
      <div className="absolute inset-0 bg-black/10 dark:bg-black/20" />
      
      <div className="absolute top-4 left-4 flex flex-col items-start gap-2">
        {lancamentoApps.map(app => <AppIcon key={app.id} app={app} />)}
        {analysisApps.length > 0 && <div className="w-24 my-2 border-t border-white/20" />}
        {analysisApps.map(app => <AppIcon key={app.id} app={app} />)}
      </div>
      
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
        {dashboardApps.map(app => <AppIcon key={app.id} app={app} />)}
      </div>
      
      {windowManager.windows.map((win) => {
        const app = APPS.find(a => a.id === win.appId);
        if (!app) return null;
        return <Window key={win.id} instance={win} app={app} />;
      })}
    </div>
  );
};

export default Desktop;