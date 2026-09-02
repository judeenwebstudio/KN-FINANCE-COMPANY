export const MAX_EXPORT_ROWS = 5000;

export function escapeCSVCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function generateCSVResponse(headers: string[], rows: (string | number | boolean | null | undefined)[][], filename: string): {
  csvContent: string;
  filename: string;
  error?: string;
} {
  if (rows.length > MAX_EXPORT_ROWS) {
    return {
      csvContent: "",
      filename,
      error: `Export exceeds maximum allowed size of ${MAX_EXPORT_ROWS} rows. Please apply narrower filters.`,
    };
  }

  const csvRows = [
    headers.map(escapeCSVCell).join(","),
    ...rows.map((row) => row.map(escapeCSVCell).join(",")),
  ];

  return {
    csvContent: csvRows.join("\n"),
    filename: filename.endsWith(".csv") ? filename : `${filename}.csv`,
  };
}
