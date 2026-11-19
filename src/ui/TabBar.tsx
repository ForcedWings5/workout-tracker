import { ListOrdered, ScrollText, Settings, TrendingUp, type LucideIcon } from "lucide-react";

export type Tab = "today" | "progress" | "workouts" | "settings";

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: "today", label: "Today", Icon: ScrollText },
  { id: "progress", label: "Progress", Icon: TrendingUp },
  { id: "workouts", label: "Workouts", Icon: ListOrdered },
  { id: "settings", label: "Settings", Icon: Settings },
];

type Props = { active: Tab; onChange: (tab: Tab) => void };

export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar__inner">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="tabbar__tab"
            aria-current={active === id ? "page" : undefined}
            onClick={() => onChange(id)}
          >
            <Icon size={24} strokeWidth={2} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
