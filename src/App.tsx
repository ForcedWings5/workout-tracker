import { useEffect, useState } from "react";
import { useDb } from "./storage/DbContext";
import { findInProgressId } from "./storage/repo";
import { EditWorkout } from "./screens/EditWorkout";
import { ExerciseHistory } from "./screens/ExerciseHistory";
import type { CalendarState } from "./screens/HistoryCalendar";
import { LogWorkout } from "./screens/LogWorkout";
import { Progress } from "./screens/Progress";
import { Settings } from "./screens/Settings";
import { Today } from "./screens/Today";
import { Workouts } from "./screens/Workouts";
import { TabBar, type Tab } from "./ui/TabBar";

type Overlay =
  | { kind: "log"; sessionId: string }
  | { kind: "editWorkout"; workoutId: string }
  | { kind: "exercise"; exerciseId: string }
  /** A finished session opened for editing; closing it goes back to where it was opened from. */
  | { kind: "pastSession"; sessionId: string; backLabel: string; returnTo: View };
type View = { tab: Tab; overlay?: Overlay; calendar?: CalendarState };

export default function App() {
  const db = useDb();
  /** Undefined only while checking, at launch, for a workout to reopen. */
  const [view, setView] = useState<View>();

  // iOS often closes a home-screen app while the phone is locked between sets: opening it again
  // lands back in the workout in progress, not on Today.
  useEffect(() => {
    let current = true;
    const open = (sessionId?: string) => {
      if (current) setView((v) => v ?? (sessionId ? { tab: "today", overlay: { kind: "log", sessionId } } : { tab: "today" }));
    };
    findInProgressId(db).then(open, (err: unknown) => {
      console.error("Couldn't check for a workout in progress", err);
      open();
    });
    return () => {
      current = false;
    };
  }, [db]);

  if (!view) return <div className="app" />;

  if (view.overlay?.kind === "log") {
    return (
      <div className="app">
        <LogWorkout sessionId={view.overlay.sessionId} onClose={() => setView({ tab: "today" })} />
      </div>
    );
  }

  if (view.overlay?.kind === "pastSession") {
    const { sessionId, backLabel, returnTo } = view.overlay;
    return (
      <div className="app">
        <LogWorkout key={sessionId} sessionId={sessionId} mode="edit" backLabel={backLabel} onClose={() => setView(returnTo)} />
      </div>
    );
  }

  if (view.overlay?.kind === "exercise") {
    const { exerciseId } = view.overlay;
    return (
      <div className="app">
        <main>
          <ExerciseHistory
            exerciseId={exerciseId}
            onBack={() => setView({ tab: "progress", calendar: view.calendar })}
            onOpenSession={(sessionId, exerciseName) =>
              setView({
                tab: "progress",
                overlay: {
                  kind: "pastSession",
                  sessionId,
                  backLabel: exerciseName,
                  returnTo: { tab: "progress", overlay: { kind: "exercise", exerciseId }, calendar: view.calendar },
                },
              })
            }
          />
          <div className="tabbar-spacer" />
        </main>
        <TabBar active="progress" onChange={(tab) => setView({ tab })} />
      </div>
    );
  }

  if (view.overlay?.kind === "editWorkout") {
    return (
      <div className="app">
        <main>
          <EditWorkout workoutId={view.overlay.workoutId} onClose={() => setView({ tab: "workouts" })} />
        </main>
        <TabBar active="workouts" onChange={(tab) => setView({ tab })} />
      </div>
    );
  }

  return (
    <div className="app">
      <main>
        {view.tab === "today" ? (
          <Today onOpenLog={(sessionId) => setView({ tab: "today", overlay: { kind: "log", sessionId } })} />
        ) : view.tab === "progress" ? (
          <Progress
            onOpen={(exerciseId) => setView({ tab: "progress", overlay: { kind: "exercise", exerciseId }, calendar: view.calendar })}
            calendar={view.calendar}
            onCalendar={(calendar) => setView({ tab: "progress", calendar })}
            onOpenSession={(sessionId) =>
              setView({ tab: "progress", overlay: { kind: "pastSession", sessionId, backLabel: "Progress", returnTo: { tab: "progress", calendar: view.calendar } } })
            }
          />
        ) : view.tab === "workouts" ? (
          <Workouts onEdit={(workoutId) => setView({ tab: "workouts", overlay: { kind: "editWorkout", workoutId } })} />
        ) : (
          <Settings />
        )}
        <div className="tabbar-spacer" />
      </main>
      <TabBar active={view.tab} onChange={(tab) => setView({ tab })} />
    </div>
  );
}
