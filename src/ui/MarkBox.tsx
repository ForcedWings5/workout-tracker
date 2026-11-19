import { Check, Minus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type MarkState = "suggested" | "current" | "done" | "skipped";

type Props = { state: MarkState; label: string; onToggle: () => void };

/** The 44px mark box. Becoming done stamps it in red ink; it never animates on first render. */
export function MarkBox({ state, label, onToggle }: Props) {
  const prev = useRef(state);
  const [stamping, setStamping] = useState(false);

  useEffect(() => {
    if (state === "done" && prev.current !== "done") setStamping(true);
    prev.current = state;
  }, [state]);

  const classes = ["mark", `mark--${state}`, stamping && state === "done" ? "mark--stamp" : ""].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={classes}
      aria-label={label}
      aria-pressed={state === "done"}
      onClick={onToggle}
      onAnimationEnd={() => setStamping(false)}
    >
      {state === "done" && <Check size={24} strokeWidth={2.5} aria-hidden="true" />}
      {state === "skipped" && <Minus size={20} strokeWidth={2} aria-hidden="true" />}
    </button>
  );
}
