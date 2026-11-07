export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | undefined | null;
}

function escapeCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(','));
  return [head, ...body].join('\r\n');
}

export function downloadFile(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([mime.startsWith('text/csv') ? '\ufeff' + content : content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCSV<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  downloadFile(filename.endsWith('.csv') ? filename : `${filename}.csv`, toCSV(rows, columns), 'text/csv;charset=utf-8');
}
