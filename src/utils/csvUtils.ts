/**
 * CSV utility functions for safe and proper CSV export
 */

/**
 * Escapes a value for use in a CSV file.
 * Handles:
 * - Quotes (escaped by doubling them)
 * - Commas (wrap in quotes)
 * - Newlines (wrap in quotes)
 * - CSV injection (escape leading formula characters)
 *
 * @param value - The value to escape (string, number, null, or undefined)
 * @returns Properly escaped CSV value
 */
export function escapeCsvValue(value: string | number | null | undefined): string {
  // Handle null/undefined
  if (value == null) {
    return '';
  }

  // Convert to string
  const strValue = String(value);

  // Empty string case
  if (strValue === '') {
    return '';
  }

  // Check for CSV injection attempts (leading =, +, -, @, tab, carriage return)
  // These can trigger formula execution in Excel/Google Sheets
  const dangerousChars = /^[=+\-@\t\r]/;
  let sanitizedValue = strValue;

  if (dangerousChars.test(sanitizedValue)) {
    // Prepend with single quote to prevent formula execution
    sanitizedValue = "'" + sanitizedValue;
  }

  // Check if value needs to be quoted (contains comma, quote, or newline)
  const needsQuoting = /[",\n\r]/.test(sanitizedValue);

  if (needsQuoting) {
    // Escape internal quotes by doubling them
    const escapedValue = sanitizedValue.replace(/"/g, '""');
    // Wrap in quotes
    return `"${escapedValue}"`;
  }

  return sanitizedValue;
}

/**
 * Converts an array of objects to CSV format
 *
 * @param data - Array of objects to convert
 * @param headers - Array of header labels (in desired order)
 * @param keys - Array of object keys corresponding to headers
 * @returns CSV string
 */
export function arrayToCSV<T extends Record<string, any>>(
  data: T[],
  headers: string[],
  keys: (keyof T)[]
): string {
  if (headers.length !== keys.length) {
    throw new Error('Headers and keys arrays must have the same length');
  }

  // Build header row
  const headerRow = headers.map(escapeCsvValue).join(',');

  // Build data rows
  const dataRows = data.map((item) =>
    keys.map((key) => escapeCsvValue(item[key])).join(',')
  );

  // Combine header and data rows
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Triggers a CSV file download in the browser
 *
 * @param csvContent - The CSV content string
 * @param filename - The filename (without extension)
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Ensure filename has .csv extension
  const csvFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

  // Create blob with BOM for proper Excel UTF-8 handling
  const BOM = '\ufeff';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = csvFilename;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
