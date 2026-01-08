
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { BoletoContext } from '../contexts/BoletoContext';
import { FaturamentoContext } from '../contexts/FaturamentoContext';
import { FaturamentoSemNotaContext } from '../contexts/FaturamentoSemNotaContext';
import { CompanyContext } from '../contexts/CompanyContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PrinterIcon } from '../components/icons/AppIcons';
import { formatCurrency } from '../utils/formatters';

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


const FinancialForecast: React.FC = () => {
    const boletoContext = useContext(BoletoContext);
    const faturamentoContext = useContext(FaturamentoContext);
    const faturamentoSemNotaContext = useContext(FaturamentoSemNotaContext);
    const companyContext = useContext(CompanyContext);
    const settings = useContext(SettingsContext);

    const currentYear = new Date().getFullYear();
    const [rangeStart, setRangeStart] = useState(`${currentYear}-01`);
    const [rangeEnd, setRangeEnd] = useState(`${currentYear}-12`);
    const [monthlyData, setMonthlyData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    if (!boletoContext || !faturamentoContext || !faturamentoSemNotaContext || !settings || !companyContext) return null;

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            
            const { id: companyId } = companyContext.currentCompany;
            
            const [boletos, faturamentos, faturamentosSN] = await Promise.all([
                boletoContext.queryBoletos({ companyId }),
                faturamentoContext.queryFaturamentos({ companyId }),
                faturamentoSemNotaContext.queryFaturamentos({ companyId }),
            ]);

            const monthsList = [];
            const [startYear, startMonth] = rangeStart.split('-').map(Number);
            const [endYear, endMonth] = rangeEnd.split('-').map(Number);
            const start = new Date(startYear, startMonth - 1, 1);
            const end = new Date(endYear, endMonth - 1, 1);
            
            if (start <= end) {
                let curr = new Date(start);
                while (curr <= end) {
                    monthsList.push({
                        label: curr.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase(),
                        shortLabel: curr.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase().replace('.',''),
                        month: curr.getMonth(),
                        year: curr.getFullYear()
                    });
                    curr.setMonth(curr.getMonth() + 1);
                }
            }

            const newMonthlyData = monthsList.map(m => {
                const isMatch = (dateStr: string) => {
                    if (!dateStr) return false;
                    const [y, mon] = dateStr.split('-').map(Number);
                    return y === m.year && (mon - 1) === m.month;
                };

                const despesaCom = boletos.filter(b => isMatch(b.date)).reduce((sum, b) => sum + (Number(b.amountWithInvoice) || 0), 0);
                const despesaSem = boletos.filter(b => isMatch(b.date)).reduce((sum, b) => sum + (Number(b.amountWithoutInvoice) || 0), 0);
                const faturamentoCom = faturamentos.filter(f => isMatch(f.data)).reduce((sum, f) => sum + (Number(f.valor) || 0), 0);
                const faturamentoSem = faturamentosSN.filter(f => isMatch(f.data)).reduce((sum, f) => sum + (Number(f.valor) || 0), 0);

                return {
                    month: m.label, shortMonth: m.shortLabel,
                    despesaCom, despesaSem, faturamentoCom, faturamentoSem,
                    totalDespesa: despesaCom + despesaSem,
                    totalFaturamento: faturamentoCom + faturamentoSem
                };
            });

            setMonthlyData(newMonthlyData);
            setIsLoading(false);
        };
        fetchData();
    }, [rangeStart, rangeEnd, companyContext.currentCompany.id]);

    const chartData = useMemo(() => {
        return monthlyData.map(data => ({
            name: data.shortMonth,
            Faturamento: data.totalFaturamento,
            Despesa: data.totalDespesa,
        }));
    }, [monthlyData]);
    
    const totalDespesaCom = monthlyData.reduce((acc, curr) => acc + curr.despesaCom, 0);
    const totalDespesaSem = monthlyData.reduce((acc, curr) => acc + curr.despesaSem, 0);
    const totalDespesa = totalDespesaCom + totalDespesaSem;
    const mediaDespesaCom = monthlyData.length > 0 ? totalDespesaCom / monthlyData.length : 0;
    const mediaDespesaSem = monthlyData.length > 0 ? totalDespesaSem / monthlyData.length : 0;
    const mediaDespesaTotal = monthlyData.length > 0 ? totalDespesa / monthlyData.length : 0;

    const totalFaturamentoCom = monthlyData.reduce((acc, curr) => acc + curr.faturamentoCom, 0);
    const totalFaturamentoSem = monthlyData.reduce((acc, curr) => acc + curr.faturamentoSem, 0);
    const totalFaturamento = totalFaturamentoCom + totalFaturamentoSem;
    const mediaFaturamentoCom = monthlyData.length > 0 ? totalFaturamentoCom / monthlyData.length : 0;
    const mediaFaturamentoSem = monthlyData.length > 0 ? totalFaturamentoSem / monthlyData.length : 0;
    const mediaFaturamentoTotal = monthlyData.length > 0 ? totalFaturamento / monthlyData.length : 0;
    
    const saldoTotal = totalFaturamento - totalDespesa;
    
    const TableHeader = ({ title }: { title: string }) => (
        <div className="bg-slate-700 p-2 text-center font-bold text-lg rounded-t-md">
            {title}
        </div>
    );

    return (
        <div className="p-4 bg-slate-900 h-full overflow-y-auto text-slate-200 font-sans printable-dashboard">
            <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
                <h1 className="text-2xl font-bold">Resumo Financeiro</h1>
                <div className="flex items-center gap-4 no-print flex-wrap">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">De:</label>
                        <input 
                            type="month" 
                            value={rangeStart} 
                            onChange={(e) => setRangeStart(e.target.value)} 
                            className="p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none text-white"
                            style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Até:</label>
                        <input 
                            type="month" 
                            value={rangeEnd} 
                            onChange={(e) => setRangeEnd(e.target.value)} 
                            className="p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none text-white"
                            style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties}
                        />
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors text-sm font-bold shadow-md"
                        title="Exportar Relatório como PDF"
                    >
                        <PrinterIcon className="w-5 h-5" />
                        <span className="hidden sm:inline">Exportar PDF</span>
                    </button>
                </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg shadow-lg mb-6">
                <h2 className="font-bold mb-4 text-slate-300">Projeção Faturamento vs. Despesa</h2>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                        <defs>
                            <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                            <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                        </defs>
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(value) => formatCurrency(Number(value))} />
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{fontSize: "12px"}} />
                        <Area type="monotone" dataKey="Faturamento" stroke="#10b981" fillOpacity={1} fill="url(#colorFaturamento)" />
                        <Area type="monotone" dataKey="Despesa" stroke="#ef4444" fillOpacity={1} fill="url(#colorDespesa)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>


            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800 rounded-md shadow-lg">
                    <TableHeader title="DESPESA OFICINA" />
                    <table className="w-full text-sm">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th className="px-4 py-2 text-left">MÊS</th>
                                <th className="px-4 py-2 text-right">COM</th>
                                <th className="px-4 py-2 text-right">SEM</th>
                                <th className="px-4 py-2 text-right">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlyData.map((data, index) => (
                                <tr key={index} className="border-b border-slate-700">
                                    <td className="px-4 py-2 font-semibold">{data.month}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(data.despesaCom)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(data.despesaSem)}</td>
                                    <td className="px-4 py-2 text-right font-bold">{formatCurrency(data.totalDespesa)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-700/50 font-bold">
                                <td className="px-4 py-2 text-left">TOTAL</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(totalDespesaCom)}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(totalDespesaSem)}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(totalDespesa)}</td>
                            </tr>
                            <tr className="bg-slate-700/50 font-bold">
                                <td className="px-4 py-2 text-left">MÉDIA</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(mediaDespesaCom)}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(mediaDespesaSem)}</td>
                                <td className="px-4 py-2 text-right text-red-400">{formatCurrency(mediaDespesaTotal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="bg-slate-800 rounded-md shadow-lg">
                    <TableHeader title="FATURAMENTO OFICINA" />
                    <table className="w-full text-sm">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th className="px-4 py-2 text-left">MÊS</th>
                                <th className="px-4 py-2 text-right">COM</th>
                                <th className="px-4 py-2 text-right">SEM</th>
                                <th className="px-4 py-2 text-right">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlyData.map((data, index) => (
                                <tr key={index} className="border-b border-slate-700">
                                    <td className="px-4 py-2 font-semibold">{data.month}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(data.faturamentoCom)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(data.faturamentoSem)}</td>
                                    <td className="px-4 py-2 text-right font-bold">{formatCurrency(data.totalFaturamento)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-700/50 font-bold">
                                <td className="px-4 py-2 text-left">TOTAL</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(totalFaturamentoCom)}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(totalFaturamentoSem)}</td>
                                <td className="px-4 py-2 text-right text-green-400">{formatCurrency(totalFaturamento)}</td>
                            </tr>
                             <tr className="bg-slate-700/50 font-bold">
                                <td className="px-4 py-2 text-left">MÉDIA</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(mediaFaturamentoCom)}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(mediaFaturamentoSem)}</td>
                                <td className="px-4 py-2 text-right text-green-400">{formatCurrency(mediaFaturamentoTotal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            
            <div className="mt-6 bg-slate-800 rounded-md shadow-lg">
                 <TableHeader title="OFICINA" />
                 <table className="w-full text-sm">
                    <thead className="bg-slate-700/50">
                        <tr>
                            <th className="px-4 py-2 text-left">MÊS</th>
                            <th className="px-4 py-2 text-right">TOTAL DESPESA</th>
                            <th className="px-4 py-2 text-right">TOTAL FATURAMENTO</th>
                            <th className="px-4 py-2 text-right">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {monthlyData.map((data, index) => {
                            const totalMes = data.totalFaturamento - data.totalDespesa;
                            return (
                                <tr key={index} className="border-b border-slate-700">
                                    <td className="px-4 py-2 font-semibold">{data.month}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(data.totalDespesa)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(data.totalFaturamento)}</td>
                                    <td className={`px-4 py-2 text-right font-bold ${totalMes < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {formatCurrency(totalMes)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                 </table>
            </div>

            <div className="mt-6 flex justify-end">
                <div className="bg-slate-800 p-4 rounded-md shadow-lg flex items-center gap-4">
                    <span className="font-bold text-lg">SALDO</span>
                    <span className={`text-2xl font-bold ${saldoTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(saldoTotal)}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default FinancialForecast;
