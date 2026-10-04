import * as XLSX from 'xlsx';
import { ExcelImportItem, TransformerItem } from '../types';

/**
 * Parses a size string like "4600 x 1600 x 2200 mm" or "4600*1600*2200" or similar
 * and extracts length, width, and height.
 */
export function parseDimensions(sizeStr: string): { length: number; width: number; height: number } {
  if (!sizeStr) return { length: 0, width: 0, height: 0 };

  // Convert to clean lowercased string, remove mm, commas
  const cleaned = String(sizeStr)
    .replace(/,/g, '')
    .replace(/mm/gi, '')
    .trim();

  // Try standard delimiters like 4600 x 1600 x 2200
  const match = cleaned.match(/(\d+)\s*[\*xX✕×\-\/]\s*(\d+)\s*[\*xX✕×\-\/]\s*(\d+)/);
  if (match) {
    return {
      length: parseInt(match[1], 10) || 0,
      width: parseInt(match[2], 10) || 0,
      height: parseInt(match[3], 10) || 0,
    };
  }

  // Fallback: extract all numbers in the string
  const numbers = cleaned.match(/\d+/g);
  if (numbers && numbers.length >= 3) {
    return {
      length: parseInt(numbers[0], 10) || 0,
      width: parseInt(numbers[1], 10) || 0,
      height: parseInt(numbers[2], 10) || 0,
    };
  }

  return { length: 0, width: 0, height: 0 };
}

/**
 * Dynamically detects which column is which by inspecting a row's values.
 */
function detectHeaderIndexes(row: any[]): {
  descriptionIdx: number;
  sizeIdx: number;
  qtyIdx: number;
  weightIdx: number;
  originIdx: number;
  packingIdx: number;
} {
  let descriptionIdx = -1;
  let sizeIdx = -1;
  let qtyIdx = -1;
  let weightIdx = -1;
  let originIdx = -1;
  let packingIdx = -1;

  for (let idx = 0; idx < row.length; idx++) {
    const cellValue = String(row[idx] || '').trim().toLowerCase();
    if (!cellValue) continue;

    // Item Description column matching
    if (
      cellValue.includes('description') ||
      cellValue === 'item' ||
      cellValue.includes('item desc') ||
      cellValue.includes('part') ||
      cellValue === 'component' ||
      cellValue.includes('box description')
    ) {
      if (descriptionIdx === -1) descriptionIdx = idx;
    }

    // Size column matching
    if (
      cellValue.includes('size') ||
      cellValue.includes('dimension') ||
      cellValue.includes('l x b x h') ||
      cellValue.includes('l x w x h') ||
      cellValue.includes('outer size') ||
      cellValue === 'measurements'
    ) {
      if (sizeIdx === -1) sizeIdx = idx;
    }

    // Qty column matching
    if (
      cellValue.includes('qty') ||
      cellValue.includes('quantity') ||
      cellValue.includes('job') ||
      cellValue === 'qty/job' ||
      cellValue === 'units' ||
      cellValue === 'quantity/job'
    ) {
      if (qtyIdx === -1) qtyIdx = idx;
    }

    // Weight column matching
    if (
      cellValue.includes('weight') ||
      cellValue.includes('wt') ||
      cellValue.includes('mass') ||
      cellValue === 'kg' ||
      cellValue === 'total weight'
    ) {
      if (weightIdx === -1) weightIdx = idx;
    }

    // Country of Origin column matching
    if (
      cellValue.includes('origin') ||
      cellValue.includes('country') ||
      cellValue.includes('made in') ||
      cellValue.includes('manufacture') ||
      cellValue === 'source'
    ) {
      if (originIdx === -1) originIdx = idx;
    }

    // Packing type column matching
    if (
      cellValue.includes('packing') ||
      cellValue.includes('package') ||
      cellValue.includes('pack type')
    ) {
      if (packingIdx === -1) packingIdx = idx;
    }
  }

  return { descriptionIdx, sizeIdx, qtyIdx, weightIdx, originIdx, packingIdx };
}

/**
 * Parses an Excel file (ArrayBuffer) into raw import rows.
 */
export function parseExcelFile(arrayBuffer: ArrayBuffer): {
  items: ExcelImportItem[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const items: ExcelImportItem[] = [];

  try {
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    if (workbook.SheetNames.length === 0) {
      throw new Error('Excel file has no worksheets.');
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    if (rows.length === 0) {
      throw new Error('Worksheet is empty.');
    }

    // 1. Scan rows to find the Header Row
    let headerRowIdx = -1;
    let descriptionIdx = -1;
    let sizeIdx = -1;
    let qtyIdx = -1;
    let weightIdx = -1;
    let originIdx = -1;
    let packingIdx = -1;

    for (let i = 0; i < Math.min(20, rows.length); i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;

      const detected = detectHeaderIndexes(row);
      let matchCount = 0;
      if (detected.descriptionIdx !== -1) matchCount++;
      if (detected.sizeIdx !== -1) matchCount++;
      if (detected.qtyIdx !== -1) matchCount++;
      if (detected.weightIdx !== -1) matchCount++;

      // We need at least 3 matching headers to confirm this row is our column index row
      if (matchCount >= 3) {
        headerRowIdx = i;
        descriptionIdx = detected.descriptionIdx;
        sizeIdx = detected.sizeIdx;
        qtyIdx = detected.qtyIdx;
        weightIdx = detected.weightIdx;
        originIdx = detected.originIdx;
        packingIdx = detected.packingIdx;
        break;
      }
    }

    // Fallback if schema headers not found
    if (headerRowIdx === -1) {
      warnings.push('Header row with "Item Description", "Approx. Box Outer Size L x B x H", "Qty / Job", "Total Weight" not detected. Using default columns first.');
      descriptionIdx = 0;
      sizeIdx = 1;
      qtyIdx = 2;
      weightIdx = 3;
      originIdx = 4;
      packingIdx = -1;
      headerRowIdx = 0; // begin parsing at index 1 or 0
    } else {
      warnings.push(`Detected header labels at row index ${headerRowIdx + 1}.`);
    }

    // 2. Parse data rows from headers + 1
    const startRow = headerRowIdx + 1;
    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !Array.isArray(row) || row.length === 0) continue;

      // Skip row if completely empty or contains headers
      const rowStr = row.join('').trim();
      if (!rowStr) continue;

      const descValue = descriptionIdx !== -1 ? String(row[descriptionIdx] || '').trim() : '';
      if (!descValue || descValue.toLowerCase().includes('total') || descValue.toLowerCase().startsWith('grand')) {
        // Skip summary or empty rows
        continue;
      }

      // Read dimensions
      const sizeValue = sizeIdx !== -1 ? String(row[sizeIdx] || '').trim() : '';
      const { length, width, height } = parseDimensions(sizeValue);

      // Read Quantity with default 1
      const rawQty = qtyIdx !== -1 ? row[qtyIdx] : undefined;
      let qtyPerJob = 1;
      if (rawQty !== undefined) {
        const parsedQty = parseInt(String(rawQty).replace(/,/g, ''), 10);
        if (!isNaN(parsedQty) && parsedQty > 0) {
          qtyPerJob = parsedQty;
        }
      }

      // Read Weight with default 50
      const rawWeight = weightIdx !== -1 ? row[weightIdx] : undefined;
      let totalWeight = 100;
      if (rawWeight !== undefined) {
        const parsedWeight = parseInt(String(rawWeight).replace(/,/g, ''), 10);
        if (!isNaN(parsedWeight) && parsedWeight > 0) {
          totalWeight = parsedWeight;
        }
      }

      // Read Origin
      let countryOfOrigin = 'Unknown';
      if (originIdx !== -1 && row[originIdx] !== undefined && row[originIdx] !== null) {
        const rawOriginStr = String(row[originIdx]).trim();
        if (rawOriginStr) {
          const rawOriginLower = rawOriginStr.toLowerCase();
          if (rawOriginLower === 'oman') {
            countryOfOrigin = 'Oman';
          } else if (rawOriginLower === 'india') {
            countryOfOrigin = 'India';
          } else if (rawOriginLower === 'china') {
            countryOfOrigin = 'China';
          } else if (rawOriginLower === 'uae') {
            countryOfOrigin = 'UAE';
          } else if (rawOriginLower === 'turkey') {
            countryOfOrigin = 'Turkey';
          } else if (rawOriginLower === 'germany') {
            countryOfOrigin = 'Germany';
          } else if (rawOriginLower === 'italy') {
            countryOfOrigin = 'Italy';
          } else {
            // Capitalize first letter as fallback
            countryOfOrigin = rawOriginStr.charAt(0).toUpperCase() + rawOriginStr.slice(1).toLowerCase();
          }
        }
      }

      // Read Type of Packing
      let typeOfPacking = '';
      if (packingIdx !== -1 && row[packingIdx] !== undefined && row[packingIdx] !== null) {
        typeOfPacking = String(row[packingIdx]).trim();
      }

      if (length === 0 || width === 0 || height === 0) {
        warnings.push(`Row ${i + 1} "${descValue}": Could not extract valid 3D dimensions from value "${sizeValue}". Defaulting size to 1000x1000x1000 mm for edit.`);
      }

      items.push({
        id: `import-row-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        itemDescription: descValue,
        length: length || 1000,
        width: width || 1000,
        height: height || 1000,
        qtyPerJob,
        totalWeight,
        countryOfOrigin,
        typeOfPacking,
      });
    }

  } catch (error: any) {
    warnings.push(`Error parsing Excel structure: ${error.message}`);
  }

  return { items, warnings };
}

/**
 * Duplicates a project packing box registry across the requested number of transformers.
 */
export function duplicateItemsAcrossTransformers(
  projectCode: string,
  numTransformers: number,
  importRows: ExcelImportItem[]
): TransformerItem[] {
  const result: TransformerItem[] = [];

  for (let t = 1; t <= numTransformers; t++) {
    const currentCode = `${projectCode}/${t}`;

    for (const row of importRows) {
      const { itemDescription, length, width, height, qtyPerJob, totalWeight, countryOfOrigin, typeOfPacking } = row;

      // Weight per individual box
      const unitWeight = Math.round(totalWeight / qtyPerJob);

      for (let q = 1; q <= qtyPerJob; q++) {
        // Name the box describing instances if qty is > 1
        const partName = qtyPerJob > 1 
          ? `${itemDescription} ${q}` 
          : itemDescription;

        result.push({
          id: `box-${t}-${row.id}-${q}-${Math.random().toString(36).substr(2, 5)}`,
          projectCode: currentCode,
          componentName: partName,
          length,
          width,
          height,
          weight: unitWeight || 1, // Fallback if weight is zero
          origin: countryOfOrigin,
          typeOfPacking,
        });
      }
    }
  }

  return result;
}
