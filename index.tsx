import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SettingsProvider } from './contexts/SettingsContext';
import { WindowManagerProvider } from './contexts/WindowManagerContext';
import { TransactionProvider } from './contexts/TransactionContext';
import { BoletoProvider } from './contexts/BoletoContext';
import { FaturamentoProvider } from './contexts/FaturamentoContext';
import { FaturamentoSemNotaProvider } from './contexts/FaturamentoSemNotaContext';
import { CategoryProvider } from './contexts/CategoryContext';
import { CompanyProvider } from './contexts/CompanyContext';
import { AuthProvider } from './contexts/AuthContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <SettingsProvider>
      <WindowManagerProvider>
        <AuthProvider>
          <CompanyProvider>
            <TransactionProvider>
              <BoletoProvider>
                <CategoryProvider>
                  <FaturamentoProvider>
                    <FaturamentoSemNotaProvider>
                      <App />
                    </FaturamentoSemNotaProvider>
                  </FaturamentoProvider>
                </CategoryProvider>
              </BoletoProvider>
            </TransactionProvider>
          </CompanyProvider>
        </AuthProvider>
      </WindowManagerProvider>
    </SettingsProvider>
  </React.StrictMode>
);