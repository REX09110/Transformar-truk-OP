import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON body parsing with reasonable size limit for item/truck lists
app.use(express.json({ limit: "10mb" }));

// Initialize Gemini Client
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("MK AI ADVISOR: GoogleGenAI initialized successfully with GEMINI_API_KEY.");
  } catch (error) {
    console.error("MK AI ADVISOR: Failed to initialize GoogleGenAI:", error);
  }
} else {
  console.warn("MK AI ADVISOR: GEMINI_API_KEY is not defined in the environment. Running in deterministic fallback mode.");
}

// -------------------------------------------------------------------------
// DETERMINISTIC BILINGUAL INSIGHTS FALLBACK ENGINE (For local/offline safety)
// -------------------------------------------------------------------------
interface Insight {
  title: string;
  type: "stacking" | "elimination" | "safety" | "green";
  english: string;
  arabic: string;
  co2Savings?: string;
}

function generateLocalInsights(trucks: any[], unpackedItems: any[]): Insight[] {
  const insights: Insight[] = [];

  // Group trucks by type
  const flatbeds = trucks.filter((t) => t.type === "Flat Bed" || t.type === "40ft HC Container");
  const lowbeds = trucks.filter((t) => t.type === "Low Bed");

  // 1. VERTICAL STACKING ANALYSIS
  // Find candidates for stacking: we look for smaller, lighter boxes that can sit on top of larger, heavier boxes
  let stackingFound = false;
  
  // Flatten all flatbed items to inspect compatibility
  const flatbedItems: any[] = [];
  flatbeds.forEach((truck) => {
    truck.items.forEach((pi: any) => {
      flatbedItems.push({
        ...pi,
        truckId: truck.id,
        truckNumber: truck.truckNumber,
      });
    });
  });

  // Sort by footprint area descending
  flatbedItems.sort((a, b) => (b.w * b.l) - (a.w * a.l));

  // Try to find a valid pair (Bottom: heavy/stable, Top: lighter/smaller)
  for (let i = 0; i < flatbedItems.length; i++) {
    const bottom = flatbedItems[i];
    for (let j = 0; j < flatbedItems.length; j++) {
      if (i === j) continue;
      const top = flatbedItems[j];

      // Stacking physical rules:
      // - Bottom must be heavier than top
      // - Top length <= Bottom length and Top width <= Bottom width (or rotated)
      // - Bottom must not be fragile/unsuitable (usually conservators are cylindrical or delicate, but HV/LV boxes are rigid)
      // - Combined height must be reasonable (e.g., bottom.item.height + top.item.height <= 2400)
      const isBottomHeavy = bottom.item.weight > top.item.weight;
      const topFitsOnBottom = (top.item.length <= bottom.item.length && top.item.width <= bottom.item.width) ||
                              (top.item.width <= bottom.item.length && top.item.length <= bottom.item.width);
      const combinedHeightSafe = bottom.item.height + top.item.height <= 2500;
      const bottomIsNotFragile = !bottom.item.componentName.toLowerCase().includes("conservator") && 
                                  !bottom.item.componentName.toLowerCase().includes("kiosk");

      if (isBottomHeavy && topFitsOnBottom && combinedHeightSafe && bottomIsNotFragile) {
        // Formulate vertical stacking advice
        insights.push({
          title: "VERTICAL STACKING & FOOTPRINT OPTIMIZATION / التكديس الرأسي واستغلال المساحة",
          type: "stacking",
          english: `Optimize flatbed floor space in cargo layout by stacking **${top.item.componentName}** (${top.item.weight} kg, ${top.item.length}×${top.item.width}×${top.item.height} mm) on top of **${bottom.item.componentName}** (${bottom.item.weight} kg, ${bottom.item.length}×${bottom.item.width}×${bottom.item.height} mm).\n\n**Action Steps:**\n1. Position the heavier **${bottom.item.componentName}** firmly as the base layer.\n2. Stack the lighter **${top.item.componentName}** directly on top, ensuring perfect boundary alignment.\n3. This vertical combination results in a combined height of ${bottom.item.height + top.item.height} mm, well within the safety clearance limit of 2500 mm, freeing up ${(top.item.length * top.item.width / 1000000).toFixed(2)} m² of valuable floor space.`,
          arabic: `ضاعف كفاءة استخدام المساحة الأرضية للشاحنة عن طريق تكديس **${top.item.componentName}** (بوزن ${top.item.weight} كجم، وأبعاد ${top.item.length}×${top.item.width}×${top.item.height} ملم) فوق **${bottom.item.componentName}** (بوزن ${bottom.item.weight} كجم، وأبعاد ${bottom.item.length}×${bottom.item.width}×${bottom.item.height} ملم).\n\n---\n**خطوات التنفيذ:**\n1. ضع صندوق **${bottom.item.componentName}** الأثقل وزناً في الأسفل كقاعدة ثابتة.\n2. قم بتكديس **${top.item.componentName}** الأقل وزناً فوقه مباشرة، مع ضمان المحاذاة الكاملة لمنع أي بروز.\n3. هذا التكديس الرأسي يعطي ارتفاعاً إجمالياً يبلغ ${bottom.item.height + top.item.height} ملم، وهو آمن تماماً وتحت حد الارتفاع الأقصى (2500 ملم)، مما يوفر مساحة أرضية تبلغ ${(top.item.length * top.item.width / 1000000).toFixed(2)} متر مربع.`
        });
        stackingFound = true;
        break;
      }
    }
    if (stackingFound) break;
  }

  // If no stacking candidates found, add a generic stacking rule
  if (!stackingFound) {
    insights.push({
      title: "VERTICAL STACKING & FOOTPRINT OPTIMIZATION / التكديس الرأسي واستغلال المساحة",
      type: "stacking",
      english: "Improve flatbed space utilization by stacking rigid bushing crates and spare accessory boxes where dimensions align.\n\n**Action Steps:**\n1. Always place the heavier box as the foundation layer on the bed floor.\n2. Verify that the top box dimensions are fully enclosed within the lower box perimeter (zero overhang).\n3. Keep combined vertical height under 2500 mm for flatbed transit clearance.",
      arabic: "حسن استغلال مساحة الشاحنات المسطحة عن طريق التكديس الرأسي لصناديق العوازل الصلبة وصناديق الملحقات عندما تتطابق الأبعاد.\n\n---\n**خطوات التنفيذ:**\n1. ضع دائماً الصناديق الأثقل كطبقة أساسية على أرضية الشاحنة.\n2. تحقق من أن أبعاد الصندوق العلوي تقع بالكامل داخل محيط الصندوق السفلي دون أي بروز.\n3. حافظ على الارتفاع الرأسي الإجمالي أقل من 2500 ملم لضمان المرور الآمن تحت الجسور."
    });
  }

  // 2. TRUCK ELIMINATION & CO2 LOGISTICS ANALYSIS
  // Find flatbeds with very low utilization (e.g. fewer than 3 items or < 30% area used)
  let underutilizedTruck: any = null;
  flatbeds.forEach((truck) => {
    const totalBedArea = truck.lengthLimit * truck.widthLimit;
    const occupiedArea = truck.items.reduce((sum: number, pi: any) => sum + (pi.w * pi.l), 0);
    const utilization = totalBedArea > 0 ? (occupiedArea / totalBedArea) * 100 : 0;
    
    if (utilization > 0 && utilization < 35 && truck.items.length <= 2) {
      underutilizedTruck = truck;
    }
  });

  if (underutilizedTruck && flatbeds.length > 1) {
    const totalFlatbedsCount = flatbeds.length;
    const co2Reduction = Math.round((1 / totalFlatbedsCount) * 100);
    const itemNames = underutilizedTruck.items.map((pi: any) => `**${pi.item.componentName}**`).join(" and ");
    const itemNamesAr = underutilizedTruck.items.map((pi: any) => `**${pi.item.componentName}**`).join(" و ");

    insights.push({
      title: `TRUCK ELIMINATION & GREEN LOGISTICS / تقليص عدد الشاحنات والخدمات اللوجستية الخضراء`,
      type: "elimination",
      english: `Flat Bed #${underutilizedTruck.truckNumber} is highly underutilized (less than 35% space occupied) containing only ${itemNames}.\n\n**Action Steps:**\n1. Drag and transfer ${itemNames} manually to other semi-filled Flat Beds with vacant floor spaces.\n2. Delete Flat Bed #${underutilizedTruck.truckNumber} once cleared.\n3. This consolidation eliminates an entire cargo trip, resulting in an immediate **${co2Reduction}% reduction in CO2 carbon emissions** and substantial fuel savings for this dispatch.`,
      arabic: `الشاحنة المسطحة رقم #${underutilizedTruck.truckNumber} غير مستغلة بشكل كافٍ (أقل من 35٪ من المساحة مستخدمة) وتحتوي فقط على ${itemNamesAr}.\n\n---\n**خطوات التنفيذ:**\n1. قم بنقل ${itemNamesAr} يدوياً (بالسحب والإفلات) إلى الشاحنات المسطحة الأخرى التي تحتوي على مساحات شاغرة.\n2. قم بحذف الشاحنة المسطحة رقم #${underutilizedTruck.truckNumber} بعد إفراغها تماماً.\n3. هذا الدمج يلغي رحلة شحن كاملة، مما يوفر مباشرة **${co2Reduction}٪ من انبعاثات الكربون** بالإضافة إلى توفير كبير في تكلفة الوقود.`,
      co2Savings: `${co2Reduction}% CO2 Reduction`
    });
  } else {
    // Standard Green Logistics Advice
    const co2Reduction = flatbeds.length > 2 ? Math.round((1 / flatbeds.length) * 100) : 20;
    insights.push({
      title: "CONSOLIDATION & GREEN LOGISTICS / دمج الشحنات واللوجستيات الخضراء",
      type: "green",
      english: `Analyze the active cargo list to merge low-volume accessories and avoid launching unnecessary trailers.\n\n**Action Steps:**\n1. Review flatbeds with sparse packing blueprints. Drag smaller components to empty corners of major trucks.\n2. Deleting just one unneeded trailer out of the convoy yields an approximate **${co2Reduction}% carbon footprint reduction** and optimizes fleet efficiency.`,
      arabic: `حلل قائمة الشحنات النشطة لدمج الملحقات ذات الحجم الصغير وتجنب إرسال مقطورات غير ضرورية.\n\n---\n**خطوات التنفيذ:**\n1. راجع الشاحنات ذات التعبئة المنخفضة. اسحب المكونات الصغيرة إلى الزوايا الفارغة في الشاحنات الرئيسية.\n2. إلغاء مقطورة واحدة فقط غير ضرورية من القافلة يوفر حوالي **${co2Reduction}٪ من البصمة الكربونية** ويحسن كفاءة الأسطول.`,
      co2Savings: `${co2Reduction}% CO2 Reduction`
    });
  }

  // 3. STRUCTURAL SEGREGATION & WEIGHT DISTRIBUTION SAFETY
  // Find any heavy items (e.g. radiator bank, conservator)
  const heavyItem = flatbedItems.find((pi) => pi.item.weight >= 1500);
  if (heavyItem) {
    insights.push({
      title: "STRUCTURAL INTEGRITY & WEIGHT SAFETY / السلامة الهيكلية وتوزيع الأوزان",
      type: "safety",
      english: `Heavy accessories like **${heavyItem.item.componentName}** (${heavyItem.item.weight} kg) require strict placement to protect trailer chassis.\n\n**Action Steps:**\n1. Position **${heavyItem.item.componentName}** directly over the main frame beams, near the longitudinal centerline of the trailer bed.\n2. Never place extreme weights near the very rear overhang or extreme sides of the flatbed, as this compromises axle balance and causes dangerous trailer swaying during transit.`,
      arabic: `الملحقات الثقيلة مثل **${heavyItem.item.componentName}** (بوزن ${heavyItem.item.weight} كجم) تتطلب تحديداً دقيقاً لموضعها لحماية هيكل المقطورة.\n\n---\n**خطوات التنفيذ:**\n1. ضع **${heavyItem.item.componentName}** مباشرة فوق عوارض الهيكل الرئيسية، بالقرب من خط المنتصف الطولي للشاحنة.\n2. تجنب تماماً وضع الأوزان الثقيلة بالقرب من الأطراف الجانبية أو المؤخرة المعلقة، لأن ذلك يخل بتوازن المحاور ويسبب تمايلاً خطيراً للمقطورة أثناء الحركة.`
    });
  } else {
    insights.push({
      title: "AXLE LOAD DISTRIBUTION SAFETY / سلامة توزيع الأحمال على المحاور",
      type: "safety",
      english: "Maintain proper heavy cargo axle distribution to prevent trailer instability and mechanical stress.\n\n**Action Steps:**\n1. Always load the heaviest crates first, locating them close to the trailer center-of-gravity (above the main axles).\n2. Place lighter, fragile control panel enclosures or marshalling kiosks further towards the front or rear compartments to balance cargo distribution.",
      arabic: "حافظ على التوزيع الصحيح للأحمال الثقيلة على المحاور لمنع عدم استقرار المقطورة والإجهاد الميكانيكي.\n\n---\n**خطوات التنفيذ:**\n1. قم دائماً بتحميل الصناديق الأثقل أولاً، مع وضعها بالقرب من مركز ثقل المقطورة (فوق المحاور الرئيسية).\n2. ضع حاويات لوحات التحكم الخفيفة أو كبائن التجميع في الأقسام الأمامية أو الخلفية لموازنة توزيع الحمولة.",
    });
  }

  return insights.slice(0, 3);
}

// -------------------------------------------------------------------------
// POST /api/ai-advisor API ENDPOINT
// -------------------------------------------------------------------------
app.post("/api/ai-advisor", async (req, res) => {
  const { trucks, unpackedItems } = req.body;

  if (!trucks || !Array.isArray(trucks)) {
    return res.status(400).json({ error: "Invalid request payload. 'trucks' must be an array." });
  }

  // Generate local deterministic fallback response immediately if Gemini is not set up
  if (!ai) {
    console.log("MK AI ADVISOR: Falling back to deterministic local loading analysis (API Key missing).");
    const fallbackInsights = generateLocalInsights(trucks, unpackedItems || []);
    return res.json({ insights: fallbackInsights, fallback: true });
  }

  try {
    console.log("MK AI ADVISOR: Querying Gemini API for loading analysis...");

    // Create a simplified representation of the cargo to minimize token usage and keep the prompt clean
    const simplifiedTrucks = trucks.map((t) => ({
      truckId: t.id,
      truckNumber: t.truckNumber,
      type: t.type,
      originGroup: t.originGroup,
      bedDimensions: `${t.lengthLimit}x${t.widthLimit}x${t.heightLimit} mm`,
      weightLimitKg: t.weightLimit,
      totalPackedWeightKg: t.items.reduce((sum: number, pi: any) => sum + pi.item.weight, 0),
      packedAreaPct: t.lengthLimit > 0 ? (t.items.reduce((sum: number, pi: any) => sum + (pi.w * pi.l), 0) / (t.lengthLimit * t.widthLimit) * 100).toFixed(1) : 0,
      packedItems: t.items.map((pi: any) => ({
        id: pi.item.id,
        name: pi.item.componentName,
        dimensions: `${pi.item.length}x${pi.item.width}x${pi.item.height} mm`,
        weightKg: pi.item.weight,
        origin: pi.item.origin,
        isStackable: pi.item.stackable !== false // defaults to true unless specified
      }))
    }));

    const simplifiedUnpacked = (unpackedItems || []).map((item: any) => ({
      id: item.id,
      name: item.componentName,
      dimensions: `${item.length}x${item.width}x${item.height} mm`,
      weightKg: item.weight,
      origin: item.origin
    }));

    // Construct the prompt
    const prompt = `You are **MK AI ADVISOR**, the senior expert Logistics, Structural Packaging, and Supply Chain Consultant for Voltamp Energy.
Analyze the current active truck loading layout below and generate 2 to 3 highly precise, mathematically sound, and actionable loading insights.

--- ACTIVE CARGO & TRUCK BLUEPRINTS DATA (JSON) ---
${JSON.stringify({ activeTrucks: simplifiedTrucks, unpackedItems: simplifiedUnpacked }, null, 2)}
--------------------------------------------------

CONSTRAINTS & RULES:
1. Always brand your outputs, tags, and titles under the name **MK AI ADVISOR**.
2. **NO Administrative or Permit Talk:** Do NOT mention road permits, escorts, police, Ministry of Transport, customs, or government paperwork. Focus strictly on physical cargo loading, spatial optimization, structural stability, vertical stacking limits, trailer weight limits, and cargo safety.
3. **Bilingual Output (English + Arabic):** For every single insight card you generate, you MUST write the technical explanation in English first, then add a clear horizontal divider \`---\`, followed immediately by a clean, simple, and professional Arabic translation below it. Keep translations completely authentic, natural, and highly professional.
4. **Brain & Stacking Logic:**
   - Deep Stacking Analysis: Focus on vertical stacking opportunities. Check item dimensions (L x W) to ensure base stability (top item must fit fully inside the bottom item with ZERO overhangs). Confirm combined height fits within bed height limit (typically 2500 mm).
   - Weight Check: Verify combined weights don't exceed the truck weight limit. Recommend the heavier, rigid item on the bottom (base layer) and lighter, smaller item on top. Never stack on fragile components (e.g. conservators, marshalling kiosks).
   - Truck Elimination: Scan for underutilized flatbed trucks (e.g., floor area utilization < 35% or containing only 1-2 small accessories) and suggest exact drag-and-drop manual moves to transfer those items to other trailers and eliminate that truck entirely.
   - Green Logistics (CO2 Savings %): Calculate environmental savings as a percentage (%) based strictly on the ratio of trucks eliminated (e.g., eliminating 1 out of 4 trucks = 25% carbon footprint reduction).

You MUST respond with a valid, clean JSON object containing an "insights" array. Each object in the array must match this schema:
{
  "insights": [
    {
      "title": "A short, engaging bilingual title (e.g. 'VERTICAL STACKING & FOOTPRINT OPTIMIZATION / التكديس الرأسي واستغلال المساحة')",
      "type": "stacking" or "elimination" or "safety" or "green",
      "english": "Detailed English explanation, calculations, and exact Action Steps.",
      "arabic": "Detailed Arabic translation with clean, clear Arabic logistics phrasing, separated from English by a clear logical flow.",
      "co2Savings": "Optional percentage string, e.g. '25% CO2 Reduction' if a truck is eliminated"
    }
  ]
}

Ensure your response contains ONLY the clean JSON output. No markdown wrapping except maybe standard json code block \`\`\`json ... \`\`\`. Do not write any conversational text outside the JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    let rawText = response.text || "";
    // Sanitize in case of markdown blocks
    if (rawText.startsWith("```json")) {
      rawText = rawText.substring(7);
    }
    if (rawText.endsWith("```")) {
      rawText = rawText.substring(0, rawText.length - 3);
    }
    rawText = rawText.trim();

    const parsedResponse = JSON.parse(rawText);
    if (parsedResponse && Array.isArray(parsedResponse.insights)) {
      console.log(`MK AI ADVISOR: Successfully generated ${parsedResponse.insights.length} insights via Gemini.`);
      return res.json({ insights: parsedResponse.insights, fallback: false });
    } else {
      throw new Error("Invalid JSON structure returned from Gemini model.");
    }

  } catch (error: any) {
    // Log as a clean warning/info message instead of console.error to prevent triggering platform error alerts on API rate-limits
    const isRateLimit = error?.message?.includes("429") || error?.status === 429 || JSON.stringify(error).includes("429") || JSON.stringify(error).includes("RESOURCE_EXHAUSTED");
    if (isRateLimit) {
      console.warn("MK AI ADVISOR: Gemini API rate limit / quota exceeded (429). Falling back gracefully to deterministic local heuristics.");
    } else {
      console.log("MK AI ADVISOR: Gemini API call failed. Falling back to deterministic local heuristics. Detail:", error?.message || error);
    }
    const fallbackInsights = generateLocalInsights(trucks, unpackedItems || []);
    return res.json({ insights: fallbackInsights, fallback: true });
  }
});

// -------------------------------------------------------------------------
// VITE MIDDLEWARE & STATIC SERVING CONFIGURATION
// -------------------------------------------------------------------------
if (process.env.NODE_ENV !== "production") {
  const startVite = async () => {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware mounted.");
  };
  startVite();
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
  console.log("Serving static production build from dist/ directory.");
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Voltamp TTLO Server running on http://0.0.0.0:${PORT}`);
});
