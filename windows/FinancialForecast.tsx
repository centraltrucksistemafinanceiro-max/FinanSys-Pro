
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
    
    const totalDespesa = monthlyData.reduce((acc, curr) => acc + curr.totalDespesa, 0);
    const totalFaturamento = monthlyData.reduce((acc, curr) => acc + curr.totalFaturamento, 0);
    const saldoTotal = totalFaturamento - totalDespesa;
    
    const TableHeader = ({ title }: { title: string }) => (
        <div className="bg-slate-700 p-2.5 text-center font-bold text-sm rounded-t-md print:bg-slate-50 print:text-black print:border print:border-black uppercase tracking-wider">
            {title}
        </div>
    );

    return (
        <div className="bg-slate-900 text-slate-200 font-sans printable-dashboard">
            <div className="p-4 md:p-8">
                {/* Controles do Sistema - Limpos e sem botões de orientação */}
                <div className="flex flex-wrap items-center justify-between mb-8 gap-4 no-print">
                    <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Análise de Performance</h1>
                    
                    <div className="flex items-center gap-4 flex-wrap bg-slate-800/50 p-2 rounded-xl border border-white/5 shadow-2xl">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase">Período:</span>
                            <input type="month" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="p-2 text-xs rounded bg-slate-700 border border-slate-600 outline-none font-bold" />
                            <span className="text-slate-600 font-bold">»</span>
                            <input type="month" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="p-2 text-xs rounded bg-slate-700 border border-slate-600 outline-none font-bold" />
                        </div>

                        <div className="w-px h-8 bg-slate-700 mx-2 hidden md:block"></div>

                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all text-xs font-black shadow-xl border border-emerald-400/20"
                        >
                            <PrinterIcon className="w-4 h-4" />
                            <span>GERAR PDF</span>
                        </button>
                    </div>
                </div>

                {/* Cabeçalho do PDF */}
                <div className="hidden print:block mb-8 border-b-2 border-black pb-4 text-black">
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter leading-none mb-1">Relatório Consolidado</h1>
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Performance Estratégica & Projeção Financeira</p>
                        </div>
                        <div className="text-right text-[10px] font-bold uppercase leading-tight">
                            <p>Emitido em: {new Date().toLocaleDateString('pt-BR')}</p>
                            <p>Empresa: {companyContext.currentCompany.name}</p>
                        </div>
                    </div>
                </div>

                {/* Área do Gráfico */}
                <section className="bg-slate-800 p-4 rounded-lg shadow-lg mb-8 border border-white/5 print:border-black print:shadow-none chart-container">
                    <h2 className="font-bold mb-6 text-slate-400 print:text-black uppercase text-[10px] tracking-widest border-l-2 border-indigo-500 pl-3">Fluxo de Performance Acumulada (Faturamento vs Despesas)</h2>
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                <defs>
                                    <linearGradient id="colorFat" x1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                                    <linearGradient id="colorDesp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                                </defs>
                                <XAxis 
                                    dataKey="name" 
                                    stroke="#94a3b8" 
                                    fontSize={10} 
                                    interval={0}
                                    tick={{dy: 10}}
                                />
                                <YAxis 
                                    stroke="#94a3b8" 
                                    fontSize={10} 
                                    tickFormatter={(v) => `R$ ${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} 
                                />
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold'}} />
                                <Area type="monotone" name="Faturamento" dataKey="Faturamento" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorFat)" />
                                <Area type="monotone" name="Despesa" dataKey="Despesa" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorDesp)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* Tabelas de Detalhamento - Layout Automático via CSS @media orientation */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 grid-to-stack">
                    <section className="bg-slate-800 rounded-md shadow-lg border border-white/5 print:border-none print:shadow-none">
                        <TableHeader title="Custos Operacionais Mensais" />
                        <table className="w-full">
                            <thead className="bg-slate-700 print:bg-slate-100">
                                <tr>
                                    <th className="text-left">MÊS REFERÊNCIA</th>
                                    <th className="text-right">COM NOTA</th>
                                    <th className="text-right">SEM NOTA</th>
                                    <th className="text-right">TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monthlyData.map((data, index) => (
                                    <tr key={index} className="border-b border-slate-700 print:border-black">
                                        <td className="font-bold uppercase text-[9px]">{data.month}</td>
                                        <td className="text-right">{formatCurrency(data.despesaCom)}</td>
                                        <td className="text-right">{formatCurrency(data.despesaSem)}</td>
                                        <td className="text-right font-black text-red-400 print:text-black">{formatCurrency(data.totalDespesa)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>

                    <section className="bg-slate-800 rounded-md shadow-lg border border-white/5 print:border-none print:shadow-none">
                        <TableHeader title="Receita Operacional Mensal" />
                        <table className="w-full">
                            <thead className="bg-slate-700 print:bg-slate-100">
                                <tr>
                                    <th className="text-left">MÊS REFERÊNCIA</th>
                                    <th className="text-right">COM NOTA</th>
                                    <th className="text-right">SEM NOTA</th>
                                    <th className="text-right">TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monthlyData.map((data, index) => (
                                    <tr key={index} className="border-b border-slate-700 print:border-black">
                                        <td className="font-bold uppercase text-[9px]">{data.month}</td>
                                        <td className="text-right">{formatCurrency(data.faturamentoCom)}</td>
                                        <td className="text-right">{formatCurrency(data.faturamentoSem)}</td>
                                        <td className="text-right font-black text-green-400 print:text-black">{formatCurrency(data.totalFaturamento)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                </div>

                {/* Balanço Geral */}
                <section className="bg-slate-800 rounded-md shadow-xl border border-white/5 print:border-none print:shadow-none">
                    <TableHeader title="Consolidado de Resultado Líquido" />
                    <table className="w-full">
                        <thead className="bg-slate-700 print:bg-slate-100">
                            <tr>
                                <th className="text-left">MÊS</th>
                                <th className="text-right">DESPESAS</th>
                                <th className="text-right">FATURAMENTO</th>
                                <th className="text-right">RESULTADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlyData.map((data, index) => {
                                const totalMes = data.totalFaturamento - data.totalDespesa;
                                return (
                                    <tr key={index} className="border-b border-slate-700 print:border-black">
                                        <td className="font-bold uppercase text-[9px]">{data.month}</td>
                                        <td className="text-right text-red-300 print:text-black">{formatCurrency(data.totalDespesa)}</td>
                                        <td className="text-right text-green-300 print:text-black">{formatCurrency(data.totalFaturamento)}</td>
                                        <td className={`text-right font-black ${totalMes < 0 ? 'text-red-500' : 'text-green-500'} print:text-black`}>
                                            {formatCurrency(totalMes)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </section>

                {/* Resultado Acumulado Final */}
                <div className="mt-8 flex justify-end">
                    <div className="bg-slate-800 p-6 rounded-xl shadow-2xl flex flex-col items-end gap-1 border-t-4 border-indigo-600 print:border-2 print:border-black print:bg-white print:p-4">
                        <span className="font-black text-[9px] text-slate-500 print:text-black uppercase tracking-widest">Resultado Acumulado no Período</span>
                        <span className={`text-4xl font-black ${saldoTotal >= 0 ? 'text-green-400' : 'text-red-400'} print:text-black print:text-2xl`}>
                            {formatCurrency(saldoTotal)}
                        </span>
                    </div>
                </div>

                <div className="hidden print:block mt-12 pt-4 border-t border-black text-center text-[8pt] font-medium text-slate-500 print:text-black">
                    <p className="uppercase tracking-widest font-black mb-1">FinanSys Pro v3.0 — High Performance Financial Management</p>
                    <p>Relatório gerado em: {new Date().toLocaleString('pt-BR')} | Empresa: {companyContext.currentCompany.name}</p>
                </div>
            </div>
        </div>
    );
};

export default FinancialForecast;
