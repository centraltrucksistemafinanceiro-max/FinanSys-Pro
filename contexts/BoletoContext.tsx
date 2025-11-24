
import React, { createContext, ReactNode, useContext } from 'react';
import { Boleto, BoletoStatus } from '../types';
import { WindowManagerContext, WindowManagerContextProps } from './WindowManagerContext';
import { CompanyContext, CompanyContextProps } from './CompanyContext';
import { AuthContext, AuthContextProps } from './AuthContext';
import pb from '../services/pocketbase';

export interface BoletoContextProps {
  queryBoletos: (params: { companyId: string, filters?: any }) => Promise<Boleto[]>;
  addBoleto: (boleto: Omit<Boleto, 'id' | 'status' | 'paymentDate' | 'companyId'>) => Promise<Boleto | null>;
  addMultipleBoletos: (boletos: (Omit<Boleto, 'id' | 'companyId' | 'status' | 'paymentDate'> & { status?: BoletoStatus; paymentDate?: string })[]) => Promise<void>;
  deleteBoleto: (id: string) => Promise<boolean>;
  updateBoleto: (id: string, updates: Partial<Omit<Boleto, 'id' | 'companyId'>>) => Promise<void>;
  payBoleto: (id: string) => Promise<boolean>;
  getTotals: (params: { companyId: string, filters?: any }) => Promise<{ totalWithInvoice: number; totalWithoutInvoice: number; totalBoletos: number; }>;
}

export const BoletoContext = createContext<BoletoContextProps | undefined>(undefined);

export const BoletoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const winManager = useContext(WindowManagerContext) as WindowManagerContextProps | undefined;
  const companyContext = useContext(CompanyContext) as CompanyContextProps | undefined;
  const auth = useContext(AuthContext) as AuthContextProps | undefined;
  
  const normalizeStatus = (status: string): BoletoStatus => {
      if (!status) return BoletoStatus.OPEN;
      const s = String(status).toUpperCase();
      if (s === 'PAGO' || s === 'PAID') return BoletoStatus.PAID;
      if (s === 'VENCIDO' || s === 'OVERDUE') return BoletoStatus.OVERDUE;
      return BoletoStatus.OPEN; 
  };

  const mapRecordToBoleto = (record: any): Boleto => ({
      id: record.id,
      companyId: record.company,
      description: record.description,
      amountWithInvoice: record.amountWithInvoice,
      amountWithoutInvoice: record.amountWithoutInvoice,
      category: record.expand?.category?.name || 'Geral',
      date: record.date ? record.date.split(' ')[0] : '',
      status: normalizeStatus(record.status),
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

  const addBoleto = async (boleto: Omit<Boleto, 'id' | 'status' | 'paymentDate' | 'companyId'>): Promise<Boleto | null> => {
    if (!companyContext || !auth?.currentUser) return null;

    try {
        const categoryId = await getCategoryIdByName(boleto.category, companyContext.currentCompany.id);
        const record = await pb.collection('boletos').create({
            ...boleto,
            category: categoryId,
            status: BoletoStatus.OPEN,
            company: companyContext.currentCompany.id,
            owner: auth.currentUser.id
        }, {
            expand: 'category'
        });
        winManager?.addNotification({
            id: `add-boleto-${Date.now()}`,
            title: 'Sucesso',
            message: 'Boleto adicionado com sucesso.',
            type: 'success'
        });
        return mapRecordToBoleto(record);
    } catch (e) {
        console.error(e);
        winManager?.addNotification({ title: 'Erro', message: 'Falha ao adicionar boleto.', type: 'error' });
        return null;
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

  const deleteBoleto = async (id: string): Promise<boolean> => {
    try {
        await pb.collection('boletos').delete(id);
        winManager?.addNotification({
            id: `del-boleto-${Date.now()}`,
            title: 'Sucesso',
            message: 'Boleto removido.',
            type: 'info'
        });
        return true;
    } catch (e) {
        console.error("Failed to delete boleto", e);
        winManager?.addNotification({ title: 'Erro', message: 'Falha ao remover boleto.', type: 'error' });
        return false;
    }
  };

  const updateBoleto = async (id: string, updates: Partial<Omit<Boleto, 'id' | 'companyId'>>) => {
    try {
        const data: any = { ...updates };
        if (updates.category && companyContext) {
             const catId = await getCategoryIdByName(updates.category, companyContext.currentCompany.id);
             if (catId) data.category = catId;
        }
        await pb.collection('boletos').update(id, data);

        winManager?.addNotification({
            id: `update-boleto-${Date.now()}`,
            title: 'Sucesso',
            message: 'Boleto atualizado com sucesso.',
            type: 'success',
        });
    } catch (e: any) {
        winManager?.addNotification({ title: 'Erro', message: e.message || 'Falha ao atualizar.', type: 'error' });
    }
  };

  const payBoleto = async (id: string): Promise<boolean> => {
    try {
        const today = new Date().toISOString().split('T')[0];
        // Use the enum value BoletoStatus.PAID (which is 'Pago') to match standard status
        await pb.collection('boletos').update(id, {
            status: BoletoStatus.PAID, 
            paymentDate: today
        });
        
        winManager?.addNotification({
            id: `pay-boleto-${Date.now()}`,
            title: 'Sucesso',
            message: 'Boleto marcado como pago.',
            type: 'success'
        });
        return true;
    } catch (e) {
         console.error("Pay boleto failed", e);
         winManager?.addNotification({ title: 'Erro', message: 'Falha ao pagar.', type: 'error' });
         return false;
    }
  };

  return (
    <BoletoContext.Provider value={{ queryBoletos, addBoleto, addMultipleBoletos, deleteBoleto, updateBoleto, payBoleto, getTotals }}>
      {children}
    </BoletoContext.Provider>
  );
};
