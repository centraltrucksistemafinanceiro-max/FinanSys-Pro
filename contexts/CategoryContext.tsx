
import React, { createContext, ReactNode, useContext, useState, useEffect } from 'react';
import { WindowManagerContext, WindowManagerContextProps } from './WindowManagerContext';
import { CompanyContext, CompanyContextProps } from './CompanyContext';
import pb from '../services/pocketbase';
import { AuthContext, AuthContextProps } from './AuthContext';
import { DEFAULT_CATEGORIES } from '../constants';

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
  resetToDefaults: () => Promise<void>;
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
      
      if (records.length === 0) {
          console.log("Seeding default categories...");
          const userId = pb.authStore.model?.id; // Get ID directly from store for safety
          
          if (userId) {
            // Seeding serial to avoid overloading connection or parallel errors
            for (const catName of DEFAULT_CATEGORIES) {
                try {
                    await pb.collection('categories').create({
                        name: catName,
                        company: companyContext.currentCompany.id,
                        owner: userId
                    });
                } catch (e) {
                    console.warn(`Skipping category creation for ${catName}`, e);
                }
            }
            
            // Fetch again after seeding
            const seededRecords = await pb.collection('categories').getFullList({
                filter: `company = "${companyContext.currentCompany.id}"`,
                sort: 'name',
            });
            
            setCategories(seededRecords.map(r => ({
                id: r.id,
                name: r.name,
                companyId: r.company
            })));
          }
      } else {
          const mappedCategories: Category[] = records.map(r => ({
              id: r.id,
              name: r.name,
              companyId: r.company
          }));
          setCategories(mappedCategories);
      }
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

  const resetToDefaults = async () => {
      if (!companyContext?.currentCompany.id) return;
      
      try {
          // 1. Fetch all current categories
          const records = await pb.collection('categories').getFullList({
              filter: `company = "${companyContext.currentCompany.id}"`,
          });

          // 2. Delete all (in parallel for speed, though serial is safer for error handling)
          await Promise.all(records.map(r => pb.collection('categories').delete(r.id).catch(e => console.warn(`Failed to delete ${r.id}`, e))));

          // 3. Trigger load, which handles seeding automatically if empty
          await loadCategories();
          
          winManager?.addNotification({
              title: 'Sucesso',
              message: 'Categorias restauradas para o padrão.',
              type: 'success'
          });
      } catch (e) {
          console.error(e);
          winManager?.addNotification({
              title: 'Erro',
              message: 'Falha ao restaurar categorias.',
              type: 'error'
          });
      }
  };

  return (
    <CategoryContext.Provider value={{ categories, addCategory, deleteCategory, refreshCategories: loadCategories, resetToDefaults }}>
      {children}
    </CategoryContext.Provider>
  );
};
