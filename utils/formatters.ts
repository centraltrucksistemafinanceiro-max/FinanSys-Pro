export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const formatDateForDisplay = (dateString: string) => {
  if (!dateString || !dateString.includes('-')) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

export const parseCurrency = (value: string): number => {
    if (!value || value.trim() === '-') return 0;
    const cleaned = value.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
    const number = parseFloat(cleaned);
    return isNaN(number) ? 0 : number;
};

export const parseDateFromBr = (dateStr: string): string | null => {
    if (!dateStr) return null;
    const trimmedDate = dateStr.trim();
    const ddMMyyyy = trimmedDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddMMyyyy) {
        return `${ddMMyyyy[3]}-${ddMMyyyy[2]}-${ddMMyyyy[1]}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
        return trimmedDate;
    }
    return null;
};