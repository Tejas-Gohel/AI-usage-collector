import { useState, type ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-fg/10 bg-card p-5 shadow-sm ${className}`}>{children}</div>
  );
}

// Accessible "?" affordance: opens on hover, focus, or click (so it works on touch + keyboard too).
export function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label="What is this?"
        className="flex h-[15px] w-[15px] items-center justify-center rounded-full border border-fg/20 text-[10px] font-semibold leading-none text-fg/60 transition-colors hover:border-fg/40 hover:text-fg/80 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-400"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-6 z-50 w-60 rounded-lg border border-fg/15 bg-panel px-3 py-2 text-xs font-normal normal-case leading-relaxed tracking-normal text-fg/70 shadow-xl"
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function CardTitle({ children, hint, help }: { children: ReactNode; hint?: string; help?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-fg/80">
        {children}
        {help && <HelpTip text={help} />}
      </h3>
      {hint && <span className="text-xs text-fg/56">{hint}</span>}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent = "text-fg",
  help,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  help?: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-fg/56">
        {label}
        {help && <HelpTip text={help} />}
      </div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-fg/56">{sub}</div>}
    </Card>
  );
}

export function Bar({ value, max, color = "#7c5cff" }: { value: number; max: number; color?: string }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-fg/5">
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}
