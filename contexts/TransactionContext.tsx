import React, { createContext, ReactNode, useContext } from 'react';
import { Transaction, TransactionType } from '../types';
import { WindowManagerContext, WindowManagerContextProps } from './WindowManagerContext';
import { CompanyContext, CompanyContextProps } from './CompanyContext';
import { AuthContext, AuthContextProps } from './AuthContext';
import pb from '../services/pocketbase';

export interface TransactionContextProps {
  queryTransactions: (params: { companyId: string, filters?: any }) => Promise<Transaction[]>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'companyId'>) => Promise<Transaction | null>;
  addMultipleTransactions: (transactions: Omit<Transaction, 'id' | 'companyId'>[]) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, 'id' | 'companyId'>>) => Promise<void>;
  getTotals: (params: { companyId: string, filters?: any }) => Promise<{ totalIncome: number; totalExpenses: number; balance: number; }>;
  getBalanceUntilDate: (params: { companyId: string, date: string }) => Promise<number>;
}

export const TransactionContext = createContext<TransactionContextProps | undefined>(undefined);

export const TransactionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const winManager = useContext(WindowManagerContext) as WindowManagerContextProps | undefined;
  const companyContext = useContext(CompanyContext) as CompanyContextProps | undefined;
  const auth = useContext(AuthContext) as AuthContextProps | undefined;

  const mapRecordToTransaction = (record: any): Transaction => ({
      id: record.id,
      companyId: record.company,
      type: record.type as TransactionType,
      date: record.date ? record.date.split(' ')[0] : '', // Extract YYYY-MM-DD
      description: record.description,
      amount: record.amount,
      category: record.expand?.category?.name || 'Geral', // Try to get expanded category name
      notes: record.notes,
      paymentMethod: record.paymentMethod,
  });

  const queryTransactions = async (params: { companyId: string, filters?: any }): Promise<Transaction[]> => {
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
    if (filters.paymentMethod) {
        filterQuery += ` && paymentMethod = "${filters.paymentMethod}"`;
    }
    
    try {
        const records = await pb.collection('transactions').getFullList({
            filter: filterQuery,
            sort: '-date',
            expand: 'category' // Expand relation to get name
        });
        
        let transactions = records.map(mapRecordToTransaction);
        
        if (filters.category) {
            transactions = transactions.filter(t => t.category === filters.category);
        }
        
        return transactions;
    } catch (err) {
        console.error("Error querying transactions", err);
        return [];
    }
  };
  
  const getTotals = async (params: { companyId: string, filters?: any }) => {
    const transactions = await queryTransactions(params);
    return transactions.reduce((acc, t) => {
      const amount = Number(t.amount) || 0;
      if (t.type === TransactionType.INCOME) {
        acc.totalIncome += amount;
      } else {
        acc.totalExpenses += amount;
      }
      acc.balance = acc.totalIncome - acc.totalExpenses;
      return acc;
    }, { totalIncome: 0, totalExpenses: 0, balance: 0 });
  };

  const getBalanceUntilDate = async (params: { companyId: string, date: string }): Promise<number> => {
    const { companyId, date } = params;
    const filterQuery = `company = "${companyId}" && date <= "${date} 23:59:59"`;
    try {
      const records = await pb.collection('transactions').getFullList({ filter: filterQuery });
      const balance = records.reduce((acc, record) => {
        const amount = Number(record.amount) || 0;
        return record.type === TransactionType.INCOME ? acc + amount : acc - amount;
      }, 0);
      return balance;
    } catch (err) {
      console.error("Error getting balance until date", err);
      return 0;
    }
  };

  const getCategoryIdByName = async (name: string, companyId: string): Promise<string> => {
      try {
          const cat = await pb.collection('categories').getFirstListItem(`name="${name}" && company="${companyId}"`);
          return cat.id;
      } catch {
          return '';
      }
  }

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'companyId'>): Promise<Transaction | null> => {
    if (!companyContext || !auth?.currentUser) return null;
    
    try {
        const categoryId = await getCategoryIdByName(transaction.category, companyContext.currentCompany.id);
        
        const record = await pb.collection('transactions').create({
            ...transaction,
            category: categoryId,
            company: companyContext.currentCompany.id,
            owner: auth.currentUser.id
        }, {
            expand: 'category'
        });

        winManager?.addNotification({
            id: `add-trans-${Date.now()}`,
            title: 'Sucesso',
            message: 'Transação adicionada com sucesso.',
            type: 'success'
        });
        return mapRecordToTransaction(record);
    } catch (err: any) {
        console.error(err);
        winManager?.addNotification({ title: 'Erro', message: 'Erro ao salvar transação.', type: 'error' });
        return null;
    }
  };
  
  const addMultipleTransactions = async (newTransactions: Omit<Transaction, 'id' | 'companyId'>[]) => {
      if (!companyContext || !auth?.currentUser) return;
      
      for (const t of newTransactions) {
          const categoryId = await getCategoryIdByName(t.category, companyContext.currentCompany.id);
          await pb.collection('transactions').create({
             ...t,
             category: categoryId,
             company: companyContext.currentCompany.id,
             owner: auth.currentUser.id
          }).catch(e => console.error("Failed to add one transaction", e));
      }
  };

  const deleteTransaction = async (id: string) => {
    await pb.collection('transactions').delete(id);
     winManager?.addNotification({
        id: `del-trans-${Date.now()}`,
        title: 'Sucesso',
        message: 'Transação removida.',
        type: 'info'
    });
  };

  const updateTransaction = async (id: string, updates: Partial<Omit<Transaction, 'id' | 'companyId'>>) => {
    try {
        const data: any = { ...updates };
        if (updates.category && companyContext) {
             data.category = await getCategoryIdByName(updates.category, companyContext.currentCompany.id);
        }
        
        await pb.collection('transactions').update(id, data);
        
        winManager?.addNotification({
        id: `update-trans-${Date.now()}`,
        title: 'Sucesso',
        message: 'Transação atualizada com sucesso.',
        type: 'success',
        });
    } catch (err) {
        console.error(err);
        winManager?.addNotification({ title: 'Erro', message: 'Erro ao atualizar.', type: 'error' });
    }
  };

  return (
    <TransactionContext.Provider value={{ queryTransactions, addTransaction, addMultipleTransactions, deleteTransaction, updateTransaction, getTotals, getBalanceUntilDate }}>
      {children}
    </TransactionContext.Provider>
  );
};