
import React, { useContext } from 'react';
import { SettingsContext } from '../contexts/SettingsContext';
import { Theme, Wallpaper } from '../types';
import { ACCENT_COLORS, WALLPAPERS } from '../constants';

const Personalization: React.FC = () => {
  const settings = useContext(SettingsContext);
  if (!settings) return null;

  const { theme, setTheme, accentColor, setAccentColor, wallpaper, setWallpaper } = settings;

  return (
    <div className="p-6 bg-slate-100 dark:bg-slate-900 h-full text-slate-800 dark:text-slate-200 overflow-y-auto">
      <h1 className="text-2xl font-bold mb-6">Personalização</h1>

      <div className="mb-6">
        <h2 className="font-semibold mb-2">Tema de Cores</h2>
        <div className="flex gap-4">
          {/* FIX: 'ringColor' is not a valid CSS property. Used the '--tw-ring-color' CSS variable to set the ring color for Tailwind's ring utility. */}
          <button onClick={() => setTheme('light')} className={`px-4 py-2 rounded-lg ${theme === 'light' ? 'ring-2' : ''}`} style={theme === 'light' ? { '--tw-ring-color': accentColor } as React.CSSProperties : {}}>Claro</button>
          {/* FIX: 'ringColor' is not a valid CSS property. Used the '--tw-ring-color' CSS variable to set the ring color for Tailwind's ring utility. */}
          <button onClick={() => setTheme('dark')} className={`px-4 py-2 rounded-lg ${theme === 'dark' ? 'ring-2' : ''}`} style={theme === 'dark' ? { '--tw-ring-color': accentColor } as React.CSSProperties : {}}>Escuro</button>
          {/* FIX: 'ringColor' is not a valid CSS property. Used the '--tw-ring-color' CSS variable to set the ring color for Tailwind's ring utility. */}
          <button onClick={() => setTheme('colorful')} className={`px-4 py-2 rounded-lg ${theme === 'colorful' ? 'ring-2' : ''}`} style={theme === 'colorful' ? { '--tw-ring-color': accentColor } as React.CSSProperties : {}}>Colorido</button>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-semibold mb-2">Cor de Destaque</h2>
        <div className="flex flex-wrap gap-3">
          {ACCENT_COLORS.map(color => (
            <button
              key={color}
              onClick={() => setAccentColor(color)}
              className={`w-10 h-10 rounded-full transition-transform transform hover:scale-110 ${accentColor === color ? 'ring-2 ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-900' : ''}`}
              // FIX: 'ringColor' is not a valid CSS property. Used the '--tw-ring-color' CSS variable to set the ring color for Tailwind's ring utility.
              style={{ backgroundColor: color, '--tw-ring-color': color } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Papel de Parede</h2>
        <div className="grid grid-cols-2 gap-4">
          {WALLPAPERS.map(wp => (
            <div key={wp.id} className="cursor-pointer group" onClick={() => setWallpaper(wp.id as Wallpaper)}>
              <div
                className={`rounded-lg overflow-hidden ring-2 transition-all ${wallpaper === wp.id ? 'ring-opacity-100' : 'ring-opacity-0 group-hover:ring-opacity-50'}`}
                // FIX: 'ringColor' is not a valid CSS property. Used the '--tw-ring-color' CSS variable to set the ring color for Tailwind's ring utility.
                style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
              >
                <img src={wp.url} alt={wp.name} className="w-full h-24 object-cover" />
              </div>
              <p className="text-sm mt-1 text-center">{wp.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Personalization;