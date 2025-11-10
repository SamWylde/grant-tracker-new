/**
 * CSV Parser Utility
 * Handles parsing CSV files for grant import/migration
 */

export interface CSVRow {
  [key: string]: string;
}

export interface ParseResult {
  headers: string[];
  rows: CSVRow[];
  errors: string[];
}

/**
 * Parse CSV file content into structured data
 */
export function parseCSV(content: string): ParseResult {
  const errors: string[] = [];
  const lines = content.split(/\r?\n/).filter(line => line.trim());

  if (lines.length === 0) {
    return { headers: [], rows: [], errors: ['CSV file is empty'] };
  }

  // Parse headers
  const headers = parseCSVLine(lines[0]);

  if (headers.length === 0) {
    return { headers: [], rows: [], errors: ['No headers found in CSV'] };
  }

  // Parse rows
  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    // Skip empty rows
    if (values.every(v => !v.trim())) {
      continue;
    }

    // Warn if column count doesn't match headers
    if (values.length !== headers.length) {
      errors.push(`Row ${i + 1}: Expected ${headers.length} columns, found ${values.length}`);
    }

    const row: CSVRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return { headers, rows, errors };
}

/**
 * Parse a single CSV line, handling quoted values with commas
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of value
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last value
  values.push(current.trim());

  return values;
}

/**
 * Export grants to CSV format
 */
export function exportToCSV(
  headers: string[],
  rows: Array<Record<string, any>>
): string {
  const csvLines: string[] = [];

  // Add headers
  csvLines.push(headers.map(escapeCSVValue).join(','));

  // Add rows
  rows.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      return escapeCSVValue(value != null ? String(value) : '');
    });
    csvLines.push(values.join(','));
  });

  return csvLines.join('\n');
}

/**
 * Escape a value for CSV (wrap in quotes if contains comma, quote, or newline)
 */
function escapeCSVValue(value: string): string {
  if (!value) return '';

  // Escape quotes by doubling them
  const escaped = value.replace(/"/g, '""');

  // Wrap in quotes if contains comma, quote, or newline
  if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
    return `"${escaped}"`;
  }

  return escaped;
}

/**
 * Detect delimiter (comma, semicolon, tab, or pipe)
 */
export function detectDelimiter(content: string): string {
  const firstLine = content.split(/\r?\n/)[0];
  const delimiters = [',', ';', '\t', '|'];

  let maxCount = 0;
  let detectedDelimiter = ',';

  delimiters.forEach(delimiter => {
    const count = firstLine.split(delimiter).length - 1;
    if (count > maxCount) {
      maxCount = count;
      detectedDelimiter = delimiter;
    }
  });

  return detectedDelimiter;
}

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        resolve(content);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };

    reader.readAsText(file);
  });
}
