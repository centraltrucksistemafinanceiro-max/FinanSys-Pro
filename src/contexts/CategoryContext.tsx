
import React, { createContext, ReactNode, useContext, useState, useEffect } from 'react';
import { WindowManagerContext, WindowManagerContextProps } from './WindowManagerContext';
import { CompanyContext, CompanyContextProps } from './CompanyContext';
import pb from '../services/pocketbase';
import { AuthContext, AuthContextProps } from './AuthContext';

export interface Category {
  id: string;
  name: string;
  companyId: string;
}

export interface CategoryContextProps {
  categories: Category[];
  addCategory: (name: string) => Promise<boolean>;
  deleteCategory: (id: string) => void;
  refreshCategories: () => void;
}

export const CategoryContext = createContext<CategoryContextProps | undefined>(undefined);

export const CategoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const winManager = useContext(WindowManagerContext) as WindowManagerContextProps | undefined;
  const companyContext = useContext(CompanyContext) as CompanyContextProps | undefined;
  const auth = useContext(AuthContext) as AuthContextProps | undefined;

  const loadCategories = async () => {
    if (!companyContext?.currentCompany.id || !pb.authStore.isValid) return;
    
    try {
      const records = await pb.collection('categories').getFullList({
        filter: `company = "${companyContext.currentCompany.id}"`,
        sort: 'name',
      });
      
      const mappedCategories: Category[] = records.map(r => ({
          id: r.id,
          name: r.name,
          companyId: r.company
      }));
      
      setCategories(mappedCategories);
    } catch (error) {
      console.error("Failed to load categories:", error);
      // Only show error if not a cancellation error
      if ((error as any).status !== 0) {
          winManager?.addNotification({
            title: 'Erro',
            message: 'Falha ao carregar categorias.',
            type: 'error',
          });
      }
      setCategories([]);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [companyContext?.currentCompany.id, auth?.isAuthenticated]);

  const addCategory = async (name: string): Promise<boolean> => {
    if (!companyContext || !auth?.currentUser) return false;

    const upperCaseName = name.toUpperCase().trim();
    if (!upperCaseName) {
        winManager?.addNotification({ title: 'Erro', message: 'Nome inválido.', type: 'error' });
        return false;
    }

    try {
        await pb.collection('categories').create({
            name: upperCaseName,
            company: companyContext.currentCompany.id,
            owner: auth.currentUser.id
        });
        await loadCategories();
        winManager?.addNotification({ title: 'Sucesso', message: 'Categoria adicionada.', type: 'success' });
        return true;
    } catch (error: any) {
        console.error(error);
        winManager?.addNotification({ title: 'Erro', message: error.message || 'Erro ao salvar categoria.', type: 'error' });
        return false;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
        await pb.collection('categories').delete(id);
        await loadCategories();
        winManager?.addNotification({ title: 'Sucesso', message: 'Categoria removida.', type: 'info' });
    } catch (error) {
        console.error(error);
        winManager?.addNotification({ title: 'Erro', message: 'Erro ao excluir categoria.', type: 'error' });
    }
  };

  return (
    <CategoryContext.Provider value={{ categories, addCategory, deleteCategory, refreshCategories: loadCategories }}>
      {children}
    </CategoryContext.Provider>
  );
};
