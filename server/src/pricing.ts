// USD per 1,000,000 tokens. Cache-write tiers derived from base input rate:
//   5-minute ephemeral = 1.25x input, 1-hour ephemeral = 2x input (Anthropic schedule).
// Matched by family substring against message.model. Unknown models fall back to Opus tier
// (conservative — better to over- than under-estimate spend) and are flagged in the response.

export interface Rate {
  input: number;
  output: number;
  cacheRead: number;
}

const FAMILIES: Array<{ match: RegExp; label: string; rate: Rate }> = [
  { match: /opus|fable|mythos/i, label: "Opus-tier", rate: { input: 15, output: 75, cacheRead: 1.5 } },
  { match: /sonnet/i, label: "Sonnet", rate: { input: 3, output: 15, cacheRead: 0.3 } },
  { match: /haiku/i, label: "Haiku", rate: { input: 1, output: 5, cacheRead: 0.1 } },
];

const FALLBACK = FAMILIES[0];

export function rateFor(model: string): { label: string; rate: Rate; known: boolean } {
  const hit = FAMILIES.find((f) => f.match.test(model));
  if (hit) return { label: hit.label, rate: hit.rate, known: true };
  return { label: FALLBACK.label + " (assumed)", rate: FALLBACK.rate, known: false };
}

export interface TokenBreakdown {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate5m: number;
  cacheCreate1h: number;
}

export function costOf(model: string, t: TokenBreakdown): number {
  const { rate } = rateFor(model);
  const M = 1_000_000;
  return (
    (t.input * rate.input +
      t.output * rate.output +
      t.cacheRead * rate.cacheRead +
      t.cacheCreate5m * rate.input * 1.25 +
      t.cacheCreate1h * rate.input * 2) /
    M
  );
}
