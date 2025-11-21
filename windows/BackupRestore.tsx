import React, { useContext, useState } from 'react';
import { SettingsContext } from '../contexts/SettingsContext';
import { WindowManagerContext } from '../contexts/WindowManagerContext';
import { getAllItems, clearStore, bulkPutItems, STORE_NAMES, DBSettings } from '../utils/db';
import { ExportIcon, ImportIcon, TrashIcon } from '../components/icons/AppIcons';

const BackupRestore: React.FC = () => {
    const settings = useContext(SettingsContext);
    const winManager = useContext(WindowManagerContext);
    const [isImporting, setIsImporting] = useState(false);
    const [isClearing, setIsClearing] = useState(false);

    const handleExport = async () => {
        try {
            const backupData = {
                [STORE_NAMES.SETTINGS]: await getAllItems<DBSettings>(STORE_NAMES.SETTINGS),
                [STORE_NAMES.TRANSACTIONS]: await getAllItems(STORE_NAMES.TRANSACTIONS),
                [STORE_NAMES.BOLETOS]: await getAllItems(STORE_NAMES.BOLETOS),
                [STORE_NAMES.FATURAMENTOS]: await getAllItems(STORE_NAMES.FATURAMENTOS),
                [STORE_NAMES.FATURAMENTOS_SEM_NOTA]: await getAllItems(STORE_NAMES.FATURAMENTOS_SEM_NOTA),
                [STORE_NAMES.CATEGORIES]: await getAllItems(STORE_NAMES.CATEGORIES),
            };

            const jsonString = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
            link.download = `finansys_pro_backup_${timestamp}.json`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            
            winManager?.addNotification({
                title: 'Sucesso',
                message: 'Backup exportado com sucesso!',
                type: 'success',
            });

        } catch (error) {
            console.error('Failed to export data:', error);
            winManager?.addNotification({
                title: 'Erro',
                message: 'Falha ao exportar os dados.',
                type: 'error',
            });
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const backupData = JSON.parse(text);

                const requiredKeys = [
                    STORE_NAMES.SETTINGS,
                    STORE_NAMES.TRANSACTIONS,
                    STORE_NAMES.BOLETOS,
                    STORE_NAMES.FATURAMENTOS,
                    STORE_NAMES.FATURAMENTOS_SEM_NOTA,
                    STORE_NAMES.CATEGORIES,
                ];
                if (!requiredKeys.every(key => key in backupData)) {
                    throw new Error('Arquivo de backup inválido ou corrompido.');
                }

                if (window.confirm('Tem certeza? A importação de um backup substituirá TODOS os dados atuais. Esta ação não pode ser desfeita.')) {
                    setIsImporting(true);
                    
                    for (const storeName of requiredKeys) {
                        if (backupData[storeName]) {
                            await clearStore(storeName);
                            await bulkPutItems(storeName, backupData[storeName]);
                        }
                    }

                    winManager?.addNotification({
                        title: 'Sucesso!',
                        message: 'Backup restaurado. O aplicativo será recarregado.',
                        type: 'success',
                    });

                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Falha ao processar o arquivo.';
                console.error('Failed to import data:', error);
                winManager?.addNotification({ title: 'Erro de Importação', message, type: 'error' });
                setIsImporting(false);
            }
        };
        reader.readAsText(file);
    };

    const openFilePicker = () => {
        document.getElementById('backup-file-input')?.click();
    };

    const handleClearData = async () => {
        if (window.confirm('ATENÇÃO: Esta ação é irreversível e irá apagar TODOS os dados financeiros (transações, boletos, faturamentos, categorias, etc.). Seus usuários e configurações de aparência serão mantidos. Deseja continuar?')) {
            setIsClearing(true);
            try {
                const storesToClear = [
                    STORE_NAMES.TRANSACTIONS,
                    STORE_NAMES.BOLETOS,
                    STORE_NAMES.FATURAMENTOS,
                    STORE_NAMES.FATURAMENTOS_SEM_NOTA,
                    STORE_NAMES.CATEGORIES,
                ];

                for (const storeName of storesToClear) {
                    await clearStore(storeName);
                }

                winManager?.addNotification({
                    title: 'Sucesso!',
                    message: 'Todos os dados financeiros foram apagados. O aplicativo será recarregado.',
                    type: 'success',
                });

                setTimeout(() => {
                    window.location.reload();
                }, 2000);

            } catch (error) {
                console.error('Failed to clear data:', error);
                winManager?.addNotification({
                    title: 'Erro',
                    message: 'Falha ao limpar os dados.',
                    type: 'error',
                });
                setIsClearing(false);
            }
        }
    };

    if (!settings || !winManager) return null;

    return (
        <div className="p-6 bg-slate-100 dark:bg-slate-900 h-full text-slate-800 dark:text-slate-200 overflow-y-auto flex flex-col items-center text-center">
            <h1 className="text-2xl font-bold mb-4">Backup e Restauração</h1>
            <p className="mb-8 max-w-md text-slate-600 dark:text-slate-400">
                Exporte todos os seus dados para um arquivo seguro ou importe um backup para restaurar seu sistema.
            </p>

            <div className="w-full max-w-xs space-y-4">
                <button
                    onClick={handleExport}
                    className="w-full text-white font-semibold py-3 px-4 rounded-lg transition-opacity hover:opacity-90 flex items-center justify-center gap-3 text-lg"
                    style={{ backgroundColor: settings.accentColor }}
                >
                    <ExportIcon className="w-6 h-6"/>
                    Exportar Backup
                </button>
                
                <button
                    onClick={openFilePicker}
                    disabled={isImporting}
                    className="w-full bg-slate-300 dark:bg-slate-700 font-semibold py-3 px-4 rounded-lg transition-opacity hover:opacity-90 flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-wait"
                >
                    <ImportIcon className="w-6 h-6" />
                    {isImporting ? 'Restaurando...' : 'Importar Backup'}
                </button>
                <input
                    type="file"
                    id="backup-file-input"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>

            <div className="border-t border-slate-300 dark:border-slate-700 w-full max-w-md my-8" />

            <div className="w-full max-w-md">
                <h2 className="text-xl font-bold text-red-500">Zona de Perigo</h2>
                <p className="mt-2 mb-4 text-slate-600 dark:text-slate-400">
                    A ação abaixo é permanente e não pode ser desfeita.
                </p>
                <button
                    onClick={handleClearData}
                    disabled={isClearing}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-wait"
                >
                    <TrashIcon className="w-5 h-5" />
                    {isClearing ? 'Limpando...' : 'Limpar Dados Financeiros'}
                </button>
                <p className="text-xs mt-2 text-slate-500">
                    Isso apagará transações, boletos, faturamentos e categorias, mas manterá usuários e configurações de aparência.
                </p>
            </div>
        </div>
    );
};

export default BackupRestore;