
import React, { useContext, useState, useRef } from 'react';
import { CategoryContext } from '../contexts/CategoryContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { TransactionContext } from '../contexts/TransactionContext';
import { BoletoContext } from '../contexts/BoletoContext';
import { WindowManagerContext } from '../contexts/WindowManagerContext';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

const CategoryManagement: React.FC = () => {
    const categoryContext = useContext(CategoryContext);
    const settings = useContext(SettingsContext);
    const transactionContext = useContext(TransactionContext);
    const boletoContext = useContext(BoletoContext);
    const winManager = useContext(WindowManagerContext);
    const [newCategoryName, setNewCategoryName] = useState('');
    const categoryNameInputRef = useRef<HTMLInputElement>(null);

    if (!categoryContext || !settings || !transactionContext || !boletoContext || !winManager) return null;

    const { categories, addCategory, deleteCategory, resetToDefaults } = categoryContext;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await addCategory(newCategoryName);
        if (success) {
            setNewCategoryName('');
            categoryNameInputRef.current?.focus();
        }
    };
    
    const handleDelete = async (id: string) => {
        const categoryToDelete = categories.find(c => c.id === id);
        if (!categoryToDelete) return;

        const transactions = await transactionContext.queryTransactions({ 
            companyId: categoryToDelete.companyId, 
            filters: { category: categoryToDelete.name } 
        });
        
        const boletos = await boletoContext.queryBoletos({ 
            companyId: categoryToDelete.companyId, 
            filters: { category: categoryToDelete.name } 
        });

        const isUsed = transactions.length > 0 || boletos.length > 0;

        if (isUsed) {
            winManager.addNotification({
                title: 'Ação Bloqueada',
                message: 'A categoria está em uso e não pode ser excluída.',
                type: 'warning',
            });
            return;
        }

        if (window.confirm(`Tem certeza que deseja excluir a categoria "${categoryToDelete.name}"?`)) {
            deleteCategory(id);
        }
    };

    const handleReset = async () => {
        if (window.confirm("ATENÇÃO: Isso excluirá todas as categorias atuais e recriará as categorias padrão do sistema. Categorias personalizadas serão perdidas. Deseja continuar?")) {
            await resetToDefaults();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            <div className="flex-shrink-0 p-4 border-b border-slate-300 dark:border-slate-700 flex justify-between items-center">
                <h1 className="text-xl font-bold">Gerenciar Categorias</h1>
                <button
                    onClick={handleReset}
                    className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 border border-red-500 hover:bg-red-500/10 px-3 py-1 rounded transition-colors"
                    title="Apagar atuais e restaurar padrão"
                >
                    <ArrowPathIcon className="w-4 h-4" />
                    Restaurar Padrões
                </button>
            </div>

            <div className="p-4 flex-shrink-0">
                <form onSubmit={handleSubmit} className="flex items-end gap-4">
                    <div className="flex-grow">
                        <label htmlFor="newCategoryName" className="block text-sm font-medium mb-1">Nova Categoria</label>
                        <input
                            ref={categoryNameInputRef}
                            type="text"
                            id="newCategoryName"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Ex: INVESTIMENTOS"
                            required
                            className="w-full p-2 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:ring-2 uppercase"
                            style={{ '--tw-ring-color': settings.accentColor } as React.CSSProperties}
                        />
                    </div>
                    <button
                        type="submit"
                        className="text-white font-semibold py-2 px-6 rounded-lg transition-opacity hover:opacity-90"
                        style={{ backgroundColor: settings.accentColor }}
                    >
                        Adicionar
                    </button>
                </form>
            </div>

            <div className="flex-grow p-4 overflow-y-auto">
                <h2 className="font-semibold mb-3 text-lg">Categorias Existentes</h2>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
                    <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                        {categories.map((category) => (
                            <li key={category.id} className="px-4 py-3 flex items-center justify-between">
                                <span className="font-medium">{category.name}</span>
                                <button
                                    onClick={() => handleDelete(category.id)}
                                    className="text-red-500 hover:text-red-700"
                                    title="Excluir Categoria"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </li>
                        ))}
                    </ul>
                     {categories.length === 0 && <p className="text-center p-10 text-slate-500">Nenhuma categoria cadastrada.</p>}
                </div>
            </div>
        </div>
    );
};

export default CategoryManagement;
