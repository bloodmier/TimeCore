// src/components/ui/progress-button.tsx

import type { ButtonProps } from "react-day-picker";
import { Button } from "./button";



type Props = ButtonProps & {
  progress?: number;       // 0..100
  progressLabel?: string;  // valfri statusrad
};

export function ProgressButton({
  progress = 0,
  progressLabel,
  disabled,
  children,
  className = "",
  ...rest
}: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <Button
      {...rest}
      disabled={disabled || pct > 0} // lås knappen medan vi jobbar
      className={`relative overflow-hidden ${className}`}
    >
      {/* Fyllning bakom knappinnehållet */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full"
        style={{
          width: `${pct}%`,
          backgroundColor: "#22c55e",
          opacity: 0.5,
          transition: "width 200ms linear",
        }}
      />

      <span className="relative z-10 inline-flex items-center gap-2">
        {pct > 0 ? (
          <>
            <span>{progressLabel ?? "Working…"}</span>
            <span className="tabular-nums">{pct}%</span>
          </>
        ) : (
          children
        )}
      </span>
    </Button>
  );
}
