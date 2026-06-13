import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Overview } from "../types.js";
import { Card, CardTitle, Bar as MiniBar } from "./ui.js";
import { compact, usd } from "../lib.js";
import { useTheme, chartColors } from "../theme.js";

export function DailySpend({ daily }: { daily: Overview["daily"] }) {
  const cc = chartColors(useTheme().theme);
  const AX = { fontSize: 11, fill: cc.axis };
  return (
    <Card>
      <CardTitle
        hint="USD per day"
        help="Estimated USD spent per calendar day (your local time). Each assistant turn is bucketed by its own timestamp, so long multi-day sessions split correctly."
      >
        Spend Over Time
      </CardTitle>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={daily} margin={{ left: -10, right: 8, top: 4 }}>
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.7} />
              <stop offset="100%" stopColor="#7c5cff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={cc.grid} vertical={false} />
          <XAxis dataKey="date" tick={AX} tickFormatter={(d) => String(d).slice(5)} minTickGap={28} />
          <YAxis tick={AX} tickFormatter={(n) => usd(n)} width={48} />
          <Tooltip
            contentStyle={cc.tip}
            formatter={(v: number, k) => (k === "cost" ? usd(v) : compact(v))}
          />
          <Area type="monotone" dataKey="cost" stroke="#7c5cff" strokeWidth={2} fill="url(#g)" />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function ModelBreakdown({ byModel }: { byModel: Overview["byModel"] }) {
  const max = Math.max(...byModel.map((m) => m.cost), 0.0001);
  return (
    <Card>
      <CardTitle
        hint="cost by model"
        help="Estimated cost and turn count per model. Bar color marks the tier (Opus/Fable = pink, Sonnet = blue, Haiku = green). Lots of pink on trivial work is a cost-saving opportunity."
      >
        Models
      </CardTitle>
      <div className="space-y-3">
        {byModel.map((m) => (
          <div key={m.model}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="truncate text-fg/70">{m.model}</span>
              <span className="tabular-nums text-fg/50">
                {usd(m.cost)} · {m.msgs} turns
              </span>
            </div>
            <MiniBar value={m.cost} max={max} color={m.tier.includes("Opus") ? "#f472b6" : m.tier.includes("Sonnet") ? "#60a5fa" : "#34d399"} />
          </div>
        ))}
        {!byModel.length && <Empty />}
      </div>
    </Card>
  );
}

export function ToolUsage({ byTool, total }: { byTool: Overview["byTool"]; total: number }) {
  const top = byTool.slice(0, 12);
  const cc = chartColors(useTheme().theme);
  const AX = { fontSize: 11, fill: cc.axis };
  return (
    <Card>
      <CardTitle
        hint={`${total.toLocaleString()} calls`}
        help="How many times each tool was invoked across all assistant turns in view (top 12 shown). A heavy Bash/Edit mix is typical of hands-on coding work."
      >
        Tool Usage
      </CardTitle>
      <ResponsiveContainer width="100%" height={Math.max(180, top.length * 26)}>
        <BarChart data={top} layout="vertical" margin={{ left: 24, right: 16 }}>
          <XAxis type="number" tick={AX} hide />
          <YAxis type="category" dataKey="tool" tick={AX} width={90} />
          <Tooltip contentStyle={cc.tip} cursor={{ fill: cc.emptyCell }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#7c5cff" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function ProjectBreakdown({
  byProject,
  onPick,
}: {
  byProject: Overview["byProject"];
  onPick: (p: string) => void;
}) {
  const data = byProject.map((p) => ({ ...p }));
  const colors = ["#7c5cff", "#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#f87171", "#22d3ee", "#a78bfa"];
  const cc = chartColors(useTheme().theme);
  const AX = { fontSize: 11, fill: cc.axis };
  return (
    <Card>
      <CardTitle
        hint="click a bar to drill in"
        help="Estimated cost per project folder (one folder per working directory Claude Code has seen). Click any bar to switch the whole dashboard to that project."
      >
        Projects
      </CardTitle>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 30)}>
        <BarChart data={data} layout="vertical" margin={{ left: 24, right: 16 }}>
          <XAxis type="number" tick={AX} tickFormatter={(n) => usd(n)} />
          <YAxis type="category" dataKey="label" tick={AX} width={120} />
          <Tooltip cursor={{ fill: cc.emptyCell }} content={<ProjectTip />} />
          <Bar dataKey="cost" radius={[0, 4, 4, 0]} onClick={(d: any) => onPick(d.project)} cursor="pointer">
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function ProjectTip({ active, payload }: any) {
  const cc = chartColors(useTheme().theme);
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Overview["byProject"][number];
  return (
    <div style={cc.tip} className="px-3 py-2">
      <div className="text-sm font-semibold text-fg/90">{p.label}</div>
      <div className="mt-0.5 max-w-[320px] break-all font-mono text-[11px] text-fg/60">{p.path}</div>
      <div className="mt-1.5 text-xs text-fg/70">
        <span className="font-semibold text-accent">{usd(p.cost)}</span> · {p.sessions} sessions ·{" "}
        {compact(p.tokens)} tokens
      </div>
    </div>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Heatmap({ heat }: { heat: number[][] }) {
  const max = Math.max(1, ...heat.flat());
  const cc = chartColors(useTheme().theme);
  return (
    <Card>
      <CardTitle
        hint="assistant turns by local time"
        help="When you work. Each cell counts assistant turns for that weekday and local hour — darker = busier. Useful for spotting your real focus blocks vs. off-hours."
      >
        Activity Heatmap
      </CardTitle>
      <div className="overflow-x-auto">
        <div className="inline-block">
          <div className="mb-1 flex pl-9 text-[9px] text-fg/48">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="w-[14px] text-center">
                {h % 6 === 0 ? h : ""}
              </div>
            ))}
          </div>
          {heat.map((row, d) => (
            <div key={d} className="flex items-center">
              <div className="w-9 text-[10px] text-fg/56">{DAYS[d]}</div>
              {row.map((v, h) => {
                const a = v === 0 ? 0 : 0.15 + 0.85 * (v / max);
                return (
                  <div
                    key={h}
                    title={`${DAYS[d]} ${h}:00 — ${v} turns`}
                    className="m-[1px] h-[13px] w-[13px] rounded-[3px]"
                    style={{ background: v === 0 ? cc.emptyCell : `rgba(124,92,255,${a})` }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Empty() {
  return <div className="py-8 text-center text-sm text-fg/48">No data</div>;
}
