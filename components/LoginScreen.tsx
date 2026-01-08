
import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { WALLPAPERS } from '../constants';
import { EyeIcon, EyeSlashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import Logo from './Logo';

const REMEMBER_ME_KEY = 'rememberedUsername';
const BRAND_BLUE = '#3b82f6'; 

const LoginScreen: React.FC = () => {
  const auth = useContext(AuthContext);
  const settings = useContext(SettingsContext);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  useEffect(() => {
    const rememberedUsername = localStorage.getItem(REMEMBER_ME_KEY);
    if (rememberedUsername) {
        setUsername(rememberedUsername);
        setRememberMe(true);
    }
  }, []);

  const wallpaperUrl = WALLPAPERS.find(w => w.id === settings?.wallpaper)?.url || WALLPAPERS[0].url;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!username || !password) {
      setError('Por favor, digite o usuário e a senha.');
      setIsLoading(false);
      return;
    }
    
    if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, username.toUpperCase());
    } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
    }

    try {
      const result = await auth?.login(username.toUpperCase(), password);

      if (!result?.success) {
        setError(result?.error || 'Falha ao realizar login.');
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!auth || !settings) return null;

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-cover bg-center" style={{ backgroundImage: `url(${wallpaperUrl})` }}>
      <div className="absolute inset-0 bg-black/60" />
      
      <div className="relative w-full max-w-sm p-8 space-y-6 bg-[#1e293b]/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10">
        <div className="text-center">
          <Logo className="w-24 h-24 mx-auto mb-4 object-contain" />
          <h1 className="text-3xl font-bold tracking-tight text-white">
            FinanSys Pro
          </h1>
          <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-wider">Acesso ao Sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username-input" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Usuário
            </label>
            <input
              id="username-input"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.toUpperCase())}
              className="block w-full px-4 py-3 bg-white/5 border border-slate-600 rounded-lg shadow-sm placeholder-slate-500 focus:outline-none focus:ring-2 transition-all uppercase text-white"
              style={{ '--tw-ring-color': BRAND_BLUE } as React.CSSProperties}
              placeholder="Digite seu usuário"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Senha
            </label>
            <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-4 py-3 bg-white/5 border border-slate-600 rounded-lg shadow-sm placeholder-slate-500 focus:outline-none focus:ring-2 pr-10 transition-all text-white"
                  style={{ '--tw-ring-color': BRAND_BLUE } as React.CSSProperties}
                  placeholder="Sua senha"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                >
                    {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <label className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
                style={{ accentColor: BRAND_BLUE }}
              />
              <span className="ml-2 text-sm text-slate-400 group-hover:text-slate-200 transition-colors select-none">Lembrar usuário</span>
            </label>
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-900/50 p-3 rounded-lg flex items-start gap-2 animate-fade-in">
                <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-black text-white transition-all transform hover:-translate-y-0.5 hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            style={{ backgroundColor: BRAND_BLUE }}
          >
            {isLoading ? (
                <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    AUTENTICANDO...
                </span>
            ) : (
                'ENTRAR NO SISTEMA'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;