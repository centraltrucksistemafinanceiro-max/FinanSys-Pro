import React, { createContext, useState, useEffect, ReactNode } from 'react';

interface PrivacyContextType {
    isValuesVisible: boolean;
    toggleVisibility: () => void;
}

export const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export const PrivacyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isValuesVisible, setIsValuesVisible] = useState(() => {
        const saved = localStorage.getItem('isValuesVisible');
        return saved !== null ? JSON.parse(saved) : true;
    });

    useEffect(() => {
        localStorage.setItem('isValuesVisible', JSON.stringify(isValuesVisible));
    }, [isValuesVisible]);

    const toggleVisibility = () => {
        setIsValuesVisible((prev: boolean) => !prev);
    };

    return (
        <PrivacyContext.Provider value={{ isValuesVisible, toggleVisibility }}>
            {children}
        </PrivacyContext.Provider>
    );
};
