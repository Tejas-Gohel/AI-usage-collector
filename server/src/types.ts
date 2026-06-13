export interface MessageEvent {
  sessionId: string;
  project: string; // encoded folder name
  cwd: string; // decoded working dir (best effort)
  model: string;
  gitBranch: string | null;
  ts: number; // epoch ms
  dateKey: string; // YYYY-MM-DD (local)
  hour: number; // 0-23 local
  weekday: number; // 0=Sun .. 6=Sat
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreate5m: number;
    cacheCreate1h: number;
  };
  cost: number;
  hasThinking: boolean;
  tools: string[]; // tool_use names in this assistant message
}

export interface PromptEvent {
  sessionId: string;
  project: string;
  ts: number;
  chars: number;
  source: string; // typed | queued | ...
  text: string;
}

export interface ToolResultEvent {
  sessionId: string;
  project: string;
  isError: boolean;
}

// A skill invocation (Skill tool call) — captured with its name so we can score per-skill.
export interface SkillEvent {
  sessionId: string;
  project: string;
  ts: number;
  skill: string;
}

// An agent/subagent invocation (Agent/Task tool call).
export interface AgentEvent {
  sessionId: string;
  project: string;
  ts: number;
  agent: string;
}

export interface SessionMeta {
  sessionId: string;
  project: string;
  cwd: string;
  title: string | null;
  branch: string | null;
}

export interface ParsedProject {
  events: MessageEvent[];
  prompts: PromptEvent[];
  toolResults: ToolResultEvent[];
  skills: SkillEvent[];
  agents: AgentEvent[];
  sessions: Map<string, SessionMeta>;
}
