import { TransformerItem } from '../types';

/**
 * Parses a CSV string or Excel-copied text (tab-separated values) into TransformerItems.
 */
export function parseSpreadsheetText(text: string): { items: TransformerItem[]; errors: string[] } {
  const items: TransformerItem[] = [];
  const errors: string[] = [];
  
  if (!text || !text.trim()) {
    return { items, errors };
  }

  // Detect delimiter: tab (Excel paste) or comma/semicolon (CSV)
  const lines = text.split(/\r?\n/);
  
  // Headers check (optional, let's skip matching headers dynamically if we find column headers)
  let startIndex = 0;
  const firstLine = lines[0].toLowerCase();
  
  // If the first line contains common headers, skip it
  if (
    firstLine.includes('project') || 
    firstLine.includes('component') || 
    firstLine.includes('length') || 
    firstLine.includes('width') || 
    firstLine.includes('height') || 
    firstLine.includes('weight') || 
    firstLine.includes('origin')
  ) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split by tab first, if not found split by comma
    let columns = line.split('\t');
    if (columns.length < 5) {
      // Try split by comma but respect quotes (basic CSV split)
      columns = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
    }

    if (columns.length < 5) {
      errors.push(`Row ${i + 1}: Insufficient column count. Need at least 5 columns.`);
      continue;
    }

    // Clean columns
    const cleanCols = columns.map(col => col.replace(/^"|"$/g, '').trim());

    const projectCode = cleanCols[0] || 'PT-TEMP';
    const componentName = cleanCols[1] || 'Transformer Accessory';
    
    // Parse numeric values with fallback and error warnings
    const length = parseInt(cleanCols[2], 10);
    const width = parseInt(cleanCols[3], 10);
    const height = parseInt(cleanCols[4], 10);
    const weight = parseInt(cleanCols[5], 10);
    const origin = cleanCols[6] || 'Oman';

    if (isNaN(length) || length <= 0) {
      errors.push(`Row ${i + 1}: Invalid length value "${cleanCols[2]}". Must be a positive integer.`);
      continue;
    }
    if (isNaN(width) || width <= 0) {
      errors.push(`Row ${i + 1}: Invalid width value "${cleanCols[3]}". Must be a positive integer.`);
      continue;
    }
    if (isNaN(height) || height <= 0) {
      errors.push(`Row ${i + 1}: Invalid height value "${cleanCols[4]}". Must be a positive integer.`);
      continue;
    }
    if (isNaN(weight) || weight <= 0) {
      errors.push(`Row ${i + 1}: Invalid weight value "${cleanCols[5]}". Must be a positive integer.`);
      continue;
    }

    items.push({
      id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      projectCode,
      componentName,
      length,
      width,
      height,
      weight,
      origin: origin ? origin.charAt(0).toUpperCase() + origin.slice(1) : 'Oman',
    });
  }

  return { items, errors };
}

/**
 * Converts a list of TransformerItems into a downloadable CSV string
 */
export function exportToCSVString(items: TransformerItem[]): string {
  const headers = ['Project Code', 'Component Name', 'Length (mm)', 'Width (mm)', 'Height (mm)', 'Weight (kg)', 'Country of Origin'];
  
  const rows = items.map(item => [
    `"${item.projectCode.replace(/"/g, '""')}"`,
    `"${item.componentName.replace(/"/g, '""')}"`,
    item.length,
    item.width,
    item.height,
    item.weight,
    `"${item.origin.replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
