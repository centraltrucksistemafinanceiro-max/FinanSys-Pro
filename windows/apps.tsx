import { AppDefinition, UserRole } from '../types';
import Dashboard from './Dashboard';
import CashFlow from './CashFlow';
import Personalization from './Personalization';
import About from './About';
import BoletoControl from './BoletoControl';
import BoletoDashboard from './BoletoDashboard';
import Faturamento from './Faturamento';
import FaturamentoDashboard from './FaturamentoDashboard';
import FaturamentoSemNota from './FaturamentoSemNota';
import FaturamentoSemNotaDashboard from './FaturamentoSemNotaDashboard';
import BackupRestore from './BackupRestore';
import CategoryManagement from './CategoryManagement';
import UserManagement from './UserManagement';
import ChangePassword from './ChangePassword';
import Calculator from './Calculator';
import DashboardGeral from './DashboardGeral';
import FinancialForecast from './FinancialForecast';
import { 
  DashboardIcon, 
  CashFlowIcon, 
  PersonalizationIcon, 
  InfoIcon, 
  BoletoControlIcon, 
  BoletoDashboardIcon, 
  FaturamentoIcon, 
  FaturamentoDashboardIcon, 
  FaturamentoSemNotaIcon, 
  FaturamentoSemNotaDashboardIcon, 
  BackupIcon, 
  CategoryIcon,
  UserManagementIcon,
  ChangePasswordIcon,
  CalculatorIcon,
  DashboardGeralIcon,
  ForecastIcon
} from '../components/icons/AppIcons';

export const APPS: AppDefinition[] = [
  // Finance Apps
  {
    id: 'cashflow',
    title: 'Fluxo de Caixa',
    icon: CashFlowIcon,
    component: CashFlow,
    defaultSize: { width: 1024, height: 700 },
  },
  {
    id: 'boleto-control',
    title: 'Contas a Pagar',
    icon: BoletoControlIcon,
    component: BoletoControl,
    defaultSize: { width: 1200, height: 800 },
  },
  {
    id: 'faturamento',
    title: 'Faturamento C/ Nota',
    icon: FaturamentoIcon,
    component: Faturamento,
    defaultSize: { width: 1100, height: 700 },
  },
  {
    id: 'faturamento-sn',
    title: 'Faturamento S/ Nota',
    icon: FaturamentoSemNotaIcon,
    component: FaturamentoSemNota,
    defaultSize: { width: 1100, height: 700 },
  },

  // Dashboards
  {
    id: 'dashboard-geral',
    title: 'Dashboard Geral',
    icon: DashboardGeralIcon,
    component: DashboardGeral,
    defaultSize: { width: 1280, height: 800 },
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: DashboardIcon,
    component: Dashboard,
    defaultSize: { width: 800, height: 600 },
  },
  {
    id: 'boleto-dashboard',
    title: 'Dashboard Boletos',
    icon: BoletoDashboardIcon,
    component: BoletoDashboard,
    defaultSize: { width: 800, height: 600 },
  },
  {
    id: 'faturamento-dashboard',
    title: 'Dashboard Faturamento',
    icon: FaturamentoDashboardIcon,
    component: FaturamentoDashboard,
    defaultSize: { width: 800, height: 600 },
  },
  {
    id: 'faturamento-sn-dashboard',
    title: 'Dashboard Fat. S/ Nota',
    icon: FaturamentoSemNotaDashboardIcon,
    component: FaturamentoSemNotaDashboard,
    defaultSize: { width: 800, height: 600 },
  },

  // System & Tools Apps
  {
    id: 'financial-forecast',
    title: 'Projeção Financeira',
    icon: ForecastIcon,
    component: FinancialForecast,
    defaultSize: { width: 1200, height: 750 },
  },
  {
    id: 'calculator',
    title: 'Calculadora Financeira',
    icon: CalculatorIcon,
    component: Calculator,
    defaultSize: { width: 400, height: 600 },
  },
  {
    id: 'personalization',
    title: 'Personalização',
    icon: PersonalizationIcon,
    component: Personalization,
    defaultSize: { width: 500, height: 400 },
  },
  {
    id: 'category-management',
    title: 'Gerenciar Categorias',
    icon: CategoryIcon,
    component: CategoryManagement,
    defaultSize: { width: 500, height: 600 },
  },
  {
    id: 'user-management',
    title: 'Gerenciar Usuários',
    icon: UserManagementIcon,
    component: UserManagement,
    defaultSize: { width: 700, height: 500 },
    role: UserRole.ADMIN,
  },
  {
    id: 'change-password',
    title: 'Alterar Senha',
    icon: ChangePasswordIcon,
    component: ChangePassword,
    defaultSize: { width: 400, height: 400 },
  },
  {
    id: 'backup',
    title: 'Backup e Restauração',
    icon: BackupIcon,
    component: BackupRestore,
    defaultSize: { width: 500, height: 500 },
  },
  {
    id: 'about',
    title: 'Sobre',
    icon: InfoIcon,
    component: About,
    defaultSize: { width: 400, height: 300 },
  },
];