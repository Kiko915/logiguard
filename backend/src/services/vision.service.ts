import { GoogleGenAI } from "@google/genai";
import { config } from "../config/index.js";
import { logger } from "../lib/logger.js";
import type { PackageStatus } from "../types/index.js";

// ─── Gemini Prompt ─────────────────────────────────────────────────────────────
// Zero-shot package inspection classifier.
// Instructs the model to return a strict JSON shape — no markdown, no prose.
const INSPECTION_PROMPT = `
You are a package inspection AI for LogiGuard, an automated logistics quality-control system.
A conveyor belt camera feeds you images of packages at a sorting facility.

Classify the package visible in the image into EXACTLY ONE of these three categories:
- "good"    — Package is intact, properly sealed, undamaged, and visibly contains contents.
- "damaged" — Package shows any of: crushing, tears, punctures, moisture/wet damage, broken tape,
              deformed corners, or compromised structural integrity.
- "empty"   — Package appears flat, collapsed, or clearly contains no contents.
              Also use "empty" if no package is visible in the frame.

Decision rules:
1. When uncertain between "good" and "damaged", always choose "damaged" (safety-first policy).
2. Base the assessment only on what is VISUALLY apparent — do not infer from labels or text.
3. Confidence should reflect your certainty: 90-100 = very clear, 70-89 = reasonably clear,
   50-69 = ambiguous, below 50 = very uncertain.

Respond with ONLY valid JSON — no markdown fences, no extra text:
{
  "status": "good" | "damaged" | "empty",
  "confidence": <integer 0-100>,
  "reason": "<one concise sentence explaining the classification>",
  "issues": ["<specific visible defect or observation>"]
}

The "issues" array must be empty ([]) for "good" packages.
`.trim();

// ─── Vision Analysis Result ────────────────────────────────────────────────────
export interface VisionAnalysisResult {
  status:      PackageStatus;
  confidence:  number;   // 0–100 (will be divided by 100 before storing)
  reason:      string;
  issues:      string[];
  analysis_ms: number;
}

// ─── Vision Service ────────────────────────────────────────────────────────────
export class VisionService {
  private readonly ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  }

  async analyzeFrame(frameDataUrl: string): Promise<VisionAnalysisResult> {
    // Strip the data-URI prefix to get raw base64
    const base64   = frameDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const mimeType = frameDataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg";

    const start = Date.now();

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: INSPECTION_PROMPT },
          ],
        },
      ],
    });

    const analysis_ms = Date.now() - start;

    // Gemini sometimes wraps output in ```json … ``` — strip those fences
    const raw     = response.text?.trim() ?? "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();

    let parsed: { status: string; confidence: number; reason: string; issues: string[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      logger.error({ raw }, "Gemini returned non-JSON response");
      throw new Error("Vision model returned an unparseable response.");
    }

    const validStatuses: PackageStatus[] = ["good", "damaged", "empty"];
    const status = validStatuses.includes(parsed.status as PackageStatus)
      ? (parsed.status as PackageStatus)
      : "empty"; // safest fallback

    const result: VisionAnalysisResult = {
      status,
      confidence:  Math.min(100, Math.max(0, Math.round(Number(parsed.confidence)))),
      reason:      String(parsed.reason ?? ""),
      issues:      Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
      analysis_ms,
    };

    logger.info(
      { status: result.status, confidence: result.confidence, analysis_ms },
      "Gemini vision analysis complete"
    );

    return result;
  }
}
