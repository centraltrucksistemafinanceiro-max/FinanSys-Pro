
import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { FaturamentoSemNotaContext } from '../contexts/FaturamentoSemNotaContext';
import { FaturamentoSemNota as FaturamentoSemNotaType, FaturamentoSemNotaCategoria } from '../types';
import { SettingsContext } from '../contexts/SettingsContext';
import { exportToXLSX } from '../utils/xlsxUtils';
import { WindowManagerContext } from '../contexts/WindowManagerContext';
import { ExportIcon, PrinterIcon } from '../components/icons/AppIcons';
import { CompanyContext } from '../contexts/CompanyContext';
import { PrivacyContext } from '../contexts/PrivacyContext';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDateForDisplay = (dateString: string) => {
  if (!dateString || !dateString.includes('-')) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

const FaturamentoSemNota: React.FC = () => {
  const faturamentoContext = useContext(FaturamentoSemNotaContext);
  const settings = useContext(SettingsContext);
  const winManager = useContext(WindowManagerContext);
  const companyContext = useContext(CompanyContext);
  const { isValuesVisible, toggleVisibility } = useContext(PrivacyContext)!;
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  const displayValue = (val: number) => isValuesVisible ? formatCurrency(val) : '••••';

  // Calcula datas do mês atual para o filtro padrão
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const initialFormState = {
    data: new Date().toISOString().split('T')[0],
    nOrcamento: '',
    condicaoPagamento: '',
    categoria: FaturamentoSemNotaCategoria.FATURAMENTO,
    valor: '',
  };

  const [formState, setFormState] = useState(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Revertido para filtrar por mês por padrão (diferente do Fluxo de Caixa)
  const [filters, setFilters] = useState({
    nOrcamento: '',
    startDate: firstDay,
    endDate: lastDay,
    category: '',
  });
  
  const [condicaoSuggestions, setCondicaoSuggestions] = useState<string[]>([]);
  const [isCondicaoFocused, setIsCondicaoFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' }>({ key: 'data', direction: 'descending' });
  const [viewMode, setViewMode] = useState<'single' | 'batch'>('single');
  const [batchData, setBatchData] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isFormExpanded, setIsFormExpanded] = useState(window.innerWidth > 768);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(window.innerWidth > 768);

  const [faturamentos, setFaturamentos] = useState<FaturamentoSemNotaType[]>([]);
  
  const [confirmationModal, setConfirmationModal] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
  } | null>(null);

  if (!faturamentoContext || !settings || !winManager || !companyContext) return null;

  const { queryFaturamentos, addFaturamento, addMultipleFaturamentos, deleteFaturamento, updateFaturamento } = faturamentoContext;
  
  useEffect(() => {
      const loadData = async () => {
          if (companyContext.currentCompany.id) {
              const data = await queryFaturamentos({ companyId: companyContext.currentCompany.id });
              setFaturamentos(data);
          }
      };
      loadData();
  }, [companyContext.currentCompany.id]);

  const isEditing = editingId !== null;

  const uniqueCondicoes = useMemo(() => {
    const condicoes = faturamentos
      .map(f => f.condicaoPagamento)
      .filter(c => c && c.trim() !== '');
    return [...new Set(condicoes)];
  }, [faturamentos]);

  useEffect(() => {
    if (editingId) {
      const faturamentoToEdit = faturamentos.find(f => f.id === editingId);
      if (faturamentoToEdit) {
        setViewMode('single');
        setFormState({
          data: faturamentoToEdit.data,
          nOrcamento: faturamentoToEdit.nOrcamento,
          condicaoPagamento: faturamentoToEdit.condicaoPagamento,
          categoria: faturamentoToEdit.categoria,
          valor: String(Math.abs(faturamentoToEdit.valor)),
        });
      }
    } else {
      setFormState(initialFormState);
    }
  }, [editingId, faturamentos]);

  useEffect(() => {
    if (isEditing) {
      setIsFormExpanded(true);
    }
  }, [isEditing]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [condicaoSuggestions]);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let finalValue = value;
    if (['nOrcamento', 'condicaoPagamento'].includes(name)) {
        finalValue = value.toUpperCase();
    }
    setFormState(prev => ({ ...prev, [name]: finalValue }));

    if (name === 'condicaoPagamento' && finalValue) {
        const filtered = uniqueCondicoes
            .filter(c => c.toLowerCase().includes(finalValue.toLowerCase()) && c.toLowerCase() !== finalValue.toLowerCase())
            .slice(0, 5);
        setCondicaoSuggestions(filtered);
    } else if (name === 'condicaoPagamento') {
        setCondicaoSuggestions([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (condicaoSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % condicaoSuggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + condicaoSuggestions.length) % condicaoSuggestions.length);
        break;
      case 'Enter':
        if (highlightedIndex > -1) {
          e.preventDefault();
          setFormState(prev => ({ ...prev, condicaoPagamento: condicaoSuggestions[highlightedIndex] }));
          setCondicaoSuggestions([]);
        }
        break;
      case 'Escape':
        setCondicaoSuggestions([]);
        break;
      default:
        break;
    }
  };
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      const finalValue = name === 'nOrcamento' ? value.toUpperCase() : value;
      setFilters(prev => ({ ...prev, [name]: finalValue }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.valor) {
        winManager.addNotification({ title: "Erro", message: "O campo Valor é obrigatório.", type: "error"});
        return;
    }

    const trimmedNOrcamento = formState.nOrcamento.trim();
    if (trimmedNOrcamento) {
      const isDuplicate = faturamentos.some(
        f => f.nOrcamento.trim().toUpperCase() === trimmedNOrcamento.toUpperCase() && f.id !== editingId
      );

      if (isDuplicate) {
        winManager.addNotification({ 
            title: "Duplicado", 
            message: `O Nº de Orçamento "${trimmedNOrcamento}" already exists.`, 
            type: "error"
        });
        return;
      }
    }
    
    const getSignedValue = (val: number, cat: FaturamentoSemNotaCategoria) => {
       return (cat === FaturamentoSemNotaCategoria.FATURAMENTO || cat === FaturamentoSemNotaCategoria.CENTRAL_TRUCK) ? Math.abs(val) : -Math.abs(val);
    };

    const processedVal = getSignedValue(parseFloat(formState.valor), formState.categoria as FaturamentoSemNotaCategoria);
    const fData = { ...formState, valor: processedVal };

    if (isEditing) {
      setFaturamentos(prev => prev.map(f => 
          f.id === editingId 
          ? { ...f, ...fData, id: editingId!, categoria: fData.categoria as FaturamentoSemNotaCategoria } 
          : f
      ));
      await updateFaturamento(editingId!, formState);
    } else {
      const newFaturamento = await addFaturamento(formState);
      if (newFaturamento) {
        setFaturamentos(prev => [newFaturamento, ...prev]);
      }
    }
    
    setEditingId(null);
    setFormState(initialFormState);
    dateInputRef.current?.focus();
  };
  
  const handleProcessBatch = async () => {
    setIsProcessing(true);
    const lines = batchData.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) { winManager.addNotification({ title: 'Aviso', message: 'Nenhum dado.', type: 'warning' }); setIsProcessing(false); return; }

    type NewFaturamentoPayload = Omit<FaturamentoSemNotaType, 'id' | 'valor' | 'companyId'> & { valor: number | string };
    const newFaturamentos: NewFaturamentoPayload[] = [];
    
    const parseCurrency = (value: string): number => {
        if (!value || value.trim() === '-') return 0;
        const cleaned = value.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
        const number = parseFloat(cleaned);
        return isNaN(number) ? 0 : number;
    };
    const parseDate = (dateStr: string): string | null => {
        if (!dateStr) return null;
        const trimmedDate = dateStr.trim();
        const ddMMyyyy = trimmedDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (ddMMyyyy) return `${ddMMyyyy[3]}-${ddMMyyyy[2]}-${ddMMyyyy[1]}`;
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) return trimmedDate;
        return null;
    };

    lines.forEach(line => {
        if (line.toLowerCase().includes('data_faturamen')) return;
        const columns = line.split('\t');
        if (columns.length < 5) return;
        const [dataStr, nOrcamento, valorStr, condicaoPagamento, categoriaStr] = columns;
        const formattedDate = parseDate(dataStr);
        const valor = parseCurrency(valorStr);
        const categoria = categoriaStr?.trim().toUpperCase() as FaturamentoSemNotaCategoria;
        if (!categoria || !Object.values(FaturamentoSemNotaCategoria).includes(categoria) || !formattedDate || isNaN(valor)) return;

        newFaturamentos.push({
            data: formattedDate,
            nOrcamento: nOrcamento.trim().toUpperCase(),
            valor: valor,
            condicaoPagamento: condicaoPagamento.trim().toUpperCase(),
            categoria: categoria,
        });
    });

    if (newFaturamentos.length > 0) {
        await addMultipleFaturamentos(newFaturamentos);
        const data = await queryFaturamentos({ companyId: companyContext.currentCompany.id });
        setFaturamentos(data);
        winManager.addNotification({ title: 'Sucesso', message: 'Lote processado.', type: 'success' });
    }

    setBatchData('');
    setViewMode('single');
    setIsProcessing(false);
  };
    
  const handleEdit = (f: FaturamentoSemNotaType) => {
    setEditingId(f.id);
  };
  
  const handleCancelEdit = () => {
    setEditingId(null);
    setFormState(initialFormState);
  };

  const openConfirmation = (title: string, message: string, onConfirm: () => void) => {
      setConfirmationModal({ isOpen: true, title, message, onConfirm });
  };

  const handleDeleteFaturamento = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      
      openConfirmation(
          "Excluir Lançamento",
          "Tem certeza que deseja excluir este registro?",
          async () => {
              setFaturamentos(prev => prev.filter(f => f.id !== id));
              await deleteFaturamento(id);
          }
      );
  }
  
  const filteredFaturamentos = useMemo(() => {
      return faturamentos.filter(f => {
          const orcamentoMatch = !filters.nOrcamento || f.nOrcamento.toUpperCase().includes(filters.nOrcamento.toUpperCase());
          const categoryMatch = !filters.category || f.categoria === filters.category;
          let dateMatch = true;
          if (filters.startDate && f.data < filters.startDate) dateMatch = false;
          if (filters.endDate && f.data > filters.endDate) dateMatch = false;
          return orcamentoMatch && categoryMatch && dateMatch;
      });
  }, [faturamentos, filters]);

  const sortedFaturamentos = useMemo(() => {
    let sortableItems = [...filteredFaturamentos];
    if (sortConfig.key) {
        sortableItems.sort((a, b) => {
            const key = sortConfig.key as keyof FaturamentoSemNotaType;
            const aValue = (a as any)[key];
            const bValue = (b as any)[key];
            if (aValue == null) return 1; if (bValue == null) return -1;
            let comparison = 0;
            if (key === 'valor') comparison = aValue - bValue;
            else if (key === 'data') comparison = (new Date(aValue).getTime() || 0) - (new Date(bValue).getTime() || 0);
            else comparison = String(aValue).localeCompare(String(bValue));
            return sortConfig.direction === 'ascending' ? comparison : -comparison;
        });
    }
    return sortableItems;
  }, [filteredFaturamentos, sortConfig]);

  const dataForExport = useMemo(() => sortedFaturamentos.map(f => ({
      'Data': formatDateForDisplay(f.data), 'Nº Orçamento': f.nOrcamento, 'Valor': f.valor, 'Condição Pagamento': f.condicaoPagamento, 'Categoria': f.categoria,
  })), [sortedFaturamentos]);

  const { totalFiltrado, totalPositivo, totalNegativo } = useMemo(() => {
    const totals = sortedFaturamentos.reduce((acc, f) => {
        const valor = Number(f.valor) || 0;
        if (valor > 0) {
            acc.positivo += valor;
        } else if (valor < 0) {
            acc.negativo += valor;
        }
        return acc;
    }, { positivo: 0, negativo: 0 });

    return {
        totalFiltrado: totals.positivo + totals.negativo,
        totalPositivo: totals.positivo,
        totalNegativo: totals.negativo,
    };
  }, [sortedFaturamentos]);

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

      <h1 className="hidden print:block text-2xl font-bold mb-4 text-black">Relatório de Faturamento s/ Nota</h1>
      <div className="flex-shrink-0 bg-slate-800 p-3 md:p-4 rounded-lg shadow-lg no-print">
          <div className="flex justify-between items-center mb-2 md:mb-4">
              <h2 
                className="text-lg md:text-xl font-bold cursor-pointer flex items-center gap-2"
                onClick={() => setIsFormExpanded(!isFormExpanded)}
              >
                  {viewMode === 'single' ? (isEditing ? 'Editando Lançamento' : 'Novo Lançamento') : 'Cadastro em Lote'}
                  <span className="md:hidden text-xs text-slate-500 font-normal">({isFormExpanded ? 'fechar' : 'abrir'})</span>
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
                <button onClick={() => { if (isEditing) handleCancelEdit(); setViewMode(prev => prev === 'single' ? 'batch' : 'single'); setIsFormExpanded(true); }} className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-1.5 px-3 md:py-2 md:px-4 rounded flex items-center transition-colors text-xs md:text-sm">
                    {viewMode === 'single' ? 'Lote' : 'Individual'}
                </button>
              </div>
          </div>
          {isFormExpanded && (
            <div className="animate-in slide-in-from-top duration-300">
              {viewMode === 'single' ? (
                  <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 md:gap-4 items-end">
                      <div className="md:col-span-2">
                        <label htmlFor="data" className="block text-xs md:text-sm font-medium mb-1 text-slate-400">Data</label>
                        <input ref={dateInputRef} type="date" id="data" name="data" value={formState.data} onChange={handleInputChange} required className="w-full p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="nOrcamento" className="block text-xs md:text-sm font-medium mb-1 text-slate-400">Orçamento</label>
                        <input type="text" id="nOrcamento" name="nOrcamento" placeholder="Ex: OS1234" value={formState.nOrcamento} onChange={handleInputChange} className="w-full p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none uppercase" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="valor" className="block text-xs md:text-sm font-medium mb-1 text-slate-400">Valor</label>
                        <input type="number" id="valor" name="valor" value={formState.valor} onChange={handleInputChange} required step="0.01" min="0" placeholder="0" className="w-full p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                      </div>
                      <div className="md:col-span-2 relative">
                        <label htmlFor="condicaoPagamento" className="block text-xs md:text-sm font-medium mb-1 text-slate-400">Condição</label>
                        <input type="text" id="condicaoPagamento" name="condicaoPagamento" placeholder="Ex: PIX" value={formState.condicaoPagamento} onChange={handleInputChange} onKeyDown={handleKeyDown} onFocus={() => setIsCondicaoFocused(true)} onBlur={() => setTimeout(() => setIsCondicaoFocused(false), 200)} autoComplete="off" className="w-full p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none uppercase" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                          {isCondicaoFocused && condicaoSuggestions.length > 0 && (
                              <ul className="absolute z-10 w-full bg-slate-700 border border-slate-600 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                                  {condicaoSuggestions.map((suggestion, index) => (
                                      <li key={index} className={`px-3 py-2 cursor-pointer hover:bg-slate-600 ${index === highlightedIndex ? 'bg-slate-600' : ''}`} onClick={() => { setFormState(prev => ({ ...prev, condicaoPagamento: suggestion })); setCondicaoSuggestions([]); }}>{suggestion}</li>
                                  ))}
                              </ul>
                          )}
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="categoria" className="block text-xs md:text-sm font-medium mb-1 text-slate-400">Categoria</label>
                        <select id="categoria" name="categoria" value={formState.categoria} onChange={handleInputChange} className="w-full p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties}>
                          {Object.values(FaturamentoSemNotaCategoria).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-2 flex flex-col gap-2 mt-2 md:mt-0">
                        <button type="submit" className="w-full text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm" style={{backgroundColor: settings.accentColor}}>{isEditing ? 'Salvar' : 'Adicionar'}</button>
                        {isEditing && <button type="button" onClick={handleCancelEdit} className="w-full bg-slate-600 font-semibold py-2 px-4 rounded-lg transition-opacity hover:opacity-90 text-sm">Cancelar</button>}
                      </div>
                    </div>
                  </form>
              ) : (
                <div className="space-y-4">
                    <p className="text-[10px] md:text-sm text-slate-400"><strong className="font-mono">Data | Nº Orçamento | Valor | Condição | Categoria</strong></p>
                    <textarea value={batchData} onChange={(e) => setBatchData(e.target.value)} placeholder={'24/07/2025\t13897\tR$ 2.500,00\tCRÉDITO 6X\tFATURAMENTO'} className="w-full h-32 md:h-48 p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none font-mono text-xs md:text-sm" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                    <div className="flex justify-end gap-4">
                        <button onClick={handleProcessBatch} disabled={isProcessing} className="text-white font-semibold py-2 px-6 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-wait text-sm" style={{backgroundColor: settings.accentColor}}>{isProcessing ? 'Processando...' : 'Processar'}</button>
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
              <input type="text" name="nOrcamento" value={filters.nOrcamento} onChange={handleFilterChange} placeholder="Buscar..." className="flex-grow md:flex-grow-0 p-2 text-xs md:text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none w-32 md:w-48 uppercase" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
              <select
                name="category"
                value={filters.category}
                onChange={handleFilterChange}
                className="p-2 text-xs md:text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none"
                style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties}
              >
                  <option value="">Categorias</option>
                  {Object.values(FaturamentoSemNotaCategoria).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="p-2 text-xs md:text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" />
              <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="p-2 text-xs md:text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" />
            </div>
            <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
              <div className="grid grid-cols-3 lg:flex lg:items-center gap-3 w-full md:w-auto border-t border-b border-slate-700 md:border-none py-2 md:py-0">
                <div className="text-center md:text-right">
                  <span className="text-[10px] md:text-xs text-slate-400 uppercase">Positivo</span>
                  <p className="text-sm md:text-base font-bold text-green-400">{displayValue(totalPositivo)}</p>
                </div>
                <div className="text-center md:text-right">
                  <span className="text-[10px] md:text-xs text-slate-400 uppercase">Negativo</span>
                  <p className="text-sm md:text-base font-bold text-red-400">{displayValue(totalNegativo)}</p>
                </div>
                <div className="text-center md:text-right">
                  <span className="text-[10px] md:text-xs text-slate-400 uppercase">Saldo</span>
                  <p className={`text-sm md:text-xl font-bold ${totalFiltrado >= 0 ? 'text-slate-200' : 'text-red-400'}`}>{displayValue(totalFiltrado)}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 w-full md:w-auto">
                <button onClick={toggleVisibility} className="flex-1 md:flex-none bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-3 rounded flex items-center justify-center transition-colors" title={isValuesVisible ? "Ocultar" : "Mostrar"}>
                    {isValuesVisible ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
                </button>
                <button onClick={handlePrint} className="flex-1 md:flex-none bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-3 rounded flex items-center justify-center transition-colors" title="Imprimir / Salvar PDF"><PrinterIcon className="w-5 h-5" /></button>
                <button onClick={() => exportToXLSX(dataForExport, 'faturamento_sem_nota.xlsx')} className="flex-[2] md:flex-none bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-3 rounded flex items-center justify-center transition-colors text-xs md:text-sm"><ExportIcon className="w-5 h-5 mr-1 md:mr-2" /><span className="md:inline">Exportar</span></button>
              </div>
            </div>
          </div>
      </div>

      <div className="flex-grow bg-slate-800 rounded-lg shadow-lg overflow-y-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/70 sticky top-0">
              <tr>
                <th className="px-4 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('data')}>Data {getSortIndicator('data')}</th>
                <th className="px-4 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('nOrcamento')}>Nº Orçamento {getSortIndicator('nOrcamento')}</th>
                <th className="px-4 py-3 text-right cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('valor')}>Valor {getSortIndicator('valor')}</th>
                <th className="px-4 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('condicaoPagamento')}>Cond. Pagamento {getSortIndicator('condicaoPagamento')}</th>
                <th className="px-4 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('categoria')}>Categoria {getSortIndicator('categoria')}</th>
                <th className="px-4 py-3 text-center no-print">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedFaturamentos.map((f: FaturamentoSemNotaType) => (
                <tr key={f.id} onDoubleClick={() => handleEdit(f)} className="border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer">
                  <td className="px-4 py-2">{formatDateForDisplay(f.data)}</td>
                  <td className="px-4 py-2">{f.nOrcamento || '-'}</td>
                  <td className={`px-4 py-2 text-right font-medium ${f.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>{displayValue(f.valor)}</td>
                  <td className="px-4 py-2">{f.condicaoPagamento}</td>
                  <td className="px-4 py-2">{f.categoria}</td>
                  <td className="px-4 py-2 no-print">
                    <div className="flex justify-center items-center gap-4">
                      <button onClick={() => handleEdit(f)} className="font-medium text-blue-400 hover:underline">Editar</button>
                      <button onClick={(e) => handleDeleteFaturamento(e, f.id)} className="font-medium text-red-400 hover:underline">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sortedFaturamentos.length === 0 && <p className="text-center p-10 text-slate-500">Nenhum faturamento encontrado.</p>}
      </div>
    </div>
  );
};

export default FaturamentoSemNota;