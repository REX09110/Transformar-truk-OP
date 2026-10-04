import React, { useState, useEffect, useMemo } from 'react';
import { TransformerItem, PackedItem, Truck, PackingWarning, ProjectTransportMode } from './types';
import { initialSampleItems } from './utils/sampleData';
import { packItems, getTruckOriginLabel } from './utils/packing';
import { generateLoadingPlanPDF } from './utils/pdfGenerator';
import { calculateLoadBalance } from './utils/loadBalance';
import ItemTable from './components/ItemTable';
import TruckLayout from './components/TruckLayout';
import SummaryCards from './components/SummaryCards';
import { AiAdvisor } from './components/AiAdvisor';
import { LoadBalanceModal } from './components/LoadBalanceModal';
import { Truck as TruckIcon, HelpCircle, FileText, Moon, Sun, Scale, RefreshCw, Layers, Mail, Info } from 'lucide-react';

export default function App() {
  // Application State
  const [items, setItems] = useState<TransformerItem[]>(() => {
    // Attempt local storage load
    const saved = localStorage.getItem('transformer_optimizer_items');
    return saved ? JSON.parse(saved) : initialSampleItems;
  });

  const [flatBedPayloadCapacity, setFlatBedPayloadCapacity] = useState<number>(() => {
    const saved = localStorage.getItem('flat_bed_payload_capacity') || localStorage.getItem('transformer_optimizer_payload');
    return saved ? parseInt(saved, 10) : 25000;
  });

  const [lowBedPayloadCapacity, setLowBedPayloadCapacity] = useState<number>(() => {
    const saved = localStorage.getItem('low_bed_payload_capacity');
    return saved ? parseInt(saved, 10) : 100000;
  });

  // Flat Bed states
  const [flatBedPhysicalLength, setFlatBedPhysicalLength] = useState<number>(() => {
    const saved = localStorage.getItem('flat_bed_physical_length');
    return saved ? parseInt(saved, 10) : 12000;
  });
  const [flatBedUsableLength, setFlatBedUsableLength] = useState<number>(() => {
    const saved = localStorage.getItem('flat_bed_usable_length');
    return saved ? parseInt(saved, 10) : 11800;
  });
  const [flatBedWidth, setFlatBedWidth] = useState<number>(() => {
    const saved = localStorage.getItem('flat_bed_width');
    return saved ? parseInt(saved, 10) : 2340;
  });
  const [flatBedHeight, setFlatBedHeight] = useState<number>(() => {
    const saved = localStorage.getItem('flat_bed_height');
    return saved ? parseInt(saved, 10) : 2500;
  });

  // Low Bed states
  const [lowBedPhysicalLength, setLowBedPhysicalLength] = useState<number>(() => {
    const saved = localStorage.getItem('low_bed_physical_length');
    return saved ? parseInt(saved, 10) : 14000;
  });
  const [lowBedUsableLength, setLowBedUsableLength] = useState<number>(() => {
    const saved = localStorage.getItem('low_bed_usable_length');
    return saved ? parseInt(saved, 10) : 14000;
  });
  const [lowBedWidth, setLowBedWidth] = useState<number>(() => {
    const saved = localStorage.getItem('low_bed_width');
    return saved ? parseInt(saved, 10) : 3000;
  });
  const [lowBedHeight, setLowBedHeight] = useState<number>(() => {
    const saved = localStorage.getItem('low_bed_height');
    return saved ? parseInt(saved, 10) : 4500;
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('transformer_optimizer_theme');
    return saved ? saved === 'dark' : false;
  });

  const [projectTransportMode, setProjectTransportMode] = useState<ProjectTransportMode>(() => {
    const saved = localStorage.getItem('project_transport_mode');
    if (saved === 'flatbed-only' || saved === 'lowbed-only' || saved === 'both') {
      return saved as ProjectTransportMode;
    }
    return 'both';
  });

  const [componentTransportType, setComponentTransportType] = useState<'Flat Bed' | '40ft HC Container'>(() => {
    const saved = localStorage.getItem('component_transport_type');
    return (saved as 'Flat Bed' | '40ft HC Container') || 'Flat Bed';
  });

  const [containerInternalWidth, setContainerInternalWidth] = useState<number>(() => {
    const saved = localStorage.getItem('container_internal_width');
    return saved ? parseInt(saved, 10) : 2350;
  });

  const [containerInternalHeight, setContainerInternalHeight] = useState<number>(() => {
    const saved = localStorage.getItem('container_internal_height');
    return saved ? parseInt(saved, 10) : 2690;
  });

  // Packed trucks state - so we can modify coordinates manually during drag-and-drop
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [unpackedItems, setUnpackedItems] = useState<TransformerItem[]>([]);
  const [warnings, setWarnings] = useState<PackingWarning[]>([]);

  // Track currently active viewing tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory'>('dashboard');

  // Track selected truck for visual blueprint editing
  const [activeTruckId, setActiveTruckId] = useState<string | null>(null);

  // Track active AI Advisor insights for PDF injection
  const [aiInsights, setAiInsights] = useState<any[]>([]);

  // Sync state items to LocalStorage
  useEffect(() => {
    localStorage.setItem('transformer_optimizer_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('flat_bed_payload_capacity', flatBedPayloadCapacity.toString());
  }, [flatBedPayloadCapacity]);

  useEffect(() => {
    localStorage.setItem('low_bed_payload_capacity', lowBedPayloadCapacity.toString());
  }, [lowBedPayloadCapacity]);

  useEffect(() => {
    localStorage.setItem('component_transport_type', componentTransportType);
  }, [componentTransportType]);

  useEffect(() => {
    localStorage.setItem('container_internal_width', containerInternalWidth.toString());
  }, [containerInternalWidth]);

  useEffect(() => {
    localStorage.setItem('container_internal_height', containerInternalHeight.toString());
  }, [containerInternalHeight]);

  useEffect(() => {
    localStorage.setItem('flat_bed_physical_length', flatBedPhysicalLength.toString());
  }, [flatBedPhysicalLength]);
  useEffect(() => {
    localStorage.setItem('flat_bed_usable_length', flatBedUsableLength.toString());
  }, [flatBedUsableLength]);
  useEffect(() => {
    localStorage.setItem('flat_bed_width', flatBedWidth.toString());
  }, [flatBedWidth]);
  useEffect(() => {
    localStorage.setItem('flat_bed_height', flatBedHeight.toString());
  }, [flatBedHeight]);

  useEffect(() => {
    localStorage.setItem('low_bed_physical_length', lowBedPhysicalLength.toString());
  }, [lowBedPhysicalLength]);
  useEffect(() => {
    localStorage.setItem('low_bed_usable_length', lowBedUsableLength.toString());
  }, [lowBedUsableLength]);
  useEffect(() => {
    localStorage.setItem('low_bed_width', lowBedWidth.toString());
  }, [lowBedWidth]);
  useEffect(() => {
    localStorage.setItem('low_bed_height', lowBedHeight.toString());
  }, [lowBedHeight]);

  useEffect(() => {
    localStorage.setItem('project_transport_mode', projectTransportMode);
  }, [projectTransportMode]);

  useEffect(() => {
    localStorage.setItem('transformer_optimizer_theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Run initial or state-triggered optimization
  const runOptimization = (
    currentItems: TransformerItem[],
    fbPayload: number = flatBedPayloadCapacity,
    lbPayload: number = lowBedPayloadCapacity
  ) => {
    const result = packItems(currentItems, fbPayload, {
      transportMode: projectTransportMode,
      componentTransportType,
      flatBed: {
        physicalLength: flatBedPhysicalLength,
        usableLength: flatBedUsableLength,
        width: flatBedWidth,
        height: flatBedHeight,
        payloadCapacity: fbPayload,
        internalWidth: containerInternalWidth,
        internalHeight: containerInternalHeight
      },
      lowBed: {
        physicalLength: lowBedPhysicalLength,
        usableLength: lowBedUsableLength,
        width: lowBedWidth,
        height: lowBedHeight,
        payloadCapacity: lbPayload
      }
    });
    setTrucks(result.trucks);
    setUnpackedItems(result.unpackedItems);
    setWarnings(result.warnings);

    // Default to the first truck if none matches
    if (result.trucks.length > 0) {
      // Keep existing active truck selection if still valid, otherwise select first
      const exists = result.trucks.some(t => t.id === activeTruckId);
      if (!exists) {
        setActiveTruckId(result.trucks[0].id);
      }
    } else {
      setActiveTruckId(null);
    }
  };

  // Run automatically when items or payload limits or truck specs alter
  useEffect(() => {
    runOptimization(items, flatBedPayloadCapacity, lowBedPayloadCapacity);
  }, [
    items,
    flatBedPayloadCapacity,
    lowBedPayloadCapacity,
    projectTransportMode,
    componentTransportType,
    containerInternalWidth,
    containerInternalHeight,
    flatBedPhysicalLength,
    flatBedUsableLength,
    flatBedWidth,
    flatBedHeight,
    lowBedPhysicalLength,
    lowBedUsableLength,
    lowBedWidth,
    lowBedHeight
  ]);

  // Total global weight of items
  const totalWeight = useMemo(() => {
    return items.reduce((sum, item) => sum + item.weight, 0);
  }, [items]);

  // Global floor utilization efficiency
  const overallEfficiency = useMemo(() => {
    if (trucks.length === 0) return 0;
    const totalBedArea = trucks.reduce((sum, t) => sum + (t.lengthLimit * t.widthLimit), 0);
    const totalPackedArea = trucks.reduce((sum, t) => {
      return sum + t.items.reduce((itemSum, pi) => itemSum + (pi.w * pi.l), 0);
    }, 0);
    return Math.min(100, (totalPackedArea / totalBedArea) * 100);
  }, [trucks]);

  // Handles manual updates of item locations inside a specific truck (due to pointer dragging)
  const handleUpdateTruckItems = (truckId: string, updatedPackedItems: PackedItem[]) => {
    setTrucks(prevTrucks =>
      prevTrucks.map(truck => {
        if (truck.id === truckId) {
          return { ...truck, items: updatedPackedItems };
        }
        return truck;
      })
    );
  };

  // Handles updates to a specific truck's properties (e.g. toggling Full Bed mode)
  const handleUpdateTruck = (updatedTruck: Truck) => {
    setTrucks(prevTrucks =>
      prevTrucks.map(truck => (truck.id === updatedTruck.id ? updatedTruck : truck))
    );
  };

  // Move an item manually between trucks
  const handleMoveItemToTruck = (sourceTruckId: string, targetTruckId: string, itemId: string) => {
    setTrucks(prevTrucks => {
      // Find source item
      const sourceTruck = prevTrucks.find(t => t.id === sourceTruckId);
      const packedItem = sourceTruck?.items.find(pi => pi.item.id === itemId);

      if (!sourceTruck || !packedItem) return prevTrucks;

      return prevTrucks.map(truck => {
        // Remove from source truck
        if (truck.id === sourceTruckId) {
          const remainingItems = truck.items.filter(pi => pi.item.id !== itemId);
          let newOriginGroup = truck.originGroup;
          if (remainingItems.length > 0) {
            const hasOman = remainingItems.some(p => p.item.origin.toLowerCase().trim() === 'oman');
            const hasImported = remainingItems.some(p => p.item.origin.toLowerCase().trim() !== 'oman');
            if (hasOman && hasImported) newOriginGroup = 'Dedicated';
            else if (hasOman) newOriginGroup = 'Oman';
            else newOriginGroup = 'Imported';
          }
          return {
            ...truck,
            originGroup: newOriginGroup,
            items: remainingItems
          };
        }
        // Insert into target truck
        if (truck.id === targetTruckId) {
          // Check if it already exists to prevent duplicate insertion
          if (truck.items.some(pi => pi.item.id === itemId)) return truck;

          const targetBedL = truck.lengthLimit || (truck.type === 'Low Bed' ? 14000 : 11800);
          const targetBedW = truck.widthLimit || (truck.type === 'Low Bed' ? 3000 : 2340);

          let w = packedItem.item.length;
          let l = packedItem.item.width;
          let rotated = false;

          // If standard orientation exceeds width but fits when rotated, auto rotate
          if (l > targetBedW && w <= targetBedW && l <= targetBedL) {
            w = packedItem.item.width;
            l = packedItem.item.length;
            rotated = true;
          }

          // Compute a clean placement spot
          let startX = 0;
          let startY = 0;
          if (truck.items.length > 0) {
            const maxX = Math.max(...truck.items.map(pi => pi.x + pi.w));
            if (maxX + w + 50 <= targetBedL) {
              startX = maxX + 50;
            }
          }

          startX = Math.max(0, Math.min(targetBedL - w, startX));
          startY = Math.max(0, Math.min(targetBedW - l, startY));

          const newPacked: PackedItem = {
            item: packedItem.item,
            x: startX,
            y: startY,
            w: w,
            l: l,
            rotated: rotated
          };

          const newItems = [...truck.items, newPacked];
          const hasOman = newItems.some(p => p.item.origin.toLowerCase().trim() === 'oman');
          const hasImported = newItems.some(p => p.item.origin.toLowerCase().trim() !== 'oman');
          let newOriginGroup = truck.originGroup;
          if (hasOman && hasImported) newOriginGroup = 'Dedicated';
          else if (hasOman) newOriginGroup = 'Oman';
          else newOriginGroup = 'Imported';

          return {
            ...truck,
            originGroup: newOriginGroup,
            items: newItems
          };
        }
        return truck;
      });
    });
  };

  // Delete a manual truck (only when empty)
  const handleDeleteTruck = (truckId: string) => {
    const targetTruck = trucks.find(t => t.id === truckId);
    if (!targetTruck) return;

    if (targetTruck.items.length > 0) {
      alert("Please move all items out of this truck before deleting it.");
      return;
    }

    // Filter out the deleted truck
    const remainingTrucks = trucks.filter(t => t.id !== truckId);

    // Smoothly re-index/rename the remaining trucks to match their index by type
    let lowBedCount = 0;
    let flatBedCount = 0;
    const reindexedTrucks = remainingTrucks.map(t => {
      if (t.type === 'Low Bed') {
        lowBedCount++;
        return {
          ...t,
          truckNumber: lowBedCount
        };
      } else {
        flatBedCount++;
        return {
          ...t,
          truckNumber: flatBedCount
        };
      }
    });

    setTrucks(reindexedTrucks);

    // Update active truck selection to the first remaining truck, or null if empty
    if (reindexedTrucks.length > 0) {
      const prevIndex = trucks.findIndex(t => t.id === truckId);
      const nextActiveIndex = Math.min(reindexedTrucks.length - 1, Math.max(0, prevIndex - 1));
      setActiveTruckId(reindexedTrucks[nextActiveIndex].id);
    } else {
      setActiveTruckId(null);
    }
  };

  // Add Item handler
  const handleAddItem = (newItem: TransformerItem) => {
    setItems(prev => [...prev, newItem]);
  };

  // Update Item handler
  const handleUpdateItem = (updatedItem: TransformerItem) => {
    setItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
  };

  // Delete Item handler
  const handleDeleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Bulk import from pasted components/CSV
  const handleBulkImport = (newItems: TransformerItem[]) => {
    setItems(newItems);
  };

  // Return to clean baseline set of standard components
  const handleResetToSample = () => {
    if (confirm('Are you sure you want to revert to the default sample transformer accessory list? This overrides any custom layout positions.')) {
      setItems(initialSampleItems);
      runOptimization(initialSampleItems, flatBedPayloadCapacity, lowBedPayloadCapacity);
    }
  };

  // Force trigger fresh auto-packing
  const handleForceOpt = () => {
    runOptimization(items, flatBedPayloadCapacity, lowBedPayloadCapacity);
  };

  // Export packing layouts to PDF
  const handleExportPDF = (mode: 'flatbed' | 'lowbed' | 'complete') => {
    const doc = generateLoadingPlanPDF(
      trucks,
      unpackedItems,
      totalWeight,
      overallEfficiency,
      flatBedPayloadCapacity,
      mode,
      aiInsights
    );
    let filename = `Voltamp_Loading_Plan_${mode.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
    if (mode === 'complete') {
      filename = `Voltamp_Complete_Loading_Plan_${new Date().toISOString().split('T')[0]}.pdf`;
    }
    doc.save(filename);
  };

  // Currently viewing truck layout
  const activeTruck = trucks.find(t => t.id === activeTruckId) || trucks[0];

  // Load Balance Check state & calculation for the active truck
  const [isLoadBalanceOpen, setIsLoadBalanceOpen] = useState(false);
  const activeTruckBalance = useMemo(() => activeTruck ? calculateLoadBalance(activeTruck) : null, [activeTruck]);

  return (
    <div className={`${isDarkMode ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-800'} min-h-screen font-sans transition-colors duration-250 flex flex-col`}>
      
      {/* PROFESSIONAL GLOBAL LOGISTICS BANNER HEADER */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center sm:items-start select-none">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <h1 className="text-xl font-black tracking-tight uppercase bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
                Transformer Truck Loading Optimizer
              </h1>
              <span className="text-[10px] bg-sky-950 text-sky-400 px-2 py-0.5 rounded font-bold border border-sky-850 font-mono">
                PRO v2.4
              </span>
            </div>
            <div className="text-[8.5px] font-bold tracking-widest text-slate-300 uppercase mt-0.5 text-center sm:text-left w-full">
              Voltamp Power Transformers
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* User Profile Email Indicator */}
            <div className="hidden md:flex flex-col items-start gap-1 px-3 py-1.5 rounded bg-tech-bg/50 border border-tech-border font-mono select-all">
              <div className="flex flex-col leading-tight">
                <span className="text-[8px] uppercase tracking-wider text-slate-400">Prepared by</span>
                <span className="text-[11px] font-bold text-slate-200">Mohammed K. Al AbdulSalam</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-tech-text-primary mt-0.5">
                <Mail size={12} className="text-tech-accent animate-pulse" />
                <span>mk@voltampoman.com</span>
              </div>
            </div>

            {/* Dark Mode Theme indicator button */}
            <button
              onClick={() => setIsDarkMode(prev => !prev)}
              className="p-2.5 rounded bg-tech-bg border border-tech-border text-tech-accent flex items-center justify-center font-mono text-[10px] cursor-pointer hover:bg-tech-panel/80 transition-colors"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Moon size={13} className="text-tech-accent" /> : <Sun size={13} className="text-tech-accent" />}
            </button>
          </div>
        </div>
      </header>

      {/* DASHBOARD OUTER LAYOUT GRID */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-6">
        
        {/* TAB TOGGLES & GLOBAL ACTION BAR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-tech-panel border border-tech-border rounded-xl p-3">
          
          <div className="flex items-center bg-tech-bg p-1 rounded border border-tech-border font-mono">
            <button
              id="tab-btn-dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded uppercase transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-tech-panel text-tech-accent border border-tech-accent/30 shadow-xs'
                  : 'text-tech-text-secondary hover:text-tech-text-primary'
              }`}
            >
              <Layers size={13} />
              Loading Dashboard
            </button>
            <button
              id="tab-btn-inventory"
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded uppercase transition-all cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-tech-panel text-tech-accent border border-tech-accent/30 shadow-xs'
                  : 'text-tech-text-secondary hover:text-tech-text-primary'
              }`}
            >
              <FileText size={13} />
              Parts Matrix ({items.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Force optimization */}
            <button
              id="btn-re-optimize"
              onClick={handleForceOpt}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-tech-bg hover:bg-tech-border border border-tech-border text-tech-text-primary hover:text-tech-accent font-bold text-xs cursor-pointer transition-colors font-mono uppercase"
              title="Reset manual changes and generate clean optimized arrangement"
            >
              <RefreshCw size={13} />
              Auto-Pack Items
            </button>

            {/* LOAD BALANCE CHECK BUTTON */}
            <button
              id="btn-load-balance-check"
              onClick={() => setIsLoadBalanceOpen(true)}
              disabled={!activeTruck || activeTruck.items.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-sky-950/70 hover:bg-sky-900/80 border border-sky-600/50 text-sky-300 hover:text-white font-bold text-xs cursor-pointer transition-all font-mono uppercase shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              title="Analyze weight distribution, Center of Gravity, and balance for selected truck"
            >
              <Scale size={13} className="text-sky-400" />
              <span>Load Balance Check</span>
              {activeTruckBalance && activeTruck.items.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  activeTruckBalance.status === 'GOOD'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/60'
                    : activeTruckBalance.status === 'REVIEW RECOMMENDED'
                    ? 'bg-amber-950 text-amber-400 border border-amber-700/60'
                    : 'bg-red-950 text-red-400 border border-red-700/60'
                }`}>
                  {activeTruckBalance.score}%
                </span>
              )}
            </button>

            {/* Print & PDF Multi-Options */}
            <div className="flex flex-wrap items-center gap-2">
              {projectTransportMode !== 'lowbed-only' && (
                <button
                  id="btn-export-flatbed"
                  onClick={() => handleExportPDF('flatbed')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded bg-tech-bg hover:bg-tech-border border border-tech-border text-tech-text-primary hover:text-tech-accent font-bold text-xs cursor-pointer transition-colors font-mono uppercase"
                  title="Export Flat Bed trucks loading plan only"
                >
                  <FileText size={13} className="text-sky-400" />
                  Flat Bed PDF Only
                </button>
              )}

              {projectTransportMode !== 'flatbed-only' && (
                <button
                  id="btn-export-lowbed"
                  onClick={() => handleExportPDF('lowbed')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded bg-tech-bg hover:bg-red-950/20 border border-red-900/40 text-red-300 hover:text-red-200 font-bold text-xs cursor-pointer transition-colors font-mono uppercase"
                  title="Export Low Bed / ODC heavy trailers loading plan only"
                >
                  <FileText size={13} className="text-red-400 animate-pulse" />
                  Low Bed / ODC PDF Only
                </button>
              )}

              <button
                id="btn-export-complete"
                onClick={() => handleExportPDF('complete')}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-tech-accent hover:bg-tech-accent-hover text-black font-bold text-xs cursor-pointer transition-colors font-mono uppercase shadow"
                title={
                  projectTransportMode === 'flatbed-only'
                    ? 'Export complete Flat Bed loading plan PDF'
                    : projectTransportMode === 'lowbed-only'
                    ? 'Export complete Low Bed loading plan PDF'
                    : 'Export complete combined loading plan (Flat Beds + Low Beds)'
                }
              >
                <FileText size={13} />
                Complete Plan PDF
              </button>
            </div>
          </div>

        </div>

        {/* ----------------- CORE TAB VIEW CONTENTS ----------------- */}
        {activeTab === 'dashboard' ? (
          <div className="space-y-6">
            
            {/* Global Packing stats */}
            <SummaryCards
              trucks={trucks}
              unpackedItems={unpackedItems}
              totalWeight={totalWeight}
              overallEfficiency={overallEfficiency}
            />

            {/* Interactive layout designer */}
            {trucks.length > 0 ? (
              <div className="grid grid-cols-1 gap-6">
                
                {/* Truck selector pills separated by transport type */}
                <div className="flex flex-col gap-3.5 bg-tech-panel/30 p-4 border border-tech-border/50 rounded-xl">
                  {/* Mode Indicator bar */}
                  <div className="flex items-center justify-between pb-1 border-b border-tech-border/30">
                    <span className="text-[11px] font-bold text-tech-text-primary uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <TruckIcon size={14} className="text-tech-accent" />
                      Fleet Allocation
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                      projectTransportMode === 'flatbed-only'
                        ? 'bg-amber-950/40 text-amber-300 border-amber-600/50'
                        : projectTransportMode === 'lowbed-only'
                        ? 'bg-red-950/40 text-red-300 border-red-600/50'
                        : 'bg-tech-panel text-tech-accent border-tech-border'
                    }`}>
                      Mode: {projectTransportMode === 'flatbed-only' ? 'Flat Bed Only' : projectTransportMode === 'lowbed-only' ? 'Low Bed Only' : 'Flat Bed + Low Bed'}
                    </span>
                  </div>

                  {/* Flat Bed segment */}
                  {trucks.filter(t => t.type !== 'Low Bed').length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-tech-text-secondary uppercase tracking-widest mr-2 font-mono whitespace-nowrap min-w-[124px]">Flat Bed Trucks:</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {trucks.filter(t => t.type !== 'Low Bed').map((t) => {
                          const isSelected = activeTruckId === t.id;
                          return (
                            <button
                              key={t.id}
                              onClick={() => setActiveTruckId(t.id)}
                              className={`px-4 py-2 rounded border font-mono font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-tech-accent text-black border-tech-accent shadow'
                                  : 'bg-tech-bg text-tech-text-secondary border-tech-border hover:bg-tech-panel hover:text-tech-text-primary'
                              }`}
                            >
                              Flat Bed #{t.truckNumber} - {getTruckOriginLabel(t)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Horizontal visual divider if both groups exist */}
                  {trucks.filter(t => t.type !== 'Low Bed').length > 0 && trucks.filter(t => t.type === 'Low Bed').length > 0 && (
                    <div className="h-px bg-tech-border/20 my-0.5" />
                  )}

                  {/* Low Bed segment */}
                  {trucks.filter(t => t.type === 'Low Bed').length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-red-500 uppercase tracking-widest mr-2 font-mono whitespace-nowrap min-w-[124px]">Low Bed / ODC:</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {trucks.filter(t => t.type === 'Low Bed').map((t) => {
                          const isSelected = activeTruckId === t.id;
                          return (
                            <button
                              key={t.id}
                              onClick={() => setActiveTruckId(t.id)}
                              className={`px-4 py-2 rounded border font-mono font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-red-500 text-white border-red-500 shadow shadow-red-950/40'
                                  : 'bg-tech-bg text-red-300 border-red-900/40 hover:bg-red-950/45 hover:text-red-200'
                              }`}
                            >
                              Low Bed #{t.truckNumber} - {t.items.length > 0 ? `${t.items[0]?.item.projectCode || ''} ${t.items[0]?.item.componentName || ''}${t.items.length > 1 ? ` (+${t.items.length - 1})` : ''}` : 'Empty'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected Active Truck Sandbox representation */}
                {activeTruck ? (
                  <TruckLayout
                    truck={activeTruck}
                    allTrucks={trucks}
                    onUpdateTruckItems={handleUpdateTruckItems}
                    onMoveItemToTruck={handleMoveItemToTruck}
                    onDeleteTruck={handleDeleteTruck}
                    onOpenBalanceCheck={() => setIsLoadBalanceOpen(true)}
                    onUpdateTruck={handleUpdateTruck}
                  />
                ) : (
                  <div className="text-center p-8 text-tech-text-secondary font-mono">Select a truck from the dashboard index above.</div>
                )}

              </div>
            ) : (
              <div className="bg-tech-panel border border-tech-border rounded-xl p-12 text-center text-tech-text-secondary max-w-xl mx-auto">
                <TruckIcon className="mx-auto text-tech-accent mb-3 animate-bounce" size={48} />
                <h3 className="text-base font-bold text-tech-text-primary uppercase font-mono">No active trucks loaded</h3>
                <p className="text-xs text-tech-text-secondary mt-1">
                  Please add items inside the Parts Matrix tab or click "Reset Samples" to verify the bin-packing optimization.
                </p>
                <button
                  onClick={() => {
                    setItems(initialSampleItems);
                    runOptimization(initialSampleItems, flatBedPayloadCapacity, lowBedPayloadCapacity);
                  }}
                  className="mt-4 px-4 py-2 bg-tech-accent hover:bg-tech-accent-hover text-black text-xs font-bold font-mono uppercase rounded cursor-pointer"
                >
                  Load Predefined Industrial Transformers Kit
                </button>
              </div>
            )}

            {/* Quick Logistics constraints guidelines rule checklist card */}
            <div className="bg-tech-panel border border-tech-border rounded-xl p-5">
              <h4 className="text-xs font-bold uppercase tracking-widest text-tech-text-secondary mb-3 flex items-center gap-1.5 font-mono">
                <Info size={13} className="text-tech-accent" /> Transformer Shipping Security & Packing Constraints Compliance
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-tech-bg/50 p-3 rounded border border-tech-border/50">
                  <div className="font-bold text-tech-text-primary flex items-center gap-1 font-mono uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Origin Segregation
                  </div>
                  <p className="text-[11px] text-tech-text-secondary mt-1 leading-relaxed">
                    Items designated as <strong>Oman</strong> must never share a truck bed with <strong>Imported</strong> elements. The packing engine auto-allocates separate carriers.
                  </p>
                </div>
                <div className="bg-tech-bg/50 p-3 rounded border border-tech-border/50">
                  <div className="font-bold text-tech-text-primary flex items-center gap-1 font-mono uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    Heavy Low-Bed Trailer Rule
                  </div>
                  <p className="text-[11px] text-tech-text-secondary mt-1 leading-relaxed">
                    Any component identified as <strong>Main Transformer Tank</strong> is instantly quarantined onto its own dedicated Low Bed trailer, holding exactly one payload unit.
                  </p>
                </div>
                <div className="bg-tech-bg/50 p-3 rounded border border-tech-border/50">
                  <div className="font-bold text-tech-text-primary flex items-center gap-1 font-mono uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-tech-accent animate-pulse"></span>
                    Interactive Adjustments
                  </div>
                  <p className="text-[11px] text-tech-text-secondary mt-1 leading-relaxed">
                    You can freely drag items within the blueprint. Red outlines flags overlap collisions. Selecting blocks unlocks manual 90-degree rotations.
                  </p>
                </div>
              </div>
            </div>

            {/* MK AI ADVISOR SECTION */}
            <AiAdvisor trucks={trucks} unpackedItems={unpackedItems} onInsightsGenerated={setAiInsights} />

          </div>
        ) : (
          /* PARTS DATA INPUT GRID REGISTRY */
          <div className="space-y-6">
            <ItemTable
              items={items}
              trucks={trucks}
              onAddItem={handleAddItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onBulkImport={handleBulkImport}
              onConfirmImport={() => setActiveTab('dashboard')}
              onResetToSample={handleResetToSample}
              componentTransportType={componentTransportType}
              setComponentTransportType={setComponentTransportType}
              containerInternalWidth={containerInternalWidth}
              setContainerInternalWidth={setContainerInternalWidth}
              containerInternalHeight={containerInternalHeight}
              setContainerInternalHeight={setContainerInternalHeight}
              flatBedPhysicalLength={flatBedPhysicalLength}
              setFlatBedPhysicalLength={setFlatBedPhysicalLength}
              flatBedUsableLength={flatBedUsableLength}
              setFlatBedUsableLength={setFlatBedUsableLength}
              flatBedWidth={flatBedWidth}
              setFlatBedWidth={setFlatBedWidth}
              flatBedHeight={flatBedHeight}
              setFlatBedHeight={setFlatBedHeight}
              lowBedPhysicalLength={lowBedPhysicalLength}
              setLowBedPhysicalLength={setLowBedPhysicalLength}
              lowBedUsableLength={lowBedUsableLength}
              setLowBedUsableLength={setLowBedUsableLength}
              lowBedWidth={lowBedWidth}
              setLowBedWidth={setLowBedWidth}
              lowBedHeight={lowBedHeight}
              setLowBedHeight={setLowBedHeight}
              flatBedPayloadCapacity={flatBedPayloadCapacity}
              setFlatBedPayloadCapacity={setFlatBedPayloadCapacity}
              lowBedPayloadCapacity={lowBedPayloadCapacity}
              setLowBedPayloadCapacity={setLowBedPayloadCapacity}
              projectTransportMode={projectTransportMode}
              setProjectTransportMode={setProjectTransportMode}
            />
          </div>
        )}

      </main>

      {/* COMPACT CLEAN FOOTER */}
      <footer className="mt-auto border-t border-tech-border py-4 text-center text-[10px] text-tech-text-secondary select-none font-mono tracking-wider">
        <p>© 2026 VOLTAMP POWER TRANSFORMERS — Built by Mohammed K. Al AbdulSalam | mk@voltampoman.com</p>
      </footer>

      {/* GLOBAL LOAD BALANCE CHECK MODAL */}
      {activeTruck && activeTruckBalance && (
        <LoadBalanceModal
          isOpen={isLoadBalanceOpen}
          onClose={() => setIsLoadBalanceOpen(false)}
          truck={activeTruck}
          balanceResult={activeTruckBalance}
        />
      )}

    </div>
  );
}
