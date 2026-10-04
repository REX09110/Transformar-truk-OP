import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Truck, PackedItem, TransformerItem } from '../types';
import { isOverlapping, getTruckOriginLabel, getStackingInfo, StackingInfo, repackSingleTruck, isTransformerRollers, isMainTransformerTank } from '../utils/packing';
import { calculateLoadBalance, improveLoadBalance } from '../utils/loadBalance';
import { LoadBalanceModal } from './LoadBalanceModal';
import { Columns, Eye, ChevronRight, RotateCw, Move, Check, AlertCircle, Sparkles, Scale, Info, ArrowLeftRight, Trash2, Crosshair, Layers, Maximize2, Minimize2, Lock } from 'lucide-react';

interface TruckLayoutProps {
  truck: Truck;
  allTrucks: Truck[];
  onUpdateTruckItems: (truckId: string, items: PackedItem[]) => void;
  onMoveItemToTruck: (sourceTruckId: string, targetTruckId: string, itemId: string) => void;
  onDeleteTruck?: (truckId: string) => void;
  onOpenBalanceCheck?: () => void;
  onUpdateTruck?: (updatedTruck: Truck) => void;
}

export default function TruckLayout({
  truck,
  allTrucks,
  onUpdateTruckItems,
  onMoveItemToTruck,
  onDeleteTruck,
  onOpenBalanceCheck,
  onUpdateTruck,
}: TruckLayoutProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showCoGMarker, setShowCoGMarker] = useState(true);
  const [isInternalBalanceOpen, setIsInternalBalanceOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'balance' | 'pack' | 'clearance' } | null>(null);
  const [clearanceWarning, setClearanceWarning] = useState<string | null>(null);

  // Clear clearance warning and active drag state when switching selected truck
  useEffect(() => {
    setClearanceWarning(null);
    if (moveHandlerRef.current) {
      window.removeEventListener('pointermove', moveHandlerRef.current);
      moveHandlerRef.current = null;
    }
    if (upHandlerRef.current) {
      window.removeEventListener('pointerup', upHandlerRef.current);
      window.removeEventListener('pointercancel', upHandlerRef.current);
      upHandlerRef.current = null;
    }
    document.body.style.cursor = '';
    dragStateRef.current = null;
    setDraggingItemId(null);
  }, [truck.id]);

  useEffect(() => {
    return () => {
      if (moveHandlerRef.current) {
        window.removeEventListener('pointermove', moveHandlerRef.current);
      }
      if (upHandlerRef.current) {
        window.removeEventListener('pointerup', upHandlerRef.current);
        window.removeEventListener('pointercancel', upHandlerRef.current);
      }
      document.body.style.cursor = '';
    };
  }, []);

  // Compute live estimated load balance and CoG
  const balanceResult = useMemo(() => calculateLoadBalance(truck), [truck]);

  // 1. IMPROVE BALANCE: Rearrange components on this truck to improve weight distribution and CoG
  const handleImproveBalance = () => {
    if (truck.items.length === 0) return;
    const balancedItems = improveLoadBalance(truck);
    onUpdateTruckItems(truck.id, balancedItems);

    const newBalance = calculateLoadBalance({ ...truck, items: balancedItems });
    setActionNotice({
      message: `Balance: ${newBalance.score}% (${newBalance.status})`,
      type: 'balance'
    });
    setTimeout(() => setActionNotice(null), 3500);
  };

  // 2. AUTO-PACK THIS TRUCK: Re-pack components on this truck to maximize 2D surface space utilization
  const handleAutoPackTruck = () => {
    if (truck.items.length === 0) return;
    const repackedItems = repackSingleTruck(truck);
    onUpdateTruckItems(truck.id, repackedItems);

    const usedArea = repackedItems.reduce((sum, pi) => sum + (pi.w * pi.l), 0) / 1000000;
    const bedArea = (truck.lengthLimit * truck.widthLimit) / 1000000;
    const pct = ((usedArea / bedArea) * 100).toFixed(0);
    setActionNotice({
      message: `Packed: ${pct}% space utilized`,
      type: 'pack'
    });
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Dragging State
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const dragStateRef = useRef<{
    item: PackedItem;
    startMouseSvg: { x: number; y: number };
    startItemPos: { x: number; y: number };
    currentPos: { x: number; y: number };
    currentDelta: { x: number; y: number };
  } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const moveHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);
  const upHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);

  // Constants
  const isLowBed = truck.type === 'Low Bed';
  
  // Physical and Usable Bed Size specifications
  const physicalL = truck.physicalLength || (isLowBed ? 14000 : (truck.type === '40ft HC Container' ? 12030 : 12000));
  const physicalW = truck.physicalWidth || (truck.type === '40ft HC Container' ? 2350 : truck.widthLimit);
  const physicalH = truck.physicalHeight || (truck.type === '40ft HC Container' ? 2690 : truck.heightLimit);

  // Full Bed Mode status
  const isFullBedMode = Boolean(truck.isFullBedMode);

  // Toggle USE FULL BED <-> RESTORE CLEARANCE
  const handleToggleFullBed = () => {
    // Determine the original configured usable length
    const origLimit = truck.originalLengthLimit || (isLowBed ? 13600 : (truck.type === '40ft HC Container' ? 11950 : 11800));

    if (isFullBedMode) {
      // Engineer wants to RESTORE CLEARANCE
      // Check if any component is inside the clearance area (x + w > origLimit)
      const violatingItems = truck.items.filter(pi => (pi.x + pi.w) > origLimit);

      if (violatingItems.length > 0) {
        setClearanceWarning('One or more components are inside the reserved clearance area. Please reposition them before restoring clearance.');
        return;
      }

      // No components in clearance area -> restore clearance
      setClearanceWarning(null);
      if (onUpdateTruck) {
        onUpdateTruck({
          ...truck,
          lengthLimit: origLimit,
          isFullBedMode: false,
        });
      }
      setActionNotice({
        message: `Clearance restored (${physicalL - origLimit} mm)`,
        type: 'clearance'
      });
      setTimeout(() => setActionNotice(null), 3500);
    } else {
      // Engineer wants to USE FULL BED
      setClearanceWarning(null);
      const originalLimitToSave = truck.originalLengthLimit ?? truck.lengthLimit;
      if (onUpdateTruck) {
        onUpdateTruck({
          ...truck,
          originalLengthLimit: originalLimitToSave,
          lengthLimit: physicalL,
          isFullBedMode: true,
        });
      }
      setActionNotice({
        message: `Full bed enabled (${physicalL} mm)`,
        type: 'clearance'
      });
      setTimeout(() => setActionNotice(null), 3500);
    }
  };
  
  // Calculate dynamic safety clearance and limits based on actual used packing length
  const actualUsedLength = truck.items.length > 0 ? Math.max(...truck.items.map(pi => pi.x + pi.w)) : 0;
  const bedClearance = Math.max(0, physicalL - actualUsedLength);
  
  // Total dimensions
  const bedLength = truck.lengthLimit;
  const bedWidth = truck.widthLimit;
  
  // Grid/Visual Offsets inside the SVG coordinate system
  const paddingX = 1400; // room for cabin on the left
  const paddingY = 300;  // padding top/bottom
  const viewBoxW = physicalL + paddingX + 500;
  const viewBoxH = bedWidth + paddingY * 2;

  // Let's compute statistics for this truck
  const totalWeight = truck.items.reduce((sum, pi) => sum + pi.item.weight, 0);
  const usedAreaSqM = truck.items.reduce((sum, pi) => sum + (pi.w * pi.l), 0) / 1000000;
  const bedAreaSqM = (bedLength * bedWidth) / 1000000;
  const areaUsedPercent = Math.min(100, (usedAreaSqM / bedAreaSqM) * 100);
  const areaRemainingPercent = 100 - areaUsedPercent;
  const remainingAreaSqM = Math.max(0, bedAreaSqM - usedAreaSqM);

  // Loading Efficiency Score: A combination of space utilization & weight compliance
  const weightUtilizationPercent = (totalWeight / truck.weightLimit) * 100;
  
  // Composite score (70% area utilization + 30% weight utilization factor, normalized)
  const efficiencyScore = Math.min(100, (areaUsedPercent * 0.7) + (Math.min(100, weightUtilizationPercent) * 0.3));

  // Find currently selected packed item
  const selectedPackedItem = truck.items.find(pi => pi.item.id === selectedItemId);

  // Dropdown state for Move Truck action
  const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside or escape key press
  useEffect(() => {
    if (!isMoveMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMoveMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMoveMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMoveMenuOpen]);

  // Reset dropdown when selected item changes
  useEffect(() => {
    setIsMoveMenuOpen(false);
  }, [selectedItemId]);

  // Refs to always access freshest props/limits without stale closures
  const truckRef = useRef(truck);
  truckRef.current = truck;
  const bedLimitsRef = useRef({ bedLength, bedWidth });
  bedLimitsRef.current = { bedLength, bedWidth };
  const clearanceWarningRef = useRef(clearanceWarning);
  clearanceWarningRef.current = clearanceWarning;

  // Accurate transformation from screen pixels to SVG user space (mm)
  const getSvgPoint = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    try {
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const transformed = pt.matrixTransform(ctm.inverse());
        return { x: transformed.x, y: transformed.y };
      }
    } catch {
      // fallback
    }
    const svgRect = svg.getBoundingClientRect();
    if (svgRect.width === 0 || svgRect.height === 0) return null;
    return {
      x: (clientX - svgRect.left) * (viewBoxW / svgRect.width),
      y: (clientY - svgRect.top) * (viewBoxH / svgRect.height),
    };
  };

  // --- Pointer Event Handlers for Drag & Drop ---
  const handlePointerDown = (e: React.PointerEvent<SVGGElement>, pi: PackedItem) => {
    if (e.button !== 0) return; // Only primary mouse button (left-click)
    e.preventDefault();
    e.stopPropagation();

    setSelectedItemId(pi.item.id);

    const svgPt = getSvgPoint(e.clientX, e.clientY);
    if (!svgPt) return;

    dragStateRef.current = {
      item: pi,
      startMouseSvg: { x: svgPt.x, y: svgPt.y },
      startItemPos: { x: pi.x, y: pi.y },
      currentPos: { x: pi.x, y: pi.y },
      currentDelta: { x: 0, y: 0 },
    };

    setDraggingItemId(pi.item.id);
    document.body.style.cursor = 'grabbing';

    // Remove any previously attached listeners
    if (moveHandlerRef.current) {
      window.removeEventListener('pointermove', moveHandlerRef.current);
    }
    if (upHandlerRef.current) {
      window.removeEventListener('pointerup', upHandlerRef.current);
      window.removeEventListener('pointercancel', upHandlerRef.current);
    }

    const onPointerMove = (moveEvent: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || !svgRef.current) return;
      moveEvent.preventDefault();

      const curSvgPt = getSvgPoint(moveEvent.clientX, moveEvent.clientY);
      if (!curSvgPt) return;

      // Free continuous movement delta in mm space (NO 50MM SNAP WHILE MOVING)
      const deltaX = curSvgPt.x - state.startMouseSvg.x;
      const deltaY = curSvgPt.y - state.startMouseSvg.y;

      let targetX = state.startItemPos.x + deltaX;
      let targetY = state.startItemPos.y + deltaY;

      // Strict bounds constraint within usable truck bed boundaries
      const curBedLength = bedLimitsRef.current.bedLength;
      const curBedWidth = bedLimitsRef.current.bedWidth;
      targetX = Math.max(0, Math.min(curBedLength - state.item.w, targetX));
      targetY = Math.max(0, Math.min(curBedWidth - state.item.l, targetY));

      const finalDeltaX = targetX - state.startItemPos.x;
      const finalDeltaY = targetY - state.startItemPos.y;

      state.currentPos = { x: targetX, y: targetY };
      state.currentDelta = { x: finalDeltaX, y: finalDeltaY };

      // Apply transform directly to the SVG DOM element for smooth, jitter-free 60/120fps tracking
      const gEl = document.getElementById(`drag-g-${state.item.item.id}`);
      if (gEl) {
        gEl.setAttribute('transform', `translate(${finalDeltaX}, ${finalDeltaY})`);
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      upEvent.preventDefault();

      if (moveHandlerRef.current) {
        window.removeEventListener('pointermove', moveHandlerRef.current);
        moveHandlerRef.current = null;
      }
      if (upHandlerRef.current) {
        window.removeEventListener('pointerup', upHandlerRef.current);
        window.removeEventListener('pointercancel', upHandlerRef.current);
        upHandlerRef.current = null;
      }
      document.body.style.cursor = '';

      const state = dragStateRef.current;
      if (!state) {
        setDraggingItemId(null);
        return;
      }

      const { item, currentPos } = state;

      // Clean up DOM transform before committing React state
      const gEl = document.getElementById(`drag-g-${item.item.id}`);
      if (gEl) {
        gEl.removeAttribute('transform');
      }

      // SNAP TO 50 MM GRID ONLY AFTER RELEASE
      let finalX = Math.round(currentPos.x / 50) * 50;
      let finalY = Math.round(currentPos.y / 50) * 50;

      // Re-verify bounds after snap
      const curBedLength = bedLimitsRef.current.bedLength;
      const curBedWidth = bedLimitsRef.current.bedWidth;
      finalX = Math.max(0, Math.min(curBedLength - item.w, finalX));
      finalY = Math.max(0, Math.min(curBedWidth - item.l, finalY));

      dragStateRef.current = null;
      setDraggingItemId(null);

      // Save final position and recalculate the truck ONCE after release
      if (finalX !== item.x || finalY !== item.y) {
        const curTruck = truckRef.current;
        const updatedItems = curTruck.items.map(p => {
          if (p.item.id === item.item.id) {
            return { ...p, x: finalX, y: finalY };
          }
          return p;
        });

        onUpdateTruckItems(curTruck.id, updatedItems);

        // Auto-clear clearance warning if violating components were dragged back into safe bounds
        if (clearanceWarningRef.current) {
          const origLimit = curTruck.originalLengthLimit || (isLowBed ? 13600 : (curTruck.type === '40ft HC Container' ? 11950 : 11800));
          const stillViolating = updatedItems.some(p => (p.x + p.w) > origLimit);
          if (!stillViolating) {
            setClearanceWarning(null);
          }
        }
      }
    };

    moveHandlerRef.current = onPointerMove;
    upHandlerRef.current = onPointerUp;

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerUp, { passive: false });
  };

  // --- Manual Rotate Button Trigger ---
  const handleRotateItem = (itemId: string) => {
    const updatedItems = truck.items.map(pi => {
      if (pi.item.id === itemId) {
        // Swap dimensions
        const newW = pi.l;
        const newL = pi.w;

        // Ensure rotated bounds fit inside the bed truck borders
        let newX = pi.x;
        let newY = pi.y;
        if (newX + newW > bedLength) {
          newX = Math.max(0, bedLength - newW);
        }
        if (newY + newL > bedWidth) {
          newY = Math.max(0, bedWidth - newL);
        }

        return {
          ...pi,
          w: newW,
          l: newL,
          x: newX,
          y: newY,
          rotated: !pi.rotated,
        };
      }
      return pi;
    });

    onUpdateTruckItems(truck.id, updatedItems);
  };

  // Render SVG Elements of placed objects
  const renderVisualComponents = () => {
    const stacking = getStackingInfo(truck.items);

    // Sort items so that higher layer items are rendered later (drawn on top)
    // FORCE actively dragged item to be drawn last so it has the absolute highest z-index / layer depth in SVG
    const sortedItemsForDraw = [...truck.items].sort((a, b) => {
      if (a.item.id === draggingItemId) return 1;
      if (b.item.id === draggingItemId) return -1;
      const layerA = stacking[a.item.id]?.layer || 1;
      const layerB = stacking[b.item.id]?.layer || 1;
      return layerA - layerB;
    });

    return sortedItemsForDraw.map((pi) => {
      const isSelected = selectedItemId === pi.item.id;
      const isDragging = draggingItemId === pi.item.id;
      const isOman = pi.item.origin.toLowerCase() === 'oman';

      const itemStack = stacking[pi.item.id] || { layer: 1, loadedOnId: null, stackedItemIds: [] };
      const isStacked = itemStack.layer > 1;
      const isBottomLayer = itemStack.stackedItemIds.length > 0;

      // Color scheme based on Origin status
      let fillClass = isOman 
        ? 'fill-amber-500/10 hover:fill-amber-500/20 stroke-amber-500' 
        : 'fill-tech-accent/15 hover:fill-tech-accent/25 stroke-tech-accent';
      
      let textClass = isOman ? 'fill-amber-400' : 'fill-tech-accent';
      
      if (isSelected) {
        fillClass = isOman 
          ? 'fill-amber-500/30 hover:fill-amber-500/40 stroke-amber-300' 
          : 'fill-tech-accent/30 hover:fill-tech-accent/40 stroke-white';
      }

      // Exploded Offset View: Add a 150mm offset per layer on the SVG canvas (creates a subtle 3D layered/stacked effect)
      const offset = (itemStack.layer - 1) * 150;
      const rectX = paddingX + pi.x + offset;
      const rectY = paddingY + pi.y + offset;
      const rectW = pi.w;
      const rectH = pi.l;

      // Determine if component box is large enough to show Item ID + Short Component Name
      const isLarge = rectW >= 650 && rectH >= 380;

      // Determine stacking labels
      const underPi = itemStack.loadedOnId ? truck.items.find(t => t.item.id === itemStack.loadedOnId) : null;
      const underNum = underPi ? truck.items.indexOf(underPi) + 1 : null;
      const currentNum = truck.items.indexOf(pi) + 1;
      const itemIdText = underNum ? `#${currentNum}/${underNum}` : `#${currentNum}`;

      // Short component name formatted for clean in-box display
      const rawCompName = (pi.item.componentName || '').trim().toUpperCase();
      const maxNameChars = Math.max(5, Math.floor((rectW - 80) / 52));
      const shortCompName = rawCompName.length > maxNameChars 
        ? rawCompName.slice(0, maxNameChars - 1) + '…' 
        : rawCompName;

      return (
        <g 
          key={pi.item.id} 
          id={`drag-g-${pi.item.id}`}
          className="cursor-grab active:cursor-grabbing select-none"
          style={{ 
            opacity: isBottomLayer && !isDragging ? 0.65 : 1, 
            filter: isDragging ? 'drop-shadow(0 14px 28px rgba(0, 0, 0, 0.75))' : undefined,
            touchAction: 'none'
          }}
          transform={isDragging && dragStateRef.current ? `translate(${dragStateRef.current.currentDelta.x}, ${dragStateRef.current.currentDelta.y})` : undefined}
          onPointerDown={(e) => handlePointerDown(e, pi)}
        >
          {/* Main Component Rectangle */}
          <rect
            x={rectX}
            y={rectY}
            width={rectW}
            height={rectH}
            rx={60} // Rounded visual corners
            ry={60}
            className={`${fillClass} transition-colors duration-75`}
            strokeWidth={isDragging ? 3 : (isSelected ? 2.5 : 1.5)}
            strokeDasharray={isBottomLayer ? "30,15" : undefined}
            style={{ vectorEffect: 'non-scaling-stroke' }}
          />

          {/* Draggable Highlight Border */}
          {isSelected && (
            <rect
              x={rectX}
              y={rectY}
              width={rectW}
              height={rectH}
              rx={60}
              ry={60}
              fill="none"
              stroke="#0ea5e9"
              strokeWidth={2}
              strokeDasharray="8,4"
              style={{ vectorEffect: 'non-scaling-stroke' }}
              className="pointer-events-none"
            />
          )}

          {/* Labels inside 2D Blueprint box */}
          {isLarge ? (
            /* Large components: Item ID + Short Component Name */
            <g className="pointer-events-none select-none">
              <text
                x={rectX + rectW / 2}
                y={rectY + rectH / 2 - 20}
                textAnchor="middle"
                fontSize={115}
                fontWeight="900"
                className={`${textClass} font-mono`}
              >
                {itemIdText}
              </text>
              <text
                x={rectX + rectW / 2}
                y={rectY + rectH / 2 + 75}
                textAnchor="middle"
                fontSize={88}
                fontWeight="bold"
                className={`${textClass} font-sans opacity-90`}
              >
                {shortCompName}
              </text>
            </g>
          ) : (
            /* Small components: show only Item ID */
            <text
              x={rectX + rectW / 2}
              y={rectY + rectH / 2 + Math.min(140, Math.max(45, Math.min(rectW * 0.35, rectH * 0.45))) * 0.35}
              textAnchor="middle"
              fontSize={Math.min(140, Math.max(70, Math.min(rectW * 0.35, rectH * 0.45)))}
              fontWeight="900"
              className={`${textClass} pointer-events-none font-mono font-bold`}
            >
              {itemIdText}
            </text>
          )}
        </g>
      );
    });
  };

  // Filter available target trucks based on item rules
  const isSelectedRollers = selectedPackedItem ? isTransformerRollers(selectedPackedItem.item) : false;
  const isSelectedTank = selectedPackedItem ? isMainTransformerTank(selectedPackedItem.item) : false;

  // All other target trucks available for manual movement (Flat Bed, Low Bed, 40ft HC, all origins)
  // Constraint: Transformer Rollers must always travel with their corresponding Main Transformer on the same Low Bed.
  // Never allocate Main Transformer Rollers to a Flat Bed when the corresponding Main Transformer is transported by Low Bed.
  // Never assign the rollers of one transformer to another transformer's Low Bed.
  const availableTargetTrucks = allTrucks.filter(t => {
    if (t.id === truck.id) return false;
    if (isSelectedTank && t.type !== 'Low Bed') return false;
    if (isSelectedRollers && truck.type === 'Low Bed') return false;
    return true;
  });

  return (
    <div className="bg-tech-panel border border-tech-border rounded-xl p-5 flex flex-col lg:flex-row gap-6">
      
      {/* LEFT: Truck Statistics & Quick Parameters Panel */}
      <div className="w-full lg:w-80 shrink-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between">
            <div>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-2 font-mono ${
                truck.originGroup === 'Oman' 
                  ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30' 
                  : truck.originGroup === 'Imported'
                  ? 'bg-tech-accent/10 text-tech-accent border border-tech-accent/20'
                  : 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/30'
              }`}>
                {truck.originGroup === 'Dedicated' ? 'Dedicated Rig' : `Origin: ${getTruckOriginLabel(truck)}`}
              </span>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-tech-text-primary">
                  {truck.type} #{truck.truckNumber}
                </h3>
                {onDeleteTruck && (
                  <button
                    onClick={() => onDeleteTruck(truck.id)}
                    className="p-1 rounded text-red-400 hover:bg-red-950/40 hover:text-red-300 border border-transparent hover:border-red-900/40 transition-colors cursor-pointer flex items-center justify-center"
                    title="Delete Empty Truck"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="text-right">
              <span className={`inline-block text-xl font-extrabold px-2.5 py-1 rounded-lg ${
                efficiencyScore > 80 
                  ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' 
                  : efficiencyScore > 50 
                  ? 'bg-amber-950/20 text-amber-400 border border-amber-900/30' 
                  : 'bg-red-950/20 text-red-400 border border-red-900/30'
              }`}>
                {efficiencyScore.toFixed(0)}%
              </span>
              <div className="text-[9px] font-semibold text-tech-text-secondary tracking-wider uppercase mt-1">Efficiency</div>
            </div>
          </div>

          <div className="h-px bg-tech-border my-3"></div>

          {/* Trailer Specifications Block */}
          <div className="bg-tech-bg/30 border border-tech-border rounded-lg p-3 mb-4 text-xs">
            <h4 className="text-[10px] font-bold text-tech-text-secondary uppercase tracking-wider mb-2 font-mono">
              Trailer Specifications
            </h4>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-tech-text-secondary">Physical Bed:</span>
                <span className="text-tech-text-primary font-bold">{physicalL} × {physicalW} × {physicalH} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tech-text-secondary">Usable Packing:</span>
                <span className="text-tech-accent font-bold">{truck.lengthLimit} × {truck.widthLimit} × {truck.heightLimit} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tech-text-secondary">Reserved Clearance:</span>
                <span className="text-indigo-400 font-medium">{Math.max(0, physicalL - truck.lengthLimit)} mm</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics rows */}
          <div className="space-y-2 mt-4 text-xs">
            <div className="flex justify-between items-center text-tech-text-secondary">
              <span className="flex items-center gap-1.5"><Columns size={13} /> Space Occupied</span>
              <span className="font-semibold text-tech-text-primary font-mono">
                {usedAreaSqM.toFixed(2)} m² ({areaUsedPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-tech-bg h-1.5 rounded-full overflow-hidden">
              <div className="bg-tech-accent h-1.5 animate-pulse" style={{ width: `${areaUsedPercent}%` }}></div>
            </div>

            <div className="flex justify-between items-center text-tech-text-secondary mt-2">
              <span className="flex items-center gap-1.5"><Eye size={13} /> Remaining Area</span>
              <span className="font-semibold text-tech-text-primary font-mono">
                {remainingAreaSqM.toFixed(2)} m² ({areaRemainingPercent.toFixed(1)}%)
              </span>
            </div>

            <div className="flex justify-between items-center text-tech-text-secondary pt-1">
              <span className="flex items-center gap-1.5"><Scale size={13} /> Accumulated Weight</span>
              <span className="font-semibold text-tech-text-primary font-mono">
                {totalWeight.toLocaleString()} kg / {truck.weightLimit.toLocaleString()} kg
              </span>
            </div>
            <div className="w-full bg-tech-bg h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-1.5 ${weightUtilizationPercent > 95 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                style={{ width: `${Math.min(100, weightUtilizationPercent)}%` }}
              ></div>
            </div>

            <div className="flex justify-between items-center text-tech-text-secondary pt-1">
              <span>Included Accessories</span>
              <span className="font-semibold text-tech-text-primary">
                {truck.items.length} units
              </span>
            </div>
          </div>
        </div>

        {/* Selected Component Quick Action details */}
        <div className="mt-6">
          {selectedPackedItem ? (
            <div className="bg-tech-bg/50 rounded-lg p-3 border border-tech-border text-xs shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold bg-tech-accent/15 px-1.5 py-0.5 rounded text-tech-accent border border-tech-accent/30">
                    Item #{truck.items.indexOf(selectedPackedItem) + 1}
                  </span>
                  <span className="font-mono text-[10px] bg-tech-bg px-1.5 py-0.5 rounded text-tech-text-secondary border border-tech-border">
                    {selectedPackedItem.item.projectCode}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-tech-text-secondary uppercase">Selected</span>
              </div>
              
              <h4 className="font-bold text-tech-text-primary break-words text-xs leading-normal mb-2" title={selectedPackedItem.item.componentName}>
                {selectedPackedItem.item.componentName}
              </h4>

              <div className="space-y-1 text-[11px] font-mono border-t border-tech-border/50 pt-2 mb-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-tech-text-secondary font-sans text-[10px]">Country of Origin:</span>
                  <span className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                    selectedPackedItem.item.origin?.toLowerCase() === 'oman'
                      ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30'
                      : 'bg-tech-accent/10 text-tech-accent border border-tech-accent/20'
                  }`}>
                    {selectedPackedItem.item.origin || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-tech-text-secondary font-sans">Dimensions:</span>
                  <span className="text-tech-text-primary">{selectedPackedItem.item.length} × {selectedPackedItem.item.width} × {selectedPackedItem.item.height} mm</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-tech-text-secondary font-sans">Weight:</span>
                  <span className="text-tech-text-primary">{selectedPackedItem.item.weight.toLocaleString()} kg</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-tech-text-secondary font-sans">Coordinates:</span>
                  <span className="text-tech-text-primary">({selectedPackedItem.x}, {selectedPackedItem.y}) mm</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-tech-text-secondary font-sans">Rotation:</span>
                  <span className="text-tech-accent">{selectedPackedItem.rotated ? 'Rotated 90°' : 'Standard 0°'}</span>
                </div>
              </div>

              {/* Main Transformer Rollers Allocation Rule Notice */}
              {isSelectedRollers && truck.type === 'Low Bed' && (
                <div className="text-[10px] text-amber-300 bg-amber-950/40 border border-amber-800/40 p-1.5 rounded mb-2 font-mono flex items-center gap-1.5">
                  <Lock size={12} className="text-amber-400 shrink-0" />
                  <span>Rollers travel with {selectedPackedItem.item.projectCode} on this Low Bed. Reposition/rotate within bed freely.</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  id={`btn-rotate-${selectedPackedItem.item.id}`}
                  onClick={() => handleRotateItem(selectedPackedItem.item.id)}
                  className="flex items-center justify-center gap-1.5 py-1 rounded bg-tech-bg hover:bg-tech-border border border-tech-border text-tech-text-primary hover:text-tech-accent font-semibold text-[11px] h-7 transition-colors cursor-pointer"
                  title="Rotate component 90 degrees"
                >
                  <RotateCw size={12} className="text-tech-accent" />
                  Rotate 90°
                </button>

                {isSelectedRollers && truck.type === 'Low Bed' ? (
                  <button
                    disabled
                    title="Main Transformer Rollers must travel with their corresponding Main Transformer on this Low Bed"
                    className="flex items-center justify-center gap-1.5 py-1 rounded bg-tech-bg/50 border border-amber-800/30 text-amber-400/80 font-semibold text-[10px] h-7 cursor-not-allowed"
                  >
                    <Lock size={11} />
                    Fixed to Low Bed
                  </button>
                ) : availableTargetTrucks.length > 0 ? (
                  <div className="relative" ref={dropdownRef}>
                    <button 
                      onClick={() => setIsMoveMenuOpen(prev => !prev)}
                      className="flex items-center justify-center gap-1.5 w-full py-1 rounded bg-tech-bg hover:bg-tech-border border border-tech-border text-tech-text-primary hover:text-tech-accent font-semibold text-[11px] h-7 cursor-pointer"
                    >
                      <Move size={12} className="text-amber-500" />
                      Move Truck
                    </button>
                    {/* Floating mini target truck picker */}
                    {isMoveMenuOpen && (
                      <div className="absolute bottom-full left-0 right-0 min-w-[210px] bg-tech-panel border border-tech-border rounded-lg shadow-xl mb-1 z-30 overflow-hidden text-left max-h-64 overflow-y-auto">
                        <div className="px-2.5 py-1.5 bg-tech-bg font-bold text-[9px] text-tech-text-secondary border-b border-tech-border sticky top-0 flex items-center justify-between z-10">
                          <span>MOVE TO TRUCK:</span>
                          <span className="text-[9px] text-tech-accent font-mono">{availableTargetTrucks.length} options</span>
                        </div>
                        <div className="divide-y divide-tech-border/30">
                          {availableTargetTrucks.map(target => {
                            const isTargetLowBed = target.type === 'Low Bed';
                            const targetOrigin = getTruckOriginLabel(target);
                            const targetWeight = target.items.reduce((sum, pi) => sum + pi.item.weight, 0);
                            return (
                              <button
                                key={target.id}
                                onClick={() => {
                                  onMoveItemToTruck(truck.id, target.id, selectedPackedItem.item.id);
                                  setIsMoveMenuOpen(false);
                                }}
                                className="block w-full text-left px-2.5 py-2 hover:bg-tech-bg transition-colors cursor-pointer"
                              >
                                <div className="flex items-center justify-between">
                                  <span className={`font-bold font-mono text-[11px] ${isTargetLowBed ? 'text-red-400' : 'text-tech-accent'}`}>
                                    {target.type} #{target.truckNumber}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-tech-bg border border-tech-border/60 text-tech-text-secondary font-mono">
                                    {targetOrigin}
                                  </span>
                                </div>
                                <div className="text-[9px] text-tech-text-secondary mt-1 flex items-center justify-between">
                                  <span>{target.items.length} {target.items.length === 1 ? 'item' : 'items'}</span>
                                  <span className="font-mono">{(targetWeight / 1000).toFixed(1)}t / {(target.weightLimit / 1000).toFixed(0)}t</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    disabled
                    className="flex items-center justify-center gap-1 py-1 rounded bg-tech-bg border border-tech-border text-tech-text-secondary font-semibold text-[10px] h-7 opacity-50"
                  >
                    No other trucks
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-tech-bg/40 rounded-lg p-3 border border-tech-border text-center text-[11px] text-tech-text-secondary flex flex-col items-center justify-center min-h-[90px]">
              <Sparkles className="mb-1 text-tech-accent/80" size={16} />
              <span>Click any loaded part block to unlock quick manual actions, rotations, and migrations.</span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Top-Down Visual Truck Layout Representation Card */}
      <div className="flex-1 bg-tech-bg rounded-xl border border-tech-border overflow-hidden flex flex-col justify-between">
        
        {/* Visual Bed Header */}
        <div className="px-4 py-2.5 bg-tech-panel text-xs font-semibold text-tech-text-primary flex flex-wrap items-center justify-between gap-2 border-b border-tech-border">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-tech-accent animate-pulse"></span>
              Top-Down Blueprint Layout Viewer
            </span>

            {/* Quick Load Balance status indicator button */}
            <button
              id={`btn-truck-balance-check-${truck.id}`}
              onClick={() => {
                if (onOpenBalanceCheck) {
                  onOpenBalanceCheck();
                } else {
                  setIsInternalBalanceOpen(true);
                }
              }}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                balanceResult.status === 'GOOD'
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-700/60 hover:bg-emerald-900/40'
                  : balanceResult.status === 'REVIEW RECOMMENDED'
                  ? 'bg-amber-950/40 text-amber-400 border-amber-700/60 hover:bg-amber-900/40'
                  : 'bg-red-950/40 text-red-400 border-red-700/60 hover:bg-red-900/40'
              }`}
              title="Click to open Estimated Cargo Load Balance Check"
            >
              <Scale size={11} />
              <span>Est. Balance: {balanceResult.score}% ({balanceResult.status})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* ACTION NOTICE TOAST BADGE */}
            {actionNotice && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all animate-pulse ${
                actionNotice.type === 'balance'
                  ? 'bg-sky-950/90 text-sky-300 border-sky-500/80 shadow-xs'
                  : actionNotice.type === 'clearance'
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/80 shadow-xs'
                  : 'bg-indigo-950/90 text-indigo-300 border-indigo-500/80 shadow-xs'
              }`}>
                ✓ {actionNotice.message}
              </span>
            )}

            {/* USE FULL BED / RESTORE CLEARANCE BUTTON (Selected Truck Only) */}
            <button
              id={`btn-toggle-full-bed-${truck.id}`}
              onClick={handleToggleFullBed}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1.5 border transition-all cursor-pointer shadow-xs uppercase ${
                isFullBedMode
                  ? 'bg-amber-950/80 hover:bg-amber-900/90 text-amber-300 hover:text-white border-amber-500/70 ring-1 ring-amber-500/40'
                  : 'bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 hover:text-white border-emerald-600/60'
              }`}
              title={
                isFullBedMode
                  ? 'Restore original configured usable length and reserved clearance'
                  : 'Temporarily remove reserved clearance and use full physical truck bed length during manual rearrangement'
              }
            >
              {isFullBedMode ? (
                <Minimize2 size={11} className="text-amber-400" />
              ) : (
                <Maximize2 size={11} className="text-emerald-400" />
              )}
              <span>{isFullBedMode ? 'RESTORE CLEARANCE' : 'USE FULL BED'}</span>
            </button>

            {/* 1. IMPROVE BALANCE */}
            <button
              id={`btn-improve-balance-${truck.id}`}
              onClick={handleImproveBalance}
              disabled={truck.items.length === 0}
              className="px-2.5 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1.5 border transition-all cursor-pointer shadow-xs bg-sky-950/70 hover:bg-sky-900/90 text-sky-300 hover:text-white border-sky-600/60 disabled:opacity-40 disabled:cursor-not-allowed uppercase"
              title="Rearrange only the components on this truck to improve Front/Rear & Left/Right balance and center the Cargo CoG"
            >
              <Scale size={11} className="text-sky-400" />
              <span>IMPROVE BALANCE</span>
            </button>

            {/* 2. AUTO-PACK THIS TRUCK */}
            <button
              id={`btn-autopack-truck-${truck.id}`}
              onClick={handleAutoPackTruck}
              disabled={truck.items.length === 0}
              className="px-2.5 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1.5 border transition-all cursor-pointer shadow-xs bg-indigo-950/70 hover:bg-indigo-900/90 text-indigo-300 hover:text-white border-indigo-600/60 disabled:opacity-40 disabled:cursor-not-allowed uppercase"
              title="Re-pack only the components on this truck to maximize 2D surface space utilization"
            >
              <Layers size={11} className="text-indigo-400" />
              <span>AUTO-PACK THIS TRUCK</span>
            </button>

            {/* Toggle CoG Marker Button */}
            <button
              onClick={() => setShowCoGMarker(prev => !prev)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer flex items-center gap-1 ${
                showCoGMarker
                  ? 'bg-tech-accent/15 text-tech-accent border-tech-accent/40'
                  : 'bg-tech-bg text-tech-text-secondary border-tech-border'
              }`}
              title={showCoGMarker ? 'Hide Estimated Cargo CoG Marker' : 'Show Estimated Cargo CoG Marker'}
            >
              <Crosshair size={10} />
              <span>CoG: {showCoGMarker ? 'ON' : 'OFF'}</span>
            </button>

            <div className="font-mono text-right text-[10px] leading-tight flex flex-col items-end min-w-32">
              <span className="text-tech-text-primary font-bold">
                BED: {physicalL} × {physicalW} × {physicalH} mm
              </span>
              <span className="text-tech-accent font-extrabold">
                USABLE: {truck.lengthLimit} mm
              </span>
            </div>
          </div>
        </div>

        {/* CLEARANCE WARNING BANNER */}
        {clearanceWarning && (
          <div
            id="clearance-warning-banner"
            className="mx-4 mt-3 p-3 bg-amber-950/90 border border-amber-500/90 text-amber-200 rounded-lg flex items-center justify-between gap-3 text-xs font-mono shadow-md animate-pulse"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-400 shrink-0" />
              <span className="font-semibold leading-relaxed">{clearanceWarning}</span>
            </div>
            <button
              onClick={() => setClearanceWarning(null)}
              className="text-amber-400 hover:text-white text-[10px] px-2 py-0.5 rounded border border-amber-600/60 hover:bg-amber-800/60 cursor-pointer shrink-0 uppercase font-bold"
            >
              DISMISS
            </button>
          </div>
        )}

        {/* SVG Drawing Bed Container */}
        <div className="p-4 flex items-center justify-center flex-1 min-h-[160px] max-h-[300px] overflow-hidden lg:max-h-[360px]">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
            className="w-full h-auto select-none pointer-events-auto"
            style={{ touchAction: 'none' }}
          >
            <defs>
              <pattern id="clearanceHatch" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="40" stroke="#ef4444" strokeWidth="10" opacity="0.3" />
              </pattern>
            </defs>
            {/* --- VISUAL TRUCK CABIN DRAWING --- */}
            <g className="opacity-90">
              {/* Main alloy truck cab shell */}
              <path
                d={`M 150,${paddingY + (bedWidth * 0.15)} 
                   L 800,${paddingY + (bedWidth * 0.15)} 
                   C 1050,${paddingY + (bedWidth * 0.15)} 1200,${paddingY + (bedWidth * 0.25)} 1220,${paddingY + (bedWidth * 0.4)} 
                   L 1250,${paddingY + (bedWidth * 0.6)} 
                   C 1220,${paddingY + (bedWidth * 0.75)} 1050,${paddingY + (bedWidth * 0.85)} 800,${paddingY + (bedWidth * 0.85)} 
                   L 150,${paddingY + (bedWidth * 0.85)} Z`}
                fill="#2c2e33"
                stroke="#475569"
                strokeWidth={25}
              />
              {/* Windshield */}
              <path
                d={`M 900,${paddingY + (bedWidth * 0.28)} 
                   L 1120,${paddingY + (bedWidth * 0.35)} 
                   C 1160,${paddingY + (bedWidth * 0.42)} 1160,${paddingY + (bedWidth * 0.58)} 1120,${paddingY + (bedWidth * 0.65)} 
                   L 900,${paddingY + (bedWidth * 0.72)} Z`}
                fill="#1e293b"
                stroke="#475569"
                strokeWidth={15}
              />
              {/* Connecting hitch coupler rig */}
              <rect
                x={1250}
                y={paddingY + (bedWidth / 2) - 100}
                width={200}
                height={200}
                fill="#475569"
                stroke="#2c2e33"
                strokeWidth={20}
              />
            </g>

            {/* --- VISUAL TRUCK BED REC --- */}
            {/* Outer framework frame edge steel bumper with physical length */}
            <rect
              x={paddingX}
              y={paddingY}
              width={physicalL}
              height={bedWidth}
              rx={15}
              ry={15}
              fill="none"
              stroke="#2d2f34"
              strokeWidth={40}
              style={{ vectorEffect: 'non-scaling-stroke' }}
            />

            {/* Truck Bed inside surface (textured steel design) with physical length */}
            <rect
              x={paddingX + 15}
              y={paddingY + 15}
              width={physicalL - 30}
              height={bedWidth - 30}
              fill="#18191c"
            />

            {/* Scale longitudinal lines representing heavy steel supports over full physical length */}
            <g stroke="#2d2f34" strokeWidth={10} style={{ vectorEffect: 'non-scaling-stroke' }}>
              <line x1={paddingX} y1={paddingY + bedWidth * 0.25} x2={paddingX + physicalL} y2={paddingY + bedWidth * 0.25} />
              <line x1={paddingX} y1={paddingY + bedWidth * 0.5} x2={paddingX + physicalL} y2={paddingY + bedWidth * 0.5} />
              <line x1={paddingX} y1={paddingY + bedWidth * 0.75} x2={paddingX + physicalL} y2={paddingY + bedWidth * 0.75} />
            </g>

            {/* Major horizontal markers every 2000mm over full physical length */}
            <g stroke="#2d2f34" strokeWidth={15} strokeDasharray="30,30" style={{ vectorEffect: 'non-scaling-stroke' }}>
              {Array.from({ length: Math.floor(physicalL / 2000) }).map((_, i) => {
                const xVal = (i + 1) * 2000;
                return <line key={i} x1={paddingX + xVal} y1={paddingY} x2={paddingX + xVal} y2={paddingY + bedWidth} />;
              })}
            </g>

            {/* RESERVED CLEARANCE & VISUAL SAFETY BUFFER BLOCK */}
            {physicalL - truck.lengthLimit > 0 && (
              <>
                {/* 1. Low-opacity red solid background highlight */}
                <rect
                  x={paddingX + truck.lengthLimit}
                  y={paddingY}
                  width={physicalL - truck.lengthLimit}
                  height={bedWidth}
                  fill="#ef4444"
                  fillOpacity={0.06}
                />

                {/* 2. Shaded diagonal hatch pattern over the highlight */}
                <rect
                  x={paddingX + truck.lengthLimit}
                  y={paddingY}
                  width={physicalL - truck.lengthLimit}
                  height={bedWidth}
                  fill="url(#clearanceHatch)"
                />

                {/* 3. Vertical dashed safety separation limit line (full height) */}
                <line
                  x1={paddingX + truck.lengthLimit}
                  y1={paddingY}
                  x2={paddingX + truck.lengthLimit}
                  y2={paddingY + bedWidth}
                  stroke="#ef4444"
                  strokeOpacity={0.45}
                  strokeWidth={2}
                  strokeDasharray="12,8"
                  style={{ vectorEffect: 'non-scaling-stroke' }}
                />

                {/* 4. Small, crisp, horizontal text label entirely inside rear shaded area */}
                {physicalL - truck.lengthLimit >= 150 && (
                  <text
                    x={paddingX + truck.lengthLimit + ((physicalL - truck.lengthLimit) / 2)}
                    y={paddingY + (bedWidth / 2) + 12}
                    textAnchor="middle"
                    fontSize={Math.max(16, Math.min(36, (physicalL - truck.lengthLimit) * 0.04))}
                    fontWeight="800"
                    fill="#ef4444"
                    fillOpacity={0.95}
                    className="font-sans tracking-widest select-none pointer-events-none"
                  >
                    {`NET RESERVED CLEARANCE: ${physicalL - truck.lengthLimit} mm`}
                  </text>
                )}
              </>
            )}

            {/* --- PACKED COMPONENTS LAYER --- */}
            {renderVisualComponents()}

            {/* --- ESTIMATED CARGO CENTER OF GRAVITY (CoG) & CONCENTRATION OVERLAY --- */}
            {showCoGMarker && truck.items.length > 0 && (() => {
              const svgCoGX = paddingX + balanceResult.cogX;
              const svgCoGY = paddingY + balanceResult.cogY;

              return (
                <g className="pointer-events-none select-none">
                  {/* 1. Subtle Longitudinal & Lateral axis guidelines */}
                  <line
                    x1={svgCoGX}
                    y1={paddingY}
                    x2={svgCoGX}
                    y2={paddingY + bedWidth}
                    stroke="#06b6d4"
                    strokeWidth={14}
                    strokeDasharray="40,25"
                    strokeOpacity={0.4}
                  />
                  <line
                    x1={paddingX}
                    y1={svgCoGY}
                    x2={paddingX + physicalL}
                    y2={svgCoGY}
                    stroke="#06b6d4"
                    strokeWidth={14}
                    strokeDasharray="40,25"
                    strokeOpacity={0.4}
                  />

                  {/* 2. CoG Target Reticle */}
                  <circle
                    cx={svgCoGX}
                    cy={svgCoGY}
                    r={80}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth={16}
                    strokeDasharray="30,15"
                    strokeOpacity={0.9}
                  />
                  <circle
                    cx={svgCoGX}
                    cy={svgCoGY}
                    r={26}
                    fill="#06b6d4"
                  />
                  <line
                    x1={svgCoGX - 110}
                    y1={svgCoGY}
                    x2={svgCoGX + 110}
                    y2={svgCoGY}
                    stroke="#06b6d4"
                    strokeWidth={14}
                  />
                  <line
                    x1={svgCoGX}
                    y1={svgCoGY - 110}
                    x2={svgCoGX}
                    y2={svgCoGY + 110}
                    stroke="#06b6d4"
                    strokeWidth={14}
                  />

                  {/* 3. Small badge text adjacent to CoG target */}
                  <g transform={`translate(${svgCoGX + 35}, ${svgCoGY - 35})`}>
                    <rect
                      x={0}
                      y={-55}
                      width={380}
                      height={70}
                      rx={12}
                      fill="#020617"
                      fillOpacity={0.88}
                      stroke="#06b6d4"
                      strokeWidth={6}
                    />
                    <text
                      x={190}
                      y={-12}
                      textAnchor="middle"
                      fontSize={40}
                      fontWeight="900"
                      fill="#06b6d4"
                      className="font-mono tracking-wider"
                    >
                      EST. CARGO CoG
                    </text>
                  </g>

                  {/* 4. Directional bias indicator badges along bed perimeter (cleanly away from components) */}
                  {balanceResult.bias.front && (
                    <g transform={`translate(${paddingX + 60}, ${paddingY + 100})`}>
                      <rect
                        x={0}
                        y={-50}
                        width={460}
                        height={70}
                        rx={12}
                        fill="#451a03"
                        fillOpacity={0.92}
                        stroke="#f59e0b"
                        strokeWidth={8}
                      />
                      <text
                        x={230}
                        y={-5}
                        textAnchor="middle"
                        fontSize={36}
                        fontWeight="900"
                        fill="#fbbf24"
                        className="font-mono"
                      >
                        ▲ FRONT BIAS ({balanceResult.frontPct}%)
                      </text>
                    </g>
                  )}

                  {balanceResult.bias.rear && (
                    <g transform={`translate(${paddingX + truck.lengthLimit - 520}, ${paddingY + 100})`}>
                      <rect
                        x={0}
                        y={-50}
                        width={460}
                        height={70}
                        rx={12}
                        fill="#451a03"
                        fillOpacity={0.92}
                        stroke="#f59e0b"
                        strokeWidth={8}
                      />
                      <text
                        x={230}
                        y={-5}
                        textAnchor="middle"
                        fontSize={36}
                        fontWeight="900"
                        fill="#fbbf24"
                        className="font-mono"
                      >
                        ▼ REAR BIAS ({balanceResult.rearPct}%)
                      </text>
                    </g>
                  )}

                  {balanceResult.bias.left && (
                    <g transform={`translate(${paddingX + (truck.lengthLimit / 2) - 230}, ${paddingY + 80})`}>
                      <rect
                        x={0}
                        y={-50}
                        width={460}
                        height={70}
                        rx={12}
                        fill="#451a03"
                        fillOpacity={0.92}
                        stroke="#f59e0b"
                        strokeWidth={8}
                      />
                      <text
                        x={230}
                        y={-5}
                        textAnchor="middle"
                        fontSize={36}
                        fontWeight="900"
                        fill="#fbbf24"
                        className="font-mono"
                      >
                        ◄ LEFT SIDE BIAS ({balanceResult.leftPct}%)
                      </text>
                    </g>
                  )}

                  {balanceResult.bias.right && (
                    <g transform={`translate(${paddingX + (truck.lengthLimit / 2) - 230}, ${paddingY + bedWidth - 30})`}>
                      <rect
                        x={0}
                        y={-50}
                        width={460}
                        height={70}
                        rx={12}
                        fill="#451a03"
                        fillOpacity={0.92}
                        stroke="#f59e0b"
                        strokeWidth={8}
                      />
                      <text
                        x={230}
                        y={-5}
                        textAnchor="middle"
                        fontSize={36}
                        fontWeight="900"
                        fill="#fbbf24"
                        className="font-mono"
                      >
                        ► RIGHT SIDE BIAS ({balanceResult.rightPct}%)
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}
          </svg>
        </div>

        {/* Stacking & Collision Warning Indicator */}
        {(() => {
          const stacking = getStackingInfo(truck.items);
          const hasStacking = Object.values(stacking).some(s => s.layer > 1);
          
          if (hasStacking) {
            return (
              <div className="mx-4 mb-2 p-2 bg-sky-950/20 border border-sky-900 text-sky-400 rounded-lg flex items-center gap-2 text-xs">
                <Sparkles size={14} className="text-sky-400 animate-pulse" />
                <span className="font-semibold">Manual Stacking Resolved: Multi-layer arrangement is visually exploded.</span>
              </div>
            );
          }
          
          const hasTrueCollision = truck.items.some(pi => isOverlapping(pi.x, pi.y, pi.w, pi.l, truck.items, pi.item.id));
          if (hasTrueCollision) {
            return (
              <div className="mx-4 mb-2 p-2 bg-red-950/20 border border-red-900 text-red-400 rounded-lg flex items-center gap-2 text-xs">
                <AlertCircle size={14} className="text-red-500 animate-pulse" />
                <span className="font-semibold">Overlapping / Collision Warning! Drag or rotate red items to restore clearance.</span>
              </div>
            );
          }
          
          return null;
        })()}

        {/* Legend / Status metrics */}
        <div className="px-4 py-2.5 bg-tech-panel border-t border-tech-border flex flex-wrap justify-between items-center gap-2 text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium text-tech-text-secondary">
              <span className="inline-block w-3 h-3 rounded bg-amber-500/20 border border-amber-500"></span>
              Oman Local
            </span>
            <span className="flex items-center gap-1.5 font-medium text-tech-text-secondary">
              <span className="inline-block w-3 h-3 rounded bg-tech-accent/20 border border-tech-accent"></span>
              Imported
            </span>
            <span className="flex items-center gap-1.5 font-medium text-red-400">
              <span className="inline-block w-3 h-3 rounded bg-red-500/25 border border-red-500 animate-pulse"></span>
              Collision Alert
            </span>
            <span className="flex items-center gap-1.5 font-medium text-cyan-400">
              <Crosshair size={12} />
              Est. Cargo CoG
            </span>
          </div>

          <div className="text-[10px] text-tech-text-secondary font-semibold font-mono">
            * Drag elements to make manual space placements. Items snap to a 50mm grid automatically.
          </div>
        </div>

      </div>

      {/* Internal Load Balance Modal */}
      <LoadBalanceModal
        isOpen={isInternalBalanceOpen}
        onClose={() => setIsInternalBalanceOpen(false)}
        truck={truck}
        balanceResult={balanceResult}
      />

    </div>
  );

}
