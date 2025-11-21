
import React, { createContext, ReactNode, useContext } from 'react';
import { Boleto, BoletoStatus } from '../types';
import { WindowManagerContext, WindowManagerContextProps } from './WindowManagerContext';
import { CompanyContext, CompanyContextProps } from './CompanyContext';
import { AuthContext, AuthContextProps } from './AuthContext';
import pb from '../services/pocketbase';

export interface BoletoContextProps {
  queryBoletos: (params: { companyId: string, filters?: any }) => Promise<Boleto[]>;
  addBoleto: (boleto: Omit<Boleto, 'id' | 'status' | 'paymentDate' | 'companyId'>) => Promise<void>;
  addMultipleBoletos: (boletos: (Omit<Boleto, 'id' | 'companyId' | 'status' | 'paymentDate'> & { status?: BoletoStatus; paymentDate?: string })[]) => Promise<void>;
  deleteBoleto: (id: string) => Promise<void>;
  updateBoleto: (id: string, updates: Partial<Omit<Boleto, 'id' | 'companyId'>>) => Promise<void>;
  payBoleto: (id: string) => Promise<void>;
  getTotals: (params: { companyId: string, filters?: any }) => Promise<{ totalWithInvoice: number; totalWithoutInvoice: number; totalBoletos: number; }>;
}

export const BoletoContext = createContext<BoletoContextProps | undefined>(undefined);

export const BoletoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const winManager = useContext(WindowManagerContext) as WindowManagerContextProps | undefined;
  const companyContext = useContext(CompanyContext) as CompanyContextProps | undefined;
  const auth = useContext(AuthContext) as AuthContextProps | undefined;
  
  const mapRecordToBoleto = (record: any): Boleto => ({
      id: record.id,
      companyId: record.company,
      description: record.description,
      amountWithInvoice: record.amountWithInvoice,
      amountWithoutInvoice: record.amountWithoutInvoice,
      category: record.expand?.category?.name || 'Geral',
      date: record.date ? record.date.split(' ')[0] : '',
      status: record.status as BoletoStatus,
      paymentDate: record.paymentDate ? record.paymentDate.split(' ')[0] : undefined
  });

  const queryBoletos = async (params: { companyId: string, filters?: any }): Promise<Boleto[]> => {
    const { companyId, filters = {} } = params;

    let filterQuery = `company = "${companyId}"`;
    if (filters.startDate) {
        filterQuery += ` && date >= "${filters.startDate} 00:00:00"`;
    }
    if (filters.endDate) {
        filterQuery += ` && date <= "${filters.endDate} 23:59:59"`;
    }
    if (filters.description) {
        filterQuery += ` && description ~ "${filters.description}"`;
    }
    
    try {
        const records = await pb.collection('boletos').getFullList({
            filter: filterQuery,
            sort: 'date',
            expand: 'category'
        });
        
        let boletos = records.map(mapRecordToBoleto);
        if (filters.category) {
            boletos = boletos.filter(b => b.category === filters.category);
        }
        return boletos;
    } catch (e) {
        console.error("Error querying boletos", e);
        return [];
    }
  };

  const getTotals = async (params: { companyId: string, filters?: any }) => {
    const boletos = await queryBoletos(params);
    const totals = boletos.reduce((acc, boleto) => {
      acc.withInvoice += Number(boleto.amountWithInvoice) || 0;
      acc.withoutInvoice += Number(boleto.amountWithoutInvoice) || 0;
      return acc;
    }, { withInvoice: 0, withoutInvoice: 0 });
    return {
      totalWithInvoice: totals.withInvoice,
      totalWithoutInvoice: totals.withoutInvoice,
      totalBoletos: totals.withInvoice + totals.withoutInvoice
    };
  };

  const getCategoryIdByName = async (name: string, companyId: string): Promise<string> => {
      try {
          const cat = await pb.collection('categories').getFirstListItem(`name="${name}" && company="${companyId}"`);
          return cat.id;
      } catch {
          return '';
      }
  }

  const addBoleto = async (boleto: Omit<Boleto, 'id' | 'status' | 'paymentDate' | 'companyId'>) => {
    if (!companyContext || !auth?.currentUser) return;

    try {
        const categoryId = await getCategoryIdByName(boleto.category, companyContext.currentCompany.id);
        await pb.collection('boletos').create({
            ...boleto,
            category: categoryId,
            status: BoletoStatus.OPEN,
            company: companyContext.currentCompany.id,
            owner: auth.currentUser.id
        });
        winManager?.addNotification({
            id: `add-boleto-${Date.now()}`,
            title: 'Sucesso',
            message: 'Boleto adicionado com sucesso.',
            type: 'success'
        });
    } catch (e) {
        console.error(e);
        winManager?.addNotification({ title: 'Erro', message: 'Falha ao adicionar boleto.', type: 'error' });
    }
  };
  
  const addMultipleBoletos = async (newBoletos: (Omit<Boleto, 'id' | 'companyId' | 'status' | 'paymentDate'> & { status?: BoletoStatus; paymentDate?: string })[]) => {
      if (!companyContext || !auth?.currentUser) return;
      
      for (const b of newBoletos) {
          const categoryId = await getCategoryIdByName(b.category, companyContext.currentCompany.id);
          await pb.collection('boletos').create({
              ...b,
              category: categoryId,
              status: b.status || BoletoStatus.OPEN,
              paymentDate: b.paymentDate,
              company: companyContext.currentCompany.id,
              owner: auth.currentUser.id
          }).catch(e => console.error("Failed batch item", e));
      }
  };

  const deleteBoleto = async (id: string) => {
    await pb.collection('boletos').delete(id);
     winManager?.addNotification({
        id: `del-boleto-${Date.now()}`,
        title: 'Sucesso',
        message: 'Boleto removido.',
        type: 'info'
    });
  };

  const updateBoleto = async (id: string, updates: Partial<Omit<Boleto, 'id' | 'companyId'>>) => {
    try {
        const data: any = { ...updates };
        if (updates.category && companyContext) {
             data.category = await getCategoryIdByName(updates.category, companyContext.currentCompany.id);
        }
        await pb.collection('boletos').update(id, data);

        winManager?.addNotification({
            id: `update-boleto-${Date.now()}`,
            title: 'Sucesso',
            message: 'Boleto atualizado com sucesso.',
            type: 'success',
        });
    } catch (e) {
        winManager?.addNotification({ title: 'Erro', message: 'Falha ao atualizar.', type: 'error' });
    }
  };

  const payBoleto = async (id: string) => {
    try {
        await pb.collection('boletos').update(id, {
            status: BoletoStatus.PAID,
            paymentDate: new Date().toISOString()
        });
        
        winManager?.addNotification({
            id: `pay-boleto-${Date.now()}`,
            title: 'Sucesso',
            message: 'Boleto marcado como pago.',
            type: 'success'
        });
    } catch (e) {
         winManager?.addNotification({ title: 'Erro', message: 'Falha ao pagar.', type: 'error' });
    }
  };

  return (
    <BoletoContext.Provider value={{ queryBoletos, addBoleto, addMultipleBoletos, deleteBoleto, updateBoleto, payBoleto, getTotals }}>
      {children}
    </BoletoContext.Provider>
  );
};
