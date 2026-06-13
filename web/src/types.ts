export interface ProjectInfo {
  project: string;
  label: string;
  cost: number;
  sessions: number;
  msgs: number;
}

export interface Insight {
  level: "good" | "warn" | "tip";
  title: string;
  detail: string;
}

export interface Overview {
  headline: {
    totalCost: number;
    sessions: number;
    assistantMsgs: number;
    prompts: number;
    totalTokens: number;
    cacheHitRatio: number;
    avgCostPerSession: number;
    span: { from: string; to: string } | null;
  };
  tokens: { input: number; output: number; cacheRead: number; cacheCreate: number };
  daily: Array<{ date: string; cost: number; tokens: number; sessions: number }>;
  byModel: Array<{ model: string; tier: string; msgs: number; cost: number; tokens: number }>;
  byTool: Array<{ tool: string; count: number }>;
  totalToolCalls: number;
  byProject: Array<{ project: string; label: string; path: string; cost: number; tokens: number; sessions: number }>;
  heat: number[][];
  efficiency: {
    score: number;
    cacheHitRatio: number;
    toolErrorRate: number;
    toolErrors: number;
    toolResultTotal: number;
    shortPromptRatio: number;
    avgPromptChars: number;
    thinkingMsgs: number;
    thinkingRatio: number;
  };
  coaching: Insight[];
  sessionCount: number;
}

export interface Me {
  name: string;
  email: string;
  plan: string;
  planPriceUsd: number;
}

export interface SkillStat {
  name: string;
  description: string;
  version: string | null;
  scope: "project" | "user" | "unknown";
  onDisk: boolean;
  source: string | null;
  invocations: number;
  sessions: number;
  corrections: number;
  enhancements: number;
  reworkRatio: number;
  score: number;
  confidence: "low" | "ok" | "high";
  lastUsed: number;
}

export interface AgentStat {
  name: string;
  description: string;
  onDisk: boolean;
  invocations: number;
  sessions: number;
  lastUsed: number;
}

export interface Toolkit {
  summary: {
    skillsOnDisk: number;
    skillsUsed: number;
    skillsUnused: number;
    agentsOnDisk: number;
    agentsUsed: number;
    commandsOnDisk: number;
    hasInventory: boolean;
  };
  skills: SkillStat[];
  agents: AgentStat[];
}

export interface Review {
  generatedAt: string;
  model?: string;
  marketStandard: {
    summary: string;
    principles: Array<{ title: string; detail: string }>;
    sources: Array<{ title: string; url: string }>;
  };
  skills: Array<{
    name: string;
    verdict: string;
    recommendation: string;
    why: string;
    weaknesses?: string[];
    improvePrompt?: string;
  }>;
  overall: { grade: string; summary: string; focusThisWeek: string[] };
}

export interface ReviewResponse {
  review: Review | null;
  ageDays: number | null;
  stale: boolean;
  generatedAt: string | null;
}

export interface SessionRow {
  sessionId: string;
  project: string;
  label: string;
  title: string | null;
  branch: string | null;
  cost: number;
  tokens: number;
  msgs: number;
  tools: number;
  prompts: number;
  models: string[];
  start: number;
  end: number;
  durationMs: number;
}
