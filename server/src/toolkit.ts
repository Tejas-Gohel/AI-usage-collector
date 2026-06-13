import type { Dataset } from "./metrics.js";
import type { PromptEvent } from "./types.js";
import type { Inventory, ToolDef } from "./inventory.js";

// Heuristic intent classification of a follow-up prompt after a skill ran.
// Correction = the skill's output needed fixing (counts AGAINST the skill).
// Enhancement = a brand-new ask (explicitly NOT counted against the skill, per design).
const CORRECTION =
  /\b(fix|errors?|not working|does(n'?t| not) work|isn'?t working|broken|wrong|incorrect|still (not|fail|broke|happening)|revert|undo|that'?s not|failed|failing|regression|mistake|crash(es|ed)?|exception|undefined|null reference|nullpointer|typo)\b/i;
const ENHANCEMENT =
  /\b(also|additionally|add (a|an|the|support|new)|now (let'?s|add|do|implement|make)|next,?|another|new feature|enhance|improve|can you also|let'?s also|on top of|furthermore|as well|one more)\b/i;

type Intent = "correction" | "enhancement" | "neutral";
function classify(text: string): Intent {
  const corr = CORRECTION.test(text);
  const enh = ENHANCEMENT.test(text);
  if (corr && !enh) return "correction"; // pure correction → penalize
  if (enh) return "enhancement"; // any new-ask signal → don't penalize the skill
  return "neutral";
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

export interface SkillStat {
  name: string;
  description: string;
  version: string | null;
  scope: "project" | "user" | "unknown";
  onDisk: boolean;
  source: string | null; // path to SKILL.md, when on disk
  invocations: number;
  sessions: number;
  corrections: number;
  enhancements: number;
  reworkRatio: number; // corrections per invocation
  score: number; // 0-100 efficiency
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

function skillScore(reworkRatio: number): number {
  // 0 rework → 100; 1.5+ corrections per use → 30. Linear in between.
  return Math.round(100 - (clamp(reworkRatio, 0, 1.5) / 1.5) * 70);
}

function confidenceOf(invocations: number): SkillStat["confidence"] {
  return invocations >= 8 ? "high" : invocations >= 3 ? "ok" : "low";
}

export function buildToolkit(ds: Dataset, inventory: Inventory | null) {
  // Index prompts by session, sorted by time, for follow-up scanning.
  const promptsBySession = new Map<string, PromptEvent[]>();
  for (const p of ds.prompts) {
    const arr = promptsBySession.get(p.sessionId) ?? [];
    arr.push(p);
    promptsBySession.set(p.sessionId, arr);
  }
  for (const arr of promptsBySession.values()) arr.sort((a, b) => a.ts - b.ts);

  // Index skill invocations by session, sorted, so each invocation's "window"
  // ends at the next skill invocation in the same session.
  const skillsBySession = new Map<string, typeof ds.skills>();
  for (const s of ds.skills) {
    const arr = skillsBySession.get(s.sessionId) ?? [];
    arr.push(s);
    skillsBySession.set(s.sessionId, arr);
  }
  for (const arr of skillsBySession.values()) arr.sort((a, b) => a.ts - b.ts);

  const agg = new Map<
    string,
    { inv: number; sessions: Set<string>; corr: number; enh: number; last: number }
  >();

  for (const [sessionId, invs] of skillsBySession) {
    const prompts = promptsBySession.get(sessionId) ?? [];
    for (let i = 0; i < invs.length; i++) {
      const cur = invs[i];
      const next = invs[i + 1];
      const windowEnd = next ? next.ts : Infinity;
      const a = agg.get(cur.skill) ?? { inv: 0, sessions: new Set<string>(), corr: 0, enh: 0, last: 0 };
      a.inv++;
      a.sessions.add(sessionId);
      a.last = Math.max(a.last, cur.ts);
      // Attribute only the 3 prompts immediately following the skill (and before the next
      // skill). A skill's effect is most visible in the next turns; blaming it for the whole
      // rest of a long session would wildly over-penalize early invocations.
      let considered = 0;
      for (const p of prompts) {
        if (p.ts <= cur.ts || p.ts >= windowEnd) continue;
        const intent = classify(p.text);
        if (intent === "correction") a.corr++;
        else if (intent === "enhancement") a.enh++;
        if (++considered >= 3) break;
      }
      agg.set(cur.skill, a);
    }
  }

  const invMap = new Map<string, ToolDef>();
  if (inventory) for (const s of inventory.skills) invMap.set(s.name, s);

  const usedNames = new Set(agg.keys());
  const allNames = new Set<string>([...usedNames, ...invMap.keys()]);

  const skills: SkillStat[] = [...allNames].map((name) => {
    const a = agg.get(name);
    const def = invMap.get(name);
    const inv = a?.inv ?? 0;
    const reworkRatio = inv ? (a!.corr / inv) : 0;
    return {
      name,
      description: def?.description ?? "",
      version: def?.version ?? null,
      scope: def?.scope ?? "unknown",
      onDisk: !!def,
      source: def?.source ?? null,
      invocations: inv,
      sessions: a?.sessions.size ?? 0,
      corrections: a?.corr ?? 0,
      enhancements: a?.enh ?? 0,
      reworkRatio: round(reworkRatio, 3),
      score: inv ? skillScore(reworkRatio) : 0,
      confidence: confidenceOf(inv),
      lastUsed: a?.last ?? 0,
    };
  });

  // sort: used first (by invocations desc), then unused alphabetically
  skills.sort((x, y) => y.invocations - x.invocations || x.name.localeCompare(y.name));

  // Agents
  const agentAgg = new Map<string, { inv: number; sessions: Set<string>; last: number }>();
  for (const g of ds.agents) {
    const a = agentAgg.get(g.agent) ?? { inv: 0, sessions: new Set<string>(), last: 0 };
    a.inv++;
    a.sessions.add(g.sessionId);
    a.last = Math.max(a.last, g.ts);
    agentAgg.set(g.agent, a);
  }
  const agentInv = new Map<string, ToolDef>();
  if (inventory) for (const d of inventory.agents) agentInv.set(d.name, d);
  const agentNames = new Set<string>([...agentAgg.keys(), ...agentInv.keys()]);
  const agents: AgentStat[] = [...agentNames]
    .map((name) => {
      const a = agentAgg.get(name);
      const def = agentInv.get(name);
      return {
        name,
        description: def?.description ?? "",
        onDisk: !!def,
        invocations: a?.inv ?? 0,
        sessions: a?.sessions.size ?? 0,
        lastUsed: a?.last ?? 0,
      };
    })
    .sort((x, y) => y.invocations - x.invocations || x.name.localeCompare(y.name));

  const onDiskCount = inventory?.skills.length ?? 0;
  const usedCount = skills.filter((s) => s.invocations > 0).length;

  return {
    summary: {
      skillsOnDisk: onDiskCount,
      skillsUsed: usedCount,
      skillsUnused: Math.max(0, onDiskCount - skills.filter((s) => s.onDisk && s.invocations > 0).length),
      agentsOnDisk: inventory?.agents.length ?? 0,
      agentsUsed: agents.filter((a) => a.invocations > 0).length,
      commandsOnDisk: inventory?.commands.length ?? 0,
      hasInventory: !!inventory,
    },
    skills,
    agents,
  };
}
