import React, { useContext } from 'react';
import { WindowManagerContext } from '../contexts/WindowManagerContext';
import { APPS } from '../windows/apps';
import { SettingsContext } from '../contexts/SettingsContext';
import { AppDefinition } from '../types';
import { AuthContext } from '../contexts/AuthContext';
import { LogoutIcon } from './icons/AppIcons';

interface StartMenuProps {
  closeMenu: () => void;
}

const StartMenu: React.FC<StartMenuProps> = ({ closeMenu }) => {
  const windowManager = useContext(WindowManagerContext);
  const settings = useContext(SettingsContext);
  const auth = useContext(AuthContext);

  if (!windowManager || !settings || !auth) return null;

  const handleAppClick = (app: AppDefinition) => {
    windowManager.openWindow(app);
    closeMenu();
  };
  
  const handleLogout = () => {
    closeMenu();
    auth.logout();
  };

  const visibleApps = APPS.filter(app => {
    if (!app.role) return true; // App is for everyone
    if (!auth.currentUser) return false;
    return auth.currentUser.role === app.role;
  });

  const financeApps = visibleApps.filter(app => ['cashflow', 'boleto-control', 'faturamento', 'faturamento-sn'].includes(app.id));
  const dashboardApps = visibleApps.filter(app => app.id.includes('dashboard'));
  const analysisApps = visibleApps.filter(app => ['financial-forecast'].includes(app.id));
  const systemApps = visibleApps.filter(app => 
      !financeApps.some(fa => fa.id === app.id) && 
      !dashboardApps.some(da => da.id === app.id) &&
      !analysisApps.some(aa => aa.id === app.id)
  );

  const AppButton: React.FC<{ app: AppDefinition }> = ({ app }) => {
    const Icon = app.icon;
    return (
      <button
        onClick={() => handleAppClick(app)}
        className="w-full flex items-center p-2 rounded-md text-left transition-colors hover:bg-white/30 dark:hover:bg-white/10"
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = settings.accentColor + '50'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
      >
        <span className="mr-3" style={{ color: settings.accentColor }}>
          <Icon className="w-6 h-6" />
        </span>
        <span className="font-medium">{app.title}</span>
      </button>
    );
  };

  return (
    <div 
      className="absolute bottom-full mb-2 w-96 bg-slate-200/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-lg shadow-2xl p-4 animate-fade-in-up flex flex-col"
      style={{maxHeight: 'calc(100vh - 5rem)'}}
    >
      <div className="flex items-center pb-4 mb-4 border-b border-slate-400/50 flex-shrink-0">
        <img src="https://lh3.googleusercontent.com/d/10eVKUmKef7BQNeJHl8Cz1gJbX8UBSCVd" alt="Logo" className="w-12 h-12" />
        <div className="ml-4">
          <h3 className="font-semibold text-lg">{auth.currentUser?.username}</h3>
          <p className="text-sm opacity-70">Fluxo de Caixa FinanSys Pro</p>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto pr-2 space-y-4">
          {financeApps.length > 0 && (
            <div>
              <h4 className="px-2 pb-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Financeiro</h4>
              {financeApps.map(app => <AppButton key={app.id} app={app} />)}
            </div>
          )}
          {dashboardApps.length > 0 && (
            <div>
              <h4 className="px-2 pb-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Dashboards</h4>
              {dashboardApps.map(app => <AppButton key={app.id} app={app} />)}
            </div>
          )}
          {analysisApps.length > 0 && (
            <div>
              <h4 className="px-2 pb-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Análise</h4>
              {analysisApps.map(app => <AppButton key={app.id} app={app} />)}
            </div>
          )}
          {systemApps.length > 0 && (
            <div>
              <h4 className="px-2 pb-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Sistema</h4>
              {systemApps.map(app => <AppButton key={app.id} app={app} />)}
            </div>
          )}
      </div>
      <div className="flex-shrink-0 pt-4 mt-4 border-t border-slate-400/50">
        <button
          onClick={handleLogout}
          className="w-full flex items-center p-2 rounded-md text-left transition-colors hover:bg-white/30 dark:hover:bg-white/10"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = settings.accentColor + '50'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
        >
          <span className="mr-3" style={{ color: settings.accentColor }}>
            <LogoutIcon className="w-6 h-6" />
          </span>
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
};

export default StartMenu;