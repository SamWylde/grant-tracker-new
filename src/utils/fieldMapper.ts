/**
 * Field Mapper for Import Wizard
 * Maps fields from external platforms to GrantCue schema
 */

export interface FieldMapping {
  source: string;        // Source field name from CSV
  target: string;        // Target field in GrantCue
  transform?: (value: string) => any;  // Optional transformation function
}

export interface PlatformPreset {
  name: string;
  description: string;
  mappings: Record<string, string>;  // source -> target
  dateFormat?: string;
}

/**
 * GrantCue Schema - Target Fields
 */
export const GRANTCUE_FIELDS = {
  // Required fields
  title: { label: 'Grant Title', required: true, type: 'text' },
  external_id: { label: 'Grant ID/Number', required: true, type: 'text' },

  // Optional core fields
  agency: { label: 'Agency', required: false, type: 'text' },
  aln: { label: 'ALN (Assistance Listing Number)', required: false, type: 'text' },
  open_date: { label: 'Open Date', required: false, type: 'date' },
  close_date: { label: 'Close Date / Deadline', required: false, type: 'date' },

  // Workflow fields
  status: { label: 'Status', required: false, type: 'select', options: ['researching', 'drafting', 'submitted', 'awarded', 'rejected', 'withdrawn'] },
  priority: { label: 'Priority', required: false, type: 'select', options: ['low', 'medium', 'high', 'urgent'] },
  notes: { label: 'Notes', required: false, type: 'textarea' },

  // Metadata
  amount_min: { label: 'Award Floor', required: false, type: 'number' },
  amount_max: { label: 'Award Ceiling', required: false, type: 'number' },
  estimated_funding: { label: 'Total Funding', required: false, type: 'number' },
} as const;

/**
 * Platform-specific import presets
 */
export const PLATFORM_PRESETS: Record<string, PlatformPreset> = {
  granthub: {
    name: 'GrantHub',
    description: 'Import from GrantHub CSV export',
    mappings: {
      'Opportunity Name': 'title',
      'Opportunity Number': 'external_id',
      'Agency': 'agency',
      'CFDA Number': 'aln',
      'Close Date': 'close_date',
      'Posted Date': 'open_date',
      'Status': 'status',
      'Priority': 'priority',
      'Notes': 'notes',
      'Award Floor': 'amount_min',
      'Award Ceiling': 'amount_max',
      'Estimated Total Program Funding': 'estimated_funding',
    },
    dateFormat: 'MM/DD/YYYY',
  },

  instrumentl: {
    name: 'Instrumentl',
    description: 'Import from Instrumentl CSV export',
    mappings: {
      'Title': 'title',
      'Opportunity ID': 'external_id',
      'Funder': 'agency',
      'Amount': 'amount_max',
      'Deadline': 'close_date',
      'Status': 'status',
      'Notes': 'notes',
    },
    dateFormat: 'YYYY-MM-DD',
  },

  foundationsearch: {
    name: 'Foundation Search',
    description: 'Import from Foundation Search export',
    mappings: {
      'Foundation Name': 'agency',
      'Program Name': 'title',
      'Grant ID': 'external_id',
      'Deadline': 'close_date',
      'Award Range Low': 'amount_min',
      'Award Range High': 'amount_max',
      'Description': 'notes',
    },
    dateFormat: 'MM/DD/YYYY',
  },

  candid: {
    name: 'Candid / Foundation Directory',
    description: 'Import from Candid (GuideStar) export',
    mappings: {
      'Grantmaker Name': 'agency',
      'Grant Name': 'title',
      'Grant Number': 'external_id',
      'Application Deadline': 'close_date',
      'Minimum Grant Amount': 'amount_min',
      'Maximum Grant Amount': 'amount_max',
      'Purpose': 'notes',
    },
    dateFormat: 'MM/DD/YYYY',
  },

  grantsgov: {
    name: 'Grants.gov',
    description: 'Import from Grants.gov search export',
    mappings: {
      'Opportunity Title': 'title',
      'Opportunity Number': 'external_id',
      'Agency Name': 'agency',
      'CFDA Number(s)': 'aln',
      'Close Date': 'close_date',
      'Posted Date': 'open_date',
      'Award Ceiling': 'amount_max',
      'Award Floor': 'amount_min',
      'Estimated Total Program Funding': 'estimated_funding',
    },
    dateFormat: 'MM/DD/YYYY',
  },
};

/**
 * Auto-detect the best preset based on CSV headers
 */
export function detectPreset(headers: string[]): string | null {
  const headerSet = new Set(headers.map(h => h.toLowerCase().trim()));

  let bestMatch: { preset: string; score: number } | null = null;

  for (const [key, preset] of Object.entries(PLATFORM_PRESETS)) {
    const mappingKeys = Object.keys(preset.mappings);
    let matches = 0;

    for (const sourceField of mappingKeys) {
      if (headerSet.has(sourceField.toLowerCase())) {
        matches++;
      }
    }

    const score = matches / mappingKeys.length;

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { preset: key, score };
    }
  }

  // Only return if we have at least 50% confidence
  if (bestMatch && bestMatch.score >= 0.5) {
    return bestMatch.preset;
  }
  return null;
}

/**
 * Apply field mappings to transform CSV row to GrantCue format
 */
export function applyMapping(
  row: Record<string, string>,
  mappings: Record<string, string>
): Record<string, any> {
  const result: Record<string, any> = {
    external_source: 'import',
  };

  Object.entries(mappings).forEach(([source, target]) => {
    if (source in row) {
      const value = row[source]?.trim();

      if (value) {
        // Apply transformations based on target field type
        result[target] = transformValue(value, target);
      }
    }
  });

  return result;
}

/**
 * Transform value based on target field type
 */
function transformValue(value: string, targetField: string): any {
  const fieldConfig = GRANTCUE_FIELDS[targetField as keyof typeof GRANTCUE_FIELDS];

  if (!fieldConfig) return value;

  switch (fieldConfig.type) {
    case 'date':
      return parseDate(value);

    case 'number':
      return parseNumber(value);

    case 'select':
      return normalizeSelectValue(value, fieldConfig.options || []);

    default:
      return value;
  }
}

/**
 * Parse various date formats to ISO format
 */
function parseDate(value: string): string | null {
  if (!value) return null;

  // Try parsing common formats
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,  // MM/DD/YYYY or M/D/YYYY
    /^(\d{4})-(\d{2})-(\d{2})/,          // YYYY-MM-DD
    /^(\d{2})-(\d{2})-(\d{4})/,          // DD-MM-YYYY
  ];

  for (const format of formats) {
    const match = value.match(format);
    if (match) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  // Try native parsing as fallback
  const date = new Date(value);
  return !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : null;
}

/**
 * Parse number from string (handle currency symbols, commas)
 */
function parseNumber(value: string): number | null {
  if (!value) return null;

  // Remove currency symbols, commas, and spaces
  const cleaned = value.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);

  return !isNaN(num) ? num : null;
}

/**
 * Normalize select values to match our options
 */
function normalizeSelectValue(value: string, options: readonly string[]): string | null {
  const normalized = value.toLowerCase().trim();

  // Try exact match first
  const exactMatch = options.find(opt => opt.toLowerCase() === normalized);
  if (exactMatch) return exactMatch;

  // Try fuzzy matching
  const fuzzyMatch = options.find(opt =>
    normalized.includes(opt.toLowerCase()) || opt.toLowerCase().includes(normalized)
  );

  return fuzzyMatch || null;
}

/**
 * Validate mapped row
 */
export function validateMappedRow(
  row: Record<string, any>,
  rowIndex: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!row.title || !row.title.trim()) {
    errors.push(`Row ${rowIndex + 1}: Missing required field 'title'`);
  }

  if (!row.external_id || !row.external_id.trim()) {
    errors.push(`Row ${rowIndex + 1}: Missing required field 'external_id'`);
  }

  // Validate status if provided
  if (row.status && !GRANTCUE_FIELDS.status.options?.includes(row.status)) {
    errors.push(`Row ${rowIndex + 1}: Invalid status '${row.status}'`);
  }

  // Validate priority if provided
  if (row.priority && !GRANTCUE_FIELDS.priority.options?.includes(row.priority)) {
    errors.push(`Row ${rowIndex + 1}: Invalid priority '${row.priority}'`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a sample CSV template for download
 */
export function generateSampleCSV(): string {
  const headers = [
    'Grant Title',
    'Grant ID',
    'Agency',
    'ALN',
    'Open Date',
    'Close Date',
    'Status',
    'Priority',
    'Award Floor',
    'Award Ceiling',
    'Notes',
  ];

  const sampleRows = [
    {
      'Grant Title': 'Community Development Block Grant',
      'Grant ID': 'HUD-2024-001',
      'Agency': 'Department of Housing and Urban Development',
      'ALN': '14.218',
      'Open Date': '01/15/2024',
      'Close Date': '03/30/2024',
      'Status': 'researching',
      'Priority': 'high',
      'Award Floor': '50000',
      'Award Ceiling': '500000',
      'Notes': 'Focus on affordable housing initiatives',
    },
    {
      'Grant Title': 'Arts Education Program',
      'Grant ID': 'NEA-2024-042',
      'Agency': 'National Endowment for the Arts',
      'ALN': '45.024',
      'Open Date': '02/01/2024',
      'Close Date': '04/15/2024',
      'Status': 'drafting',
      'Priority': 'medium',
      'Award Floor': '10000',
      'Award Ceiling': '100000',
      'Notes': 'K-12 arts integration program',
    },
  ];

  // Generate CSV
  const lines = [headers.join(',')];
  sampleRows.forEach(row => {
    const values = headers.map(h => {
      const value = row[h as keyof typeof row] || '';
      // Escape values with commas
      return value.includes(',') ? `"${value}"` : value;
    });
    lines.push(values.join(','));
  });

  return lines.join('\n');
}
