import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  back?: { label: string; onClick: () => void };
  right?: ReactNode;
  title: string;
  subtitle?: ReactNode;
};

/** The title set directly on the board: back link and extra on top, then the blackletter title. */
export function ScreenHeader({ back, right, title, subtitle }: Props) {
  const long = title.length > 20;
  return (
    <header className="screen-header">
      {(back || right) && (
        <div className="screen-header__bar">
          {back ? (
            <button type="button" className="btn btn--text-board" style={{ paddingLeft: 0 }} onClick={back.onClick}>
              <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
              {back.label}
            </button>
          ) : (
            <span />
          )}
          {right}
        </div>
      )}
      <h1 className={long ? "screen-header__title screen-header__title--long" : "screen-header__title"}>{title}</h1>
      {subtitle && <p className="screen-header__subtitle">{subtitle}</p>}
    </header>
  );
}
