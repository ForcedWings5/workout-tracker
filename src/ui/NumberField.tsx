import { useEffect, useRef, useState } from "react";
import { parseNumberInput } from "../logic/input";

type Props = {
  /** Accessible name, e.g. "Set 1 weight". */
  label: string;
  value?: number;
  unit: string;
  kind: "weight" | "amount";
  /** Pre-filled and not confirmed: shown in draft ink. */
  draft: boolean;
  /** Struck through (a skipped set). */
  struck?: boolean;
  placeholder?: string;
  onCommit: (value: number | undefined) => void;
};

const format = (v: number | undefined) => (v === undefined ? "" : String(v));

/** A number edited in place. Commits on blur or Enter; a bad value commits undefined, never NaN. */
export function NumberField({ label, value, unit, kind, draft, struck = false, placeholder, onCommit }: Props) {
  const [text, setText] = useState(format(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(format(value));
  }, [value]);

  const commit = () => {
    focused.current = false;
    if (text === format(value)) return;
    const parsed = parseNumberInput(text);
    setText(format(parsed));
    if (parsed !== value) onCommit(parsed);
  };

  const classes = ["num", draft ? "num--draft" : "", struck ? "num--struck" : ""].filter(Boolean).join(" ");

  return (
    <label className={classes}>
      <input
        className="num__input"
        aria-label={label}
        type="text"
        inputMode={kind === "weight" ? "decimal" : "numeric"}
        enterKeyHint="done"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        // Size to the digits, so the unit sits right after the value.
        style={{ width: `calc(${Math.max(2, (text || placeholder || "").length)}ch + ${8}px)` }}
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <span className="num__unit" aria-hidden="true">
        {unit}
      </span>
    </label>
  );
}
