
import React, { createContext, ReactNode, useContext } from 'react';
import { FaturamentoSemNota, FaturamentoSemNotaCategoria } from '../types';
import { WindowManagerContext, WindowManagerContextProps } from './WindowManagerContext';
import { CompanyContext, CompanyContextProps } from './CompanyContext';
import { AuthContext, AuthContextProps } from './AuthContext';
import pb from '../services/pocketbase';

export interface FaturamentoSemNotaContextProps {
  queryFaturamentos: (params: { companyId: string, filters?: any }) => Promise<FaturamentoSemNota[]>;
  addFaturamento: (faturamento: Omit<FaturamentoSemNota, 'id' | 'valor' | 'companyId'> & { valor: number | string }) => Promise<FaturamentoSemNota | null>;
  addMultipleFaturamentos: (faturamentos: (Omit<FaturamentoSemNota, 'id' | 'valor' | 'companyId'> & { valor: number | string })[]) => Promise<void>;
  deleteFaturamento: (id: string) => Promise<void>;
  updateFaturamento: (id: string, updates: Partial<Omit<FaturamentoSemNota, 'id' | 'valor' | 'companyId'> & { valor: number | string }>) => Promise<void>;
  getTotals: (params: { companyId: string, filters?: any }) => Promise<{ totalFaturamento: number; totalOutros: number; saldo: number; }>;
}

export const FaturamentoSemNotaContext = createContext<FaturamentoSemNotaContextProps | undefined>(undefined);

export const FaturamentoSemNotaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const winManager = useContext(WindowManagerContext) as WindowManagerContextProps | undefined;
  const companyContext = useContext(CompanyContext) as CompanyContextProps | undefined;
  const auth = useContext(AuthContext) as AuthContextProps | undefined;

  const mapRecordToFaturamento = (record: any): FaturamentoSemNota => ({
      id: record.id,
      companyId: record.company,
      nOrcamento: record.nOrcamento,
      valor: record.valor,
      condicaoPagamento: record.condicaoPagamento,
      categoria: record.categoria as FaturamentoSemNotaCategoria,
      data: record.data ? record.data.split(' ')[0] : ''
  });

  const queryFaturamentos = async (params: { companyId: string, filters?: any }): Promise<FaturamentoSemNota[]> => {
    const { companyId, filters = {} } = params;

    let filterQuery = `company = "${companyId}"`;
    if (filters.startDate) {
        filterQuery += ` && data >= "${filters.startDate} 00:00:00"`;
    }
    if (filters.endDate) {
        filterQuery += ` && data <= "${filters.endDate} 23:59:59"`;
    }
    if (filters.nOrcamento) {
        filterQuery += ` && nOrcamento ~ "${filters.nOrcamento}"`;
    }

    try {
        const records = await pb.collection('faturamentos_sem_nota').getFullList({
            filter: filterQuery,
            sort: '-data'
        });
        return records.map(mapRecordToFaturamento);
    } catch (e) {
        console.error(e);
        return [];
    }
  };

  const getTotals = async (params: { companyId: string, filters?: any }) => {
    const faturamentos = await queryFaturamentos(params);
    const totals = faturamentos.reduce((acc, f) => {
      const valor = Number(f.valor) || 0;
      if (valor > 0) {
        acc.faturamento += valor;
      } else {
        acc.outros += valor;
      }
      return acc;
    }, { faturamento: 0, outros: 0 });

    return {
      totalFaturamento: totals.faturamento,
      totalOutros: totals.outros,
      saldo: totals.faturamento + totals.outros,
    };
  };
  
  const processFaturamentoData = (data: Omit<FaturamentoSemNota, 'id' | 'valor' | 'companyId'> & { valor: number | string }) => {
      let valorNumerico = typeof data.valor === 'string' ? parseFloat(data.valor) : data.valor;
      if (isNaN(valorNumerico)) valorNumerico = 0;

      const valorFinal = (data.categoria === FaturamentoSemNotaCategoria.FATURAMENTO || data.categoria === FaturamentoSemNotaCategoria.CENTRAL_TRUCK)
        ? Math.abs(valorNumerico)
        : -Math.abs(valorNumerico);
        
      return { ...data, valor: valorFinal };
  }

  const addFaturamento = async (faturamentoData: Omit<FaturamentoSemNota, 'id' | 'valor' | 'companyId'> & { valor: number | string }): Promise<FaturamentoSemNota | null> => {
    if (!companyContext || !auth?.currentUser) return null;
    const processedData = processFaturamentoData(faturamentoData);
    
    try {
        const record = await pb.collection('faturamentos_sem_nota').create({
            ...processedData,
            company: companyContext.currentCompany.id,
            owner: auth.currentUser.id
        });
        winManager?.addNotification({
            title: 'Sucesso',
            message: 'Lançamento adicionado com sucesso.',
            type: 'success'
        });
        return mapRecordToFaturamento(record);
    } catch (e) {
        winManager?.addNotification({ title: 'Erro', message: 'Falha ao salvar.', type: 'error' });
        return null;
    }
  };
  
  const addMultipleFaturamentos = async (faturamentosData: (Omit<FaturamentoSemNota, 'id' | 'valor' | 'companyId'> & { valor: number | string })[]) => {
      if (!companyContext || !auth?.currentUser) return;
      for (const f of faturamentosData) {
           const processedData = processFaturamentoData(f);
           await pb.collection('faturamentos_sem_nota').create({
              ...processedData,
              company: companyContext.currentCompany.id,
              owner: auth.currentUser.id
           }).catch(e => console.error("Batch error", e));
      }
  };

  const deleteFaturamento = async (id: string) => {
    await pb.collection('faturamentos_sem_nota').delete(id);
    winManager?.addNotification({
      title: 'Sucesso',
      message: 'Lançamento removido.',
      type: 'info'
    });
  };

  const updateFaturamento = async (id: string, updates: Partial<Omit<FaturamentoSemNota, 'id' | 'valor' | 'companyId'> & { valor: number | string }>) => {
    try {
        const data: any = { ...updates };
        // Re-calculate value sign if category or value changed
        if (updates.valor !== undefined || updates.categoria !== undefined) {
             // We might need current record to merge if partial update implies logic dependency, 
             // but for simplicity we assume the UI sends enough context or we accept the raw update.
             // Ideally we should fetch -> merge -> calc -> update, or calc on UI. 
             // Here assuming the UI sends the "raw" positive value for editing, we re-process:
             // However, `processFaturamentoData` expects a certain shape.
             // Let's assume `updates` contains the raw intended value and category.
             
             // Note: This partial update logic is tricky without full record.
             // Simple approach: just send updates. The context usage in `FaturamentoSemNota.tsx` sends the full form state on update.
             if (updates.valor && updates.categoria) {
                 const processed = processFaturamentoData(updates as any);
                 data.valor = processed.valor;
             }
        }
        
        await pb.collection('faturamentos_sem_nota').update(id, data);

        winManager?.addNotification({
        title: 'Sucesso',
        message: 'Lançamento atualizado com sucesso.',
        type: 'success',
        });
    } catch (e) {
        winManager?.addNotification({ title: 'Erro', message: 'Falha ao atualizar.', type: 'error' });
    }
  };

  return (
    <FaturamentoSemNotaContext.Provider value={{ queryFaturamentos, addFaturamento, addMultipleFaturamentos, deleteFaturamento, updateFaturamento, getTotals }}>
      {children}
    </FaturamentoSemNotaContext.Provider>
  );
};
