type ScoreGaugeProps = {
  label: string;
  value: number;
  helper?: string;
};

const scoreTones = {
  excellent: {
    ring: "#087253",
    bg: "bg-emerald-50",
    text: "text-emerald-800",
  },
  good: {
    ring: "#16a34a",
    bg: "bg-green-50",
    text: "text-green-800",
  },
  warn: {
    ring: "#d97706",
    bg: "bg-amber-50",
    text: "text-amber-800",
  },
  poor: {
    ring: "#e11d48",
    bg: "bg-rose-50",
    text: "text-rose-800",
  },
};

export function ScoreGauge({ label, value, helper }: ScoreGaugeProps) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  const tone = scoreTone(safeValue);
  const degrees = safeValue * 3.6;
  const ariaLabel = label.toLowerCase().endsWith("score")
    ? `${label} ${safeValue} out of 100`
    : `${label} score ${safeValue} out of 100`;

  return (
    <div className="min-h-[17rem] min-w-0 rounded-[20px] border border-border bg-card p-5 text-center">
      <div
        role="img"
        aria-label={ariaLabel}
        className="mx-auto grid h-32 w-32 shrink-0 place-items-center rounded-full p-2 shadow-[inset_0_0_0_1px_rgb(17_25_23_/_0.08)]"
        style={{
          background: `conic-gradient(${tone.ring} ${degrees}deg, #dce4df 0deg)`,
        }}
      >
        <div className={`grid h-full w-full place-items-center rounded-full ${tone.bg}`}>
          <div>
            <p className={`font-display text-4xl font-semibold ${tone.text}`}>
              {safeValue}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase text-ink-subtle">
              /100
            </p>
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-ink-subtle">
        {label}
      </p>
      {helper ? (
        <p className="mt-2 text-sm leading-6 text-ink-muted">{helper}</p>
      ) : null}
    </div>
  );
}

function scoreTone(score: number) {
  if (score >= 90) return scoreTones.excellent;
  if (score >= 75) return scoreTones.good;
  if (score >= 50) return scoreTones.warn;
  return scoreTones.poor;
}
