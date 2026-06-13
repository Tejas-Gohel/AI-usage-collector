import { useState } from "react";
import type { Toolkit as ToolkitData, Review, SkillStat } from "../types.js";
import { Card, CardTitle, Stat } from "./ui.js";
import { dateTime, needsAttention, computeWeaknesses, buildImprovePrompt, copyText } from "../lib.js";

type Rec = Review["skills"][number] | undefined;

function ImproveModal({ skill, rec, onClose }: { skill: SkillStat; rec: Rec; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const weaknesses = (rec?.weaknesses?.length ? rec.weaknesses : computeWeaknesses(skill, rec)) ?? [];
  const prompt = buildImprovePrompt(skill, rec);

  async function copy() {
    if (await copyText(prompt)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl border border-fg/15 bg-panel p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-fg/90">✦ Improve “{skill.name}”</h3>
            <p className="text-xs text-fg/60">
              Score {skill.score}/100 · rework {skill.reworkRatio.toFixed(2)} · {skill.invocations} use
              {skill.invocations === 1 ? "" : "s"}
              {skill.source ? ` · ${skill.source}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 text-fg/56 hover:text-fg/80">✕</button>
        </div>

        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-warn">Why it scores low</div>
          <ul className="space-y-1.5">
            {weaknesses.map((w, i) => (
              <li key={i} className="flex gap-2 text-sm text-fg/70">
                <span className="text-warn">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-accent">
              Prompt to fix it — paste into Claude Code in this project
            </div>
            <button
              onClick={copy}
              className="rounded-lg border border-accent/45 bg-accent/12 px-3 py-1 text-xs font-medium text-accent hover:bg-accent/20"
            >
              {copied ? "✓ Copied" : "⧉ Copy"}
            </button>
          </div>
          <textarea
            readOnly
            value={prompt}
            onFocus={(e) => e.currentTarget.select()}
            className="h-72 w-full resize-none rounded-lg border border-fg/10 bg-inset p-3 font-mono text-[11px] leading-relaxed text-fg/75 outline-none"
          />
          <p className="mt-2 text-[11px] text-fg/52">
            It instructs Claude to preserve the skill's original intent, sharpen its description/triggers, apply
            progressive disclosure, and show a diff before changing anything.
          </p>
        </div>
      </div>
    </div>
  );
}

function scoreColor(s: number) {
  return s >= 75 ? "text-good" : s >= 50 ? "text-warn" : "text-bad";
}
function scoreBg(s: number) {
  return s >= 75 ? "bg-emerald-500/15" : s >= 50 ? "bg-amber-500/15" : "bg-red-500/15";
}

const VERDICT: Record<string, string> = {
  excellent: "text-good",
  good: "text-good",
  watch: "text-warn",
  "needs-work": "text-bad",
};

export function Toolkit({ tk, review, isProject }: { tk: ToolkitData; review: Review | null; isProject: boolean }) {
  const [showUnused, setShowUnused] = useState(false);
  const [improve, setImprove] = useState<SkillStat | null>(null);
  const recByName = new Map((review?.skills ?? []).map((s) => [s.name, s]));
  const used = tk.skills.filter((s) => s.invocations > 0);
  const unused = tk.skills.filter((s) => s.invocations === 0 && s.onDisk);
  const s = tk.summary;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Skills used" value={`${s.skillsUsed}`} sub={s.hasInventory ? `of ${s.skillsOnDisk} on disk` : "used in sessions"} help="Distinct skills you actually invoked (deduplicated). 'On disk' counts SKILL.md files found under .claude/skills." />
        <Stat label="Skills idle" value={`${s.hasInventory ? s.skillsUnused : "—"}`} accent="text-warn" sub="installed, never used" help="Skills present on disk that you've never invoked here. Each one's name+description is still pre-loaded at startup — pruning sharpens auto-matching." />
        <Stat label="Agents used" value={`${s.agentsUsed}`} sub={s.hasInventory ? `of ${s.agentsOnDisk} on disk` : "subagents launched"} help="Distinct subagent types you launched (general-purpose, Explore, custom agents, …)." />
        <Stat label="Commands" value={`${s.hasInventory ? s.commandsOnDisk : "—"}`} sub="on disk" help="Slash-command .md files under .claude/commands (project + user)." />
      </section>

      <Card>
        <CardTitle
          hint={`${used.length} active`}
          help="Each skill you've used, with an efficiency score. Score = how often the 3 prompts right after the skill ran were CORRECTIONS (skill got it wrong) vs ENHANCEMENTS (you asked for something new — these are NOT counted against the skill). Heuristic, keyword-based — treat as a signal, not a verdict."
        >
          Skill Efficiency
        </CardTitle>
        {!isProject && (
          <p className="mb-3 text-xs text-warn/70">
            Switch to a single project to see installed-vs-used and on-disk details. Global view shows usage only.
          </p>
        )}
        <div className="overflow-x-auto rounded-lg border border-fg/5">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-inset text-fg/60">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Skill</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
                <th className="px-3 py-2 text-right font-medium">Uses</th>
                <th className="px-3 py-2 text-right font-medium">Rework</th>
                <th className="px-3 py-2 text-right font-medium">Fix / New</th>
                <th className="px-3 py-2 text-left font-medium">AI Manager says</th>
              </tr>
            </thead>
            <tbody>
              {used.map((sk) => {
                const rec = recByName.get(sk.name);
                return (
                  <tr key={sk.name} className="border-t border-fg/5 align-top hover:bg-inset">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-fg/85">{sk.name}</span>
                        {!sk.onDisk && <span className="rounded bg-fg/10 px-1 text-[9px] text-fg/56">not on disk</span>}
                        {sk.scope === "user" && <span className="rounded bg-sky-500/15 px-1 text-[9px] text-sky-300">user</span>}
                      </div>
                      {sk.description && <div className="mt-0.5 line-clamp-2 max-w-[320px] text-[10px] text-fg/52">{sk.description}</div>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`rounded px-1.5 py-0.5 font-bold tabular-nums ${scoreBg(sk.score)} ${scoreColor(sk.score)}`}>{sk.score}</span>
                      {sk.confidence === "low" && <div className="text-[9px] text-fg/48">low n</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-fg/60">{sk.invocations}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-fg/60">{sk.reworkRatio.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className="text-bad">{sk.corrections}</span>
                      <span className="text-fg/48"> / </span>
                      <span className="text-good">{sk.enhancements}</span>
                    </td>
                    <td className="px-3 py-2">
                      {rec ? (
                        <div>
                          <span className={`text-[10px] font-semibold uppercase ${VERDICT[rec.verdict] ?? "text-fg/50"}`}>{rec.verdict}</span>
                          <div className="max-w-[360px] text-[11px] leading-snug text-fg/55">{rec.recommendation}</div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-fg/25">—</span>
                      )}
                      {needsAttention(sk) && (
                        <button
                          onClick={() => setImprove(sk)}
                          title="See why it scores low + get a fix prompt for Claude"
                          className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-accent/45 bg-accent/12 px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/20"
                        >
                          ✦ Improve
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {isProject && unused.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setShowUnused((v) => !v)} className="text-xs text-accent hover:text-accent">
              {showUnused ? "▾ Hide" : "▸ Show"} {unused.length} idle skills (installed, never used)
            </button>
            {showUnused && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {unused.map((sk) => (
                  <span key={sk.name} title={sk.description} className="rounded-md border border-fg/10 bg-inset px-2 py-1 text-[10px] text-fg/60">
                    {sk.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle hint={`${tk.agents.filter((a) => a.invocations > 0).length} active`} help="Subagents you launched via the Agent/Task tool. 'On disk' = a matching agent definition exists under .claude/agents.">
          Agents
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          {tk.agents.filter((a) => a.invocations > 0).map((a) => (
            <div key={a.name} className="rounded-lg border border-fg/10 bg-inset px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-medium text-fg/85">
                {a.name}
                <span className="rounded bg-accent/12 px-1.5 text-xs tabular-nums text-accent">{a.invocations}</span>
              </div>
              <div className="text-[10px] text-fg/52">{a.sessions} sessions · last {dateTime(a.lastUsed)}</div>
            </div>
          ))}
        </div>
        {isProject && (
          <p className="mt-3 text-[11px] text-fg/52">
            {tk.agents.filter((a) => a.onDisk && a.invocations === 0).length} custom agents on disk are never used — e.g.{" "}
            {tk.agents.filter((a) => a.onDisk && a.invocations === 0).slice(0, 6).map((a) => a.name).join(", ")}.
          </p>
        )}
      </Card>

      {improve && <ImproveModal skill={improve} rec={recByName.get(improve.name)} onClose={() => setImprove(null)} />}
    </div>
  );
}
