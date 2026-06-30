const escapeCsv = (value) => {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
};

const stripHtml = (value) => String(value ?? '').replace(/[<>&]/g, (char) => ({
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
}[char]));

const pdfEscape = (value) => String(value ?? '').replace(/[\\()]/g, '\\$&').replaceAll('\r', ' ').replaceAll('\n', ' ');

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function makeExportRows(rows, columns) {
  return (rows || []).map((row) =>
    columns.reduce((acc, column) => {
      acc[column.header] = typeof column.value === 'function' ? column.value(row) : row?.[column.key];
      return acc;
    }, {}),
  );
}

export function exportRows({ rows, columns, filename = 'export', format = 'csv', title = 'Export' }) {
  const safeRows = makeExportRows(rows, columns);
  const headers = columns.map((column) => column.header);
  const baseName = filename.replace(/\.(csv|xls|xlsx|pdf)$/i, '');

  if (format === 'excel' || format === 'xlsx') {
    const tableRows = [
      `<tr>${headers.map((header) => `<th>${stripHtml(header)}</th>`).join('')}</tr>`,
      ...safeRows.map((row) => `<tr>${headers.map((header) => `<td>${stripHtml(row[header])}</td>`).join('')}</tr>`),
    ].join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table>${tableRows}</table></body></html>`;
    downloadBlob(`${baseName}.xls`, new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }));
    return;
  }

  if (format === 'pdf') {
    const lines = [title, '', headers.join(' | '), ...safeRows.map((row) => headers.map((header) => row[header]).join(' | '))];
    const content = lines.slice(0, 48).map((line, index) => `BT /F1 10 Tf 40 ${780 - index * 15} Td (${pdfEscape(line).slice(0, 110)}) Tj ET`).join('\n');
    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
      '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      `5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
    ];
    let offset = '%PDF-1.4\n'.length;
    const xref = ['0000000000 65535 f '];
    const body = objects.map((object) => {
      xref.push(String(offset).padStart(10, '0') + ' 00000 n ');
      offset += object.length + 1;
      return object;
    }).join('\n');
    const trailer = `xref\n0 ${xref.length}\n${xref.join('\n')}\ntrailer << /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`;
    downloadBlob(`${baseName}.pdf`, new Blob([`%PDF-1.4\n${body}\n${trailer}`], { type: 'application/pdf' }));
    return;
  }

  const csv = [
    headers.map(escapeCsv).join(','),
    ...safeRows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
  ].join('\n');
  downloadBlob(`${baseName}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}
