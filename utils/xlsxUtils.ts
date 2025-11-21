const escapeXml = (unsafe: any): string => {
    const str = String(unsafe);
    return str.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};

export const exportToXLSX = <T extends object>(data: T[], filename: string) => {
    if (data.length === 0) {
        alert("Não há dados para exportar.");
        return;
    }

    const headers = Object.keys(data[0]);

    const headerRow = `<Row>${headers.map(header => `<Cell ss:StyleID="s62"><Data ss:Type="String">${escapeXml(String(header))}</Data></Cell>`).join('')}</Row>`;

    const dataRows = data.map(row => {
        const cells = headers.map(fieldName => {
            const value = (row as any)[fieldName];
            const type = typeof value === 'number' ? 'Number' : 'String';
            const cellValue = value === null || value === undefined ? '' : value;
            return `<Cell><Data ss:Type="${type}">${escapeXml(String(cellValue))}</Data></Cell>`;
        }).join('');
        return `<Row>${cells}</Row>`;
    }).join('');

    const template = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:html="http://www.w3.org/TR/REC-html40">
    <Styles>
        <Style ss:ID="Default" ss:Name="Normal">
            <Alignment ss:Vertical="Bottom"/>
            <Borders/>
            <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
            <Interior/>
            <NumberFormat/>
            <Protection/>
        </Style>
        <Style ss:ID="s62">
            <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
        </Style>
    </Styles>
    <Worksheet ss:Name="Dados">
        <Table>
            ${headerRow}
            ${dataRows}
        </Table>
    </Worksheet>
</Workbook>
    `;

    const blob = new Blob([template], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Ensure filename ends with .xls to match the XML Spreadsheet 2003 format.
    const baseFilename = filename.replace(/\.(xlsx|xls|xml)$/i, '');
    link.download = `${baseFilename}.xls`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};