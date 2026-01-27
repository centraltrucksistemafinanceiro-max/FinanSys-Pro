
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
  <div className="bg-slate-800 p-4 rounded-lg shadow-lg flex flex-col justify-between border border-white/5 hover:border-white/10 transition-colors">
    <div className="flex items-center justify-between text-slate-400">
      <p className="text-sm font-medium">{title}</p>
      {icon}
    </div>
    <div>
      <p className={`text-2xl font-bold ${colorClass}`}>
        {isCurrency ? formatCurrency(value) : value}
      </p>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-700 p-3 rounded-md border border-slate-600 text-sm shadow-2xl">
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

    const years = useMemo(() => {
        const startYear = 2020;
        const yearsList = [];
        for (let y = today.getFullYear() + 1; y >= startYear; y--) {
            yearsList.push(y);
        }
        return yearsList;
    }, []);

    const handleYearChange = (year: number) => {
        setCurrentYear(year);
        setStartDate(`${year}-01-01`);
        setEndDate(`${year}-12-31`);
    };

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
                transactionContext.getTotals({ companyId, filters })
            ]);

            const totalFaturamentoComNota = faturamentosPeriodo.reduce((acc, f) => acc + (Number(f.valor) || 0), 0);
            const totalFaturamentoSemNota = faturamentosSNPeriodo.reduce((acc, f) => acc + (Number(f.valor) || 0), 0);
            const faturamentoTotal = totalFaturamentoComNota + totalFaturamentoSemNota;
            
            const todayString = new Date().toISOString().split('T')[0];
            const contasPagas = boletosPeriodo.filter(b => b.status === BoletoStatus.PAID).reduce((acc, b) => acc + (Number(b.amountWithInvoice) || 0) + (Number(b.amountWithoutInvoice) || 0), 0);
            const contasVencidas = boletosPeriodo.filter(b => b.status !== BoletoStatus.PAID && b.date < todayString).reduce((acc, b) => acc + (Number(b.amountWithInvoice) || 0) + (Number(b.amountWithoutInvoice) || 0), 0);
            const contasPendentes = boletosPeriodo.filter(b => b.status === BoletoStatus.OPEN && b.date >= todayString).reduce((acc, b) => acc + (Number(b.amountWithInvoice) || 0) + (Number(b.amountWithoutInvoice) || 0), 0);
            const lucroRealizado = faturamentoTotal - contasPagas;
            
            setKpiData({ faturamentoTotal, balancoCaixa: totalsCaixa.balance, contasPagas, contasVencidas, contasPendentes, lucroRealizado });
            setCompositionData([
                { name: 'Faturamento C/ NF', value: totalFaturamentoComNota }, 
                { name: 'Faturamento S/ NF', value: totalFaturamentoSemNota }
            ]);

            const getMonthIdx = (dateStr: string) => parseInt(dateStr.split('-')[1], 10) - 1;

            const monthlyEvo = Array.from({ length: 12 }, (_, i) => ({ name: getMonthShortName(i), 'Faturamento c/ NF': 0, 'Faturamento s/ NF': 0 }));
            faturamentosAno.forEach(f => {
                const m = getMonthIdx(f.data);
                if (m >= 0 && m < 12) monthlyEvo[m]['Faturamento c/ NF'] += (Number(f.valor) || 0);
            });
            faturamentosSNAno.forEach(f => {
                const m = getMonthIdx(f.data);
                if (m >= 0 && m < 12) monthlyEvo[m]['Faturamento s/ NF'] += (Number(f.valor) || 0);
            });
            setMonthlyEvolutionData(monthlyEvo);
            
            const fatVsContas = Array.from({ length: 12 }, (_, i) => ({ name: getMonthShortName(i), 'Faturamento': 0, 'Contas Pagas': 0 }));
            faturamentosAno.forEach(f => {
                const m = getMonthIdx(f.data);
                if (m >= 0 && m < 12) fatVsContas[m]['Faturamento'] += (Number(f.valor) || 0);
            });
            faturamentosSNAno.forEach(f => {
                const m = getMonthIdx(f.data);
                if (m >= 0 && m < 12) fatVsContas[m]['Faturamento'] += (Number(f.valor) || 0);
            });
            boletosAno.forEach(b => {
                if (b.status === BoletoStatus.PAID && b.paymentDate) {
                    const m = getMonthIdx(b.paymentDate);
                    const totalAmount = (Number(b.amountWithInvoice) || 0) + (Number(b.amountWithoutInvoice) || 0);
                    if (m >= 0 && m < 12) fatVsContas[m]['Contas Pagas'] += totalAmount;
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
        const { name, value } = e.target;
        if (name === 'startDate') {
            setStartDate(value);
            if (value) {
                const year = parseInt(value.split('-')[0], 10);
                if (!isNaN(year)) setCurrentYear(year);
            }
        } else if (name === 'endDate') {
            setEndDate(value);
        }
    };

    const COMPOSITION_COLORS = ['#3b82f6', '#10b981'];

    return (
        <div className="p-4 bg-slate-900 h-full overflow-y-auto text-slate-200 font-sans printable-dashboard custom-scrollbar">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                 <h1 className="text-2xl font-bold tracking-tight">FinanSys <span className="text-indigo-400">Pro v3.0</span></h1>
                  <div className="flex items-center gap-4 no-print flex-wrap">
                    <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-lg border border-white/5">
                        <div className="flex items-center gap-2 mr-2">
                            <label className="text-[10px] font-black text-indigo-400 uppercase">Ano:</label>
                            <select 
                                value={currentYear} 
                                onChange={(e) => handleYearChange(Number(e.target.value))}
                                className="p-1 px-2 text-xs font-bold rounded bg-slate-700 border border-slate-600 outline-none text-white hover:border-indigo-500 transition-colors"
                            >
                                {years.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-px h-4 bg-slate-700 mx-1 hidden sm:block"></div>
                        <button onClick={() => setDateFilter('month')} className="px-3 py-1.5 text-xs font-semibold hover:bg-slate-700 rounded-md transition-colors uppercase tracking-wider">Mês Atual</button>
                        <button onClick={() => setDateFilter('year')} className="px-3 py-1.5 text-xs font-semibold hover:bg-slate-700 rounded-md transition-colors uppercase tracking-wider">Ano Atual</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="date" name="startDate" value={startDate} onChange={handleDateInputChange} className="p-2 text-xs rounded bg-slate-800 border border-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none" />
                        <span className="text-slate-500 text-xs">até</span>
                        <input type="date" name="endDate" value={endDate} onChange={handleDateInputChange} className="p-2 text-xs rounded bg-slate-800 border border-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none" />
                    </div>
                    <button onClick={() => window.print()} className="p-2 bg-slate-800 rounded-md shadow-sm hover:bg-slate-700 border border-white/5 transition-colors" title="Imprimir"><PrinterIcon className="w-5 h-5 text-slate-300" /></button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <KPICard title="Faturamento Total" value={kpiData.faturamentoTotal} icon={<ArrowTrendingUpIcon className="w-6 h-6" />} colorClass="text-green-400" />
                <KPICard title="Balanço do Caixa" value={kpiData.balancoCaixa} icon={<ScaleIcon className="w-6 h-6" />} colorClass={kpiData.balancoCaixa >= 0 ? 'text-blue-400' : 'text-red-400'} />
                <KPICard title="Total Contas Pagas" value={kpiData.contasPagas} icon={<CurrencyDollarIcon className="w-6 h-6" />} colorClass="text-cyan-400" />
                <KPICard title="Contas Vencidas" value={kpiData.contasVencidas} icon={<ClockIcon className="w-6 h-6" />} colorClass="text-red-500" />
                <KPICard title="Contas Pendentes" value={kpiData.contasPendentes} icon={<ClockIcon className="w-6 h-6" />} colorClass="text-yellow-400" />
                <KPICard title="Lucro/Prejuízo" value={kpiData.lucroRealizado} icon={<CurrencyDollarIcon className="w-6 h-6" />} colorClass={kpiData.lucroRealizado >= 0 ? "text-green-400" : "text-red-400"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="lg:col-span-2 bg-slate-800/80 p-4 rounded-xl border border-white/5 shadow-2xl">
                    <h2 className="font-bold mb-4 text-slate-300 uppercase text-xs tracking-widest border-l-2 border-indigo-500 pl-2">Evolução Mensal ({currentYear})</h2>
                    <ResponsiveContainer width="100%" height={300} minWidth={0}>
                        <AreaChart data={monthlyEvolutionData} margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                            <defs>
                                <linearGradient id="colorCNF" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                                <linearGradient id="colorSNF" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                            </defs>
                            <XAxis dataKey="name" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                            <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(Number(value))} />
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{fontSize: "10px", textTransform: "uppercase", paddingTop: "15px"}} verticalAlign="top" align="right" />
                            <Area type="monotone" dataKey="Faturamento c/ NF" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCNF)" />
                            <Area type="monotone" dataKey="Faturamento s/ NF" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSNF)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <div className="lg:col-span-1 bg-slate-800/80 p-4 rounded-xl border border-white/5 shadow-2xl flex flex-col">
                    <h2 className="font-bold mb-4 text-slate-300 uppercase text-xs tracking-widest border-l-2 border-indigo-500 pl-2">Composição</h2>
                    <div className="flex-grow flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={250} minWidth={0}>
                             <PieChart>
                                <Pie 
                                    data={compositionData} 
                                    dataKey="value" 
                                    nameKey="name" 
                                    cx="50%" 
                                    cy="50%" 
                                    innerRadius={60} 
                                    outerRadius={80} 
                                    paddingAngle={5}
                                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                                >
                                    {compositionData.map((entry, index) => <Cell key={`cell-${index}`} fill={COMPOSITION_COLORS[index % COMPOSITION_COLORS.length]} stroke="none" />)}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend iconType="circle" wrapperStyle={{fontSize: "10px", textTransform: "uppercase"}} verticalAlign="bottom" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="w-full bg-slate-800/80 p-4 rounded-xl border border-white/5 shadow-2xl mb-4">
                <h2 className="font-bold mb-4 text-slate-300 uppercase text-xs tracking-widest border-l-2 border-indigo-500 pl-2">Performance Global ({currentYear})</h2>
                 <ResponsiveContainer width="100%" height={280} minWidth={0}>
                    <BarChart data={faturamentoVsContasPagasData} margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(Number(value))} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{fontSize: "10px", textTransform: "uppercase", paddingTop: "15px"}} verticalAlign="top" align="right" />
                        <Bar dataKey="Faturamento" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Contas Pagas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default DashboardGeral;