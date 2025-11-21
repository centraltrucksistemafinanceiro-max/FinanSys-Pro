

import React, { useContext } from 'react';
import { SettingsContext } from '../contexts/SettingsContext';

const About: React.FC = () => {
    const settings = useContext(SettingsContext);
    const accentTextColor = { color: settings?.accentColor };

    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            <img src="https://lh3.googleusercontent.com/d/10eVKUmKef7BQNeJHl8Cz1gJbX8UBSCVd" alt="FinanSys Pro Logo" className="w-20 h-20 mb-4" />
            <h1 className="text-3xl font-bold" style={accentTextColor}>
                FinanSys Pro
            </h1>
            <p className="mb-2">Controle Financeiro Inteligente</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Desenvolvido com React, TypeScript e Tailwind CSS.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-6">
                © 2024. Todos os direitos reservados.
            </p>
        </div>
    );
};

export default About;