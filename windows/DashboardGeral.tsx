
import React, { useContext, useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { SettingsContext } from '../contexts/SettingsContext';
import { CompanyContext } from '../contexts/CompanyContext';
import { FaturamentoContext } from '../contexts/FaturamentoContext';
import { FaturamentoSemNotaContext } from '../contexts/FaturamentoSemNotaContext';
import { BoletoContext } from '../contexts/BoletoContext';
import { TransactionContext } from '../contexts/TransactionContext';
import { BoletoStatus, Faturamento, FaturamentoSemNota, Boleto, Transaction } from '../types';
import { ScaleIcon, ClockIcon, CurrencyDollarIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline';
import { PrinterIcon } from '../components/icons/AppIcons';
import { formatCurrency } from '../utils/formatters';

const getMonthShortName = (monthIndex: number) => {
  const date = new Date(2000, monthIndex, 1);
  return date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
};

const KPICard = ({ title, value, icon, colorClass, isCurrency = true }: { title: string, value: number, icon: React.ReactNode, colorClass: string, isCurrency?: boolean }) => (
  <div className="bg-slate-800 p-4 rounded-lg shadow-lg flex flex-col justify-between">
    <div className="flex items-center justify-between text-slate-400">
      <p className="text-sm font-medium">{title}</p>
      {icon}
    </div>
    <div>
      <p className={`text-3xl font-bold ${colorClass}`}>
        {isCurrency ? formatCurrency(value) : value}
      </p>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-700 p-3 rounded-md border border-slate-600 text-sm">
        <p className="font-bold text-slate-100 mb-2">{label}</p>
        {payload.map((pld: any, index: number) => (
          <p key={index} style={{ color: pld.color }}>
            {`${pld.name}: ${formatCurrency(pld.value)}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const DashboardGeral: React.FC = () => {
    const settings = useContext(SettingsContext);
    const companyContext = useContext(CompanyContext);
    const faturamentoContext = useContext(FaturamentoContext);
    const faturamentoSemNotaContext = useContext(FaturamentoSemNotaContext);
    const boletoContext = useContext(BoletoContext);
    const transactionContext = useContext(TransactionContext);

    const today = new Date();
    const [startDate, setStartDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [isLoading, setIsLoading] = useState(true);

    const [kpiData, setKpiData] = useState({ faturamentoTotal: 0, balancoCaixa: 0, contasPagas: 0, contasVencidas: 0, contasPendentes: 0, lucroRealizado: 0 });
    const [monthlyEvolutionData, setMonthlyEvolutionData] = useState<any[]>([]);
    const [compositionData, setCompositionData] = useState<any[]>([]);
    const [faturamentoVsContasPagasData, setFaturamentoVsContasPagasData] = useState<any[]>([]);
    
    if (!settings || !faturamentoContext || !faturamentoSemNotaContext || !boletoContext || !transactionContext || !companyContext) {
        return <div className="p-4 bg-slate-900 text-center text-slate-300">Carregando dados...</div>;
    }

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const { id: companyId } = companyContext.currentCompany;
            const filters = { startDate, endDate };
            const yearFilters = { startDate: `${currentYear}-01-01`, endDate: `${currentYear}-12-31`};

            // Fetch all data for the year for charts, and for the selected period for KPIs
            const [
                faturamentosPeriodo, faturamentosSNPeriodo, boletosPeriodo,
                faturamentosAno, faturamentosSNAno, boletosAno,
                totalsCaixa
            ] = await Promise.all([
                faturamentoContext.queryFaturamentos({ companyId, filters }),
                faturamentoSemNotaContext.queryFaturamentos({ companyId, filters }),
                boletoContext.queryBoletos({ companyId, filters }),
                faturamentoContext.queryFaturamentos({ companyId, filters: yearFilters }),
                faturamentoSemNotaContext.queryFaturamentos({ companyId, filters: yearFilters }),
                boletoContext.queryBoletos({ companyId, filters: yearFilters }),
                transactionContext.getTotals({ companyId })
            ]);

            // --- KPI Calculations ---
            const totalFaturamentoComNota = faturamentosPeriodo.reduce((acc, f) => acc + (Number(f.valor) || 0), 0);
            const totalFaturamentoSemNota = faturamentosSNPeriodo.reduce((acc, f) => acc + (Number(f.valor) || 0), 0);
            const faturamentoTotal = totalFaturamentoComNota + totalFaturamentoSemNota;
            
            const todayString = new Date().toISOString().split('T')[0];
            const contasPagas = boletosPeriodo.filter(b => b.status === BoletoStatus.PAID).reduce((acc, b) => acc + (Number(b.amountWithInvoice) || 0) + (Number(b.amountWithoutInvoice) || 0), 0);
            const contasVencidas = boletosPeriodo.filter(b => b.status !== BoletoStatus.PAID && b.date < todayString).reduce((acc, b) => acc + (Number(b.amountWithInvoice) || 0) + (Number(b.amountWithoutInvoice) || 0), 0);
            const contasPendentes = boletosPeriodo.filter(b => b.status === BoletoStatus.OPEN && b.date >= todayString).reduce((acc, b) => acc + (Number(b.amountWithInvoice) || 0) + (Number(b.amountWithoutInvoice) || 0), 0);
            const lucroRealizado = faturamentoTotal - contasPagas;
            
            setKpiData({ faturamentoTotal, balancoCaixa: totalsCaixa.balance, contasPagas, contasVencidas, contasPendentes, lucroRealizado });
            setCompositionData([{ name: 'Faturamento C/ NF', value: totalFaturamentoComNota }, { name: 'Faturamento S/ NF (Líquido)', value: totalFaturamentoSemNota }]);

            // --- Chart Data Calculations (Year) ---
            const monthlyEvo = Array.from({ length: 12 }, (_, i) => ({ name: getMonthShortName(i), 'Faturamento c/ NF': 0, 'Faturamento s/ NF (Líquido)': 0 }));
            faturamentosAno.forEach(f => monthlyEvo[new Date(f.data).getMonth()]['Faturamento c/ NF'] += (Number(f.valor) || 0));
            faturamentosSNAno.forEach(f => monthlyEvo[new Date(f.data).getMonth()]['Faturamento s/ NF (Líquido)'] += (Number(f.valor) || 0));
            setMonthlyEvolutionData(monthlyEvo);
            
            const fatVsContas = Array.from({ length: 12 }, (_, i) => ({ name: getMonthShortName(i), 'Faturamento': 0, 'Contas Pagas': 0 }));
            faturamentosAno.forEach(f => fatVsContas[new Date(f.data).getMonth()]['Faturamento'] += (Number(f.valor) || 0));
            faturamentosSNAno.forEach(f => fatVsContas[new Date(f.data).getMonth()]['Faturamento'] += (Number(f.valor) || 0));
            boletosAno.forEach(b => {
                if (b.status === BoletoStatus.PAID && b.paymentDate) {
                    const totalAmount = (Number(b.amountWithInvoice) || 0) + (Number(b.amountWithoutInvoice) || 0);
                    fatVsContas[new Date(b.paymentDate).getMonth()]['Contas Pagas'] += totalAmount;
                }
            });
            setFaturamentoVsContasPagasData(fatVsContas);
            
            setIsLoading(false);
        };
        fetchData();
    }, [companyContext.currentCompany.id, startDate, endDate, currentYear]);

    const setDateFilter = (preset: 'month' | 'year') => {
        const now = new Date();
        if (preset === 'month') {
            setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
            setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);
        } else {
            setStartDate(new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]);
            setEndDate(new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0]);
        }
        setCurrentYear(now.getFullYear());
    };
    
    const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const {name, value} = e.target;
        if (name === 'startDate') setStartDate(value);
        if (name === 'endDate') setEndDate(value);
        setCurrentYear(new Date(startDate).getFullYear());
    };

    const COMPOSITION_COLORS = ['#3b82f6', '#10b981'];

    return (
        <div className="p-4 bg-slate-900 h-full overflow-y-auto text-slate-200 font-sans printable-dashboard">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                 <h1 className="text-2xl font-bold">Dashboard Geral</h1>
                 <div className="flex items-center gap-4 no-print">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setDateFilter('month')} className="px-4 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 rounded-md transition-colors">Este Mês</button>
                        <button onClick={() => setDateFilter('year')} className="px-4 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 rounded-md transition-colors">Este Ano</button>
                        <input type="date" name="startDate" value={startDate} onChange={handleDateInputChange} className="p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
                        <input type="date" name="endDate" value={endDate} onChange={handleDateInputChange} className="p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties}/>
                        <button onClick={() => { setStartDate(''); setEndDate(''); }} className="px-4 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 rounded-md transition-colors">Limpar Filtros</button>
                    </div>
                    <button 
                        onClick={() => window.print()} 
                        className="p-2 bg-white dark:bg-slate-800 rounded-md shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title="Imprimir"
                    >
                        <PrinterIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <KPICard title="Faturamento Total" value={kpiData.faturamentoTotal} icon={<ArrowTrendingUpIcon className="w-6 h-6" />} colorClass="text-green-400" />
                <KPICard title="Balanço do Caixa" value={kpiData.balancoCaixa} icon={<ScaleIcon className="w-6 h-6" />} colorClass={kpiData.balancoCaixa >= 0 ? 'text-blue-400' : 'text-red-400'} />
                <KPICard title="Total Contas Pagas" value={kpiData.contasPagas} icon={<CurrencyDollarIcon className="w-6 h-6" />} colorClass="text-cyan-400" />
                <KPICard title="Total Contas Vencidas" value={kpiData.contasVencidas} icon={<ClockIcon className="w-6 h-6" />} colorClass="text-red-500" />
                <KPICard title="Contas Pendentes" value={kpiData.contasPendentes} icon={<ClockIcon className="w-6 h-6" />} colorClass="text-yellow-400" />
                <KPICard title="Lucro/Prejuízo" value={kpiData.lucroRealizado} icon={<CurrencyDollarIcon className="w-6 h-6" />} colorClass={kpiData.lucroRealizado >= 0 ? "text-green-400" : "text-red-400"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="lg:col-span-2 bg-slate-800 p-4 rounded-lg shadow-lg">
                    <h2 className="font-bold mb-4 text-slate-300">Evolução do Faturamento Mensal ({currentYear})</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={monthlyEvolutionData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                            <defs>
                                <linearGradient id="colorCNF" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                                <linearGradient id="colorSNF" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                            </defs>
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(value) => formatCurrency(Number(value))} />
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{fontSize: "12px"}} />
                            <Area type="monotone" dataKey="Faturamento c/ NF" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCNF)" />
                            <Area type="monotone" dataKey="Faturamento s/ NF (Líquido)" stroke="#10b981" fillOpacity={1} fill="url(#colorSNF)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <div className="lg:col-span-1 bg-slate-800 p-4 rounded-lg shadow-lg flex flex-col">
                    <h2 className="font-bold mb-4 text-slate-300">Composição do Faturamento</h2>
                    <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie data={compositionData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5}>
                                {compositionData.map((entry, index) => <Cell key={`cell-${index}`} fill={COMPOSITION_COLORS[index % COMPOSITION_COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Legend iconType="circle" wrapperStyle={{fontSize: "12px"}} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="w-full bg-slate-800 p-4 rounded-lg shadow-lg">
                <h2 className="font-bold mb-4 text-slate-300">Evolução: Faturamento vs. Contas Pagas ({currentYear})</h2>
                 <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={faturamentoVsContasPagasData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(value) => formatCurrency(Number(value))} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{fontSize: "12px"}} />
                        <Bar dataKey="Faturamento" fill="#10b981" />
                        <Bar dataKey="Contas Pagas" fill="#ef4444" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default DashboardGeral;