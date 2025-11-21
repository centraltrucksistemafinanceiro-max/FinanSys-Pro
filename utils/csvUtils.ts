export const exportToCSV = <T extends object>(data: T[], filename: string) => {
    if (data.length === 0) {
        alert("Não há dados para exportar.");
        return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','), // header row
        ...data.map(row =>
            headers.map(fieldName => {
                // FIX: Cast 'row' to 'any' to allow dynamic property access using 'fieldName'.
                // This is necessary because TypeScript cannot infer the specific keys of 'T' at this point.
                const value = (row as any)[fieldName];
                if (value === null || value === undefined) {
                    return '';
                }
                const stringValue = String(value);
                // Handle commas and quotes
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            }).join(',')
        )
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};