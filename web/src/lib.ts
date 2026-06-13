export const usd = (n: number) =>
  n >= 100 ? `$${n.toFixed(0)}` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(3)}`;

export function compact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export function duration(ms: number): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function dateTime(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retry on transient failures. During `npm run dev` the API (tsx) cold-starts slower than Vite,
// so the first calls can hit a not-yet-listening server — Vite's proxy answers 500 / the fetch
// rejects. We retry with backoff so that window self-heals instead of showing a scary error.
import type { SkillStat, Review } from "./types.js";

// A used skill warrants an "improve" nudge if it's scoring low or showing real rework.
export function needsAttention(s: SkillStat): boolean {
  return s.invocations > 0 && (s.score < 75 || (s.reworkRatio >= 0.5 && s.invocations >= 2));
}

// Build weakness bullets from real signals (used when the review hasn't supplied tailored ones).
export function computeWeaknesses(s: SkillStat, rec?: Review["skills"][number]): string[] {
  const out: string[] = [];
  if (s.reworkRatio > 0)
    out.push(
      `${s.corrections} of the prompts right after it ran were corrections (rework ratio ${s.reworkRatio.toFixed(
        2,
      )} across ${s.invocations} use${s.invocations === 1 ? "" : "s"}) — its first pass often needs fixing.`,
    );
  if (s.confidence === "low")
    out.push(`Low sample (${s.invocations} invocation${s.invocations === 1 ? "" : "s"}) — score is a weak signal, treat as a watch item.`);
  if (!s.onDisk)
    out.push("Not found on disk in this project — it may be a user-level/plugin skill or uninstalled; confirm before editing.");
  if (!s.description) out.push("No description captured — a vague or missing description is a top cause of mis-triggering.");
  if (rec?.why) out.push(rec.why);
  if (!out.length) out.push("No strong negative signal — mostly low confidence. Keep using it and re-check.");
  return out;
}

export function buildImprovePrompt(s: SkillStat, rec?: Review["skills"][number]): string {
  if (rec?.improvePrompt) return rec.improvePrompt;
  const loc = s.source ? s.source : `your .claude/skills/${s.name}/SKILL.md`;
  const weak = computeWeaknesses(s, rec).map((w) => `- ${w}`).join("\n");
  const recLine = rec?.recommendation ? `\nAI-manager recommendation: ${rec.recommendation}\n` : "";
  return `Improve my Claude Code skill "${s.name}".

File: ${loc}

Why I'm asking (from my usage analytics):
- Efficiency score ${s.score}/100, rework ratio ${s.reworkRatio.toFixed(2)} over ${s.invocations} invocation${
    s.invocations === 1 ? "" : "s"
  } (${s.corrections} corrections vs ${s.enhancements} enhancements).
${weak}${recLine}
Please:
1. Read the current SKILL.md first and PRESERVE its original purpose and scope — do not change what the skill fundamentally does or remove capabilities I rely on.
2. Tighten the \`description\` frontmatter: third-person, trigger-rich, with explicit "use when …" AND "do NOT use when …" clauses to cut mis-firing (the main rework cause).
3. Apply progressive disclosure: keep SKILL.md focused (<500 lines); move long detail into references/*.md and link it; move repeated logic into an executable helper script the skill runs.
4. Add a short, verifiable output checklist so the first pass lands closer to done and needs fewer corrections.
5. Bump the version in frontmatter and show me a diff BEFORE applying any change.`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function getJSON<T>(url: string, retries = 6): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r.json();
      // 5xx during boot is retryable; 4xx is a real error, fail fast.
      if (r.status < 500) throw new Error(`${r.status} ${await r.text()}`);
      lastErr = new Error(`${r.status} ${await r.text()}`);
    } catch (e) {
      lastErr = e; // network error: server not up yet
    }
    if (attempt < retries) await sleep(Math.min(400 * 2 ** attempt, 3000));
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
