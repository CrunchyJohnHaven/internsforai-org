import type { Env } from "./types";

export interface AiGradeResult {
  score: number;          // 0-100
  feedback: string;       // short rationale (<= 2 sentences)
  used_ai: boolean;       // false if we fell back to keyword scoring
}

interface AnthropicMessageResponse {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string };
}

// Asks Claude 3.5 Haiku to grade a free-text answer against a rubric and
// expected keywords. Falls back to a keyword-overlap score on any failure.
export async function gradeFreeText(
  env: Env,
  opts: {
    prompt: string;            // the question shown to the candidate
    expectedKeywords: string[];// keyword keys we hope to see
    rubric: string;            // short rubric description
    candidateAnswer: string;
    maxWords?: number;
  }
): Promise<AiGradeResult> {
  const fallback = keywordScore(opts.candidateAnswer, opts.expectedKeywords);
  if (!env.ANTHROPIC_API_KEY) return fallback;

  const system = `You are an editorial hiring assistant grading short candidate answers for InternsForAI.
You return STRICT JSON of the form: {"score": <integer 0-100>, "feedback": "<one or two sentences>"}.

Scoring rubric: ${opts.rubric}
Penalize: filler, copy-paste, off-topic answers, low effort, AI-generated boilerplate.
Reward: specificity, brevity that hits the rubric, evidence of real thought.
A blank or one-word answer scores 0-10. A weak but on-topic answer scores 20-50.
A solid answer scores 60-80. An excellent answer scores 80-100.`;

  const user = `Question: ${opts.prompt}

Expected keywords/concepts (the answer doesn't have to use exact words; semantic match counts): ${opts.expectedKeywords.join(", ")}

Candidate answer (verbatim):
"""
${opts.candidateAnswer.slice(0, 4000)}
"""

Return ONLY the JSON, no prose, no code fences.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 256,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      console.warn("[grader] anthropic non-2xx", res.status, await res.text().catch(() => ""));
      return fallback;
    }
    const data = (await res.json()) as AnthropicMessageResponse;
    const text = data.content?.find((c) => c.type === "text")?.text?.trim() || "";
    const parsed = extractJson(text);
    if (!parsed || typeof parsed.score !== "number") return fallback;
    const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
    const feedback = typeof parsed.feedback === "string" ? parsed.feedback.slice(0, 400) : "";
    return { score, feedback, used_ai: true };
  } catch (err) {
    console.warn("[grader] anthropic error", err);
    return fallback;
  }
}

interface GraderJson { score?: number; feedback?: string }

function extractJson(s: string): GraderJson | null {
  // Tolerate fenced or surrounded JSON.
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

function keywordScore(answer: string, keywords: string[]): AiGradeResult {
  if (!answer || answer.trim().length === 0) {
    return { score: 0, feedback: "Empty answer.", used_ai: false };
  }
  if (keywords.length === 0) {
    const wc = answer.split(/\s+/).filter(Boolean).length;
    const score = Math.min(60, wc * 3);
    return { score, feedback: "Keyword-fallback grading (no keywords supplied).", used_ai: false };
  }
  const lower = answer.toLowerCase();
  const hits = keywords.filter((k) => lower.includes(k.toLowerCase())).length;
  const wc = answer.split(/\s+/).filter(Boolean).length;
  // Each keyword hit is worth up to 100/keywords.length, capped at 80 for keyword-only score.
  // Add small bonus for non-trivial word count.
  let score = Math.min(80, Math.round((hits / keywords.length) * 80));
  if (wc >= 10) score = Math.min(80, score + 5);
  return { score, feedback: `Keyword-fallback grading: ${hits}/${keywords.length} expected concepts matched.`, used_ai: false };
}
