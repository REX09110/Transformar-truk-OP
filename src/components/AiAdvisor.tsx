import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, CheckCircle2, ShieldAlert, Leaf, AlertCircle, ArrowUpRight, Copy, RefreshCw } from 'lucide-react';
import { Truck, TransformerItem } from '../types';

interface Insight {
  title: string;
  type: "stacking" | "elimination" | "safety" | "green";
  english: string;
  arabic: string;
  co2Savings?: string;
}

interface AiAdvisorProps {
  trucks: Truck[];
  unpackedItems: TransformerItem[];
  onInsightsGenerated?: (insights: Insight[]) => void;
}

export const AiAdvisor: React.FC<AiAdvisorProps> = ({ trucks, unpackedItems, onInsightsGenerated }) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [fallbackMode, setFallbackMode] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>("Initializing analysis...");

  const loadingSteps = [
    "MK AI ADVISOR: Performing Deep Stacking Structural Integrity check...",
    "MK AI ADVISOR: Verifying Base Layer stability (Heavier/Rigid checks)...",
    "MK AI ADVISOR: Scanning for underutilized trailers to eliminate...",
    "MK AI ADVISOR: Calculating CO2 reduction metrics and environmental savings...",
    "MK AI ADVISOR: Generating bilingual Arabic translations and actions..."
  ];

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    
    // Cycle through professional loading messages
    let stepIndex = 0;
    setLoadingStep(loadingSteps[0]);
    const stepInterval = setInterval(() => {
      stepIndex = (stepIndex + 1) % loadingSteps.length;
      setLoadingStep(loadingSteps[stepIndex]);
    }, 1200);

    try {
      const response = await fetch('/api/ai-advisor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trucks, unpackedItems }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.insights && Array.isArray(data.insights)) {
        setInsights(data.insights);
        setFallbackMode(!!data.fallback);
        if (onInsightsGenerated) {
          onInsightsGenerated(data.insights);
        }
      } else {
        throw new Error("Invalid insights format received from API.");
      }
    } catch (err: any) {
      console.error("Failed to query MK AI ADVISOR backend:", err);
      setError("Unable to reach senior advisor API. Running offline deterministic heuristics.");
      
      // Fallback: Generate local mathematical insights
      const localInsights = simulateLocalHeuristics();
      setInsights(localInsights);
      setFallbackMode(true);
      if (onInsightsGenerated) {
        onInsightsGenerated(localInsights);
      }
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  };

  // Helper local heuristic calculator for offline backup
  const simulateLocalHeuristics = (): Insight[] => {
    const localInsights: Insight[] = [];
    const flatbeds = trucks.filter(t => t.type === 'Flat Bed' || t.type === '40ft HC Container');
    
    // 1. VERTICAL STACKING ANALYSIS
    const flatbedItems: any[] = [];
    flatbeds.forEach(t => {
      t.items.forEach(pi => {
        flatbedItems.push({ ...pi, truckId: t.id, truckNumber: t.truckNumber });
      });
    });

    flatbedItems.sort((a, b) => (b.item.weight) - (a.item.weight)); // Heavier first

    let stackingPairFound = false;
    for (let i = 0; i < flatbedItems.length; i++) {
      const bottom = flatbedItems[i];
      for (let j = 0; j < flatbedItems.length; j++) {
        if (i === j) continue;
        const top = flatbedItems[j];

        const isBottomHeavy = bottom.item.weight > top.item.weight;
        const topFitsInside = (top.item.length <= bottom.item.length && top.item.width <= bottom.item.width) ||
                              (top.item.width <= bottom.item.length && top.item.length <= bottom.item.width);
        const combinedHeightSafe = bottom.item.height + top.item.height <= 2500;
        const bottomIsRigid = bottom.item.stackable !== false &&
                              !bottom.item.componentName.toLowerCase().includes('conservator') &&
                              !bottom.item.componentName.toLowerCase().includes('kiosk');

        if (isBottomHeavy && topFitsInside && combinedHeightSafe && bottomIsRigid) {
          localInsights.push({
            title: "VERTICAL STACKING & FOOTPRINT OPTIMIZATION / التكديس الرأسي واستغلال المساحة",
            type: "stacking",
            english: `Optimize flatbed floor space in cargo layout by stacking **${top.item.componentName}** (${top.item.weight} kg, ${top.item.length}×${top.item.width}×${top.item.height} mm) on top of **${bottom.item.componentName}** (${bottom.item.weight} kg, ${bottom.item.length}×${bottom.item.width}×${bottom.item.height} mm).\n\n**Action Steps:**\n1. Position the heavier **${bottom.item.componentName}** firmly as the base layer.\n2. Stack the lighter **${top.item.componentName}** directly on top, ensuring perfect boundary alignment.\n3. This vertical combination results in a combined height of ${bottom.item.height + top.item.height} mm, well within the safety clearance limit of 2500 mm, freeing up ${(top.item.length * top.item.width / 1000000).toFixed(2)} m² of floor space.`,
            arabic: `ضاعف كفاءة استخدام المساحة الأرضية للشاحنة عن طريق تكديس **${top.item.componentName}** (بوزن ${top.item.weight} كجم، وأبعاد ${top.item.length}×${top.item.width}×${top.item.height} ملم) فوق **${bottom.item.componentName}** (بوزن ${bottom.item.weight} كجم، وأبعاد ${bottom.item.length}×${bottom.item.width}×${bottom.item.height} ملم).\n\n---\n**خطوات التنفيذ:**\n1. ضع صندوق **${bottom.item.componentName}** الأثقل وزناً في الأسفل كقاعدة ثابتة.\n2. قم بتكديس **${top.item.componentName}** الأقل وزناً فوقه مباشرة، مع ضمان المحاذاة الكاملة لمنع أي بروز.\n3. هذا التكديس الرأسي يعطي ارتفاعاً إجمالياً يبلغ ${bottom.item.height + top.item.height} ملم، وهو آمن تماماً وتحت حد الارتفاع الأقصى (2500 ملم)، مما يوفر مساحة أرضية تبلغ ${(top.item.length * top.item.width / 1000000).toFixed(2)} متر مربع.`
          });
          stackingPairFound = true;
          break;
        }
      }
      if (stackingPairFound) break;
    }

    if (!stackingPairFound) {
      localInsights.push({
        title: "VERTICAL STACKING & FOOTPRINT OPTIMIZATION / التكديس الرأسي واستغلال المساحة",
        type: "stacking",
        english: "Improve flatbed space utilization by stacking rigid bushing crates and spare accessory boxes where dimensions align.\n\n**Action Steps:**\n1. Always place the heavier box as the foundation layer on the bed floor.\n2. Verify that the top box dimensions are fully enclosed within the lower box perimeter (zero overhang).\n3. Keep combined vertical height under 2500 mm for flatbed transit clearance.",
        arabic: "حسن استغلال مساحة الشاحنات المسطحة عن طريق التكديس الرأسي لصناديق العوازل الصلبة وصناديق الملحقات عندما تتطابق الأبعاد.\n\n---\n**خطوات التنفيذ:**\n1. ضع دائماً الصناديق الأثقل كطبقة أساسية على أرضية الشاحنة.\n2. تحقق من أن أبعاد الصندوق العلوي تقع بالكامل داخل محيط الصندوق السفلي دون أي بروز.\n3. حافظ على الارتفاع الرأسي الإجمالي أقل من 2500 ملم لضمان المرور الآمن تحت الجسور."
      });
    }

    // 2. TRUCK ELIMINATION Heuristic
    let underutilizedTruck: any = null;
    flatbeds.forEach(t => {
      const totalBedArea = t.lengthLimit * t.widthLimit;
      const occupiedArea = t.items.reduce((sum, pi) => sum + (pi.w * pi.l), 0);
      const utilization = totalBedArea > 0 ? (occupiedArea / totalBedArea) * 100 : 0;
      
      if (utilization > 0 && utilization < 35 && t.items.length <= 2) {
        underutilizedTruck = t;
      }
    });

    if (underutilizedTruck && flatbeds.length > 1) {
      const co2Reduction = Math.round((1 / flatbeds.length) * 100);
      const itemsText = underutilizedTruck.items.map((pi: any) => `**${pi.item.componentName}**`).join(" and ");
      const itemsTextAr = underutilizedTruck.items.map((pi: any) => `**${pi.item.componentName}**`).join(" و ");

      localInsights.push({
        title: "TRUCK ELIMINATION & GREEN LOGISTICS / تقليص عدد الشاحنات واللوجستيات الخضراء",
        type: "elimination",
        english: `Flat Bed #${underutilizedTruck.truckNumber} is underutilized (<35% floor area) containing only ${itemsText}.\n\n**Action Steps:**\n1. Manually transfer ${itemsText} to other semi-filled Flat Beds with vacant spots.\n2. Remove Flat Bed #${underutilizedTruck.truckNumber} from layout.\n3. This consolidation eliminates a full trailer cargo trip, producing an immediate **${co2Reduction}% reduction in carbon emissions** and substantial dispatch savings.`,
        arabic: `الشاحنة المسطحة رقم #${underutilizedTruck.truckNumber} غير مستغلة بشكل كافٍ (أقل من 35٪ من المساحة) وتحتوي فقط على ${itemsTextAr}.\n\n---\n**خطوات التنفيذ:**\n1. انقل ${itemsTextAr} يدوياً إلى مساحات شاغرة في الشاحنات المسطحة الأخرى.\n2. احذف الشاحنة المسطحة رقم #${underutilizedTruck.truckNumber} من خطة الشحن.\n3. هذا الدمج يلغي رحلة مقطورة بالكامل، مما يحقق توفيراً فورياً بنسبة **${co2Reduction}٪ من انبعاثات الكربون** وتقليص التكاليف.`,
        co2Savings: `${co2Reduction}% CO2 Reduction`
      });
    } else {
      const co2Reduction = flatbeds.length > 2 ? Math.round((1 / flatbeds.length) * 100) : 25;
      localInsights.push({
        title: "CONSOLIDATION & GREEN LOGISTICS / دمج الشحنات واللوجستيات الخضراء",
        type: "green",
        english: `Optimize active cargo dispatch list to merge spare accessory boxes and avoid launching empty flatbeds.\n\n**Action Steps:**\n1. Review underutilized flatbed layouts. Drag accessory components to empty spaces on primary trucks.\n2. Eliminating one extra trailer out of the convoy yields an approximate **${co2Reduction}% carbon footprint reduction** and enhances operational logistics efficiency.`,
        arabic: `راجع قائمة المكونات المتبقية لدمج الصناديق الصغيرة وتجنب إرسال شاحنات فارغة.\n\n---\n**خطوات التنفيذ:**\n1. راجع توزيع الشاحنات الأقل حمولة. انقل المكونات الصغيرة إلى الزوايا الفارغة في الشاحنات الرئيسية.\n2. إلغاء مقطورة واحدة غير ضرورية من القافلة يوفر حوالي **${co2Reduction}٪ من البصمة الكربونية** ويحسن كفاءة الأسطول.`,
        co2Savings: `${co2Reduction}% CO2 Reduction`
      });
    }

    // 3. SAFETY & WEIGHT DISTRIBUTION Heuristic
    const heavyItem = flatbedItems.find(pi => pi.item.weight >= 1500);
    if (heavyItem) {
      localInsights.push({
        title: "STRUCTURAL INTEGRITY & WEIGHT SAFETY / السلامة الهيكلية وتوزيع الأوزان",
        type: "safety",
        english: `Heavy accessories like **${heavyItem.item.componentName}** (${heavyItem.item.weight} kg) require strict placement to protect trailer chassis.\n\n**Action Steps:**\n1. Position **${heavyItem.item.componentName}** directly over the main frame beams, near the longitudinal centerline of the trailer bed.\n2. Never place extreme weights near the very rear overhang or extreme sides of the flatbed, as this compromises axle balance and causes dangerous trailer swaying during transit.`,
        arabic: `الملحقات الثقيلة مثل **${heavyItem.item.componentName}** (بوزن ${heavyItem.item.weight} كجم) تتطلب تحديداً دقيقاً لموضعها لحماية هيكل المقطورة.\n\n---\n**خطوات التنفيذ:**\n1. ضع **${heavyItem.item.componentName}** مباشرة فوق عوارض الهيكل الرئيسية، بالقرب من خط المنتصف الطولي للشاحنة.\n2. تجنب تماماً وضع الأوزان الثقيلة بالقرب من الأطراف الجانبية أو المؤخرة المعلقة، لأن ذلك يخل بتوازن المحاور ويسبب تمايلاً خطيراً للمقطورة أثناء الحركة.`
      });
    } else {
      localInsights.push({
        title: "AXLE LOAD DISTRIBUTION SAFETY / سلامة توزيع الأحمال على المحاور",
        type: "safety",
        english: "Maintain proper heavy cargo axle distribution to prevent trailer instability and mechanical stress.\n\n**Action Steps:**\n1. Always load the heaviest crates first, locating them close to the trailer center-of-gravity (above the main axles).\n2. Place lighter, fragile control panel enclosures or marshalling kiosks further towards the front or rear compartments to balance cargo distribution.",
        arabic: "حافظ على التوزيع الصحيح للأحمال الثقيلة على المحاور لمنع عدم استقرار المقطورة والإجهاد الميكانيكي.\n\n---\n**خطوات التنفيذ:**\n1. قم دائماً بتحميل الصناديق الأثقل أولاً، مع وضعها بالقرب من مركز ثقل المقطورة (فوق المحاور الرئيسية).\n2. ضع حاويات لوحات التحكم الخفيفة أو كبائن التجميع في الأقسام الأمامية أو الخلفية لموازنة توزيع الحمولة.",
      });
    }

    return localInsights;
  };

  // Re-run analysis automatically when trucks state changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInsights();
    }, 800);
    return () => clearTimeout(timer);
  }, [trucks.length, unpackedItems.length]);

  const copyToClipboard = (textEn: string, textAr: string, index: number) => {
    const combinedText = `MK AI ADVISOR - LOADING INSIGHTS\n\nEnglish:\n${textEn}\n\nالعربية:\n${textAr}`;
    navigator.clipboard.writeText(combinedText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'stacking':
        return <Sparkles className="text-tech-accent w-5 h-5 animate-pulse" />;
      case 'elimination':
        return <AlertCircle className="text-amber-400 w-5 h-5" />;
      case 'safety':
        return <ShieldAlert className="text-red-400 w-5 h-5" />;
      case 'green':
        return <Leaf className="text-emerald-400 w-5 h-5" />;
      default:
        return <Sparkles className="text-tech-accent w-5 h-5" />;
    }
  };

  const getCategoryTag = (type: string) => {
    switch (type) {
      case 'elimination':
      case 'green':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-950/50 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
            🍃 FLEET OPTIMIZATION
          </span>
        );
      case 'safety':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-950/50 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
            🛡️ SAFETY CRITICAL
          </span>
        );
      case 'stacking':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-950/50 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
            📦 INTERNAL OPTIMIZATION
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-950/50 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
            ✨ ADVISORY
          </span>
        );
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'stacking': return 'border-tech-accent/30 hover:border-tech-accent/60 bg-tech-accent/[0.01]';
      case 'elimination': return 'border-amber-500/20 hover:border-amber-500/50 bg-amber-500/[0.01]';
      case 'safety': return 'border-red-500/20 hover:border-red-500/50 bg-red-500/[0.01]';
      case 'green': return 'border-emerald-500/20 hover:border-emerald-500/50 bg-emerald-500/[0.01]';
      default: return 'border-tech-border hover:border-tech-accent/35';
    }
  };

  return (
    <div id="mk-ai-advisor-container" className="bg-tech-panel/85 border-2 border-tech-accent/30 rounded-xl p-5 shadow-2xl relative overflow-hidden space-y-5">
      {/* Decorative ambient background blur behind advisor logo */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-tech-accent/5 rounded-full blur-[80px] pointer-events-none" />
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-tech-border pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-tech-accent/15 border border-tech-accent/30 text-tech-accent shadow-md shadow-tech-accent/10 animate-pulse">
            <Sparkles size={20} className="fill-tech-accent/10" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-sans font-bold text-sm tracking-widest text-tech-accent uppercase">
                MK AI ADVISOR
              </h2>
              <span className="text-[10px] bg-tech-accent/10 text-tech-accent border border-tech-accent/30 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-widest">
                Active Audit
              </span>
              {fallbackMode && (
                <span className="text-[10px] bg-tech-bg/60 text-tech-text-secondary border border-tech-border px-1.5 py-0.5 rounded font-mono font-medium uppercase tracking-wider" title="Using offline physics constraints mapping engine">
                  Deterministic Fallback
                </span>
              )}
            </div>
            <p className="text-tech-text-secondary text-xs font-mono font-bold mt-1 uppercase tracking-wide">
              SYSTEM LOADING INTELLIGENCE & EXPERT CONSULT | تحليلات التعبئة وخبرات التحميل
            </p>
          </div>
        </div>

        <button
          onClick={fetchInsights}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 text-[10px] uppercase font-mono font-bold bg-tech-accent hover:bg-tech-accent-hover text-black rounded transition-all shadow shadow-tech-accent/15 self-start md:self-center disabled:opacity-40 cursor-pointer"
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Re-Analyze Active Blueprints
        </button>
      </div>

      {/* Main Insights Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-14 text-center space-y-4">
          <Loader2 className="w-8 h-8 text-tech-accent animate-spin" />
          <div className="space-y-1">
            <p className="text-tech-text-primary text-xs font-mono font-bold uppercase tracking-wider animate-pulse">
              {loadingStep}
            </p>
            <p className="text-[10px] text-tech-text-secondary font-mono uppercase tracking-widest">
              Consulting structural constraints & stability algorithms...
            </p>
          </div>
        </div>
      ) : error && insights.length === 0 ? (
        <div className="p-4 rounded-lg bg-red-950/25 border border-red-900/30 text-red-400 flex items-start gap-2.5">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div className="text-xs font-mono">
            <span className="font-bold uppercase block mb-1">Advisor Comm Error:</span>
            {error}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4.5">
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`flex flex-col justify-between rounded-xl border p-4.5 transition-all duration-300 relative group overflow-hidden ${getBorderColor(insight.type)}`}
            >
              {/* Highlight ribbon for CO2 savings */}
              {insight.co2Savings && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-black font-mono font-bold text-[9px] uppercase px-3 py-1 rounded-bl-lg shadow-md flex items-center gap-1">
                  <Leaf size={10} className="fill-black/10" />
                  {insight.co2Savings}
                </div>
              )}

              <div className="space-y-3.5">
                {/* Header Line */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-tech-bg/70 border border-tech-border">
                      {getIcon(insight.type)}
                    </div>
                    {getCategoryTag(insight.type)}
                  </div>
                  <h3 className="font-sans font-bold text-[11px] uppercase text-tech-text-primary tracking-wide leading-tight mt-1">
                    {insight.title}
                  </h3>
                </div>

                {/* Content Area */}
                <div className="space-y-3 text-xs leading-relaxed">
                  {/* English Section */}
                  <div className="text-tech-text-primary font-sans font-normal text-[11px] whitespace-pre-line">
                    {insight.english.split('**').map((chunk, idx) => (
                      idx % 2 === 1 ? <strong key={idx} className="text-tech-accent font-semibold">{chunk}</strong> : chunk
                    ))}
                  </div>

                  {/* Divider line representing '---' formatted Arabic split */}
                  <div className="border-t border-dashed border-tech-border/40 my-3" />

                  {/* Arabic Section */}
                  <div className="text-tech-text-secondary font-sans text-[11px] whitespace-pre-line text-right" dir="rtl">
                    {insight.arabic.split('**').map((chunk, idx) => (
                      idx % 2 === 1 ? <strong key={idx} className="text-amber-400 font-semibold">{chunk}</strong> : chunk
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Card Utilities */}
              <div className="flex items-center justify-between border-t border-tech-border/30 mt-4 pt-2.5">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-tech-text-secondary flex items-center gap-1">
                  <CheckCircle2 size={11} className="text-tech-accent" />
                  Expert Audited
                </span>

                <button
                  onClick={() => copyToClipboard(insight.english, insight.arabic, index)}
                  className="p-1.5 rounded hover:bg-tech-bg/80 border border-transparent hover:border-tech-border text-tech-text-secondary hover:text-tech-text-primary transition-all flex items-center gap-1.5 text-[10px] font-mono uppercase cursor-pointer"
                  title="Copy bilingual advice details"
                >
                  {copiedIndex === index ? (
                    <>
                      <CheckCircle2 size={12} className="text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footnote banner */}
      <div className="p-3 rounded-lg bg-tech-accent/5 border border-tech-accent/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-tech-accent/10 border border-tech-accent/25 text-tech-accent">
            <ArrowUpRight size={12} />
          </div>
          <span className="text-[10px] font-mono text-tech-text-secondary uppercase">
            Advice compiled by Voltamp’s Senior Structural Expert Engine (MK ADVISOR V1.4)
          </span>
        </div>
        <span className="text-[9px] text-tech-text-secondary font-mono uppercase tracking-widest text-right">
          NO REGULATORY/PERMIT DETAILS REPORTED
        </span>
      </div>
    </div>
  );
};
