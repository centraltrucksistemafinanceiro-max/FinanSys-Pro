import React, { useContext } from 'react';
import Desktop from './components/Desktop';
import Taskbar from './components/Taskbar';
import { SettingsContext } from './contexts/SettingsContext';
import NotificationContainer from './components/NotificationContainer';
import { AuthContext } from './contexts/AuthContext';
import { PrivacyProvider } from './contexts/PrivacyContext';
import LoginScreen from './components/LoginScreen';

const App: React.FC = () => {
  const settings = useContext(SettingsContext);
  const auth = useContext(AuthContext);

  if (!settings || !auth) return null; // Or a loading spinner
  
  if (!auth.isAuthenticated) {
    return <LoginScreen />;
  }

  const { theme, accentColor, wallpaper } = settings;

  const getThemeClass = () => {
    switch (theme) {
      case 'light':
        return 'light-theme bg-slate-100 text-slate-800';
      case 'dark':
        return 'dark-theme bg-slate-900 text-slate-200';
      case 'colorful':
        return 'colorful-theme bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-slate-100';
      default:
        return 'dark-theme bg-slate-900 text-slate-200';
    }
  };

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col font-sans ${getThemeClass()}`}
      style={{ '--accent-color': accentColor } as React.CSSProperties}
    >
      <PrivacyProvider>
        <Desktop wallpaper={wallpaper} />
        <Taskbar />
        <NotificationContainer />
      </PrivacyProvider>
    </div>
  );
};

export default App;