import type { MessageEvent, PromptEvent, ToolResultEvent, SkillEvent, AgentEvent } from "./types.js";
import { rateFor } from "./pricing.js";

export interface Dataset {
  events: MessageEvent[];
  prompts: PromptEvent[];
  toolResults: ToolResultEvent[];
  skills: SkillEvent[];
  agents: AgentEvent[];
  sessionTitles: Map<string, string | null>;
  sessionBranch: Map<string, string | null>;
  projectLabels: Map<string, string>;
  projectPaths: Map<string, string>;
}

const SHORT_PROMPT_CHARS = 60;
const TRIVIAL_MODELS = /opus|fable|mythos/i; // top-tier models we don't want wasted on tiny tasks

function sumTokens(e: MessageEvent) {
  const t = e.tokens;
  return t.input + t.output + t.cacheRead + t.cacheCreate5m + t.cacheCreate1h;
}

export function buildOverview(ds: Dataset) {
  const ev = ds.events;
  const totalCost = ev.reduce((s, e) => s + e.cost, 0);
  const tok = ev.reduce(
    (a, e) => {
      a.input += e.tokens.input;
      a.output += e.tokens.output;
      a.cacheRead += e.tokens.cacheRead;
      a.cacheCreate += e.tokens.cacheCreate5m + e.tokens.cacheCreate1h;
      return a;
    },
    { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 },
  );

  const sessions = new Set(ev.map((e) => e.sessionId));
  const sessionIds = [...sessions];

  // --- cache efficiency: read vs. all freshly-billed input (input + cache writes) ---
  const freshInput = tok.input + tok.cacheCreate;
  const cacheHitRatio = freshInput + tok.cacheRead === 0 ? 0 : tok.cacheRead / (tok.cacheRead + freshInput);

  // --- daily timeseries ---
  const dailyMap = new Map<string, { date: string; cost: number; tokens: number; sessions: Set<string> }>();
  for (const e of ev) {
    const d = dailyMap.get(e.dateKey) ?? { date: e.dateKey, cost: 0, tokens: 0, sessions: new Set() };
    d.cost += e.cost;
    d.tokens += sumTokens(e);
    d.sessions.add(e.sessionId);
    dailyMap.set(e.dateKey, d);
  }
  const daily = [...dailyMap.values()]
    .filter((d) => d.date !== "unknown")
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ date: d.date, cost: round(d.cost), tokens: d.tokens, sessions: d.sessions.size }));

  // --- by model ---
  const modelMap = new Map<string, { model: string; tier: string; msgs: number; cost: number; tokens: number }>();
  for (const e of ev) {
    const m = modelMap.get(e.model) ?? {
      model: e.model,
      tier: rateFor(e.model).label,
      msgs: 0,
      cost: 0,
      tokens: 0,
    };
    m.msgs++;
    m.cost += e.cost;
    m.tokens += sumTokens(e);
    modelMap.set(e.model, m);
  }
  const byModel = [...modelMap.values()].sort((a, b) => b.cost - a.cost).map((m) => ({ ...m, cost: round(m.cost) }));

  // --- by tool ---
  const toolMap = new Map<string, number>();
  for (const e of ev) for (const t of e.tools) toolMap.set(t, (toolMap.get(t) ?? 0) + 1);
  const byTool = [...toolMap.entries()].map(([tool, count]) => ({ tool, count })).sort((a, b) => b.count - a.count);
  const totalToolCalls = byTool.reduce((s, t) => s + t.count, 0);

  // --- by project ---
  const projMap = new Map<string, { project: string; label: string; path: string; cost: number; sessions: Set<string>; tokens: number }>();
  for (const e of ev) {
    const p = projMap.get(e.project) ?? {
      project: e.project,
      label: ds.projectLabels.get(e.project) ?? e.project,
      path: ds.projectPaths.get(e.project) ?? e.cwd ?? e.project,
      cost: 0,
      sessions: new Set(),
      tokens: 0,
    };
    p.cost += e.cost;
    p.tokens += sumTokens(e);
    p.sessions.add(e.sessionId);
    projMap.set(e.project, p);
  }
  const byProject = [...projMap.values()]
    .sort((a, b) => b.cost - a.cost)
    .map((p) => ({ project: p.project, label: p.label, path: p.path, cost: round(p.cost), tokens: p.tokens, sessions: p.sessions.size }));

  // --- activity heatmap (weekday x hour), weighted by assistant messages ---
  const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const e of ev) if (e.ts) heat[e.weekday][e.hour]++;

  // --- tool error rate ---
  const toolErrors = ds.toolResults.filter((t) => t.isError).length;
  const toolResultTotal = ds.toolResults.length;
  const toolErrorRate = toolResultTotal === 0 ? 0 : toolErrors / toolResultTotal;

  // --- prompt quality ---
  const promptChars = ds.prompts.map((p) => p.chars).filter((n) => n > 0);
  const avgPromptChars = promptChars.length ? promptChars.reduce((s, n) => s + n, 0) / promptChars.length : 0;
  const shortPrompts = promptChars.filter((n) => n < SHORT_PROMPT_CHARS).length;
  const shortPromptRatio = promptChars.length ? shortPrompts / promptChars.length : 0;

  // --- thinking usage ---
  const thinkingMsgs = ev.filter((e) => e.hasThinking).length;

  // --- top-tier model spend on likely-trivial work (single-tool, no-thinking turns) ---
  const trivialTopTier = ev.filter(
    (e) => TRIVIAL_MODELS.test(e.model) && !e.hasThinking && e.tools.length <= 1 && e.tokens.output < 300,
  );
  const trivialTopTierCost = trivialTopTier.reduce((s, e) => s + e.cost, 0);

  // --- efficiency score (0-100), transparent weighted blend ---
  const score = efficiencyScore({ cacheHitRatio, toolErrorRate, shortPromptRatio });

  return {
    headline: {
      totalCost: round(totalCost),
      sessions: sessions.size,
      assistantMsgs: ev.length,
      prompts: ds.prompts.length,
      totalTokens: tok.input + tok.output + tok.cacheRead + tok.cacheCreate,
      cacheHitRatio: round(cacheHitRatio, 4),
      avgCostPerSession: sessions.size ? round(totalCost / sessions.size) : 0,
      span: daily.length ? { from: daily[0].date, to: daily[daily.length - 1].date } : null,
    },
    tokens: tok,
    daily,
    byModel,
    byTool,
    totalToolCalls,
    byProject,
    heat,
    efficiency: {
      score,
      cacheHitRatio: round(cacheHitRatio, 4),
      toolErrorRate: round(toolErrorRate, 4),
      toolErrors,
      toolResultTotal,
      shortPromptRatio: round(shortPromptRatio, 4),
      avgPromptChars: Math.round(avgPromptChars),
      thinkingMsgs,
      thinkingRatio: ev.length ? round(thinkingMsgs / ev.length, 4) : 0,
    },
    coaching: coachingInsights({
      cacheHitRatio,
      toolErrorRate,
      shortPromptRatio,
      avgPromptChars,
      trivialTopTierCost,
      trivialTopTierCount: trivialTopTier.length,
      byModel,
      totalCost,
    }),
    sessionCount: sessionIds.length,
  };
}

function efficiencyScore(x: { cacheHitRatio: number; toolErrorRate: number; shortPromptRatio: number }): number {
  // Cache hit ratio is the dominant signal of good context reuse.
  const cache = clamp01(x.cacheHitRatio / 0.9) * 55; // 90%+ cache reuse = full marks
  const tools = (1 - clamp01(x.toolErrorRate / 0.15)) * 25; // <0% errors great, 15%+ = 0
  const prompts = (1 - clamp01(x.shortPromptRatio / 0.5)) * 20; // many 1-liners = under-specified
  return Math.round(cache + tools + prompts);
}

interface CoachInput {
  cacheHitRatio: number;
  toolErrorRate: number;
  shortPromptRatio: number;
  avgPromptChars: number;
  trivialTopTierCost: number;
  trivialTopTierCount: number;
  byModel: Array<{ model: string; tier: string; cost: number }>;
  totalCost: number;
}

export interface Insight {
  level: "good" | "warn" | "tip";
  title: string;
  detail: string;
}

function coachingInsights(x: CoachInput): Insight[] {
  const out: Insight[] = [];

  if (x.cacheHitRatio >= 0.7)
    out.push({
      level: "good",
      title: "Strong prompt-cache reuse",
      detail: `${pct(x.cacheHitRatio)} of input tokens are cache reads — you keep sessions warm and resume context instead of re-sending it. That's the single biggest cost lever and you're winning it.`,
    });
  else
    out.push({
      level: "warn",
      title: "Low cache reuse",
      detail: `Only ${pct(x.cacheHitRatio)} of input is served from cache. Frequent /clear, short scattered sessions, or large re-pasted context defeat the cache. Keep related work in one session and let context persist.`,
    });

  if (x.shortPromptRatio > 0.35)
    out.push({
      level: "tip",
      title: "Many one-line prompts",
      detail: `${pct(x.shortPromptRatio)} of your prompts are under 60 chars (avg ${Math.round(
        x.avgPromptChars,
      )}). Terse prompts force Claude to guess, causing rework. Front-load constraints, file paths, and acceptance criteria.`,
    });

  if (x.toolErrorRate > 0.08)
    out.push({
      level: "warn",
      title: "Elevated tool-error rate",
      detail: `${pct(x.toolErrorRate)} of tool calls returned an error. Often failed bash commands, bad paths, or edits that didn't match. Tighter instructions and verified paths cut wasted turns.`,
    });

  if (x.trivialTopTierCost > 0 && x.trivialTopTierCost / Math.max(x.totalCost, 1e-9) > 0.05)
    out.push({
      level: "tip",
      title: "Top-tier model on trivial turns",
      detail: `~$${round(x.trivialTopTierCost)} (${x.trivialTopTierCount} turns) of Opus/Fable spend went to tiny, no-thinking single-tool turns. Cheap mechanical work can run on Sonnet/Haiku.`,
    });

  if (!out.some((i) => i.level === "warn"))
    out.push({ level: "good", title: "No red flags", detail: "Your usage profile looks healthy across cost, cache, and tool reliability." });

  return out;
}

export function buildSessions(ds: Dataset) {
  type Acc = {
    sessionId: string;
    project: string;
    label: string;
    title: string | null;
    branch: string | null;
    cost: number;
    tokens: number;
    msgs: number;
    tools: number;
    start: number;
    end: number;
    models: Set<string>;
  };
  const map = new Map<string, Acc>();
  for (const e of ds.events) {
    const a =
      map.get(e.sessionId) ??
      {
        sessionId: e.sessionId,
        project: e.project,
        label: ds.projectLabels.get(e.project) ?? e.project,
        title: ds.sessionTitles.get(e.sessionId) ?? null,
        branch: ds.sessionBranch.get(e.sessionId) ?? null,
        cost: 0,
        tokens: 0,
        msgs: 0,
        tools: 0,
        start: Infinity,
        end: 0,
        models: new Set<string>(),
      };
    a.cost += e.cost;
    a.tokens += sumTokens(e);
    a.msgs++;
    a.tools += e.tools.length;
    a.models.add(e.model);
    if (e.ts) {
      a.start = Math.min(a.start, e.ts);
      a.end = Math.max(a.end, e.ts);
    }
    map.set(e.sessionId, a);
  }
  const promptCount = new Map<string, number>();
  for (const p of ds.prompts) promptCount.set(p.sessionId, (promptCount.get(p.sessionId) ?? 0) + 1);

  return [...map.values()]
    .map((a) => ({
      sessionId: a.sessionId,
      project: a.project,
      label: a.label,
      title: a.title,
      branch: a.branch,
      cost: round(a.cost),
      tokens: a.tokens,
      msgs: a.msgs,
      tools: a.tools,
      prompts: promptCount.get(a.sessionId) ?? 0,
      models: [...a.models],
      start: a.start === Infinity ? 0 : a.start,
      end: a.end,
      durationMs: a.start === Infinity ? 0 : a.end - a.start,
    }))
    .sort((a, b) => b.start - a.start);
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const pct = (n: number) => `${Math.round(n * 100)}%`;
