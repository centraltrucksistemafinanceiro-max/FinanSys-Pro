
import React, { createContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { Company } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import pb from '../services/pocketbase';

export interface CompanyContextProps {
  companies: Company[];
  currentCompany: Company;
  setCurrentCompany: (companyId: string) => void;
}

export const CompanyContext = createContext<CompanyContextProps | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompanyId, setCurrentCompanyId] = useLocalStorage<string>('currentCompanyId', '');

  // Fetch companies on mount
  useEffect(() => {
    const fetchCompanies = async () => {
        try {
            if (pb.authStore.isValid) {
                const records = await pb.collection('companies').getFullList({
                    sort: 'name',
                });
                const loadedCompanies = records.map(r => ({ id: r.id, name: r.name }));
                setCompanies(loadedCompanies);
                
                // If current ID is invalid or empty, set to first company
                if (loadedCompanies.length > 0 && (!currentCompanyId || !loadedCompanies.find(c => c.id === currentCompanyId))) {
                    setCurrentCompanyId(loadedCompanies[0].id);
                }
            }
        } catch (e) {
            console.error("Failed to load companies", e);
        }
    };
    fetchCompanies();
  }, [pb.authStore.isValid]);

  const currentCompany = useMemo(() => {
    return companies.find(c => c.id === currentCompanyId) || companies[0] || { id: '', name: 'Carregando...' };
  }, [currentCompanyId, companies]);

  const setCurrentCompany = (companyId: string) => {
    setCurrentCompanyId(companyId);
  };

  return (
    <CompanyContext.Provider value={{ companies, currentCompany, setCurrentCompany }}>
      {children}
    </CompanyContext.Provider>
  );
};
