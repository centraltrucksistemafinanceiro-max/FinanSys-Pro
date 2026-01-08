
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
        <div className="bg-slate-700 p-2 text-center font-bold text-lg rounded-t-md print:bg-slate-100 print:text-black print:border print:border-b-1 print:border-slate-300">
            {title}
        </div>
    );

    return (
        <div className="bg-slate-900 text-slate-200 font-sans printable-dashboard overflow-visible">
            <div className="p-4 md:p-6 lg:p-8">
                <div className="flex flex-wrap items-center justify-between mb-6 gap-4 no-print">
                    <h1 className="text-2xl font-bold text-white">Resumo Financeiro</h1>
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-400">De:</label>
                            <input 
                                type="month" 
                                value={rangeStart} 
                                onChange={(e) => setRangeStart(e.target.value)} 
                                className="p-2 text-sm rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:border-transparent focus:outline-none text-white"
                                style={{'--tw-ring-color': settings.accentColor} as React.CSSProperties}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-400">Até:</label>
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
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors text-sm font-bold shadow-md border border-slate-600"
                        >
                            <PrinterIcon className="w-5 h-5" />
                            <span>Exportar PDF</span>
                        </button>
                    </div>
                </div>

                <div className="hidden print:block mb-8 border-b-4 border-indigo-500 pb-4">
                    <h1 className="text-3xl font-bold text-black uppercase tracking-tight">Relatório Consolidado de Projeção Financeira</h1>
                    <div className="mt-4 grid grid-cols-2 text-sm text-slate-600">
                        <p><strong>PERÍODO:</strong> {rangeStart} até {rangeEnd}</p>
                        <p><strong>EMPRESA:</strong> {companyContext.currentCompany.name}</p>
                        <p><strong>DATA DE EMISSÃO:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>

                <section className="bg-slate-800 p-4 rounded-lg shadow-lg mb-8 border border-slate-700/50 print:border print:border-slate-200 print:shadow-none print:break-inside-avoid">
                    <h2 className="font-bold mb-4 text-slate-300 print:text-black uppercase text-xs tracking-widest border-l-4 border-indigo-500 pl-2">Gráfico de Performance (Faturamento vs Despesa)</h2>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 30, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                                    <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(value) => formatCurrency(Number(value))} />
                                <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="top" height={36}/>
                                <Area type="monotone" name="Faturamento Total" dataKey="Faturamento" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorFaturamento)" />
                                <Area type="monotone" name="Despesa Total" dataKey="Despesa" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorDespesa)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 print:block">
                    <section className="bg-slate-800 rounded-md shadow-lg border border-slate-700/50 print:border print:border-slate-200 print:shadow-none print:mb-8 print:break-inside-avoid">
                        <TableHeader title="DESPESAS DETALHADAS POR MÊS" />
                        <table className="w-full text-sm">
                            <thead className="bg-slate-700/50 print:bg-slate-50">
                                <tr>
                                    <th className="px-4 py-2 text-left">MÊS</th>
                                    <th className="px-4 py-2 text-right">COM NF</th>
                                    <th className="px-4 py-2 text-right">SEM NF</th>
                                    <th className="px-4 py-2 text-right">SUBTOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monthlyData.map((data, index) => (
                                    <tr key={index} className="border-b border-slate-700 print:border-slate-200">
                                        <td className="px-4 py-2 font-semibold">{data.month}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(data.despesaCom)}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(data.despesaSem)}</td>
                                        <td className="px-4 py-2 text-right font-bold text-red-400">{formatCurrency(data.totalDespesa)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="print:bg-slate-50">
                                <tr className="bg-slate-700/50 font-bold border-t-2 border-slate-600 print:border-slate-300">
                                    <td className="px-4 py-2 text-left uppercase">Total Acumulado</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(totalDespesaCom)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(totalDespesaSem)}</td>
                                    <td className="px-4 py-2 text-right text-red-500">{formatCurrency(totalDespesa)}</td>
                                </tr>
                                <tr className="bg-slate-700/30 text-xs text-slate-400 print:text-slate-600">
                                    <td className="px-4 py-2 text-left uppercase">Média Mensal</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(mediaDespesaCom)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(mediaDespesaSem)}</td>
                                    <td className="px-4 py-2 text-right font-bold">{formatCurrency(mediaDespesaTotal)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </section>

                    <section className="bg-slate-800 rounded-md shadow-lg border border-slate-700/50 print:border print:border-slate-200 print:shadow-none print:break-inside-avoid">
                        <TableHeader title="FATURAMENTO DETALHADO POR MÊS" />
                        <table className="w-full text-sm">
                            <thead className="bg-slate-700/50 print:bg-slate-50">
                                <tr>
                                    <th className="px-4 py-2 text-left">MÊS</th>
                                    <th className="px-4 py-2 text-right">COM NF</th>
                                    <th className="px-4 py-2 text-right">SEM NF</th>
                                    <th className="px-4 py-2 text-right">SUBTOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monthlyData.map((data, index) => (
                                    <tr key={index} className="border-b border-slate-700 print:border-slate-200">
                                        <td className="px-4 py-2 font-semibold">{data.month}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(data.faturamentoCom)}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(data.faturamentoSem)}</td>
                                        <td className="px-4 py-2 text-right font-bold text-green-400">{formatCurrency(data.totalFaturamento)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="print:bg-slate-50">
                                <tr className="bg-slate-700/50 font-bold border-t-2 border-slate-600 print:border-slate-300">
                                    <td className="px-4 py-2 text-left uppercase">Total Acumulado</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(totalFaturamentoCom)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(totalFaturamentoSem)}</td>
                                    <td className="px-4 py-2 text-right text-green-500">{formatCurrency(totalFaturamento)}</td>
                                </tr>
                                 <tr className="bg-slate-700/30 text-xs text-slate-400 print:text-slate-600">
                                    <td className="px-4 py-2 text-left uppercase">Média Mensal</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(mediaFaturamentoCom)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(mediaFaturamentoSem)}</td>
                                    <td className="px-4 py-2 text-right font-bold">{formatCurrency(mediaFaturamentoTotal)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </section>
                </div>
                
                <section className="mt-8 bg-slate-800 rounded-md shadow-lg border border-slate-700/50 print:border print:border-slate-200 print:shadow-none print:break-inside-avoid">
                     <TableHeader title="CONSOLIDADO GERAL DE OFICINA" />
                     <table className="w-full text-sm">
                        <thead className="bg-slate-700/50 print:bg-slate-50">
                            <tr>
                                <th className="px-4 py-2 text-left">MÊS DE REFERÊNCIA</th>
                                <th className="px-4 py-2 text-right">TOTAL DAS DESPESAS</th>
                                <th className="px-4 py-2 text-right">TOTAL DOS FATURAMENTOS</th>
                                <th className="px-4 py-2 text-right">SALDO LÍQUIDO MENSAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlyData.map((data, index) => {
                                const totalMes = data.totalFaturamento - data.totalDespesa;
                                return (
                                    <tr key={index} className="border-b border-slate-700 print:border-slate-200">
                                        <td className="px-4 py-2 font-semibold uppercase">{data.month}</td>
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
                </section>

                <div className="mt-8 flex justify-end print:mt-12">
                    <div className="bg-slate-800 p-6 rounded-md shadow-xl flex flex-col items-end gap-2 border border-slate-700/50 print:border-2 print:border-indigo-600 print:bg-white print:shadow-none">
                        <span className="font-bold text-xs text-slate-400 print:text-indigo-600 uppercase tracking-widest">Saldo Geral Acumulado no Período Selecionado</span>
                        <span className={`text-4xl font-black ${saldoTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(saldoTotal)}
                        </span>
                    </div>
                </div>
                
                <div className="hidden print:block mt-16 pt-8 border-t border-slate-200 text-center text-xs text-slate-400">
                    <p className="font-bold text-slate-600 uppercase">FinanSys Pro v3.0 — Sistema de Gestão Estratégica</p>
                    <p>Relatório gerado em {new Date().toLocaleString('pt-BR')} por {companyContext.currentCompany.name}</p>
                </div>
            </div>
        </div>
    );
};

export default FinancialForecast;
