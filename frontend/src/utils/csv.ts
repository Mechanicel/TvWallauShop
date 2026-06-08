/** Export tabular data as a semicolon-separated CSV download (Excel/DE friendly, UTF-8 BOM). */
export function exportRowsToCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
   const escape = (v: string | number | null | undefined) => {
      const s = String(v ?? '');
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
   };
   const csv = [headers, ...rows].map((row) => row.map(escape).join(';')).join('\n');
   const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = filename;
   a.click();
   URL.revokeObjectURL(url);
}
