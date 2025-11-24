
import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { FaturamentoContext } from '../contexts/FaturamentoContext';
import { Faturamento as FaturamentoType } from '../types';
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

const Faturamento: React.FC = () => {
  const faturamentoContext = useContext(FaturamentoContext);
  const settings = useContext(SettingsContext);
  const winManager = useContext(WindowManagerContext);
  const companyContext = useContext(CompanyContext);
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  const initialFormState = {
    data: new Date().toISOString().split('T')[0],
    cliente: '',
    nNotaServico: '',
    nNotaPecas: '',
    quantidade: '1',
    condicoesPagamento: '',
    valor: '',
  };

  const [formState, setFormState] = useState(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    cliente: '',
    startDate: '',
    endDate: '',
  });

  const [clienteSuggestions, setClienteSuggestions] = useState<string[]>([]);
  const [isClienteFocused, setIsClienteFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' }>({ key: 'data', direction: 'descending' });
  const [viewMode, setViewMode] = useState<'single' | 'batch'>('single');
  const [batchData, setBatchData] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const [faturamentos, setFaturamentos] = useState<FaturamentoType[]>([]);
  
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

  const uniqueClientes = useMemo(() => {
    const clientes = faturamentos.map(f => f.cliente);
    return [...new Set(clientes)];
  }, [faturamentos]);

  useEffect(() => {
    if (editingId) {
      const faturamentoToEdit = faturamentos.find(f => f.id === editingId);
      if (faturamentoToEdit) {
        setViewMode('single');
        setFormState({
          data: faturamentoToEdit.data,
          cliente: faturamentoToEdit.cliente,
          nNotaServico: faturamentoToEdit.nNotaServico,
          nNotaPecas: faturamentoToEdit.nNotaPecas,
          quantidade: String(faturamentoToEdit.quantidade),
          condicoesPagamento: faturamentoToEdit.condicoesPagamento,
          valor: String(faturamentoToEdit.valor),
        });
      }
    } else {
      setFormState(initialFormState);
    }
  }, [editingId]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [clienteSuggestions]);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let finalValue = value;
    const fieldsToUppercase = ['cliente', 'nNotaServico', 'nNotaPecas', 'condicoesPagamento'];
    if (fieldsToUppercase.includes(name)) {
      finalValue = value.toUpperCase();
    }
    setFormState(prev => ({ ...prev, [name]: finalValue }));
    
    if (name === 'cliente' && finalValue) {
        const filtered = uniqueClientes
            .filter(c => c.toLowerCase().includes(finalValue.toLowerCase()) && c.toLowerCase() !== finalValue.toLowerCase())
            .slice(0, 5);
        setClienteSuggestions(filtered);
    } else if (name === 'cliente') {
        setClienteSuggestions([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (clienteSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % clienteSuggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + clienteSuggestions.length) % clienteSuggestions.length);
        break;
      case 'Enter':
        if (highlightedIndex > -1) {
          e.preventDefault();
          setFormState(prev => ({ ...prev, cliente: clienteSuggestions[highlightedIndex] }));
          setClienteSuggestions([]);
        }
        break;
      case 'Escape':
        setClienteSuggestions([]);
        break;
      default:
        break;
    }
  };
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      const finalValue = name === 'cliente' ? value.toUpperCase() : value;
      setFilters(prev => ({ ...prev, [name]: finalValue }));
      setCurrentPage(1);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.cliente || !formState.valor) {
        winManager.addNotification({ title: "Erro", message: "Cliente e Valor são obrigatórios.", type: 'error'});
        return;
    }

    const faturamentoData = {
      ...formState,
      valor: parseFloat(formState.valor) || 0,
      quantidade: parseInt(formState.quantidade, 10) || 1,
    };
    
    if (isEditing) {
      // Optimistic Update
      setFaturamentos(prev => prev.map(f => 
          f.id === editingId 
          ? { ...f, ...faturamentoData, id: editingId! } 
          : f
      ));
      await updateFaturamento(editingId!, faturamentoData);
    } else {
      await addFaturamento(faturamentoData);
      // Refresh to get ID
      const data = await queryFaturamentos({ companyId: companyContext.currentCompany.id });
      setFaturamentos(data);
    }
    
    setEditingId(null);
    setFormState(initialFormState);
    dateInputRef.current?.focus();
  };
  
  const handleProcessBatch = async () => {
    setIsProcessing(true);
    // Batch processing logic... (Simplified for brevity, assume same logic as before)
    const lines = batchData.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) { winManager.addNotification({ title: 'Aviso', message: 'Nenhum dado.', type: 'warning' }); setIsProcessing(false); return; }

    type NewFaturamentoPayload = Omit<FaturamentoType, 'id' | 'companyId'>;
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
        if (line.toLowerCase().includes('cliente')) return;
        const columns = line.split('\t');
        if (columns.length < 7) return;
        const [dataStr, cliente, nNotaServico, nNotaPecas, valorStr, parcelasStr, condicoesPagamento] = columns;
        const formattedDate = parseDate(dataStr);
        const valor = parseCurrency(valorStr);
        const quantidade = parseInt(parcelasStr, 10);
        if (!cliente?.trim() || !formattedDate || isNaN(valor)) return;

        newFaturamentos.push({
            data: formattedDate,
            cliente: cliente.trim().toUpperCase(),
            nNotaServico: nNotaServico.trim().toUpperCase(),
            nNotaPecas: nNotaPecas.trim().toUpperCase(),
            valor,
            quantidade,
            condicoesPagamento: condicoesPagamento.trim().toUpperCase(),
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
    
  const handleEdit = (f: FaturamentoType) => {
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
          "Excluir Faturamento",
          "Tem certeza que deseja excluir este lançamento?",
          async () => {
              setFaturamentos(prev => prev.filter(f => f.id !== id));
              await deleteFaturamento(id);
          }
      );
  }
  
  const filteredFaturamentos = useMemo(() => {
      return faturamentos.filter(f => {
          const clienteMatch = f.cliente.toUpperCase().includes(filters.cliente.toUpperCase());
          let dateMatch = true;
          if (filters.startDate && f.data < filters.startDate) dateMatch = false;
          if (filters.endDate && f.data > filters.endDate) dateMatch = false;
          return clienteMatch && dateMatch;
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
            if (['valor', 'quantidade'].includes(key)) comparison = aValue - bValue;
            else if (key === 'data') comparison = (new Date(aValue).getTime() || 0) - (new Date(bValue).getTime() || 0);
            else comparison = String(aValue).localeCompare(String(bValue));
            return sortConfig.direction === 'ascending' ? comparison : -comparison;
        });
    }
    return sortableItems;
  }, [filteredFaturamentos, sortConfig]);

  const dataForExport = useMemo(() => sortedFaturamentos.map(f => ({
    'Data': formatDateForDisplay(f.data),
    'Cliente': f.cliente,
    'Nº Nota Serviço': f.nNotaServico,
    'Nº Nota Peça': f.nNotaPecas,
    'Valor': f.valor,
    'Parcelas': f.quantidade,
    'Condições Pagamento': f.condicoesPagamento,
  })), [sortedFaturamentos]);

  const totalFiltrado = useMemo(() => {
    return filteredFaturamentos.reduce((acc, f) => acc + (Number(f.valor) || 0), 0);
  }, [filteredFaturamentos]);

  const totalPages = Math.ceil(sortedFaturamentos.length / itemsPerPage);
  const currentItems = useMemo(() => {
    if (isPrinting) return sortedFaturamentos;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return sortedFaturamentos.slice(indexOfFirstItem, indexOfLastItem);
  }, [sortedFaturamentos, currentPage, isPrinting]);

  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
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

      <h1 className="hidden print:block text-2xl font-bold mb-4 text-black">Relatório de Faturamento c/ Nota</h1>
      <div className="flex-shrink-0 bg-slate-800 p-4 rounded-lg shadow-lg no-print">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{viewMode === 'single' ? (isEditing ? 'Editando Faturamento' : 'Novo Faturamento') : 'Cadastro em Lote'}</h2>
            <button onClick={() => { if (isEditing) handleCancelEdit(); setViewMode(prev => prev === 'single' ? 'batch' : 'single'); }} className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded flex items-center transition-colors text-sm">
                {viewMode === 'single' ? 'Cadastrar em Lote' : 'Cadastro Individual'}
            </button>
        </div>
        {viewMode === 'single' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="data" className="block text-sm font-medium mb-1 text-slate-400">Data</label>
                <input ref={dateInputRef} type="date" id="data" name="data" value={formState.data} onChange={handleInputChange} required className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
              </div>
              <div className="relative">
                <label htmlFor="cliente" className="block text-sm font-medium mb-1 text-slate-400">Cliente</label>
                <input type="text" id="cliente" name="cliente" value={formState.cliente} onChange={handleInputChange} onKeyDown={handleKeyDown} onFocus={() => setIsClienteFocused(true)} onBlur={() => setTimeout(() => setIsClienteFocused(false), 200)} autoComplete="off" placeholder="Nome do cliente" required className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none uppercase" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                  {isClienteFocused && clienteSuggestions.length > 0 && (
                      <ul className="absolute z-10 w-full bg-slate-700 border border-slate-600 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                          {clienteSuggestions.map((suggestion, index) => (
                              <li key={index} className={`px-3 py-2 cursor-pointer hover:bg-slate-600 ${index === highlightedIndex ? 'bg-slate-600' : ''}`} onClick={() => { setFormState(prev => ({ ...prev, cliente: suggestion })); setClienteSuggestions([]); }}>{suggestion}</li>
                          ))}
                      </ul>
                  )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div><label htmlFor="nNotaServico" className="block text-sm font-medium mb-1 text-slate-400">Nº Nota Serviço</label><input type="text" id="nNotaServico" name="nNotaServico" value={formState.nNotaServico} onChange={handleInputChange} className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none uppercase" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} /></div>
              <div><label htmlFor="nNotaPecas" className="block text-sm font-medium mb-1 text-slate-400">Nº Nota Peça</label><input type="text" id="nNotaPecas" name="nNotaPecas" value={formState.nNotaPecas} onChange={handleInputChange} className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none uppercase" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} /></div>
              <div><label htmlFor="valor" className="block text-sm font-medium mb-1 text-slate-400">Valor Total</label><input type="number" id="valor" name="valor" value={formState.valor} onChange={handleInputChange} required step="0.01" min="0" placeholder="0" className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} /></div>
              <div><label htmlFor="quantidade" className="block text-sm font-medium mb-1 text-slate-400">Parcelas</label><input type="number" id="quantidade" name="quantidade" value={formState.quantidade} onChange={handleInputChange} min="1" className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div><label htmlFor="condicoesPagamento" className="block text-sm font-medium mb-1 text-slate-400">Condições de Pagamento</label><input type="text" id="condicoesPagamento" name="condicoesPagamento" placeholder="Ex: 30/60/90 dias" value={formState.condicoesPagamento} onChange={handleInputChange} className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none uppercase" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} /></div>
              <div className="flex gap-2">
                <button type="submit" className="w-full text-white font-semibold py-2 px-4 rounded-lg transition-colors" style={{backgroundColor: settings.accentColor}}>{isEditing ? 'Salvar' : 'Adicionar'}</button>
                {isEditing && <button type="button" onClick={handleCancelEdit} className="w-full bg-slate-600 font-semibold py-2 px-4 rounded-lg transition-opacity hover:opacity-90">Cancelar</button>}
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
              <p className="text-sm text-slate-400"><strong className="font-mono">Data | Cliente | Nota Serviço | Nota Peça | Valor Total | Parcelas | Condições</strong></p>
              <textarea value={batchData} onChange={(e) => setBatchData(e.target.value)} placeholder={'06/01/2025\tCLIENTE TESTE\t8510\t7269\tR$ 7.977,31\t4\t30/60/90/120'} className="w-full h-48 p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none font-mono text-sm" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
              <div className="flex justify-end gap-4">
                  <button onClick={handleProcessBatch} disabled={isProcessing} className="text-white font-semibold py-2 px-6 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-wait" style={{backgroundColor: settings.accentColor}}>{isProcessing ? 'Processando...' : 'Processar Lote'}</button>
              </div>
          </div>
        )}
      </div>

      <div className="flex-grow flex flex-col bg-slate-800 rounded-lg shadow-lg overflow-hidden">
        <div className="flex-shrink-0 p-3 border-b border-slate-700 flex flex-wrap justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-2 no-print">
            <input type="text" name="cliente" value={filters.cliente} onChange={handleFilterChange} placeholder="Buscar por cliente..." className="p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none w-64 uppercase" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
            <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" />
            <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right"><span className="text-xs text-slate-400 uppercase">Total Filtrado</span><p className="text-2xl font-bold text-green-400">{formatCurrency(totalFiltrado)}</p></div>
            <div className="flex items-center gap-2 no-print">
                <button onClick={handlePrint} className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded flex items-center transition-colors" title="Imprimir / Salvar PDF"><PrinterIcon className="w-5 h-5" /></button>
                <button onClick={() => exportToXLSX(dataForExport, 'faturamento_com_nota.xlsx')} className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded flex items-center transition-colors"><ExportIcon className="w-5 h-5 mr-2" />Exportar XLSX</button>
            </div>
          </div>
        </div>
        
        <div className="flex-grow overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900/70 sticky top-0">
                <tr>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('data')}>Data {getSortIndicator('data')}</th>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('cliente')}>Cliente {getSortIndicator('cliente')}</th>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('nNotaServico')}>Nº Serv. {getSortIndicator('nNotaServico')}</th>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('nNotaPecas')}>Nº Peça {getSortIndicator('nNotaPecas')}</th>
                  <th className="px-4 py-3 text-right cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('valor')}>Valor {getSortIndicator('valor')}</th>
                  <th className="px-4 py-3 text-center cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('quantidade')}>Parc. {getSortIndicator('quantidade')}</th>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-slate-700/50 transition-colors" onClick={() => requestSort('condicoesPagamento')}>Condições {getSortIndicator('condicoesPagamento')}</th>
                  <th className="px-4 py-3 text-center no-print">Ações</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((f: FaturamentoType) => (
                  <tr key={f.id} onDoubleClick={() => handleEdit(f)} className="border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer">
                    <td className="px-4 py-2">{formatDateForDisplay(f.data)}</td>
                    <td className="px-4 py-2 font-medium uppercase text-slate-200 truncate" style={{maxWidth: '200px'}}>{f.cliente}</td>
                    <td className="px-4 py-2">{f.nNotaServico || '-'}</td>
                    <td className="px-4 py-2">{f.nNotaPecas || '-'}</td>
                    <td className="px-4 py-2 text-right font-medium text-green-400">{formatCurrency(f.valor)}</td>
                    <td className="px-4 py-2 text-center">{f.quantidade}</td>
                    <td className="px-4 py-2 truncate" style={{maxWidth: '120px'}}>{f.condicoesPagamento}</td>
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
            <div>{sortedFaturamentos.length > 0 ? `Mostrando ${Math.min((currentPage - 1) * itemsPerPage + 1, sortedFaturamentos.length)} a ${Math.min(currentPage * itemsPerPage, sortedFaturamentos.length)} de ${sortedFaturamentos.length} registros` : 'Nenhum registro encontrado'}</div>
            <div className="flex items-center gap-2">
                <button onClick={handlePrevPage} disabled={currentPage === 1} className="px-3 py-1 bg-slate-700 rounded disabled:opacity-50">&lt;</button>
                <span>{currentPage} de {totalPages > 0 ? totalPages : 1}</span>
                <button onClick={handleNextPage} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 bg-slate-700 rounded disabled:opacity-50">&gt;</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Faturamento;
