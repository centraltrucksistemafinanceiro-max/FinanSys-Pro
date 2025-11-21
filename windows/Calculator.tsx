import React, { useState, useContext, useCallback } from 'react';
import { SettingsContext } from '../contexts/SettingsContext';
import { WindowManagerContext } from '../contexts/WindowManagerContext';

type TVMField = 'n' | 'i_y' | 'pv' | 'pmt' | 'fv';

const formatNumber = (num: number | string | null | undefined) => {
    if (num === null || num === undefined || num === '') return '';
    const number = Number(num);
    if (isNaN(number) || !isFinite(number)) return 'Error';
    
    // Limit display length to avoid overflow
    const numStr = String(number);
    if (numStr.length > 15) {
        return number.toExponential(9);
    }
    
    return number.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
};


const Calculator: React.FC = () => {
    const settings = useContext(SettingsContext);
    const winManager = useContext(WindowManagerContext);

    // General Calculator State
    const [display, setDisplay] = useState('0');
    const [previousValue, setPreviousValue] = useState<number | null>(null);
    const [operator, setOperator] = useState<string | null>(null);
    const [isEntering, setIsEntering] = useState(false); // Corresponds to original `isEntering`

    // TVM State
    const [tvm, setTvm] = useState({ n: '', i_y: '', pv: '', pmt: '', fv: '' });
    const [periodsPerYear, setPeriodsPerYear] = useState('12');
    const [computeMode, setComputeMode] = useState(false);
    const [lastComputed, setLastComputed] = useState<TVMField | null>(null);

    const accentColor = settings?.accentColor || '#3b82f6';
    
    const performCalculation = (val1: number, val2: number, op: string): number => {
        switch (op) {
            case '+': return val1 + val2;
            case '-': return val1 - val2;
            case '×': return val1 * val2;
            case '÷': return val1 / val2;
            default: return val2;
        }
    };

    const clearAll = useCallback(() => {
        setDisplay('0');
        setPreviousValue(null);
        setOperator(null);
        setIsEntering(false);
        setTvm({ n: '', i_y: '', pv: '', pmt: '', fv: '' });
        setComputeMode(false);
        setLastComputed(null);
    }, []);

    const clearEntry = () => {
        setDisplay('0');
        setIsEntering(false);
    };
    
    const handleDigit = (digit: string) => {
        if (computeMode) setComputeMode(false);
        if (!isEntering) {
            setDisplay(digit);
            setIsEntering(true);
        } else {
            if (display.length >= 15) return;
            setDisplay(display === '0' ? digit : display + digit);
        }
    };

    const handleDecimal = () => {
        if (!isEntering) {
            setDisplay('0.');
            setIsEntering(true);
        } else if (!display.includes('.')) {
            setDisplay(display + '.');
        }
    };
    
    const handleSign = () => {
        if (display !== '0') {
            setDisplay(prev => (prev.startsWith('-') ? prev.substring(1) : '-' + prev));
        }
    };
    
    const handleOperator = (nextOperator: string) => {
        const inputValue = parseFloat(display);

        if (operator && previousValue !== null && isEntering) {
            const result = performCalculation(previousValue, inputValue, operator);
            setDisplay(String(result));
            setPreviousValue(result);
        } else {
            setPreviousValue(inputValue);
        }
        
        setIsEntering(false);
        setOperator(nextOperator);
    };
    
    const handleEquals = () => {
        if (operator && previousValue !== null) {
            const inputValue = parseFloat(display);
            const result = performCalculation(previousValue, inputValue, operator);
            setDisplay(String(result));
            setPreviousValue(null);
            setOperator(null);
            setIsEntering(false);
        }
    };

    const handlePercent = () => {
        const currentValue = parseFloat(display);
        setDisplay(String(currentValue / 100));
        setIsEntering(false);
    };

    const resetGeneralCalcState = () => {
        setPreviousValue(null);
        setOperator(null);
        setIsEntering(false);
    };
    
    const handleSetTvm = (field: TVMField) => {
        resetGeneralCalcState();
        if (computeMode) {
            handleComputeTvm(field);
            return;
        }
        const value = display;
        setTvm(prev => ({ ...prev, [field]: value }));
        setIsEntering(false);
    };

    const handleComputeTvm = (field: TVMField) => {
        resetGeneralCalcState();
        const values = {
            n: parseFloat(tvm.n) || 0,
            i_y: parseFloat(tvm.i_y) || 0,
            pv: parseFloat(tvm.pv) || 0,
            pmt: parseFloat(tvm.pmt) || 0,
            fv: parseFloat(tvm.fv) || 0,
            p_y: parseInt(periodsPerYear, 10) || 12,
        };
        
        const i = (values.i_y / 100) / values.p_y;
        let result = 0;

        try {
            switch (field) {
                case 'n':
                    if (i === 0) result = -(values.pv + values.fv) / values.pmt;
                    else result = Math.log((-values.fv * i + values.pmt) / (values.pv * i + values.pmt)) / Math.log(1 + i);
                    break;
                case 'pv':
                    if (i === 0) result = -(values.fv + values.pmt * values.n);
                    else {
                        const factor = Math.pow(1 + i, values.n);
                        result = -(values.fv + values.pmt * (factor - 1) / i) / factor;
                    }
                    break;
                case 'pmt':
                     if (i === 0) result = -(values.fv + values.pv) / values.n;
                     else {
                         const factor = Math.pow(1 + i, values.n);
                         result = -(values.fv + values.pv * factor) / ((factor - 1) / i);
                     }
                    break;
                case 'fv':
                    if (i === 0) result = -(values.pv + values.pmt * values.n);
                    else {
                        const factor = Math.pow(1 + i, values.n);
                        result = -(values.pv * factor + values.pmt * (factor - 1) / i);
                    }
                    break;
                case 'i_y':
                    winManager?.addNotification({ title: 'Aviso', message: 'Cálculo de I/Y não implementado.', type: 'info' });
                    setComputeMode(false);
                    return;
            }

            if (!isFinite(result)) {
                throw new Error("Cálculo inválido");
            }

            const resultStr = String(parseFloat(result.toFixed(6)));
            setTvm(prev => ({...prev, [field]: resultStr }));
            setDisplay(resultStr);
            setLastComputed(field);

        } catch (error) {
            setDisplay('Error');
            winManager?.addNotification({ title: 'Erro de Cálculo', message: 'Verifique os valores de entrada.', type: 'error'});
        }
        
        setIsEntering(false);
        setComputeMode(false);
    };

    const TVMButton = ({ field, label }: { field: TVMField, label: string }) => (
        <div className="flex items-center">
            <button
                onClick={() => handleSetTvm(field)}
                className="w-full h-10 text-center font-semibold rounded-md transition-colors text-slate-800 dark:text-slate-100 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600"
            >
                {label}
            </button>
            <div className={`w-full h-10 ml-2 p-2 text-right rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 truncate ${lastComputed === field ? 'border-2' : ''}`} style={{ borderColor: lastComputed === field ? accentColor : undefined }}>
                {formatNumber(tvm[field])}
            </div>
        </div>
    );
    
    const NumPadButton = ({ label, handler, className = '' }: {label: string, handler: () => void, className?: string}) => (
         <button
            onClick={handler}
            className={`p-2 text-xl rounded-md transition-colors text-slate-800 dark:text-slate-100 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 ${className}`}
          >
            {label}
          </button>
    );

    return (
        <div className="flex flex-col h-full bg-slate-200 dark:bg-slate-900 p-2 font-mono">
            <div className="flex-shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-3xl font-semibold text-right p-4 rounded-t-lg break-all relative">
                {formatNumber(display)}
                 {computeMode && <span className="absolute top-1 left-2 text-xs font-sans" style={{color: accentColor}}>CPT</span>}
            </div>

            <div className="flex-shrink-0 space-y-1 py-2">
                <TVMButton field="n" label="N" />
                <TVMButton field="i_y" label="I/Y" />
                <TVMButton field="pv" label="PV" />
                <TVMButton field="pmt" label="PMT" />
                <TVMButton field="fv" label="FV" />
            </div>

            <div className="flex-grow grid grid-cols-5 grid-rows-4 gap-1">
                <button onClick={() => setComputeMode(true)} className="p-2 text-xl font-semibold rounded-md transition-colors text-white" style={{backgroundColor: accentColor}}>CPT</button>
                <NumPadButton label="C" handler={clearAll} />
                <div className="flex items-center text-sm font-sans px-2 bg-slate-300 dark:bg-slate-700 rounded-md">
                    <label htmlFor="py" className="mr-2">P/Y</label>
                    <input id="py" type="number" value={periodsPerYear} onChange={e => setPeriodsPerYear(e.target.value)} className="w-full bg-white dark:bg-slate-800 rounded p-1 text-center" />
                </div>
                <NumPadButton label="CE" handler={clearEntry} className="col-span-2" />
                
                <NumPadButton label="7" handler={() => handleDigit('7')} />
                <NumPadButton label="8" handler={() => handleDigit('8')} />
                <NumPadButton label="9" handler={() => handleDigit('9')} />
                <NumPadButton label="÷" handler={() => handleOperator('÷')} className="bg-slate-300 dark:bg-slate-600" />
                <NumPadButton label="%" handler={handlePercent} className="bg-slate-300 dark:bg-slate-600" />
                
                <NumPadButton label="4" handler={() => handleDigit('4')} />
                <NumPadButton label="5" handler={() => handleDigit('5')} />
                <NumPadButton label="6" handler={() => handleDigit('6')} />
                <NumPadButton label="×" handler={() => handleOperator('×')} className="bg-slate-300 dark:bg-slate-600" />
                <NumPadButton label="+/-" handler={handleSign} className="bg-slate-300 dark:bg-slate-600" />
                
                <NumPadButton label="1" handler={() => handleDigit('1')} />
                <NumPadButton label="2" handler={() => handleDigit('2')} />
                <NumPadButton label="3" handler={() => handleDigit('3')} />
                <NumPadButton label="-" handler={() => handleOperator('-')} className="bg-slate-300 dark:bg-slate-600" />
                <NumPadButton label="+" handler={() => handleOperator('+')} className="row-span-2 bg-slate-300 dark:bg-slate-600" />
                
                <NumPadButton label="0" handler={() => handleDigit('0')} className="col-span-2" />
                <NumPadButton label="." handler={handleDecimal} />
                <NumPadButton label="=" handler={handleEquals} className="bg-slate-300 dark:bg-slate-600" />
            </div>
        </div>
    );
};

export default Calculator;