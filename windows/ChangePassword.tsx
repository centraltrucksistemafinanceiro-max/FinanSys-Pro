import React, { useContext, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { WindowManagerContext } from '../contexts/WindowManagerContext';

const ChangePassword: React.FC = () => {
    const auth = useContext(AuthContext);
    const settings = useContext(SettingsContext);
    const winManager = useContext(WindowManagerContext);
    
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    if (!auth || !settings || !winManager) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            winManager.addNotification({ title: 'Erro', message: 'As novas senhas não correspondem.', type: 'error' });
            return;
        }
        if (newPassword.length < 6) {
            winManager.addNotification({ title: 'Erro', message: 'A nova senha deve ter pelo menos 6 caracteres.', type: 'error' });
            return;
        }
        const success = await auth.changePassword(oldPassword, newPassword);
        if (success) {
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
            winManager.closeWindow(winManager.windows.find(w => w.appId === 'change-password')?.id || '');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-6 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            <h1 className="text-2xl font-bold mb-6">Alterar Senha</h1>
            <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
                <div>
                    <label htmlFor="oldPassword" className="block text-sm font-medium">Senha Antiga</label>
                    <input type="password" id="oldPassword" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required className="mt-1 w-full p-2 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:ring-2" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                </div>
                <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium">Nova Senha</label>
                    <input type="password" id="newPassword" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="mt-1 w-full p-2 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:ring-2" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                </div>
                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium">Confirmar Nova Senha</label>
                    <input type="password" id="confirmPassword" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="mt-1 w-full p-2 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:ring-2" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                </div>
                <button type="submit" className="w-full text-white font-semibold py-2 px-4 rounded-lg transition-opacity hover:opacity-90 mt-4" style={{ backgroundColor: settings.accentColor }}>
                    Alterar Senha
                </button>
            </form>
        </div>
    );
};

export default ChangePassword;
