import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "board" | "outline" | "text" | "text-board" | "plain";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: ButtonVariant;
  /** Replaces the label with loadingLabel and disables the button. */
  loading?: boolean;
  loadingLabel?: string;
};

export function Button({ variant, loading = false, loadingLabel = "Saving…", className, children, disabled, type, ...rest }: Props) {
  const classes = ["btn", `btn--${variant}`, className].filter(Boolean).join(" ");
  return (
    <button type={type ?? "button"} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? loadingLabel : children}
    </button>
  );
}
