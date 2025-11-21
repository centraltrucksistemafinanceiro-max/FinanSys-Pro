
import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { User, UserRole } from '../types';
import pb from '../services/pocketbase';
import { WindowManagerContext } from './WindowManagerContext';

export interface LoginResult {
  success: boolean;
  error?: string;
}

export interface AuthContextProps {
  isAuthenticated: boolean;
  currentUser: User | null;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  users: User[]; 
  addUser: (username: string, password: string, role: UserRole) => Promise<boolean>;
  deleteUser: (id: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const winManager = useContext(WindowManagerContext);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check if already logged in via PocketBase persistence
    if (pb.authStore.isValid && pb.authStore.model) {
      const model = pb.authStore.model;
      setCurrentUser({
        id: model.id,
        username: model.username,
        role: (model.role as UserRole) || UserRole.USER,
        passwordHash: '', 
        salt: ''
      });
    }
    setIsLoaded(true);
  }, []);

  const login = async (username: string, password: string): Promise<LoginResult> => {
    try {
      // 'users' is the default auth collection in PocketBase
      const authData = await pb.collection('users').authWithPassword(username, password);
      
      setCurrentUser({
        id: authData.record.id,
        username: authData.record.username,
        role: (authData.record.role as UserRole) || UserRole.USER,
        passwordHash: '',
        salt: ''
      });
      
      return { success: true };
    } catch (error: any) {
      console.error("Login failed:", error);
      let errorMessage = "Erro desconhecido ao realizar login.";
      
      // Detailed Error Handling
      if (error?.status === 400) {
        errorMessage = "Usuário ou senha incorretos.";
      } else if (error?.status === 0 || error?.isAbort) {
        errorMessage = `Não foi possível conectar ao servidor (${pb.baseUrl}). Verifique sua conexão.`;
      } else if (error?.status === 403) {
        errorMessage = "Acesso negado. Sua conta pode estar inativa.";
      } else if (error?.message) {
          errorMessage = error.message;
      }

      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    pb.authStore.clear();
    setCurrentUser(null);
  };

  const addUser = async (username: string, password: string, role: UserRole): Promise<boolean> => {
    try {
        const data = {
            username,
            password,
            passwordConfirm: password,
            role,
            name: username
        };
        await pb.collection('users').create(data);
        winManager?.addNotification({ title: 'Sucesso', message: 'Usuário criado com sucesso.', type: 'success' });
        return true;
    } catch (error: any) {
        console.error("Error creating user:", error);
        winManager?.addNotification({ title: 'Erro', message: error.message || 'Falha ao criar usuário.', type: 'error' });
        return false;
    }
  };

  const deleteUser = async (id: string) => {
    try {
        await pb.collection('users').delete(id);
        winManager?.addNotification({ title: 'Sucesso', message: 'Usuário excluído.', type: 'info' });
    } catch (error) {
        console.error("Error deleting user:", error);
        winManager?.addNotification({ title: 'Erro', message: 'Falha ao excluir usuário.', type: 'error' });
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
        await pb.collection('users').update(currentUser.id, {
            oldPassword: oldPassword,
            password: newPassword,
            passwordConfirm: newPassword
        });
        winManager?.addNotification({ title: 'Sucesso', message: 'Senha alterada com sucesso.', type: 'success' });
        return true;
    } catch (error) {
        console.error("Error changing password:", error);
        winManager?.addNotification({ title: 'Erro', message: 'Falha ao alterar senha. Verifique a senha antiga.', type: 'error' });
        return false;
    }
  };

  if (!isLoaded) return null;

  return (
    <AuthContext.Provider value={{
      isAuthenticated: !!currentUser,
      currentUser,
      users: [], 
      login,
      logout,
      addUser,
      deleteUser,
      changePassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};
