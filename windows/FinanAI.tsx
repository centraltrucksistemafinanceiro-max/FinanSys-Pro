
import React, { useState, useContext, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { SettingsContext } from '../contexts/SettingsContext';
import { TransactionContext } from '../contexts/TransactionContext';
import { BoletoContext } from '../contexts/BoletoContext';
import { CompanyContext } from '../contexts/CompanyContext';
import { SparklesIcon } from '../components/icons/AppIcons';
import { formatCurrency } from '../utils/formatters';

const FinanAI: React.FC = () => {
  const settings = useContext(SettingsContext);
  const transactionContext = useContext(TransactionContext);
  const boletoContext = useContext(BoletoContext);
  const companyContext = useContext(CompanyContext);

  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([
    { role: 'ai', content: 'Olá! Sou seu consultor FinanSys Pro. Como posso ajudar com sua saúde financeira hoje?' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isTyping || !transactionContext || !boletoContext || !companyContext) return;

    const userMsg = prompt;
    setPrompt('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const companyId = companyContext.currentCompany.id;
      const [totals, boletos] = await Promise.all([
        transactionContext.getTotals({ companyId }),
        boletoContext.queryBoletos({ companyId })
      ]);

      const overdueCount = boletos.filter(b => b.status === 'Vencido').length;
      const contextString = `
        Contexto Financeiro Atual da Empresa ${companyContext.currentCompany.name}:
        - Saldo em Caixa: ${formatCurrency(totals.balance)}
        - Total Entradas: ${formatCurrency(totals.totalIncome)}
        - Total Saídas: ${formatCurrency(totals.totalExpenses)}
        - Boletos Vencidos: ${overdueCount}
      `;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${contextString}\nPergunta do Usuário: ${userMsg}`,
        config: {
          systemInstruction: "Você é um especialista financeiro de elite integrado ao sistema FinanSys Pro. Responda de forma executiva, precisa e baseada nos dados fornecidos. Use Markdown para formatar tabelas ou listas. Seja direto e estratégico.",
          temperature: 0.7,
        },
      });

      const aiContent = response.text || "Desculpe, não consegui processar essa análise agora.";
      setMessages(prev => [...prev, { role: 'ai', content: aiContent }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'ai', content: "Ocorreu um erro ao conectar com meu núcleo de processamento. Verifique sua conexão." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 font-sans">
      <div className="flex-shrink-0 p-4 border-b border-white/10 bg-slate-800/50 backdrop-blur-md flex items-center gap-3">
        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
          <SparklesIcon className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-bold text-lg">FinanAI v3.0</h2>
          <p className="text-xs text-slate-400">Inteligência Financeira em Tempo Real</p>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg' 
                : 'bg-slate-800 border border-white/5 rounded-tl-none text-slate-200 shadow-xl'
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-white/5 flex gap-1">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="flex-shrink-0 p-4 bg-slate-800/30 border-t border-white/10">
        <form onSubmit={handleAsk} className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: Qual minha situação de caixa atual?"
            className="flex-grow bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={isTyping}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 px-6 py-2 rounded-xl font-bold transition-colors flex items-center gap-2"
          >
            Analisar
          </button>
        </form>
      </div>
    </div>
  );
};

export default FinanAI;
