
import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { FaturamentoSemNotaContext } from '../contexts/FaturamentoSemNotaContext';
import { FaturamentoSemNota as FaturamentoSemNotaType, FaturamentoSemNotaCategoria } from '../types';
import { SettingsContext } from '../contexts/SettingsContext';
import { exportToXLSX } from '../utils/xlsxUtils';
import { WindowManagerContext } from '../contexts/WindowManagerContext';
import { ExportIcon, PrinterIcon } from '../components/icons/AppIcons';
import { CompanyContext } from '../contexts/CompanyContext';

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
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  const initialFormState = {
    data: new Date().toISOString().split('T')[0],
    nOrcamento: '',
    condicaoPagamento: '',
    categoria: FaturamentoSemNotaCategoria.FATURAMENTO,
    valor: '',
  };

  const [formState, setFormState] = useState(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    nOrcamento: '',
    startDate: '',
    endDate: '',
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [condicaoSuggestions, setCondicaoSuggestions] = useState<string[]>([]);
  const [isCondicaoFocused, setIsCondicaoFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' }>({ key: 'data', direction: 'descending' });
  const [viewMode, setViewMode] = useState<'single' | 'batch'>('single');
  const [batchData, setBatchData] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [faturamentos, setFaturamentos] = useState<FaturamentoSemNotaType[]>([]);
  
  // Modal state
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
  }, [editingId]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [condicaoSuggestions]);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
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
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      const finalValue = name === 'nOrcamento' ? value.toUpperCase() : value;
      setFilters(prev => ({ ...prev, [name]: finalValue }));
      setCurrentPage(1);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.valor) {
        winManager.addNotification({ title: "Erro", message: "O campo Valor é obrigatório.", type: "error"});
        return;
    }
    
    // Helper to determine sign for optimistic update
    const getSignedValue = (val: number, cat: FaturamentoSemNotaCategoria) => {
       return (cat === FaturamentoSemNotaCategoria.FATURAMENTO || cat === FaturamentoSemNotaCategoria.CENTRAL_TRUCK) ? Math.abs(val) : -Math.abs(val);
    };

    const processedVal = getSignedValue(parseFloat(formState.valor), formState.categoria as FaturamentoSemNotaCategoria);
    const fData = { ...formState, valor: processedVal };

    if (isEditing) {
      // Optimistic
      setFaturamentos(prev => prev.map(f => 
          f.id === editingId 
          ? { ...f, ...fData, id: editingId!, categoria: fData.categoria as FaturamentoSemNotaCategoria } 
          : f
      ));
      await updateFaturamento(editingId!, formState);
    } else {
      await addFaturamento(formState);
      const data = await queryFaturamentos({ companyId: companyContext.currentCompany.id });
      setFaturamentos(data);
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
          let dateMatch = true;
          if (filters.startDate && f.data < filters.startDate) dateMatch = false;
          if (filters.endDate && f.data > filters.endDate) dateMatch = false;
          return orcamentoMatch && dateMatch;
      });
  }, [faturamentos, filters]);

  const sortedFaturamentos = useMemo(() => {
    let sortableItems = [...filteredFaturamentos];
    if (sortConfig.key) {
        sortableItems.sort((a, b) => {
            const key = sortConfig.key;
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

  const totalFiltrado = useMemo(() => {
    return sortedFaturamentos.reduce((acc, f) => acc + (Number(f.valor) || 0), 0);
  }, [sortedFaturamentos]);

  const totalPages = Math.ceil(sortedFaturamentos.length / itemsPerPage);
  const currentItems = useMemo(() => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return sortedFaturamentos.slice(indexOfFirstItem, indexOfLastItem);
  }, [sortedFaturamentos, currentPage]);

  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const startItemIndex = (currentPage - 1) * itemsPerPage + 1;
  const endItemIndex = Math.min(currentPage * itemsPerPage, sortedFaturamentos.length);
  const getSortIndicator = (key: string) => sortConfig.key === key ? <span className="ml-1 select-none">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span> : null;

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

      <h1 className="hidden print:block text-2xl font-bold mb-4 text-black">Relatório de Faturamento s/ Nota</h1>
      <div className="flex-shrink-0 bg-slate-800 p-4 rounded-lg shadow-lg no-print">
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{viewMode === 'single' ? (isEditing ? 'Editando Lançamento' : 'Novo Lançamento') : 'Cadastro em Lote'}</h2>
              <button onClick={() => { if (isEditing) handleCancelEdit(); setViewMode(prev => prev === 'single' ? 'batch' : 'single'); }} className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded flex items-center transition-colors text-sm">
                  {viewMode === 'single' ? 'Cadastrar em Lote' : 'Cadastro Individual'}
              </button>
          </div>
          {viewMode === 'single' ? (
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-2"><label htmlFor="data" className="block text-sm font-medium mb-1 text-slate-400">Data</label><input ref={dateInputRef} type="date" id="data" name="data" value={formState.data} onChange={handleInputChange} required className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} /></div>
                  <div className="md:col-span-2"><label htmlFor="nOrcamento" className="block text-sm font-medium mb-1 text-slate-400">Nº Orçamento</label><input type="text" id="nOrcamento" name="nOrcamento" placeholder="Ex: OS1234" value={formState.nOrcamento} onChange={handleInputChange} className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none uppercase" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} /></div>
                  <div className="md:col-span-2"><label htmlFor="valor" className="block text-sm font-medium mb-1 text-slate-400">Valor</label><input type="number" id="valor" name="valor" value={formState.valor} onChange={handleInputChange} required step="0.01" min="0" placeholder="0" className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} /></div>
                  <div className="md:col-span-2 relative">
                    <label htmlFor="condicaoPagamento" className="block text-sm font-medium mb-1 text-slate-400">Condição Pagamento</label>
                    <input type="text" id="condicaoPagamento" name="condicaoPagamento" placeholder="Ex: PIX" value={formState.condicaoPagamento} onChange={handleInputChange} onKeyDown={handleKeyDown} onFocus={() => setIsCondicaoFocused(true)} onBlur={() => setTimeout(() => setIsCondicaoFocused(false), 200)} autoComplete="off" className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none uppercase" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                      {isCondicaoFocused && condicaoSuggestions.length > 0 && (
                          <ul className="absolute z-10 w-full bg-slate-700 border border-slate-600 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                              {condicaoSuggestions.map((suggestion, index) => (
                                  <li key={index} className={`px-3 py-2 cursor-pointer hover:bg-slate-600 ${index === highlightedIndex ? 'bg-slate-600' : ''}`} onClick={() => { setFormState(prev => ({ ...prev, condicaoPagamento: suggestion })); setCondicaoSuggestions([]); }}>{suggestion}</li>
                              ))}
                          </ul>
                      )}
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="categoria" className="block text-sm font-medium mb-1 text-slate-400">Categoria</label>
                    <select id="categoria" name="categoria" value={formState.categoria} onChange={handleInputChange} className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties}>
                      {Object.values(FaturamentoSemNotaCategoria).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <div className="flex flex-col">
                      <button type="submit" className="w-full text-white font-semibold py-2 px-4 rounded-lg transition-colors" style={{backgroundColor: settings.accentColor}}>{isEditing ? 'Salvar' : 'Adicionar'}</button>
                      {isEditing && <button type="button" onClick={handleCancelEdit} className="w-full bg-slate-600 font-semibold py-2 px-4 rounded-lg transition-opacity hover:opacity-90 mt-2">Cancelar</button>}
                    </div>
                  </div>
                </div>
              </form>
          ) : (
            <div className="space-y-4">
                <p className="text-sm text-slate-400"><strong className="font-mono">Data | Nº Orçamento | Valor Total | Condição | Categoria</strong></p>
                <textarea value={batchData} onChange={(e) => setBatchData(e.target.value)} placeholder={'24/07/2025\t13897\tR$ 2.500,00\tCRÉDITO 6X\tFATURAMENTO'} className="w-full h-48 p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none font-mono text-sm" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                <div className="flex justify-end gap-4">
                    <button onClick={handleProcessBatch} disabled={isProcessing} className="text-white font-semibold py-2 px-6 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-wait" style={{backgroundColor: settings.accentColor}}>{isProcessing ? 'Processando...' : 'Processar Lote'}</button>
                </div>
            </div>
          )}
      </div>

      <div className="flex-shrink-0 bg-slate-800 p-3 rounded-lg shadow-lg flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-2 no-print">
          <input type="text" name="nOrcamento" value={filters.nOrcamento} onChange={handleFilterChange} placeholder="Buscar por nº orçamento..." className="p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none w-64 uppercase" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
          <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" />
          <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" />
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right"><span className="text-xs text-slate-400 uppercase">Total Filtrado</span><p className="text-2xl font-bold text-slate-200">{formatCurrency(totalFiltrado)}</p></div>
          <div className="flex items-center gap-2 no-print">
            <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded flex items-center transition-colors" title="Imprimir"><PrinterIcon className="w-5 h-5" /></button>
            <button onClick={() => exportToXLSX(dataForExport, 'faturamento_sem_nota.xlsx')} className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded flex items-center transition-colors"><ExportIcon className="w-5 h-5 mr-2" />Exportar XLSX</button>
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
              {currentItems.map((f: FaturamentoSemNotaType) => (
                <tr key={f.id} onDoubleClick={() => handleEdit(f)} className="border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer">
                  <td className="px-4 py-2">{formatDateForDisplay(f.data)}</td>
                  <td className="px-4 py-2">{f.nOrcamento || '-'}</td>
                  <td className={`px-4 py-2 text-right font-medium ${f.valor >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(f.valor)}</td>
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
        {currentItems.length === 0 && <p className="text-center p-10 text-slate-500">Nenhum faturamento encontrado.</p>}
      </div>

      <div className="flex-shrink-0 p-2 border-t border-slate-700 flex justify-between items-center text-sm text-slate-400 no-print">
          <div>{sortedFaturamentos.length > 0 ? `Mostrando ${startItemIndex} a ${endItemIndex} de ${sortedFaturamentos.length} registros` : 'Nenhum registro encontrado'}</div>
          <div className="flex items-center gap-2">
              <button onClick={handlePrevPage} disabled={currentPage === 1} className="px-3 py-1 bg-slate-700 rounded disabled:opacity-50">&lt;</button>
              <span>{currentPage} de {totalPages > 0 ? totalPages : 1}</span>
              <button onClick={handleNextPage} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 bg-slate-700 rounded disabled:opacity-50">&gt;</button>
          </div>
      </div>
    </div>
  );
};

export default FaturamentoSemNota;
