
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
    const mediaDespesaTotal = monthlyData.length > 0 ? totalDespesa / monthlyData.length : 0;

    const totalFaturamentoCom = monthlyData.reduce((acc, curr) => acc + curr.faturamentoCom, 0);
    const totalFaturamentoSem = monthlyData.reduce((acc, curr) => acc + curr.faturamentoSem, 0);
    const totalFaturamento = totalFaturamentoCom + totalFaturamentoSem;
    const mediaFaturamentoTotal = monthlyData.length > 0 ? totalFaturamento / monthlyData.length : 0;
    
    const saldoTotal = totalFaturamento - totalDespesa;
    
    const TableHeader = ({ title }: { title: string }) => (
        <div className="bg-slate-700 p-3 text-center font-bold text-lg rounded-t-md print:bg-slate-100 print:text-black print:border-t print:border-x print:border-black">
            {title}
        </div>
    );

    return (
        <div className="bg-slate-900 text-slate-200 font-sans printable-dashboard">
            <div className="p-4 md:p-8">
                <div className="flex flex-wrap items-center justify-between mb-8 gap-4 no-print">
                    <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Projeção Financeira</h1>
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Período:</label>
                            <input type="month" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="p-2 text-sm rounded bg-slate-700 border border-slate-600 outline-none" />
                            <span className="text-slate-500">até</span>
                            <input type="month" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="p-2 text-sm rounded bg-slate-700 border border-slate-600 outline-none" />
                        </div>
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-md transition-all text-sm font-black shadow-xl"
                        >
                            <PrinterIcon className="w-5 h-5" />
                            <span>EXPORTAR RELATÓRIO PDF</span>
                        </button>
                    </div>
                </div>

                <div className="hidden print:block mb-10 border-b-4 border-black pb-4 text-black">
                    <h1 className="text-4xl font-black uppercase tracking-tighter">Relatório Estratégico de Performance</h1>
                    <div className="mt-4 grid grid-cols-2 text-sm">
                        <p><strong>CLIENTE/EMPRESA:</strong> {companyContext.currentCompany.name}</p>
                        <p className="text-right"><strong>PERÍODO ANALISADO:</strong> {rangeStart} a {rangeEnd}</p>
                        <p><strong>GERADO POR:</strong> FinanSys Pro v3.0</p>
                        <p className="text-right"><strong>DATA DE EMISSÃO:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>

                <section className="bg-slate-800 p-4 rounded-lg shadow-lg mb-10 border border-white/10 print:border-black print:shadow-none chart-container">
                    <h2 className="font-bold mb-6 text-slate-300 print:text-black uppercase text-xs tracking-widest border-l-4 border-indigo-500 pl-3">Evolução do Fluxo de Caixa</h2>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="99%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                                    <linearGradient id="colorDesp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} interval={0} />
                                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `R$ ${v/1000}k`} width={60} />
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="top" height={40}/>
                                <Area type="monotone" name="Faturamento" dataKey="Faturamento" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorFat)" isAnimationActive={false} />
                                <Area type="monotone" name="Despesa" dataKey="Despesa" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorDesp)" isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 print:block">
                    <section className="bg-slate-800 rounded-md shadow-lg border border-white/5 print:border-none print:shadow-none print:mb-10">
                        <TableHeader title="DESPESAS OPERACIONAIS" />
                        <table className="w-full text-sm">
                            <thead className="bg-slate-700 print:bg-slate-200">
                                <tr>
                                    <th className="px-4 py-2 text-left">MÊS</th>
                                    <th className="px-4 py-2 text-right">COM NOTA</th>
                                    <th className="px-4 py-2 text-right">SEM NOTA</th>
                                    <th className="px-4 py-2 text-right">TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monthlyData.map((data, index) => (
                                    <tr key={index} className="border-b border-slate-700 print:border-black">
                                        <td className="px-4 py-2 font-semibold">{data.month}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(data.despesaCom)}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(data.despesaSem)}</td>
                                        <td className="px-4 py-2 text-right font-bold text-red-400 print:text-black">{formatCurrency(data.totalDespesa)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-700/50 print:bg-slate-100 font-bold">
                                <tr className="border-t-2 border-slate-500 print:border-black">
                                    <td className="px-4 py-2">TOTAL ACUMULADO</td>
                                    <td className="px-4 py-2 text-right" colSpan={3}>{formatCurrency(totalDespesa)}</td>
                                </tr>
                                <tr className="text-xs text-slate-400 print:text-black">
                                    <td className="px-4 py-1">MÉDIA MENSAL</td>
                                    <td className="px-4 py-1 text-right" colSpan={3}>{formatCurrency(mediaDespesaTotal)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </section>

                    <section className="bg-slate-800 rounded-md shadow-lg border border-white/5 print:border-none print:shadow-none">
                        <TableHeader title="FATURAMENTO OPERACIONAL" />
                        <table className="w-full text-sm">
                            <thead className="bg-slate-700 print:bg-slate-200">
                                <tr>
                                    <th className="px-4 py-2 text-left">MÊS</th>
                                    <th className="px-4 py-2 text-right">COM NOTA</th>
                                    <th className="px-4 py-2 text-right">SEM NOTA</th>
                                    <th className="px-4 py-2 text-right">TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monthlyData.map((data, index) => (
                                    <tr key={index} className="border-b border-slate-700 print:border-black">
                                        <td className="px-4 py-2 font-semibold">{data.month}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(data.faturamentoCom)}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(data.faturamentoSem)}</td>
                                        <td className="px-4 py-2 text-right font-bold text-green-400 print:text-black">{formatCurrency(data.totalFaturamento)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-700/50 print:bg-slate-100 font-bold">
                                <tr className="border-t-2 border-slate-500 print:border-black">
                                    <td className="px-4 py-2">TOTAL ACUMULADO</td>
                                    <td className="px-4 py-2 text-right" colSpan={3}>{formatCurrency(totalFaturamento)}</td>
                                </tr>
                                <tr className="text-xs text-slate-400 print:text-black">
                                    <td className="px-4 py-1">MÉDIA MENSAL</td>
                                    <td className="px-4 py-1 text-right" colSpan={3}>{formatCurrency(mediaFaturamentoTotal)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </section>
                </div>

                <section className="mt-10 bg-slate-800 rounded-md shadow-xl border border-white/5 print:border-none print:shadow-none">
                    <TableHeader title="CONSOLIDADO GERAL DE RESULTADOS" />
                    <table className="w-full text-sm">
                        <thead className="bg-slate-700 print:bg-slate-200">
                            <tr>
                                <th className="px-4 py-2 text-left">MÊS DE REFERÊNCIA</th>
                                <th className="px-4 py-2 text-right">TOTAL DESPESAS</th>
                                <th className="px-4 py-2 text-right">TOTAL FATURAMENTO</th>
                                <th className="px-4 py-2 text-right">SALDO LÍQUIDO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlyData.map((data, index) => {
                                const totalMes = data.totalFaturamento - data.totalDespesa;
                                return (
                                    <tr key={index} className="border-b border-slate-700 print:border-black">
                                        <td className="px-4 py-2 font-semibold uppercase">{data.month}</td>
                                        <td className="px-4 py-2 text-right text-red-300 print:text-black">{formatCurrency(data.totalDespesa)}</td>
                                        <td className="px-4 py-2 text-right text-green-300 print:text-black">{formatCurrency(data.totalFaturamento)}</td>
                                        <td className={`px-4 py-2 text-right font-black ${totalMes < 0 ? 'text-red-500' : 'text-green-500'} print:text-black`}>
                                            {formatCurrency(totalMes)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </section>

                <div className="mt-10 flex justify-end print:mt-20">
                    <div className="bg-slate-800 p-8 rounded-xl shadow-2xl flex flex-col items-end gap-2 border-2 border-indigo-500 print:border-black print:bg-white print:p-4">
                        <span className="font-bold text-xs text-slate-400 print:text-black uppercase tracking-widest">Saldo Acumulado no Período</span>
                        <span className={`text-5xl font-black ${saldoTotal >= 0 ? 'text-green-400' : 'text-red-400'} print:text-black print:text-3xl`}>
                            {formatCurrency(saldoTotal)}
                        </span>
                    </div>
                </div>

                <div className="hidden print:block mt-24 pt-8 border-t border-black text-center text-[10pt]">
                    <p className="font-bold">FinanSys Pro v3.0 — Sistema Inteligente de Gestão Financeira</p>
                    <p>Relatório emitido em {new Date().toLocaleString('pt-BR')} sob a responsabilidade de {companyContext.currentCompany.name}</p>
                </div>
            </div>
        </div>
    );
};

export default FinancialForecast;