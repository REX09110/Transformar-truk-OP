import React from 'react';
import { 
  X, 
  Scale, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  Crosshair, 
  ArrowRight,
  Info,
  Layers,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Truck, LoadBalanceResult } from '../types';

interface LoadBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  truck: Truck;
  balanceResult: LoadBalanceResult;
}

export const LoadBalanceModal: React.FC<LoadBalanceModalProps> = ({
  isOpen,
  onClose,
  truck,
  balanceResult,
}) => {
  if (!isOpen) return null;

  const {
    totalCargoWeight,
    itemCount,
    bedLength,
    bedWidth,
    cogX,
    cogY,
    idealX,
    idealY,
    offsetXMm,
    offsetYMm,
    offsetXPct,
    offsetYPct,
    frontWeightKg,
    rearWeightKg,
    frontPct,
    rearPct,
    leftWeightKg,
    rightWeightKg,
    leftPct,
    rightPct,
    score,
    status,
    bias,
    quadrants,
    heaviestItems,
    recommendations,
  } = balanceResult;

  const getStatusColor = (st: typeof status) => {
    switch (st) {
      case 'GOOD':
        return {
          badge: 'bg-emerald-950/50 text-emerald-400 border-emerald-700/60',
          scoreText: 'text-emerald-400',
          icon: <CheckCircle2 size={16} className="text-emerald-400" />,
        };
      case 'REVIEW RECOMMENDED':
        return {
          badge: 'bg-amber-950/50 text-amber-400 border-amber-700/60',
          scoreText: 'text-amber-400',
          icon: <AlertTriangle size={16} className="text-amber-400" />,
        };
      case 'POOR DISTRIBUTION':
      default:
        return {
          badge: 'bg-red-950/50 text-red-400 border-red-700/60',
          scoreText: 'text-red-400',
          icon: <AlertCircle size={16} className="text-red-400" />,
        };
    }
  };

  const statusStyle = getStatusColor(status);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-slate-900 border border-tech-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="load-balance-title"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/90 border-b border-tech-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-tech-accent/10 border border-tech-accent/30 text-tech-accent">
              <Scale size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="load-balance-title" className="text-sm font-black uppercase tracking-wider text-white font-mono">
                  Estimated Cargo Load Balance Check
                </h2>
                <span className="text-[10px] bg-sky-950 text-sky-400 px-2 py-0.5 rounded font-bold border border-sky-800 font-mono">
                  Analysis Only
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Target: <strong className="text-white">{truck.type} #{truck.truckNumber}</strong> ({truck.originGroup}) — {itemCount} components, {totalCargoWeight.toLocaleString()} kg total
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Top KPI Cards: Score & CoG */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* 1. Score Card */}
            <div className="bg-slate-950/60 border border-tech-border rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                <span>Load Balance Score</span>
                <Scale size={14} className="text-tech-accent" />
              </div>
              <div className="flex items-baseline gap-3 my-2">
                <span className={`text-4xl font-black font-mono tracking-tight ${statusStyle.scoreText}`}>
                  {score}%
                </span>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border font-mono ${statusStyle.badge}`}>
                  {statusStyle.icon}
                  <span>{status}</span>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between border-t border-slate-800 pt-2 mt-1">
                <span>Concentration Zone:</span>
                <span className="text-white font-bold">{bias.primaryZone}</span>
              </div>
            </div>

            {/* 2. Longitudinal CoG */}
            <div className="bg-slate-950/60 border border-tech-border rounded-xl p-4 flex flex-col justify-between font-mono">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Longitudinal Cargo CoG (X)</span>
                <Crosshair size={14} className="text-sky-400" />
              </div>
              <div className="my-2">
                <div className="text-xl font-black text-white">
                  {cogX.toLocaleString()} mm
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Bed Center: {idealX.toLocaleString()} mm ({offsetXMm >= 0 ? `+${offsetXMm}` : offsetXMm} mm {offsetXMm >= 0 ? 'Rearward' : 'Forward'})
                </div>
              </div>
              <div className="flex justify-between items-center text-[10px] border-t border-slate-800 pt-2 text-slate-400">
                <span>Deviation:</span>
                <span className={`font-bold ${Math.abs(offsetXPct) > 15 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {Math.abs(offsetXPct)}% from Center
                </span>
              </div>
            </div>

            {/* 3. Lateral CoG */}
            <div className="bg-slate-950/60 border border-tech-border rounded-xl p-4 flex flex-col justify-between font-mono">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Lateral Cargo CoG (Y)</span>
                <Crosshair size={14} className="text-sky-400" />
              </div>
              <div className="my-2">
                <div className="text-xl font-black text-white">
                  {cogY.toLocaleString()} mm
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Centerline: {idealY.toLocaleString()} mm ({offsetYMm >= 0 ? `+${offsetYMm}` : offsetYMm} mm {offsetYMm >= 0 ? 'Right' : 'Left'})
                </div>
              </div>
              <div className="flex justify-between items-center text-[10px] border-t border-slate-800 pt-2 text-slate-400">
                <span>Deviation:</span>
                <span className={`font-bold ${Math.abs(offsetYPct) > 12 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {Math.abs(offsetYPct)}% from Centerline
                </span>
              </div>
            </div>

          </div>

          {/* Weight Distribution Bars: Front/Rear & Left/Right */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Front vs Rear */}
            <div className="bg-slate-950/40 border border-tech-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold font-mono text-white">
                <span className="flex items-center gap-1.5">
                  <ArrowRight size={14} className="text-tech-accent" />
                  Front vs. Rear Distribution
                </span>
                <span className="text-[10px] text-slate-400 uppercase">Longitudinal Balance</span>
              </div>

              {/* Progress split bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-sky-300 font-bold">Front: {frontPct}% ({frontWeightKg.toLocaleString()} kg)</span>
                  <span className="text-amber-300 font-bold">Rear: {rearPct}% ({rearWeightKg.toLocaleString()} kg)</span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex relative">
                  {/* Ideal center indicator mark */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white z-10 opacity-70" title="Target Center (50%)" />
                  <div 
                    className="bg-sky-500 h-full transition-all duration-300"
                    style={{ width: `${frontPct}%` }}
                    title={`Front: ${frontPct}%`}
                  />
                  <div 
                    className="bg-amber-500 h-full transition-all duration-300"
                    style={{ width: `${rearPct}%` }}
                    title={`Rear: ${rearPct}%`}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 font-mono px-0.5">
                  <span>Cab / Headboard</span>
                  <span>50% Center</span>
                  <span>Tail / Rear Overhang</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-300 font-mono bg-slate-900/60 p-2 rounded border border-slate-800">
                {Math.abs(frontPct - 50) <= 8 ? (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Longitudinal weight is evenly spread between front & rear axles.
                  </span>
                ) : frontPct > 58 ? (
                  <span className="text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Front-heavy bias detected ({frontPct}%). May increase tractor kingpin load.
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Rear-heavy bias detected ({rearPct}%). May cause trailer tail sag and steer axle unweighting.
                  </span>
                )}
              </div>
            </div>

            {/* Left vs Right */}
            <div className="bg-slate-950/40 border border-tech-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold font-mono text-white">
                <span className="flex items-center gap-1.5">
                  <ArrowRight size={14} className="text-tech-accent" />
                  Left vs. Right Distribution
                </span>
                <span className="text-[10px] text-slate-400 uppercase">Lateral Balance</span>
              </div>

              {/* Progress split bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-cyan-300 font-bold">Left: {leftPct}% ({leftWeightKg.toLocaleString()} kg)</span>
                  <span className="text-purple-300 font-bold">Right: {rightPct}% ({rightWeightKg.toLocaleString()} kg)</span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex relative">
                  {/* Ideal center indicator mark */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white z-10 opacity-70" title="Target Centerline (50%)" />
                  <div 
                    className="bg-cyan-500 h-full transition-all duration-300"
                    style={{ width: `${leftPct}%` }}
                    title={`Left: ${leftPct}%`}
                  />
                  <div 
                    className="bg-purple-500 h-full transition-all duration-300"
                    style={{ width: `${rightPct}%` }}
                    title={`Right: ${rightPct}%`}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 font-mono px-0.5">
                  <span>Left Edge (0 mm)</span>
                  <span>Centerline ({idealY} mm)</span>
                  <span>Right Edge ({bedWidth} mm)</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-300 font-mono bg-slate-900/60 p-2 rounded border border-slate-800">
                {Math.abs(leftPct - 50) <= 6 ? (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Lateral weight is well centered across the trailer roll axis.
                  </span>
                ) : leftPct > 56 ? (
                  <span className="text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Left-side weight bias ({leftPct}%). Risk of trailer tilt or uneven tyre wear.
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Right-side weight bias ({rightPct}%). Shift heavy units toward center or left.
                  </span>
                )}
              </div>
            </div>

          </div>

          {/* 4-Quadrant Top-Down Grid & Heaviest Cargo List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Bed 4-Quadrant Visualizer */}
            <div className="bg-slate-950/40 border border-tech-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold font-mono text-white">
                <span className="flex items-center gap-1.5">
                  <Layers size={14} className="text-tech-accent" />
                  Cargo Bed Quadrant Concentration
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-mono">Top-Down Grid</span>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono">
                {/* Front-Left */}
                <div className={`p-3 rounded-lg border text-center transition-all ${
                  quadrants.frontLeftPct >= 38 
                    ? 'bg-amber-950/30 border-amber-500 text-amber-300' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-300'
                }`}>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Front-Left</div>
                  <div className="text-lg font-black mt-0.5">{quadrants.frontLeftPct}%</div>
                  <div className="text-[10px] text-slate-400">{quadrants.frontLeftKg.toLocaleString()} kg</div>
                </div>

                {/* Rear-Left */}
                <div className={`p-3 rounded-lg border text-center transition-all ${
                  quadrants.rearLeftPct >= 38 
                    ? 'bg-amber-950/30 border-amber-500 text-amber-300' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-300'
                }`}>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Rear-Left</div>
                  <div className="text-lg font-black mt-0.5">{quadrants.rearLeftPct}%</div>
                  <div className="text-[10px] text-slate-400">{quadrants.rearLeftKg.toLocaleString()} kg</div>
                </div>

                {/* Front-Right */}
                <div className={`p-3 rounded-lg border text-center transition-all ${
                  quadrants.frontRightPct >= 38 
                    ? 'bg-amber-950/30 border-amber-500 text-amber-300' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-300'
                }`}>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Front-Right</div>
                  <div className="text-lg font-black mt-0.5">{quadrants.frontRightPct}%</div>
                  <div className="text-[10px] text-slate-400">{quadrants.frontRightKg.toLocaleString()} kg</div>
                </div>

                {/* Rear-Right */}
                <div className={`p-3 rounded-lg border text-center transition-all ${
                  quadrants.rearRightPct >= 38 
                    ? 'bg-amber-950/30 border-amber-500 text-amber-300' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-300'
                }`}>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Rear-Right</div>
                  <div className="text-lg font-black mt-0.5">{quadrants.rearRightPct}%</div>
                  <div className="text-[10px] text-slate-400">{quadrants.rearRightKg.toLocaleString()} kg</div>
                </div>
              </div>
              
              <div className="text-[10px] text-slate-400 font-mono text-center">
                * Balanced ideal is ~25% per quadrant for uniform distributed payload.
              </div>
            </div>

            {/* Heaviest Components List */}
            <div className="bg-slate-950/40 border border-tech-border rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold font-mono text-white">
                <span className="flex items-center gap-1.5">
                  <Scale size={14} className="text-tech-accent" />
                  Heavy Weight Concentration Items
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-mono">Key Contributors</span>
              </div>

              <div className="space-y-1.5">
                {heaviestItems.map(item => (
                  <div 
                    key={item.itemNum}
                    className="flex items-center justify-between p-2 rounded bg-slate-900/70 border border-slate-800 text-[11px] font-mono"
                  >
                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                      <span className="font-black text-tech-accent px-1.5 py-0.5 rounded bg-tech-accent/10 border border-tech-accent/20 shrink-0">
                        #{item.itemNum}
                      </span>
                      <span className="font-sans font-medium text-slate-200 truncate" title={item.name}>
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {item.zone}
                      </span>
                      <span className="font-bold text-white">
                        {item.weight.toLocaleString()} kg
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Actionable Engineering Recommendations */}
          <div className="bg-slate-950/60 border border-tech-border rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold font-mono text-white">
              <Info size={15} className="text-tech-accent" />
              <span>Engineering Load Balance Recommendations (Advisory Only)</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300 font-sans">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-tech-accent font-bold mt-0.5">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Technical Limitation Mandatory Disclaimer */}
          <div className="bg-slate-950 border border-amber-900/40 rounded-xl p-3.5 flex items-start gap-3 text-[11px] leading-relaxed text-amber-200/90 font-mono">
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300 uppercase tracking-wide">Important Technical Limitation:</strong>
              <p className="mt-0.5 text-slate-300">
                This feature provides an <strong>Estimated Cargo Load Balance</strong> and <strong>Estimated Cargo CoG</strong> based on individual component weights and 2D positions within the trailer bed. It does <em>NOT</em> calculate actual axle loads, kingpin load limits, or certify transport safety. Actual transport legality depends on vehicle chassis tare weights, tractor-trailer fifth-wheel positioning, bridge formulas, and road regulations.
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/90 border-t border-tech-border flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-mono">
            * Drag components on the 2D Blueprint to balance weight, then re-check.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-tech-accent hover:bg-tech-accent-hover text-black font-bold text-xs font-mono uppercase transition-colors cursor-pointer"
          >
            Close Analysis
          </button>
        </div>

      </div>
    </div>
  );
};
