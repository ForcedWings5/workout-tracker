import { useState } from "react";
import { LogWorkout } from "./screens/LogWorkout";
import { Today } from "./screens/Today";
import { Notice } from "./ui/Notice";
import { ScreenHeader } from "./ui/ScreenHeader";
import { TabBar, type Tab } from "./ui/TabBar";

type View = { tab: Tab; overlay?: { kind: "log"; sessionId: string } };

const COMING: Record<Exclude<Tab, "today">, { title: string; text: string }> = {
  progress: { title: "Progress", text: "Charts for each exercise arrive in a later update. Your sets are already being saved." },
  workouts: { title: "Workouts", text: "Editing workouts and the rotation arrives in a later update." },
  settings: { title: "Settings", text: "Backups arrive in a later update. Always open Workout Tracker from the home-screen icon." },
};

export default function App() {
  const [view, setView] = useState<View>({ tab: "today" });

  if (view.overlay?.kind === "log") {
    return (
      <div className="app">
        <LogWorkout sessionId={view.overlay.sessionId} onClose={() => setView({ tab: "today" })} />
      </div>
    );
  }

  return (
    <div className="app">
      <main>
        {view.tab === "today" ? (
          <Today onOpenLog={(sessionId) => setView({ tab: "today", overlay: { kind: "log", sessionId } })} />
        ) : (
          <>
            <ScreenHeader title={COMING[view.tab].title} />
            <Notice>
              <p className="empty-text">{COMING[view.tab].text}</p>
            </Notice>
          </>
        )}
        <div className="tabbar-spacer" />
      </main>
      <TabBar active={view.tab} onChange={(tab) => setView({ tab })} />
    </div>
  );
}
