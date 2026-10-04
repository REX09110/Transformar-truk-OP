import { Truck, LoadBalanceResult, HeaviestCargoItem, LoadBalanceStatus, PackedItem } from '../types';
import { rectanglesOverlap, repackSingleTruck } from './packing';

/**
 * Calculates the Estimated Cargo Load Balance and Center of Gravity (CoG)
 * based on cargo component geometry and weight.
 * 
 * NOTE: This is an Estimated Cargo Load Balance check. It evaluates cargo distribution
 * relative to the truck bed geometric axes. It does not calculate certified vehicle axle loads.
 */
export function calculateLoadBalance(truck: Truck): LoadBalanceResult {
  const bedLength = truck.lengthLimit || 12000;
  const bedWidth = truck.widthLimit || 2340;
  const idealX = bedLength / 2;
  const idealY = bedWidth / 2;

  const totalCargoWeight = truck.items.reduce((sum, pi) => sum + (pi.item.weight || 0), 0);
  const itemCount = truck.items.length;

  if (itemCount === 0 || totalCargoWeight === 0) {
    return {
      totalCargoWeight: 0,
      itemCount: 0,
      bedLength,
      bedWidth,
      cogX: idealX,
      cogY: idealY,
      idealX,
      idealY,
      offsetXMm: 0,
      offsetYMm: 0,
      offsetXPct: 0,
      offsetYPct: 0,
      frontWeightKg: 0,
      rearWeightKg: 0,
      frontPct: 50,
      rearPct: 50,
      leftWeightKg: 0,
      rightWeightKg: 0,
      leftPct: 50,
      rightPct: 50,
      score: 100,
      status: 'GOOD',
      bias: {
        front: false,
        rear: false,
        left: false,
        right: false,
        primaryZone: 'Empty',
      },
      quadrants: {
        frontLeftKg: 0,
        frontLeftPct: 25,
        frontRightKg: 0,
        frontRightPct: 25,
        rearLeftKg: 0,
        rearLeftPct: 25,
        rearRightKg: 0,
        rearRightPct: 25,
      },
      heaviestItems: [],
      recommendations: [
        'No cargo components currently loaded on this truck.',
      ],
    };
  }

  // 1. Calculate Center of Gravity (CoG) via weighted moment sum
  let sumWeightTimesX = 0;
  let sumWeightTimesY = 0;

  // Longitudinal & Lateral continuous weight accumulators
  let frontWeightKg = 0;
  let rearWeightKg = 0;
  let leftWeightKg = 0;
  let rightWeightKg = 0;

  // Quadrant weight accumulators
  let frontLeftKg = 0;
  let frontRightKg = 0;
  let rearLeftKg = 0;
  let rearRightKg = 0;

  truck.items.forEach(pi => {
    const w = pi.w;
    const l = pi.l;
    const weight = pi.item.weight || 0;
    
    // Component center of gravity (assuming uniform density)
    const itemCenterX = pi.x + w / 2;
    const itemCenterY = pi.y + l / 2;

    sumWeightTimesX += weight * itemCenterX;
    sumWeightTimesY += weight * itemCenterY;

    // Geometric continuous weight splitting along X (Front / Rear)
    const x1 = pi.x;
    const x2 = pi.x + w;
    const frontOverlap = Math.max(0, Math.min(x2, idealX) - x1);
    const rearOverlap = Math.max(0, x2 - Math.max(x1, idealX));
    const frontFrac = w > 0 ? frontOverlap / w : 0.5;
    const rearFrac = w > 0 ? rearOverlap / w : 0.5;

    const itemFrontKg = weight * frontFrac;
    const itemRearKg = weight * rearFrac;

    frontWeightKg += itemFrontKg;
    rearWeightKg += itemRearKg;

    // Geometric continuous weight splitting along Y (Left / Right)
    const y1 = pi.y;
    const y2 = pi.y + l;
    const leftOverlap = Math.max(0, Math.min(y2, idealY) - y1);
    const rightOverlap = Math.max(0, y2 - Math.max(y1, idealY));
    const leftFrac = l > 0 ? leftOverlap / l : 0.5;
    const rightFrac = l > 0 ? rightOverlap / l : 0.5;

    const itemLeftKg = weight * leftFrac;
    const itemRightKg = weight * rightFrac;

    leftWeightKg += itemLeftKg;
    rightWeightKg += itemRightKg;

    // 4-Quadrant distribution
    frontLeftKg += weight * (frontFrac * leftFrac);
    frontRightKg += weight * (frontFrac * rightFrac);
    rearLeftKg += weight * (rearFrac * leftFrac);
    rearRightKg += weight * (rearFrac * rightFrac);
  });

  const cogX = sumWeightTimesX / totalCargoWeight;
  const cogY = sumWeightTimesY / totalCargoWeight;

  const offsetXMm = Math.round(cogX - idealX);
  const offsetYMm = Math.round(cogY - idealY);

  const offsetXPct = Math.round((offsetXMm / idealX) * 100);
  const offsetYPct = Math.round((offsetYMm / idealY) * 100);

  const frontPct = Math.round((frontWeightKg / totalCargoWeight) * 100);
  const rearPct = 100 - frontPct;

  const leftPct = Math.round((leftWeightKg / totalCargoWeight) * 100);
  const rightPct = 100 - leftPct;

  const frontLeftPct = Math.round((frontLeftKg / totalCargoWeight) * 100);
  const frontRightPct = Math.round((frontRightKg / totalCargoWeight) * 100);
  const rearLeftPct = Math.round((rearLeftKg / totalCargoWeight) * 100);
  const rearRightPct = Math.round((rearRightKg / totalCargoWeight) * 100);

  // 2. Score and Status Calculation
  const latDiff = Math.abs(leftPct - 50);
  const longDiff = Math.abs(frontPct - 50);

  // Lateral penalty: lateral imbalance has severe rollover impact
  const latPenalty = Math.max(0, (latDiff - 3) * 2.2);
  // Longitudinal penalty: front/rear tolerance is wider on long trailers
  const longPenalty = Math.max(0, (longDiff - 5) * 1.4);

  const rawScore = 100 - latPenalty - longPenalty;
  const score = Math.max(10, Math.min(100, Math.round(rawScore)));

  let status: LoadBalanceStatus = 'GOOD';
  if (score < 60 || latDiff > 16 || longDiff > 22) {
    status = 'POOR DISTRIBUTION';
  } else if (score < 80 || latDiff > 8 || longDiff > 12) {
    status = 'REVIEW RECOMMENDED';
  } else {
    status = 'GOOD';
  }

  // 3. Concentration & Bias Identification
  const hasFrontBias = frontPct >= 57;
  const hasRearBias = rearPct >= 57;
  const hasLeftBias = leftPct >= 56;
  const hasRightBias = rightPct >= 56;

  let primaryZone = 'Centered';
  if (hasFrontBias && hasLeftBias) primaryZone = 'Front-Left';
  else if (hasFrontBias && hasRightBias) primaryZone = 'Front-Right';
  else if (hasRearBias && hasLeftBias) primaryZone = 'Rear-Left';
  else if (hasRearBias && hasRightBias) primaryZone = 'Rear-Right';
  else if (hasFrontBias) primaryZone = 'Front';
  else if (hasRearBias) primaryZone = 'Rear';
  else if (hasLeftBias) primaryZone = 'Left';
  else if (hasRightBias) primaryZone = 'Right';

  // 4. Heaviest Items Identification
  const sortedItems = [...truck.items].sort((a, b) => b.item.weight - a.item.weight);
  const heaviestItems: HeaviestCargoItem[] = sortedItems.slice(0, 4).map(pi => {
    const itemNum = truck.items.indexOf(pi) + 1;
    const cx = pi.x + pi.w / 2;
    const cy = pi.y + pi.l / 2;
    
    let itemZone = 'Center';
    const isFront = cx < idealX;
    const isLeft = cy < idealY;
    if (isFront && isLeft) itemZone = 'Front-Left';
    else if (isFront && !isLeft) itemZone = 'Front-Right';
    else if (!isFront && isLeft) itemZone = 'Rear-Left';
    else if (!isFront && !isLeft) itemZone = 'Rear-Right';

    return {
      itemNum,
      name: pi.item.componentName || 'Component',
      weight: pi.item.weight,
      x: pi.x,
      y: pi.y,
      w: pi.w,
      l: pi.l,
      zone: itemZone,
    };
  });

  // 5. Actionable Recommendations
  const recommendations: string[] = [];

  if (status === 'GOOD') {
    recommendations.push(
      `Cargo load distribution is well centered across both longitudinal (${frontPct}% Front / ${rearPct}% Rear) and lateral (${leftPct}% Left / ${rightPct}% Right) axes.`
    );
    recommendations.push(
      'Estimated Cargo Center of Gravity is within safe operational tolerance of the truck bed center line.'
    );
  } else {
    // Longitudinal recommendations
    if (hasRearBias) {
      const heavyInRear = heaviestItems.find(it => it.zone.includes('Rear'));
      if (heavyInRear) {
        recommendations.push(
          `Weight concentration detected on the rear side (${rearPct}% Rear). Consider moving heavy component #${heavyInRear.itemNum} (${heavyInRear.name.substring(0, 22)}) forward to improve longitudinal balance.`
        );
      } else {
        recommendations.push(
          `Weight concentration detected on the rear side (${rearPct}% Rear). Consider shifting components forward toward the cabin to relieve rear overhang stress.`
        );
      }
    } else if (hasFrontBias) {
      const heavyInFront = heaviestItems.find(it => it.zone.includes('Front'));
      if (heavyInFront) {
        recommendations.push(
          `Load is concentrated forward (${frontPct}% Front). Consider moving component #${heavyInFront.itemNum} (${heavyInFront.name.substring(0, 22)}) rearward closer to the center of the truck bed.`
        );
      } else {
        recommendations.push(
          `Weight concentration detected toward the front (${frontPct}% Front). Move heavy cargo slightly rearward to balance coupling weight.`
        );
      }
    }

    // Lateral recommendations
    if (hasLeftBias) {
      const heavyInLeft = heaviestItems.find(it => it.zone.includes('Left'));
      if (heavyInLeft) {
        recommendations.push(
          `Lateral weight bias on the left side (${leftPct}% Left vs ${rightPct}% Right). Move heavy component #${heavyInLeft.itemNum} closer to the centerline or right side.`
        );
      } else {
        recommendations.push(
          `Weight concentration detected on the left side (${leftPct}% Left). Shift heavier items toward the right side to prevent trailer roll instability.`
        );
      }
    } else if (hasRightBias) {
      const heavyInRight = heaviestItems.find(it => it.zone.includes('Right'));
      if (heavyInRight) {
        recommendations.push(
          `Lateral weight bias on the right side (${rightPct}% Right vs ${leftPct}% Left). Move heavy component #${heavyInRight.itemNum} closer to the centerline or left side.`
        );
      } else {
        recommendations.push(
          `Weight concentration detected on the right side (${rightPct}% Right). Shift heavier items toward the left side to level the load.`
        );
      }
    }

    // High quadrant concentration check
    const quadList = [
      { name: 'Front-Left', pct: frontLeftPct, kg: frontLeftKg },
      { name: 'Front-Right', pct: frontRightPct, kg: frontRightKg },
      { name: 'Rear-Left', pct: rearLeftPct, kg: rearLeftKg },
      { name: 'Rear-Right', pct: rearRightPct, kg: rearRightKg },
    ];
    quadList.sort((a, b) => b.pct - a.pct);
    const topQuad = quadList[0];
    if (topQuad.pct >= 45) {
      const heavyInTop = heaviestItems.find(it => it.zone === topQuad.name);
      if (heavyInTop && !recommendations.some(r => r.includes(topQuad.name))) {
        recommendations.push(
          `High weight concentration (${topQuad.pct}% of payload) isolated in the ${topQuad.name} quadrant. Relocating component #${heavyInTop.itemNum} will yield the highest balance improvement.`
        );
      }
    }

    recommendations.push(
      'Note: Recommendations only. Adjust component positions manually using the 2D Blueprint drag controls if desired.'
    );
  }

  return {
    totalCargoWeight,
    itemCount,
    bedLength,
    bedWidth,
    cogX: Math.round(cogX),
    cogY: Math.round(cogY),
    idealX,
    idealY,
    offsetXMm,
    offsetYMm,
    offsetXPct,
    offsetYPct,
    frontWeightKg: Math.round(frontWeightKg),
    rearWeightKg: Math.round(rearWeightKg),
    frontPct,
    rearPct,
    leftWeightKg: Math.round(leftWeightKg),
    rightWeightKg: Math.round(rightWeightKg),
    leftPct,
    rightPct,
    score,
    status,
    bias: {
      front: hasFrontBias,
      rear: hasRearBias,
      left: hasLeftBias,
      right: hasRightBias,
      primaryZone,
    },
    quadrants: {
      frontLeftKg: Math.round(frontLeftKg),
      frontLeftPct,
      frontRightKg: Math.round(frontRightKg),
      frontRightPct,
      rearLeftKg: Math.round(rearLeftKg),
      rearLeftPct,
      rearRightKg: Math.round(rearRightKg),
      rearRightPct,
    },
    heaviestItems,
    recommendations,
  };
}

/**
 * Improves the estimated cargo load balance and center of gravity for a single truck.
 * Rearranges ONLY the components already assigned to this truck.
 * Prioritizes:
 * - Centering estimated Cargo CoG near optimal loading coordinates (bedLength / 2, bedWidth / 2)
 * - Balancing Front vs Rear distribution towards 50% / 50%
 * - Balancing Left vs Right distribution towards 50% / 50%
 * - Strictly keeping all components inside the usable bed (0 <= x <= lengthLimit - w, 0 <= y <= widthLimit - l)
 * - Strictly preventing collisions (no overlaps)
 * - Respecting component dimensions and payload limits
 * - Allowing component relocation and rotation
 * - Does NOT move components to another truck, add/remove components, change origin grouping, or perform automatic stacking
 */
export function improveLoadBalance(truck: Truck): PackedItem[] {
  if (!truck.items || truck.items.length === 0) return [];
  
  const bedLength = truck.lengthLimit;
  const bedWidth = truck.widthLimit;
  const idealX = bedLength / 2;
  const idealY = bedWidth / 2;

  // Single item case: simply center it on the bed
  if (truck.items.length === 1) {
    const single = truck.items[0];
    const cx = Math.max(0, Math.round((bedLength - single.w) / 2));
    const cy = Math.max(0, Math.round((bedWidth - single.l) / 2));
    return [{ ...single, x: cx, y: cy }];
  }

  // Helper to validate and score an item arrangement
  const evaluateArrangement = (items: PackedItem[]): { valid: boolean; score: number; fitness: number; balance: LoadBalanceResult | null } => {
    if (items.length !== truck.items.length) {
      return { valid: false, score: -1, fitness: -Infinity, balance: null };
    }

    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      if (a.x < 0 || a.y < 0 || a.x + a.w > bedLength + 0.1 || a.y + a.l > bedWidth + 0.1) {
        return { valid: false, score: -1, fitness: -Infinity, balance: null };
      }
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j];
        if (rectanglesOverlap(a.x, a.y, a.w, a.l, b.x, b.y, b.w, b.l)) {
          return { valid: false, score: -1, fitness: -Infinity, balance: null };
        }
      }
    }

    const balance = calculateLoadBalance({ ...truck, items });
    const fitness = (balance.score * 1000)
      - (Math.abs(balance.offsetXMm) * 0.4)
      - (Math.abs(balance.offsetYMm) * 1.5)
      - (Math.abs(balance.frontPct - 50) * 120)
      - (Math.abs(balance.leftPct - 50) * 200);

    return { valid: true, score: balance.score, fitness, balance };
  };

  const originalEval = evaluateArrangement(truck.items);
  let bestItems: PackedItem[] = truck.items;
  let bestFitness = originalEval.fitness;
  let bestScore = originalEval.score;

  // Helper to test a candidate arrangement
  const testCandidate = (candidate: PackedItem[]) => {
    const res = evaluateArrangement(candidate);
    if (res.valid && res.fitness > bestFitness) {
      bestFitness = res.fitness;
      bestScore = res.score;
      bestItems = candidate.map(p => ({ ...p }));
    }
  };

  // 1. Candidate Strategy: Cluster Shift of original items
  const testClusterShifts = (baseItems: PackedItem[]) => {
    const minX = Math.min(...baseItems.map(p => p.x));
    const maxX = Math.max(...baseItems.map(p => p.x + p.w));
    const minY = Math.min(...baseItems.map(p => p.y));
    const maxY = Math.max(...baseItems.map(p => p.y + p.l));

    const bal = calculateLoadBalance({ ...truck, items: baseItems });
    const idealShiftX = Math.round(idealX - bal.cogX);
    const idealShiftY = Math.round(idealY - bal.cogY);

    const shiftXOptions = [
      idealShiftX,
      Math.round(idealShiftX * 0.8),
      Math.round(idealShiftX * 0.5),
      Math.round((bedLength - (maxX - minX)) / 2 - minX),
      0
    ];

    const shiftYOptions = [
      idealShiftY,
      Math.round(idealShiftY * 0.8),
      Math.round(idealShiftY * 0.5),
      Math.round((bedWidth - (maxY - minY)) / 2 - minY),
      0
    ];

    for (const sx of shiftXOptions) {
      for (const sy of shiftYOptions) {
        const clampedSx = Math.max(-minX, Math.min(bedLength - maxX, sx));
        const clampedSy = Math.max(-minY, Math.min(bedWidth - maxY, sy));
        const shifted = baseItems.map(pi => ({
          ...pi,
          x: Math.round(pi.x + clampedSx),
          y: Math.round(pi.y + clampedSy),
        }));
        testCandidate(shifted);
      }
    }
  };

  // Test cluster shifts on original items
  testClusterShifts(truck.items);

  // 2. Candidate Strategy: Repacked Layout + Cluster Centering Shift
  const repacked = repackSingleTruck(truck);
  if (repacked && repacked.length === truck.items.length) {
    testCandidate(repacked);
    testClusterShifts(repacked);
  }

  // 3. Candidate Strategy: Constructive Center-Out Balanced Placement
  const itemsToPack = truck.items.map(pi => pi.item);
  
  // Try multiple sorting strategies (heaviest first, area descending, etc.)
  const sortStrategies = [
    (a: typeof itemsToPack[0], b: typeof itemsToPack[0]) => b.weight - a.weight,
    (a: typeof itemsToPack[0], b: typeof itemsToPack[0]) => (b.length * b.width) - (a.length * a.width),
    (a: typeof itemsToPack[0], b: typeof itemsToPack[0]) => Math.max(b.length, b.width) - Math.max(a.length, a.width),
  ];

  for (const sortFn of sortStrategies) {
    const sorted = [...itemsToPack].sort(sortFn);
    const placed: PackedItem[] = [];

    let possible = true;
    for (const item of sorted) {
      // Possible anchors
      const anchors: { x: number; y: number }[] = [
        // Center area
        { x: Math.round(idealX - item.length / 2), y: Math.round(idealY - item.width / 2) },
        { x: Math.round(idealX - item.width / 2), y: Math.round(idealY - item.length / 2) },
        { x: Math.round(idealX), y: Math.round(idealY - item.width / 2) },
        { x: Math.round(idealX - item.length), y: Math.round(idealY - item.width / 2) },
        { x: 0, y: Math.round((bedWidth - item.width) / 2) },
        { x: Math.round(bedLength - item.length), y: Math.round((bedWidth - item.width) / 2) },
      ];

      // Also add adjacent anchors from already placed items
      for (const p of placed) {
        anchors.push(
          { x: p.x + p.w, y: p.y },
          { x: p.x - item.length, y: p.y },
          { x: p.x, y: p.y + p.l },
          { x: p.x, y: p.y - item.width },
          { x: p.x + p.w, y: Math.round((bedWidth - item.width) / 2) },
          { x: p.x - item.length, y: Math.round((bedWidth - item.width) / 2) },
          { x: p.x + p.w, y: Math.round((bedWidth - item.length) / 2) },
          { x: p.x - item.width, y: Math.round((bedWidth - item.length) / 2) },
        );
      }

      let bestPlacementForThisItem: PackedItem | null = null;
      let minDeviation = Infinity;

      // Check both orientations
      const orientations = [
        { w: item.length, l: item.width, rotated: false },
        { w: item.width, l: item.length, rotated: true },
      ];

      for (const orient of orientations) {
        if (orient.w > bedLength || orient.l > bedWidth) continue;

        for (const anchor of anchors) {
          const x = Math.max(0, Math.min(bedLength - orient.w, anchor.x));
          const y = Math.max(0, Math.min(bedWidth - orient.l, anchor.y));

          // Check overlap
          let collision = false;
          for (const other of placed) {
            if (rectanglesOverlap(x, y, orient.w, orient.l, other.x, other.y, other.w, other.l)) {
              collision = true;
              break;
            }
          }

          if (!collision) {
            // Evaluate how this placement contributes to balance
            const tempPlaced = [...placed, { item, x, y, w: orient.w, l: orient.l, rotated: orient.rotated }];
            const tempBal = calculateLoadBalance({ ...truck, items: tempPlaced });
            
            // Deviation from ideal center
            const dev = Math.abs(tempBal.cogX - idealX) * 1.0 
              + Math.abs(tempBal.cogY - idealY) * 2.5
              + Math.abs(tempBal.frontPct - 50) * 80
              + Math.abs(tempBal.leftPct - 50) * 120;

            if (dev < minDeviation) {
              minDeviation = dev;
              bestPlacementForThisItem = { item, x, y, w: orient.w, l: orient.l, rotated: orient.rotated };
            }
          }
        }
      }

      if (bestPlacementForThisItem) {
        placed.push(bestPlacementForThisItem);
      } else {
        possible = false;
        break;
      }
    }

    if (possible && placed.length === itemsToPack.length) {
      testCandidate(placed);
      testClusterShifts(placed);
    }
  }

  // 4. Local Search / Micro-tuning optimization passes on the best layout found
  let refined = bestItems.map(pi => ({ ...pi }));

  for (let pass = 0; pass < 3; pass++) {
    let improvedInPass = false;

    // A) Nudge along X and Y
    for (let i = 0; i < refined.length; i++) {
      const current = refined[i];
      const xSteps = [-1500, -800, -400, -200, -100, 100, 200, 400, 800, 1500];
      const ySteps = [-300, -150, -50, 50, 150, 300];

      // Try centering Y
      const centerPosY = Math.max(0, Math.min(bedWidth - current.l, Math.round((bedWidth - current.l) / 2)));
      const testPos = [
        ...ySteps.map(sy => ({ x: current.x, y: Math.max(0, Math.min(bedWidth - current.l, current.y + sy)) })),
        ...xSteps.map(sx => ({ x: Math.max(0, Math.min(bedLength - current.w, current.x + sx)), y: current.y })),
        { x: current.x, y: centerPosY }
      ];

      for (const pos of testPos) {
        if (pos.x === current.x && pos.y === current.y) continue;

        // Check collision
        let overlap = false;
        for (let j = 0; j < refined.length; j++) {
          if (i === j) continue;
          const other = refined[j];
          if (rectanglesOverlap(pos.x, pos.y, current.w, current.l, other.x, other.y, other.w, other.l)) {
            overlap = true;
            break;
          }
        }

        if (!overlap) {
          const testCandidateItems = refined.map((pi, idx) => idx === i ? { ...pi, x: pos.x, y: pos.y } : pi);
          const evalRes = evaluateArrangement(testCandidateItems);
          if (evalRes.valid && evalRes.fitness > bestFitness) {
            bestFitness = evalRes.fitness;
            bestScore = evalRes.score;
            refined = testCandidateItems;
            bestItems = testCandidateItems;
            improvedInPass = true;
            break;
          }
        }
      }

      // B) Try In-Place Rotation
      const rotatedW = current.l;
      const rotatedL = current.w;
      if (rotatedW <= bedLength && rotatedL <= bedWidth) {
        const rotX = Math.max(0, Math.min(bedLength - rotatedW, current.x));
        const rotY = Math.max(0, Math.min(bedWidth - rotatedL, current.y));

        let rotOverlap = false;
        for (let j = 0; j < refined.length; j++) {
          if (i === j) continue;
          const other = refined[j];
          if (rectanglesOverlap(rotX, rotY, rotatedW, rotatedL, other.x, other.y, other.w, other.l)) {
            rotOverlap = true;
            break;
          }
        }

        if (!rotOverlap) {
          const testRotItems = refined.map((pi, idx) => idx === i ? {
            ...pi,
            x: rotX,
            y: rotY,
            w: rotatedW,
            l: rotatedL,
            rotated: !pi.rotated,
          } : pi);
          const evalRot = evaluateArrangement(testRotItems);
          if (evalRot.valid && evalRot.fitness > bestFitness) {
            bestFitness = evalRot.fitness;
            bestScore = evalRot.score;
            refined = testRotItems;
            bestItems = testRotItems;
            improvedInPass = true;
          }
        }
      }
    }

    // C) Try Swapping Positions of two items
    for (let i = 0; i < refined.length; i++) {
      for (let j = i + 1; j < refined.length; j++) {
        const itemA = refined[i];
        const itemB = refined[j];

        // Check if itemA fits in posB and itemB fits in posA
        const posA = { x: itemB.x, y: itemB.y };
        const posB = { x: itemA.x, y: itemA.y };

        if (posA.x + itemA.w <= bedLength && posA.y + itemA.l <= bedWidth &&
            posB.x + itemB.w <= bedLength && posB.y + itemB.l <= bedWidth) {
          
          let swapCollision = false;
          // Check collision with each other
          if (rectanglesOverlap(posA.x, posA.y, itemA.w, itemA.l, posB.x, posB.y, itemB.w, itemB.l)) {
            swapCollision = true;
          }

          // Check collision with all other items
          if (!swapCollision) {
            for (let k = 0; k < refined.length; k++) {
              if (k === i || k === j) continue;
              const other = refined[k];
              if (rectanglesOverlap(posA.x, posA.y, itemA.w, itemA.l, other.x, other.y, other.w, other.l) ||
                  rectanglesOverlap(posB.x, posB.y, itemB.w, itemB.l, other.x, other.y, other.w, other.l)) {
                swapCollision = true;
                break;
              }
            }
          }

          if (!swapCollision) {
            const swapped = refined.map((pi, idx) => {
              if (idx === i) return { ...pi, x: posA.x, y: posA.y };
              if (idx === j) return { ...pi, x: posB.x, y: posB.y };
              return pi;
            });

            const evalSwap = evaluateArrangement(swapped);
            if (evalSwap.valid && evalSwap.fitness > bestFitness) {
              bestFitness = evalSwap.fitness;
              bestScore = evalSwap.score;
              refined = swapped;
              bestItems = swapped;
              improvedInPass = true;
            }
          }
        }
      }
    }

    if (!improvedInPass) break;
  }

  // Final check: if bestScore is greater than or equal to original, return bestItems
  return bestItems;
}
