export interface TransformerItem {
  id: string;
  projectCode: string;
  componentName: string;
  length: number; // in mm
  width: number;  // in mm
  height: number; // in mm
  weight: number; // in kg
  origin: string; // Country of origin, e.g., 'Oman', 'India', 'Germany'
  typeOfPacking?: string;
  stackable?: boolean; // Stackable vs Non-Stackable/Fragile
}

export interface PackedItem {
  item: TransformerItem;
  x: number;       // bottom-left x in mm
  y: number;       // bottom-left y in mm
  w: number;       // actual width on bed in mm (after potential rotation)
  l: number;       // actual length on bed in mm (after potential rotation)
  rotated: boolean;
}

export interface Truck {
  id: string;
  truckNumber: number;
  type: 'Flat Bed' | '40ft HC Container' | 'Low Bed';
  originGroup: 'Oman' | 'Imported' | 'Dedicated';
  items: PackedItem[];
  lengthLimit: number; // 12000 mm for Flat Bed
  widthLimit: number;  // 2340 mm for Flat Bed
  heightLimit: number; // 2500 mm for Flat Bed
  weightLimit: number; // e.g. 25000 kg, customizable
  physicalLength?: number;
  physicalWidth?: number;
  physicalHeight?: number;
  originalLengthLimit?: number;
  isFullBedMode?: boolean;
}

export interface PackingWarning {
  itemId: string;
  itemName: string;
  projectCode: string;
  reason: string;
}

export interface ExcelImportItem {
  id: string;
  itemDescription: string;
  length: number;
  width: number;
  height: number;
  qtyPerJob: number;
  totalWeight: number; // weight of all accessories in this category
  countryOfOrigin: string; // e.g., 'Oman', 'India', 'Germany', etc.
  typeOfPacking?: string;
}

export type ProjectTransportMode = 'flatbed-only' | 'lowbed-only' | 'both';

export interface OptimizationResult {
  trucks: Truck[];
  unpackedItems: TransformerItem[];
  warnings: PackingWarning[];
}

export interface TruckConfig {
  transportMode?: ProjectTransportMode;
  componentTransportType?: 'Flat Bed' | '40ft HC Container';
  flatBed: {
    physicalLength: number;
    usableLength: number;
    width: number;
    height: number;
    payloadCapacity?: number;
    internalWidth?: number;
    internalHeight?: number;
  };
  lowBed: {
    physicalLength: number;
    usableLength: number;
    width: number;
    height: number;
    payloadCapacity?: number;
  };
}

export type LoadBalanceStatus = 'GOOD' | 'REVIEW RECOMMENDED' | 'POOR DISTRIBUTION';

export interface HeaviestCargoItem {
  itemNum: number;
  name: string;
  weight: number;
  x: number;
  y: number;
  w: number;
  l: number;
  zone: string;
}

export interface LoadBalanceResult {
  totalCargoWeight: number;
  itemCount: number;
  bedLength: number;
  bedWidth: number;
  
  // Center of Gravity
  cogX: number; // mm from front headboard (0 = front, bedLength = rear)
  cogY: number; // mm from left bed edge (0 = left, bedWidth = right)
  idealX: number; // bedLength / 2
  idealY: number; // bedWidth / 2
  
  // Offsets
  offsetXMm: number; // cogX - idealX (+ means rearward, - means forward)
  offsetYMm: number; // cogY - idealY (+ means rightward, - means leftward)
  offsetXPct: number; // percentage deviation from center
  offsetYPct: number; // percentage deviation from center
  
  // Front / Rear split
  frontWeightKg: number;
  rearWeightKg: number;
  frontPct: number;
  rearPct: number;
  
  // Left / Right split
  leftWeightKg: number;
  rightWeightKg: number;
  leftPct: number;
  rightPct: number;

  // Evaluation
  score: number; // 0 to 100
  status: LoadBalanceStatus;
  
  // Concentration
  bias: {
    front: boolean;
    rear: boolean;
    left: boolean;
    right: boolean;
    primaryZone: string;
  };
  
  // Quadrant distribution
  quadrants: {
    frontLeftKg: number;
    frontLeftPct: number;
    frontRightKg: number;
    frontRightPct: number;
    rearLeftKg: number;
    rearLeftPct: number;
    rearRightKg: number;
    rearRightPct: number;
  };

  // Heaviest components
  heaviestItems: HeaviestCargoItem[];

  // Recommendations
  recommendations: string[];
}

