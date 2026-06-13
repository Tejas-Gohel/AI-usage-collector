import { useMemo, useState } from "react";
import type { SessionRow } from "../types.js";
import { Card, CardTitle } from "./ui.js";
import { usd, compact, duration, dateTime } from "../lib.js";

type SortKey = "start" | "cost" | "tokens" | "msgs" | "tools" | "durationMs";

export function Sessions({ rows }: { rows: SessionRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("start");
  const [desc, setDesc] = useState(true);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    const f = needle
      ? rows.filter(
          (r) =>
            (r.title ?? "").toLowerCase().includes(needle) ||
            r.label.toLowerCase().includes(needle) ||
            (r.branch ?? "").toLowerCase().includes(needle) ||
            r.sessionId.includes(needle),
        )
      : rows;
    const sorted = [...f].sort((a, b) => (a[sort] as number) - (b[sort] as number));
    return desc ? sorted.reverse() : sorted;
  }, [rows, q, sort, desc]);

  const head = (key: SortKey, label: string, cls = "") => (
    <th
      className={`cursor-pointer select-none px-3 py-2 text-right font-medium hover:text-fg ${cls}`}
      onClick={() => (sort === key ? setDesc(!desc) : (setSort(key), setDesc(true)))}
    >
      {label} {sort === key ? (desc ? "▾" : "▴") : ""}
    </th>
  );

  return (
    <Card>
      <CardTitle
        hint={`${filtered.length} of ${rows.length} sessions`}
        help="Every session in view, newest first. Search by title, project, branch or id; click any column header to sort. Cost, tokens, turns and tool calls are totals for that one session; duration is first → last message."
      >
        Session Explorer
      </CardTitle>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search title, project, branch, id…"
        className="mb-3 w-full rounded-lg border border-fg/10 bg-inset px-3 py-2 text-sm outline-none placeholder:text-fg/48 focus:border-violet-400/50"
      />
      <div className="max-h-[560px] overflow-auto rounded-lg border border-fg/5">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-inset text-fg/60">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Session</th>
              <th className="px-3 py-2 text-left font-medium">Project</th>
              {head("start", "When")}
              {head("durationMs", "Dur")}
              {head("cost", "Cost")}
              {head("tokens", "Tokens")}
              {head("msgs", "Turns")}
              {head("tools", "Tools")}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.sessionId} className="border-t border-fg/5 hover:bg-inset">
                <td className="max-w-[280px] px-3 py-2">
                  <div className="truncate text-fg/85">{r.title ?? "(untitled)"}</div>
                  <div className="truncate text-[10px] text-fg/48">
                    {r.branch ?? r.sessionId.slice(0, 8)}
                  </div>
                </td>
                <td className="px-3 py-2 text-fg/55">{r.label}</td>
                <td className="px-3 py-2 text-right tabular-nums text-fg/55">{dateTime(r.start)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-fg/55">{duration(r.durationMs)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-accent">{usd(r.cost)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-fg/55">{compact(r.tokens)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-fg/55">{r.msgs}</td>
                <td className="px-3 py-2 text-right tabular-nums text-fg/55">{r.tools}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-fg/48">
                  No sessions match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
