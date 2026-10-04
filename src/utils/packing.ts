import { TransformerItem, PackedItem, Truck, OptimizationResult, PackingWarning, TruckConfig, ProjectTransportMode } from '../types';

/**
 * Detects if an item is Transformer Rollers / Main Transformer Rollers
 * When an item is named "ROLLERS", "TRANSFORMER ROLLERS", "MAIN TRANSFORMER ROLLERS", etc.,
 * it is automatically classified as a Main Unit Associated Component and travels with its Main Transformer on the same Low Bed.
 * (Excludes non-cargo control items like controllers).
 */
export function isTransformerRollers(item: { componentName?: string; itemDescription?: string }): boolean {
  const name = (item.componentName || item.itemDescription || '').toLowerCase().trim();
  if (!name) return false;
  const hasRoller = /\brollers?\b/i.test(name);
  const isController = /\bcontroller\b/i.test(name);
  return hasRoller && !isController;
}

/**
 * Automatically classifies whether an item is a Main Unit Associated Component
 */
export function isMainUnitAssociatedComponent(item: { componentName?: string; itemDescription?: string }): boolean {
  return isTransformerRollers(item);
}

/**
 * Identifies Main Transformer Tank / Main Unit (excluding Rollers)
 */
export function isMainTransformerTank(item: { componentName?: string; itemDescription?: string; typeOfPacking?: string }): boolean {
  if (isTransformerRollers(item)) return false;
  const componentNameLower = (item.componentName || item.itemDescription || '').toLowerCase().trim();
  const typeOfPackingLower = (item.typeOfPacking || '').toLowerCase().trim();
  return (
    componentNameLower === 'main transformer' ||
    componentNameLower === 'main transformer tank' ||
    componentNameLower === 'transformer tank' ||
    componentNameLower === 'main tank' ||
    componentNameLower.includes('main transformer') ||
    componentNameLower.includes('transformer tank') ||
    componentNameLower.includes('main tank') ||
    componentNameLower.includes('main transformer tank') ||
    typeOfPackingLower === 'unpacked'
  );
}

/**
 * Extracts the transformer unit reference key from an item (e.g. "PT0525/1", "PT0525/2", "PT0525/3")
 */
export function getTransformerUnitKey(item: { projectCode?: string; componentName?: string; itemDescription?: string }): string {
  const code = (item.projectCode || '').trim().toUpperCase();
  const slashMatch = code.match(/^(.*?)\/(\d+)$/);
  if (slashMatch) {
    return slashMatch[0];
  }
  const dashMatch = code.match(/^(.*?)[-_](\d+)$/);
  if (dashMatch) {
    return `${dashMatch[1]}/${dashMatch[2]}`;
  }
  const name = (item.componentName || item.itemDescription || '');
  const compMatch = name.match(/(?:transformer|tank|rollers?|unit|job)[\s#_-]*(\d+)/i);
  if (compMatch) {
    return `${code}/${compMatch[1]}`;
  }
  return code;
}

/**
 * Checks if two rectangles overlap
 */
export function rectanglesOverlap(
  x1: number, y1: number, w1: number, l1: number,
  x2: number, y2: number, w2: number, l2: number
): boolean {
  // Add a tiny buffer (0.1 mm) to prevent edge cases with floating point
  return (
    x1 < x2 + w2 - 0.1 &&
    x1 + w1 > x2 + 0.1 &&
    y1 < y2 + l2 - 0.1 &&
    y1 + l1 > y2 + 0.1
  );
}

/**
 * Checks if a specific item placement overlaps with any already packed items in a truck
 */
export function isOverlapping(
  x: number,
  y: number,
  w: number,
  h: number,
  packedItems: PackedItem[],
  ignoreItemId?: string
): boolean {
  for (const packed of packedItems) {
    if (ignoreItemId && packed.item.id === ignoreItemId) continue;
    if (rectanglesOverlap(x, y, w, h, packed.x, packed.y, packed.w, packed.l)) {
      return true;
    }
  }
  return false;
}

/**
 * Pack items into Flat Bed trucks using a 2D Bin Packing Heuristic (Best-Fit with Rotation)
 */
export function packItems(
  items: TransformerItem[],
  maxTruckPayload: number = 25000,
  config?: TruckConfig
): OptimizationResult {
  const trucks: Truck[] = [];
  const unpackedItems: TransformerItem[] = [];
  const warnings: PackingWarning[] = [];

  let truckIdCounter = 1;

  // Selected Transport Mode (Default: 'both', i.e. FLAT BED + LOW BED)
  const transportMode: ProjectTransportMode = config?.transportMode || 'both';

  // Flat Bed / Container dimensions & payload
  const CONST_FLATBED_W = config ? config.flatBed.usableLength : 11800;
  const CONST_FLATBED_H = config ? config.flatBed.width : 2340;
  const CONST_FLATBED_HEIGHT = config ? config.flatBed.height : 2500;
  const flatbedComponentType = config?.componentTransportType || 'Flat Bed';
  const fbPayload = config?.flatBed?.payloadCapacity ?? maxTruckPayload ?? 25000;

  // Low Bed dimensions & payload
  const lbLength = config ? config.lowBed.usableLength : 13600;
  const lbWidth = config ? config.lowBed.width : 3000;
  const lbHeight = config ? config.lowBed.height : 4500;
  const lbPhysLength = config ? config.lowBed.physicalLength : 14000;
  const lbPhysWidth = config ? config.lowBed.width : 3000;
  const lbPhysHeight = config ? config.lowBed.height : 4500;
  const lbPayload = config?.lowBed?.payloadCapacity ?? 100000;

  // Helper to place Tank and its Rollers onto Low Bed trailer with clean, visible non-overlapping positions
  const placeTankAndRollers = (
    tank: TransformerItem,
    rollers: TransformerItem[],
    bedLength: number,
    bedWidth: number
  ): PackedItem[] => {
    const packed: PackedItem[] = [];

    // Position Rollers at the front deck (x: 150)
    let rollerCursorX = 150;
    const rollerPlacements: PackedItem[] = [];

    for (const roller of rollers) {
      let rW = roller.length;
      let rL = roller.width;
      let rotated = false;
      // Rotate if needed to fit within bed width
      if (rL > bedWidth && rW <= bedWidth) {
        rW = roller.width;
        rL = roller.length;
        rotated = true;
      }
      const rY = Math.max(100, Math.floor((bedWidth - rL) / 2));
      rollerPlacements.push({
        item: roller,
        x: rollerCursorX,
        y: rY,
        w: rW,
        l: rL,
        rotated,
      });
      rollerCursorX += rW + 200; // 200 mm clearance between cargo boxes
    }

    // Determine Main Transformer Tank coordinates
    const tankY = Math.max(100, Math.floor((bedWidth - tank.width) / 2));
    let tankX = Math.max(100, Math.floor((bedLength - tank.length) / 2));

    if (rollerPlacements.length > 0) {
      if (tankX < rollerCursorX) {
        tankX = rollerCursorX;
      }
      if (tankX + tank.length > bedLength) {
        // If tank placed after front rollers overshoots bed, place tank at front and rollers at rear
        tankX = 100;
        let rearCursorX = tankX + tank.length + 200;
        for (const rPi of rollerPlacements) {
          rPi.x = rearCursorX;
          rearCursorX += rPi.w + 200;
        }
      }
    }

    // Add Main Transformer Tank
    packed.push({
      item: tank,
      x: tankX,
      y: tankY,
      w: tank.length,
      l: tank.width,
      rotated: false,
    });

    // Add associated Rollers (each has its own separate Item ID, visible layout position, and weight)
    packed.push(...rollerPlacements);

    return packed;
  };

  // Helper to pack a specific group of items using multi-heuristic search (Minimizes Truck Count and Maximizes Area Packing)
  const packGroup = (
    groupItems: TransformerItem[],
    groupName: 'Oman' | 'Imported',
    targetTruckType: 'Flat Bed' | '40ft HC Container' | 'Low Bed',
    initialTrucks: Truck[] = []
  ): Truck[] => {
    if (groupItems.length === 0 && initialTrucks.length === 0) return [];

    const isTargetLowBed = targetTruckType === 'Low Bed';
    const bedUsableL = isTargetLowBed ? lbLength : CONST_FLATBED_W;
    const bedUsableW = isTargetLowBed ? lbWidth : CONST_FLATBED_H;
    const bedUsableH = isTargetLowBed ? lbHeight : CONST_FLATBED_HEIGHT;
    const bedPhysL = isTargetLowBed ? lbPhysLength : (config ? config.flatBed.physicalLength : 12000);
    const bedPhysW = isTargetLowBed ? lbPhysWidth : (config ? (config.componentTransportType === '40ft HC Container' ? (config.flatBed.internalWidth || 2350) : config.flatBed.width) : 2340);
    const bedPhysH = isTargetLowBed ? lbPhysHeight : (config ? (config.componentTransportType === '40ft HC Container' ? (config.flatBed.internalHeight || 2690) : config.flatBed.height) : 2500);
    const bedPayloadLimit = isTargetLowBed ? lbPayload : fbPayload;

    // All sorting strategies we want to evaluate
    const sortingStrategies = [
      { name: 'area-desc', sortFn: (a: TransformerItem, b: TransformerItem) => (b.length * b.width) - (a.length * a.width) },
      { name: 'maxdim-desc', sortFn: (a: TransformerItem, b: TransformerItem) => Math.max(b.length, b.width) - Math.max(a.length, a.width) },
      { name: 'weight-desc', sortFn: (a: TransformerItem, b: TransformerItem) => b.weight - a.weight },
      { name: 'perimeter-desc', sortFn: (a: TransformerItem, b: TransformerItem) => (b.length + b.width) - (a.length + a.width) },
      { name: 'length-desc', sortFn: (a: TransformerItem, b: TransformerItem) => b.length - a.length },
    ];

    // All bin-filling heuristics to evaluate
    const binHeuristics: ('first-fit' | 'best-fit-weight' | 'best-fit-area')[] = [
      'first-fit',
      'best-fit-weight',
      'best-fit-area'
    ];

    // Helper for a single run under particular settings
    const runPackStrategy = (
      sortedItems: TransformerItem[],
      fitHeuristic: 'first-fit' | 'best-fit-weight' | 'best-fit-area'
    ): Truck[] => {
      const localTrucks: Truck[] = initialTrucks.map(t => ({
        ...t,
        items: [...t.items]
      }));
      let tempCounter = 1;

      for (const item of sortedItems) {
        let placed = false;
        
        // Find existing trucks in this local list where item fits floor space
        const options: { truck: Truck; placement: PackedItem; remWeight: number; remArea: number }[] = [];

        for (const t of localTrucks) {
          // Physical space check
          const placement = findBestPlacement(item, t);
          if (placement) {
            const currentWeight = t.items.reduce((sum, pi) => sum + pi.item.weight, 0);
            const newWeight = currentWeight + item.weight;
            const remWeight = t.weightLimit - newWeight;

            const tBedArea = t.lengthLimit * t.widthLimit;
            const currentOccupied = t.items.reduce((sum, pi) => sum + (pi.w * pi.l), 0);
            const newOccupied = currentOccupied + (placement.w * placement.l);
            const remArea = tBedArea - newOccupied;

            options.push({ truck: t, placement, remWeight, remArea });
          }
        }

        if (options.length > 0) {
          let chosenOption = options[0];

          if (fitHeuristic === 'first-fit') {
            chosenOption = options[0];
          } else if (fitHeuristic === 'best-fit-weight') {
            options.sort((a, b) => a.remWeight - b.remWeight);
            chosenOption = options[0];
          } else if (fitHeuristic === 'best-fit-area') {
            options.sort((a, b) => a.remArea - b.remArea);
            chosenOption = options[0];
          }

          chosenOption.truck.items.push(chosenOption.placement);
          placed = true;
        }

        if (!placed) {
          // Open a new truck of target type
          const newTruck: Truck = {
            id: `temp-${targetTruckType.toLowerCase().replace(/\s+/g, '')}-${groupName.toLowerCase()}-${tempCounter++}`,
            truckNumber: 0,
            type: targetTruckType,
            originGroup: groupName,
            items: [],
            lengthLimit: bedUsableL,
            widthLimit: bedUsableW,
            heightLimit: bedUsableH,
            weightLimit: bedPayloadLimit,
            physicalLength: bedPhysL,
            physicalWidth: bedPhysW,
            physicalHeight: bedPhysH,
          };

          const placement = findBestPlacement(item, newTruck);
          if (placement) {
            newTruck.items.push(placement);
            localTrucks.push(newTruck);
          }
        }
      }

      return localTrucks;
    };

    // Evaluate strategies
    let bestTrucksList: Truck[] = [];
    let minTruckCount = Infinity;
    let maxAreaValue = -1;

    for (const sortStrat of sortingStrategies) {
      const sorted = [...groupItems].sort(sortStrat.sortFn);

      for (const heuristic of binHeuristics) {
        const candidateTrucks = runPackStrategy(sorted, heuristic);
        const candidateTruckCount = candidateTrucks.length;

        // Area utilization
        const totalBedArea = candidateTrucks.reduce((sum, t) => sum + (t.lengthLimit * t.widthLimit), 0);
        const totalPackedArea = candidateTrucks.reduce((sum, t) => {
          return sum + t.items.reduce((itemSum, pi) => itemSum + (pi.w * pi.l), 0);
        }, 0);
        const areaUtilization = totalBedArea > 0 ? (totalPackedArea / totalBedArea) * 100 : 0;

        // Priority 1: Minimize truck count.
        // Priority 2: Maximize floor area utilization (minimize empty space)
        if (candidateTruckCount < minTruckCount) {
          minTruckCount = candidateTruckCount;
          maxAreaValue = areaUtilization;
          bestTrucksList = candidateTrucks;
        } else if (candidateTruckCount === minTruckCount) {
          if (areaUtilization > maxAreaValue) {
            maxAreaValue = areaUtilization;
            bestTrucksList = candidateTrucks;
          }
        }
      }
    }

    // Assign permanent truck IDs to newly created trucks
    bestTrucksList.forEach((truck) => {
      if (!truck.id || truck.id.startsWith('temp-')) {
        const prefix = truck.type === 'Low Bed' ? 'lowbed' : 'flatbed';
        truck.id = `${prefix}-${groupName.toLowerCase()}-${truckIdCounter++}`;
      }
    });

    return bestTrucksList;
  };

  // -------------------------------------------------------------------------
  // EXECUTE CARGO ALLOCATION ACCORDING TO SELECTED TRANSPORT MODE
  // -------------------------------------------------------------------------

  if (transportMode === 'flatbed-only') {
    // -----------------------------------------------------------------------
    // MODE 1: FLAT BED ONLY
    // Use this when the project contains only accessories/components and no Low Bed is required.
    // All eligible cargo is planned using Flat Bed trucks only.
    // No Low Bed trucks are generated.
    // -----------------------------------------------------------------------
    const omanItems: TransformerItem[] = [];
    const importedItems: TransformerItem[] = [];

    for (const item of items) {
      // Dimension Validation against Flat Bed
      const canFitOriginal = item.length <= CONST_FLATBED_W && item.width <= CONST_FLATBED_H;
      const canFitRotated = item.width <= CONST_FLATBED_W && item.length <= CONST_FLATBED_H;

      if (!canFitOriginal && !canFitRotated) {
        unpackedItems.push(item);
        warnings.push({
          itemId: item.id,
          itemName: item.componentName,
          projectCode: item.projectCode,
          reason: `Item is too large for ${flatbedComponentType} (Max: ${CONST_FLATBED_W} x ${CONST_FLATBED_H} mm)`,
        });
        continue;
      }

      if (item.weight > fbPayload) {
        unpackedItems.push(item);
        warnings.push({
          itemId: item.id,
          itemName: item.componentName,
          projectCode: item.projectCode,
          reason: `Item weight (${item.weight.toLocaleString()} kg) exceeds ${flatbedComponentType} payload capacity (${fbPayload.toLocaleString()} kg)`,
        });
        continue;
      }

      if (item.origin.toLowerCase().trim() === 'oman') {
        omanItems.push(item);
      } else {
        importedItems.push(item);
      }
    }

    const packedOmanTrucks = packGroup(omanItems, 'Oman', flatbedComponentType);
    const packedImportedTrucks = packGroup(importedItems, 'Imported', flatbedComponentType);

    trucks.push(...packedOmanTrucks, ...packedImportedTrucks);

  } else if (transportMode === 'lowbed-only') {
    // -----------------------------------------------------------------------
    // MODE 2: LOW BED ONLY
    // Use this for projects where the Main Transformer is small enough that the
    // Main Unit and its accessories/components can be transported together
    // using Low Bed transportation.
    // In this mode, do not automatically create Flat Bed trucks.
    // Fixed Allocation Rule: Transformer Rollers travel with their corresponding
    // Main Transformer on the same Low Bed.
    // -----------------------------------------------------------------------
    const mainTransformerTanks: TransformerItem[] = [];
    const transformerRollersList: TransformerItem[] = [];
    const accessories: TransformerItem[] = [];

    for (const item of items) {
      if (isTransformerRollers(item)) {
        transformerRollersList.push(item);
      } else if (isMainTransformerTank(item)) {
        mainTransformerTanks.push(item);
      } else {
        accessories.push(item);
      }
    }

    // Pair rollers with their corresponding transformer tanks
    const unallocatedRollers = [...transformerRollersList];
    const initialOmanLowBeds: Truck[] = [];
    const initialImportedLowBeds: Truck[] = [];

    for (let tIdx = 0; tIdx < mainTransformerTanks.length; tIdx++) {
      const tank = mainTransformerTanks[tIdx];
      const tankKey = getTransformerUnitKey(tank);

      // Find rollers for this transformer
      let matchedRollers = unallocatedRollers.filter(r => getTransformerUnitKey(r) === tankKey);
      if (matchedRollers.length === 0 && unallocatedRollers.length > 0) {
        if (tIdx < unallocatedRollers.length && mainTransformerTanks.length === unallocatedRollers.length) {
          matchedRollers = [unallocatedRollers[tIdx]];
        } else if (mainTransformerTanks.length === 1) {
          matchedRollers = [...unallocatedRollers];
        }
      }

      for (const mr of matchedRollers) {
        const idx = unallocatedRollers.indexOf(mr);
        if (idx !== -1) unallocatedRollers.splice(idx, 1);
      }

      const isOman = tank.origin.toLowerCase().trim() === 'oman';
      const lowBedItems = placeTankAndRollers(tank, matchedRollers, lbLength, lbWidth);
      const totalPayload = lowBedItems.reduce((sum, pi) => sum + pi.item.weight, 0);

      const truck: Truck = {
        id: `lowbed-${isOman ? 'oman' : 'imported'}-${truckIdCounter++}`,
        truckNumber: 0,
        type: 'Low Bed',
        originGroup: isOman ? 'Oman' : 'Imported',
        items: lowBedItems,
        lengthLimit: lbLength,
        widthLimit: lbWidth,
        heightLimit: lbHeight,
        weightLimit: lbPayload,
        physicalLength: lbPhysLength,
        physicalWidth: lbPhysWidth,
        physicalHeight: lbPhysHeight,
      };

      if (totalPayload > lbPayload) {
        warnings.push({
          itemId: tank.id,
          itemName: tank.componentName,
          projectCode: tank.projectCode,
          reason: `Total load (${totalPayload.toLocaleString()} kg) exceeds Low Bed payload capacity (${lbPayload.toLocaleString()} kg)`,
        });
      }

      if (isOman) {
        initialOmanLowBeds.push(truck);
      } else {
        initialImportedLowBeds.push(truck);
      }
    }

    // If there were orphan rollers without a tank, treat as general accessories
    if (unallocatedRollers.length > 0) {
      accessories.push(...unallocatedRollers);
    }

    const omanAccessories: TransformerItem[] = [];
    const importedAccessories: TransformerItem[] = [];

    for (const item of accessories) {
      // Dimension Validation against Low Bed
      const canFitOriginal = item.length <= lbLength && item.width <= lbWidth;
      const canFitRotated = item.width <= lbLength && item.length <= lbWidth;

      if (!canFitOriginal && !canFitRotated) {
        unpackedItems.push(item);
        warnings.push({
          itemId: item.id,
          itemName: item.componentName,
          projectCode: item.projectCode,
          reason: `Item is too large for Low Bed (Max: ${lbLength} x ${lbWidth} mm)`,
        });
        continue;
      }

      if (item.weight > lbPayload) {
        unpackedItems.push(item);
        warnings.push({
          itemId: item.id,
          itemName: item.componentName,
          projectCode: item.projectCode,
          reason: `Item weight (${item.weight.toLocaleString()} kg) exceeds Low Bed payload capacity (${lbPayload.toLocaleString()} kg)`,
        });
        continue;
      }

      if (item.origin.toLowerCase().trim() === 'oman') {
        omanAccessories.push(item);
      } else {
        importedAccessories.push(item);
      }
    }

    // Pack accessories into Low Beds (first onto existing tank Low Beds, or opening new Low Beds if full)
    const packedOmanLowBeds = packGroup(omanAccessories, 'Oman', 'Low Bed', initialOmanLowBeds);
    const packedImportedLowBeds = packGroup(importedAccessories, 'Imported', 'Low Bed', initialImportedLowBeds);

    trucks.push(...packedOmanLowBeds, ...packedImportedLowBeds);

  } else {
    // -----------------------------------------------------------------------
    // MODE 3: FLAT BED + LOW BED (Normal / Default Mode)
    // Main Transformer → dedicated Low Bed
    // Main Transformer Rollers → ALWAYS allocated to the same Low Bed as their corresponding Main Transformer!
    // Accessories / Components → Flat Bed
    // -----------------------------------------------------------------------
    const mainTransformerTanks: TransformerItem[] = [];
    const transformerRollersList: TransformerItem[] = [];
    const remainingItems: TransformerItem[] = [];

    for (const item of items) {
      if (isTransformerRollers(item)) {
        transformerRollersList.push(item);
      } else if (isMainTransformerTank(item)) {
        mainTransformerTanks.push(item);
      } else {
        remainingItems.push(item);
      }
    }

    // Automatically pair each Main Transformer with its Rollers on the same Low Bed
    const unallocatedRollers = [...transformerRollersList];

    for (let tankIdx = 0; tankIdx < mainTransformerTanks.length; tankIdx++) {
      const tank = mainTransformerTanks[tankIdx];
      const tankKey = getTransformerUnitKey(tank);

      // Find rollers specifically belonging to this transformer number
      let matchedRollers = unallocatedRollers.filter(r => getTransformerUnitKey(r) === tankKey);

      // Fallback matching when project code format has 1-to-1 ratio
      if (matchedRollers.length === 0 && unallocatedRollers.length > 0) {
        if (tankIdx < unallocatedRollers.length && mainTransformerTanks.length === unallocatedRollers.length) {
          matchedRollers = [unallocatedRollers[tankIdx]];
        } else if (mainTransformerTanks.length === 1) {
          matchedRollers = [...unallocatedRollers];
        }
      }

      // Remove allocated rollers from pool
      for (const mr of matchedRollers) {
        const idx = unallocatedRollers.indexOf(mr);
        if (idx !== -1) unallocatedRollers.splice(idx, 1);
      }

      const isOman = tank.origin.toLowerCase().trim() === 'oman';
      const lowBedItems = placeTankAndRollers(tank, matchedRollers, lbLength, lbWidth);
      const totalPayload = lowBedItems.reduce((sum, pi) => sum + pi.item.weight, 0);

      const lowBedTruck: Truck = {
        id: `lowbed-${truckIdCounter++}`,
        truckNumber: 0,
        type: 'Low Bed',
        originGroup: isOman ? 'Oman' : 'Imported',
        items: lowBedItems,
        lengthLimit: lbLength,
        widthLimit: lbWidth,
        heightLimit: lbHeight,
        weightLimit: lbPayload,
        physicalLength: lbPhysLength,
        physicalWidth: lbPhysWidth,
        physicalHeight: lbPhysHeight,
      };

      if (totalPayload > lbPayload) {
        warnings.push({
          itemId: tank.id,
          itemName: tank.componentName,
          projectCode: tank.projectCode,
          reason: `Total load (${totalPayload.toLocaleString()} kg) exceeds Low Bed payload capacity (${lbPayload.toLocaleString()} kg)`,
        });
      }
      trucks.push(lowBedTruck);
    }

    // Never allocate Main Transformer Rollers to a Flat Bed when the corresponding Main Transformer is transported by Low Bed!
    if (unallocatedRollers.length > 0) {
      const existingLowBeds = trucks.filter(t => t.type === 'Low Bed');
      if (existingLowBeds.length > 0) {
        for (let i = 0; i < unallocatedRollers.length; i++) {
          const targetLb = existingLowBeds[i % existingLowBeds.length];
          const roller = unallocatedRollers[i];
          const maxX = targetLb.items.length > 0 ? Math.max(...targetLb.items.map(p => p.x + p.w)) : 100;
          targetLb.items.push({
            item: roller,
            x: maxX + 150,
            y: 100,
            w: roller.length,
            l: roller.width,
            rotated: false,
          });
        }
      } else {
        // Only if no Low Beds exist at all in the project (no main transformer)
        remainingItems.push(...unallocatedRollers);
      }
    }

    // Separate remaining items by Origin (Oman vs Imported)
    const omanItems: TransformerItem[] = [];
    const importedItems: TransformerItem[] = [];

    for (const item of remainingItems) {
      // Dimension Validation
      const canFitOriginal = item.length <= CONST_FLATBED_W && item.width <= CONST_FLATBED_H;
      const canFitRotated = item.width <= CONST_FLATBED_W && item.length <= CONST_FLATBED_H;

      if (!canFitOriginal && !canFitRotated) {
        unpackedItems.push(item);
        warnings.push({
          itemId: item.id,
          itemName: item.componentName,
          projectCode: item.projectCode,
          reason: `Item is too large for ${flatbedComponentType} (Max: ${CONST_FLATBED_W} x ${CONST_FLATBED_H} mm)`,
        });
        continue;
      }

      if (item.weight > fbPayload) {
        unpackedItems.push(item);
        warnings.push({
          itemId: item.id,
          itemName: item.componentName,
          projectCode: item.projectCode,
          reason: `Item weight (${item.weight.toLocaleString()} kg) exceeds ${flatbedComponentType} payload capacity (${fbPayload.toLocaleString()} kg)`,
        });
        continue;
      }

      if (item.origin.toLowerCase().trim() === 'oman') {
        omanItems.push(item);
      } else {
        importedItems.push(item);
      }
    }

    const packedOmanTrucks = packGroup(omanItems, 'Oman', flatbedComponentType);
    const packedImportedTrucks = packGroup(importedItems, 'Imported', flatbedComponentType);

    trucks.push(...packedOmanTrucks, ...packedImportedTrucks);
  }

  // Recalculate separate sequential numbers for trucks
  let lowBedCount = 0;
  let flatBedCount = 0;
  trucks.forEach((truck) => {
    if (truck.type === 'Low Bed') {
      lowBedCount++;
      truck.truckNumber = lowBedCount;
    } else {
      flatBedCount++;
      truck.truckNumber = flatBedCount;
    }
  });

  return {
    trucks,
    unpackedItems,
    warnings,
  };
}

/**
 * Gets the actual Country of Origin label for a truck dynamically based on its items
 */
export function getTruckOriginLabel(truck: Truck): string {
  if (truck.items.length === 0) {
    return truck.originGroup === 'Oman' ? 'Oman' : 'Imported';
  }

  const origins = Array.from(new Set(truck.items.map(pi => pi.item.origin || 'Unknown')))
    .map(o => o.trim())
    .filter(Boolean);

  if (origins.length === 0) return 'Unknown';

  if (origins.includes('Oman')) {
    return 'Oman';
  }

  // Non-Oman countries
  const importedOrigins = origins.filter(o => o.toLowerCase() !== 'oman');
  if (importedOrigins.length === 1) {
    return importedOrigins[0];
  } else if (importedOrigins.length > 1) {
    return `Imported Mixed: ${importedOrigins.join(' / ')}`;
  }

  return origins.join(' / ');
}

/**
 * Finds the mathematically optimal coordinate and rotation to place an item on a truck bed
 * Uses Anchor Point search with Bottom-Left (Min X, then Min Y) Heuristic
 */
export function findBestPlacement(item: TransformerItem, truck: Truck): PackedItem | null {
  const candidates: { x: number; y: number; w: number; l: number; rotated: boolean; score: number }[] = [];

  // Generate anchor candidates
  const xAnchors = new Set<number>([0]);
  const yAnchors = new Set<number>([0]);

  for (const pi of truck.items) {
    xAnchors.add(pi.x + pi.w);
    yAnchors.add(pi.y + pi.l);
  }

  // We test combinations of anchor coordinates
  for (const cx of xAnchors) {
    for (const cy of yAnchors) {
      if (cx >= truck.lengthLimit || cy >= truck.widthLimit) continue;

      // Test both orientations
      const orientations = [
        { w: item.length, l: item.width, rotated: false },
        { w: item.width, l: item.length, rotated: true }
      ];

      for (const orient of orientations) {
        const { w, l, rotated } = orient;

        // Check boundary limits
        if (cx + w <= truck.lengthLimit && cy + l <= truck.widthLimit) {
          // Check collision with existing items
          const collision = isOverlapping(cx, cy, w, l, truck.items);

          if (!collision) {
            // Heuristic Score: we want to pack towards the left (Min X) to group items tightly
            // Secondary goal is Min Y (to align alongside the edge).
            // Formula: score = cx + cy * 0.1 or similar. We want to reward packed coordinates that are compact.
            const score = cx * 10 + cy;
            candidates.push({ x: cx, y: cy, w, l, rotated, score });
          }
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Sort by lowest score (closest to bottom-left packing front)
  candidates.sort((a, b) => a.score - b.score);

  const best = candidates[0];
  return {
    item,
    x: best.x,
    y: best.y,
    w: best.w,
    l: best.l,
    rotated: best.rotated,
  };
}

/**
 * Runs the 2D Auto-Pack algorithm strictly for a single truck.
 * Uses only the components already assigned to that truck.
 * Optimizes for maximum 2D surface space utilization and compact floor arrangement.
 * Does not modify any other truck, truck assignments, cargo classifications, project data, or origin groupings.
 */
export function repackSingleTruck(truck: Truck): PackedItem[] {
  if (!truck.items || truck.items.length === 0) return [];
  
  if (truck.items.length === 1) {
    const single = truck.items[0];
    if (truck.type === 'Low Bed') {
      const cx = Math.max(0, Math.floor((truck.lengthLimit - single.w) / 2));
      const cy = Math.max(0, Math.floor((truck.widthLimit - single.l) / 2));
      return [{ ...single, x: cx, y: cy }];
    }
    return [{ ...single, x: 0, y: 0 }];
  }

  const itemsToPack = truck.items.map(pi => pi.item);

  // Multi-heuristic search to find the most compact surface arrangement
  const sortingStrategies = [
    { name: 'area-desc', sortFn: (a: TransformerItem, b: TransformerItem) => (b.length * b.width) - (a.length * a.width) },
    { name: 'maxdim-desc', sortFn: (a: TransformerItem, b: TransformerItem) => Math.max(b.length, b.width) - Math.max(a.length, a.width) },
    { name: 'length-desc', sortFn: (a: TransformerItem, b: TransformerItem) => b.length - a.length },
    { name: 'perimeter-desc', sortFn: (a: TransformerItem, b: TransformerItem) => (b.length + b.width) - (a.length + a.width) },
    { name: 'weight-desc', sortFn: (a: TransformerItem, b: TransformerItem) => b.weight - a.weight },
    { name: 'width-desc', sortFn: (a: TransformerItem, b: TransformerItem) => b.width - a.width },
  ];

  let bestPacked: PackedItem[] | null = null;
  let minLengthUsed = Infinity;
  let minTotalScore = Infinity;

  for (const strat of sortingStrategies) {
    const sorted = [...itemsToPack].sort(strat.sortFn);
    const candidatePacked: PackedItem[] = [];
    const virtualTruck: Truck = {
      ...truck,
      items: candidatePacked,
    };

    let allFit = true;
    for (const item of sorted) {
      const placement = findBestPlacement(item, virtualTruck);
      if (placement) {
        candidatePacked.push(placement);
      } else {
        allFit = false;
        break;
      }
    }

    if (allFit && candidatePacked.length === itemsToPack.length) {
      const usedLen = Math.max(...candidatePacked.map(p => p.x + p.w));
      const totalScore = candidatePacked.reduce((sum, p) => sum + (p.x * 10 + p.y), 0);
      if (usedLen < minLengthUsed || (usedLen === minLengthUsed && totalScore < minTotalScore)) {
        minLengthUsed = usedLen;
        minTotalScore = totalScore;
        bestPacked = candidatePacked;
      }
    }
  }

  return bestPacked || truck.items;
}

export interface StackingInfo {
  layer: number;
  loadedOnId: string | null;
  stackedItemIds: string[];
}

export function getStackingInfo(items: PackedItem[]): Record<string, StackingInfo> {
  const result: Record<string, StackingInfo> = {};
  
  // Initialize default stacking info for all items
  for (const pi of items) {
    result[pi.item.id] = {
      layer: 1,
      loadedOnId: null,
      stackedItemIds: []
    };
  }

  // Sort items by footprint area descending, then weight descending.
  const sortedItems = [...items].sort((a, b) => {
    const areaA = a.w * a.l;
    const areaB = b.w * b.l;
    if (areaB !== areaA) return areaB - areaA;
    if (b.item.weight !== a.item.weight) return b.item.weight - a.item.weight;
    return a.item.id.localeCompare(b.item.id);
  });

  // Process from largest/heavier to smallest/lighter
  for (let i = 0; i < sortedItems.length; i++) {
    const current = sortedItems[i];
    const currentId = current.item.id;
    
    let bestUnderneath: PackedItem | null = null;
    let maxUnderneathLayer = 0;

    for (let j = 0; j < i; j++) {
      const other = sortedItems[j];
      const otherId = other.item.id;
      
      if (rectanglesOverlap(current.x, current.y, current.w, current.l, other.x, other.y, other.w, other.l)) {
        const otherLayer = result[otherId].layer;
        if (otherLayer > maxUnderneathLayer) {
          maxUnderneathLayer = otherLayer;
          bestUnderneath = other;
        }
      }
    }

    if (bestUnderneath) {
      result[currentId].layer = maxUnderneathLayer + 1;
      result[currentId].loadedOnId = bestUnderneath.item.id;
      
      // Add to stackedItemIds of all items underneath
      let underId: string | null = bestUnderneath.item.id;
      while (underId) {
        if (!result[underId].stackedItemIds.includes(currentId)) {
          result[underId].stackedItemIds.push(currentId);
        }
        underId = result[underId].loadedOnId;
      }
    }
  }

  return result;
}

