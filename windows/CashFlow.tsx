
import React, { useContext, useState, useMemo, useEffect, useRef } from 'react';
import { TransactionContext } from '../contexts/TransactionContext';
import { CompanyContext } from '../contexts/CompanyContext';
import { CategoryContext } from '../contexts/CategoryContext';
import { Transaction, TransactionType } from '../types';
import { SettingsContext } from '../contexts/SettingsContext';
import { exportToXLSX } from '../utils/xlsxUtils';
import { WindowManagerContext } from '../contexts/WindowManagerContext';
import { ExportIcon, PrinterIcon } from '../components/icons/AppIcons';
import { formatCurrency, formatDateForDisplay } from '../utils/formatters';

const CashFlow: React.FC = () => {
  const transactionContext = useContext(TransactionContext);
  const companyContext = useContext(CompanyContext);
  const categoryContext = useContext(CategoryContext);
  const settings = useContext(SettingsContext);
  const winManager = useContext(WindowManagerContext);
  const dateInputRef = useRef<HTMLInputElement>(null);
    
  if (!transactionContext || !settings || !winManager || !categoryContext || !companyContext) return null;
  const { queryTransactions, addTransaction, deleteTransaction, updateTransaction, getTotals } = transactionContext;
  const { categories } = categoryContext;

  const getInitialCategory = () => (categories.length > 0 ? categories[0].name : '');

  const initialFormState = {
    type: TransactionType.EXPENSE,
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    category: getInitialCategory(),
    notes: ''
  };

  const [formState, setFormState] = useState(initialFormState);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  
  const [filters, setFilters] = useState({ description: '', startDate: '', endDate: '', category: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' }>({ key: 'date', direction: 'descending' });
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<Transaction[]>([]);
  const [filteredBalance, setFilteredBalance] = useState(0);
  const [isPrinting, setIsPrinting] = useState(false);
  
  // Modal state
  const [confirmationModal, setConfirmationModal] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
  } | null>(null);
    
  const isEditing = editingTransactionId !== null;

  useEffect(() => {
    if (categories.length > 0 && !formState.category) {
        setFormState(prev => ({ ...prev, category: categories[0].name }));
    }
  }, [categories, formState.category]);

  useEffect(() => {
    if (editingTransactionId) {
      const transactionToEdit = items.find(t => t.id === editingTransactionId);
      if (transactionToEdit) {
        setFormState({
          type: transactionToEdit.type,
          date: transactionToEdit.date,
          description: transactionToEdit.description,
          amount: String(transactionToEdit.amount),
          category: transactionToEdit.category,
          notes: transactionToEdit.notes || ''
        });
      }
    } else {
      setFormState({ ...initialFormState, category: getInitialCategory() });
    }
  }, [editingTransactionId]);

  // Initial Load
  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true);
        const allItems = await queryTransactions({ companyId: companyContext.currentCompany.id, filters });
        setItems(allItems);
        
        const totals = await getTotals({ companyId: companyContext.currentCompany.id, filters });
        setFilteredBalance(totals.balance);
        setIsLoading(false);
    };
    loadData();
  }, [filters, companyContext.currentCompany.id]);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: name === 'description' ? value.toUpperCase() : value }));
  };
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: name === 'description' ? value.toUpperCase() : value }));
    setCurrentPage(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.description || !formState.amount) {
        winManager.addNotification({ title: 'Erro', message: 'Descrição e Valor são obrigatórios.', type: 'error'});
        return;
    }

    const transactionData = { ...formState, amount: parseFloat(formState.amount) };
    
    if (isEditing) {
      // Optimistic Update
      setItems(prev => prev.map(t => 
          t.id === editingTransactionId 
          ? { ...t, ...transactionData, id: editingTransactionId! } 
          : t
      ));
      await updateTransaction(editingTransactionId!, transactionData);
    } else {
      await addTransaction(transactionData);
      // Refresh list for Add to get real ID
      const allItems = await queryTransactions({ companyId: companyContext.currentCompany.id, filters });
      setItems(allItems);
    }

    setEditingTransactionId(null);
    setFormState({ ...initialFormState, category: getInitialCategory() });
    dateInputRef.current?.focus();
  };
  
  const openConfirmation = (title: string, message: string, onConfirm: () => void) => {
      setConfirmationModal({ isOpen: true, title, message, onConfirm });
  };
  
  const handleDelete = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      
      openConfirmation(
          "Excluir Transação",
          "Tem certeza que deseja excluir este registro? O saldo será recalculado.",
          async () => {
              // Optimistic Delete
              setItems(prev => prev.filter(t => t.id !== id));
              await deleteTransaction(id);
              // Update totals after delete
              const totals = await getTotals({ companyId: companyContext.currentCompany.id, filters });
              setFilteredBalance(totals.balance);
          }
      );
  };

  const handleEdit = (transaction: Transaction) => setEditingTransactionId(transaction.id);
  const handleCancelEdit = () => setEditingTransactionId(null);

  const sortedItems = useMemo(() => {
        let sortableItems = [...items];
        sortableItems.sort((a, b) => {
            const key = sortConfig.key as keyof Transaction;
            const aValue = a[key] as any;
            const bValue = b[key] as any;
            if (aValue == null) return 1; if (bValue == null) return -1;
            let comparison = 0;
            if (key === 'amount') comparison = aValue - bValue;
            else if (key === 'date') comparison = new Date(aValue).getTime() - new Date(bValue).getTime();
            else comparison = String(aValue).localeCompare(String(bValue));
            return sortConfig.direction === 'ascending' ? comparison : -comparison;
        });
        return sortableItems;
  }, [items, sortConfig]);

  const currentItems = useMemo(() => {
      if (isPrinting) return sortedItems;
      return sortedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [sortedItems, currentPage, isPrinting]);

  const dataForExport = useMemo(() => sortedItems.map(t => ({
      'Data': formatDateForDisplay(t.date), 'Descrição': t.description, 'Categoria': t.category, 'Tipo': t.type, 'Valor': t.amount,
  })), [sortedItems]);
  
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  
  const handlePrint = () => {
      setIsPrinting(true);
      setTimeout(() => {
          window.print();
      }, 500); // Increased timeout to allow rendering of all items
  };

  useEffect(() => {
      const handleAfterPrint = () => setIsPrinting(false);
      window.addEventListener('afterprint', handleAfterPrint);
      return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);
  
  const accentBgColor = { backgroundColor: settings.accentColor };
  const accentColor = settings.accentColor;

  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key) return null;
    return <span className="ml-1 select-none">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 p-4 gap-4 printable-dashboard relative">
      {/* Confirmation Modal */}
        {confirmationModal && confirmationModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 animate-scale-in">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{confirmationModal.title}</h3>
                    <p className="text-slate-600 dark:text-slate-300 mb-6">{confirmationModal.message}</p>
                    <div className="flex justify-end gap-3">
                        <button 
                            type="button"
                            onClick={() => setConfirmationModal(null)}
                            className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="button"
                            onClick={() => { confirmationModal.onConfirm(); setConfirmationModal(null); }}
                            className="px-4 py-2 text-white rounded transition-colors font-medium hover:opacity-90 shadow-md"
                            style={{ backgroundColor: settings.accentColor }}
                        >
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
        )}

      <h1 className="hidden print:block text-2xl font-bold mb-4 text-black">Relatório de Fluxo de Caixa</h1>
      
      <div className="flex-shrink-0 bg-slate-800 p-4 rounded-lg shadow-lg no-print">
          <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-2">
                      <label htmlFor="date" className="block text-sm font-medium mb-1 text-slate-400">Data</label>
                      <input ref={dateInputRef} type="date" id="date" name="date" value={formState.date} onChange={handleInputChange} required className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': accentColor} as React.CSSProperties} />
                  </div>
                  <div className="md:col-span-3">
                      <label htmlFor="description" className="block text-sm font-medium mb-1 text-slate-400">Descrição</label>
                      <input type="text" id="description" name="description" value={formState.description} onChange={handleInputChange} placeholder="Ex: Pagamento de fornecedor" required className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none uppercase" style={{'--tw-ring-color': accentColor} as React.CSSProperties} />
                  </div>
                  <div className="md:col-span-2">
                      <label htmlFor="category" className="block text-sm font-medium mb-1 text-slate-400">Categoria</label>
                      <select id="category" name="category" value={formState.category} onChange={handleInputChange} className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': accentColor} as React.CSSProperties}>
                          {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                      </select>
                  </div>
                  <div className="md:col-span-1">
                      <label htmlFor="type" className="block text-sm font-medium mb-1 text-slate-400">Tipo</label>
                      <select id="type" name="type" value={formState.type} onChange={handleInputChange} className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': accentColor} as React.CSSProperties}>
                          <option value={TransactionType.EXPENSE}>SAÍDA</option>
                          <option value={TransactionType.INCOME}>ENTRADA</option>
                      </select>
                  </div>
                  <div className="md:col-span-2">
                      <label htmlFor="amount" className="block text-sm font-medium mb-1 text-slate-400">Valor</label>
                      <input type="number" id="amount" name="amount" value={formState.amount} onChange={handleInputChange} required step="0.01" min="0" placeholder="0" className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': accentColor} as React.CSSProperties} />
                  </div>
                  <div className="md:col-span-2 flex flex-col">
                    <button type="submit" className="w-full text-white font-semibold py-2 px-4 rounded-lg transition-colors" style={accentBgColor}>
                        {isEditing ? 'Salvar' : 'Adicionar'}
                    </button>
                    {isEditing && (
                      <button type="button" onClick={handleCancelEdit} className="w-full bg-slate-600 font-semibold py-2 px-4 rounded-lg transition-opacity hover:opacity-90 mt-2">
                        Cancelar
                      </button>
                    )}
                  </div>
              </div>
          </form>
      </div>

      <div className="flex-shrink-0 bg-slate-800 p-3 rounded-lg shadow-lg flex flex-wrap justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-2 no-print">
              <input type="text" name="description" value={filters.description} onChange={handleFilterChange} placeholder="Buscar por descrição..." className="p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none w-64 uppercase" style={{'--tw-ring-color': accentColor} as React.CSSProperties} />
              <select name="category" value={filters.category} onChange={handleFilterChange} className="p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': accentColor} as React.CSSProperties}>
                  <option value="">Todas as Categorias</option>
                  {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
              </select>
              <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" />
              <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" />
          </div>
          <div className="flex items-center gap-4">
              <div className="text-right">
                  <span className="text-xs text-slate-400 uppercase">Saldo Filtrado</span>
                  <p className={`text-2xl font-bold ${filteredBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(filteredBalance)}</p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button onClick={handlePrint} className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded flex items-center transition-colors" title="Imprimir"><PrinterIcon className="w-5 h-5" /></button>
                <button onClick={() => exportToXLSX(dataForExport, 'fluxo_de_caixa.xlsx')} className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded flex items-center transition-colors"><ExportIcon className="w-5 h-5 mr-2" />Exportar XLSX</button>
              </div>
          </div>
      </div>

      <div className="flex-grow bg-slate-800 rounded-lg shadow-lg overflow-y-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900/70 sticky top-0">
                  <tr>
                      <th className="px-6 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('date')}>Data {getSortIndicator('date')}</th>
                      <th className="px-6 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('description')}>Descrição {getSortIndicator('description')}</th>
                      <th className="px-6 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('category')}>Categoria {getSortIndicator('category')}</th>
                      <th className="px-6 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('type')}>Tipo {getSortIndicator('type')}</th>
                      <th className="px-6 py-3 text-right cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('amount')}>Valor {getSortIndicator('amount')}</th>
                      <th className="px-6 py-3 text-center no-print">Ações</th>
                  </tr>
              </thead>
              <tbody>
                  {isLoading ? (
                      <tr><td colSpan={6} className="text-center p-10 text-slate-500">Carregando...</td></tr>
                  ) : currentItems.map((t: Transaction) => (
                      <tr key={t.id} onDoubleClick={() => handleEdit(t)} className="border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer">
                          <td className="px-6 py-4">{formatDateForDisplay(t.date)}</td>
                          <td className="px-6 py-4 font-medium uppercase text-slate-200">{t.description}</td>
                          <td className="px-6 py-4">{t.category}</td>
                          <td className="px-6 py-4">
                            <span className={`font-semibold ${t.type === 'Entrada' ? 'text-green-400' : 'text-red-400'}`}>
                              {t.type.toUpperCase()}
                            </span>
                          </td>
                          <td className={`px-6 py-4 text-right font-medium ${t.type === 'Entrada' ? 'text-green-400' : 'text-red-400'}`}>
                              {formatCurrency(t.amount)}
                          </td>
                          <td className="px-6 py-4 no-print">
                              <div className="flex justify-center items-center gap-4">
                                  <button onClick={() => handleEdit(t)} className="font-medium text-blue-400 hover:underline">Editar</button>
                                  <button onClick={(e) => handleDelete(e, t.id)} className="font-medium text-red-400 hover:underline">Excluir</button>
                              </div>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
        </div>
           {!isLoading && items.length === 0 && <p className="text-center p-10 text-slate-500">Nenhuma transação encontrada.</p>}
      </div>

      <div className="flex-shrink-0 flex justify-between items-center text-sm text-slate-400 pt-2 no-print">
          <div>{totalItems > 0 ? `Mostrando ${Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} a ${Math.min(currentPage * itemsPerPage, totalItems)} de ${totalItems} registros` : 'Nenhum registro encontrado'}</div>
          <div className="flex items-center gap-2">
              <button onClick={handlePrevPage} disabled={currentPage === 1} className="px-3 py-1 bg-slate-700 rounded disabled:opacity-50">&lt;</button>
              <span>{currentPage} de {totalPages > 0 ? totalPages : 1}</span>
              <button onClick={handleNextPage} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 bg-slate-700 rounded disabled:opacity-50">&gt;</button>
          </div>
      </div>
    </div>
  );
};

export default CashFlow;
