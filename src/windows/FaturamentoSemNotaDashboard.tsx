
import React, { useContext, useMemo, useState, useEffect } from 'react';
import { FaturamentoSemNotaContext } from '../contexts/FaturamentoSemNotaContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { CompanyContext } from '../contexts/CompanyContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { FaturamentoSemNota } from '../types';
import { PrinterIcon } from '../components/icons/AppIcons';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const FaturamentoSemNotaDashboard: React.FC = () => {
  const faturamentoContext = useContext(FaturamentoSemNotaContext);
  const settings = useContext(SettingsContext);
  const companyContext = useContext(CompanyContext);
  
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [kpiData, setKpiData] = useState({ totalFaturamento: 0, totalOutros: 0, saldo: 0 });
  const [pieChartData, setPieChartData] = useState<{name: string, value: number}[]>([]);
  const [lastFaturamentos, setLastFaturamentos] = useState<FaturamentoSemNota[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  if (!faturamentoContext || !settings || !companyContext) return null;

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        // FIX: The `Company` type has an `id` property, not `companyId`. This corrects the destructuring to get the company ID.
        const { id: companyId } = companyContext.currentCompany;
        const filters = { startDate: dateRange.startDate, endDate: dateRange.endDate };
        
        const totals = await faturamentoContext.getTotals({ companyId, filters });
        setKpiData(totals);
        
        const faturamentos = await faturamentoContext.queryFaturamentos({ companyId, filters });
        
        const expenseByCategory = faturamentos
            .filter(f => f.valor < 0)
            .reduce((acc, f) => {
                const amount = Math.abs(Number(f.valor) || 0);
                acc[f.categoria] = (acc[f.categoria] || 0) + amount;
                return acc;
            }, {} as Record<string, number>);
        setPieChartData(Object.entries(expenseByCategory)
            .map(([name, value]) => ({ name, value: value as number }))
            .sort((a, b) => Number(b.value) - Number(a.value)));

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

  const COLORS = ['#FF8042', '#FFBB28', '#00C49F', '#0088FE', '#8884d8', '#82ca9d' ];

  return (
    <div className="p-4 bg-slate-100 dark:bg-slate-900 h-full overflow-y-auto text-slate-800 dark:text-slate-200 printable-dashboard">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Dashboard de Faturamento S/ Nota</h1>
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
          <h2 className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Total Faturamento</h2>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(kpiData.totalFaturamento)}</p>
        </div>
        <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700">
          <h2 className="text-sm font-medium text-red-800 dark:text-red-200">Total Outros</h2>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">{formatCurrency(kpiData.totalOutros)}</p>
        </div>
        <div className="p-4 rounded-lg bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700">
          <h2 className="text-sm font-medium text-blue-800 dark:text-blue-200">Saldo</h2>
          <p className={`text-3xl font-bold ${kpiData.saldo >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(kpiData.saldo)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="p-4 rounded-lg bg-white dark:bg-slate-800 shadow-md h-[350px]">
          <h3 className="font-semibold mb-4">Detalhamento de "Outros"</h3>
          {pieChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill={settings.accentColor}
                  dataKey="value"
                  nameKey="name"
                >
                  {pieChartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-full"><p className="text-center text-slate-500">Sem dados de saídas para exibir.</p></div>}
        </div>
        <div className="p-4 rounded-lg bg-white dark:bg-slate-800 shadow-md h-[350px]">
            <h3 className="font-semibold mb-4">Últimos Lançamentos</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-700">
                    <tr>
                        <th className="px-4 py-2">Data</th>
                        <th className="px-4 py-2">Categoria</th>
                        <th className="px-4 py-2 text-right">Valor</th>
                    </tr>
                    </thead>
                    <tbody>
                    {lastFaturamentos.map((f: FaturamentoSemNota) => (
                        <tr key={f.id} className="border-b border-slate-200 dark:border-slate-700">
                        <td className="px-4 py-2">{new Date(f.data).toLocaleDateString()}</td>
                        <td className="px-4 py-2">{f.categoria}</td>
                        <td className={`px-4 py-2 text-right font-medium ${f.valor > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {formatCurrency(Math.abs(Number(f.valor)))}
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                {lastFaturamentos.length === 0 && <p className="text-center p-5 text-slate-500">Nenhum lançamento recente.</p>}
            </div>
        </div>
      </div>
    </div>
  );
};

export default FaturamentoSemNotaDashboard;
