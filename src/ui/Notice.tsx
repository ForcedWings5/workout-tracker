import type { HTMLAttributes, ReactNode } from "react";

type Props = HTMLAttributes<HTMLElement> & { children: ReactNode };

/** A bone notice nailed to the board. Never nest one inside another. */
export function Notice({ children, className, ...rest }: Props) {
  return (
    <section className={className ? `notice ${className}` : "notice"} {...rest}>
      <span className="notice__nail" aria-hidden="true" />
      <span className="notice__nail" aria-hidden="true" />
      {children}
    </section>
  );
}
