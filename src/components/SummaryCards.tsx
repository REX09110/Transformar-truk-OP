import React from 'react';
import { Truck, TransformerItem } from '../types';
import { Truck as TruckIcon, Scale, Box, Target, Flag, Globe2, AlertTriangle, HelpCircle } from 'lucide-react';

interface SummaryCardsProps {
  trucks: Truck[];
  unpackedItems: TransformerItem[];
  totalWeight: number;
  overallEfficiency: number;
}

export default function SummaryCards({
  trucks,
  unpackedItems,
  totalWeight,
  overallEfficiency,
}: SummaryCardsProps) {
  const totalTrucksCount = trucks.length;
  const omanTrucksCount = trucks.filter(t => t.originGroup === 'Oman').length;
  const importedTrucksCount = trucks.filter(t => t.originGroup === 'Imported').length;
  const lowBedTrucksCount = trucks.filter(t => t.type === 'Low Bed').length;
  const totalComponentsClaimed = trucks.reduce((sum, t) => sum + t.items.length, 0);

  const flatBedTruck = trucks.find(t => t.type !== 'Low Bed');
  const fbPhysicalL = flatBedTruck?.physicalLength || (flatBedTruck?.type === '40ft HC Container' ? 12030 : 12000);
  const fbPhysicalW = flatBedTruck?.physicalWidth || (flatBedTruck?.type === '40ft HC Container' ? 2350 : 2340);
  const fbUsableL = flatBedTruck?.lengthLimit || (flatBedTruck?.type === '40ft HC Container' ? 12030 : 11800);
  const fbUsableW = flatBedTruck?.widthLimit || (flatBedTruck?.type === '40ft HC Container' ? 2340 : 2340);
  const nonLowBedType = flatBedTruck?.type || 'Flat Bed';

  const trucksSubText = lowBedTrucksCount === 0
    ? `${totalTrucksCount} ${nonLowBedType}${totalTrucksCount === 1 ? '' : 's'} (Flat Bed Only)`
    : totalTrucksCount - lowBedTrucksCount === 0
    ? `${lowBedTrucksCount} Low Bed${lowBedTrucksCount === 1 ? '' : 's'} (Low Bed Only)`
    : `${lowBedTrucksCount} Low Bed | ${totalTrucksCount - lowBedTrucksCount} ${nonLowBedType}`;

  const stats = [
    {
      title: 'Total Trucks Needed',
      value: `${totalTrucksCount} Trucks`,
      sub: trucksSubText,
      icon: <TruckIcon className="text-sky-500" size={20} />,
      bg: 'bg-sky-50 dark:bg-sky-950/30'
    },
    {
      title: 'Oman-Made Trucks',
      value: `${omanTrucksCount} Trucks`,
      sub: 'Loaded separate exclusively',
      icon: <Flag className="text-amber-500" size={20} />,
      bg: 'bg-amber-50 dark:bg-amber-950/30'
    },
    {
      title: 'Imported Trucks',
      value: `${importedTrucksCount} Trucks`,
      sub: 'Loaded separate exclusively',
      icon: <Globe2 className="text-teal-500" size={20} />,
      bg: 'bg-teal-50 dark:bg-teal-950/30'
    },
    {
      title: 'Total Shipped Mass',
      value: `${(totalWeight / 1000).toFixed(1)} Tons`,
      sub: `${totalWeight.toLocaleString()} kg total weight`,
      icon: <Scale className="text-indigo-500" size={20} />,
      bg: 'bg-indigo-50 dark:bg-indigo-950/30'
    },
    {
      title: 'Components Packed',
      value: `${totalComponentsClaimed} Units`,
      sub: `${unpackedItems.length > 0 ? `${unpackedItems.length} unpacked` : 'All items packed safely'}`,
      icon: <Box className="text-emerald-500" size={20} />,
      bg: 'bg-emerald-50 dark:bg-emerald-950/30'
    },
    {
      title: 'Weighted Efficiency',
      value: `${overallEfficiency.toFixed(1)}%`,
      sub: 'Cumulative floor occupation',
      icon: <Target className="text-purple-500" size={20} />,
      bg: 'bg-purple-50 dark:bg-purple-950/30'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Dynamic Warnings about unfit objects */}
      {unpackedItems.length > 0 && (
        <div className="bg-red-950/20 border border-red-905/40 text-red-105 rounded p-4 flex items-start gap-4">
          <div className="p-2 bg-red-900/40 rounded text-red-400">
            <AlertTriangle size={20} className="animate-bounce" />
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-red-400">
              Dimensional Clearance Warnings ({unpackedItems.length} Accessories Unfit)
            </h4>
            <p className="text-xs text-tech-text-secondary mt-1">
              Some items are larger than {nonLowBedType} usable packing boundaries ({fbUsableL} × {fbUsableW} mm) even when rotated [Physical Bed Size: {fbPhysicalL} × {fbPhysicalW} mm].
              These components are left packed in the raw inventory below.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {unpackedItems.map(item => (
                <span 
                  key={item.id} 
                  className="px-2 py-0.5 bg-red-950/40 text-red-400 border border-red-900/30 rounded text-[10px] font-mono font-medium"
                >
                  {item.componentName} ({item.length}x{item.width}x{item.height} mm)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Primary Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {stats.map((stat, idx) => {
          // Highlight the Efficiency Score card specifically!
          const isEfficiency = stat.title.includes('Efficiency');
          const isUnpacked = stat.title.includes('Components') && unpackedItems.length > 0;
          
          return (
            <div 
              key={idx} 
              className={`bg-tech-panel border rounded p-4 flex flex-col justify-between transition-all duration-200 ${
                isEfficiency 
                  ? 'border-l-2 border-l-tech-accent border-tech-border' 
                  : isUnpacked
                  ? 'border-l-2 border-l-red-500 border-tech-border'
                  : 'border-tech-border'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-tech-text-secondary uppercase tracking-widest">
                  {stat.title}
                </span>
                <div className="text-tech-text-secondary">
                  {stat.icon}
                </div>
              </div>
              
              <div className="mt-3 flex items-baseline justify-between">
                <span className={`text-2xl font-bold font-mono tracking-tight ${
                  isEfficiency 
                    ? 'text-tech-accent' 
                    : isUnpacked
                    ? 'text-red-400'
                    : 'text-tech-text-primary'
                }`}>
                  {stat.value.replace(/ Trucks| Tons| Units/, '')}
                </span>
                <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded ${
                  isEfficiency 
                    ? 'bg-tech-accent/10 text-tech-accent' 
                    : isUnpacked 
                    ? 'bg-red-500/10 text-red-400' 
                    : 'text-tech-text-secondary'
                }`}>
                  {stat.value.includes('Trucks') ? 'Rig' : stat.value.includes('Tons') ? 'T' : stat.value.includes('Units') ? 'Pcs' : 'OPTIMAL'}
                </span>
              </div>
              
              <span className="text-[10px] font-mono text-tech-text-secondary mt-1 block truncate">
                {stat.sub}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

}
