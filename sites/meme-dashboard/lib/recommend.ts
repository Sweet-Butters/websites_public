/**
 * Action recommendations — synthesise momentum + confidence + demographics
 * + lead/lag into "today's content angles" for the marketing team.
 *
 * Two-tier strategy:
 *   1) Try Gemini (free tier) with the same payload a human analyst would
 *      look at. Returns richer narrative + LLM-judged confidence.
 *   2) On any failure (no API key, rate limit, parse error, network),
 *      fall through to the deterministic heuristic below — the page
 *      never goes empty.
 *
 * Gemini call is wrapped in unstable_cache (1h) so we stay well under
 * the free tier's 1500 RPD limit even with traffic.
 */
import { unstable_cache } from "next/cache";

import {
  getKeywordBreakdowns,
  getLatestMomentum,
  getLatestSynth,
  topHotMomentum,
  type KeywordBreakdowns,
  type SynthKeyword,
} from "./meme";

export type Recommendation = {
  keyword: string;
  rank: number;
  trendScore: number;
  sources: string[];
  /** Headline summarising the situation in one line. */
  headline: string;
  /** Two-three concrete next steps. */
  actions: string[];
  /** Confidence in [0,1] — used to colour the recommendation. */
  confidence: number;
  /** Where the recommendation came from ('llm' or 'heuristic'). */
  source: "llm" | "heuristic";
};

// --- shared utilities ----------------------------------------------------

function _humanizeSources(srcs: string[]): string {
  const m: Record<string, string> = {
    pytrends_sector: "Google",
    naver_datalab: "Naver",
    tiktok_creative: "TikTok",
    youtube_trending: "YouTube",
  };
  return srcs.map((s) => m[s] ?? s).join(" + ");
}

function _dominantBucket(rows: Array<{ label: string; pct: number }> | null): string | null {
  if (!rows || rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => b.pct - a.pct);
  const top = sorted[0]!;
  if (top.pct < 35) return null; // no dominant group
  return `${top.label} ${top.pct.toFixed(0)}%`;
}

// --- heuristic fallback --------------------------------------------------

function _heuristicOne(
  kw: SynthKeyword,
  rank: number,
  demo: KeywordBreakdowns | null,
): Recommendation {
  const sourcesHuman = _humanizeSources(kw.sources);
  const demoBits: string[] = [];
  let demoBoost = 0;
  if (demo) {
    const ageDom = _dominantBucket(demo.ages);
    const genderDom = _dominantBucket(demo.gender);
    const deviceDom = _dominantBucket(demo.device);
    if (ageDom) demoBits.push(ageDom);
    if (genderDom) demoBits.push(genderDom);
    if (deviceDom) demoBits.push(deviceDom);
    if (demoBits.length >= 2) demoBoost = 0.15;
  }

  const headlineParts = [sourcesHuman];
  if (demoBits.length > 0) headlineParts.push(demoBits.join(", "));
  const headline = headlineParts.join(" · ");

  const actions: string[] = [];
  if (kw.sources.length >= 2) {
    actions.push(
      `${sourcesHuman}에서 동시 부각 — 24시간 안에 영상/블로그 제작 → 동시 wave 탑승`,
    );
  } else {
    actions.push(
      `${sourcesHuman} 단일 신호 — 다른 플랫폼 확산 여부 1주 관찰 후 결정`,
    );
  }
  if (demoBits.length > 0) {
    actions.push(`타게팅: ${demoBits.join(" / ")}`);
  }
  if (
    kw.sources.includes("naver_datalab") &&
    !kw.sources.includes("pytrends_sector")
  ) {
    actions.push("Naver 선행 신호 — Google 확산 약 7일 뒤 예상, SEO 콘텐츠 준비");
  }

  const sourceBreadth = Math.min(1, kw.sources.length / 3);
  const scoreWeight = Math.min(1, kw.trend_score / 100);
  const confidence = Math.min(
    1,
    0.5 * sourceBreadth + 0.35 * scoreWeight + demoBoost,
  );

  return {
    keyword: kw.keyword,
    rank,
    trendScore: kw.trend_score,
    sources: kw.sources,
    headline,
    actions,
    confidence,
    source: "heuristic",
  };
}

// --- LLM (Gemini) tier ---------------------------------------------------

// gemini-2.5-flash is the model auto_project.llm uses on the meme_project
// side — known to be in the free-tier quota for the user's API key.
// gemini-2.0-flash has limit:0 on this key.
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type LLMRow = {
  keyword: string;
  trend_score: number;
  sources: string[];
  demographics: {
    gender: Array<{ label: string; pct: number }>;
    ages: Array<{ label: string; pct: number }>;
    device: Array<{ label: string; pct: number }>;
  } | null;
};

type LLMResponse = {
  recommendations: Array<{
    keyword: string;
    headline: string;
    actions: string[];
    confidence: number;
  }>;
};

const SYSTEM = `\
You are a Korean marketing data analyst writing daily content
recommendations for marketing managers, video creators, and sales leads.

INPUT: a JSON array of the day's top trending keywords with their cross-source
attribution + (when available) gender / age / device distribution percentages.

OUTPUT (JSON only, no prose around it, matching the provided schema):
For each keyword:
  - headline: ONE Korean sentence summarizing why this matters NOW.
              Include cross-source attribution and demographic skew when
              meaningful. No filler words.
  - actions:  2-3 Korean bullets, each an EXECUTABLE next step the team
              can act on today/tomorrow (content angle, channel choice,
              targeting). No vague advice.
  - confidence: 0.0-1.0 — your judgement of how strong the signal is.
              Multi-source + clear demographic dominance + high trend
              score → high. Single source + no demo + low score → low.

Rules:
  - Korean output. Do NOT hedge ("아마", "추정"). Be direct.
  - Use ONLY facts present in INPUT. Do not invent numbers or platforms.
  - If a keyword has no demographic data, omit that dimension entirely.
  - Keep each headline under 80 characters; each action under 100.
`;

async function _llmRecommend(
  rows: LLMRow[],
  apiKey: string,
): Promise<LLMResponse> {
  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "INPUT (today's top keywords):\n" +
              JSON.stringify(rows, null, 2) +
              "\n\nReturn the JSON object only.",
          },
        ],
      },
    ],
    systemInstruction: {
      parts: [{ text: SYSTEM }],
    },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                keyword: { type: "string" },
                headline: { type: "string" },
                actions: {
                  type: "array",
                  items: { type: "string" },
                },
                confidence: { type: "number" },
              },
              required: ["keyword", "headline", "actions", "confidence"],
            },
          },
        },
        required: ["recommendations"],
      },
      temperature: 0.4,
    },
  };

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    // POST fetches are not cached by Next.js automatically — the
    // unstable_cache wrapper handles caching at the function level.
  });
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }
  const j = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini response had no text part");
  return JSON.parse(text) as LLMResponse;
}

/**
 * Wrap the LLM call in Next's data cache. Keyed by a hash of the top
 * keywords + their scores so re-runs with the same input return cached
 * output for 1h, but fresh data triggers a new call automatically.
 */
const cachedLLM = unstable_cache(
  async (rows: LLMRow[]): Promise<LLMResponse | null> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    try {
      return await _llmRecommend(rows, apiKey);
    } catch (e) {
      // Logged but non-fatal — heuristic fallback below.
      console.error("[recommend] Gemini failed:", e);
      return null;
    }
  },
  ["llm-recommendations-v2"],
  { revalidate: 3600 },
);

// --- public API ----------------------------------------------------------

/**
 * Top-N action recommendations. Tries Gemini first; falls back to
 * the heuristic. Returns the same Recommendation shape either way.
 */
export async function getTopRecommendations(n = 5): Promise<Recommendation[]> {
  // Rank by momentum (breakout z-score) to match the home overview — the
  // synth composite is seed-dominated and would recommend the same fixed
  // AI/ChatGPT/딥러닝 every day. Momentum has no per-source `raw`, but the
  // downstream logic only needs keyword/sources/trend_score, and momentum's
  // `score_today` IS that day's synth trend_score. Fall back to synth when no
  // momentum snapshot exists yet.
  const momentum = await getLatestMomentum();
  const top: SynthKeyword[] = momentum
    ? topHotMomentum(momentum, n).map((m) => ({
        keyword: m.keyword,
        sources: m.sources,
        raw: {},
        trend_score: m.score_today,
      }))
    : (await getLatestSynth()).keywords.slice(0, n);

  // Pull demographics for everyone in parallel — used by both tiers.
  const demos = await Promise.all(
    top.map((kw) => getKeywordBreakdowns(kw.keyword).catch(() => null)),
  );

  const llmRows: LLMRow[] = top.map((kw, i) => ({
    keyword: kw.keyword,
    trend_score: kw.trend_score,
    sources: kw.sources,
    demographics: demos[i]
      ? {
          gender: demos[i]!.gender,
          ages: demos[i]!.ages,
          device: demos[i]!.device,
        }
      : null,
  }));

  const llmOut = await cachedLLM(llmRows);
  if (llmOut && llmOut.recommendations?.length > 0) {
    const byKw = new Map(llmOut.recommendations.map((r) => [r.keyword, r]));
    return top.map((kw, i) => {
      const demo = demos[i] ?? null;
      const llm = byKw.get(kw.keyword);
      if (!llm) return _heuristicOne(kw, i + 1, demo);
      return {
        keyword: kw.keyword,
        rank: i + 1,
        trendScore: kw.trend_score,
        sources: kw.sources,
        headline: llm.headline,
        actions: llm.actions,
        confidence: Math.max(0, Math.min(1, llm.confidence)),
        source: "llm" as const,
      };
    });
  }

  return top.map((kw, i) => _heuristicOne(kw, i + 1, demos[i] ?? null));
}
