
import React, { useContext } from 'react';
import { Rnd } from 'react-rnd';
import { WindowInstance, AppDefinition } from '../types';
import { WindowManagerContext } from '../contexts/WindowManagerContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { MinimizeIcon, MaximizeIcon, RestoreIcon, CloseIcon } from './icons/WindowIcons';

interface WindowProps {
  instance: WindowInstance;
  app: AppDefinition;
}

const Window: React.FC<WindowProps> = ({ instance, app }) => {
  const windowManager = useContext(WindowManagerContext);
  const settings = useContext(SettingsContext);

  if (!windowManager || !settings) return null;
  const { closeWindow, focusWindow, toggleMinimize, toggleMaximize, updateWindowState } = windowManager;
  const Icon = app.icon;
  const ContentComponent = app.component;

  const handleDragStop = (_e: any, d: { x: any; y: any; }) => {
    updateWindowState(instance.id, { x: d.x, y: d.y });
  };

  const handleResizeStop = (_e: any, _dir: any, ref: { style: { width: any; height: any; }; }, _delta: any, position: { x: any; y: any; }) => {
    updateWindowState(instance.id, {
      width: parseInt(ref.style.width),
      height: parseInt(ref.style.height),
      ...position,
    });
  };
  
  const headerBgStyle = { backgroundColor: settings.accentColor };

  if (instance.isMinimized) {
    return null; // Minimized windows are not rendered on desktop
  }

  return (
    <Rnd
      size={{ width: instance.isMaximized ? '100%' : instance.width, height: instance.isMaximized ? '100%' : instance.height }}
      position={{ x: instance.isMaximized ? 0 : instance.x, y: instance.isMaximized ? 0 : instance.y }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onMouseDown={() => focusWindow(instance.id)}
      style={{ zIndex: instance.zIndex }}
      minWidth={300}
      minHeight={200}
      disableDragging={instance.isMaximized}
      enableResizing={!instance.isMaximized}
      bounds="parent"
      className={`window-frame shadow-2xl transition-all duration-200 ${instance.isMaximized ? 'rounded-none' : 'rounded-lg'}`}
    >
      <div className={`w-full h-full flex flex-col bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden ring-1 ring-black/20 transition-all duration-200 ${instance.isMaximized ? 'rounded-none' : ''}`}>
        <header 
          className="h-8 flex items-center justify-between px-2 text-white flex-shrink-0" 
          style={headerBgStyle}
        >
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium truncate">{app.title}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => toggleMinimize(instance.id)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"><MinimizeIcon /></button>
            <button onClick={() => toggleMaximize(instance.id)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">
              {instance.isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
            </button>
            <button onClick={() => closeWindow(instance.id)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-500 transition-colors"><CloseIcon /></button>
          </div>
        </header>
        <main className="flex-grow overflow-auto">
          <ContentComponent />
        </main>
      </div>
    </Rnd>
  );
};

export default Window;
