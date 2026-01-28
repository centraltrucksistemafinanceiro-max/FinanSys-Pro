
import React, { useContext, useState, useRef, useEffect } from 'react';
import StartMenu from './StartMenu';
import { useClock } from '../hooks/useClock';
import { WindowManagerContext } from '../contexts/WindowManagerContext';
import { APPS } from '../windows/apps';
import { SettingsContext } from '../contexts/SettingsContext';
import { CompanyContext } from '../contexts/CompanyContext';
import { PrivacyContext } from '../contexts/PrivacyContext';
import { BriefcaseIcon, ChevronDownIcon, PlusIcon, XMarkIcon, CheckIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';
import Logo from './Logo';

const ClockDisplay = React.memo(() => {
  const clock = useClock();
  const time = clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = clock.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="text-right text-xs px-2 py-1 rounded-md hover:bg-slate-400/30 transition-colors">
      <div>{time}</div>
      <div className="hidden sm:block">{date}</div>
    </div>
  );
});

const Taskbar: React.FC = () => {
  const [isStartMenuOpen, setStartMenuOpen] = useState(false);
  const [isCompanySwitcherOpen, setCompanySwitcherOpen] = useState(false);
  
  // Estados para criação de nova empresa
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');

  const windowManager = useContext(WindowManagerContext);
  const settings = useContext(SettingsContext);
  const companyContext = useContext(CompanyContext);
  const privacyContext = useContext(PrivacyContext);
  
  const startMenuRef = useRef<HTMLDivElement>(null);
  const companySwitcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (startMenuRef.current && !startMenuRef.current.contains(event.target as Node)) {
        setStartMenuOpen(false);
      }
      if (companySwitcherRef.current && !companySwitcherRef.current.contains(event.target as Node)) {
        setCompanySwitcherOpen(false);
        setIsCreatingCompany(false); // Reseta o modo de criação ao fechar
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!windowManager || !settings || !companyContext || !privacyContext) return null;
  const { windows, focusWindow, toggleMinimize } = windowManager;
  const { companies, currentCompany, setCurrentCompany, addCompany } = companyContext;
  const { isValuesVisible, toggleVisibility } = privacyContext;

  const getAppById = (appId: string) => APPS.find(app => app.id === appId);

  const handleTaskbarIconClick = (winId: string, isMinimized: boolean) => {
    focusWindow(winId);
    if(!isMinimized){
       const win = windows.find(w=>w.id === winId);
       const isFocused = win?.zIndex === Math.max(...windows.map(w => w.zIndex));
       if(isFocused){
         toggleMinimize(winId);
       }
    } else {
        toggleMinimize(winId);
    }
  };
  
  const handleCompanySelect = (companyId: string) => {
    if (companyId !== currentCompany.id) {
      setCurrentCompany(companyId);
    }
    setCompanySwitcherOpen(false);
  };

  const handleCreateCompany = async () => {
      if (newCompanyName.trim()) {
          const success = await addCompany(newCompanyName);
          if (success) {
              setNewCompanyName('');
              setIsCreatingCompany(false);
              setCompanySwitcherOpen(false);
          }
      }
  };

  return (
    <div className="w-full h-12 bg-slate-200/80 dark:bg-slate-800/80 backdrop-blur-md flex-shrink-0 z-50 flex items-center justify-between px-2 shadow-t-lg">
      <div className="flex items-center">
        <div className="relative" ref={startMenuRef}>
          <button
            onClick={() => setStartMenuOpen(prev => !prev)}
            className={`h-10 w-10 flex items-center justify-center rounded-md transition-colors p-1 ${isStartMenuOpen ? 'bg-slate-400/50' : 'hover:bg-slate-400/30'}`}
            style={isStartMenuOpen ? { backgroundColor: settings.accentColor + '80' } : {}}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = settings.accentColor + '50'}
            onMouseLeave={(e) => { if (!isStartMenuOpen) e.currentTarget.style.backgroundColor = ''}}
          >
            <Logo className="w-8 h-8" />
          </button>
          {isStartMenuOpen && <StartMenu closeMenu={() => setStartMenuOpen(false)} />}
        </div>
        
        <div className="relative ml-2" ref={companySwitcherRef}>
          <button
            onClick={() => setCompanySwitcherOpen(prev => !prev)}
            className="flex items-center p-2 rounded-md transition-colors hover:bg-slate-400/30"
          >
            <BriefcaseIcon className="w-5 h-5 mr-2 text-slate-700 dark:text-slate-300"/>
            <span className="hidden text-sm font-medium text-slate-800 dark:text-slate-200 md:inline">{currentCompany.name}</span>
            <ChevronDownIcon className={`w-4 h-4 ml-2 text-slate-600 dark:text-slate-400 transition-transform duration-200 ${isCompanySwitcherOpen ? 'transform rotate-180' : ''}`} />
          </button>
          {isCompanySwitcherOpen && (
            <div className="absolute bottom-full mb-2 w-72 bg-slate-200/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-lg shadow-2xl p-2 animate-fade-in-up flex flex-col max-h-[80vh]">
              <ul className="space-y-1 overflow-y-auto max-h-60">
                {companies.map(company => (
                  <li key={company.id}>
                    <button
                      onClick={() => handleCompanySelect(company.id)}
                      className={`w-full text-left flex items-center p-2 rounded-md transition-colors ${currentCompany.id === company.id ? 'font-semibold' : 'hover:bg-white/30 dark:hover:bg-white/10'}`}
                      onMouseEnter={(e) => { if (currentCompany.id !== company.id) e.currentTarget.style.backgroundColor = settings.accentColor + '50' }}
                      onMouseLeave={(e) => { if (currentCompany.id !== company.id) e.currentTarget.style.backgroundColor = '' }}
                      style={currentCompany.id === company.id ? { backgroundColor: settings.accentColor + '80' } : {}}
                    >
                      {company.name}
                    </button>
                  </li>
                ))}
              </ul>
              
              <div className="my-1 border-t border-slate-400/30"></div>
              
              {isCreatingCompany ? (
                  <div className="p-1 flex items-center gap-1">
                      <input 
                        type="text" 
                        autoFocus
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        placeholder="Nome da empresa..."
                        className="flex-grow p-1 text-sm rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 focus:outline-none uppercase"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateCompany();
                            if (e.key === 'Escape') setIsCreatingCompany(false);
                        }}
                      />
                      <button onClick={handleCreateCompany} className="p-1 rounded bg-green-500 text-white hover:bg-green-600"><CheckIcon className="w-4 h-4"/></button>
                      <button onClick={() => setIsCreatingCompany(false)} className="p-1 rounded bg-red-500 text-white hover:bg-red-600"><XMarkIcon className="w-4 h-4"/></button>
                  </div>
              ) : (
                  <button 
                    onClick={(e) => {
                        e.stopPropagation(); // Previne que o menu feche
                        setIsCreatingCompany(true);
                        setNewCompanyName('');
                    }}
                    className="w-full text-left flex items-center p-2 rounded-md transition-colors hover:bg-white/30 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    <span className="text-sm">Nova Empresa</span>
                  </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 px-2">
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          {windows.map(win => {
            const app = getAppById(win.appId);
            if (!app) return null;
            const Icon = app.icon;
            const isFocused = win.zIndex === Math.max(...windows.map(w => w.zIndex));
            const isActive = !win.isMinimized && isFocused;

            return (
              <button
                key={win.id}
                onClick={() => handleTaskbarIconClick(win.id, win.isMinimized)}
                className="relative h-10 px-3 flex-shrink-0 flex items-center justify-center rounded-md transition-colors hover:bg-white/30 dark:hover:bg-white/10"
                title={app.title}
              >
                <Icon className="w-6 h-6" />
                <div
                  className={`absolute bottom-0 left-2 right-2 h-1 rounded-full transition-all duration-200 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                  style={{ backgroundColor: settings.accentColor }}
                />
                 <div
                  className={`absolute bottom-0 left-2 right-2 h-1 rounded-full bg-slate-500/50 transition-all duration-200 ${!isActive && !win.isMinimized ? 'opacity-100' : 'opacity-0'}`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={toggleVisibility}
        className="mx-2 p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-400/30 transition-colors"
        title={isValuesVisible ? "Ocultar Valores" : "Mostrar Valores"}
      >
        {isValuesVisible ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
      </button>

      <ClockDisplay />
    </div>
  );
};

export default Taskbar;