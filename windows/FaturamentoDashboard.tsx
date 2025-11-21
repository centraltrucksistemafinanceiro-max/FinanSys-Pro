
import React, { useContext, useMemo, useState, useEffect } from 'react';
import { FaturamentoContext } from '../contexts/FaturamentoContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { CompanyContext } from '../contexts/CompanyContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Faturamento } from '../types';
import { PrinterIcon } from '../components/icons/AppIcons';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const FaturamentoDashboard: React.FC = () => {
  const faturamentoContext = useContext(FaturamentoContext);
  const settings = useContext(SettingsContext);
  const companyContext = useContext(CompanyContext);
  
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [kpiData, setKpiData] = useState({ totalFaturado: 0, totalClients: 0, averageInvoice: 0 });
  const [monthlyData, setMonthlyData] = useState<{name: string, Faturamento: number}[]>([]);
  const [lastFaturamentos, setLastFaturamentos] = useState<Faturamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  if (!faturamentoContext || !settings || !companyContext) return null;

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        const { id: companyId } = companyContext.currentCompany;
        const filters = { startDate: dateRange.startDate, endDate: dateRange.endDate };
        
        const faturamentos = await faturamentoContext.queryFaturamentos({ companyId, filters });
        
        const total = faturamentos.reduce((acc, f) => acc + (Number(f.valor) || 0), 0);
        const clients = new Set(faturamentos.map(f => f.cliente));
        const avg = faturamentos.length > 0 ? total / faturamentos.length : 0;
        setKpiData({ totalFaturado: total, totalClients: clients.size, averageInvoice: avg });
        
        const monthly = new Array(12).fill(0).map((_, i) => ({
            name: new Date(0, i).toLocaleString('pt-BR', { month: 'short' }),
            Faturamento: 0,
        }));
        faturamentos.forEach(f => {
            const date = new Date(f.data);
            if (!isNaN(date.getTime())) {
                const month = date.getMonth();
                monthly[month].Faturamento += Number(f.valor) || 0;
            }
        });
        setMonthlyData(monthly);
        
        faturamentos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
        setLastFaturamentos(faturamentos.slice(0, 5));

        setIsLoading(false);
    };
    fetchData();
  }, [dateRange, companyContext.currentCompany.id, faturamentoContext]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="p-4 bg-slate-100 dark:bg-slate-900 h-full overflow-y-auto text-slate-800 dark:text-slate-200 printable-dashboard">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Dashboard de Faturamento</h1>
        <button 
            onClick={() => window.print()} 
            className="p-2 bg-white dark:bg-slate-800 rounded-md shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors no-print"
            title="Imprimir"
        >
            <PrinterIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </button>
      </div>

      <div className="flex flex-wrap gap-4 mb-4 items-end bg-white dark:bg-slate-800 p-3 rounded-lg shadow-md">
        <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-slate-500 dark:text-slate-400">Data Inicial</label>
            <input type="date" name="startDate" value={dateRange.startDate} onChange={handleDateChange} className="mt-1 p-2 w-full rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
        </div>
        <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-slate-500 dark:text-slate-400">Data Final</label>
            <input type="date" name="endDate" value={dateRange.endDate} onChange={handleDateChange} className="mt-1 p-2 w-full rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none" style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700">
          <h2 className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Total Faturado</h2>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(kpiData.totalFaturado)}</p>
        </div>
        <div className="p-4 rounded-lg bg-sky-100 dark:bg-sky-900/50 border border-sky-300 dark:border-sky-700">
          <h2 className="text-sm font-medium text-sky-800 dark:text-sky-200">Total de Clientes</h2>
          <p className="text-3xl font-bold text-sky-600 dark:text-sky-400">{kpiData.totalClients}</p>
        </div>
        <div className="p-4 rounded-lg bg-violet-100 dark:bg-violet-900/50 border border-violet-300 dark:border-violet-700">
          <h2 className="text-sm font-medium text-violet-800 dark:text-violet-200">Média por Nota</h2>
          <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">{formatCurrency(kpiData.averageInvoice)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="p-4 rounded-lg bg-white dark:bg-slate-800 shadow-md">
          <h3 className="font-semibold mb-4">Faturamento Mensal</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <XAxis dataKey="name" stroke={settings.theme === 'dark' ? '#94a3b8' : '#64748b'} />
              <YAxis stroke={settings.theme === 'dark' ? '#94a3b8' : '#64748b'} tickFormatter={formatCurrency} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }}
              />
              <Legend />
              <Bar dataKey="Faturamento" fill={settings.accentColor} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="p-4 rounded-lg bg-white dark:bg-slate-800 shadow-md">
          <h3 className="font-semibold mb-4">Últimos Faturamentos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">Cliente</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {lastFaturamentos.map((f: Faturamento) => (
                  <tr key={f.id} className="border-b border-slate-200 dark:border-slate-700">
                    <td className="px-4 py-2">{new Date(f.data).toLocaleDateString()}</td>
                    <td className="px-4 py-2 truncate">{f.cliente}</td>
                    <td className="px-4 py-2 text-right font-medium text-emerald-500">
                      {formatCurrency(f.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lastFaturamentos.length === 0 && <p className="text-center p-5 text-slate-500">Nenhum faturamento recente.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaturamentoDashboard;