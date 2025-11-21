import React from 'react';

export interface Company {
  id: string;
  name: string;
}

export enum TransactionType {
  INCOME = 'Entrada',
  EXPENSE = 'Saída',
}

export interface Transaction {
  id:string;
  companyId: string;
  type: TransactionType;
  date: string;
  description: string;
  amount: number;
  category: string;
  notes?: string;
}

export enum BoletoStatus {
  OPEN = 'Aberta',
  PAID = 'Pago',
  OVERDUE = 'Vencido',
}

export interface Boleto {
  id: string;
  companyId: string;
  description: string;
  amountWithInvoice: number;
  amountWithoutInvoice: number;
  category: string;
  date: string; // Due date
  status: BoletoStatus;
  paymentDate?: string;
}

export interface Faturamento {
  id: string;
  companyId: string;
  cliente: string;
  nNotaServico: string;
  nNotaPecas: string;
  quantidade: number;
  condicoesPagamento: string;
  valor: number;
  data: string;
}

export enum FaturamentoSemNotaCategoria {
    FATURAMENTO = 'FATURAMENTO',
    RETORNO = 'RETORNO',
    INTERNO = 'INTERNO',
    GARANTIA = 'GARANTIA',
    CORTESIA = 'CORTESIA',
    CENTRAL_TRUCK = 'CENTRAL TRUCK',
}

export interface FaturamentoSemNota {
  id: string;
  companyId: string;
  nOrcamento: string;
  valor: number;
  condicaoPagamento: string;
  categoria: FaturamentoSemNotaCategoria;
  data: string;
}

// FIX: Added User and UserRole types to support authentication features.
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
}


export type Theme = 'light' | 'dark' | 'colorful';
export type Wallpaper = 'wallpaper2' | 'wallpaper3' | 'wallpaper4' | 'wallpaper5' | 'wallpaper6' | 'wallpaper8';

export interface AppDefinition {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
  defaultSize: { width: number; height: number };
  role?: UserRole;
}

export interface WindowInstance {
  id: string;
  appId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
}