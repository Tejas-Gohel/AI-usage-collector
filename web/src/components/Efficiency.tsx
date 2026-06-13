import type { Overview } from "../types.js";
import { Card, CardTitle } from "./ui.js";
import { pct } from "../lib.js";
import { useTheme, chartColors } from "../theme.js";

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const off = c * (1 - score / 100);
  const theme = useTheme().theme;
  const light = theme === "light";
  const color =
    score >= 75 ? (light ? "#047857" : "#34d399") : score >= 50 ? (light ? "#b45309" : "#fbbf24") : light ? "#dc2626" : "#f87171";
  const track = chartColors(theme).ringTrack;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke={track} strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-fg/56">/ 100</span>
      </div>
    </div>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-fg/5 py-2 text-sm last:border-0">
      <span className="text-fg/60">{label}</span>
      <span className={`font-semibold tabular-nums ${good === undefined ? "" : good ? "text-good" : "text-warn"}`}>
        {value}
      </span>
    </div>
  );
}

const ICON = { good: "✅", warn: "⚠️", tip: "💡" } as const;
const RING = {
  good: "border-emerald-500/30 bg-emerald-500/5",
  warn: "border-amber-500/30 bg-amber-500/5",
  tip: "border-sky-500/30 bg-sky-500/5",
} as const;

export function Efficiency({ o }: { o: Overview }) {
  const e = o.efficiency;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card>
        <CardTitle
          hint="weighted blend"
          help="A 0–100 score of how economically you drive Claude — NOT a measure of output quality. Blend: 55% cache reuse + 25% tool reliability (low error rate) + 20% prompt specificity (fewer one-liners). Green ≥ 75, amber 50–74, red below."
        >
          Efficiency Score
        </CardTitle>
        <div className="flex items-center gap-5">
          <ScoreRing score={e.score} />
          <div className="min-w-0 flex-1">
            <Metric label="Cache reuse" value={pct(e.cacheHitRatio)} good={e.cacheHitRatio >= 0.6} />
            <Metric label="Tool error rate" value={pct(e.toolErrorRate)} good={e.toolErrorRate < 0.08} />
            <Metric label="Short prompts" value={pct(e.shortPromptRatio)} good={e.shortPromptRatio < 0.35} />
            <Metric label="Thinking turns" value={pct(e.thinkingRatio)} />
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-fg/56">
          55% cache reuse · 25% tool reliability · 20% prompt specificity. Higher cache reuse = you keep context
          warm instead of re-paying for it.
        </p>
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle
          hint={`${o.coaching.length} insights`}
          help="Automatic, rule-based tips derived from your own usage patterns: low cache reuse, too many terse prompts, elevated tool-error rate, and premium-model spend on trivial turns. ✅ wins · ⚠️ fix these · 💡 try this."
        >
          Coaching
        </CardTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {o.coaching.map((c, i) => (
            <div key={i} className={`rounded-lg border p-3 ${RING[c.level]}`}>
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <span>{ICON[c.level]}</span>
                <span>{c.title}</span>
              </div>
              <p className="text-xs leading-relaxed text-fg/55">{c.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
