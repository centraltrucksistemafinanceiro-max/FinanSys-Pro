import React, { useContext, useState, useRef } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { SettingsContext } from '../contexts/SettingsContext';

const UserManagement: React.FC = () => {
    const auth = useContext(AuthContext);
    const settings = useContext(SettingsContext);
    const usernameInputRef = useRef<HTMLInputElement>(null);
    
    const initialFormState = { username: '', password: '', role: UserRole.USER };
    const [formState, setFormState] = useState(initialFormState);

    if (!auth || !settings) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const finalValue = name === 'username' ? value.toUpperCase() : value;
        setFormState(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.username || !formState.password) {
            alert('Nome de usuário e senha são obrigatórios.');
            return;
        }
        const success = await auth.addUser(formState.username, formState.password, formState.role);
        if (success) {
            setFormState(initialFormState);
            usernameInputRef.current?.focus();
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
            auth.deleteUser(id);
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-full bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            <div className="w-full md:w-2/5 p-4 border-b md:border-b-0 md:border-r border-slate-300 dark:border-slate-700">
                <h2 className="font-semibold mb-3 text-lg">Adicionar Novo Usuário</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium">Nome de Usuário</label>
                        <input ref={usernameInputRef} type="text" id="username" name="username" value={formState.username} onChange={handleInputChange} required className="mt-1 w-full p-2 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:ring-2 uppercase" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium">Senha</label>
                        <input type="password" id="password" name="password" value={formState.password} onChange={handleInputChange} required className="mt-1 w-full p-2 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:ring-2" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                    </div>
                    <div>
                        <label htmlFor="role" className="block text-sm font-medium">Função</label>
                        <select id="role" name="role" value={formState.role} onChange={handleInputChange} className="mt-1 w-full p-2 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:ring-2" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties}>
                            <option value={UserRole.USER}>Usuário</option>
                            <option value={UserRole.ADMIN}>Admin</option>
                        </select>
                    </div>
                    <button type="submit" className="w-full text-white font-semibold py-2 px-4 rounded-lg transition-opacity hover:opacity-90" style={{ backgroundColor: settings.accentColor }}>
                        Criar Usuário
                    </button>
                </form>
            </div>
            <div className="w-full md:w-3/5 p-4 overflow-y-auto">
                <h2 className="font-semibold mb-3 text-lg">Usuários Cadastrados</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-slate-200 dark:bg-slate-800 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">Nome</th>
                                <th className="px-4 py-2">Função</th>
                                <th className="px-4 py-2 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {auth.users.map((user) => (
                                <tr key={user.id} className="border-b border-slate-200 dark:border-slate-700">
                                    <td className="px-4 py-2">{user.username}</td>
                                    <td className="px-4 py-2">{user.role}</td>
                                    <td className="px-4 py-2">
                                        <div className="flex justify-center">
                                            <button onClick={() => handleDelete(user.id)} className="text-red-500 hover:text-red-700 disabled:opacity-50" title="Excluir" disabled={auth.currentUser?.id === user.id}>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;