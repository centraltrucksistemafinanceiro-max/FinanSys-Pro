
import { Wallpaper, Company } from './types';

export const COMPANIES: Company[] = [
    { id: 'assistencia', name: 'CENTRAL TRUCK ASSISTENCIA' },
    { id: 'distribuidora', name: 'CENTRAL TRUCK DISTRIBUIDORA' },
    { id: 'transportadora', name: 'CENTRAL TRUCK TRANSPORTADORA' },
];

export const DEFAULT_CATEGORIES: string[] = [
    'CONSÓRCIO',
    'DESPESAS FIXAS',
    'DIVERSOS',
    'DOAÇÃO',
    'FERRAMENTAS',
    'FORNECEDOR',
    'IMPOSTOS',
    'PEÇAS USADAS',
    'SALÁRIO',
    'TERCEIRIZADO',
    'TERRENO'
];

export const WALLPAPERS: { id: Wallpaper; url: string; name: string }[] = [
    { id: 'wallpaper2', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=1920&auto=format&fit=crop', name: 'Mountain Layers' },
    { id: 'wallpaper3', url: 'https://images.unsplash.com/photo-1554147090-e1221a04a025?q=80&w=1920&auto=format&fit=crop', name: 'Liquid Swirl' },
    { id: 'wallpaper4', url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?q=80&w=1920&auto=format&fit=crop', name: 'Tokyo Night' },
    { id: 'wallpaper5', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=1920&auto=format&fit=crop', name: 'Galaxy' },
    { id: 'wallpaper6', url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?q=80&w=1920&auto=format&fit=crop', name: 'Starry Beach' },
    { id: 'wallpaper8', url: 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?q=80&w=1920&auto=format&fit=crop', name: 'Aurora Borealis' },
];

export const ACCENT_COLORS: string[] = [
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#10b981', // emerald-500
  '#f97316', // orange-500
  '#ef4444', // red-500
  '#22c55e', // green-500
  '#eab308', // yellow-500
  '#06b6d4', // cyan-500
  '#f43f5e', // rose-500
  '#64748b', // slate-500
  '#f59e0b', // amber-500
];
