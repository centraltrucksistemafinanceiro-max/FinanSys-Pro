

import React, { createContext, ReactNode, useContext } from 'react';
import { Faturamento } from '../types';
import { WindowManagerContext, WindowManagerContextProps } from './WindowManagerContext';
import { CompanyContext, CompanyContextProps } from './CompanyContext';
import { AuthContext, AuthContextProps } from './AuthContext';
import pb from '../services/pocketbase';

export interface FaturamentoContextProps {
  queryFaturamentos: (params: { companyId: string, filters?: any }) => Promise<Faturamento[]>;
  addFaturamento: (faturamento: Omit<Faturamento, 'id' | 'companyId'>) => Promise<void>;
  addMultipleFaturamentos: (faturamentos: Omit<Faturamento, 'id' | 'companyId'>[]) => Promise<void>;
  deleteFaturamento: (id: string) => Promise<void>;
  updateFaturamento: (id: string, updates: Partial<Omit<Faturamento, 'id' | 'companyId'>>) => Promise<void>;
  getTotal: (params: { companyId: string, filters?: any }) => Promise<number>;
}

export const FaturamentoContext = createContext<FaturamentoContextProps | undefined>(undefined);

export const FaturamentoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const winManager = useContext(WindowManagerContext) as WindowManagerContextProps | undefined;
  const companyContext = useContext(CompanyContext) as CompanyContextProps | undefined;
  const auth = useContext(AuthContext) as AuthContextProps | undefined;
  
  const mapRecordToFaturamento = (record: any): Faturamento => ({
      id: record.id,
      companyId: record.company,
      cliente: record.cliente,
      nNotaServico: record.nNotaServico,
      nNotaPecas: record.nNotaPecas,
      quantidade: record.quantidade,
      condicoesPagamento: record.condicoesPagamento,
      valor: record.valor,
      data: record.data ? record.data.split(' ')[0] : ''
  });

  const queryFaturamentos = async (params: { companyId: string, filters?: any }): Promise<Faturamento[]> => {
    const { companyId, filters = {} } = params;
    
    let filterQuery = `company = "${companyId}"`;
    if (filters.startDate) {
        filterQuery += ` && data >= "${filters.startDate} 00:00:00"`;
    }
    if (filters.endDate) {
        filterQuery += ` && data <= "${filters.endDate} 23:59:59"`;
    }
    if (filters.cliente) {
        filterQuery += ` && cliente ~ "${filters.cliente}"`;
    }

    try {
        const records = await pb.collection('faturamentos').getFullList({
            filter: filterQuery,
            sort: '-data'
        });
        return records.map(mapRecordToFaturamento);
    } catch (e) {
        console.error(e);
        return [];
    }
  };

  const getTotal = async (params: { companyId: string, filters?: any }) => {
    const faturamentos = await queryFaturamentos(params);
    return faturamentos.reduce((acc, f) => acc + (Number(f.valor) || 0), 0);
  };

  const addFaturamento = async (faturamento: Omit<Faturamento, 'id' | 'companyId'>) => {
    if (!companyContext || !auth?.currentUser) return;
    try {
        await pb.collection('faturamentos').create({
            ...faturamento,
            company: companyContext.currentCompany.id,
            owner: auth.currentUser.id
        });
        winManager?.addNotification({
            title: 'Sucesso',
            message: 'Faturamento adicionado com sucesso.',
            type: 'success'
        });
    } catch (e) {
        winManager?.addNotification({ title: 'Erro', message: 'Falha ao salvar.', type: 'error' });
    }
  };

  const addMultipleFaturamentos = async (newFaturamentos: Omit<Faturamento, 'id' | 'companyId'>[]) => {
      if (!companyContext || !auth?.currentUser) return;
      for (const f of newFaturamentos) {
          await pb.collection('faturamentos').create({
              ...f,
              company: companyContext.currentCompany.id,
              owner: auth.currentUser.id
          }).catch(e => console.error("Batch error", e));
      }
  };

  const deleteFaturamento = async (id: string) => {
    await pb.collection('faturamentos').delete(id);
    winManager?.addNotification({
      title: 'Sucesso',
      message: 'Faturamento removido.',
      type: 'info'
    });
  };

  const updateFaturamento = async (id: string, updates: Partial<Omit<Faturamento, 'id' | 'companyId'>>) => {
    try {
        await pb.collection('faturamentos').update(id, updates);
        winManager?.addNotification({
            title: 'Sucesso',
            message: 'Faturamento atualizado com sucesso.',
            type: 'success',
        });
    } catch (e) {
        winManager?.addNotification({ title: 'Erro', message: 'Falha ao atualizar.', type: 'error' });
    }
  };

  return (
    <FaturamentoContext.Provider value={{ queryFaturamentos, addFaturamento, addMultipleFaturamentos, deleteFaturamento, updateFaturamento, getTotal }}>
      {children}
    </FaturamentoContext.Provider>
  );
};