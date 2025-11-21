

import React, { useContext, useMemo, useState, useEffect } from 'react';
import { BoletoContext } from '../contexts/BoletoContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { CategoryContext } from '../contexts/CategoryContext';
import { CompanyContext } from '../contexts/CompanyContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from 'recharts';
import { Boleto } from '../types';
import { PrinterIcon } from '../components/icons/AppIcons';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const ActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;

  const num_cx = Number(cx) || 0;
  const num_cy = Number(cy) || 0;
  const num_midAngle = Number(midAngle) || 0;
  const num_innerRadius = Number(innerRadius) || 0;
  const num_outerRadius = Number(outerRadius) || 0;
  const num_startAngle = Number(startAngle) || 0;
  const num_endAngle = Number(endAngle) || 0;
  const num_percent = Number(percent) || 0;
  const num_value = Number(value) || 0;

  const sin = Math.sin(-RADIAN * num_midAngle);
  const cos = Math.cos(-RADIAN * num_midAngle);
  const sx = num_cx + (num_outerRadius + 10) * cos;
  const sy = num_cy + (num_outerRadius + 10) * sin;
  const mx = num_cx + (num_outerRadius + 30) * cos;
  const my = num_cy + (num_outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={num_cx} y={num_cy} dy={8} textAnchor="middle" fill={fill} className="font-bold text-lg">
        {payload.name}
      </text>
      <Sector
        cx={num_cx}
        cy={num_cy}
        innerRadius={num_innerRadius}
        outerRadius={num_outerRadius}
        startAngle={num_startAngle}
        endAngle={num_endAngle}
        fill={fill}
      />
      <Sector
        cx={num_cx}
        cy={num_cy}
        startAngle={num_startAngle}
        endAngle={num_endAngle}
        innerRadius={num_outerRadius + 6}
        outerRadius={num_outerRadius + 10}
        fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#999" className="text-sm dark:fill-slate-300 fill-slate-700">{formatCurrency(num_value)}</text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999" className="text-xs dark:fill-slate-400 fill-slate-600">
        {`(${(num_percent * 100).toFixed(2)}%)`}
      </text>
    </g>
  );
};

const BoletoDashboard: React.FC = () => {
  const boletoContext = useContext(BoletoContext);
  const settings = useContext(SettingsContext);
  const categoryContext = useContext(CategoryContext);
  const companyContext = useContext(CompanyContext);

  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const [kpiData, setKpiData] = useState({ totalWithInvoice: 0, totalWithoutInvoice: 0, totalBoletos: 0 });
  const [pieChartData, setPieChartData] = useState<{name: string, value: number}[]>([]);
  const [lastBoletos, setLastBoletos] = useState<Boleto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  if (!boletoContext || !settings || !categoryContext || !companyContext) return null;

  const { categories } = categoryContext;

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        // FIX: The `Company` type has an `id` property, not `companyId`. This corrects the destructuring to get the company ID.
        const { id: companyId } = companyContext.currentCompany;
        const filters = { startDate: dateRange.startDate, endDate: dateRange.endDate, category: selectedCategory };

        const totals = await boletoContext.getTotals({ companyId, filters });
        setKpiData(totals);

        const allBoletos = await boletoContext.queryBoletos({ companyId, filters: { startDate: dateRange.startDate, endDate: dateRange.endDate } });

        // Pie chart should not be filtered by category selection
        const pieBoletos = selectedCategory ? await boletoContext.queryBoletos({ companyId, filters: { startDate: dateRange.startDate, endDate: dateRange.endDate } }) : allBoletos;
        const expenseByCategory = pieBoletos.reduce((acc, b) => {
            const totalAmount = (Number(b.amountWithInvoice) || 0) + (Number(b.amountWithoutInvoice) || 0);
            acc[b.category] = (acc[b.category] || 0) + totalAmount;
            return acc;
        }, {} as Record<string, number>);
        setPieChartData(Object.entries(expenseByCategory).map(([name, value]) => ({ name, value: Number(value) })).sort((a,b) => Number(b.value) - Number(a.value)));

        const boletosForLastList = selectedCategory ? pieBoletos.filter(b => b.category === selectedCategory) : allBoletos;
        setLastBoletos(boletosForLastList.slice(0, 5));

        setIsLoading(false);
    };
    fetchData();
  }, [dateRange, selectedCategory, companyContext.currentCompany.id, boletoContext]);
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
  };
  
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value);
  };

  const selectedCategoryIndex = useMemo(() => {
    if (!selectedCategory) return -1;
    return pieChartData.findIndex(item => item.name === selectedCategory);
  }, [selectedCategory, pieChartData]);

  const onPieEnter = (_: any, index: number) => setActiveIndex(index);
  const onPieLeave = () => setActiveIndex(-1);
  const finalActiveIndex = selectedCategoryIndex !== -1 ? selectedCategoryIndex : activeIndex;
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c', '#8dd1e1', '#83a6ed'];

  return (
    <div className="p-4 bg-slate-100 dark:bg-slate-900 h-full overflow-y-auto text-slate-800 dark:text-slate-200 printable-dashboard">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Dashboard de Boletos</h1>
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
        <div>
            <label htmlFor="category" className="block text-sm font-medium text-slate-500 dark:text-slate-400">Categoria</label>
            <select
                id="category"
                name="category"
                value={selectedCategory}
                onChange={handleCategoryChange}
                className="mt-1 p-2 w-full rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none"
                style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties}
            >
                <option value="">Todas as Categorias</option>
                {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
            </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-cyan-100 dark:bg-cyan-900/50 border border-cyan-300 dark:border-cyan-700">
          <h2 className="text-sm font-medium text-cyan-800 dark:text-cyan-200">Total c/ Nota</h2>
          <p className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{formatCurrency(kpiData.totalWithInvoice)}</p>
        </div>
        <div className="p-4 rounded-lg bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700">
          <h2 className="text-sm font-medium text-amber-800 dark:text-amber-200">Total s/ Nota</h2>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(kpiData.totalWithoutInvoice)}</p>
        </div>
        <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700">
          <h2 className="text-sm font-medium text-red-800 dark:text-red-200">Total Geral</h2>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">{formatCurrency(kpiData.totalBoletos)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="p-4 rounded-lg bg-white dark:bg-slate-800 shadow-md h-[350px]">
          <h3 className="font-semibold mb-4">Despesas por Categoria</h3>
          {pieChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  {...({
                    activeIndex: finalActiveIndex,
                    activeShape: ActiveShape,
                    data: pieChartData,
                    cx: "50%",
                    cy: "50%",
                    innerRadius: 60,
                    outerRadius: 80,
                    fill: settings.accentColor,
                    dataKey: "value",
                    onMouseEnter: onPieEnter,
                    onMouseLeave: onPieLeave,
                  } as any)}
                >
                  {pieChartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-full"><p className="text-center text-slate-500">Sem dados para exibir.</p></div>}
        </div>
        <div className="p-4 rounded-lg bg-white dark:bg-slate-800 shadow-md h-[350px]">
            <h3 className="font-semibold mb-4">Últimos Boletos Lançados</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-700">
                    <tr>
                        <th className="px-4 py-2">Data</th>
                        <th className="px-4 py-2">Descrição</th>
                        <th className="px-4 py-2 text-right">Valor Total</th>
                    </tr>
                    </thead>
                    <tbody>
                    {lastBoletos.map((b: Boleto) => (
                        <tr key={b.id} className="border-b border-slate-200 dark:border-slate-700">
                        <td className="px-4 py-2">{new Date(b.date).toLocaleDateString()}</td>
                        <td className="px-4 py-2">{b.description}</td>
                        <td className="px-4 py-2 text-right font-medium text-red-500">
                            {formatCurrency(Number(b.amountWithInvoice) + Number(b.amountWithoutInvoice))}
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                {lastBoletos.length === 0 && <p className="text-center p-5 text-slate-500">Nenhum boleto recente.</p>}
            </div>
        </div>
      </div>
    </div>
  );
};

export default BoletoDashboard;