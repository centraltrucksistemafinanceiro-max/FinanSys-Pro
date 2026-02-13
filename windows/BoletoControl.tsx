
import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { BoletoContext } from '../contexts/BoletoContext';
import { CategoryContext } from '../contexts/CategoryContext';
import { Boleto, BoletoStatus } from '../types';
import { SettingsContext } from '../contexts/SettingsContext';
import { exportToXLSX } from '../utils/xlsxUtils';
import { WindowManagerContext } from '../contexts/WindowManagerContext';
import { ExportIcon, PrinterIcon } from '../components/icons/AppIcons';
import { formatCurrency, formatDateForDisplay, parseCurrency, parseDateFromBr } from '../utils/formatters';
import { CompanyContext } from '../contexts/CompanyContext';
import { PrivacyContext } from '../contexts/PrivacyContext';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const getStatusBadge = (status: BoletoStatus) => {
    switch (status) {
        case BoletoStatus.PAID:
            return <span className="px-3 py-1 text-xs font-semibold leading-tight rounded-full bg-green-500 text-white">PAGO</span>;
        case BoletoStatus.OVERDUE:
            return <span className="px-3 py-1 text-xs font-semibold leading-tight rounded-full bg-red-500 text-white">VENCIDO</span>;
        case BoletoStatus.OPEN:
        default:
            return <span className="px-3 py-1 text-xs font-semibold leading-tight rounded-full bg-yellow-500 text-white">ABERTA</span>;
    }
};

const BoletoControl: React.FC = () => {
  const boletoContext = useContext(BoletoContext);
  const categoryContext = useContext(CategoryContext);
  const settings = useContext(SettingsContext);
  const winManager = useContext(WindowManagerContext);
  const companyContext = useContext(CompanyContext);
  const { isValuesVisible, toggleVisibility } = useContext(PrivacyContext)!;
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  const displayValue = (val: number) => isValuesVisible ? formatCurrency(val) : '••••';

  // Calcula datas do mês atual para o filtro padrão
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [confirmationModal, setConfirmationModal] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
  } | null>(null);

  if (!boletoContext || !settings || !winManager || !categoryContext || !companyContext) return null;
  
  const { queryBoletos, addBoleto, addMultipleBoletos, deleteBoleto, updateBoleto, payBoleto } = boletoContext;
  const { categories } = categoryContext;

  const [boletos, setBoletos] = useState<Boleto[]>([]);
  
  const loadBoletos = async () => {
      if (companyContext.currentCompany.id) {
          const data = await queryBoletos({ companyId: companyContext.currentCompany.id });
          setBoletos(data);
      }
  };

  useEffect(() => {
    loadBoletos();
  }, [companyContext.currentCompany.id]);

  const getInitialCategory = () => (categories.length > 0 ? categories[0].name : '');
  
  const initialFormState = {
    date: new Date().toISOString().split('T')[0],
    description: '',
    amountWithInvoice: '0',
    amountWithoutInvoice: '0',
    category: getInitialCategory(),
  };

  const [formState, setFormState] = useState(initialFormState);
  const [editingBoletoId, setEditingBoletoId] = useState<string | null>(null);
  
  // Revertido para filtrar por mês por padrão (diferente do Fluxo de Caixa)
  const [filters, setFilters] = useState({
    description: '',
    startDate: firstDay,
    endDate: lastDay,
    category: '',
  });

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' }>({ key: 'date', direction: 'descending' });

  const [descriptionSuggestions, setDescriptionSuggestions] = useState<string[]>([]);
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [viewMode, setViewMode] = useState<'single' | 'batch'>('single');
  const [batchData, setBatchData] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isFormExpanded, setIsFormExpanded] = useState(window.innerWidth > 768);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(window.innerWidth > 768);
  
  const isEditing = editingBoletoId !== null;

  const uniqueDescriptions = useMemo(() => {
    const descriptions = boletos.map(b => b.description);
    return [...new Set(descriptions)];
  }, [boletos]);

  useEffect(() => {
    if (categories.length > 0) {
        const categoryExists = categories.some(c => c.name === formState.category);
        if (!categoryExists) {
            setFormState(prev => ({ ...prev, category: categories[0].name }));
        }
    } else if (formState.category) {
        setFormState(prev => ({ ...prev, category: '' }));
    }
  }, [categories, formState.category]);


  useEffect(() => {
    if (editingBoletoId) {
      setViewMode('single');
      const boletoToEdit = boletos.find(b => b.id === editingBoletoId);
      if (boletoToEdit) {
        setFormState({
          date: boletoToEdit.date,
          description: boletoToEdit.description,
          amountWithInvoice: String(boletoToEdit.amountWithInvoice),
          amountWithoutInvoice: String(boletoToEdit.amountWithoutInvoice),
          category: boletoToEdit.category,
        });
      }
    } else {
      setFormState({
        ...initialFormState,
        category: getInitialCategory(),
      });
    }
  }, [editingBoletoId]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [descriptionSuggestions]);

  useEffect(() => {
    if (isEditing) {
      setIsFormExpanded(true);
    }
  }, [isEditing]);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const finalValue = name === 'description' ? value.toUpperCase() : value;
    setFormState(prev => ({ ...prev, [name]: finalValue }));
    
    if (name === 'description' && finalValue) {
        const filtered = uniqueDescriptions
            .filter(d => d.toLowerCase().includes(finalValue.toLowerCase()) && d.toLowerCase() !== finalValue.toLowerCase())
            .slice(0, 5);
        setDescriptionSuggestions(filtered);
    } else if (name === 'description') {
        setDescriptionSuggestions([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (descriptionSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % descriptionSuggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + descriptionSuggestions.length) % descriptionSuggestions.length);
        break;
      case 'Enter':
        if (highlightedIndex > -1) {
          e.preventDefault();
          setFormState(prev => ({ ...prev, description: descriptionSuggestions[highlightedIndex] }));
          setDescriptionSuggestions([]);
        }
        break;
      case 'Escape':
        setDescriptionSuggestions([]);
        break;
      default:
        break;
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const finalValue = name === 'description' ? value.toUpperCase() : value;
    setFilters(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.description || (formState.amountWithInvoice === '' && formState.amountWithoutInvoice === '')) {
        winManager.addNotification({ title: "Erro", message: "Descrição e pelo menos um valor são obrigatórios.", type: "error"});
        return;
    }
    
    if (!formState.category) {
        winManager.addNotification({ title: "Erro", message: "Selecione uma categoria.", type: "error"});
        return;
    }

    const boletoData = {
      ...formState,
      amountWithInvoice: parseFloat(formState.amountWithInvoice) || 0,
      amountWithoutInvoice: parseFloat(formState.amountWithoutInvoice) || 0,
    };
    
    if (isEditing) {
      setBoletos(prev => prev.map(b => 
          b.id === editingBoletoId
          ? { ...b, ...boletoData, amountWithInvoice: Number(boletoData.amountWithInvoice), amountWithoutInvoice: Number(boletoData.amountWithoutInvoice) }
          : b
      ));
      
      await updateBoleto(editingBoletoId, boletoData);
      setEditingBoletoId(null);
    } else {
      await addBoleto(boletoData);
      await loadBoletos();
    }
    
    const resetCategory = categories.length > 0 ? categories[0].name : '';
    setFormState({ ...initialFormState, category: resetCategory });
    descriptionInputRef.current?.focus();
  };

  const handleProcessBatch = async () => {
    setIsProcessing(true);
    const lines = batchData.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
        winManager.addNotification({ title: 'Aviso', message: 'Nenhum dado para processar.', type: 'warning' });
        setIsProcessing(false);
        return;
    }

    type NewBoletoPayload = Omit<Boleto, 'id' | 'companyId' | 'status' | 'paymentDate'> & { status?: BoletoStatus; paymentDate?: string };
    const newBoletos: NewBoletoPayload[] = [];
    let errorCount = 0;

    lines.forEach(line => {
        if (line.toLowerCase().includes('descricao')) return; 
        const columns = line.split('\t');
        if (columns.length < 5) { errorCount++; return; }
        const [description, amountWithInvoiceStr, amountWithoutInvoiceStr, category, dateStr, statusStr] = columns;
        const formattedDate = parseDateFromBr(dateStr);
        if (!description?.trim() || !category?.trim() || !formattedDate) { errorCount++; return; }

        const boletoPayload: NewBoletoPayload = {
            description: description.trim().toUpperCase(),
            amountWithInvoice: parseCurrency(amountWithInvoiceStr),
            amountWithoutInvoice: parseCurrency(amountWithoutInvoiceStr),
            category: category.trim().toUpperCase(),
            date: formattedDate,
        };
        if (statusStr && statusStr.trim().toUpperCase() === 'PAGO') {
            boletoPayload.status = BoletoStatus.PAID;
            boletoPayload.paymentDate = formattedDate;
        }
        newBoletos.push(boletoPayload);
    });

    if (newBoletos.length > 0) {
        await addMultipleBoletos(newBoletos);
        await loadBoletos();
        winManager.addNotification({ title: 'Sucesso', message: `${newBoletos.length} contas importadas.`, type: 'success' });
    }
    
    if (errorCount > 0) winManager.addNotification({ title: 'Aviso', message: `${errorCount} linhas ignoradas.`, type: 'warning' });

    setBatchData('');
    setViewMode('single');
    setIsProcessing(false);
  };
  
  const openConfirmation = (title: string, message: string, onConfirm: () => void) => {
      setConfirmationModal({ isOpen: true, title, message, onConfirm });
  };

  const handleDeleteBoleto = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      
      openConfirmation(
          "Excluir Boleto",
          "Tem certeza que deseja excluir este boleto? Esta ação não pode ser desfeita.",
          async () => {
            const previousBoletos = [...boletos];
            setBoletos(prev => prev.filter(b => b.id !== id));
            try {
                await deleteBoleto(id);
                await loadBoletos();
            } catch (e) {
                setBoletos(previousBoletos);
            }
          }
      );
  }

  const handleEdit = (boleto: Boleto) => {
    setEditingBoletoId(boleto.id);
  };

  const handlePay = (e: React.MouseEvent, boleto: Boleto) => {
    e.stopPropagation();
    e.preventDefault(); 
    const totalAmount = (Number(boleto.amountWithInvoice) || 0) + (Number(boleto.amountWithoutInvoice) || 0);
    openConfirmation(
        "Confirmar Pagamento",
        `Confirmar o pagamento para "${boleto.description}" no valor de ${displayValue(totalAmount)}?`,
        async () => {
            const previousBoletos = [...boletos];
            setBoletos(prev => prev.map(b => 
                b.id === boleto.id 
                ? { ...b, status: BoletoStatus.PAID, paymentDate: new Date().toISOString().split('T')[0] } 
                : b
            ));
            try {
                await payBoleto(boleto.id);
                await loadBoletos(); 
            } catch (e) {
                setBoletos(previousBoletos);
            }
        }
    );
  };

  const { filteredBoletos, totalFiltrado, totalComNota, totalSemNota } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const getLiveStatus = (boleto: Boleto): BoletoStatus => {
        if (boleto.status === BoletoStatus.PAID) return BoletoStatus.PAID;
        const dueDate = new Date(boleto.date + 'T00:00:00');
        return dueDate < today ? BoletoStatus.OVERDUE : BoletoStatus.OPEN;
    };
    const boletosWithLiveStatus = boletos.map(b => ({ ...b, liveStatus: getLiveStatus(b) }));
    const filtered = boletosWithLiveStatus.filter(b => {
        const descriptionMatch = b.description.toLowerCase().includes(filters.description.toLowerCase());
        const categoryMatch = !filters.category || b.category === filters.category;
        let dateMatch = true;
        if (filters.startDate && b.date < filters.startDate) dateMatch = false;
        if (filters.endDate && b.date > filters.endDate) dateMatch = false;
        return descriptionMatch && dateMatch && categoryMatch;
    });
    const totals = filtered.reduce((acc, b) => {
        acc.comNota += (Number(b.amountWithInvoice) || 0);
        acc.semNota += (Number(b.amountWithoutInvoice) || 0);
        return acc;
    }, { comNota: 0, semNota: 0 });
    return { filteredBoletos: filtered, totalFiltrado: totals.comNota + totals.semNota, totalComNota: totals.comNota, totalSemNota: totals.semNota };
  }, [boletos, filters]);

  const sortedBoletos = useMemo(() => {
    let sortableItems = [...filteredBoletos];
    if (sortConfig.key) {
        sortableItems.sort((a, b) => {
            const key = sortConfig.key as keyof (typeof sortableItems[0]);
            if (key === 'totalAmount') {
                const aTotal = (Number(a.amountWithInvoice) || 0) + (Number(a.amountWithoutInvoice) || 0);
                const bTotal = (Number(b.amountWithInvoice) || 0) + (Number(b.amountWithoutInvoice) || 0);
                return sortConfig.direction === 'ascending' ? aTotal - bTotal : bTotal - aTotal;
            }
            const aValue = (a as any)[key];
            const bValue = (b as any)[key];
            if (aValue == null) return 1; if (bValue == null) return -1;
            let comparison = 0;
            if (typeof aValue === 'number' && typeof bValue === 'number') comparison = aValue - bValue;
            else if (key === 'date') comparison = (new Date(aValue).getTime() || 0) - (new Date(bValue).getTime() || 0);
            else comparison = String(aValue).localeCompare(String(bValue));
            return sortConfig.direction === 'ascending' ? comparison : -comparison;
        });
    }
    return sortableItems;
  }, [filteredBoletos, sortConfig]);

  const dataForExport = useMemo(() => sortedBoletos.map(b => ({
    'Descrição': b.description,
    'Valor c/ Nota': (Number(b.amountWithInvoice) || 0),
    'Valor s/ Nota': (Number(b.amountWithoutInvoice) || 0),
    'Valor Total': (Number(b.amountWithInvoice) || 0) + (Number(b.amountWithoutInvoice) || 0),
    'Categoria': b.category,
    'Vencimento': b.date,
    'Status': b.liveStatus,
    'Data Pagamento': b.paymentDate || '',
  })), [sortedBoletos]);

  const getSortIndicator = (key: string) => sortConfig.key === key ? <span className="ml-1 select-none">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span> : null;

  const handlePrint = () => {
      setIsPrinting(true);
      setTimeout(() => {
          window.print();
      }, 1000);
  };

  useEffect(() => {
      const handleAfterPrint = () => setIsPrinting(false);
      window.addEventListener('afterprint', handleAfterPrint);
      return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 p-4 gap-4 printable-dashboard relative">
        {/* Confirmation Modal */}
        {confirmationModal && confirmationModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in no-print">
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

        <h1 className="hidden print:block text-2xl font-bold mb-4 text-black">Relatório de Contas a Pagar</h1>
        <div className="flex-shrink-0 bg-slate-800 p-3 md:p-4 rounded-lg shadow-lg no-print">
            <div className="flex justify-between items-center mb-2 md:mb-4">
                <h2 
                  className="text-lg md:text-xl font-bold cursor-pointer flex items-center gap-2"
                  onClick={() => setIsFormExpanded(!isFormExpanded)}
                >
                    {viewMode === 'single' ? (isEditing ? 'Editando Conta' : 'Nova Conta a Pagar') : 'Cadastro em Lote'}
                    <span className="md:hidden text-xs text-slate-500 font-normal">({isFormExpanded ? 'Toque para fechar' : 'Toque para abrir'})</span>
                </h2>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsFormExpanded(!isFormExpanded)} className="md:hidden bg-slate-700 hover:bg-slate-600 text-slate-300 p-2 rounded transition-colors">
                    {isFormExpanded ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    )}
                  </button>
                  <button type="button" onClick={() => { if (isEditing) setEditingBoletoId(null); setViewMode(prev => prev === 'single' ? 'batch' : 'single'); setIsFormExpanded(true); }} className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-1.5 px-3 md:py-2 md:px-4 rounded flex items-center transition-colors text-xs md:text-sm">
                      {viewMode === 'single' ? 'Lote' : 'Individual'}
                  </button>
                </div>
            </div>
            {isFormExpanded && (
              <div className="animate-in slide-in-from-top duration-300">
                {viewMode === 'single' ? (
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 md:gap-4 items-end">
                            <div className="sm:col-span-2 md:col-span-6 relative">
                                <label htmlFor="description" className="block text-xs md:text-sm font-medium mb-1 text-slate-400">Descrição</label>
                                <input ref={descriptionInputRef} type="text" id="description" name="description" value={formState.description} onChange={handleInputChange} onKeyDown={handleKeyDown} onFocus={() => setIsDescriptionFocused(true)} onBlur={() => setTimeout(() => setIsDescriptionFocused(false), 200)} autoComplete="off" placeholder="Ex: Compra de peças" required className="w-full p-2 text-sm md:text-base rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none uppercase" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                                {isDescriptionFocused && descriptionSuggestions.length > 0 && (
                                    <ul className="absolute z-10 w-full bg-slate-700 border border-slate-600 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                                        {descriptionSuggestions.map((suggestion, index) => (
                                            <li key={index} className={`px-3 py-2 cursor-pointer hover:bg-slate-600 ${index === highlightedIndex ? 'bg-slate-600' : ''}`} onClick={() => { setFormState(prev => ({ ...prev, description: suggestion })); setDescriptionSuggestions([]); }}>{suggestion}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="amountWithInvoice" className="block text-xs md:text-sm font-medium mb-1 text-slate-400">Valor c/ Nota</label>
                                <input type="number" id="amountWithInvoice" name="amountWithInvoice" value={formState.amountWithInvoice} onChange={handleInputChange} step="0.01" min="0" className="w-full p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="amountWithoutInvoice" className="block text-xs md:text-sm font-medium mb-1 text-slate-400">Valor s/ Nota</label>
                                <input type="number" id="amountWithoutInvoice" name="amountWithoutInvoice" value={formState.amountWithoutInvoice} onChange={handleInputChange} step="0.01" min="0" className="w-full p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                            </div>
                            <div>
                                <label htmlFor="category" className="block text-xs md:text-sm font-medium mb-1 text-slate-400">Categoria</label>
                                <select id="category" name="category" value={formState.category} onChange={handleInputChange} className="w-full p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties}>
                                    {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="date" className="block text-xs md:text-sm font-medium mb-1 text-slate-400">Data Vencimento</label>
                                <input type="date" id="date" name="date" value={formState.date} onChange={handleInputChange} required className="w-full p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                            </div>
                            <div className="md:col-start-6 mt-2 md:mt-0">
                            <button type="submit" className="w-full text-white font-semibold py-2 px-4 rounded-lg transition-opacity hover:opacity-90 text-sm" style={{backgroundColor: settings.accentColor}}>{isEditing ? 'Salvar' : 'Adicionar'}</button>
                            </div>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-4">
                        <p className="text-[10px] md:text-sm text-slate-400"><strong className="font-mono">Descrição | Vlr c/ Nota | Vlr s/ Nota | Categoria | Vencimento | Status</strong></p>
                        <textarea value={batchData} onChange={(e) => setBatchData(e.target.value)} placeholder={'ANDERSON CONSORCIO\t-\tR$ 1.246,40\tCONSÓRCIO\t10/03/2025\tPAGO'} className="w-full h-32 md:h-48 p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none font-mono text-xs md:text-sm" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                        <div className="flex justify-end gap-4">
                            <button type="button" onClick={handleProcessBatch} disabled={isProcessing} className="text-white font-semibold py-2 px-6 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-wait text-sm" style={{backgroundColor: settings.accentColor}}>{isProcessing ? 'Processando...' : 'Processar Lote'}</button>
                        </div>
                    </div>
                )}
              </div>
            )}
        </div>

        <div className="flex-shrink-0 bg-slate-800 p-3 rounded-lg shadow-lg no-print">
            <div className="flex justify-between items-center md:hidden mb-2">
                <button 
                  onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                  className="w-full flex items-center justify-between bg-slate-700 hover:bg-slate-600 p-2 rounded text-xs font-bold transition-colors"
                >
                    <span className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                        PESQUISA E FILTROS
                    </span>
                    {isFiltersExpanded ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    )}
                </button>
            </div>

            <div className={`${isFiltersExpanded ? 'flex' : 'hidden md:flex'} flex-col md:flex-row justify-between items-center gap-4`}>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <input type="text" name="description" value={filters.description} onChange={handleFilterChange} placeholder="Buscar..." className="flex-grow md:flex-grow-0 p-2 text-xs md:text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none uppercase w-32 md:w-auto" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                    <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="p-2 text-xs md:text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" />
                    <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="p-2 text-xs md:text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" />
                    <select name="category" value={filters.category} onChange={handleFilterChange} className="p-2 text-xs md:text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties}>
                        <option value="">Categorias</option>
                        {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="grid grid-cols-3 md:flex md:items-center gap-4 w-full md:w-auto border-t border-b border-slate-700 md:border-none py-2 md:py-0">
                      <div className="text-center md:text-right">
                        <span className="text-[10px] md:text-xs text-slate-400 uppercase">c/ Nota</span>
                        <p className="text-sm md:text-xl font-bold text-cyan-400">{displayValue(totalComNota)}</p>
                      </div>
                      <div className="text-center md:text-right">
                        <span className="text-[10px] md:text-xs text-slate-400 uppercase">s/ Nota</span>
                        <p className="text-sm md:text-xl font-bold text-amber-400">{displayValue(totalSemNota)}</p>
                      </div>
                      <div className="text-center md:text-right">
                        <span className="text-[10px] md:text-xs text-slate-400 uppercase">Total</span>
                        <p className="text-sm md:text-2xl font-bold" style={{color: settings.accentColor}}>{displayValue(totalFiltrado)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 w-full md:w-auto">
                        <button type="button" onClick={toggleVisibility} className="flex-1 md:flex-none bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded flex items-center justify-center transition-colors" title={isValuesVisible ? "Ocultar" : "Mostrar"}>
                            {isValuesVisible ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
                        </button>
                        <button type="button" onClick={handlePrint} className="flex-1 md:flex-none bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded flex items-center justify-center transition-colors" title="Imprimir / Salvar PDF"><PrinterIcon className="w-5 h-5" /></button>
                        <button type="button" onClick={() => exportToXLSX(dataForExport, 'contas_a_pagar.xlsx')} className="flex-[2] md:flex-none bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-2 md:px-4 rounded flex items-center justify-center transition-colors text-xs md:text-sm"><ExportIcon className="w-5 h-5 mr-1 md:mr-2" /><span className="md:inline">Exportar</span></button>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex-grow bg-slate-800 rounded-lg shadow-lg overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-900/70 sticky top-0">
                    <tr>
                        <th className="px-6 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('description')}>Descrição {getSortIndicator('description')}</th>
                        <th className="px-6 py-3 text-right cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('amountWithInvoice')}>Valor c/ Nota {getSortIndicator('amountWithInvoice')}</th>
                        <th className="px-6 py-3 text-right cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('amountWithoutInvoice')}>Valor s/ Nota {getSortIndicator('amountWithoutInvoice')}</th>
                        <th className="px-6 py-3 text-right cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('totalAmount')}>Vlr Total {getSortIndicator('totalAmount')}</th>
                        <th className="px-6 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('category')}>Categoria {getSortIndicator('category')}</th>
                        <th className="px-6 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('date')}>Vencimento {getSortIndicator('date')}</th>
                        <th className="px-6 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('liveStatus')}>Status {getSortIndicator('liveStatus')}</th>
                        <th className="px-6 py-3 text-center no-print">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedBoletos.map((b) => (
                        <tr key={b.id} onDoubleClick={() => handleEdit(b)} className="border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer">
                            <td className="px-6 py-4 font-medium uppercase text-slate-200">{b.description}</td>
                            <td className="px-6 py-4 text-right">{displayValue(Number(b.amountWithInvoice) || 0)}</td>
                            <td className="px-6 py-4 text-right">{displayValue(Number(b.amountWithoutInvoice) || 0)}</td>
                            <td className="px-6 py-4 text-right font-bold" style={{color: settings.accentColor}}>{displayValue((Number(b.amountWithInvoice) || 0) + (Number(b.amountWithoutInvoice) || 0))}</td>
                            <td className="px-6 py-4">{b.category}</td>
                            <td className="px-6 py-4">{formatDateForDisplay(b.date)}</td>
                            <td className="px-6 py-4">{getStatusBadge(b.liveStatus)}</td>
                            <td className="px-6 py-4 text-center no-print">
                                <div className="flex justify-center items-center gap-4">
                                    {b.liveStatus !== BoletoStatus.PAID && (
                                        <button type="button" onClick={(e) => handlePay(e, b)} className="font-medium text-green-400 hover:underline px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 transition-colors" style={{ zIndex: 10, position: 'relative' }}>Pagar</button>
                                    )}
                                    <button type="button" onClick={() => handleEdit(b)} className="font-medium text-blue-400 hover:underline">Editar</button>
                                    <button type="button" onClick={(e) => handleDeleteBoleto(e, b.id)} className="font-medium text-red-400 hover:underline">Excluir</button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
             {sortedBoletos.length === 0 && <p className="text-center p-10 text-slate-500">Nenhum item encontrado para os filtros selecionados.</p>}
        </div>
    </div>
  );
};

export default BoletoControl;