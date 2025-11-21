
import React, { createContext, ReactNode, useMemo, useState, useEffect, useContext } from 'react';
import { Company } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import pb from '../services/pocketbase';
import { COMPANIES as DEFAULT_COMPANIES } from '../constants';
import { WindowManagerContext, WindowManagerContextProps } from './WindowManagerContext';

export interface CompanyContextProps {
  companies: Company[];
  currentCompany: Company;
  setCurrentCompany: (companyId: string) => void;
  addCompany: (name: string) => Promise<boolean>;
}

export const CompanyContext = createContext<CompanyContextProps | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompanyId, setCurrentCompanyId] = useLocalStorage<string>('currentCompanyId', '');
  const winManager = useContext(WindowManagerContext) as WindowManagerContextProps | undefined;

  // Fetch companies on mount
  const fetchCompanies = async () => {
    try {
        if (pb.authStore.isValid) {
            const userId = pb.authStore.model?.id;
            
            let records = await pb.collection('companies').getFullList({
                sort: 'name',
            });

            // SEEDING AUTOMÁTICO: Se não houver empresas no banco, cria as padrão
            if (records.length === 0 && userId) {
                console.log("Banco de dados vazio. Criando empresas padrão...");
                for (const defaultCompany of DEFAULT_COMPANIES) {
                    try {
                        await pb.collection('companies').create({
                            name: defaultCompany.name,
                            owner: userId
                        });
                    } catch (seedErr) {
                        console.error(`Erro ao criar empresa ${defaultCompany.name}:`, seedErr);
                    }
                }
                // Recarrega a lista após criar
                records = await pb.collection('companies').getFullList({
                    sort: 'name',
                });
            }

            const loadedCompanies = records.map(r => ({ id: r.id, name: r.name }));
            setCompanies(loadedCompanies);
            
            // Se o ID atual for inválido ou vazio, define para a primeira empresa encontrada
            if (loadedCompanies.length > 0) {
                const isValidSelection = loadedCompanies.find(c => c.id === currentCompanyId);
                if (!currentCompanyId || !isValidSelection) {
                    setCurrentCompanyId(loadedCompanies[0].id);
                }
            }
        }
    } catch (e) {
        console.error("Failed to load companies", e);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [pb.authStore.isValid]);

  const setCurrentCompany = (companyId: string) => {
    setCurrentCompanyId(companyId);
  };

  const addCompany = async (name: string): Promise<boolean> => {
    if (!name.trim()) return false;
    
    const userId = pb.authStore.model?.id;
    if (!userId) {
        winManager?.addNotification({
            title: 'Erro',
            message: 'Usuário não autenticado.',
            type: 'error'
        });
        return false;
    }
    
    try {
        const record = await pb.collection('companies').create({
            name: name.toUpperCase().trim(),
            owner: userId
        });
        
        // Atualiza a lista local
        const newCompany = { id: record.id, name: record.name };
        setCompanies(prev => [...prev, newCompany].sort((a, b) => a.name.localeCompare(b.name)));
        
        // Opcional: Selecionar a nova empresa automaticamente
        setCurrentCompanyId(newCompany.id);

        winManager?.addNotification({
            title: 'Sucesso',
            message: `Empresa "${name}" criada com sucesso.`,
            type: 'success'
        });
        return true;
    } catch (error: any) {
        console.error("Error creating company:", error);
        winManager?.addNotification({
            title: 'Erro',
            message: 'Não foi possível criar a empresa. Verifique as permissões ou se o nome já existe.',
            type: 'error'
        });
        return false;
    }
  };

  const currentCompany = useMemo(() => {
    return companies.find(c => c.id === currentCompanyId) || companies[0] || { id: '', name: 'Carregando...' };
  }, [currentCompanyId, companies]);

  return (
    <CompanyContext.Provider value={{ companies, currentCompany, setCurrentCompany, addCompany }}>
      {children}
    </CompanyContext.Provider>
  );
};
