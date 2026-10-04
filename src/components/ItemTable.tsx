import React, { useState, useEffect, useMemo } from 'react';
import { TransformerItem, ExcelImportItem, Truck, ProjectTransportMode } from '../types';
import { getStackingInfo, isTransformerRollers, isMainTransformerTank } from '../utils/packing';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  Check, 
  X, 
  AlertTriangle, 
  RefreshCw, 
  HelpCircle, 
  Grid, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  Info,
  Settings,
  Filter,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Truck as TruckIcon
} from 'lucide-react';
import { parseExcelFile, duplicateItemsAcrossTransformers } from '../utils/excelParser';
import { exportToCSVString } from '../utils/csvHelper';

interface ItemTableProps {
  items: TransformerItem[];
  trucks?: Truck[];
  onAddItem: (item: TransformerItem) => void;
  onUpdateItem: (item: TransformerItem) => void;
  onDeleteItem: (id: string) => void;
  onBulkImport: (items: TransformerItem[]) => void;
  onResetToSample: () => void;
  onConfirmImport?: () => void; // Optional callback to navigate to dashboard
  componentTransportType: 'Flat Bed' | '40ft HC Container';
  setComponentTransportType: (val: 'Flat Bed' | '40ft HC Container') => void;
  containerInternalWidth: number;
  setContainerInternalWidth: (val: number) => void;
  containerInternalHeight: number;
  setContainerInternalHeight: (val: number) => void;
  flatBedPhysicalLength: number;
  setFlatBedPhysicalLength: (val: number) => void;
  flatBedUsableLength: number;
  setFlatBedUsableLength: (val: number) => void;
  flatBedWidth: number;
  setFlatBedWidth: (val: number) => void;
  flatBedHeight: number;
  setFlatBedHeight: (val: number) => void;
  lowBedPhysicalLength: number;
  setLowBedPhysicalLength: (val: number) => void;
  lowBedUsableLength: number;
  setLowBedUsableLength: (val: number) => void;
  lowBedWidth: number;
  setLowBedWidth: (val: number) => void;
  lowBedHeight: number;
  setLowBedHeight: (val: number) => void;
  flatBedPayloadCapacity: number;
  setFlatBedPayloadCapacity: (val: number) => void;
  lowBedPayloadCapacity: number;
  setLowBedPayloadCapacity: (val: number) => void;
  projectTransportMode: ProjectTransportMode;
  setProjectTransportMode: (val: ProjectTransportMode) => void;
}

const DEFAULT_RAW_ITEMS: ExcelImportItem[] = [
  {
    id: 'sample-row-rollers',
    itemDescription: 'Main Transformer Rollers',
    length: 1800,
    width: 900,
    height: 750,
    qtyPerJob: 1,
    totalWeight: 1400,
    countryOfOrigin: 'India'
  },
  {
    id: 'sample-row-1',
    itemDescription: 'Main Conservator',
    length: 4600,
    width: 1600,
    height: 2200,
    qtyPerJob: 1,
    totalWeight: 2500,
    countryOfOrigin: 'India'
  },
  {
    id: 'sample-row-2',
    itemDescription: 'Radiator Box',
    length: 3200,
    width: 1200,
    height: 1800,
    qtyPerJob: 4,
    totalWeight: 16000,
    countryOfOrigin: 'Oman'
  },
  {
    id: 'sample-row-3',
    itemDescription: 'LV Bushings Box',
    length: 1800,
    width: 900,
    height: 1000,
    qtyPerJob: 1,
    totalWeight: 950,
    countryOfOrigin: 'Oman'
  },
  {
    id: 'sample-row-4',
    itemDescription: 'Marshalling Kiosk',
    length: 1200,
    width: 800,
    height: 1600,
    qtyPerJob: 1,
    totalWeight: 640,
    countryOfOrigin: 'India'
  }
];

export default function ItemTable({
  items,
  trucks,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onBulkImport,
  onResetToSample,
  onConfirmImport,
  componentTransportType,
  setComponentTransportType,
  containerInternalWidth,
  setContainerInternalWidth,
  containerInternalHeight,
  setContainerInternalHeight,
  flatBedPhysicalLength,
  setFlatBedPhysicalLength,
  flatBedUsableLength,
  setFlatBedUsableLength,
  flatBedWidth,
  setFlatBedWidth,
  flatBedHeight,
  setFlatBedHeight,
  lowBedPhysicalLength,
  setLowBedPhysicalLength,
  lowBedUsableLength,
  setLowBedUsableLength,
  lowBedWidth,
  setLowBedWidth,
  lowBedHeight,
  setLowBedHeight,
  flatBedPayloadCapacity,
  setFlatBedPayloadCapacity,
  lowBedPayloadCapacity,
  setLowBedPayloadCapacity,
  projectTransportMode,
  setProjectTransportMode,
}: ItemTableProps) {
  // Navigation / View state
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'excel-workspace' | 'duplicated-matrix'>('excel-workspace');

  // Parameters for Replication Setup
  const [projectCodeInput, setProjectCodeInput] = useState<string>(() => {
    return localStorage.getItem('import_project_code') || 'PT0512';
  });
  const [numTransformers, setNumTransformers] = useState<number>(() => {
    const saved = localStorage.getItem('import_num_transformers');
    return saved ? parseInt(saved, 10) : 3;
  });

  // Excel Raw Parsed Items (Editable Preview state)
  const [importRows, setImportRows] = useState<ExcelImportItem[]>(() => {
    const saved = localStorage.getItem('import_rows_preview');
    return saved ? JSON.parse(saved) : DEFAULT_RAW_ITEMS;
  });

  // Drag and Drop drag events states
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [parserWarnings, setParserWarnings] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Legacy table inline form states
  const [isAddingSingle, setIsAddingSingle] = useState(false);
  const [editingSingleId, setEditingSingleId] = useState<string | null>(null);
  
  const [projectCodeField, setProjectCodeField] = useState('');
  const [componentNameField, setComponentNameField] = useState('');
  const [lengthField, setLengthField] = useState('');
  const [widthField, setWidthField] = useState('');
  const [heightField, setHeightField] = useState('');
  const [weightField, setWeightField] = useState('');
  const [originField, setOriginField] = useState('Oman');
  const [stackableField, setStackableField] = useState(true);

  // Advanced Filtering & Sorting state
  const [filterProjectCode, setFilterProjectCode] = useState<string>('');
  const [filterComponentName, setFilterComponentName] = useState<string>('');
  const [filterOrigin, setFilterOrigin] = useState<string>('');
  const [filterMinWeight, setFilterMinWeight] = useState<string>('');
  const [filterMaxWeight, setFilterMaxWeight] = useState<string>('');
  const [filterMinLength, setFilterMinLength] = useState<string>('');
  const [filterMaxLength, setFilterMaxLength] = useState<string>('');
  const [filterMinWidth, setFilterMinWidth] = useState<string>('');
  const [filterMaxWidth, setFilterMaxWidth] = useState<string>('');
  const [filterMinHeight, setFilterMinHeight] = useState<string>('');
  const [filterMaxHeight, setFilterMaxHeight] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  const [sortColumn, setSortColumn] = useState<keyof TransformerItem | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: keyof TransformerItem) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null); // Reset sort
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleResetFilters = () => {
    setFilterProjectCode('');
    setFilterComponentName('');
    setFilterOrigin('');
    setFilterMinWeight('');
    setFilterMaxWeight('');
    setFilterMinLength('');
    setFilterMaxLength('');
    setFilterMinWidth('');
    setFilterMaxWidth('');
    setFilterMinHeight('');
    setFilterMaxHeight('');
  };

  const getLoadingStatus = (itemId: string) => {
    if (!trucks) return {
      text: 'No Data',
      badgeClass: 'bg-tech-bg border border-tech-border text-tech-text-secondary',
      truckText: '-'
    };
    for (const t of trucks) {
      const foundIndex = t.items.findIndex(pi => pi.item.id === itemId);
      if (foundIndex !== -1) {
        const pi = t.items[foundIndex];
        const stacking = getStackingInfo(t.items);
        const sInfo = stacking[itemId];
        const isContainer = t.type === '40ft HC Container';
        const truckLabel = isContainer ? `Container #${t.truckNumber}` : (t.type === 'Low Bed' ? `Low Bed #${t.truckNumber}` : `Flat Bed #${t.truckNumber}`);
        
        if (sInfo && sInfo.layer > 1) {
          const underPi = t.items.find(itemPi => itemPi.item.id === sInfo.loadedOnId);
          const underNum = underPi ? t.items.indexOf(underPi) + 1 : '?';
          return {
            text: `Level ${sInfo.layer} (Stacked on #${underNum})`,
            badgeClass: 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/30',
            truckText: truckLabel
          };
        } else {
          return {
            text: 'Level 1 (Ground Level)',
            badgeClass: 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30',
            truckText: truckLabel
          };
        }
      }
    }
    return {
      text: 'Unassigned / Unpacked',
      badgeClass: 'bg-red-950/40 text-red-400 border border-red-900/30',
      truckText: '-'
    };
  };

  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // Filters
    if (filterProjectCode.trim()) {
      const q = filterProjectCode.trim().toLowerCase();
      result = result.filter(item => item.projectCode.toLowerCase().includes(q));
    }
    if (filterComponentName.trim()) {
      const q = filterComponentName.trim().toLowerCase();
      result = result.filter(item => item.componentName.toLowerCase().includes(q));
    }
    if (filterOrigin.trim()) {
      const q = filterOrigin.trim().toLowerCase();
      result = result.filter(item => item.origin.toLowerCase().includes(q));
    }
    if (filterMinWeight !== '') {
      const minVal = parseFloat(filterMinWeight);
      if (!isNaN(minVal)) {
        result = result.filter(item => item.weight >= minVal);
      }
    }
    if (filterMaxWeight !== '') {
      const maxVal = parseFloat(filterMaxWeight);
      if (!isNaN(maxVal)) {
        result = result.filter(item => item.weight <= maxVal);
      }
    }
    if (filterMinLength !== '') {
      const minVal = parseFloat(filterMinLength);
      if (!isNaN(minVal)) {
        result = result.filter(item => item.length >= minVal);
      }
    }
    if (filterMaxLength !== '') {
      const maxVal = parseFloat(filterMaxLength);
      if (!isNaN(maxVal)) {
        result = result.filter(item => item.length <= maxVal);
      }
    }
    if (filterMinWidth !== '') {
      const minVal = parseFloat(filterMinWidth);
      if (!isNaN(minVal)) {
        result = result.filter(item => item.width >= minVal);
      }
    }
    if (filterMaxWidth !== '') {
      const maxVal = parseFloat(filterMaxWidth);
      if (!isNaN(maxVal)) {
        result = result.filter(item => item.width <= maxVal);
      }
    }
    if (filterMinHeight !== '') {
      const minVal = parseFloat(filterMinHeight);
      if (!isNaN(minVal)) {
        result = result.filter(item => item.height >= minVal);
      }
    }
    if (filterMaxHeight !== '') {
      const maxVal = parseFloat(filterMaxHeight);
      if (!isNaN(maxVal)) {
        result = result.filter(item => item.height <= maxVal);
      }
    }

    // Sorting
    if (sortColumn) {
      result.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        if (valA === undefined) valA = '';
        if (valB === undefined) valB = '';

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        } else if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc'
            ? valA - valB
            : valB - valA;
        }
        return 0;
      });
    }

    return result;
  }, [
    items,
    filterProjectCode,
    filterComponentName,
    filterOrigin,
    filterMinWeight,
    filterMaxWeight,
    filterMinLength,
    filterMaxLength,
    filterMinWidth,
    filterMaxWidth,
    filterMinHeight,
    filterMaxHeight,
    sortColumn,
    sortDirection
  ]);

  // Persistence triggers
  useEffect(() => {
    localStorage.setItem('import_project_code', projectCodeInput);
  }, [projectCodeInput]);

  useEffect(() => {
    localStorage.setItem('import_num_transformers', numTransformers.toString());
  }, [numTransformers]);

  useEffect(() => {
    localStorage.setItem('import_rows_preview', JSON.stringify(importRows));
  }, [importRows]);

  // Handle direct file upload / drag drop of Excel file
  const handleExcelParse = async (file: File) => {
    setParserWarnings([]);
    setSuccessMsg('');
    const fileReader = new FileReader();

    fileReader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const { items: parsedItems, warnings } = parseExcelFile(buffer);
        
        if (parsedItems.length > 0) {
          setImportRows(parsedItems);
          setSuccessMsg(`Excel loaded successfully! Found ${parsedItems.length} accessories categories.`);
        } else {
          setParserWarnings(['We could not extract any item rows. Verify that columns are labeled properly.']);
        }
        
        if (warnings.length > 0) {
          setParserWarnings(prev => [...prev, ...warnings]);
        }
      } catch (err: any) {
        setParserWarnings([`Unable to process this spreadsheet file: ${err.message}`]);
      }
    };

    fileReader.onerror = () => {
      setParserWarnings(['Error occurred reading the local file binary.']);
    };

    fileReader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleExcelParse(file);
    }
  };

  // Drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  // Drag leave
  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  // Drag drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleExcelParse(file);
    }
  };

  // Editable Preview Table functions
  const handleEditPreviewRow = (id: string, field: keyof ExcelImportItem, value: any) => {
    setImportRows(prev => prev.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  const handleDeletePreviewRow = (id: string) => {
    setImportRows(prev => prev.filter(row => row.id !== id));
  };

  const handleAddManualPreviewRow = () => {
    const newIdx = importRows.length + 1;
    const newRow: ExcelImportItem = {
      id: `manual-preview-${Date.now()}-${newIdx}`,
      itemDescription: `New Accessory Box ${newIdx}`,
      length: 1200,
      width: 1000,
      height: 1200,
      qtyPerJob: 1,
      totalWeight: 500,
      countryOfOrigin: 'Oman'
    };
    setImportRows(prev => [...prev, newRow]);
  };

  // Trigger Replication & Optimization
  const handleConfirmAndDuplication = () => {
    if (!projectCodeInput.trim()) {
      alert('Kindly configure a valid Project Code baseline identifier first (e.g. PT0512).');
      return;
    }
    if (numTransformers <= 0 || isNaN(numTransformers)) {
      alert('Number of transformers must be a positive integer >= 1.');
      return;
    }
    if (importRows.length === 0) {
      alert('Please import or manually add packing box list entries in the preview table first.');
      return;
    }

    // Check dimensions validation
    for (const row of importRows) {
      if (!row.itemDescription.trim()) {
        alert('All accessory components require a valid description.');
        return;
      }
      if (row.length <= 0 || row.width <= 0 || row.height <= 0 || row.qtyPerJob <= 0 || row.totalWeight < 0) {
        alert(`Validation fail for "${row.itemDescription}": Sizes, quantities and weights must be positive integers.`);
        return;
      }
      if (row.countryOfOrigin === 'Unknown') {
        alert(`Validation fail for "${row.itemDescription}": Country of origin is Unknown. Please select a valid Country of Origin before running optimization.`);
        return;
      }
    }

    // Call the duplication utility
    const duplicatedList = duplicateItemsAcrossTransformers(
      projectCodeInput.trim().toUpperCase(),
      numTransformers,
      importRows
    );

    // Upload to App level state
    onBulkImport(duplicatedList);

    // Advise navigation to Dashboard
    if (onConfirmImport) {
      onConfirmImport();
    } else {
      alert(`Completed duplication! Successfully created ${duplicatedList.length} items for ${numTransformers} transformers.`);
    }
  };

  const handleTransportTypeChange = (type: 'Flat Bed' | '40ft HC Container') => {
    setComponentTransportType(type);
    if (type === 'Flat Bed') {
      setFlatBedPhysicalLength(12000);
      setFlatBedUsableLength(11800);
      setFlatBedWidth(2340);
      setFlatBedHeight(2500);
    } else {
      setFlatBedPhysicalLength(12030);
      setFlatBedUsableLength(12030);
      setFlatBedWidth(2340);
      setFlatBedHeight(2580);
      setContainerInternalWidth(2350);
      setContainerInternalHeight(2690);
    }
  };

  // Reset current preview to default
  const handleResetPreviewToTemplate = () => {
    if (confirm('Revert all adjustments in the current Excel upload workspace to the standard single-transformer template cargo list?')) {
      setImportRows(DEFAULT_RAW_ITEMS);
      setParserWarnings([]);
      setSuccessMsg('Reverted preview cargo table to single-transformer baseline accessories.');
    }
  };

  // Legacy state single items addition handlers
  const handleSaveAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectCodeField || !componentNameField || !lengthField || !widthField || !heightField || !weightField) {
      alert('Please specify all details.');
      return;
    }

    const length = parseInt(lengthField, 10);
    const width = parseInt(widthField, 10);
    const height = parseInt(heightField, 10);
    const weight = parseInt(weightField, 10);

    if (isNaN(length) || length <= 0 || isNaN(width) || width <= 0 || isNaN(height) || height <= 0 || isNaN(weight) || weight <= 0) {
      alert('Values must be positive integers.');
      return;
    }

    onAddItem({
      id: `m-single-${Date.now()}`,
      projectCode: projectCodeField.toUpperCase(),
      componentName: componentNameField,
      length,
      width,
      height,
      weight,
      origin: originField,
      stackable: stackableField,
    });

    setIsAddingSingle(false);
    resetSingleFieldState();
  };

  const startEditSingle = (item: TransformerItem) => {
    setEditingSingleId(item.id);
    setProjectCodeField(item.projectCode);
    setComponentNameField(item.componentName);
    setLengthField(item.length.toString());
    setHeightField(item.height.toString());
    setWidthField(item.width.toString());
    setWeightField(item.weight.toString());
    setOriginField(item.origin);
    setStackableField(item.stackable !== false);
  };

  const handleSaveEditSingle = (id: string) => {
    const length = parseInt(lengthField, 10);
    const width = parseInt(widthField, 10);
    const height = parseInt(heightField, 10);
    const weight = parseInt(weightField, 10);

    if (isNaN(length) || length <= 0 || isNaN(width) || width <= 0 || isNaN(height) || height <= 0 || isNaN(weight) || weight <= 0) {
      alert('Values must be integers more than zero.');
      return;
    }

    onUpdateItem({
      id,
      projectCode: projectCodeField.toUpperCase(),
      componentName: componentNameField,
      length,
      width,
      height,
      weight,
      origin: originField,
      stackable: stackableField,
    });

    setEditingSingleId(null);
    resetSingleFieldState();
  };

  const resetSingleFieldState = () => {
    setProjectCodeField('');
    setComponentNameField('');
    setLengthField('');
    setWidthField('');
    setHeightField('');
    setWeightField('');
    setOriginField('Oman');
    setStackableField(true);
  };

  return (
    <div className="bg-tech-panel rounded-xl border border-tech-border p-5 overflow-hidden">
      
      {/* HEADER SECTION WITH WORKSPACE SWITCHING NAVIGATION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-tech-border mb-6">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-wider text-tech-text-primary flex items-center gap-2 font-mono">
            <FileSpreadsheet className="text-tech-accent" size={18} />
            Cargo Matrix Workspace
          </h2>
          <p className="text-xs text-tech-text-secondary mt-1 font-mono uppercase">
            Upload Packing lists, configure project replication, and fine-tune dimensions.
          </p>
        </div>

        {/* Tab Selection Switch */}
        <div className="flex items-center bg-tech-bg p-1 rounded border border-tech-border font-mono self-start lg:self-center">
          <button
            onClick={() => setActiveWorkspaceTab('excel-workspace')}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded transition-colors cursor-pointer ${
              activeWorkspaceTab === 'excel-workspace'
                ? 'bg-tech-panel text-tech-accent border border-tech-accent/20'
                : 'text-tech-text-secondary hover:text-tech-text-primary'
            }`}
          >
            <Sparkles size={13} />
            Excel Duplicator Workspace
          </button>
          
          <button
            onClick={() => setActiveWorkspaceTab('duplicated-matrix')}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded transition-colors cursor-pointer ${
              activeWorkspaceTab === 'duplicated-matrix'
                ? 'bg-tech-panel text-tech-accent border border-tech-accent/20'
                : 'text-tech-text-secondary hover:text-tech-text-primary'
            }`}
          >
            <Grid size={13} />
            Active Packing Items List ({filteredAndSortedItems.length !== items.length ? `${filteredAndSortedItems.length}/${items.length}` : items.length})
          </button>
        </div>
      </div>

      {/* ======================= TAB 1: MODEL EXCEL WORKSPACE ======================= */}
      {activeWorkspaceTab === 'excel-workspace' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* STEP 1 & 2 SETUP PANEL ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Project Parameters & Truck Configuration Column */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              
              {/* Project Parameters Card */}
              <div className="bg-tech-bg/30 border border-tech-border rounded-lg p-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-tech-text-primary uppercase tracking-wider mb-3 font-mono flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-tech-accent text-black font-semibold text-[10px] flex items-center justify-center font-mono">1</span>
                    Project Packing Parameters
                  </h3>
                  <p className="text-[11px] text-tech-text-secondary mb-4 leading-relaxed">
                    Provide baseline identifier data. The system automatically duplicates parts and groups them across separate transformers.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-tech-text-secondary uppercase tracking-widest mb-1 font-mono">
                        Project Code
                      </label>
                      <input
                        id="input-setup-project-code"
                        type="text"
                        value={projectCodeInput}
                        onChange={(e) => setProjectCodeInput(e.target.value)}
                        placeholder="e.g. PT0512"
                        className="w-full text-xs px-3 py-2 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono uppercase font-semibold"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-tech-text-secondary uppercase tracking-widest mb-1 font-mono">
                        Number of Transformers
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="input-setup-num-transformers"
                          type="number"
                          min="1"
                          max="10"
                          value={numTransformers}
                          onChange={(e) => setNumTransformers(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-32 text-xs px-3 py-2 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono font-bold"
                        />
                        <span className="text-[11px] text-tech-text-secondary font-mono">
                          (Active multiplier)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-tech-border/50 text-[10px] text-tech-text-secondary font-mono">
                  Formula: <span className="text-tech-accent">{importRows.reduce((a,c) => a + c.qtyPerJob, 0)} boxes</span> × <span className="text-tech-accent">{numTransformers} units</span> = <span className="text-emerald-400 font-bold">{importRows.reduce((a,c) => a + c.qtyPerJob, 0) * numTransformers} total packages</span> packing target.
                </div>
              </div>

              {/* Project Transport Mode Selector Card */}
              <div id="project-transport-mode-card" className="bg-tech-bg/30 border border-tech-border rounded-lg p-4 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-tech-text-primary uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <TruckIcon size={14} className="text-tech-accent" />
                    Project Transport Mode
                  </h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-tech-panel border border-tech-border text-tech-accent uppercase">
                    {projectTransportMode === 'flatbed-only' ? 'Flat Bed Only' : projectTransportMode === 'lowbed-only' ? 'Low Bed Only' : 'Flat Bed + Low Bed'}
                  </span>
                </div>
                <p className="text-[11px] text-tech-text-secondary mb-3 leading-relaxed">
                  Select fleet allocation strategy. Controls whether cargo is planned using Flat Beds only, Low Beds only, or standard combined mode.
                </p>

                {/* 3 Selectable Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
                  {/* 1. FLAT BED ONLY */}
                  <button
                    id="btn-mode-flatbed-only"
                    type="button"
                    onClick={() => setProjectTransportMode('flatbed-only')}
                    className={`p-2.5 rounded-md border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      projectTransportMode === 'flatbed-only'
                        ? 'bg-amber-500/15 border-amber-400 text-amber-200 ring-1 ring-amber-400/50 shadow-xs'
                        : 'bg-tech-bg/60 border-tech-border/70 text-tech-text-secondary hover:text-tech-text-primary hover:border-tech-border'
                    }`}
                    title="Use this when the project contains only accessories/components and no Low Bed is required. All eligible cargo planned using Flat Bed trucks only."
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider">Flat Bed Only</span>
                      {projectTransportMode === 'flatbed-only' ? (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-tech-border/80" />
                      )}
                    </div>
                    <p className="text-[10px] leading-tight opacity-80 font-sans">
                      Accessories only. All cargo on Flat Beds.
                    </p>
                  </button>

                  {/* 2. LOW BED ONLY */}
                  <button
                    id="btn-mode-lowbed-only"
                    type="button"
                    onClick={() => setProjectTransportMode('lowbed-only')}
                    className={`p-2.5 rounded-md border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      projectTransportMode === 'lowbed-only'
                        ? 'bg-red-500/15 border-red-500 text-red-200 ring-1 ring-red-500/50 shadow-xs'
                        : 'bg-tech-bg/60 border-tech-border/70 text-tech-text-secondary hover:text-tech-text-primary hover:border-tech-border'
                    }`}
                    title="Use this for projects where Main Transformer and accessories/components are transported together using Low Bed transportation. No Flat Bed trucks created."
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider">Low Bed Only</span>
                      {projectTransportMode === 'lowbed-only' ? (
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-tech-border/80" />
                      )}
                    </div>
                    <p className="text-[10px] leading-tight opacity-80 font-sans">
                      Main Unit + parts combined on Low Bed.
                    </p>
                  </button>

                  {/* 3. FLAT BED + LOW BED */}
                  <button
                    id="btn-mode-both"
                    type="button"
                    onClick={() => setProjectTransportMode('both')}
                    className={`p-2.5 rounded-md border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      projectTransportMode === 'both'
                        ? 'bg-tech-accent/20 border-tech-accent text-tech-accent font-bold ring-1 ring-tech-accent/50 shadow-xs'
                        : 'bg-tech-bg/60 border-tech-border/70 text-tech-text-secondary hover:text-tech-text-primary hover:border-tech-border'
                    }`}
                    title="Normal/Default mode. Main Transformer on dedicated Low Bed; accessories on Flat Beds."
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider">Flat Bed + Low Bed</span>
                      {projectTransportMode === 'both' ? (
                        <span className="w-2 h-2 rounded-full bg-tech-accent animate-pulse" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-tech-border/80" />
                      )}
                    </div>
                    <p className="text-[10px] leading-tight opacity-80 font-sans">
                      Default: Tank on Low Bed, parts on Flat Bed.
                    </p>
                  </button>
                </div>

                {/* Active Strategy Explanation Badge */}
                <div className="mt-3 pt-2.5 border-t border-tech-border/40 text-[10px] font-mono flex items-center gap-1.5">
                  {projectTransportMode === 'flatbed-only' && (
                    <span className="text-amber-300">
                      • <strong>Active Mode:</strong> All eligible cargo planned with Flat Bed trucks only. Zero Low Beds created.
                    </span>
                  )}
                  {projectTransportMode === 'lowbed-only' && (
                    <span className="text-red-300">
                      • <strong>Active Mode:</strong> Main Transformer &amp; accessories planned together on Low Bed. Zero Flat Beds created.
                    </span>
                  )}
                  {projectTransportMode === 'both' && (
                    <span className="text-tech-accent">
                      • <strong>Active Mode:</strong> Standard coordinated mode (Main Transformer → Low Bed, Accessories → Flat Bed).
                    </span>
                  )}
                </div>
              </div>

              {/* Truck Configuration Card */}
              <div className="bg-tech-bg/30 border border-tech-border rounded-lg p-4 flex flex-col">
                <h3 className="text-xs font-bold text-tech-text-primary uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                  <Settings size={14} className="text-tech-accent" />
                  Truck Configuration
                </h3>
                <p className="text-[11px] text-tech-text-secondary mb-3 leading-relaxed font-sans">
                  Adjust trailer constraints. Packing calculations will automatically execute based on the <strong>Usable Length</strong>. Physical length serves as reference.
                </p>

                <div className="space-y-4">
                  {/* Components Transport Type Selector */}
                  <div className="bg-tech-bg/50 p-2.5 rounded-md border border-tech-border/50">
                    <label className="block text-[10px] font-bold text-tech-accent uppercase tracking-widest mb-1.5 font-mono">
                      Components Transport
                    </label>
                    <div className="grid grid-cols-2 gap-1 font-mono">
                      <button
                        type="button"
                        onClick={() => handleTransportTypeChange('Flat Bed')}
                        className={`px-2 py-1.5 text-xs font-bold rounded uppercase transition-colors cursor-pointer ${
                          componentTransportType === 'Flat Bed'
                            ? 'bg-tech-accent text-black font-extrabold'
                            : 'bg-tech-panel text-tech-text-secondary border border-tech-border/30 hover:text-tech-text-primary'
                        }`}
                      >
                        Flat Bed
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTransportTypeChange('40ft HC Container')}
                        className={`px-2 py-1.5 text-xs font-bold rounded uppercase transition-colors cursor-pointer ${
                          componentTransportType === '40ft HC Container'
                            ? 'bg-tech-accent text-black font-extrabold'
                            : 'bg-tech-panel text-tech-text-secondary border border-tech-border/30 hover:text-tech-text-primary'
                        }`}
                      >
                        40ft HC Container
                      </button>
                    </div>
                  </div>

                  {/* Component Transport Configuration Section */}
                  {componentTransportType === 'Flat Bed' ? (
                    <div>
                      <h4 className="text-[10px] font-bold text-tech-accent uppercase tracking-wider mb-2 font-mono border-b border-tech-border/30 pb-1">
                        Flat Bed Configuration
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                            Physical Length (mm)
                          </label>
                          <input
                            type="number"
                            value={flatBedPhysicalLength}
                            onChange={(e) => setFlatBedPhysicalLength(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                            Usable Length (mm)
                          </label>
                          <input
                            type="number"
                            value={flatBedUsableLength}
                            onChange={(e) => setFlatBedUsableLength(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono font-bold text-tech-accent"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                            Width (mm)
                          </label>
                          <input
                            type="number"
                            value={flatBedWidth}
                            onChange={(e) => setFlatBedWidth(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                            Height (mm)
                          </label>
                          <input
                            type="number"
                            value={flatBedHeight}
                            onChange={(e) => setFlatBedHeight(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                            Payload Capacity (kg)
                          </label>
                          <input
                            type="number"
                            value={flatBedPayloadCapacity}
                            onChange={(e) => setFlatBedPayloadCapacity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono font-bold text-tech-accent"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h4 className="text-[10px] font-bold text-tech-accent uppercase tracking-wider mb-2 font-mono border-b border-tech-border/30 pb-1">
                        40ft HC Container Specs
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                            Internal Length (mm)
                          </label>
                          <input
                            type="number"
                            value={flatBedPhysicalLength}
                            onChange={(e) => setFlatBedPhysicalLength(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                            Usable Length (mm)
                          </label>
                          <input
                            type="number"
                            value={flatBedUsableLength}
                            onChange={(e) => setFlatBedUsableLength(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono font-bold text-tech-accent"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                            Internal Width (mm)
                          </label>
                          <input
                            type="number"
                            value={containerInternalWidth}
                            onChange={(e) => setContainerInternalWidth(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                            Internal Height (mm)
                          </label>
                          <input
                            type="number"
                            value={containerInternalHeight}
                            onChange={(e) => setContainerInternalHeight(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                            Door Width (mm)
                          </label>
                          <input
                            type="number"
                            value={flatBedWidth}
                            onChange={(e) => setFlatBedWidth(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                            Door Height (mm)
                          </label>
                          <input
                            type="number"
                            value={flatBedHeight}
                            onChange={(e) => setFlatBedHeight(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                            Payload Capacity (kg)
                          </label>
                          <input
                            type="number"
                            value={flatBedPayloadCapacity}
                            onChange={(e) => setFlatBedPayloadCapacity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono font-bold text-tech-accent"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Low Bed Configuration Section */}
                  <div>
                    <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2 font-mono border-b border-tech-border/30 pb-1">
                      Low Bed Configuration
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                          Physical Length (mm)
                        </label>
                        <input
                          type="number"
                          value={lowBedPhysicalLength}
                          onChange={(e) => setLowBedPhysicalLength(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                          Usable Length (mm)
                        </label>
                        <input
                          type="number"
                          value={lowBedUsableLength}
                          onChange={(e) => setLowBedUsableLength(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono font-bold text-indigo-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                          Width (mm)
                        </label>
                        <input
                          type="number"
                          value={lowBedWidth}
                          onChange={(e) => setLowBedWidth(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                          Height (mm)
                        </label>
                        <input
                          type="number"
                          value={lowBedHeight}
                          onChange={(e) => setLowBedHeight(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-0.5 font-mono">
                          Payload Capacity (kg)
                        </label>
                        <input
                          type="number"
                          value={lowBedPayloadCapacity}
                          onChange={(e) => setLowBedPayloadCapacity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono font-bold text-indigo-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Excel Upload Area Card */}
            <div className="lg:col-span-7 flex flex-col">
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex-1 border-2 border-dashed rounded-lg p-5 flex flex-col justify-center items-center text-center transition-all cursor-pointer ${
                  isDraggingOver 
                    ? 'border-tech-accent bg-tech-accent/5' 
                    : 'border-tech-border hover:border-tech-text-secondary bg-tech-bg/10'
                }`}
                onClick={() => document.getElementById('excel-file-hidden-input')?.click()}
              >
                <input
                  id="excel-file-hidden-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                
                <div className="p-3 bg-tech-bg/50 rounded-full border border-tech-border/80 text-tech-accent mb-3">
                  <Upload size={22} className={isDraggingOver ? 'animate-bounce' : ''} />
                </div>
                
                <h4 className="text-xs font-bold uppercase tracking-wider text-tech-text-primary font-mono mb-1">
                  Upload Packing Box list Excel Sheet
                </h4>
                <p className="text-[11px] text-tech-text-secondary max-w-sm mb-3">
                  Drag and drop your spreadsheet file here or <span className="text-tech-accent underline">browse files</span>. Supported formats (xls, xlsx, csv).
                </p>

                <div className="text-[10px] text-tech-text-secondary font-mono flex flex-wrap justify-center gap-1.5 uppercase tracking-wide">
                  <span className="bg-tech-bg px-1.5 py-0.5 border border-tech-border rounded text-[9px]">Item Description</span>
                  <span className="bg-tech-bg px-1.5 py-0.5 border border-tech-border rounded text-[9px]">Box Size L x B x H</span>
                  <span className="bg-tech-bg px-1.5 py-0.5 border border-tech-border rounded text-[9px]">Qty / Job</span>
                  <span className="bg-tech-bg px-1.5 py-0.5 border border-tech-border rounded text-[9px]">Total Weight</span>
                </div>
              </div>
            </div>

          </div>

          {/* PARSER ERROR / WARNINGS AND SUCCESS FLAGS */}
          {parserWarnings.length > 0 && (
            <div className="bg-amber-950/20 text-amber-400 p-3 rounded-lg border border-amber-900/30 text-xs space-y-1 font-mono">
              <div className="font-bold uppercase flex items-center gap-1.5 mb-1">
                <AlertTriangle size={14} className="text-amber-500" />
                Upload Parser Alerts ({parserWarnings.length}):
              </div>
              {parserWarnings.map((warn, i) => (
                <div key={i} className="text-[11px] leading-tight">• {warn}</div>
              ))}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-950/25 text-emerald-400 p-3 rounded-lg border border-emerald-900/30 text-xs flex items-center gap-2 font-mono">
              <CheckCircle2 size={15} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* EDITABLE PREVIEW CARGO TABLE SECTION */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <h3 className="text-xs font-bold text-tech-text-primary uppercase tracking-wider font-mono flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-tech-accent text-black font-semibold text-[10px] flex items-center justify-center font-mono">2</span>
                Editable Excel Packing Preview Table
              </h3>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetPreviewToTemplate}
                  className="flex items-center gap-1 py-1.5 px-2.5 text-[10px] uppercase font-mono font-bold text-amber-400 bg-tech-bg hover:bg-tech-border border border-tech-border rounded cursor-pointer transition-colors"
                >
                  <RefreshCw size={11} />
                  Restore Template List
                </button>
                <button
                  type="button"
                  onClick={handleAddManualPreviewRow}
                  className="flex items-center gap-1 py-1.5 px-2.5 text-[10px] uppercase font-mono font-bold text-tech-accent bg-tech-bg hover:bg-tech-border border border-tech-border rounded cursor-pointer transition-colors"
                >
                  <Plus size={11} />
                  Add Row
                </button>
              </div>
            </div>

            {/* Preview table implementation */}
            <div className="overflow-x-auto rounded-lg border border-tech-border bg-tech-bg/10">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-tech-bg/50 border-b border-tech-border text-[9px] uppercase tracking-widest font-bold text-tech-text-secondary font-mono">
                    <th className="p-3 min-w-[200px]">Item Description</th>
                    <th className="p-3 text-center min-w-[260px]">Dimensions (L x W x H mm)</th>
                    <th className="p-3 text-center w-[100px]">Qty / Job</th>
                    <th className="p-3 text-center w-[120px]">Total Weight (kg)</th>
                    <th className="p-3 text-center w-[140px]">Country of Origin</th>
                    <th className="p-3 text-center w-[70px]">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tech-border/20 text-xs font-mono">
                  {importRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-tech-text-secondary text-xs">
                        No components loaded in preview. Drag & drop an Excel box list sheet, or click "Restore Template List" above.
                      </td>
                    </tr>
                  ) : (
                    importRows.map((row) => (
                      <tr key={row.id} className="hover:bg-tech-bg/30 transition-all border-tech-border/10">
                        {/* Description input */}
                        <td className="p-2">
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              value={row.itemDescription}
                              onChange={(e) => handleEditPreviewRow(row.id, 'itemDescription', e.target.value)}
                              className="w-full bg-tech-bg/60 border border-tech-border/50 text-tech-text-primary px-2 py-1 rounded text-xs focus:outline-none focus:border-tech-accent font-sans font-medium"
                            />
                            {isTransformerRollers(row) && (
                              <div className="flex items-center gap-1">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-amber-950/60 text-amber-300 border border-amber-800/50 font-mono font-bold">
                                  Main Unit Associated Component (Low Bed Rollers)
                                </span>
                              </div>
                            )}
                            {isMainTransformerTank(row) && (
                              <div className="flex items-center gap-1">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-indigo-950/60 text-indigo-300 border border-indigo-800/50 font-mono font-bold">
                                  Main Transformer Tank (Low Bed)
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* Dimensions controls */}
                        <td className="p-2">
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              value={row.length}
                              onChange={(e) => handleEditPreviewRow(row.id, 'length', Math.max(0, parseInt(e.target.value, 10)|0))}
                              className="w-20 bg-tech-bg/60 border border-tech-border/50 text-tech-text-primary px-1.5 py-1 rounded text-center text-xs focus:outline-none focus:border-tech-accent font-mono"
                              title="Length (mm)"
                              placeholder="L"
                            />
                            <span className="text-tech-text-secondary/40">×</span>
                            <input
                              type="number"
                              value={row.width}
                              onChange={(e) => handleEditPreviewRow(row.id, 'width', Math.max(0, parseInt(e.target.value, 10)|0))}
                              className="w-20 bg-tech-bg/60 border border-tech-border/50 text-tech-text-primary px-1.5 py-1 rounded text-center text-xs focus:outline-none focus:border-tech-accent font-mono"
                              title="Width (mm)"
                              placeholder="W"
                            />
                            <span className="text-tech-text-secondary/40">×</span>
                            <input
                              type="number"
                              value={row.height}
                              onChange={(e) => handleEditPreviewRow(row.id, 'height', Math.max(0, parseInt(e.target.value, 10)|0))}
                              className="w-20 bg-tech-bg/60 border border-tech-border/50 text-tech-text-primary px-1.5 py-1 rounded text-center text-xs focus:outline-none focus:border-tech-accent font-mono"
                              title="Height (mm)"
                              placeholder="H"
                            />
                          </div>
                        </td>

                        {/* Qty Input */}
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={row.qtyPerJob}
                            onChange={(e) => handleEditPreviewRow(row.id, 'qtyPerJob', Math.max(1, parseInt(e.target.value, 10)||1))}
                            className="w-16 bg-tech-bg/60 border border-tech-border/50 text-tech-text-primary px-1 py-1 rounded text-center text-xs focus:outline-none focus:border-tech-accent font-mono font-bold"
                          />
                        </td>

                        {/* Total Weight Input */}
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.totalWeight}
                            onChange={(e) => handleEditPreviewRow(row.id, 'totalWeight', Math.max(0, parseInt(e.target.value, 10)|0))}
                            className="w-24 bg-tech-bg/60 border border-tech-border/50 text-tech-text-primary px-1.5 py-1 rounded text-center text-xs focus:outline-none focus:border-tech-accent font-mono font-bold"
                          />
                        </td>

                        {/* Country of Origin Input */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.countryOfOrigin}
                            onChange={(e) => handleEditPreviewRow(row.id, 'countryOfOrigin', e.target.value)}
                            placeholder="e.g. India"
                            className={`w-full bg-tech-bg/60 border text-xs px-2.5 py-1 rounded focus:outline-none focus:border-tech-accent font-mono ${
                              row.countryOfOrigin === 'Unknown' || !row.countryOfOrigin
                                ? 'border-red-500 text-red-400 font-bold bg-red-950/35'
                                : 'border-tech-border/50 text-tech-text-primary'
                            }`}
                          />
                        </td>

                        {/* Row removal */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeletePreviewRow(row.id)}
                            className="p-1.5 text-tech-text-secondary hover:text-red-400 transition-colors cursor-pointer"
                            title="Remove accessory from import list"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* CONFIRM AND TRIGGER OPTIMIZATION */}
            {importRows.length > 0 && (
              <div className="mt-5 p-4 rounded-lg bg-tech-accent/5 border border-tech-accent/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-xs">
                  <div className="font-bold text-tech-text-primary flex items-center gap-1.5 font-mono uppercase tracking-wide">
                    <Info size={13} className="text-tech-accent animate-pulse" />
                    Generative Duplication Rules
                  </div>
                  <p className="text-tech-text-secondary mt-1 font-mono text-[11px] leading-relaxed">
                    Will duplicate each box description {numTransformers} times under project scope prefix <span className="text-tech-accent font-bold">"{projectCodeInput.toUpperCase()}"</span>. Weight per box will divide automatically (Total Weight / Qty). Origin checks segregate Oman items.
                  </p>
                </div>
                
                <button
                  type="button"
                  id="btn-confirm-and-optimize"
                  onClick={handleConfirmAndDuplication}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-tech-accent hover:bg-tech-accent-hover text-black font-bold text-xs uppercase rounded cursor-pointer font-mono tracking-widest shadow-lg shadow-tech-accent/15 transition-all self-end md:self-center"
                >
                  Confirm & Duplication Loading Plan
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ======================= TAB 2: ACTIVE REPLICATED BOXES REGISTRY ======================= */}
      {activeWorkspaceTab === 'duplicated-matrix' && (
        <div className="space-y-4 animate-fade-in">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-tech-bg/20 p-3 rounded-lg border border-tech-border">
            <div className="text-xs text-tech-text-secondary font-mono leading-relaxed uppercase">
              THESE ARE THE REAL DUPLICATED BOX ITEMS PREPARED IN CORES FOR THE PACKING ENGINE. YOU MAY SURGICALLY MODIFY OR MANUALLY ADD ONE-OFF CARGOES TO FINE-TUNE FLATS.
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {!isAddingSingle && editingSingleId === null && (
                <button
                  id="btn-add-single-trigger"
                  onClick={() => {
                    resetSingleFieldState();
                    setProjectCodeField(projectCodeInput ? `${projectCodeInput.toUpperCase()}/1` : 'PT0512/1');
                    setIsAddingSingle(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-[10px] uppercase font-mono font-bold text-tech-accent bg-tech-bg hover:bg-tech-border border border-tech-border rounded cursor-pointer transition-colors"
                >
                  <Plus size={11} />
                  Add Manual Accessory
                </button>
              )}
            </div>
          </div>

          {/* Interactive Form for Adding / Editing Single active Items */}
          {(isAddingSingle || editingSingleId !== null) && (
            <form
              id="item-single-input-form"
              onSubmit={editingSingleId !== null ? (e) => { e.preventDefault(); handleSaveEditSingle(editingSingleId); } : handleSaveAddSingle}
              className="bg-tech-bg/50 rounded-lg p-4 border border-tech-border transition-all"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] font-bold text-tech-text-secondary uppercase tracking-wider mb-1 font-mono">
                    Project Code ID
                  </label>
                  <input
                    id="form-single-project"
                    type="text"
                    required
                    value={projectCodeField}
                    onChange={(e) => setProjectCodeField(e.target.value)}
                    placeholder="e.g. PT0512/1"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono placeholder:text-tech-text-secondary/40"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-tech-text-secondary uppercase tracking-wider mb-1 font-mono">
                    Box Description
                  </label>
                  <input
                    id="form-single-name"
                    type="text"
                    required
                    value={componentNameField}
                    onChange={(e) => setComponentNameField(e.target.value)}
                    placeholder="e.g. Radiator Box 1"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent placeholder:text-tech-text-secondary/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-tech-text-secondary uppercase tracking-wider mb-1 font-mono">
                    Country of Origin
                  </label>
                  <input
                    id="form-single-origin"
                    type="text"
                    required
                    value={originField}
                    onChange={(e) => setOriginField(e.target.value)}
                    placeholder="e.g. Oman, India, China, UAE"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent placeholder:text-tech-text-secondary/40 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] font-bold text-tech-text-secondary uppercase tracking-wider mb-1 font-mono">
                    Length (mm)
                  </label>
                  <input
                    id="form-single-length"
                    type="number"
                    required
                    min="100"
                    value={lengthField}
                    onChange={(e) => setLengthField(e.target.value)}
                    placeholder="L (mm)"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-tech-text-secondary uppercase tracking-wider mb-1 font-mono">
                    Width (mm)
                  </label>
                  <input
                    id="form-single-width"
                    type="number"
                    required
                    min="100"
                    value={widthField}
                    onChange={(e) => setWidthField(e.target.value)}
                    placeholder="W (mm)"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-tech-text-secondary uppercase tracking-wider mb-1 font-mono">
                    Height (mm)
                  </label>
                  <input
                    id="form-single-height"
                    type="number"
                    required
                    min="100"
                    value={heightField}
                    onChange={(e) => setHeightField(e.target.value)}
                    placeholder="H (mm)"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-tech-text-secondary uppercase tracking-wider mb-1 font-mono">
                    Weight (kg)
                  </label>
                  <input
                    id="form-single-weight"
                    type="number"
                    required
                    min="1"
                    value={weightField}
                    onChange={(e) => setWeightField(e.target.value)}
                    placeholder="Weight (kg)"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-tech-text-secondary uppercase tracking-wider mb-1 font-mono">
                    Stacking Rules
                  </label>
                  <select
                    id="form-single-stackable"
                    value={stackableField ? 'true' : 'false'}
                    onChange={(e) => setStackableField(e.target.value === 'true')}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono cursor-pointer"
                  >
                    <option value="true">Stackable</option>
                    <option value="false">Fragile / Non-Stackable</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-1.5 pt-2 border-t border-tech-border">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingSingle(false);
                    setEditingSingleId(null);
                    resetSingleFieldState();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-tech-text-primary bg-tech-bg hover:bg-tech-border border border-tech-border rounded font-bold uppercase transition-all font-mono cursor-pointer"
                >
                  <X size={13} />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-black bg-tech-accent hover:bg-tech-accent-hover rounded font-bold uppercase transition-all shadow cursor-pointer"
                >
                  <Check size={13} />
                  {editingSingleId !== null ? 'Save Changes' : 'Insert Item'}
                </button>
              </div>
            </form>
          )}

          {/* Advanced Filtering & Sorting Panel */}
          <div className="bg-tech-bg/40 p-4 rounded-lg border border-tech-border space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-tech-text-primary">
                <Filter size={15} className="text-tech-accent" />
                <span className="text-xs font-bold uppercase tracking-wider font-mono">
                  Filter Active Cargoes
                </span>
                {/* Active Filter Badge */}
                {(filterProjectCode || filterComponentName || filterOrigin || filterMinWeight || filterMaxWeight || filterMinLength || filterMaxLength || filterMinWidth || filterMaxWidth || filterMinHeight || filterMaxHeight) && (
                  <span className="px-2 py-0.5 text-[9px] font-bold bg-tech-accent/20 text-tech-accent border border-tech-accent/30 rounded-full animate-pulse font-mono">
                    Active Filters
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 font-mono">
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-[10px] uppercase font-bold rounded cursor-pointer transition-all border ${
                    showAdvancedFilters 
                      ? 'bg-tech-accent/10 border-tech-accent/30 text-tech-accent' 
                      : 'bg-tech-bg border-tech-border text-tech-text-secondary hover:text-tech-text-primary'
                  }`}
                >
                  <SlidersHorizontal size={11} />
                  {showAdvancedFilters ? 'Hide Advanced Ranges' : 'Show Advanced Ranges'}
                </button>

                {(filterProjectCode || filterComponentName || filterOrigin || filterMinWeight || filterMaxWeight || filterMinLength || filterMaxLength || filterMinWidth || filterMaxWidth || filterMinHeight || filterMaxHeight || sortColumn) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleResetFilters();
                      setSortColumn(null);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-[10px] uppercase font-bold bg-red-950/25 border border-red-900/30 text-red-400 hover:bg-red-900/20 rounded cursor-pointer transition-colors"
                  >
                    <X size={11} />
                    Reset All Filters
                  </button>
                )}
              </div>
            </div>

            {/* Basic Filters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-1 font-mono">
                  Search Project Ref
                </label>
                <input
                  type="text"
                  value={filterProjectCode}
                  onChange={(e) => setFilterProjectCode(e.target.value)}
                  placeholder="Filter by Code..."
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono placeholder:text-tech-text-secondary/30"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-1 font-mono">
                  Search Component Name
                </label>
                <input
                  type="text"
                  value={filterComponentName}
                  onChange={(e) => setFilterComponentName(e.target.value)}
                  placeholder="Filter by Accessory name..."
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent placeholder:text-tech-text-secondary/30"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-tech-text-secondary uppercase tracking-widest mb-1 font-mono">
                  Search Origin
                </label>
                <input
                  type="text"
                  value={filterOrigin}
                  onChange={(e) => setFilterOrigin(e.target.value)}
                  placeholder="Filter by Country..."
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono placeholder:text-tech-text-secondary/30"
                />
              </div>
            </div>

            {/* Advanced Filters (Expandable) */}
            {showAdvancedFilters && (
              <div className="pt-3 border-t border-tech-border/30 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                {/* Weight range */}
                <div className="space-y-1.5">
                  <span className="block text-[9px] font-bold text-tech-accent uppercase tracking-widest font-mono">
                    Weight range (kg)
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filterMinWeight}
                      onChange={(e) => setFilterMinWeight(e.target.value)}
                      className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono text-center"
                    />
                    <span className="text-tech-text-secondary text-xs">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={filterMaxWeight}
                      onChange={(e) => setFilterMaxWeight(e.target.value)}
                      className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono text-center"
                    />
                  </div>
                </div>

                {/* Length range */}
                <div className="space-y-1.5">
                  <span className="block text-[9px] font-bold text-indigo-400 uppercase tracking-widest font-mono">
                    Length range (mm)
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filterMinLength}
                      onChange={(e) => setFilterMinLength(e.target.value)}
                      className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono text-center"
                    />
                    <span className="text-tech-text-secondary text-xs">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={filterMaxLength}
                      onChange={(e) => setFilterMaxLength(e.target.value)}
                      className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono text-center"
                    />
                  </div>
                </div>

                {/* Width range */}
                <div className="space-y-1.5">
                  <span className="block text-[9px] font-bold text-indigo-400 uppercase tracking-widest font-mono">
                    Width range (mm)
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filterMinWidth}
                      onChange={(e) => setFilterMinWidth(e.target.value)}
                      className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono text-center"
                    />
                    <span className="text-tech-text-secondary text-xs">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={filterMaxWidth}
                      onChange={(e) => setFilterMaxWidth(e.target.value)}
                      className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono text-center"
                    />
                  </div>
                </div>

                {/* Height range */}
                <div className="space-y-1.5">
                  <span className="block text-[9px] font-bold text-indigo-400 uppercase tracking-widest font-mono">
                    Height range (mm)
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filterMinHeight}
                      onChange={(e) => setFilterMinHeight(e.target.value)}
                      className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono text-center"
                    />
                    <span className="text-tech-text-secondary text-xs">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={filterMaxHeight}
                      onChange={(e) => setFilterMaxHeight(e.target.value)}
                      className="w-full text-xs px-2 py-1 rounded border border-tech-border bg-tech-bg text-tech-text-primary focus:outline-none focus:border-tech-accent font-mono text-center"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ACTIVE DUPLICATED PARTS LIST TABLE */}
          <div className="overflow-x-auto rounded-lg border border-tech-border">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-tech-bg/50 border-b border-tech-border text-[10px] uppercase tracking-widest font-bold text-tech-text-secondary font-mono">
                  <th className="p-3 cursor-pointer select-none hover:text-tech-accent transition-colors" onClick={() => handleSort('projectCode')}>
                    <div className="flex items-center gap-1">
                      Project Ref
                      {sortColumn === 'projectCode' ? (
                        sortDirection === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                      ) : (
                        <ArrowUpDown size={11} className="opacity-40" />
                      )}
                    </div>
                  </th>
                  <th className="p-3 cursor-pointer select-none hover:text-tech-accent transition-colors" onClick={() => handleSort('componentName')}>
                    <div className="flex items-center gap-1">
                      Duplicated Accessory Description
                      {sortColumn === 'componentName' ? (
                        sortDirection === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                      ) : (
                        <ArrowUpDown size={11} className="opacity-40" />
                      )}
                    </div>
                  </th>
                  <th className="p-3 cursor-pointer select-none hover:text-tech-accent text-right transition-colors font-mono" onClick={() => handleSort('length')}>
                    <div className="flex items-center justify-end gap-1">
                      Length (mm)
                      {sortColumn === 'length' ? (
                        sortDirection === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                      ) : (
                        <ArrowUpDown size={11} className="opacity-40" />
                      )}
                    </div>
                  </th>
                  <th className="p-3 cursor-pointer select-none hover:text-tech-accent text-right transition-colors font-mono" onClick={() => handleSort('width')}>
                    <div className="flex items-center justify-end gap-1">
                      Width (mm)
                      {sortColumn === 'width' ? (
                        sortDirection === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                      ) : (
                        <ArrowUpDown size={11} className="opacity-40" />
                      )}
                    </div>
                  </th>
                  <th className="p-3 cursor-pointer select-none hover:text-tech-accent text-right transition-colors font-mono" onClick={() => handleSort('height')}>
                    <div className="flex items-center justify-end gap-1">
                      Height (mm)
                      {sortColumn === 'height' ? (
                        sortDirection === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                      ) : (
                        <ArrowUpDown size={11} className="opacity-40" />
                      )}
                    </div>
                  </th>
                  <th className="p-3 cursor-pointer select-none hover:text-tech-accent text-right transition-colors font-mono" onClick={() => handleSort('weight')}>
                    <div className="flex items-center justify-end gap-1">
                      Weight (kg)
                      {sortColumn === 'weight' ? (
                        sortDirection === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                      ) : (
                        <ArrowUpDown size={11} className="opacity-40" />
                      )}
                    </div>
                  </th>
                  <th className="p-3 cursor-pointer select-none hover:text-tech-accent text-center transition-colors font-mono" onClick={() => handleSort('origin')}>
                    <div className="flex items-center justify-center gap-1">
                      Origin
                      {sortColumn === 'origin' ? (
                        sortDirection === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                      ) : (
                        <ArrowUpDown size={11} className="opacity-40" />
                      )}
                    </div>
                  </th>
                  <th className="p-3 text-left text-tech-text-secondary select-none font-mono">
                    Stacking / Layer
                  </th>
                  <th className="p-3 text-center text-tech-text-secondary select-none font-mono">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tech-border/30 text-xs text-tech-text-secondary font-mono">
                {filteredAndSortedItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-tech-text-secondary">
                      {items.length === 0
                        ? 'No duplicated boxes populated yet. Switch to "Excel Duplicator Workspace" tab above to import your list.'
                        : 'No items match your active filters. Click "Reset All Filters" to clear.'}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedItems.map((item) => {
                    const isOman = item.origin.toLowerCase() === 'oman';
                    const isRollers = isTransformerRollers(item);
                    const isTank = isMainTransformerTank(item);
                    const status = getLoadingStatus(item.id);

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-tech-bg/30 transition-all ${
                          editingSingleId === item.id ? 'bg-tech-accent/10 text-white' : ''
                        }`}
                      >
                        <td className="p-3 font-medium text-tech-text-primary whitespace-nowrap">
                          {item.projectCode}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-tech-text-primary flex items-center flex-wrap gap-1.5 font-sans">
                            {item.componentName}
                            {isRollers && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-amber-950/60 text-amber-300 border border-amber-800/50 font-mono font-semibold">
                                Main Unit Associated Component (Low Bed Rollers)
                              </span>
                            )}
                            {isTank && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-indigo-950/45 text-indigo-400 border border-indigo-900/30 font-mono font-normal">
                                Heavy Tank (Low Bed)
                              </span>
                            )}
                            {item.stackable === false ? (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-red-950/45 text-red-400 border border-red-900/30 font-mono font-normal">
                                Fragile / Non-Stackable
                              </span>
                            ) : (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-emerald-950/45 text-emerald-400 border border-emerald-900/30 font-mono font-normal">
                                Stackable
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right text-tech-text-secondary">
                          {item.length.toLocaleString()}
                        </td>
                        <td className="p-3 text-right text-tech-text-secondary">
                          {item.width.toLocaleString()}
                        </td>
                        <td className="p-3 text-right text-tech-text-secondary">
                          {item.height.toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-bold text-tech-text-primary">
                          {item.weight.toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-[10px] uppercase font-bold leading-none ${
                              isOman
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-900/30'
                                : 'bg-tech-accent/10 text-tech-accent border border-tech-accent/25'
                            }`}
                          >
                            {item.origin}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[10px] font-bold text-tech-text-primary">
                              {status.truckText}
                            </span>
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-medium leading-none ${status.badgeClass}`}>
                              {status.text}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => startEditSingle(item)}
                              className="p-1 text-tech-text-secondary hover:text-tech-accent transition-colors cursor-pointer"
                              title="Edit Item Parameters"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => onDeleteItem(item.id)}
                              className="p-1 text-tech-text-secondary hover:text-red-400 transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
        </div>
      )}

    </div>
  );
}
