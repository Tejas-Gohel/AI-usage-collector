import { useEffect, useState } from "react";
import type { Overview, ProjectInfo, SessionRow, Me, Toolkit as ToolkitData, ReviewResponse } from "./types.js";
import { getJSON, usd, compact, pct } from "./lib.js";
import { Stat } from "./components/ui.js";
import { Efficiency } from "./components/Efficiency.js";
import { DailySpend, ModelBreakdown, ToolUsage, ProjectBreakdown, Heatmap } from "./components/Charts.js";
import { Sessions } from "./components/Sessions.js";
import { Toolkit } from "./components/Toolkit.js";
import { AIManager } from "./components/AIManager.js";
import { useTheme } from "./theme.js";

type Tab = "overview" | "toolkit";

export default function App() {
  const { theme, toggle } = useTheme();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [project, setProject] = useState<string>("all");
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [toolkit, setToolkit] = useState<ToolkitData | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getJSON<ProjectInfo[]>("/api/projects").then(setProjects).catch((e) => setErr(String(e)));
    getJSON<Me>("/api/me").then(setMe).catch(() => {});
    getJSON<ReviewResponse>("/api/review").then(setReview).catch(() => {});
  }, []);

  function loadFor(p: string) {
    setLoading(true);
    setErr(null);
    return Promise.all([
      getJSON<Overview>(`/api/overview?project=${encodeURIComponent(p)}`),
      getJSON<SessionRow[]>(`/api/sessions?project=${encodeURIComponent(p)}`),
      getJSON<ToolkitData>(`/api/toolkit?project=${encodeURIComponent(p)}`),
    ])
      .then(([o, s, t]) => {
        setOverview(o);
        setSessions(s);
        setToolkit(t);
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadFor(project);
  }, [project]);

  async function refresh() {
    await fetch("/api/refresh", { method: "POST" });
    await loadFor(project);
    getJSON<ProjectInfo[]>("/api/projects").then(setProjects).catch(() => {});
    getJSON<ReviewResponse>("/api/review").then(setReview).catch(() => {});
  }

  const h = overview?.headline;
  const globalValue = projects.reduce((s, p) => s + p.cost, 0);
  const roi = me?.planPriceUsd ? globalValue / me.planPriceUsd : 0;
  const isProject = project !== "all";

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">
            <span className="text-violet-400">◆</span> Claude Usage Collector
          </h1>
          <p className="text-xs text-fg/56">
            {h?.span ? `${h.span.from} → ${h.span.to}` : "your local Claude Code telemetry"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {me && (
            <div className="flex items-center gap-3 rounded-lg border border-fg/10 bg-inset px-3 py-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/25 text-sm font-bold text-accent">
                {me.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-fg/90">{me.name}</div>
                <div className="text-[10px] text-fg/60">
                  {me.plan} · ${me.planPriceUsd}/mo
                </div>
              </div>
              {roi > 0 && (
                <div className="ml-1 border-l border-fg/10 pl-3 text-right leading-tight" title="Estimated API-equivalent value of all your usage ÷ your subscription price. You're on a flat plan — this is value extracted, not money spent.">
                  <div className="text-sm font-bold text-good">≈{Math.round(roi)}×</div>
                  <div className="text-[10px] text-fg/60">plan value</div>
                </div>
              )}
            </div>
          )}
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            title={project === "all" ? "All projects" : projects.find((p) => p.project === project)?.label}
            className="max-w-[260px] rounded-lg border border-fg/15 bg-panel px-3 py-2 text-sm font-medium text-fg/90 outline-none focus:border-violet-400/60 [&>option]:bg-panel [&>option]:text-fg/90"
          >
            <option value="all">All projects ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.project} value={p.project}>
                {p.label} — {usd(p.cost)}
              </option>
            ))}
          </select>
          <button onClick={refresh} className="rounded-lg border border-fg/10 bg-fg/5 px-3 py-2 text-sm hover:bg-fg/10">
            ↻ Refresh
          </button>
          <button
            onClick={toggle}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            aria-label="Toggle theme"
            className="rounded-lg border border-fg/10 bg-fg/5 px-3 py-2 text-sm hover:bg-fg/10"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      <nav className="mb-5 flex gap-1 border-b border-fg/10">
        {([["overview", "Overview"], ["toolkit", "Skills & AI Manager"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === k ? "border-violet-400 text-fg" : "border-transparent text-fg/60 hover:text-fg/70"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {err && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-bad">
          {err} — is the API running on :5174? Run <code className="text-bad">npm run dev</code>.
        </div>
      )}

      {loading && !overview && <div className="py-20 text-center text-fg/56">Parsing transcripts…</div>}

      {overview && h && (
        <div className={`space-y-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {tab === "overview" && (
            <>
              <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <Stat label="Total spend" value={usd(h.totalCost)} accent="text-accent" sub={`${h.sessions} sessions`} help="Estimated USD across the sessions in view, from public per-token rates. NOT your bill — you're on a flat subscription. Treat it as retail value of compute consumed." />
                <Stat label="Avg / session" value={usd(h.avgCostPerSession)} help="Total estimated value divided by the number of sessions in view." />
                <Stat label="Cache reuse" value={pct(h.cacheHitRatio)} accent={h.cacheHitRatio >= 0.6 ? "text-good" : "text-warn"} sub="of input tokens" help="Share of input tokens served from the prompt cache instead of being re-sent. Higher = you reuse context instead of re-paying for it. Your single biggest cost lever." />
                <Stat label="Assistant turns" value={compact(h.assistantMsgs)} help="Number of Claude responses in view, after de-duplicating resumed/split records." />
                <Stat label="Your prompts" value={compact(h.prompts)} help="Messages you typed or queued (not tool results or system messages)." />
                <Stat label="Total tokens" value={compact(h.totalTokens)} help="All tokens combined: input + output + cache reads + cache writes." />
              </section>

              <Efficiency o={overview} />
              <DailySpend daily={overview.daily} />
              <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ModelBreakdown byModel={overview.byModel} />
                <ToolUsage byTool={overview.byTool} total={overview.totalToolCalls} />
              </section>
              {project === "all" && overview.byProject.length > 1 && (
                <ProjectBreakdown byProject={overview.byProject} onPick={setProject} />
              )}
              <Heatmap heat={overview.heat} />
              <Sessions rows={sessions} />
            </>
          )}

          {tab === "toolkit" && (
            <>
              <AIManager data={review} />
              {toolkit && <Toolkit tk={toolkit} review={review?.review ?? null} isProject={isProject} />}
            </>
          )}

          <footer className="py-6 text-center text-xs text-fg/48">
            Costs are estimated API-equivalent value from public per-token rates (not your subscription bill) · cache
            writes priced 1.25×/2× input · skill scores are heuristic signals, not verdicts.
          </footer>
        </div>
      )}
    </div>
  );
}
