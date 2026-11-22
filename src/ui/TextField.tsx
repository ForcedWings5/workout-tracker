import { useEffect, useRef, useState, type HTMLAttributes } from "react";

type Props = {
  label: string;
  /** The saved value. Shown again when the field is left with something that couldn't be saved. */
  value: string;
  placeholder?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  className?: string;
  disabled?: boolean;
  /** Saves the typed text. A rejected promise's message is shown under the field. */
  onCommit: (text: string) => Promise<void>;
};

/** A labelled field on a notice. Saves on every change, so nothing waits for a blur. */
export function TextField({ label, value, placeholder, inputMode, className, disabled, onCommit }: Props) {
  const [text, setText] = useState(value);
  const [error, setError] = useState<string>();
  const focused = useRef(false);
  const latest = useRef(0);
  /** The saved value when editing began. Every keystroke saves, so `value` may be a half-typed step. */
  const atFocus = useRef(value);

  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);

  const change = (raw: string) => {
    setText(raw);
    const attempt = ++latest.current;
    onCommit(raw).then(
      () => attempt === latest.current && setError(undefined),
      (err: unknown) => attempt === latest.current && setError(err instanceof Error ? err.message : "Couldn't save"),
    );
  };

  return (
    <label className={className ? `form-field ${className}` : "form-field"}>
      <span className="form-field__label">{label}</span>
      <input
        className="field"
        type="text"
        inputMode={inputMode}
        enterKeyHint="done"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        onFocus={() => {
          focused.current = true;
          atFocus.current = value;
        }}
        onChange={(e) => change(e.target.value)}
        onBlur={() => {
          focused.current = false;
          if (error) {
            // Leaving a field that couldn't be saved puts back what it held before editing,
            // not a half-typed step ("B" on the way to clearing "Barbell Bench Press").
            const restore = atFocus.current;
            latest.current++;
            setError(undefined);
            setText(restore);
            // Always save it back: `value` comes from a live query that can lag behind the
            // half-typed saves, so it can't tell us whether the restore is needed.
            onCommit(restore).catch((err: unknown) => console.error("Couldn't save", err));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      {error && (
        <span className="form-field__error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
